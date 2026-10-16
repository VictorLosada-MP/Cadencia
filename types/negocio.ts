import type { Paleta } from "@/lib/marca";

/**
 * El Perfil de Negocio. Es de quien se diagnostica, no de quien construyó el
 * sistema — y esa distinción no es obvia: mientras estuvo cableado a un solo
 * perfil, cualquier prueba con otro negocio corría contra el dossier ajeno.
 */
export type Negocio = {
  /**
   * Empresa o marca personal. Vacío mientras no lo haya dicho.
   *
   * No es una etiqueta de catálogo: cambia la corrección. El primer punto del
   * diagnóstico juzga el nombre del perfil, y a una empresa con razón social
   * no se le propone otro nombre —eso no es una corrección, es pedirle que
   * cambie su dominio y su facturación—, mientras que a una marca personal
   * añadirle al lado la palabra por la que la buscan sí es el arreglo real.
   * Sin este campo las dos recibían la misma reprimenda.
   */
  tipo?: TipoNegocio;
  /** El nombre con el que lo encuentran: el de la empresa, o el suyo. */
  nombre?: string;
  /** Qué vende, en una frase. */
  oferta: string;
  /**
   * Lo que vende, en detalle: variedades, formatos, cantidades, planes.
   *
   * Existe porque `oferta` es una frase y con una frase no se escribe una
   * pieza concreta. Medido: al elegir un gancho el sistema devolvía «el perfil
   * no especifica las características de cada variedad» — y tenía razón, no
   * había dónde ponerlo.
   */
  detalle?: string;
  /** A quién le sirve. */
  cliente: string;
  /** Cómo queda ese cliente después. */
  despues: string;
  /** Qué le está costando hoy. Opcional: se puede preguntar después. */
  freno?: string;
  /** Muestras de cómo habla, en crudo. Sin esto no hay corrección con su voz. */
  voz?: string;
  /** El CTA que usa hoy. */
  accion?: string;
  /** Lo que le escriben y le preguntan. Dice en qué escalón está su audiencia. */
  senales?: string;
  /**
   * Los colores de su marca, leídos de su cuadrícula. null = usa los de serie.
   *
   * No es una preferencia de pantalla: es lo que hace que la carátula del video
   * y las láminas del carrusel se parezcan a lo que esa cuenta ya publica.
   */
  paleta?: Paleta | null;
  /** Su arroba, con o sin «@». Va impreso en las láminas del carrusel. */
  handle?: string;
  /** Su foto de perfil, en base64 y ya reducida. Va en las láminas. */
  avatar?: string;
  /**
   * La captura de su cuadrícula, reducida.
   *
   * De ella salió la paleta. Se guarda para poder enseñarle de dónde salieron
   * sus colores y para que esté ahí al entrar desde otro aparato — la paleta
   * ya viajaba sola, pero sin la captura no había cómo releerla.
   */
  cuadricula?: string;
};

export type TipoNegocio = "" | "empresa" | "persona";

export type { Paleta } from "@/lib/marca";

export const TIPOS: { id: Exclude<TipoNegocio, "">; etiqueta: string; pista: string }[] = [
  {
    id: "empresa",
    etiqueta: "Una empresa",
    pista: "El negocio tiene nombre propio, distinto del tuyo",
  },
  {
    id: "persona",
    etiqueta: "Marca personal",
    pista: "La cara y el nombre del negocio eres tú",
  },
];

/** La etiqueta del campo del nombre. Cambia porque no se pide lo mismo. */
export function etiquetaNombre(tipo: TipoNegocio | undefined): string {
  if (tipo === "empresa") return "Nombre de la empresa";
  if (tipo === "persona") return "Tu nombre, o el de tu marca personal";
  return "Nombre";
}

export function pistaNombre(tipo: TipoNegocio | undefined): string {
  if (tipo === "empresa") return "Tal cual lo lleva registrado y lo escribe la gente";
  if (tipo === "persona") return "Como apareces en tu perfil";
  return "Primero di arriba si es una empresa o eres tú";
}

export const CAMPOS_NUCLEO = [
  {
    id: "oferta" as const,
    etiqueta: "Qué vendes",
    pista: "En una frase, como se lo dirías a alguien en un ascensor",
    filas: 2,
  },
  {
    id: "cliente" as const,
    etiqueta: "A quién le sirve",
    pista: "Qué tipo de negocio o de persona te compra",
    filas: 2,
  },
  {
    id: "despues" as const,
    etiqueta: "Cómo queda después",
    pista: "En qué cambia su situación cuando termina contigo",
    filas: 2,
  },
];

/**
 * La voz no va entre lo opcional aunque el diagnóstico pueda correr sin ella.
 * La Función 3 no escribe sin esto, así que esconderla aquí y exigirla allá es
 * mandar a alguien a una puerta cerrada sin decirle dónde está la llave.
 */
export const CAMPO_VOZ = {
  id: "voz" as const,
  etiqueta: "Cómo hablas",
  pista:
    "Pega algo tuyo tal cual: un audio que transcribas, un mensaje largo que le mandaste a un cliente, una nota de voz pasada a texto. Cuanto más crudo, mejor",
  filas: 5,
};

/**
 * El detalle de la oferta y el CTA. Visibles, no escondidos.
 *
 * Estaban los dos detrás de «+ afinar más (opcional)», y el sistema los pide
 * por su nombre: la semana escribe «se puede completar en tu negocio, en "Tu
 * CTA de hoy"» y el dueño abría esta pantalla y no veía ningún campo así.
 * Pedir un dato y esconder su casilla es peor que no pedirlo.
 */
export const CAMPOS_PEDIDOS = [
  {
    id: "detalle" as const,
    etiqueta: "Lo que vendes, en detalle",
    pista:
      "Variedades, formatos, cantidades, planes, precios si los dices. Tal cual se lo explicarías a alguien que ya te va a comprar",
    filas: 4,
  },
  {
    id: "accion" as const,
    etiqueta: "Tu CTA de hoy",
    pista: "El texto del botón o la línea que pide la acción",
    filas: 1,
  },
];

export const CAMPOS_EXTRA = [
  {
    id: "freno" as const,
    etiqueta: "Qué le está costando hoy",
    pista: "El problema por el que te busca",
    filas: 2,
  },
  {
    id: "senales" as const,
    etiqueta: "Qué te escriben",
    pista:
      "Lo que te preguntan por privado o en comentarios. Es lo que dice en qué punto está tu audiencia — la gente pregunta desde donde está",
    filas: 4,
  },
];

/**
 * `tipo` y `nombre` entran en lo obligatorio.
 *
 * Son dos toques y una palabra, y sin ellos el diagnóstico juzga a ciegas el
 * nombre del perfil — que es su primer punto. Pedirlos después, cuando ya
 * escribió el veredicto, es llegar tarde.
 */
export function negocioListo(n: Negocio): boolean {
  return Boolean(
    n.tipo &&
      n.nombre?.trim() &&
      n.oferta?.trim() &&
      n.cliente?.trim() &&
      n.despues?.trim(),
  );
}
