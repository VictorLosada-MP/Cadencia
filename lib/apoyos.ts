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
  /** Falso cuando el sitio es aproximado porque no se encontró la frase. */
  exacto?: boolean;
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
  const conApoyo = golpes
    .map((g, i) => ({ ...g, i }))
    .filter((g) => g.apoyo?.trim());
  if (conApoyo.length === 0) return [];

  // Primero, los que se encuentran de verdad.
  const salida: Apoyo[] = [];
  let cursor = 0;
  for (const g of conApoyo) {
    const hallado = buscarFrase(g.texto, palabras, cursor);
    if (hallado) cursor = hallado.fin;
    salida.push({
      golpe: g.i,
      pide: g.apoyo!.trim(),
      texto: g.texto,
      momento: hallado?.momento ?? null,
      exacto: Boolean(hallado),
    });
  }

  // Y después, los que no.
  //
  // Nadie lee un guion palabra por palabra: se cambia el orden, se salta una
  // muletilla, se dice a su manera. El primer golpe ES el gancho literal, así
  // que ese casa siempre y los demás no — por eso antes solo se colocaba UNA
  // imagen, la del principio, y el resto del video se quedaba tal cual.
  //
  // Los encontrados hacen de ancla y los perdidos se reparten entre medias.
  // Un sitio aproximado dentro de la frase correcta vale mucho más que no
  // poner nada, y la pantalla dice cuáles son aproximados.
  rellenar(salida, duracionTotal(palabras));
  return salida;
}

function duracionTotal(palabras: Palabra[]): number {
  return palabras.length ? palabras[palabras.length - 1].hasta : 0;
}

/** Reparte los que no se encontraron entre los que sí, en proporción. */
function rellenar(lista: Apoyo[], duracion: number) {
  if (duracion <= 0) return;

  for (let i = 0; i < lista.length; i++) {
    if (lista[i].momento) continue;

    // Entre el anterior encontrado y el siguiente encontrado.
    let antes = 0;
    for (let j = i - 1; j >= 0; j--) {
      if (lista[j].momento) { antes = lista[j].momento!.hasta; break; }
    }
    let despues = duracion;
    for (let j = i + 1; j < lista.length; j++) {
      if (lista[j].momento) { despues = lista[j].momento!.desde; break; }
    }
    if (despues <= antes) despues = duracion;

    // Cuántos perdidos hay en ese hueco, y cuál de ellos es este.
    let huecos = 0, mio = 0;
    for (let j = 0; j < lista.length; j++) {
      if (lista[j].momento && j < i) continue;
      if (lista[j].momento) break;
      if (j === i) mio = huecos;
      if (!lista[j].momento && j >= i - huecos) huecos++;
    }
    huecos = Math.max(1, huecos);

    const paso = (despues - antes) / (huecos + 1);
    const desde = antes + paso * (mio + 1);
    lista[i].momento = { desde, hasta: Math.min(duracion, desde + 2), confianza: 0 };
  }
}

/** Lo más corto que aguanta una imagen en pantalla sin parecer un parpadeo. */
export const MIN_S = 0.8;
/**
 * Y lo más largo que se queda una imagen.
 *
 * 2,8 segundos, medido: en las referencias el B-roll ocupa cerca de la mitad
 * del tiempo y **alterna cada dos segundos**, no se queda cinco segundos
 * quieto. Con el tope en 5 tapaba el 58% del video de una sentada y la cara
 * desaparecía.
 */
export const MAX_S = 2.8;

export function acotar(m: Momento, tope: number): { desde: number; hasta: number } {
  const desde = Math.max(0, m.desde);
  const bruto = Math.max(MIN_S, Math.min(MAX_S, m.hasta - m.desde));
  return { desde, hasta: Math.min(tope, desde + bruto) };
}
