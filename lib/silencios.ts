/**
 * Dónde habla y dónde no.
 *
 * Todo pasa en el navegador y sin modelo: es aritmética sobre la onda. El
 * audio de alguien hablando a cámara no sale de su máquina para esto.
 *
 * La cuenta se parte en dos a propósito. `envolvente` es lo caro y se calcula
 * UNA vez al cargar el video; `tramosAudibles` es lo barato y se recalcula en
 * cada movimiento del deslizador. Sin esa separación, tocar el umbral
 * significaría volver a decodificar el audio entero y la respuesta dejaría de
 * ser inmediata.
 */

/** Un trozo que se queda, en segundos del video ORIGINAL. */
export type Tramo = { desde: number; hasta: number };

export type Ajustes = {
  /** Por debajo de esto se considera silencio. En dBFS: -60 es casi nada. */
  umbral_db: number;
  /** Un silencio más corto que esto no se corta: es una respiración. */
  silencio_min_s: number;
  /** Lo que se deja a cada lado, para no comerse el principio de la palabra. */
  margen_s: number;
};

export const AJUSTES: Ajustes = {
  umbral_db: -38,
  silencio_min_s: 0.35,
  margen_s: 0.08,
};

/** Ventana de análisis. 20ms es más corto que cualquier sílaba. */
export const VENTANA_MS = 20;

const SILENCIO_ABSOLUTO = -100;

/**
 * RMS por ventana, en dBFS.
 *
 * RMS y no pico: un chasquido de la boca marca pico alto y no es voz, y
 * cortar por picos deja dentro todos los ruidos del cuarto.
 */
export function envolvente(
  canal: Float32Array,
  muestreo: number,
  ventana_ms = VENTANA_MS,
): Float32Array {
  const paso = Math.max(1, Math.round((muestreo * ventana_ms) / 1000));
  const n = Math.ceil(canal.length / paso);
  const salida = new Float32Array(n);

  for (let i = 0; i < n; i++) {
    const desde = i * paso;
    const hasta = Math.min(desde + paso, canal.length);
    let suma = 0;
    for (let j = desde; j < hasta; j++) suma += canal[j] * canal[j];
    const rms = Math.sqrt(suma / Math.max(1, hasta - desde));
    salida[i] = rms > 0 ? 20 * Math.log10(rms) : SILENCIO_ABSOLUTO;
  }
  return salida;
}

/**
 * El nivel del ruido de fondo: el percentil 10 de la envolvente.
 *
 * Sirve para proponer un umbral que tenga que ver con SU cuarto. Un umbral
 * fijo de -38 dB deja dentro todo el silencio de quien graba con un aire
 * acondicionado encendido, y se come las palabras de quien graba con un
 * micrófono bueno en una habitación tratada.
 */
export function ruidoDeFondo(env: Float32Array): number {
  const reales = Array.from(env).filter((v) => v > SILENCIO_ABSOLUTO);
  if (reales.length === 0) return SILENCIO_ABSOLUTO;
  reales.sort((a, b) => a - b);
  return reales[Math.floor(reales.length * 0.1)];
}

/** Un umbral a 8 dB por encima de su ruido de fondo, dentro de lo razonable. */
export function umbralSugerido(env: Float32Array): number {
  const piso = ruidoDeFondo(env);
  return Math.round(Math.min(-24, Math.max(-55, piso + 8)));
}

/**
 * Los trozos que se quedan.
 *
 * Devuelve SIEMPRE al menos un tramo. Un video que se analiza y da cero tramos
 * —porque el umbral quedó por encima de toda la voz— no puede devolver un
 * video vacío: devuelve el original entero, que es lo que el dueño esperaba.
 */
export function tramosAudibles(
  env: Float32Array,
  duracion_s: number,
  ajustes: Ajustes = AJUSTES,
  ventana_ms = VENTANA_MS,
): Tramo[] {
  const ventana_s = ventana_ms / 1000;
  const entero: Tramo[] = [{ desde: 0, hasta: duracion_s }];
  if (env.length === 0 || duracion_s <= 0) return entero;

  // Primero los huecos de silencio lo bastante largos.
  const minVentanas = Math.max(1, Math.round(ajustes.silencio_min_s / ventana_s));
  const huecos: Tramo[] = [];
  let inicio = -1;

  for (let i = 0; i <= env.length; i++) {
    const callado = i < env.length && env[i] < ajustes.umbral_db;
    if (callado && inicio < 0) inicio = i;
    if (!callado && inicio >= 0) {
      if (i - inicio >= minVentanas) {
        huecos.push({ desde: inicio * ventana_s, hasta: i * ventana_s });
      }
      inicio = -1;
    }
  }

  if (huecos.length === 0) return entero;

  // El margen devuelve al hueco un poco de cada lado: cortar exactamente donde
  // baja del umbral se come el arranque de la consonante siguiente.
  const recortados = huecos
    .map((h) => ({
      desde: h.desde + ajustes.margen_s,
      hasta: h.hasta - ajustes.margen_s,
    }))
    .filter((h) => h.hasta > h.desde);

  if (recortados.length === 0) return entero;

  // Y lo que queda entre hueco y hueco es lo que se publica.
  const tramos: Tramo[] = [];
  let cursor = 0;
  for (const h of recortados) {
    if (h.desde > cursor) tramos.push({ desde: cursor, hasta: Math.min(h.desde, duracion_s) });
    cursor = Math.max(cursor, h.hasta);
  }
  if (cursor < duracion_s) tramos.push({ desde: cursor, hasta: duracion_s });

  // Un tramo de dos centésimas no es una frase: es un chasquido que pasó el
  // umbral. Dejarlo dentro produce un video que tartamudea.
  const utiles = tramos.filter((t) => t.hasta - t.desde >= 0.12);
  return utiles.length ? utiles : entero;
}

export const duracionDe = (tramos: Tramo[]) =>
  tramos.reduce((s, t) => s + (t.hasta - t.desde), 0);

/**
 * Dónde cae, en el video ya cortado, un instante del original.
 *
 * Devuelve null si ese instante cayó dentro de un trozo que se quitó — que es
 * la respuesta correcta para una palabra que se fue con el silencio.
 */
export function reubicar(t: number, tramos: Tramo[]): number | null {
  let acumulado = 0;
  for (const tr of tramos) {
    if (t < tr.desde) return null;
    if (t <= tr.hasta) return acumulado + (t - tr.desde);
    acumulado += tr.hasta - tr.desde;
  }
  return null;
}
