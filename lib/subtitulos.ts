import { reubicar, type Tramo } from "@/lib/silencios";

/** Una palabra con sus tiempos, como los devuelve la transcripción. */
export type Palabra = { palabra: string; desde: number; hasta: number };

/** Lo que se ve de una vez en pantalla. */
export type Linea = { texto: string; desde: number; hasta: number };

/**
 * Cuántas palabras caben de un golpe.
 *
 * Tres, no una frase entera. En vertical y a la altura del pulgar, una línea
 * larga obliga a leer en vez de escuchar, y el video pasa a ser un texto con
 * una cara detrás.
 */
export const MAX_PALABRAS = 3;
/** Y ninguna se queda en pantalla más que esto, aunque sea una sola palabra. */
export const MAX_SEGUNDOS = 2.2;
/** Un hueco mayor que esto entre dos palabras es una frase nueva. */
const CORTE_POR_PAUSA = 0.6;

/**
 * Pasa los tiempos del video original al video ya cortado.
 *
 * Una palabra que cayó entera dentro de un silencio quitado desaparece — y eso
 * es correcto: si no se oye, no se subtitula. Una que quedó a caballo se
 * recorta al trozo que sobrevive, en vez de tirarla: el espectador la oye.
 */
export function reubicarPalabras(palabras: Palabra[], tramos: Tramo[]): Palabra[] {
  const salida: Palabra[] = [];
  for (const p of palabras) {
    const desde = reubicar(p.desde, tramos);
    const hasta = reubicar(p.hasta, tramos);
    if (desde === null && hasta === null) continue;
    const a = desde ?? reubicar(siguienteVivo(p.desde, tramos), tramos);
    const b = hasta ?? reubicar(anteriorVivo(p.hasta, tramos), tramos);
    if (a === null || b === null || b <= a) continue;
    salida.push({ palabra: p.palabra, desde: a, hasta: b });
  }
  return salida;
}

/** El primer instante vivo desde t hacia adelante. */
function siguienteVivo(t: number, tramos: Tramo[]): number {
  for (const tr of tramos) if (tr.hasta > t) return Math.max(t, tr.desde);
  return t;
}

/** El último instante vivo desde t hacia atrás. */
function anteriorVivo(t: number, tramos: Tramo[]): number {
  let ultimo = t;
  for (const tr of tramos) if (tr.desde < t) ultimo = Math.min(t, tr.hasta);
  return ultimo;
}

/** Agrupa palabras en líneas cortas, cortando donde el habla se detiene. */
export function enLineas(
  palabras: Palabra[],
  maxPalabras = MAX_PALABRAS,
  maxSegundos = MAX_SEGUNDOS,
): Linea[] {
  const lineas: Linea[] = [];
  let grupo: Palabra[] = [];

  const cerrar = () => {
    if (grupo.length === 0) return;
    lineas.push({
      texto: grupo.map((p) => p.palabra).join(" ").trim(),
      desde: grupo[0].desde,
      hasta: grupo[grupo.length - 1].hasta,
    });
    grupo = [];
  };

  for (const p of palabras) {
    if (grupo.length > 0) {
      const anterior = grupo[grupo.length - 1];
      const pausa = p.desde - anterior.hasta;
      const largo = p.hasta - grupo[0].desde;
      if (grupo.length >= maxPalabras || pausa > CORTE_POR_PAUSA || largo > maxSegundos) {
        cerrar();
      }
    }
    grupo.push(p);
  }
  cerrar();

  // Dos líneas no pueden solaparse ni pisarse: libass dibujaría las dos encima.
  for (let i = 1; i < lineas.length; i++) {
    if (lineas[i].desde < lineas[i - 1].hasta) lineas[i - 1].hasta = lineas[i].desde;
  }
  return lineas.filter((l) => l.texto && l.hasta > l.desde);
}

/** h:mm:ss.cc, que es lo único que ASS entiende. */
function reloj(t: number): string {
  const seguro = Math.max(0, t);
  const h = Math.floor(seguro / 3600);
  const m = Math.floor((seguro % 3600) / 60);
  const s = Math.floor(seguro % 60);
  const c = Math.floor((seguro * 100) % 100);
  return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}.${String(c).padStart(2, "0")}`;
}

/**
 * Una línea de diálogo ASS no puede llevar saltos ni llaves: `{` abre una
 * etiqueta de estilo y una llave suelta en el texto se come el resto.
 */
function limpiar(t: string): string {
  return t.replace(/[{}]/g, "").replace(/\s*\n\s*/g, " ").trim();
}

export type EstiloSubtitulo = {
  /** Alto del lienzo. El cuerpo se calcula a partir de él, no a ojo. */
  alto: number;
  ancho: number;
  /** Qué tan arriba del borde de abajo se sientan. En proporción del alto. */
  margen: number;
  color: string;
  contorno: string;
};

export const ESTILO: EstiloSubtitulo = {
  ancho: 1080,
  alto: 1920,
  margen: 0.22,
  color: "&H00FFFFFF",
  contorno: "&H00000000",
};

/**
 * El guion de subtítulos, en ASS y no en SRT.
 *
 * SRT no lleva estilo: el reproductor decide, y aquí no hay reproductor porque
 * las letras se queman en el video. ASS lleva tipografía, contorno, sombra y
 * posición dentro del propio archivo, que es justo lo que hace falta.
 */
export function aASS(lineas: Linea[], estilo: EstiloSubtitulo = ESTILO): string {
  // 5% del alto. Probado extrayendo fotogramas del MP4 que sale: por debajo
  // de esto se lee con esfuerzo en un telefono sostenido con una mano.
  const cuerpo = Math.round(estilo.alto * 0.05);
  const contorno = Math.max(2, Math.round(cuerpo * 0.13));
  const margenV = Math.round(estilo.alto * estilo.margen);
  const margenH = Math.round(estilo.ancho * 0.1);

  const cabecera = [
    "[Script Info]",
    "ScriptType: v4.00+",
    "WrapStyle: 0",
    "ScaledBorderAndShadow: yes",
    `PlayResX: ${estilo.ancho}`,
    `PlayResY: ${estilo.alto}`,
    "",
    "[V4+ Styles]",
    "Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding",
    // Alignment 2 = abajo y centrado. El margen vertical lo sube hasta donde
    // la interfaz de Instagram no le pone encima los botones.
    `Style: Voz,Outfit,${cuerpo},${estilo.color},${estilo.color},${estilo.contorno},&H64000000,-1,0,0,0,100,100,0,0,1,${contorno},${Math.round(contorno * 0.8)},2,${margenH},${margenH},${margenV},1`,
    "",
    "[Events]",
    "Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text",
  ];

  const eventos = lineas.map(
    (l) => `Dialogue: 0,${reloj(l.desde)},${reloj(l.hasta)},Voz,,0,0,0,,${limpiar(l.texto)}`,
  );

  return [...cabecera, ...eventos].join("\n") + "\n";
}
