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
 * Casi todas las redes tienen las cinco casillas. Solo se esconde la que de
 * verdad no existe — un sitio web no tiene arroba.
 *
 * Esconder de más sale caro: si al cambiar de plataforma desaparece una casilla
 * que ya estaba escrita, el usuario pierde lo que puso sin que nadie se lo diga.
 * Por eso quien pinta la ficha suma también las casillas que tengan contenido.
 */
const SIN: Partial<Record<Plataforma, Casilla[]>> = {
  "Sitio web": ["usuario"],
};

export function casillasDe(p: Plataforma): Casilla[] {
  const fuera = SIN[p] ?? [];
  return CASILLAS.map((c) => c.id).filter((c) => !fuera.includes(c));
}

/** Las casillas a pintar: las de la plataforma, más las que ya tengan algo. */
export function casillasVisibles(r: EntradaRed): Casilla[] {
  const suyas = casillasDe(r.plataforma);
  return CASILLAS.map((c) => c.id).filter(
    (c) => suyas.includes(c) || Boolean(r.casillas[c]?.trim()),
  );
}

/**
 * Distinto de esconder una casilla: aquí el dato existe, pero el punto no tiene
 * sentido en esa plataforma. En un sitio web el destino ES el sitio, así que no
 * hay un "link en la bio" que juzgar — la dirección sigue haciendo falta para
 * saber de qué sitio hablamos.
 */
const PUNTOS_FUERA: Partial<Record<Plataforma, string[]>> = {
  // Vacío a propósito. Un sitio web sí tiene punto Link: es a dónde lleva su
  // botón principal, y eso se lee de la página. Marcarlo "no aplica" era
  // esquivar el trabajo, no una propiedad de los sitios web.
};

export function puntosQueNoAplican(p: Plataforma): string[] {
  return PUNTOS_FUERA[p] ?? [];
}

/** El rótulo cambia según la red: en un sitio web «Link» es su dirección. */
export function rotuloCasilla(p: Plataforma, c: Casilla): string {
  const base = CASILLAS.find((x) => x.id === c);
  if (p === "Sitio web") {
    if (c === "link") return "Dirección del sitio";
    if (c === "nombre") return "Nombre del sitio";
    if (c === "bio") return "Lo que dice arriba del todo";
  }
  return base?.etiqueta ?? c;
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
