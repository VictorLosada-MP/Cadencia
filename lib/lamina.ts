/**
 * Dibuja las láminas de un carrusel como imágenes listas para subir.
 *
 * Todo en el navegador, sobre un canvas: no hay servidor de imágenes, no cuesta
 * nada y las láminas no salen de la máquina de su dueño.
 *
 * 1080×1350 porque es lo que ocupa más pantalla en el feed sin que recorte.
 *
 * ── Moldes y estilos ────────────────────────────────────────────────────────
 *
 * Había UN molde —titular arriba, cuerpo debajo— para las cinco a ocho láminas,
 * y por eso todos los carruseles salían iguales. Ahora hay seis moldes y dos
 * estilos, que no son lo mismo:
 *
 *   · El **molde** lo decide el contenido de cada lámina, y lo reparte el
 *     modelo. Una lista son pares cortos; una plantilla, un bloque con huecos;
 *     una cita, una frase con peso. Por eso no se puede elegir «de piel»: el
 *     texto hay que escribirlo para el molde.
 *   · El **estilo** es el aire, y lo elige el dueño antes de escribir. Los dos
 *     saben pintar los seis moldes, así que repintar de uno a otro es gratis.
 *
 * Lo que no se intenta clonar, y conviene que quede escrito: la referencia del
 * cuaderno fotografiado en una mano. El texto tendría que seguir la curvatura
 * de la página. Aquí el papel se DIBUJA —renglones, margen, tono de hoja— que
 * es lo que sí se sostiene a 1080 píxeles.
 */

import { esClaro, legibleHex, mezclarHex, type Paleta } from "@/lib/marca";
import { moldeDe, partirHuecos, type Estilo, type Lamina } from "@/types/guion";

export type { Paleta } from "@/lib/marca";

export const ANCHO = 1080;
export const ALTO = 1350;

const MARGEN = 88;
const UTIL = ANCHO - MARGEN * 2;

/** La regla 60-30-10 de sus apuntes, con los comodines por defecto. */
export const PALETAS: { id: string; nombre: string; p: Paleta }[] = [
  { id: "hueso", nombre: "Hueso", p: { fondo: "#F6F5F2", tinta: "#18201F", acento: "#1F6F6B" } },
  { id: "tinta", nombre: "Tinta", p: { fondo: "#141A19", tinta: "#F2F4F3", acento: "#57B8B0" } },
  { id: "papel", nombre: "Papel", p: { fondo: "#FFFFFF", tinta: "#111111", acento: "#C2410C" } },
  { id: "noche", nombre: "Noche", p: { fondo: "#0E1220", tinta: "#EDF0F7", acento: "#F5C451" } },
];

const SANS = '-apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';
const MONO = 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace';

/** Una imagen que se puede pintar y de la que se conocen las medidas. */
export type Imagen = CanvasImageSource & { width: number; height: number };

export type Marca = {
  /** Su foto de perfil, ya decodificada. */
  avatar?: Imagen | null;
  /** Su arroba, sin «@». */
  handle?: string;
  /** El nombre con el que firma. */
  nombre?: string;
};

export type Opciones = {
  paleta: Paleta;
  estilo: Estilo;
  total: number;
  foto?: Imagen | null;
  marca?: Marca | null;
  /**
   * La familia de la letra a mano, tal como la nombra el navegador.
   *
   * Llega de fuera porque la carga `next/font` en la capa de la aplicación y
   * genera un nombre distinto en cada compilación. Sin ella el estilo cuaderno
   * se pinta con la de palo: feo, pero no roto.
   */
  mano?: string;
};

/** Contraste que se le exige al texto largo. Por encima del AA de la WCAG. */
const CLARO = 7;

/** Los colores ya resueltos para un estilo. El papel no es el fondo liso. */
type Tinta = {
  fondo: string;
  tinta: string;
  acento: string;
  /** Un tono intermedio para cajas y separadores. */
  velo: string;
};

