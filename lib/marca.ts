/**
 * Los colores de su marca, leídos de su propia cuadrícula.
 *
 * El problema que resuelve: la carátula del video y las láminas del carrusel
 * salían con la misma paleta para todo el mundo —blanco con amarillo fijo—, así
 * que la pieza no se parecía a lo que esa cuenta ya publica. Y los colores que
 * esa cuenta ya usa están a la vista en su cuadrícula.
 *
 * Se lee **en el navegador y de los píxeles**, no con el modelo: contar colores
 * es aritmética, no una opinión. No cuesta nada, no sube la imagen a ningún
 * sitio y lo único que se guarda son tres cadenas de siete caracteres. La
 * captura no se guarda — la misma regla que ya tenía el diagnóstico.
 *
 * Y es una **propuesta**, no un veredicto: leer una paleta de una captura es
 * una heurística, con la interfaz de Instagram y una foto de perfil metidas en
 * la misma imagen. Por eso los tres colores se pueden cambiar a mano, y por eso
 * el contraste se comprueba con la fórmula de la WCAG antes de devolverlos:
 * una paleta que no se lee es peor que la de por defecto.
 */

/**
 * Los tres colores, con la regla 60-30-10 de sus apuntes.
 *
 * El tipo vive aquí y no en `lamina.ts` porque lo usan las láminas, la carátula
 * del video, la tabla `negocio` y la pantalla del negocio. Lo dibujable es un
 * consumidor más, no el dueño.
 */
export type Paleta = {
  /** 60 — el que manda. */ fondo: string;
  /** 30 — el texto. */ tinta: string;
  /** 10 — el que resalta. */ acento: string;
};

export type Color = { r: number; g: number; b: number };

/** Por debajo de esto un color es un gris: no dice nada de la marca. */
const GRIS = 0.12;

/** Lo que tiene que pesar un color para poder ser el fondo. */
const PESO_FONDO = 0.06;

/** Y lo que tiene que pesar para contar como color de la marca. */
const PESO_MINIMO = 0.01;

/** Contraste mínimo del texto contra el fondo. Es el AA de la WCAG. */
export const CONTRASTE_TEXTO = 4.5;

/** Y el del acento, que es un remate y no un párrafo. */
export const CONTRASTE_ACENTO = 3;

export function aHex({ r, g, b }: Color): string {
  const dos = (n: number) =>
    Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, "0");
  return `#${dos(r)}${dos(g)}${dos(b)}`.toUpperCase();
}

