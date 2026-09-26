/**
 * Dibuja las láminas de un carrusel como imágenes listas para subir.
 *
 * Todo en el navegador, sobre un canvas: no hay servidor de imágenes, no cuesta
 * nada y las láminas no salen de la máquina de su dueño.
 *
 * 1080×1350 porque es lo que ocupa más pantalla en el feed sin que recorte.
 */

export const ANCHO = 1080;
export const ALTO = 1350;

export type Paleta = {
  /** 60 — el que manda. */ fondo: string;
  /** 30 — el texto. */ tinta: string;
  /** 10 — el que resalta. */ acento: string;
};

/** La regla 60-30-10 de sus apuntes, con los comodines por defecto. */
export const PALETAS: { id: string; nombre: string; p: Paleta }[] = [
  { id: "hueso", nombre: "Hueso", p: { fondo: "#F6F5F2", tinta: "#18201F", acento: "#1F6F6B" } },
  { id: "tinta", nombre: "Tinta", p: { fondo: "#141A19", tinta: "#F2F4F3", acento: "#57B8B0" } },
  { id: "papel", nombre: "Papel", p: { fondo: "#FFFFFF", tinta: "#111111", acento: "#C2410C" } },
  { id: "noche", nombre: "Noche", p: { fondo: "#0E1220", tinta: "#EDF0F7", acento: "#F5C451" } },
];

export type LaminaDibujable = {
  numero: number;
  titular: string;
  cuerpo: string;
  total: number;
};

