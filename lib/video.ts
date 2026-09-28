import { FFmpeg } from "@ffmpeg/ffmpeg";
import { fetchFile } from "@ffmpeg/util";
import type { Tramo } from "@/lib/silencios";

/**
 * El montaje, dentro del navegador.
 *
 * ffmpeg compilado a WebAssembly, servido desde `public/` y no desde un CDN:
 * cargarlo de unpkg ataría el producto a que un tercero siga publicándolo, y
 * esa es justo la dependencia que el producto promete no tener.
 *
 * Es la versión de un solo hilo. La de varios necesita SharedArrayBuffer, que
 * a su vez obliga a poner cabeceras COOP/COEP en todo el sitio — y esas
 * cabeceras romperían las fotos de Pexels del carrusel, que vienen de otro
 * dominio. Más lento, pero no rompe lo que ya funciona.
 */

/** 9:16, que es lo que piden Reels, TikTok y Shorts. */
export const SALIDA = { ancho: 1080, alto: 1920 };

const BASE = "/ffmpeg";
const FUENTE = "/tipografia/Outfit-Bold.ttf";

/** Más allá de esto, el sistema de archivos de wasm se queda sin memoria. */
export const MAX_SEGUNDOS = 180;
export const MAX_BYTES = 300_000_000;

/** Un filtro largo de más revienta la línea de comandos y la memoria. */
const MAX_TRAMOS = 80;

export type Encuadre = {
  /** Ancho y alto del video de origen, en píxeles. */
  ancho: number;
  alto: number;
  /**
   * Dónde se pone la ventana 9:16 dentro del original, de 0 a 1. 0.5 es el
   * centro. Se mueve en el eje que sobra: horizontal si el video es más ancho
   * que 9:16, vertical si es más alto.
   */
  posicion: number;
};

export type Recorte = { ancho: number; alto: number; x: number; y: number };

const par = (n: number) => Math.max(2, Math.floor(n / 2) * 2);

/**
 * La ventana 9:16 dentro del original.
 *
 * Los cuatro números salen pares porque yuv420p guarda el color a mitad de
 * resolución: con un ancho impar, ffmpeg falla en vez de redondear.
 */
export function recorteDe({ ancho, alto, posicion }: Encuadre): Recorte {
  const objetivo = SALIDA.ancho / SALIDA.alto;
  const suyo = ancho / alto;
  const p = Math.min(1, Math.max(0, posicion));

  if (suyo > objetivo) {
    // Más ancho de lo que cabe: se recorta a los lados.
    const w = par(alto * objetivo);
    return { ancho: w, alto: par(alto), x: par((ancho - w) * p), y: 0 };
  }
  // Más alto (o ya vertical): se recorta arriba y abajo.
  const h = par(ancho / objetivo);
  return { ancho: par(ancho), alto: h, x: 0, y: par((alto - h) * p) };
}

/**
 * El grafo de filtros.
 *
 * Un solo paso a propósito: cortar a un archivo intermedio y después recortar
 * y quemar los subtítulos significaría codificar el video dos veces, y aquí
 * cada codificación son minutos.
 */
export function filtros(
  tramos: Tramo[],
  recorte: Recorte,
  conAudio: boolean,
  conSubtitulos: boolean,
): string {
  const usados = tramos.slice(0, MAX_TRAMOS);
  const partes: string[] = [];

  usados.forEach((t, i) => {
    const desde = t.desde.toFixed(3);
    const hasta = t.hasta.toFixed(3);
    // setpts/asetpts reinician el reloj de cada trozo. Sin eso, concat los
    // pega conservando los tiempos viejos y el video queda con huecos
    // congelados justo donde se supone que se quitó el silencio.
    partes.push(`[0:v]trim=start=${desde}:end=${hasta},setpts=PTS-STARTPTS[v${i}]`);
    if (conAudio) {
      partes.push(`[0:a]atrim=start=${desde}:end=${hasta},asetpts=PTS-STARTPTS[a${i}]`);
    }
  });

  const entradas = usados
    .map((_, i) => (conAudio ? `[v${i}][a${i}]` : `[v${i}]`))
    .join("");
  partes.push(
    `${entradas}concat=n=${usados.length}:v=1:a=${conAudio ? 1 : 0}[vc]${conAudio ? "[ac]" : ""}`,
  );

  const cadena = [
    `crop=${recorte.ancho}:${recorte.alto}:${recorte.x}:${recorte.y}`,
    `scale=${SALIDA.ancho}:${SALIDA.alto}:flags=lanczos`,
    "setsar=1",
    // fontsdir y no fontconfig: dentro de wasm no hay fuentes de sistema, así
    // que libass solo encuentra la que se le escribe en el disco virtual.
    ...(conSubtitulos ? [`subtitles=subs.ass:fontsdir=/tipografia`] : []),
  ].join(",");
  partes.push(`[vc]${cadena}[vout]`);

  return partes.join(";");
}

