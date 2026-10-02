import { FFmpeg } from "@ffmpeg/ffmpeg";
import { fetchFile } from "@ffmpeg/util";
import { duracionDe, type Tramo } from "@/lib/silencios";
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
/**
 * El grafo de "voz en off": las imágenes SON el video.
 *
 * Cada imagen ocupa su tramo con un zoom lento, se encadenan, y el audio del
 * dueño va entero por encima. Si hay huecos sin imagen se estira la anterior:
 * un video con negro en medio parece roto.
 */
export function filtrosVoz(
  insertos: Inserto[],
  duracion: number,
  conSubtitulos: boolean,
  transiciones: Transicion[] = [],
): string {
  const partes: string[] = [];
  const usados = insertos.slice(0, MAX_INSERTOS);

  // Sin ninguna imagen no hay video que armar: un fondo liso y la voz.
  if (usados.length === 0) {
    partes.push(
      `color=c=0x111111:s=${SALIDA.ancho}x${SALIDA.alto}:r=30:d=${duracion.toFixed(2)},setsar=1[base]`,
    );
  } else {
    // Cada imagen se estira hasta donde empieza la siguiente, para que no
    // queden huecos negros entre una y otra.
    const trozos = usados.map((ins, i) => ({
      ...ins,
      desde: i === 0 ? 0 : ins.desde,
      hasta: i + 1 < usados.length ? usados[i + 1].desde : duracion,
    }));

    trozos.forEach((t, i) => {
      const dura = Math.max(0.2, t.hasta - t.desde);
      partes.push(
        `[${i}:v]scale=${SALIDA.ancho}:${SALIDA.alto}:force_original_aspect_ratio=increase,` +
          `crop=${SALIDA.ancho}:${SALIDA.alto},setsar=1,` +
          `zoompan=z='min(zoom+0.0006,1.14)':d=${Math.max(1, Math.round(dura * 30))}:` +
          `s=${SALIDA.ancho}x${SALIDA.alto}:fps=30,setpts=PTS-STARTPTS[t${i}]`,
      );
    });
    partes.push(
      `${trozos.map((_, i) => `[t${i}]`).join("")}concat=n=${trozos.length}:v=1:a=0[base]`,
    );
  }

  let ultima = "base";
  const usadas = transiciones.slice(0, MAX_TRANSICIONES);
  if (usadas.length) {
    const destellos = usadas
      .map((t) => `between(t,${t.en.toFixed(3)},${(t.en + DESTELLO_S).toFixed(3)})`)
      .join("+");
    partes.push(
      `[base]drawbox=x=0:y=0:w=iw:h=ih:color=white@0.6:t=fill:enable='${destellos}'[tr]`,
    );
    ultima = "tr";
  }

  partes.push(
    conSubtitulos
      ? `[${ultima}]subtitles=subs.ass:fontsdir=/tipografia[vout]`
      : `[${ultima}]null[vout]`,
  );
  return partes.join(";");
}

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
      // Un fundido de 25 ms a cada lado del corte.
      //
      // Sin esto la onda salta de golpe de un valor a otro y se oye un clic en
      // cada empalme. Es el detalle que separa un corte que no se nota de uno
      // que suena a tijera — y sale gratis.
      const dura = Math.max(0.06, t.hasta - t.desde);
      partes.push(
        `[0:a]atrim=start=${desde}:end=${hasta},asetpts=PTS-STARTPTS,` +
          `afade=t=in:st=0:d=${FUNDIDO_S},` +
          `afade=t=out:st=${(dura - FUNDIDO_S).toFixed(3)}:d=${FUNDIDO_S}[a${i}]`,
      );
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
  //
  // El `fps=30` de delante no es adorno: es lo que impide que el video se
  // despegue del audio. `zoompan` saca UN fotograma por cada uno que entra,
  // pero les pone la hora a 30 por segundo. Con un video de 60 fps —lo que
  // graba medio teléfono— eso son 720 fotogramas de entrada convertidos en 720
  // de salida a 30, o sea el doble de duración: la imagen a media velocidad y
  // la voz separándose de la boca más y más. Medido: una pieza de 12 s salía
  // de 24, con las marcas en 4, 10, 16 y 22 en vez de 2, 5, 8 y 11. A 24 fps
  // pasaba lo contrario, acelerado.
  //
  // `fps=30` iguala la entrada antes de entrar, duplicando o soltando
  // fotogramas, y entonces lo que sale dura lo que tiene que durar. Comprobado
  // a 24, 30 y 60 fps y con fotogramas de duración variable: desfase cero.
  const zoom = expresionZoom(ritmo);
  const acercar = zoom
    ? `,fps=30,zoompan=z='${zoom}':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=1:s=${SALIDA.ancho}x${SALIDA.alto}:fps=30`
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
export function filtrosAudio(
  sonidos: { en: number }[],
  primeraEntrada: number,
  voz = "ac",
): string {
  if (sonidos.length === 0) return "";
  const partes = sonidos.map((s, i) => {
    const ms = Math.max(0, Math.round(s.en * 1000));
    // adelay pide un retraso por canal; el efecto es mono pero el amix puede
    // estar en estéreo, así que se dan dos y sobra uno sin molestar.
    return `[${primeraEntrada + i}:a]adelay=${ms}|${ms},volume=0.45[sfx${i}]`;
  });
  const entradas = sonidos.map((_, i) => `[sfx${i}]`).join("");
  partes.push(
    `[${voz}]${entradas}amix=inputs=${sonidos.length + 1}:duration=first:dropout_transition=0,volume=1.6[aout]`,
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
    if (!dur) return null;

    return {
      duracion: Number(dur[1]) * 3600 + Number(dur[2]) * 60 + Number(dur[3]),
      // Un archivo de solo audio no tiene dimensiones, y exigirlas aquí era lo
      // que impedía cargar NINGÚN audio en voz en off: daba igual el formato,
      // porque un m4a, un aac o un wav no traen línea de Video y esta función
      // devolvía null para los tres. Las dimensiones vuelven en cero y decide
      // quien llama: el paso que pide video las exige, el que pide voz no.
      ancho: dim ? Number(dim[1]) : 0,
      alto: dim ? Number(dim[2]) : 0,
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

/** Lo ancho que se guarda la portada. Lo justo para reconocerla en la ficha. */
const PORTADA_ANCHO = 180;

/**
 * Un fotograma del montaje, en base64.
 *
 * No del segundo cero: el primero de un reel con carátula es el fondo antes de
 * que entre el título, y muchas cámaras arrancan con un cuadro oscuro.
 *
 * Si falla —un códec que no esté en este build, un archivo raro— devuelve null
 * y la pieza se apunta sin fotograma. Perder la ficha entera por una miniatura
 * sería cambiar lo que importa por lo que decora.
 */
async function fotograma(f: FFmpeg, duracion: number): Promise<string | null> {
  const en = Math.max(0, Math.min(1.5, duracion * 0.4));
  try {
    const codigo = await f.exec([
      "-ss", en.toFixed(2),
      "-i", "salida.mp4",
      "-frames:v", "1",
      "-vf", `scale=${PORTADA_ANCHO}:-2`,
      "-q:v", "6",
      "-f", "image2",
      "-y", "portada.jpg",
    ]);
    if (codigo !== 0) return null;
    const datos = (await f.readFile("portada.jpg")) as Uint8Array;
    return aBase64(datos);
  } catch {
    return null;
  }
}

/** btoa de un buffer, por trozos: de una vez revienta la pila con archivos grandes. */
function aBase64(bytes: Uint8Array): string {
  let texto = "";
  const trozo = 0x8000;
  for (let i = 0; i < bytes.length; i += trozo) {
    texto += String.fromCharCode(...bytes.subarray(i, i + trozo));
  }
  return btoa(texto);
}

export type Montaje = {
  /**
   * Lo que grabó el dueño. En "a cámara" es el video; en "voz en off" es
   * **solo el audio**, y entonces el video se arma con las imágenes.
   */
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
  /**
   * Verdad cuando lo que entra es solo audio.
   *
   * Entonces no hay nada que recortar ni que acercar: el video se construye
   * encadenando las imágenes, cada una con su zoom lento, y el audio va
   * encima entero. El formato "voz en off" pedía un video que por definición
   * no existe — ese era el fallo.
   */
  soloVoz?: boolean;
};

/** El fundido de audio en cada empalme. Menos y se oye el clic; más y se nota. */
const FUNDIDO_S = 0.025;

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
/** Lo que sale de montar: el MP4 y su fotograma. */
export type Resultado = {
  video: Blob;
  /** El fotograma en base64, sin el prefijo "data:". null si no salió. */
  portada: string | null;
};

export async function montar(
  m: Montaje,
  alAvanzar?: (a: Avance) => void,
): Promise<Resultado> {
  const f = await cargarMotor(alAvanzar);

  // Lo último que dijo ffmpeg antes de morir. Sin esto, un fallo de montaje
  // llega a la pantalla como "código 1" y no hay forma de saber qué pasó —
  // ni para quien lo usa, ni para quien lo arregla.
  const ultimas: string[] = [];
  const anotar = ({ message }: { message: string }) => {
    ultimas.push(message);
    if (ultimas.length > 40) ultimas.shift();
  };
  f.on("log", anotar);

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

    // En voz en off las imágenes van PRIMERO: ellas son el video, y el audio
    // del dueño entra detrás. En a cámara el orden es el contrario.
    const entradas: string[] = [];
    if (m.soloVoz) {
      for (let i = 0; i < insertos.length; i++) {
        await f.writeFile(`ins${i}`, await fetchFile(insertos[i].imagen));
        entradas.push("-i", `ins${i}`);
      }
      entradas.push("-i", "entrada");
    } else {
      entradas.push("-i", "entrada");
      for (let i = 0; i < insertos.length; i++) {
        await f.writeFile(`ins${i}`, await fetchFile(insertos[i].imagen));
        entradas.push("-i", `ins${i}`);
      }
    }
    // Cuántas entradas hay ANTES de los efectos: es el índice del primero.
    //
    // Se cuenta aquí y no después, que es donde estaba el fallo: contándolo
    // al final incluía los propios efectos y el grafo pedía `[4:a]` cuando
    // solo había cuatro entradas (0..3). ffmpeg contestaba "Invalid file
    // index 4" y el montaje entero se caía.
    const antesDelSonido = entradas.filter((e) => e === "-i").length;

    for (let i = 0; i < conSonido.length; i++) {
      await f.writeFile(`sfx${i}.wav`, await fetchFile(conSonido[i].sonido!));
      entradas.push("-i", `sfx${i}.wav`);
    }

    const recorte = recorteDe(m.encuadre);
    // De dónde sale la voz: la entrada 0 en a cámara, la última en voz en off.
    const laVoz = m.soloVoz ? `${insertos.length}:a` : "ac";
    const audio = filtrosAudio(conSonido, antesDelSonido, laVoz);

    const duracion = duracionDe(m.tramos);
    const grafo = [
      m.soloVoz
        ? filtrosVoz(insertos, duracion, Boolean(m.ass), m.transiciones ?? [])
        : filtros(
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
        ? [
            "-map",
            audio ? "[aout]" : `[${laVoz}]`,
            "-c:a", "aac", "-b:a", "128k", "-ar", "44100",
            // En voz en off el video dura lo que duran las imágenes y el audio
            // lo que dura la voz. Sin esto, el más largo alarga el archivo con
            // negro o con silencio al final.
            ...(m.soloVoz ? ["-shortest"] : []),
          ]
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
    if (codigo !== 0) {
      const pista = ultimas
        .filter((l) => /error|invalid|no such|unable|failed|cannot/i.test(l))
        .slice(-3)
        .join(" · ");
      throw new Error(
        pista ? `ffmpeg falló: ${pista}` : `ffmpeg terminó con código ${codigo}.`,
      );
    }

    const datos = await f.readFile("salida.mp4");
    // La portada se saca aquí, con el motor que acaba de escribir el archivo.
    // Antes se sacaba pintando el MP4 en un <video> del navegador, y eso falla
    // en cuanto el navegador no sabe decodificar H.264: devolvía null sin
    // ruido y la ficha se guardaba sin fotograma. ffmpeg decodifica lo que él
    // mismo acaba de codificar, siempre.
    const portada = await fotograma(f, duracion);
    alAvanzar?.({ parte: 1, mensaje: "Listo." });
    // El tipo de readFile cubre también texto; aquí siempre son bytes.
    const bytes = datos as Uint8Array;
    return {
      video: new Blob([bytes.slice().buffer as ArrayBuffer], { type: "video/mp4" }),
      portada,
    };
  } finally {
    f.off("progress", escuchar);
    f.off("log", anotar);
    // El disco virtual vive lo que vive la pestaña: un video de 200 MB que se
    // queda dentro deja sin memoria al siguiente montaje.
    const basura = ["entrada", "salida.mp4", "subs.ass", "portada.jpg"];
    for (let i = 0; i < MAX_INSERTOS; i++) basura.push(`ins${i}`);
    for (let i = 0; i < MAX_TRANSICIONES; i++) basura.push(`sfx${i}.wav`);
    for (const a of basura) await f.deleteFile(a).catch(() => {});
  }
}