export function deHex(hex: string): Color | null {
  const t = hex.trim().replace(/^#/, "");
  const largo = t.length === 3 ? t.replace(/./g, (c) => c + c) : t;
  if (!/^[0-9a-f]{6}$/i.test(largo)) return null;
  return {
    r: parseInt(largo.slice(0, 2), 16),
    g: parseInt(largo.slice(2, 4), 16),
    b: parseInt(largo.slice(4, 6), 16),
  };
}

/** Luminancia relativa de la WCAG. No es el brillo a ojo: es la de la fórmula. */
function luminancia({ r, g, b }: Color): number {
  const canal = (v: number) => {
    const x = v / 255;
    return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * canal(r) + 0.7152 * canal(g) + 0.0722 * canal(b);
}

/** La razón de contraste de la WCAG, de 1 a 21. */
export function contraste(a: Color, b: Color): number {
  const la = luminancia(a);
  const lb = luminancia(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/** La S del HSL. Es lo que distingue un color de la marca de un gris. */
function saturacion({ r, g, b }: Color): number {
  const max = Math.max(r, g, b) / 255;
  const min = Math.min(r, g, b) / 255;
  const l = (max + min) / 2;
  if (max === min) return 0;
  return l > 0.5 ? (max - min) / (2 - max - min) : (max - min) / (max + min);
}

const BLANCO: Color = { r: 255, g: 255, b: 255 };
const NEGRO: Color = { r: 0, g: 0, b: 0 };

/** Un paso hacia el blanco o hacia el negro, conservando el tono. */
function mover(c: Color, hacia: Color, parte: number): Color {
  return {
    r: c.r + (hacia.r - c.r) * parte,
    g: c.g + (hacia.g - c.g) * parte,
    b: c.b + (hacia.b - c.b) * parte,
  };
}

/**
 * Empuja un color hasta que se lee sobre el fondo.
 *
 * Va hacia el blanco o hacia el negro según cuál esté más lejos del fondo, en
 * pasos del 8%, conservando el tono todo lo que se pueda. Si ni el extremo
 * llega —no puede pasar, blanco o negro siempre llegan a 4,5 contra algo— se
 * devuelve el extremo.
 */
function legible(c: Color, fondo: Color, minimo: number): Color {
  if (contraste(c, fondo) >= minimo) return c;
  const hacia = luminancia(fondo) > 0.45 ? NEGRO : BLANCO;
  let salida = c;
  for (let i = 0; i < 12; i++) {
    salida = mover(salida, hacia, 0.18);
    if (contraste(salida, fondo) >= minimo) return salida;
  }
  return hacia;
}

type Cubo = Color & { peso: number };

/**
 * La paleta que sale de los píxeles de una imagen.
 *
 * Pura a propósito: recibe el RGBA que devuelve un canvas y no toca el DOM, así
 * que se puede probar con píxeles inventados y comprobar el resultado en vez de
 * mirarlo y decir que se ve bien.
 */
export function paletaDePixeles(datos: Uint8ClampedArray | number[]): Paleta | null {
  // Se agrupan a 32 niveles por canal. Sin agrupar, una foto tiene cien mil
  // colores distintos y el «más repetido» es ruido; con 32 niveles, los tonos
  // de una misma tinta caen en el mismo cubo.
  const cubos = new Map<number, { n: number; r: number; g: number; b: number }>();
  let total = 0;

  for (let i = 0; i + 3 < datos.length; i += 4) {
    const a = datos[i + 3];
    if (a < 128) continue;
    const r = datos[i];
    const g = datos[i + 1];
    const b = datos[i + 2];
    const llave = ((r >> 3) << 10) | ((g >> 3) << 5) | (b >> 3);
    const c = cubos.get(llave);
    if (c) {
      c.n++;
      c.r += r;
      c.g += g;
      c.b += b;
    } else {
      cubos.set(llave, { n: 1, r, g, b });
    }
    total++;
  }
  if (!total) return null;

  // El color de cada cubo es el promedio de lo que cayó dentro, no el centro
  // del cubo: así un verde oscuro sale con su tono y no redondeado.
  const lista: Cubo[] = [...cubos.values()]
    .map((c) => ({ r: c.r / c.n, g: c.g / c.n, b: c.b / c.n, peso: c.n / total }))
    .sort((a, b) => b.peso - a.peso);

  // ── El fondo ──
  // El más repetido que no sea un gris. La interfaz de Instagram es blanca o
  // negra y ocupa la cabecera y la barra de abajo de cualquier captura: si el
  // fondo fuera «el más repetido» sin más, saldría el blanco del teléfono en
  // vez del color de la cuenta.
  const fondo =
    lista.find((c) => saturacion(c) >= GRIS && c.peso >= PESO_FONDO) ?? lista[0];

  const cuentan = lista.filter((c) => c.peso >= PESO_MINIMO);

  // ── La tinta ──
  // El que más contraste hace contra el fondo. No es una preferencia estética:
  // es el único criterio por el que el texto se lee.
  const masContraste = cuentan.reduce(
    (mejor, c) => (contraste(c, fondo) > contraste(mejor, fondo) ? c : mejor),
    cuentan[0] ?? fondo,
  );
  const tinta =
    contraste(masContraste, fondo) >= CONTRASTE_TEXTO
      ? masContraste
      : contraste(BLANCO, fondo) >= contraste(NEGRO, fondo)
        ? BLANCO
        : NEGRO;

  // ── El acento ──
  // El más saturado que se distinga del fondo y de la tinta. Si no hay ninguno
  // —una cuadrícula en blanco y negro—, no se inventa un color: se usa la
  // tinta, que es lo honesto, y la pantalla deja cambiarlo.
  const candidatos = cuentan.filter(
    (c) => contraste(c, fondo) >= 1.5 && contraste(c, tinta) >= 1.5,
  );
  const crudo = candidatos.length
    ? candidatos.reduce((mejor, c) => (saturacion(c) > saturacion(mejor) ? c : mejor))
    : tinta;
  const acento = saturacion(crudo) >= GRIS ? legible(crudo, fondo, CONTRASTE_ACENTO) : tinta;

  return {
    fondo: aHex(fondo),
    tinta: aHex(legible(tinta, fondo, CONTRASTE_TEXTO)),
    acento: aHex(acento),
  };
}

/** Cuánto se reduce la captura antes de CONTAR los colores. */
const LADO = 320;

/**
 * Lo que mide y pesa cada imagen que SE GUARDA.
 *
 * Tiene que casar con los topes de la migración 16: si aquí se sube el lado o
 * la calidad, la base rechaza la fila y el guardado falla con un error que no
 * dice nada. Medido sobre JPEG reales: la foto ronda los 30.000 caracteres y la
 * cuadrícula los 100.000, con topes de 60.000 y 200.000.
 */
export const GUARDADAS = {
  avatar: { lado: 320, calidad: 0.72, tope: 60_000 },
  cuadricula: { lado: 480, calidad: 0.7, tope: 200_000 },
} as const;

/** base64 y nada más: lo que entra aquí se va a servir como una imagen. */
const BASE64 = /^[A-Za-z0-9+/]+={0,2}$/;

/** Una imagen guardable, o cadena vacía. Vale para el navegador y el servidor. */
export function imagenValida(valor: unknown, tope: number): string {
  if (typeof valor !== "string") return "";
  const bruto = valor.includes(",") ? valor.slice(valor.indexOf(",") + 1) : valor;
  const texto = bruto.trim();
  if (!texto || texto.length > tope || !BASE64.test(texto)) return "";
  return texto;
}

/** Carga un archivo de imagen como <img>. Solo navegador. */
async function cargar(archivo: File): Promise<HTMLImageElement | null> {
  const url = URL.createObjectURL(archivo);
  try {
    return await new Promise<HTMLImageElement>((ok, mal) => {
      const i = new Image();
      i.onload = () => ok(i);
      i.onerror = () => mal(new Error("no se pudo leer la imagen"));
      i.src = url;
    });
  } catch {
    return null;
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Pinta una imagen reducida en un lienzo nuevo. */
function reducir(img: HTMLImageElement, lado: number): HTMLCanvasElement | null {
  if (!img.naturalWidth || !img.naturalHeight) return null;
  const escala = Math.min(1, lado / Math.max(img.naturalWidth, img.naturalHeight));
  const lienzo = document.createElement("canvas");
  lienzo.width = Math.max(1, Math.round(img.naturalWidth * escala));
  lienzo.height = Math.max(1, Math.round(img.naturalHeight * escala));
  const ctx = lienzo.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;
  ctx.drawImage(img, 0, 0, lienzo.width, lienzo.height);
  return lienzo;
}

/** El base64 de un lienzo, sin el prefijo `data:` — que lo pone quien pinta. */
function aBase64(lienzo: HTMLCanvasElement, calidad: number): string | null {
  const datos = lienzo.toDataURL("image/jpeg", calidad);
  const coma = datos.indexOf(",");
  return coma < 0 ? null : datos.slice(coma + 1);
}

/**
 * Reduce una imagen y la devuelve en base64.
 *
 * Reducir aquí y no en el servidor es lo que hace que una captura de teléfono
 * de cuatro megas se convierta en treinta kilobytes antes de salir de la
 * máquina: lo que viaja ya es lo que se guarda.
 */
export async function reducirImagen(
  archivo: File,
  lado: number,
  calidad: number,
): Promise<string | null> {
  const img = await cargar(archivo);
  if (!img) return null;
  const lienzo = reducir(img, lado);
  return lienzo ? aBase64(lienzo, calidad) : null;
}

/**
 * De la cuadrícula salen dos cosas, y de una sola lectura: los colores y la
 * copia que se guarda. Decodificar el mismo archivo dos veces para sacar cada
 * una sería pagar dos veces lo mismo.
 */
export async function leerCuadricula(
  archivo: File,
): Promise<{ paleta: Paleta; guardable: string } | null> {
  const img = await cargar(archivo);
  if (!img) return null;

  const grande = reducir(img, GUARDADAS.cuadricula.lado);
  if (!grande) return null;
  const guardable = aBase64(grande, GUARDADAS.cuadricula.calidad);
  if (!guardable || guardable.length > GUARDADAS.cuadricula.tope) return null;

  // Los colores se cuentan sobre una copia más pequeña todavía: con 320 de
  // lado sale el mismo resultado y se cuenta una décima parte de los píxeles.
  const chico = reducir(img, LADO);
  const ctx = chico?.getContext("2d", { willReadFrequently: true });
  if (!chico || !ctx) return null;
  const paleta = paletaDePixeles(ctx.getImageData(0, 0, chico.width, chico.height).data);
  return paleta ? { paleta, guardable } : null;
}

/** Los tres colores guardados, ya validados. null si no tiene paleta propia. */
export function paletaGuardada(n: {
  paleta_fondo?: string | null;
  paleta_tinta?: string | null;
  paleta_acento?: string | null;
}): Paleta | null {
  const fondo = n.paleta_fondo?.trim();
  const tinta = n.paleta_tinta?.trim();
  const acento = n.paleta_acento?.trim();
  if (!fondo || !tinta || !acento) return null;
  if (!deHex(fondo) || !deHex(tinta) || !deHex(acento)) return null;
  return { fondo, tinta, acento };
}
