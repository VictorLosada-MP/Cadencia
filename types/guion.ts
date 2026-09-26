/**
 * Los formatos, agrupados por lo que hay que producir.
 *
 * No todo es video. Un dueño de negocio que esta semana no quiere grabarse
 * sigue teniendo que publicar, y obligarle a elegir entre grabar o no publicar
 * es lo que rompe la constancia.
 */
export const FORMATOS = [
  {
    id: "camara" as const,
    familia: "video" as const,
    nombre: "A cámara",
    que: "Tú hablando al teléfono. Nada más: ni imágenes ni edición.",
    detalle: "3 o 4 frases",
    grabas: true,
  },
  {
    id: "lista" as const,
    familia: "video" as const,
    nombre: "Los 3 errores, uno por uno",
    que: "Cuentas varias cosas seguidas y en pantalla va saliendo 1, 2, 3. Se guarda mucho.",
    detalle: "una frase por punto",
    grabas: true,
  },
  {
    id: "voz-en-off" as const,
    familia: "video" as const,
    nombre: "Voz en off",
    que: "No sales tú: imágenes, tu voz encima y texto. Para cuando no quieres grabarte.",
    detalle: "4 o 5 frases",
    grabas: true,
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