function tintas(p: Paleta, estilo: Estilo): Tinta {
  if (estilo === "oscuro") {
    // El oscuro de SU paleta, no un negro cualquiera: si su fondo ya es
    // oscuro se usa ese, y si es claro se le da la vuelta y manda su tinta.
    // Así el estilo cambia de peso sin dejar de ser suyo.
    const base = esClaro(p.fondo) ? p.tinta : p.fondo;
    const fondo = mezclarHex(base, "#000000", 0.3);
    const letra = esClaro(p.fondo) ? p.fondo : p.tinta;
    return {
      fondo,
      tinta: legibleHex(letra, fondo, CLARO),
      acento: legibleHex(p.acento, fondo, 4),
      velo: mezclarHex(fondo, "#FFFFFF", 0.09),
    };
  }
  if (estilo !== "cuaderno") {
    return { fondo: p.fondo, tinta: p.tinta, acento: p.acento, velo: mezclarHex(p.fondo, p.tinta, 0.1) };
  }
  // El papel es papel: una hoja casi blanca con un punto de su color. Pintar
  // renglones sobre su verde oscuro no parece un cuaderno, parece un fondo con
  // rayas. Lo que se conserva de su marca es el tono, no la oscuridad.
  const papel = mezclarHex(p.fondo, "#FFFFFF", esClaro(p.fondo) ? 0.65 : 0.93);
  return {
    fondo: papel,
    tinta: legibleHex(p.tinta, papel, CLARO),
    acento: legibleHex(p.acento, papel, 4),
    velo: mezclarHex(papel, p.tinta, 0.1),
  };
}

/**
 * `mano` llega tal cual lo escribe `next/font` —ya es una lista de familias con
 * sus comillas—, así que se concatena sin tocarlo. Entrecomillarlo otra vez lo
 * rompía y el canvas caía a la de palo sin decir nada.
 */
function familia(estilo: Estilo, mano?: string): string {
  return estilo === "cuaderno" && mano?.trim() ? `${mano}, ${SANS}` : SANS;
}

/** Parte un texto en líneas que caben, midiendo de verdad sobre el canvas. */
function repartir(ctx: CanvasRenderingContext2D, texto: string, ancho: number): string[] {
  const lineas: string[] = [];
  for (const parrafo of texto.split("\n")) {
    let actual = "";
    // Se parte por espacios normales y tabuladores, NO por `\s`: el espacio
    // duro (\u00A0) es `\s` para la expresión regular, y entonces `[tu café]`
    // se partía igual y el hueco perdía el color de la mitad de abajo.
    for (const palabra of parrafo.split(/[ \t]+/).filter(Boolean)) {
      const prueba = actual ? `${actual} ${palabra}` : palabra;
      if (ctx.measureText(prueba).width > ancho && actual) {
        lineas.push(actual);
        actual = palabra;
      } else {
        actual = prueba;
      }
    }
    lineas.push(actual);
  }
  return lineas;
}

/**
 * Busca el tamaño más grande que deja el texto dentro de su caja. Un titular
 * que se sale no es un titular: es una lámina rota.
 */
function encajar(
  ctx: CanvasRenderingContext2D,
  texto: string,
  ancho: number,
  altoMax: number,
  desde: number,
  hasta: number,
  peso: string,
  fuente: string,
  aire = 1.22,
): { tam: number; lineas: string[]; interlinea: number } {
  for (let tam = desde; tam >= hasta; tam -= 2) {
    ctx.font = `${peso} ${tam}px ${fuente}`;
    const lineas = repartir(ctx, texto, ancho);
    const interlinea = Math.round(tam * aire);
    if (lineas.length * interlinea <= altoMax) return { tam, lineas, interlinea };
  }
  ctx.font = `${peso} ${hasta}px ${fuente}`;
  return { tam: hasta, lineas: repartir(ctx, texto, ancho), interlinea: Math.round(hasta * aire) };
}

