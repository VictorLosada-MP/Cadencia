import { FFmpeg } from "@ffmpeg/ffmpeg";
import { fetchFile } from "@ffmpeg/util";
import type { Tramo } from "@/lib/silencios";
import { expresionZoom, type Plano } from "@/lib/ritmo";

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
  insertos: Inserto[] = [],
  transiciones: Transicion[] = [],
  ritmo: Plano[] = [],
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

  // El ritmo: un acercamiento sobre el mismo plano cada dos segundos y pico.
  // Es lo que hacen las referencias, y se puede hacer con una sola toma —
  // que es lo único que el dueño graba.
  const zoom = expresionZoom(ritmo);
  const acercar = zoom
    ? `,zoompan=z='${zoom}':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=1:s=${SALIDA.ancho}x${SALIDA.alto}:fps=30`
    : "";

  partes.push(
    `[vc]crop=${recorte.ancho}:${recorte.alto}:${recorte.x}:${recorte.y},` +
      `scale=${SALIDA.ancho}:${SALIDA.alto}:flags=lanczos,setsar=1${acercar}[base]`,
  );

  // Los insertos tapan el video entero mientras dura la frase, con un zoom
  // lento. Una foto quieta a pantalla completa durante tres segundos parece un
  // error de reproducción; moviéndose despacio parece intencionado.
  let ultima = "base";
  insertos.slice(0, MAX_INSERTOS).forEach((ins, i) => {
    const entrada = i + 1; // la 0 es el video
    const dura = Math.max(0.1, ins.hasta - ins.desde);
    const fotogramas = Math.max(1, Math.round(dura * 30));
    partes.push(
      `[${entrada}:v]scale=${SALIDA.ancho}:${SALIDA.alto}:force_original_aspect_ratio=increase,` +
        `crop=${SALIDA.ancho}:${SALIDA.alto},setsar=1,` +
        `zoompan=z='min(zoom+0.0007,1.12)':d=${fotogramas}:s=${SALIDA.ancho}x${SALIDA.alto}:fps=30,` +
        // Sin esto el inserto empieza en su propio segundo cero y `enable` lo
        // dejaría fuera de su sitio.
        `setpts=PTS-STARTPTS+${ins.desde.toFixed(3)}/TB[ap${i}]`,
    );
    partes.push(
      `[${ultima}][ap${i}]overlay=0:0:enable='between(t,${ins.desde.toFixed(3)},${ins.hasta.toFixed(3)})':eof_action=pass[ov${i}]`,
    );
    ultima = `ov${i}`;
  });

  // Las transiciones: un borrón corto y un destello. Van entre BLOQUES del
  // guion, no en cada corte de silencio — un corte de silencio tiene que ser
  // invisible, y señalarlo con un efecto delata cada respiración quitada.
  const usadas = transiciones.slice(0, MAX_TRANSICIONES);
  if (usadas.length) {
    const borrones = usadas
      .map((t) => `between(t,${t.en.toFixed(3)},${(t.en + BORRON_S).toFixed(3)})`)
      .join("+");
    partes.push(`[${ultima}]gblur=sigma=16:enable='${borrones}'[bl]`);
    const destellos = usadas
      .map(
        (t) =>
          `between(t,${(t.en + 0.02).toFixed(3)},${(t.en + 0.02 + DESTELLO_S).toFixed(3)})`,
      )
      .join("+");
    // drawbox con enable y no `fade`: fade=in deja en blanco TODO lo anterior
    // a su arranque, así que un destello a mitad del video lo blanqueaba entero.
    partes.push(
      `[bl]drawbox=x=0:y=0:w=iw:h=ih:color=white@0.7:t=fill:enable='${destellos}'[tr]`,
    );
    ultima = "tr";
  }

  // fontsdir y no fontconfig: dentro de wasm no hay fuentes de sistema, así
  // que libass solo encuentra la que se le escribe en el disco virtual.
  if (conSubtitulos) {
    partes.push(`[${ultima}]subtitles=subs.ass:fontsdir=/tipografia[vout]`);
  } else {
    partes.push(`[${ultima}]null[vout]`);
  }

  return partes.join(";");
}

