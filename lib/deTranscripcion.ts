import type { Palabra } from "./subtitulos";
import type { Golpe, Guion } from "@/types/guion";

/**
 * El guion sacado de lo que ya dijo.
 *
 * Es la puerta de "ya lo tengo grabado": el dueño que llega con el video hecho
 * —porque lo tenía en la cabeza y lo dijo— no debería tener que inventarse una
 * idea para que el sistema le escriba un texto que él ya dijo mejor. Se graba,
 * se transcribe, y el guion sale de ahí.
 *
 * Aquí no escribe nadie: esto reparte en bloques lo que YA dijo, sin cambiar
 * una palabra. Lo único que no puede salir de la transcripción es qué imagen
 * va encima de cada bloque, y eso se pide aparte, en /api/apoyos, y es
 * opcional: sin ello el montaje sigue dando cortes, subtítulos, carátula,
 * ritmo y transiciones.
 */

/** La pausa más corta que todavía separa dos frases al hablar. */
const PAUSA_FRASE = 0.45;
/** Un gancho son los tres primeros segundos. Más allá ya es otra frase. */
const GANCHO_S = 3;
const GANCHO_PALABRAS = 9;
/** Más de esto en un bloque es una parrafada: se parte aunque no haya pausa. */
const MAX_PALABRAS = 20;
/** El tope. Los reels de referencia traen tres o cuatro bloques. */
const MAX_BLOQUES = 6;

const texto = (ps: Palabra[]) => ps.map((p) => p.palabra).join(" ").replace(/\s+/g, " ").trim();

/**
 * Dónde termina el gancho.
 *
 * En la pausa más larga de los tres primeros segundos, y si no hay ninguna, en
 * la novena palabra. El gancho tiene que ser corto porque es lo que se queda
 * en pantalla como carátula: si se lleva veinte palabras, el título tapa medio
 * video.
 */
function cortarGancho(palabras: Palabra[]): number {
  const tope = Math.min(
    palabras.length,
    Math.max(
      1,
      palabras.findIndex((p) => p.hasta - palabras[0].desde > GANCHO_S) + 1 || palabras.length,
    ),
    GANCHO_PALABRAS,
  );
  let mejor = tope;
  let mayor = 0;
  for (let i = 1; i < tope; i++) {
    const hueco = palabras[i].desde - palabras[i - 1].hasta;
    // A partir de la cuarta palabra: cortar en la segunda deja un gancho que
    // no dice nada.
    if (i >= 4 && hueco > mayor) {
      mayor = hueco;
      mejor = i;
    }
  }
  return mejor;
}

/** El hueco antes de la palabra i. */
const hueco = (ps: Palabra[], i: number) => ps[i].desde - ps[i - 1].hasta;

/**
 * Reparte las palabras en bloques por sus pausas.
 *
 * Por las pausas de verdad, no por un número de bloques decidido de antemano:
 * los bloques son SUS frases, y repartirlas a partes iguales juntaría el final
 * de una con el principio de la siguiente. Donde él calló es donde cambia el
 * plano.
 *
 * Luego dos correcciones. Quien habla seguido no deja pausas, y sin la segunda
 * saldría una parrafada de cuarenta palabras con un solo cambio de plano — y
 * es justo quien más necesita que el sistema le ponga el ritmo. Y si salen
 * demasiados bloques se funden los vecinos separados por la pausa más corta,
 * que son los que menos se notan al juntarlos.
 */
function enBloques(palabras: Palabra[], max: number): Palabra[][] {
  if (palabras.length === 0) return [];
  if (max <= 1) return [palabras];

  const cortes: number[] = [];
  for (let i = 1; i < palabras.length; i++) {
    if (hueco(palabras, i) >= PAUSA_FRASE) cortes.push(i);
  }

  // Los bloques demasiado largos se parten por su pausa mayor, las veces que
  // haga falta, aunque ninguna llegue al umbral de frase.
  for (;;) {
    const bordes = [0, ...cortes, palabras.length];
    let partido = false;
    for (let b = 0; b + 1 < bordes.length; b++) {
      const [a, z] = [bordes[b], bordes[b + 1]];
      if (z - a <= MAX_PALABRAS) continue;
      let donde = a + Math.round((z - a) / 2);
      let mayor = -1;
      for (let i = a + 1; i < z; i++) {
        // No justo en el borde: un bloque de dos palabras no es un bloque.
        if (i - a < 4 || z - i < 4) continue;
        if (hueco(palabras, i) > mayor) {
          mayor = hueco(palabras, i);
          donde = i;
        }
      }
      cortes.push(donde);
      cortes.sort((x, y) => x - y);
      partido = true;
      break;
    }
    if (!partido) break;
  }

  while (cortes.length + 1 > max) {
    let cual = 0;
    for (let i = 1; i < cortes.length; i++) {
      if (hueco(palabras, cortes[i]) < hueco(palabras, cortes[cual])) cual = i;
    }
    cortes.splice(cual, 1);
  }

  const bloques: Palabra[][] = [];
  let desde = 0;
  for (const c of [...cortes, palabras.length]) {
    if (c > desde) bloques.push(palabras.slice(desde, c));
    desde = c;
  }
  return bloques;
}

/**
 * El guion de lo que dijo, listo para el editor.
 *
 * `golpes[0]` **es** el gancho, literal, igual que en los guiones escritos: es
 * la invariante de la que depende la carátula y todo lo que la lee.
 */
export function guionDeLaVoz(palabras: Palabra[]): Guion | null {
  if (!palabras?.length) return null;

  const corte = cortarGancho(palabras);
  const gancho = palabras.slice(0, corte);
  const resto = palabras.slice(corte);
  const duracion = palabras[palabras.length - 1].hasta - palabras[0].desde;

  const bloques = [gancho, ...enBloques(resto, MAX_BLOQUES - 1)].filter((b) => b.length > 0);

  const golpes: Golpe[] = bloques.map((b) => ({
    texto: texto(b),
    direccion: "",
    // Sin imagen hasta que él la pida: inventarle aquí una descripción sería
    // escribir por él, que es lo que esta puerta existe para no hacer.
    apoyo: "",
    apoyo_tuyo: false,
  }));

  return {
    gancho: golpes[0]?.texto ?? "",
    golpes,
    cierre: {
      texto: golpes[golpes.length - 1]?.texto ?? "",
      caso_logico: "",
      caso_emocional: "",
    },
    como_grabar: { luz: "", fondo: "", encuadre: "", voz: "" },
    descripcion: "",
    palabras: palabras.length,
    duracion_s: Math.round(duracion),
    valor: "",
    limites: [],
  };
}
