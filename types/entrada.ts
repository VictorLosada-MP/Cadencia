import type { Imagen } from "@/lib/modelo";

/**
 * Lo que el usuario mete.
 *
 * La unidad es la casilla rotulada, no el cuadro de texto. Se rellena a mano o
 * desde una captura, y las dos vías caen en el mismo sitio — por eso la entrada
 * manual no se puede descartar: es el destino de la otra.
 *
 * El diagnóstico corre siempre sobre casillas que el dueño confirmó, nunca
 * sobre una imagen. Así lo que se juzga es lo que él vio.
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

export type Casillas = {
  usuario: string;
  nombre: string;
  bio: string;
  cta: string;
  link: string;
};

export type Casilla = keyof Casillas;

export const CASILLAS: { id: Casilla; etiqueta: string; pista: string; filas?: number }[] = [
  { id: "usuario", etiqueta: "Usuario", pista: "el @, si la red lo tiene" },
  { id: "nombre", etiqueta: "Nombre visible", pista: "el que va en grande" },
  { id: "bio", etiqueta: "Bio", pista: "la descripción, entera", filas: 4 },
  { id: "cta", etiqueta: "CTA", pista: "el botón o la línea que pide la acción" },
  { id: "link", etiqueta: "Link", pista: "tal como aparece" },
];

/**
 * No todas las redes tienen las cinco. Un sitio web no tiene punto Link: el
 * sitio ES el destino. Una casilla que la plataforma no tiene no es una casilla
 * que falta.
 */
const SIN: Partial<Record<Plataforma, Casilla[]>> = {
  LinkedIn: ["usuario"],
  Facebook: ["usuario"],
  "WhatsApp Business": ["usuario", "link"],
  "Sitio web": ["usuario", "link"],
};

export function casillasDe(p: Plataforma): Casilla[] {
  const fuera = SIN[p] ?? [];
  return CASILLAS.map((c) => c.id).filter((c) => !fuera.includes(c));
}

/**
 * Con una red ya se ven los cinco puntos. La segunda añade la única lectura que
 * no existe mirando una sola: si dice lo mismo en las dos. La tercera no añade
 * lectura, solo trabajo.
 */
export const MAX_REDES = 2;

/** Lo publicado da el patrón. Para afirmar un "siempre" hacen falta cinco. */
export const MIN_PIEZAS_PARA_PATRON = 5;

export type EntradaRed = {
  id: string;
  plataforma: Plataforma;
  /** Solo cuando la plataforma es "Otra". */
  otra?: string;
  casillas: Casillas;
  /** Qué casillas salieron de una captura. Para poder decirlo, no para juzgar. */
  transcritas?: Casilla[];
  /** Qué casillas venían cortadas con "… más" y el dueño no completó. */
  cortadas?: Casilla[];
};

export const VENTANAS = [
  "este mes",
  "los últimos tres meses",
  "el último año",
  "hace más de un año",
  "no me acuerdo",
] as const;

export type Ventana = (typeof VENTANAS)[number];

export type Publicado = {
  /** Capturas de la cuadrícula: dan ritmo, formato y temas repetidos. */
  cuadriculas: Imagen[];
  /** Los textos completos. Son la única fuente de las palabras. */
  textos: string;
  ventana?: Ventana;
};

export type Transcripcion = {
  casillas: Casillas;
  cortados: Casilla[];
  no_legible: Casilla[];
  datos_personales: boolean;
};

export const CASILLAS_VACIAS: Casillas = {
  usuario: "",
  nombre: "",
  bio: "",
  cta: "",
  link: "",
};

export function redVacia(plataforma: Plataforma): EntradaRed {
  return {
    id: globalThis.crypto?.randomUUID?.() ?? `red-${plataforma}-${PLATAFORMAS.indexOf(plataforma)}`,
    plataforma,
    casillas: { ...CASILLAS_VACIAS },
  };
}

/** El nombre legible de una red, ya resuelto el caso "Otra". */
export function nombreRed(r: EntradaRed): string {
  return r.plataforma === "Otra" ? (r.otra?.trim() || "Otra") : r.plataforma;
}

/** Una red sin nada escrito no se manda. */
export function tieneContenido(r: EntradaRed): boolean {
  return casillasDe(r.plataforma).some((c) => r.casillas[c]?.trim());
}

export function hayPublicado(p: Publicado): boolean {
  return p.cuadriculas.length > 0 || Boolean(p.textos.trim());
}

/** Cuántas piezas se distinguen en lo pegado. Separadas por una línea en blanco. */
export function contarPiezas(textos: string): number {
  return textos.split(/\n\s*\n/).filter((t) => t.trim()).length;
}