/** La parte de audio: la voz ya cortada, más los efectos en su sitio. */
export function filtrosAudio(sonidos: { en: number }[], primeraEntrada: number): string {
  if (sonidos.length === 0) return "";
  const partes = sonidos.map((s, i) => {
    const ms = Math.max(0, Math.round(s.en * 1000));
    // adelay pide un retraso por canal; el efecto es mono pero el amix puede
    // estar en estéreo, así que se dan dos y sobra uno sin molestar.
    return `[${primeraEntrada + i}:a]adelay=${ms}|${ms},volume=0.45[sfx${i}]`;
  });
  const entradas = sonidos.map((_, i) => `[sfx${i}]`).join("");
  partes.push(
    `[ac]${entradas}amix=inputs=${sonidos.length + 1}:duration=first:dropout_transition=0,volume=1.6[aout]`,
  );
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

/** Una imagen que tapa el video mientras se dice una frase. */
export type Inserto = {
  imagen: Blob;
  desde: number;
  hasta: number;
};

/** Un instante donde el video cambia de bloque. */
export type Transicion = {
  en: number;
  /** El efecto que suena ahí. null para que no suene nada. */
  sonido: Blob | null;
};

export type Montaje = {
  video: File | Blob;
  tramos: Tramo[];
  encuadre: Encuadre;
  /** El guion de subtítulos en ASS, o null para no quemar ninguno. */
  ass: string | null;
  conAudio: boolean;
  /** Las imágenes de apoyo, ya resueltas y en tiempos del video ya cortado. */
  insertos?: Inserto[];
  transiciones?: Transicion[];
  /** Los cambios de encuadre. Es lo que da el ritmo de las referencias. */
  ritmo?: Plano[];
};

/** Cuánto dura el desenfoque de una transición. Más y se nota el truco. */
const BORRON_S = 0.16;
/** Y el destello, más corto todavía: es un parpadeo, no un fundido. */
const DESTELLO_S = 0.07;

/**
 * Cuántos insertos y transiciones se admiten.
 *
 * Cada inserto es una entrada más para ffmpeg y una capa más que componer, y
 * esto corre dentro de un navegador. Un guion con ocho frases no necesita
 * ocho imágenes: necesita las que sostienen la idea.
 */
export const MAX_INSERTOS = 6;
export const MAX_TRANSICIONES = 8;

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

    // Cada inserto y cada efecto son una entrada más para ffmpeg, escrita
    // antes en el disco virtual. El orden importa: [0] es el video, luego los
    // insertos, luego los sonidos.
    const insertos = (m.insertos ?? []).slice(0, MAX_INSERTOS);
    const conSonido =
      m.conAudio ? (m.transiciones ?? []).filter((t) => t.sonido).slice(0, MAX_TRANSICIONES) : [];

    const entradas: string[] = ["-i", "entrada"];
    for (let i = 0; i < insertos.length; i++) {
      await f.writeFile(`ins${i}`, await fetchFile(insertos[i].imagen));
      entradas.push("-i", `ins${i}`);
    }
    for (let i = 0; i < conSonido.length; i++) {
      await f.writeFile(`sfx${i}.wav`, await fetchFile(conSonido[i].sonido!));
      entradas.push("-i", `sfx${i}.wav`);
    }

    const recorte = recorteDe(m.encuadre);
    const audio = filtrosAudio(conSonido, 1 + insertos.length);
    const grafo = [
      filtros(
        m.tramos,
        recorte,
        m.conAudio,
        Boolean(m.ass),
        insertos,
        m.transiciones ?? [],
        m.ritmo ?? [],
      ),
      ...(audio ? [audio] : []),
    ].join(";");

    const orden = [
      ...entradas,
      "-filter_complex", grafo,
      "-map", "[vout]",
      ...(m.conAudio
        ? ["-map", audio ? "[aout]" : "[ac]", "-c:a", "aac", "-b:a", "128k", "-ar", "44100"]
        : ["-an"]),
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
    const basura = ["entrada", "salida.mp4", "subs.ass"];
    for (let i = 0; i < MAX_INSERTOS; i++) basura.push(`ins${i}`);
    for (let i = 0; i < MAX_TRANSICIONES; i++) basura.push(`sfx${i}.wav`);
    for (const a of basura) await f.deleteFile(a).catch(() => {});
  }
}
