import type { Imagen } from "@/lib/modelo";

/**
 * Lo que el usuario mete. Dos maneras para lo mismo — captura o texto — porque
 * la captura es rápida y el texto es exacto, y ninguna sirve en todos los casos.
 */

export const PLATAFORMAS = [
  "Instagram",
  "TikTok",
  "YouTube",
  "LinkedIn",
  "Facebook",
  "WhatsApp Business",
  "Sitio web",
  "Otra",
] as const;

export type Plataforma = (typeof PLATAFORMAS)[number];

/**
 * Con una red ya se ven los cinco puntos. La segunda añade la única lectura que
 * no existe mirando una sola: si dice lo mismo en las dos. La tercera no añade
 * lectura, solo trabajo.
 */
export const MAX_REDES = 2;

/** Con tres o cuatro alcanza para ver el patrón. Pedir más es data entry. */
export const MAX_PIEZAS = 6;

export type EntradaRed = {
  plataforma: Plataforma;
  /** Solo cuando la plataforma es "Otra". */
  nombre?: string;
  /** Campos pegados a mano. Opcional si viene captura. */
  texto?: string;
  /** Captura del perfil. Opcional si viene texto. */
  imagen?: Imagen;
};

export type EntradaPieza = {
  /** De qué red salió. Opcional: sirve para la lectura, no es obligatorio. */
  red?: string;
  /** "hace un mes", "marzo" — aproximado basta. */
  cuando?: string;
  texto?: string;
  imagen?: Imagen;
};

/** El nombre legible de una red, ya resuelto el caso "Otra". */
export function nombreRed(r: EntradaRed): string {
  return r.plataforma === "Otra" ? (r.nombre?.trim() || "Otra") : r.plataforma;
}

/** Una red vacía no se manda. */
export function tieneContenido(r: EntradaRed): boolean {
  return Boolean(r.texto?.trim() || r.imagen);
}

export function piezaTieneContenido(p: EntradaPieza): boolean {
  return Boolean(p.texto?.trim() || p.imagen);
}
