import type { Palabra } from "@/lib/subtitulos";

/**
 * El ritmo: cada cuánto cambia el plano.
 *
 * Sale de medir tres reels de referencia, no de una opinión. En los tres hay
 * **un corte cada 2,0 a 5,1 segundos**, el plano mediano dura de 1,9 a 3,4
 * segundos, y entre el 43% y el 83% de los planos duran menos de tres.
 *
 * Lo importante: la mayoría de esos cortes **no son cortes de verdad**. Son
 * acercamientos sobre el mismo plano — la misma toma, más cerca. Por eso se
 * pueden hacer con un solo video grabado de una vez, que es lo que el dueño
 * sube.
 *
 * Y caen **entre palabra y palabra**, nunca en mitad de una: un cambio de
 * encuadre a mitad de sílaba se lee como un fallo, no como edición.
 */

export type Plano = {
  desde: number;
  hasta: number;
  /** 1 es el encuadre completo. 1.18 es un acercamiento. */
  zoom: number;
};

/** Cada cuánto cambia el plano. La mediana de las referencias. */
export const CADA_S = 2.6;
/** Lo mínimo que aguanta un plano sin parecer un tic. */
const MIN_S = 1.2;

/**
 * Los acercamientos, en escalera y sin repetir el anterior.
 *
 * No alterna entre dos valores: tres hacen que no se note el patrón. El 1 va
 * primero porque el primer plano tiene que enseñar el encuadre entero antes de
 * empezar a acercarse.
 */
const ESCALA = [1, 1.14, 1.06, 1.22];

export function planos(
  palabras: Palabra[],
  duracion: number,
  cada = CADA_S,
): Plano[] {
  if (duracion <= 0) return [];

  // Los sitios donde se puede cortar: los huecos entre palabra y palabra.
  // Sin transcripción se corta a intervalos fijos, que es peor pero sirve.
  const huecos = palabras.length
    ? palabras.slice(0, -1).map((p, i) => (p.hasta + palabras[i + 1].desde) / 2)
    : [];

  const cortes: number[] = [0];
  let siguiente = cada;
  while (siguiente < duracion - MIN_S) {
    const donde = huecos.length ? masCerca(huecos, siguiente) : siguiente;
    if (donde - cortes[cortes.length - 1] >= MIN_S) cortes.push(donde);
    siguiente += cada;
  }

  return cortes.map((desde, i) => ({
    desde,
    hasta: i + 1 < cortes.length ? cortes[i + 1] : duracion,
    zoom: ESCALA[i % ESCALA.length],
  }));
}

function masCerca(donde: number[], t: number): number {
  let mejor = donde[0];
  for (const d of donde) if (Math.abs(d - t) < Math.abs(mejor - t)) mejor = d;
  return mejor;
}

/**
 * La expresión de zoom para ffmpeg, anidada.
 *
 * Un `if` por plano, con el 1 de fondo. Es fea de leer y es la única forma de
 * decirle a un filtro que cambie de valor en momentos concretos.
 */
export function expresionZoom(lista: Plano[]): string {
  const utiles = lista.filter((p) => p.zoom !== 1);
  if (utiles.length === 0) return "";
  return utiles.reduce(
    (dentro, p) =>
      `if(between(in_time,${p.desde.toFixed(3)},${p.hasta.toFixed(3)}),${p.zoom},${dentro})`,
    "1",
  );
}
