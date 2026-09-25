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

export function dibujar(lienzo: HTMLCanvasElement, l: LaminaDibujable, p: Paleta): void {
  lienzo.width = ANCHO;
  lienzo.height = ALTO;
  const ctx = lienzo.getContext("2d");
  if (!ctx) return;

  const margen = 96;
  const util = ANCHO - margen * 2;

  ctx.fillStyle = p.fondo;
  ctx.fillRect(0, 0, ANCHO, ALTO);

  // La barra de acento: el 10% de la regla, y de paso marca dónde empieza.
  ctx.fillStyle = p.acento;
  ctx.fillRect(margen, margen, 88, 10);

  ctx.textBaseline = "top";
  ctx.fillStyle = p.tinta;

  const esPortada = l.numero === 1 || !l.cuerpo?.trim();
  const arriba = margen + 64;
  const abajo = ALTO - margen - 56;

  if (esPortada) {
    // La primera lámina hace todo el trabajo: va sola y va grande.
    const { lineas, tam, interlinea } = encajar(ctx, l.titular, util, abajo - arriba, 110, 48, "700");
    ctx.font = `700 ${tam}px ${FUENTE}`;
    const alto = lineas.length * interlinea;
    let y = arriba + Math.max(0, (abajo - arriba - alto) / 2);
    for (const linea of lineas) {
      ctx.fillText(linea, margen, y);
      y += interlinea;
    }
  } else {
    const t = encajar(ctx, l.titular, util, 340, 74, 40, "700");
    ctx.font = `700 ${t.tam}px ${FUENTE}`;
    let y = arriba;
    for (const linea of t.lineas) {
      ctx.fillText(linea, margen, y);
      y += t.interlinea;
    }

    y += 40;
    const c = encajar(ctx, l.cuerpo, util, abajo - y, 46, 28, "400");
    ctx.font = `400 ${c.tam}px ${FUENTE}`;
    ctx.fillStyle = p.tinta;
    ctx.globalAlpha = 0.82;
    for (const linea of c.lineas) {
      ctx.fillText(linea, margen, y);
      y += c.interlinea;
    }
    ctx.globalAlpha = 1;
  }

  // El número, abajo. Dice cuánto falta, que es lo que sostiene el pase.
  ctx.font = `600 30px ${FUENTE}`;
  ctx.fillStyle = p.acento;
  ctx.fillText(`${l.numero} / ${l.total}`, margen, ALTO - margen - 20);

  if (l.numero < l.total) {
    ctx.font = `600 30px ${FUENTE}`;
    ctx.fillStyle = p.tinta;
    ctx.globalAlpha = 0.45;
    const desliza = "desliza →";
    ctx.fillText(desliza, ANCHO - margen - ctx.measureText(desliza).width, ALTO - margen - 20);
    ctx.globalAlpha = 1;
  }
}

export function aPng(lienzo: HTMLCanvasElement): Promise<Blob> {
  return new Promise((listo, falla) =>
    lienzo.toBlob((b) => (b ? listo(b) : falla(new Error("No se pudo crear la imagen."))), "image/png"),
  );
}
