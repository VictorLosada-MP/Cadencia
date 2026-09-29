import type { Palabra } from "@/lib/subtitulos";

/**
 * Cuándo se dice cada frase del guion.
 *
 * El guion dice *qué* se ve mientras se dice cada golpe, pero no *cuándo*: eso
 * depende de cómo lo grabó. La transcripción trae el cuándo de cada palabra,
 * así que casar las dos cosas es lo que convierte "aquí va una imagen" en un
 * momento del video.
 *
 * Nadie lee un guion palabra por palabra. Se cambia el orden, se salta una
 * muletilla, se repite media frase. Por eso no se busca la frase literal: se
 * busca la secuencia de palabras que más se le parece.
 */

export type Momento = {
  desde: number;
  hasta: number;
  /** De 0 a 1: qué parte de las palabras del guion se encontraron. */
  confianza: number;
};

/** Sin tildes, sin signos y en minúsculas: así "Diagnóstico" casa con "diagnostico". */
function normalizar(t: string): string[] {
  return t
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9ñ\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2);
}

/** Cuántas palabras del guion se pueden saltar seguidas antes de darse por vencido. */
const SALTOS = 6;
/** Por debajo de esto no es un hallazgo: es una casualidad. */
const MINIMA = 0.4;

/**
 * Busca una frase dentro de la transcripción, a partir de una posición.
 *
 * Devuelve también dónde acabó, para que el golpe siguiente empiece a buscar
 * después: los golpes van en orden, y usar ese orden evita que la frase tres
 * se enganche a una palabra suelta del principio.
 */
export function buscarFrase(
  frase: string,
  palabras: Palabra[],
  desdeIndice = 0,
): { momento: Momento; fin: number } | null {
  const buscadas = normalizar(frase);
  if (buscadas.length === 0 || palabras.length === 0) return null;

  const dichas = palabras.map((p) => normalizar(p.palabra)[0] ?? "");

  let mejor: { i: number; j: number; aciertos: number } | null = null;

  for (let i = desdeIndice; i < palabras.length; i++) {
    let k = 0; // qué palabra del guion toca
    let aciertos = 0;
    let ultimo = i;
    let saltos = 0;

    for (let j = i; j < palabras.length && k < buscadas.length; j++) {
      if (dichas[j] && dichas[j] === buscadas[k]) {
        aciertos++;
        k++;
        ultimo = j;
        saltos = 0;
      } else if (++saltos > SALTOS) {
        break;
      }
    }

    if (!mejor || aciertos > mejor.aciertos) mejor = { i, j: ultimo, aciertos };
    // Si ya se encontraron todas, no hay nada mejor que buscar.
    if (mejor.aciertos === buscadas.length) break;
  }

  if (!mejor || mejor.aciertos === 0) return null;
  const confianza = mejor.aciertos / buscadas.length;
  if (confianza < MINIMA) return null;

  return {
    momento: {
      desde: palabras[mejor.i].desde,
      hasta: palabras[mejor.j].hasta,
      confianza,
    },
    fin: mejor.j + 1,
  };
}

export type Golpe = { texto: string; apoyo?: string };

export type Apoyo = {
  /** El índice del golpe en el guion. Identifica la fila aunque cambie todo. */
  golpe: number;
  /** Lo que el guion pide que se vea. Es también lo que se busca en el banco. */
  pide: string;
  texto: string;
  momento: Momento | null;
};

/**
 * Los apoyos del guion, cada uno con su momento.
 *
 * Los golpes se buscan en orden y cada uno arranca donde acabó el anterior.
 * Un golpe que no se encuentra devuelve momento null en vez de un momento
 * inventado: poner una imagen a ojo encima de la frase equivocada es peor que
 * no ponerla, y la pantalla lo dice.
 */
export function apoyosDe(golpes: Golpe[], palabras: Palabra[]): Apoyo[] {
  const salida: Apoyo[] = [];
  let cursor = 0;

  golpes.forEach((g, i) => {
    if (!g.apoyo?.trim()) return;
    const hallado = buscarFrase(g.texto, palabras, cursor);
    if (hallado) cursor = hallado.fin;
    salida.push({
      golpe: i,
      pide: g.apoyo.trim(),
      texto: g.texto,
      momento: hallado?.momento ?? null,
    });
  });

  return salida;
}

/** Lo más corto que aguanta una imagen en pantalla sin parecer un parpadeo. */
export const MIN_S = 0.8;
/** Y lo más largo, para que un golpe de diez segundos no tape el video entero. */
export const MAX_S = 5;

export function acotar(m: Momento, tope: number): { desde: number; hasta: number } {
  const desde = Math.max(0, m.desde);
  const bruto = Math.max(MIN_S, Math.min(MAX_S, m.hasta - m.desde));
  return { desde, hasta: Math.min(tope, desde + bruto) };
}