/** Parte un texto en líneas que caben, midiendo de verdad sobre el canvas. */
function repartir(
  ctx: CanvasRenderingContext2D,
  texto: string,
  ancho: number,
): string[] {
  const lineas: string[] = [];
  for (const parrafo of texto.split("\n")) {
    let actual = "";
    for (const palabra of parrafo.split(/\s+/).filter(Boolean)) {
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

const FUENTE = '-apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';

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
): { tam: number; lineas: string[]; interlinea: number } {
  for (let tam = desde; tam >= hasta; tam -= 2) {
    ctx.font = `${peso} ${tam}px ${FUENTE}`;
    const lineas = repartir(ctx, texto, ancho);
    const interlinea = Math.round(tam * 1.22);
    if (lineas.length * interlinea <= altoMax) return { tam, lineas, interlinea };
  }
  ctx.font = `${peso} ${hasta}px ${FUENTE}`;
  return {
    tam: hasta,
    lineas: repartir(ctx, texto, ancho),
    interlinea: Math.round(hasta * 1.22),
  };
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

/** Dibuja la foto recortando para llenar la caja, sin deformarla. */
function llenar(
  ctx: CanvasRenderingContext2D,
  img: CanvasImageSource & { width: number; height: number },
  x: number,
  y: number,
  w: number,
  h: number,
) {
  const escala = Math.max(w / img.width, h / img.height);
  const aw = img.width * escala;
  const ah = img.height * escala;
  ctx.drawImage(img, x + (w - aw) / 2, y + (h - ah) / 2, aw, ah);
}

export function dibujar(
  lienzo: HTMLCanvasElement,
  l: LaminaDibujable,
  p: Paleta,
  foto?: (CanvasImageSource & { width: number; height: number }) | null,
): void {
  lienzo.width = ANCHO;
  lienzo.height = ALTO;
  const ctx = lienzo.getContext("2d");
  if (!ctx) return;

  const margen = 88;
  const util = ANCHO - margen * 2;
  const esPortada = l.numero === 1 || !l.cuerpo?.trim();

  ctx.fillStyle = p.fondo;
  ctx.fillRect(0, 0, ANCHO, ALTO);
  ctx.textBaseline = "top";

  // ── La foto ──────────────────────────────────────────────────────────────
  // En la portada va a sangre con un velo encima para que el texto se lea; en
  // las de dentro ocupa la mitad de arriba y el texto va debajo.
  let techo = margen;
  if (foto && esPortada) {
    ctx.save();
    llenar(ctx, foto, 0, 0, ANCHO, ALTO);
    const velo = ctx.createLinearGradient(0, ALTO * 0.15, 0, ALTO);
    velo.addColorStop(0, `${p.fondo}00`);
    velo.addColorStop(0.55, `${p.fondo}E6`);
    velo.addColorStop(1, p.fondo);
    ctx.fillStyle = velo;
    ctx.fillRect(0, 0, ANCHO, ALTO);
    ctx.restore();
  } else if (foto) {
    const alto = Math.round(ALTO * 0.44);
    ctx.save();
    caja(ctx, margen, margen, util, alto, 24);
    ctx.clip();
    llenar(ctx, foto, margen, margen, util, alto);
    ctx.restore();
    techo = margen + alto + 56;
  }

  // ── El número, que también marca dónde empieza ───────────────────────────
  if (!esPortada && !foto) {
    ctx.font = `700 168px ${FUENTE}`;
    ctx.fillStyle = p.acento;
    ctx.globalAlpha = 0.16;
    ctx.fillText(String(l.numero).padStart(2, "0"), margen - 6, margen - 26);
    ctx.globalAlpha = 1;
    techo = margen + 128;
  } else if (!esPortada) {
    ctx.fillStyle = p.acento;
    caja(ctx, margen, techo - 8, 64, 8, 4);
    ctx.fill();
    techo += 28;
  } else if (!foto) {
    ctx.fillStyle = p.acento;
    caja(ctx, margen, margen, 96, 10, 5);
    ctx.fill();
  }

  const suelo = ALTO - margen - 74;

  // ── El texto ─────────────────────────────────────────────────────────────
  if (esPortada) {
    const arriba = foto ? Math.round(ALTO * 0.42) : margen + 72;
    const t = encajar(ctx, l.titular, util, suelo - arriba, 116, 52, "700");
    ctx.font = `700 ${t.tam}px ${FUENTE}`;
    ctx.fillStyle = p.tinta;
    let y = foto ? suelo - t.lineas.length * t.interlinea : arriba + Math.max(0, (suelo - arriba - t.lineas.length * t.interlinea) / 2);
    for (const linea of t.lineas) {
      ctx.fillText(linea, margen, y);
      y += t.interlinea;
    }
  } else {
    const t = encajar(ctx, l.titular, util, 300, 78, 42, "700");
    ctx.font = `700 ${t.tam}px ${FUENTE}`;
    ctx.fillStyle = p.tinta;
    let y = techo;
    for (const linea of t.lineas) {
      ctx.fillText(linea, margen, y);
      y += t.interlinea;
    }

    // Una regla corta entre titular y cuerpo: separa sin meter una línea más.
    y += 26;
    ctx.fillStyle = p.acento;
    ctx.fillRect(margen, y, 52, 5);
    y += 34;

    const c = encajar(ctx, l.cuerpo, util, suelo - y, 48, 30, "400");
    ctx.font = `400 ${c.tam}px ${FUENTE}`;
    ctx.fillStyle = p.tinta;
    ctx.globalAlpha = 0.86;
    for (const linea of c.lineas) {
      ctx.fillText(linea, margen, y);
      y += c.interlinea;
    }
    ctx.globalAlpha = 1;
  }

  // ── El pie ───────────────────────────────────────────────────────────────
  const pie = ALTO - margen - 34;
  ctx.fillStyle = p.tinta;
  ctx.globalAlpha = 0.12;
  ctx.fillRect(margen, pie - 26, util, 2);
  ctx.globalAlpha = 1;

  ctx.font = `700 30px ${FUENTE}`;
  ctx.fillStyle = p.acento;
  ctx.fillText(`${String(l.numero).padStart(2, "0")} / ${String(l.total).padStart(2, "0")}`, margen, pie);

  if (l.numero < l.total) {
    ctx.font = `600 30px ${FUENTE}`;
    ctx.fillStyle = p.tinta;
    ctx.globalAlpha = 0.5;
    const desliza = "desliza →";
    ctx.fillText(desliza, ANCHO - margen - ctx.measureText(desliza).width, pie);
    ctx.globalAlpha = 1;
  }
}

export function aPng(lienzo: HTMLCanvasElement): Promise<Blob> {
  return new Promise((listo, falla) =>
    lienzo.toBlob((b) => (b ? listo(b) : falla(new Error("No se pudo crear la imagen."))), "image/png"),
  );
}