/** Redondea un rectángulo: los cantos a escuadra se ven a plantilla vieja. */
function caja(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/**
 * La foto a sangre con un velo encima, para los moldes que no tienen un hueco
 * propio donde ponerla.
 *
 * Esto faltaba y era una regresión de los moldes nuevos: antes había un solo
 * molde y siempre pintaba la foto, y al partirlo en seis, cuatro de ellos se
 * quedaron sin usarla. El dueño subía su foto, no pasaba nada, y no había
 * forma de saber por qué.
 *
 * El velo es opaco a propósito —una lista de doce ítems encima de una foto no
 * se lee con un degradado suave— y deja ver lo justo para que se note que hay
 * una foto debajo.
 */
function fondoConFoto(ctx: CanvasRenderingContext2D, foto: Imagen, t: Tinta, fuerza = 0.88) {
  ctx.save();
  llenar(ctx, foto, 0, 0, ANCHO, ALTO);
  ctx.globalAlpha = fuerza;
  ctx.fillStyle = t.fondo;
  ctx.fillRect(0, 0, ANCHO, ALTO);
  ctx.restore();
}

/** Dibuja la foto recortando para llenar la caja, sin deformarla. */
function llenar(ctx: CanvasRenderingContext2D, img: Imagen, x: number, y: number, w: number, h: number) {
  const escala = Math.max(w / img.width, h / img.height);
  const aw = img.width * escala;
  const ah = img.height * escala;
  ctx.drawImage(img, x + (w - aw) / 2, y + (h - ah) / 2, aw, ah);
}

/** Dónde empieza el rayado y cada cuánto va. Lo usan el fondo y los moldes. */
const RENGLON = { desde: 150, paso: 56 };

/**
 * Apoya una línea de texto en el renglón, como si estuviera escrita encima.
 *
 * Solo en el cuaderno, y es la mitad de por qué se cree: un texto que flota
 * entre dos rayas se ve pegado encima de una foto de papel, no escrito en él.
 * Devuelve la y de arriba del texto para que su base caiga en una raya.
 */
function sobreRenglon(y: number, tam: number): number {
  const base = y + tam;
  const k = Math.ceil((base - RENGLON.desde) / RENGLON.paso);
  return RENGLON.desde + k * RENGLON.paso - tam;
}

/** Escribe líneas ya medidas y devuelve dónde quedó el lápiz. */
function escribir(ctx: CanvasRenderingContext2D, lineas: string[], x: number, y: number, interlinea: number): number {
  for (const l of lineas) {
    ctx.fillText(l, x, y);
    y += interlinea;
  }
  return y;
}

// ── Los fondos ──────────────────────────────────────────────────────────────

function pintarFondo(ctx: CanvasRenderingContext2D, t: Tinta, estilo: Estilo) {
  ctx.fillStyle = t.fondo;
  ctx.fillRect(0, 0, ANCHO, ALTO);
  if (estilo !== "cuaderno") return;

  // Los renglones y el margen. Es lo que convierte un fondo claro en una hoja.
  ctx.save();
  ctx.strokeStyle = t.tinta;
  ctx.globalAlpha = 0.11;
  ctx.lineWidth = 2;
  for (let y = RENGLON.desde; y < ALTO; y += RENGLON.paso) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(ANCHO, y);
    ctx.stroke();
  }
  ctx.globalAlpha = 0.45;
  ctx.strokeStyle = t.acento;
  ctx.beginPath();
  ctx.moveTo(MARGEN - 30, 0);
  ctx.lineTo(MARGEN - 30, ALTO);
  ctx.stroke();
  ctx.restore();
}

/** La firma de arriba: su cara y su arroba. Es la marca de agua de la lámina. */
function pintarFirma(ctx: CanvasRenderingContext2D, t: Tinta, marca: Marca | null | undefined, y: number, fuente: string): number {
  if (!marca?.avatar && !marca?.handle?.trim()) return y;
  const lado = 76;
  if (marca.avatar) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(MARGEN + lado / 2, y + lado / 2, lado / 2, 0, Math.PI * 2);
    ctx.clip();
    llenar(ctx, marca.avatar, MARGEN, y, lado, lado);
    ctx.restore();
  }
  const x = marca.avatar ? MARGEN + lado + 22 : MARGEN;
  const nombre = marca.nombre?.trim();
  if (nombre) {
    ctx.font = `700 30px ${fuente}`;
    ctx.fillStyle = t.tinta;
    ctx.fillText(nombre, x, y + (marca.handle?.trim() ? 12 : 24));
  }
  if (marca.handle?.trim()) {
    ctx.font = `400 28px ${fuente}`;
    ctx.fillStyle = t.tinta;
    ctx.globalAlpha = 0.55;
    ctx.fillText(`@${marca.handle.trim()}`, x, y + (nombre ? 50 : 24));
    ctx.globalAlpha = 1;
  }
  return y + lado + 46;
}

// ── El pie ──────────────────────────────────────────────────────────────────

