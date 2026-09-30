/**
 * Qué vas a grabar. **Nada más que eso.**
 *
 * Antes había cuatro opciones y dos de ellas —"sencillo" y "con producción"—
 * no describían la grabación sino la EDICIÓN: hablaban de subtítulos, de
 * transiciones y de "media hora de edición". Eso le decía al dueño que tenía
 * que grabar de forma distinta según la opción, cuando no es verdad: se graba
 * igual. Y encima duplicaba la elección, porque cuánto se edita se decide
 * después, en el paso 4, que es donde está el editor.
 *
 * Ahora esta pantalla solo pregunta lo único que cambia lo que hace falta de
 * él: si sale su cara, si solo sale su voz, o si no sale ninguna de las dos.
 */
export const FORMATOS = [
  {
    id: "camara" as const,
    familia: "camara" as const,
    nombre: "A cámara",
    que: "Sales tú hablando. Grabas con el teléfono como te salga: los cortes, el encuadre y los subtítulos los pone el sistema después.",
    detalle: "3 a 5 frases",
    graba: "video" as const,
  },
  {
    id: "voz-en-off" as const,
    familia: "voz" as const,
    nombre: "Voz en off",
    que: "No sales tú: solo tu voz sobre imágenes. Grabas únicamente el audio, y el sistema arma el video con las imágenes del guion.",
    detalle: "4 o 5 frases",
    graba: "audio" as const,
  },
  {
    id: "carrusel" as const,
    familia: "carrusel" as const,
    nombre: "Carrusel",
    que: "Varias láminas que se pasan con el dedo. Sin cámara y sin voz.",
    detalle: "de 5 a 8 láminas",
    graba: "nada" as const,
  },
];

export type Formato = (typeof FORMATOS)[number]["id"];
export type Familia = (typeof FORMATOS)[number]["familia"];
/** Qué tiene que grabar el dueño. Decide qué le pide el paso 4. */
export type Graba = (typeof FORMATOS)[number]["graba"];

/**
 * Los ids viejos siguen resolviendo.
 *
 * Hay guiones ya guardados con "sencillo" y "producido": si dejaran de
 * resolver, la pieza de la semana pasada se abriría rota.
 */
const VIEJOS: Record<string, Formato> = {
  sencillo: "camara",
  producido: "camara",
};

export const formatoPorId = (id: string) =>
  FORMATOS.find((f) => f.id === id) ?? FORMATOS.find((f) => f.id === VIEJOS[id]);

export const familiaDe = (id: string): Familia => formatoPorId(id)?.familia ?? "camara";
export const grabaDe = (id: string): Graba => formatoPorId(id)?.graba ?? "video";

/** El prompt que produce cada familia. */
export const PROMPT_DE: Record<Familia, string> = {
  camara: "3-guion.md",
  voz: "3-guion.md",
  carrusel: "3-carrusel.md",
};

export type Gancho = {
  texto: string;
  por_que: string;
  camino: string;
};

export type Ganchos = {
  idea_afilada: string;
  asi_no: string;
  asi_si: string;
  ganchos: Gancho[];
  limites: string[];
};

export type Golpe = {
  texto: string;
  /** Una acción o expresión física. Nunca una emoción abstracta. */
  direccion: string;
  /** Qué se ve mientras lo dice. Vacío en el formato sencillo. */
  apoyo?: string;
  /**
   * Verdad solo cuando ese apoyo **no se puede resolver con una foto de
   * archivo**: una foto suya con ese cliente, una captura de sus propios
   * números. Falso —lo normal— cuando describe algo que existe en cualquier
   * banco, y entonces el sistema lo busca solo sin pedirle nada.
   */
  apoyo_tuyo?: boolean;
};

export type Guion = {
  gancho: string;
  golpes: Golpe[];
  cierre: { texto: string; caso_logico: string; caso_emocional: string };
  como_grabar: { luz: string; fondo: string; encuadre: string; voz: string };
  descripcion: string;
  palabras: number;
  duracion_s: number;
  valor: string;
  limites: string[];
};

export type Lamina = {
  numero: number;
  titular: string;
  cuerpo: string;
  /** Qué se ve en la lámina. Nada de "imagen inspiradora". */
  imagen: string;
};

export type Carrusel = {
  laminas: Lamina[];
  descripcion: string;
  valor: string;
  limites: string[];
};

export type Pieza = Guion | Carrusel;

export const esCarrusel = (p: Pieza): p is Carrusel => "laminas" in p;
export const esGuion = (p: Pieza): p is Guion => !esCarrusel(p);