export type Medida = { duracion: number; ancho: number; alto: number };

/**
 * Ancho, alto y duración leídos por el propio ffmpeg.
 *
 * Existe por los iPhone. Graban en HEVC cuando están en "Alta eficiencia", y
 * Chrome en escritorio no siempre sabe decodificar eso: el `<video>` no llega
 * ni a dar la duración. ffmpeg sí lo lee, así que el video se puede montar
 * igual — lo único que se pierde es la vista previa del navegador.
 *
 * `ffmpeg -i` sin salida termina en error a propósito: lo que interesa es lo
 * que escribe por el camino.
 */
export async function medirConMotor(
  archivo: File | Blob,
  alAvanzar?: (a: Avance) => void,
): Promise<Medida | null> {
  const f = await cargarMotor(alAvanzar);
  const lineas: string[] = [];
  const oir = ({ message }: { message: string }) => lineas.push(message);
  f.on("log", oir);
  try {
    await f.writeFile("sonda", await fetchFile(archivo));
    await f.exec(["-i", "sonda"]).catch(() => 1);
    const todo = lineas.join("\n");

    const dur = todo.match(/Duration:\s*(\d+):(\d+):(\d+\.?\d*)/);
    const dim = todo.match(/Stream #\d+:\d+.*?Video:.*?\b(\d{2,5})x(\d{2,5})\b/);
    if (!dur || !dim) return null;

    return {
      duracion: Number(dur[1]) * 3600 + Number(dur[2]) * 60 + Number(dur[3]),
      ancho: Number(dim[1]),
      alto: Number(dim[2]),
    };
  } catch {
    return null;
  } finally {
    f.off("log", oir);
    await f.deleteFile("sonda").catch(() => {});
  }
}

export type Avance = {
  /** De 0 a 1. Es una estimación del propio ffmpeg, no una promesa. */
  parte: number;
  mensaje: string;
};

let motor: FFmpeg | null = null;

/** Carga el núcleo una vez por pestaña. Son 32 MB: no se repite. */
export async function cargarMotor(alAvanzar?: (a: Avance) => void): Promise<FFmpeg> {
  if (motor) return motor;
  const f = new FFmpeg();
  alAvanzar?.({ parte: 0, mensaje: "Trayendo el motor de video (32 MB, solo la primera vez)…" });
  await f.load({
    coreURL: `${BASE}/ffmpeg-core.js`,
    wasmURL: `${BASE}/ffmpeg-core.wasm`,
  });
  motor = f;
  return f;
}

/**
 * Saca el audio a WAV con el motor.
 *
 * También existe por los iPhone. Cuando el navegador no sabe abrir el
 * contenedor, `decodeAudioData` falla y con él se van las dos cosas que valen
 * de este editor: cortar los silencios y subtitular. ffmpeg sí lo abre, y un
 * WAV lo decodifica cualquier navegador.
 *
 * `-vn` para no tocar el video: extraer el audio de cinco minutos así tarda
 * segundos, no minutos.
 */
export async function extraerAudio(
  archivo: File | Blob,
  alAvanzar?: (a: Avance) => void,
): Promise<Blob | null> {
  const f = await cargarMotor(alAvanzar);
  try {
    alAvanzar?.({ parte: 0, mensaje: "Sacando el audio con el motor…" });
    await f.writeFile("conaudio", await fetchFile(archivo));
    const codigo = await f.exec([
      "-i", "conaudio",
      "-vn",
      "-ac", "1",
      "-ar", "16000",
      "-c:a", "pcm_s16le",
      "-y", "voz.wav",
    ]);
    if (codigo !== 0) return null;
    const datos = (await f.readFile("voz.wav")) as Uint8Array;
    // Un WAV de solo cabecera significa que no había pista que sacar.
    if (datos.byteLength <= 44) return null;
    return new Blob([datos.slice().buffer as ArrayBuffer], { type: "audio/wav" });
  } catch {
    return null;
  } finally {
    for (const a of ["conaudio", "voz.wav"]) await f.deleteFile(a).catch(() => {});
  }
}

export type Montaje = {
  video: File | Blob;
  tramos: Tramo[];
  encuadre: Encuadre;
  /** El guion de subtítulos en ASS, o null para no quemar ninguno. */
  ass: string | null;
  conAudio: boolean;
};

/**
 * Monta el video y devuelve el MP4.
 *
 * H.264 y AAC en MP4 porque es lo que Instagram y TikTok aceptan sin volver a
 * comprimir. WebM sería más rápido de producir aquí y no lo admite ninguna de
 * las dos.
 */
export async function montar(
  m: Montaje,
  alAvanzar?: (a: Avance) => void,
): Promise<Blob> {
  const f = await cargarMotor(alAvanzar);

  const escuchar = ({ progress }: { progress: number }) => {
    // ffmpeg devuelve valores fuera de rango cuando la duración no cuadra.
    const parte = Math.min(0.99, Math.max(0, progress));
    alAvanzar?.({ parte, mensaje: `Montando… ${Math.round(parte * 100)}%` });
  };
  f.on("progress", escuchar);

  try {
    alAvanzar?.({ parte: 0, mensaje: "Preparando los archivos…" });
    await f.writeFile("entrada", await fetchFile(m.video));

    if (m.ass) {
      await f.createDir("/tipografia").catch(() => {});
      await f.writeFile("/tipografia/Outfit-Bold.ttf", await fetchFile(FUENTE));
      await f.writeFile("subs.ass", new TextEncoder().encode(m.ass));
    }

    const recorte = recorteDe(m.encuadre);
    const orden = [
      "-i", "entrada",
      "-filter_complex", filtros(m.tramos, recorte, m.conAudio, Boolean(m.ass)),
      "-map", "[vout]",
      ...(m.conAudio ? ["-map", "[ac]", "-c:a", "aac", "-b:a", "128k", "-ar", "44100"] : ["-an"]),
      "-c:v", "libx264",
      // veryfast y no ultrafast: ultrafast produce archivos casi del doble, y
      // aquí lo que se sube después también cuesta tiempo al dueño.
      "-preset", "veryfast",
      "-crf", "24",
      "-pix_fmt", "yuv420p",
      "-r", "30",
      // Sin esto el índice queda al final y el video no empieza a verse hasta
      // que se ha descargado entero.
      "-movflags", "+faststart",
      "-y", "salida.mp4",
    ];

    const codigo = await f.exec(orden);
    if (codigo !== 0) throw new Error(`ffmpeg terminó con código ${codigo}.`);

    const datos = await f.readFile("salida.mp4");
    alAvanzar?.({ parte: 1, mensaje: "Listo." });
    // El tipo de readFile cubre también texto; aquí siempre son bytes.
    const bytes = datos as Uint8Array;
    return new Blob([bytes.slice().buffer as ArrayBuffer], { type: "video/mp4" });
  } finally {
    f.off("progress", escuchar);
    // El disco virtual vive lo que vive la pestaña: un video de 200 MB que se
    // queda dentro deja sin memoria al siguiente montaje.
    for (const a of ["entrada", "salida.mp4", "subs.ass"]) {
      await f.deleteFile(a).catch(() => {});
    }
  }
}