function pintarPie(
  ctx: CanvasRenderingContext2D,
  t: Tinta,
  l: Lamina,
  total: number,
  fuente: string,
  /** Vacío cuando el molde ya lo imprimió arriba: dos veces es ruido. */
  handle = "",
) {
  const pie = ALTO - MARGEN - 34;
  ctx.fillStyle = t.tinta;
  ctx.globalAlpha = 0.12;
  ctx.fillRect(MARGEN, pie - 26, UTIL, 2);
  ctx.globalAlpha = 1;

  ctx.font = `700 30px ${fuente}`;
  ctx.fillStyle = t.acento;
  const cuenta = `${String(l.numero).padStart(2, "0")} / ${String(total).padStart(2, "0")}`;
  ctx.fillText(cuenta, MARGEN, pie);

  // El arroba va de la segunda lámina en adelante, siempre. Una lámina que se
  // comparte suelta —y se comparten sueltas— sin el arroba de quien la hizo es
  // una lámina que trabaja para cualquiera.
  if (handle.trim()) {
    const ancho = ctx.measureText(cuenta).width;
    ctx.font = `400 28px ${fuente}`;
    ctx.fillStyle = t.tinta;
    ctx.globalAlpha = 0.6;
    ctx.fillText(`@${handle.trim()}`, MARGEN + ancho + 22, pie + 1);
    ctx.globalAlpha = 1;
  }

  if (l.numero < total) {
    ctx.font = `600 30px ${fuente}`;
    ctx.fillStyle = t.tinta;
    ctx.globalAlpha = 0.5;
    const desliza = "desliza →";
    ctx.fillText(desliza, ANCHO - MARGEN - ctx.measureText(desliza).width, pie);
    ctx.globalAlpha = 1;
  }
}

// ── Los seis moldes ─────────────────────────────────────────────────────────

const SUELO = ALTO - MARGEN - 74;

/**
 * Portada — el gancho visual.
 *
 * Su foto a sangre con un velo encima, el titular en mayúsculas abajo y el
 * último renglón en el acento. Lo del último renglón no es un adorno: es el que
 * remata la idea, y es lo mismo que ya hace la carátula del video.
 *
 * Lo que la referencia tiene y esto no puede tener: el montaje recortado a mano
 * sobre la foto. Eso no sale de un canvas y no se finge.
 */
function pintarPortada(ctx: CanvasRenderingContext2D, l: Lamina, o: Opciones, t: Tinta, fuente: string) {
  if (o.foto) {
    ctx.save();
    llenar(ctx, o.foto, 0, 0, ANCHO, ALTO);
    const velo = ctx.createLinearGradient(0, ALTO * 0.1, 0, ALTO);
    velo.addColorStop(0, `${t.fondo}00`);
    velo.addColorStop(0.5, `${t.fondo}D9`);
    velo.addColorStop(1, t.fondo);
    ctx.fillStyle = velo;
    ctx.fillRect(0, 0, ANCHO, ALTO);
    ctx.restore();
  } else {
    ctx.fillStyle = t.acento;
    caja(ctx, MARGEN, MARGEN, 96, 10, 5);
    ctx.fill();
  }

  const arriba = o.foto ? Math.round(ALTO * 0.3) : MARGEN + 72;
  const texto = l.titular.toLocaleUpperCase("es");
  const h = encajar(ctx, texto, UTIL, SUELO - arriba, 116, 48, "800", fuente, 1.1);
  ctx.font = `800 ${h.tam}px ${fuente}`;
  let y = o.foto
    ? SUELO - h.lineas.length * h.interlinea
    : arriba + Math.max(0, (SUELO - arriba - h.lineas.length * h.interlinea) / 2);
  h.lineas.forEach((linea, i) => {
    ctx.fillStyle = i === h.lineas.length - 1 ? t.acento : t.tinta;
    ctx.fillText(linea, MARGEN, y);
    y += h.interlinea;
  });
}

/**
 * Cita — la frase que para el dedo.
 *
 * Fondo liso, su cara y su arroba arriba, el titular grande y un cuerpo corto
 * con mucho aire. Cero iconos y cero adornos: aquí el texto es el único
 * protagonista y meterle una barra de color le quita lo que lo hace funcionar.
 */
function pintarCita(ctx: CanvasRenderingContext2D, l: Lamina, o: Opciones, t: Tinta, fuente: string) {
  if (o.foto) fondoConFoto(ctx, o.foto, t, 0.82);
  const techo = pintarFirma(ctx, t, o.marca, MARGEN, fuente);
  const hayCuerpo = Boolean(l.cuerpo?.trim());

  const h = encajar(ctx, l.titular, UTIL, (SUELO - techo) * (hayCuerpo ? 0.62 : 1), 96, 46, "700", fuente, 1.18);
  ctx.font = `700 ${h.tam}px ${fuente}`;
  ctx.fillStyle = t.tinta;
  // Centrada en el hueco que queda: una cita pegada arriba parece un titular.
  const alto = h.lineas.length * h.interlinea;
  let y = techo + Math.max(0, (SUELO - techo - alto) / (hayCuerpo ? 4 : 2));
  y = escribir(ctx, h.lineas, MARGEN, y, h.interlinea);

  if (!hayCuerpo) return;
  y += 40;
  const c = encajar(ctx, l.cuerpo, UTIL, SUELO - y, 46, 30, "400", fuente, 1.5);
  ctx.font = `400 ${c.tam}px ${fuente}`;
  ctx.globalAlpha = 0.72;
  escribir(ctx, c.lineas, MARGEN, y, c.interlinea);
  ctx.globalAlpha = 1;
}

