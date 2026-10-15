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

/**
 * El aire del carrusel. Se elige ANTES de escribir, y por eso no es una piel.
 *
 * Cambia lo que el prompt escribe, no solo cómo se pinta: en papel rayado y con
 * letra a mano un renglón aguanta seis palabras, no veinte, así que el estilo
 * decide el largo de cada cosa y qué moldes tienen sentido. Repintar de uno a
 * otro después sigue siendo gratis —los dos saben pintar los seis moldes— pero
 * el texto se escribió midiendo para el que eligió.
 */
export const ESTILOS = [
  {
    id: "limpio" as const,
    nombre: "Limpio",
    que: "Tipografía y color, mucho aire. Como una cita en fondo liso o una plantilla en oscuro.",
  },
  {
    id: "cuaderno" as const,
    nombre: "Cuaderno",
    que: "Papel rayado y letra a mano. Texto corto y escaneable, como unos apuntes.",
  },
  {
    id: "oscuro" as const,
    nombre: "Oscuro",
    que: "El oscuro de tu paleta, con el acento encima. Para plantillas y cosas que se copian.",
  },
];

export type Estilo = (typeof ESTILOS)[number]["id"];

export const esEstilo = (v: unknown): v is Estilo =>
  ESTILOS.some((e) => e.id === v);

/**
 * El molde de cada lámina. Lo reparte el modelo por lo que hace la lámina, no
 * el dueño lámina por lámina: en las referencias un mismo carrusel abre con un
 * gancho visual, desarrolla en lista o apuntes y cierra con una cita.
 *
 * Y no son skins: cada uno pide una forma de contenido distinta. Una lista son
 * pares cortos, una plantilla es un bloque con huecos, una cita es una frase
 * con peso. Pintar los seis sobre `titular + cuerpo` era justo lo que hacía que
 * todos salieran iguales.
 */
export const MOLDES = ["portada", "cita", "plantilla", "lista", "apuntes", "texto"] as const;

export type Molde = (typeof MOLDES)[number];

export const NOMBRE_MOLDE: Record<Molde, string> = {
  portada: "Portada",
  cita: "Cita",
  plantilla: "Plantilla",
  lista: "Lista",
  apuntes: "Apuntes",
  texto: "Texto",
};

/**
 * Los moldes con los que ESTA lámina se puede pintar de verdad.
 *
 * Se calcula preguntándole a `moldeDe`: si pidiendo un molde devuelve otro, es
 * que a la lámina le falta su contenido y ofrecerlo sería ofrecer un botón que
 * no hace nada. La primera lámina no entra: es la portada y punto.
 */
export function moldesPosibles(l: Lamina, total: number): Molde[] {
  if (l.numero === 1) return ["portada"];
  return MOLDES.filter(
    (m) => m !== "portada" && moldeDe({ ...l, molde: m }, total) === m,
  );
}

/** Un ítem de una lámina `lista`: lo que se busca y qué hace. */
export type ItemLista = { clave: string; que: string };

export type Lamina = {
  numero: number;
  /** Ausente en las corridas de antes de los moldes: esas se pintan "texto". */
  molde?: Molde;
  titular: string;
  cuerpo: string;
  /** Qué se ve en la lámina. Nada de "imagen inspiradora". */
  imagen: string;
  /** Solo en `plantilla`: la línea pequeña bajo el titular. */
  subtitulo?: string;
  /** Solo en `lista`: los ítems escaneables. */
  items?: ItemLista[];
  /** Solo en `apuntes`: los puntos sueltos. */
  puntos?: string[];
  /** Solo en `apuntes`: la caja de conclusión del final. */
  remate?: string;
};

export type Carrusel = {
  laminas: Lamina[];
  /** El que eligió antes de escribir. Ausente en las corridas de antes. */
  estilo?: Estilo;
  descripcion: string;
  valor: string;
  limites: string[];
};

const vacio = (s?: string) => !s?.trim();

/**
 * El molde con el que SE PINTA una lámina, que no siempre es el que pidió.
 *
 * Un molde sin su contenido no es un molde: una `lista` sin ítems pintaría una
 * lámina en blanco con un titular arriba. Antes de hacerle caso se comprueba
 * que traiga lo suyo, y si no, se cae a `texto`, que solo necesita titular y
 * cuerpo. Las corridas viejas no traen `molde` y caen aquí también.
 */
export function moldeDe(l: Lamina, total: number): Molde {
  const pedido = l.molde;

  if (pedido === "portada" || (!pedido && l.numero === 1)) return "portada";
  if (pedido === "lista") return l.items?.length ? "lista" : "texto";
  if (pedido === "apuntes") return l.puntos?.length ? "apuntes" : "texto";
  if (pedido === "plantilla") return vacio(l.cuerpo) ? "texto" : "plantilla";
  if (pedido === "cita") return "cita";

  // Sin molde y sin cuerpo, en la última: es el cierre, y el cierre es cita.
  if (!pedido && l.numero === total && vacio(l.cuerpo)) return "cita";
  return "texto";
}

/**
 * Los trozos entre corchetes de una plantilla — `[idioma]`, `[minutos]`.
 *
 * Es lo que en la referencia va en rojo: los huecos que el lector cambia por lo
 * suyo. Se devuelve partido para poder pintarlos en otro color sin medir dos
 * veces la misma línea.
 */
export function partirHuecos(texto: string): { texto: string; hueco: boolean }[] {
  const partes: { texto: string; hueco: boolean }[] = [];
  const re = /\[[^\]\n]{1,80}\]/g;
  let desde = 0;
  for (let m = re.exec(texto); m; m = re.exec(texto)) {
    if (m.index > desde) partes.push({ texto: texto.slice(desde, m.index), hueco: false });
    partes.push({ texto: m[0], hueco: true });
    desde = m.index + m[0].length;
  }
  if (desde < texto.length) partes.push({ texto: texto.slice(desde), hueco: false });
  return partes;
}

/**
 * Compara dos frases sin que una coma decida que son distintas.
 *
 * Hace falta porque el primer golpe **es** el gancho, literal: lo manda el
 * prompt. Toda pantalla que escriba el gancho y luego liste los golpes lo
 * repite dos veces si no lo comprueba. Se comprueba en vez de darlo por hecho:
 * un guion viejo puede no cumplirlo.
 */
export const mismaFrase = (a = "", b = "") =>
  a.toLowerCase().replace(/[^a-z0-9ñáéíóúü]/gi, "") ===
  b.toLowerCase().replace(/[^a-z0-9ñáéíóúü]/gi, "");

export type Pieza = Guion | Carrusel;

export const esCarrusel = (p: Pieza): p is Carrusel => "laminas" in p;
export const esGuion = (p: Pieza): p is Guion => !esCarrusel(p);
