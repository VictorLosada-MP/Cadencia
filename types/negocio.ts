/**
 * El Perfil de Negocio. Es de quien se diagnostica, no de quien construyó el
 * sistema — y esa distinción no es obvia: mientras estuvo cableado a un solo
 * perfil, cualquier prueba con otro negocio corría contra el dossier ajeno.
 */
export type Negocio = {
  /** Qué vende. */
  oferta: string;
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
};

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

export const CAMPOS_EXTRA = [
  {
    id: "freno" as const,
    etiqueta: "Qué le está costando hoy",
    pista: "El problema por el que te busca",
    filas: 2,
  },
  {
    id: "accion" as const,
    etiqueta: "Tu CTA de hoy",
    pista: "El texto del botón o la línea que pide la acción",
    filas: 1,
  },
  {
    id: "voz" as const,
    etiqueta: "Cómo hablas",
    pista:
      "Pega algo tuyo tal cual: un audio transcrito, un mensaje a un cliente. Sin esto las correcciones salen en español llano, no en el tuyo",
    filas: 5,
  },
];

export function negocioListo(n: Negocio): boolean {
  return Boolean(n.oferta?.trim() && n.cliente?.trim() && n.despues?.trim());
}