/**
 * Plantilla — lo que se copia y se rellena.
 *
 * Número, titular en mayúsculas, subtítulo en cursiva y el bloque en monoespacio
 * con los huecos `[así]` en el acento. El monoespacio no es una elección
 * estética: dice «esto se copia tal cual», y es la mitad de por qué la
 * referencia funciona.
 */
function pintarPlantilla(ctx: CanvasRenderingContext2D, l: Lamina, o: Opciones, t: Tinta, fuente: string) {
  if (o.foto) fondoConFoto(ctx, o.foto, t, 0.9);
  let y = MARGEN;

  ctx.font = `800 36px ${fuente}`;
  ctx.fillStyle = t.acento;
  ctx.fillText(`${String(l.numero).padStart(2, "0")}.`, MARGEN, y);
  y += 54;

  const h = encajar(ctx, l.titular.toLocaleUpperCase("es"), UTIL, 230, 72, 40, "800", fuente, 1.12);
  ctx.font = `800 ${h.tam}px ${fuente}`;
  ctx.fillStyle = t.tinta;
  y = escribir(ctx, h.lineas, MARGEN, y, h.interlinea);

  if (l.subtitulo?.trim()) {
    y += 14;
    const s = encajar(ctx, l.subtitulo, UTIL, 90, 34, 24, "italic 400", fuente, 1.3);
    ctx.font = `italic 400 ${s.tam}px ${fuente}`;
    ctx.fillStyle = t.tinta;
    ctx.globalAlpha = 0.55;
    y = escribir(ctx, s.lineas, MARGEN, y, s.interlinea);
    ctx.globalAlpha = 1;
  }

  // El bloque. Va en una tarjeta de un tono intermedio para que se lea como
  // «esto es lo que se copia» tanto sobre fondo claro como sobre oscuro.
  y += 36;
  const dentro = 34;
  const anchoTexto = UTIL - dentro * 2;
  // Dentro de los corchetes el espacio se vuelve duro, así `[tu café]` no se
  // parte al final de la línea. Partido, la mitad de abajo se quedaba sin
  // color y el hueco dejaba de leerse como un hueco.
  const sinCortes = l.cuerpo.replace(/\[[^\]\n]{1,80}\]/g, (m) => m.replace(/ /g, "\u00A0"));
  const b = encajar(ctx, sinCortes, anchoTexto, SUELO - y - dentro * 2 - 86, 38, 22, "400", MONO, 1.45);

  ctx.fillStyle = t.velo;
  caja(ctx, MARGEN, y, UTIL, Math.min(SUELO - y, b.lineas.length * b.interlinea + dentro * 2), 20);
  ctx.fill();

  // Los huecos se pintan midiendo trozo a trozo sobre la misma línea: así el
  // color cambia sin que la línea se mueva ni un píxel.
  ctx.font = `400 ${b.tam}px ${MONO}`;
  let ty = y + dentro;
  for (const linea of b.lineas) {
    let tx = MARGEN + dentro;
    for (const parte of partirHuecos(linea)) {
      ctx.fillStyle = parte.hueco ? t.acento : t.tinta;
      ctx.fillText(parte.texto, tx, ty);
      tx += ctx.measureText(parte.texto).width;
    }
    ty += b.interlinea;
  }

  if (o.marca?.handle?.trim()) {
    ctx.font = `700 26px ${fuente}`;
    ctx.fillStyle = t.tinta;
    ctx.globalAlpha = 0.5;
    // Por encima de la raya del pie: a ras se montaba encima de ella.
    ctx.fillText("Guarda esto", MARGEN, SUELO - 48);
    const arroba = `@${o.marca.handle.trim()}`;
    ctx.fillText(arroba, ANCHO - MARGEN - ctx.measureText(arroba).width, SUELO - 48);
    ctx.globalAlpha = 1;
  }
}

