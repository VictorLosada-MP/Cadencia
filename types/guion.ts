/**
 * Los formatos, agrupados por lo que hay que producir.
 *
 * No todo es video. Un dueño de negocio que esta semana no quiere grabarse
 * sigue teniendo que publicar, y obligarle a elegir entre grabar o no publicar
 * es lo que rompe la constancia.
 */
export const FORMATOS = [
  {
    id: "sencillo" as const,
    familia: "video" as const,
    nombre: "A cámara, sencillo",
    que: "Tú hablando, con subtítulos y los cortes justos. Media hora de edición.",
    detalle: "3 o 4 frases",
    grabas: true,
  },
  {
    id: "producido" as const,
    familia: "video" as const,
    nombre: "A cámara, con producción",
    que: "Lo mismo, más imágenes de apoyo, algún texto animado y transiciones. Se nota, y cuesta más.",
    detalle: "4 o 5 frases, con apoyo en cada una",
    grabas: true,
  },
  {
    id: "voz-en-off" as const,
    familia: "video" as const,
    nombre: "Voz en off",
    que: "No sales tú: solo imágenes, tu voz encima y texto. Para cuando no quieres grabarte la cara.",
    detalle: "4 o 5 frases",
    grabas: false,
  },
  {
    id: "carrusel" as const,
    familia: "carrusel" as const,
    nombre: "Carrusel",
    que: "Varias láminas que se pasan con el dedo. Sin cámara, sin voz, sin edición.",
    detalle: "de 5 a 8 láminas",
    grabas: false,
  },
];

export type Formato = (typeof FORMATOS)[number]["id"];
export type Familia = (typeof FORMATOS)[number]["familia"];

export const formatoPorId = (id: string) => FORMATOS.find((f) => f.id === id);
export const familiaDe = (id: string): Familia => formatoPorId(id)?.familia ?? "video";

/** El prompt que produce cada familia. */
export const PROMPT_DE: Record<Familia, string> = {
  video: "3-guion.md",
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