/**
 * Lista — los ítems escaneables.
 *
 * Un espinazo a la izquierda que sale de su foto y una ramita a cada ítem. Es
 * el mapa mental de la referencia sin su logo: lo que lo hace legible es que la
 * clave y lo que hace estén en la misma línea y se lean de un vistazo.
 */
function pintarLista(ctx: CanvasRenderingContext2D, l: Lamina, o: Opciones, t: Tinta, fuente: string) {
  if (o.foto) fondoConFoto(ctx, o.foto, t, 0.9);
  const items = l.items ?? [];
  let y = MARGEN;

  const h = encajar(ctx, l.titular, UTIL, 160, 60, 36, "700", fuente, 1.14);
  ctx.font = `700 ${h.tam}px ${fuente}`;
  ctx.fillStyle = t.tinta;
  y = escribir(ctx, h.lineas, MARGEN, y, h.interlinea);

  ctx.fillStyle = t.acento;
  ctx.fillRect(MARGEN, y + 10, Math.min(UTIL, h.tam * 5), 6);
  y += 46;

  // El alto de cada ítem reparte el hueco que queda, con suelo y techo para que
  // cuatro ítems no queden a un palmo unos de otros ni doce se amontonen. Lo
  // que sobra se reparte arriba y abajo: dejarlo todo abajo era lo que hacía
  // que la lámina se viera a medio llenar.
  const hueco = SUELO - y;
  const tam = Math.max(22, Math.min(38, Math.round(hueco / Math.max(4, items.length) * 0.4)));
  let alto = Math.max(tam * 1.7, Math.min(tam * 3, Math.floor(hueco / Math.max(1, items.length))));
  if (o.estilo === "cuaderno") {
    // En el cuaderno el paso es un número entero de renglones: así cada ítem
    // cae sobre una raya en vez de entre dos.
    alto = Math.max(RENGLON.paso, Math.round(alto / RENGLON.paso) * RENGLON.paso);
  }
  y += Math.max(0, (hueco - alto * items.length) / 2);
  if (o.estilo === "cuaderno") y = sobreRenglon(y, tam);
  const sangra = o.marca?.avatar ? 150 : 48;

  // El espinazo y su cara en el arranque, como el logo de la referencia.
  if (o.marca?.avatar) {
    const lado = 92;
    const cy = y + (items.length * alto) / 2;
    ctx.save();
    ctx.beginPath();
    ctx.arc(MARGEN + lado / 2, cy - lado / 2, lado / 2, 0, Math.PI * 2);
    ctx.clip();
    llenar(ctx, o.marca.avatar, MARGEN, cy - lado, lado, lado);
    ctx.restore();

    ctx.strokeStyle = t.acento;
    ctx.globalAlpha = 0.5;
    ctx.lineWidth = 3;
    items.forEach((_, i) => {
      const destino = y + i * alto + alto / 2;
      ctx.beginPath();
      ctx.moveTo(MARGEN + lado + 6, cy - lado / 2);
      ctx.bezierCurveTo(MARGEN + sangra - 34, cy - lado / 2, MARGEN + sangra - 34, destino, MARGEN + sangra - 14, destino);
      ctx.stroke();
    });
    ctx.globalAlpha = 1;
  }

  items.forEach((it, i) => {
    const linea = y + i * alto;
    ctx.fillStyle = t.acento;
    ctx.beginPath();
    ctx.arc(MARGEN + sangra - 24, linea + tam * 0.55, 6, 0, Math.PI * 2);
    ctx.fill();

    // La clave y lo que hace tienen que caber en UNA línea: un ítem partido en
    // dos deja de ser escaneable, que es lo único que hace útil a una lista.
    // Si no cabe, encoge este ítem en vez de recortarle el final — perder la
    // mitad de la frase sin avisar es peor que una línea algo más pequeña.
    let cuerpo = tam;
    const medir = () => {
      ctx.font = `700 ${cuerpo}px ${fuente}`;
      const clave = ctx.measureText(it.clave).width;
      ctx.font = `400 ${Math.round(cuerpo * 0.92)}px ${fuente}`;
      return { clave, todo: clave + 14 + ctx.measureText(`— ${it.que}`).width };
    };
    let medida = medir();
    while (medida.todo > UTIL - sangra && cuerpo > 16) {
      cuerpo -= 1;
      medida = medir();
    }

    ctx.font = `700 ${cuerpo}px ${fuente}`;
    ctx.fillStyle = t.acento;
    ctx.fillText(it.clave, MARGEN + sangra, linea);

    ctx.font = `400 ${Math.round(cuerpo * 0.92)}px ${fuente}`;
    ctx.fillStyle = t.tinta;
    ctx.globalAlpha = 0.82;
    ctx.fillText(`— ${it.que}`, MARGEN + sangra + medida.clave + 14, linea + cuerpo * 0.08);
    ctx.globalAlpha = 1;
  });
}

/**
 * Apuntes — el concepto explicado.
 *
 * Titular subrayado, los puntos con su franja de color detrás —el resaltador de
 * la referencia— y una caja de remate al final. La franja va DETRÁS del texto y
 * medida sobre él, no una caja fija: un resaltado que no llega al final de la
 * palabra se nota.
 */
function pintarApuntes(ctx: CanvasRenderingContext2D, l: Lamina, o: Opciones, t: Tinta, fuente: string) {
  if (o.foto) fondoConFoto(ctx, o.foto, t, 0.9);
  const puntos = l.puntos ?? [];
  let y = MARGEN;

  const h = encajar(ctx, l.titular, UTIL, 180, 62, 36, "700", fuente, 1.14);
  ctx.font = `700 ${h.tam}px ${fuente}`;
  ctx.fillStyle = t.tinta;
  y = escribir(ctx, h.lineas, MARGEN, y, h.interlinea);

  ctx.fillStyle = t.acento;
  ctx.fillRect(MARGEN, y + 8, Math.min(UTIL, h.tam * 6), 6);
  y += 54;

  const remate = l.remate?.trim();
  // La caja del remate se reserva entera, y con aire: pegada al pie se leía
  // como si se hubiera salido de la lámina.
  const reservado = remate ? 230 : 0;
  const hueco = SUELO - y - reservado;
  const tam = Math.max(26, Math.min(40, Math.floor(hueco / Math.max(1, puntos.length) / 1.8)));

  // El paso reparte el hueco, con suelo y techo: muy junto se lee como un
  // párrafo troceado y muy suelto como cuatro frases que no tienen que ver
  // entre ellas. Lo que sobra se parte entre arriba y abajo.
  let paso = Math.max(
    tam * 1.7,
    Math.min(tam * 2.8, Math.floor(hueco / Math.max(1, puntos.length))),
  );
  if (o.estilo === "cuaderno") {
    // Hacia ARRIBA al renglón entero, no al más cercano: redondeando a la baja,
    // un paso de 80 caía a 56 y los puntos se amontonaban en un bloque con
    // medio folio en blanco encima y otro medio debajo.
    const renglones = Math.max(1, Math.ceil(paso / RENGLON.paso));
    paso = Math.min(renglones, Math.floor(hueco / RENGLON.paso / Math.max(1, puntos.length)) || 1) * RENGLON.paso;
    paso = Math.max(RENGLON.paso, paso);
    y = sobreRenglon(y, tam);
  }
  y += Math.max(0, (hueco - paso * puntos.length) / 2);

  ctx.font = `600 ${tam}px ${fuente}`;
  puntos.forEach((punto, i) => {
    const linea = y + i * paso;
    const lineas = repartir(ctx, punto, UTIL - 46);
    lineas.forEach((texto, j) => {
      const alturaLinea = linea + j * Math.round(tam * 1.3);
      ctx.fillStyle = t.acento;
      ctx.globalAlpha = 0.22;
      ctx.fillRect(MARGEN + 40, alturaLinea - 4, ctx.measureText(texto).width + 16, tam * 1.18);
      ctx.globalAlpha = 1;
      ctx.fillStyle = t.tinta;
      ctx.fillText(texto, MARGEN + 48, alturaLinea);
    });
    ctx.fillStyle = t.acento;
    ctx.beginPath();
    ctx.arc(MARGEN + 14, linea + tam * 0.6, 8, 0, Math.PI * 2);
    ctx.fill();
  });

  if (!remate) return;
  const r = encajar(ctx, remate, UTIL - 72, 150, 38, 24, "700", fuente, 1.3);
  const altoCaja = r.lineas.length * r.interlinea + 56;
  const arriba = SUELO - altoCaja - 34;
  ctx.strokeStyle = t.acento;
  ctx.lineWidth = 4;
  caja(ctx, MARGEN, arriba, UTIL, altoCaja, 16);
  ctx.stroke();
  ctx.font = `700 ${r.tam}px ${fuente}`;
  ctx.fillStyle = t.tinta;
  escribir(ctx, r.lineas, MARGEN + 36, arriba + 28, r.interlinea);
}

/** Texto — el de siempre: titular, una regla corta y el cuerpo. */
function pintarTexto(ctx: CanvasRenderingContext2D, l: Lamina, o: Opciones, t: Tinta, fuente: string) {
  let techo = MARGEN;

  if (o.foto) {
    const alto = Math.round(ALTO * 0.44);
    ctx.save();
    caja(ctx, MARGEN, MARGEN, UTIL, alto, 24);
    ctx.clip();
    llenar(ctx, o.foto, MARGEN, MARGEN, UTIL, alto);
    ctx.restore();
    techo = MARGEN + alto + 56;
    ctx.fillStyle = t.acento;
    caja(ctx, MARGEN, techo - 8, 64, 8, 4);
    ctx.fill();
    techo += 28;
  } else {
    ctx.font = `700 168px ${fuente}`;
    ctx.fillStyle = t.acento;
    ctx.globalAlpha = 0.16;
    ctx.fillText(String(l.numero).padStart(2, "0"), MARGEN - 6, MARGEN - 26);
    ctx.globalAlpha = 1;
    techo = MARGEN + 128;
  }

  const h = encajar(ctx, l.titular, UTIL, 300, 78, 42, "700", fuente);
  ctx.font = `700 ${h.tam}px ${fuente}`;
  ctx.fillStyle = t.tinta;
  let y = escribir(ctx, h.lineas, MARGEN, techo, h.interlinea);

  y += 26;
  ctx.fillStyle = t.acento;
  ctx.fillRect(MARGEN, y, 52, 5);
  y += 34;

  const c = encajar(ctx, l.cuerpo, UTIL, SUELO - y, 48, 30, "400", fuente);
  ctx.font = `400 ${c.tam}px ${fuente}`;
  ctx.fillStyle = t.tinta;
  ctx.globalAlpha = 0.86;
  escribir(ctx, c.lineas, MARGEN, y, c.interlinea);
  ctx.globalAlpha = 1;
}

const PINTORES: Record<
  string,
  (ctx: CanvasRenderingContext2D, l: Lamina, o: Opciones, t: Tinta, fuente: string) => void
> = {
  portada: pintarPortada,
  cita: pintarCita,
  plantilla: pintarPlantilla,
  lista: pintarLista,
  apuntes: pintarApuntes,
  texto: pintarTexto,
};

export function dibujar(lienzo: HTMLCanvasElement, l: Lamina, o: Opciones): void {
  lienzo.width = ANCHO;
  lienzo.height = ALTO;
  const ctx = lienzo.getContext("2d");
  if (!ctx) return;

  const t = tintas(o.paleta, o.estilo);
  const fuente = familia(o.estilo, o.mano);
  ctx.textBaseline = "top";

  pintarFondo(ctx, t, o.estilo);
  const molde = moldeDe(l, o.total);
  (PINTORES[molde] ?? pintarTexto)(ctx, l, o, t, fuente);

  // La portada lleva su propio remate: un pie de página debajo del gancho le
  // quita la fuerza, y la referencia tampoco lo tiene.
  if (molde !== "portada") {
    // La cita lo lleva arriba con la foto y la plantilla lo firma abajo: en
    // esos dos el pie va sin arroba para no repetirlo en la misma lámina.
    const yaFirmado = molde === "cita" || molde === "plantilla";
    pintarPie(ctx, t, l, o.total, fuente, yaFirmado ? "" : (o.marca?.handle ?? ""));
  } else {
    pintarDesliza(ctx, t, l, o.total, fuente);
  }
}

/** El «1/9 · DESLIZA» de la portada, que es otra cosa que el pie de dentro. */
function pintarDesliza(ctx: CanvasRenderingContext2D, t: Tinta, l: Lamina, total: number, fuente: string) {
  const texto = `${l.numero}/${total}   DESLIZA →`;
  ctx.font = `700 28px ${fuente}`;
  ctx.fillStyle = t.tinta;
  ctx.globalAlpha = 0.72;
  ctx.fillText(texto, MARGEN, ALTO - MARGEN - 10);
  ctx.globalAlpha = 1;
}

export function aPng(lienzo: HTMLCanvasElement): Promise<Blob> {
  return new Promise((listo, falla) =>
    lienzo.toBlob((b) => (b ? listo(b) : falla(new Error("No se pudo crear la imagen."))), "image/png"),
  );
}
