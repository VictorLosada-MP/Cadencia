/**
 * Dibuja las láminas de un carrusel como imágenes listas para subir.
 *
 * Todo en el navegador, sobre un canvas: no hay servidor de imágenes, no cuesta
 * nada y las láminas no salen de la máquina de su dueño. 1080×1350 porque es lo
 * que ocupa más pantalla en el feed sin que recorte — y es el tamaño exacto de
 * los carruseles de referencia, comprobado.
 *
 * ── Un modelo es un sistema, no una piel ────────────────────────────────────
 *
 * Aquí hubo antes seis «moldes» y dos «estilos». Era un autoengaño: los seis
 * compartían un solo margen, todo alineado a la izquierda y el mismo pie, así
 * que lo único que cambiaba de verdad era el adorno. Se veían como la misma
 * plantilla repintada porque lo eran.
 *
 * Estos cuatro salen de carruseles COMPLETOS, no de portadas, y cada uno trae
 * lo suyo: su alineación, su tipografía, si lleva pie o no, dónde se sienta la
 * marca, y qué campos hace falta llenar. Cambiar de modelo cambia la lámina
 * entera, no su color de fondo.
 */

import { girarTono, legibleHex, mezclarHex, type Paleta } from "@/lib/marca";
import {
  partirMarcas,
  rolDe,
  type Lamina,
  type Modelo,
  type Rol,
  type Trozo,
} from "@/types/guion";

export type { Paleta } from "@/lib/marca";

export const ANCHO = 1080;
export const ALTO = 1350;

/** La regla 60-30-10 de sus apuntes, con los comodines por defecto. */
export const PALETAS: { id: string; nombre: string; p: Paleta }[] = [
  { id: "hueso", nombre: "Hueso", p: { fondo: "#F6F5F2", tinta: "#18201F", acento: "#1F6F6B" } },
  { id: "tinta", nombre: "Tinta", p: { fondo: "#141A19", tinta: "#F2F4F3", acento: "#57B8B0" } },
  { id: "papel", nombre: "Papel", p: { fondo: "#FFFFFF", tinta: "#111111", acento: "#C2410C" } },
  { id: "noche", nombre: "Noche", p: { fondo: "#0E1220", tinta: "#EDF0F7", acento: "#F5C451" } },
];

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

/** Las familias que necesita el motor. Llegan de fuera: las carga `next/font`. */
export type Fuentes = {
  interfaz: string;
  geometrica: string;
  monoespacio: string;
  condensada: string;
  display: string;
  redonda: string;
  manuscrita: string;
};

export type Opciones = {
  paleta: Paleta;
  modelo: Modelo;
  total: number;
  foto?: Imagen | null;
  marca?: Marca | null;
  fuentes: Fuentes;
};

/** Contraste que se le exige al texto largo. Por encima del AA de la WCAG. */
const CLARO = 7;

type Tinta = { fondo: string; tinta: string; acento: string; suave: string };

/**
 * El fondo es del MODELO, no de su paleta.
 *
 * Esto estaba al revés y se notaba: mezclando el hueso de la captura con un
 * verde oscuro salía un gris frío, y el crema de las manchas salía embarrado.
 * Y es que el fondo ES parte del modelo — el de Spencer es hueso para todo el
 * mundo, el de Giowever es blanco, el de alpacka es casi negro. Lo que hace
 * que una captura sea SUYA no es el tono del papel: es su cara, su arroba y su
 * color de acento.
 *
 * Así que la base va escrita, la marca entra por el acento —y por las manchas,
 * que sí son de su color— y del fondo solo se tiñe un punto, lo justo para que
 * no se sienta ajeno.
 */
const BASES: Record<Modelo, { fondo: string; tinta: string; tinte: number }> = {
  captura: { fondo: "#F7F5F1", tinta: "#12100D", tinte: 0.08 },
  // Casi nada: este modelo ES el blanco. Con un 8% de un verde oscuro el papel
  // salía gris, y un blanco que deja de ser blanco deja de ser este modelo.
  minimo: { fondo: "#FFFFFF", tinta: "#000000", tinte: 0.03 },
  terminal: { fondo: "#241E1A", tinta: "#F2EFEA", tinte: 0.1 },
  // Aquí el fondo sí es suyo: las manchas van con su color, girado de tono.
  manchas: { fondo: "#EFE6D8", tinta: "#17120E", tinte: 0.12 },
};

function tintasDe(modelo: Modelo, p: Paleta): Tinta {
  const base = BASES[modelo];
  const fondo = mezclarHex(base.fondo, p.fondo, base.tinte);
  return {
    fondo,
    tinta: legibleHex(base.tinta, fondo, CLARO),
    acento: legibleHex(p.acento, fondo, 4),
    // El 62% y no menos: más claro no se lee en una pantalla al sol, que es
    // donde se mira un carrusel.
    suave: mezclarHex(fondo, base.tinta, 0.62),
  };
}

/**
 * La foto, recortada dentro de una caja redondeada.
 *
 * Cada modelo tiene su sitio para ella y es distinto —debajo del texto en la
 * captura, dentro de la tarjeta en las manchas— porque un hueco genérico «la
 * foto de fondo con un velo» es justo lo que hacía que los seis moldes de
 * antes se parecieran entre sí.
 */
function fotoEnCaja(
  ctx: CanvasRenderingContext2D,
  foto: Imagen,
  x: number,
  y: number,
  w: number,
  h: number,
  r = 32,
) {
  ctx.save();
  caja(ctx, x, y, w, h, r);
  ctx.clip();
  llenar(ctx, foto, x, y, w, h);
  ctx.restore();
}

// ── Herramientas comunes ────────────────────────────────────────────────────

/** Parte un texto en líneas que caben, midiendo de verdad sobre el canvas. */
function repartir(ctx: CanvasRenderingContext2D, texto: string, ancho: number): string[] {
  const lineas: string[] = [];
  for (const parrafo of texto.split("\n")) {
    let actual = "";
    // Por espacios normales y tabuladores, NO por `\s`: el espacio duro es
    // `\s` para la expresión regular y partiría lo que no se debe partir.
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

type Tipo = { fuente: string; peso: string; aire?: number };

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
  t: Tipo,
): { tam: number; lineas: string[]; interlinea: number } {
  const aire = t.aire ?? 1.2;
  for (let tam = desde; tam >= hasta; tam -= 2) {
    ctx.font = `${t.peso} ${tam}px ${t.fuente}`;
    const lineas = repartir(ctx, texto, ancho);
    const interlinea = Math.round(tam * aire);
    if (lineas.length * interlinea <= altoMax) return { tam, lineas, interlinea };
  }
  ctx.font = `${t.peso} ${hasta}px ${t.fuente}`;
  return {
    tam: hasta,
    lineas: repartir(ctx, texto, hasta === 0 ? ancho : ancho),
    interlinea: Math.round(hasta * aire),
  };
}

/** Redondea un rectángulo: los cantos a escuadra se ven a plantilla vieja. */
function caja(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const radio = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radio, y);
  ctx.arcTo(x + w, y, x + w, y + h, radio);
  ctx.arcTo(x + w, y + h, x, y + h, radio);
  ctx.arcTo(x, y + h, x, y, radio);
  ctx.arcTo(x, y, x + w, y, radio);
  ctx.closePath();
}

/** Dibuja la foto recortando para llenar la caja, sin deformarla. */
function llenar(ctx: CanvasRenderingContext2D, img: Imagen, x: number, y: number, w: number, h: number) {
  const escala = Math.max(w / img.width, h / img.height);
  const aw = img.width * escala;
  const ah = img.height * escala;
  ctx.drawImage(img, x + (w - aw) / 2, y + (h - ah) / 2, aw, ah);
}

/** Un círculo recortado con la foto dentro. La cara, en todos los modelos. */
function redondo(ctx: CanvasRenderingContext2D, img: Imagen, x: number, y: number, lado: number) {
  ctx.save();
  ctx.beginPath();
  ctx.arc(x + lado / 2, y + lado / 2, lado / 2, 0, Math.PI * 2);
  ctx.clip();
  llenar(ctx, img, x, y, lado, lado);
  ctx.restore();
}

type Donde = "izquierda" | "centro";

/** Escribe líneas ya medidas y devuelve dónde quedó el lápiz. */
function escribir(
  ctx: CanvasRenderingContext2D,
  lineas: string[],
  x: number,
  y: number,
  interlinea: number,
  donde: Donde = "izquierda",
  ancho = 0,
): number {
  for (const l of lineas) {
    const dx = donde === "centro" ? x + (ancho - ctx.measureText(l).width) / 2 : x;
    ctx.fillText(l, dx, y);
    y += interlinea;
  }
  return y;
}

type LineaMarcada = { trozos: (Trozo & { ancho: number })[]; ancho: number };

/**
 * Reparte un texto CON MARCAS en líneas, midiendo cada trozo con su peso.
 *
 * Hace falta porque `[un hueco]` y `*una palabra fuerte*` se pintan en otro
 * color o en negrita dentro de la misma línea: medir la línea entera con un
 * solo peso la deja corrida unos píxeles, y a la tercera línea se nota.
 */
function repartirMarcado(
  ctx: CanvasRenderingContext2D,
  texto: string,
  ancho: number,
  tam: number,
  fuente: string,
  peso: string,
  pesoFuerte: string,
): LineaMarcada[] {
  const fuenteDe = (t: Trozo) =>
    `${t.marca ? pesoFuerte : peso} ${tam}px ${fuente}`;

  const lineas: LineaMarcada[] = [];
  let actual: LineaMarcada = { trozos: [], ancho: 0 };

  const parrafos = texto.split("\n");
  for (let i = 0; i < parrafos.length; i++) {
    // El salto se respeta SIEMPRE, también cuando el párrafo viene vacío: una
    // línea en blanco dentro de un bloque que se copia es parte del bloque, y
    // quitarla pegaba el saludo con el precio en el mismo párrafo.
    if (i > 0) {
      lineas.push(actual);
      actual = { trozos: [], ancho: 0 };
    }
    for (const trozo of partirMarcas(parrafos[i])) {
      ctx.font = fuenteDe(trozo);
      // Se parte por palabras conservando el espacio de delante, para que al
      // juntarlas la línea mida lo mismo que medía suelta.
      const piezas = trozo.texto.split(/(\s+)/).filter((p) => p !== "");
      for (const pieza of piezas) {
        const w = ctx.measureText(pieza).width;
        if (actual.ancho + w > ancho && actual.trozos.length && pieza.trim()) {
          lineas.push(actual);
          actual = { trozos: [], ancho: 0 };
        }
        if (!actual.trozos.length && !pieza.trim()) continue;
        const ultimo = actual.trozos[actual.trozos.length - 1];
        if (ultimo && ultimo.marca === trozo.marca) {
          ultimo.texto += pieza;
          ultimo.ancho += w;
        } else {
          actual.trozos.push({ texto: pieza, marca: trozo.marca, ancho: w });
        }
        actual.ancho += w;
      }
    }
  }
  lineas.push(actual);
  // Se quitan las vacías de los extremos —esas sí sobran— y se dejan las de en
  // medio, que son el hueco que el texto pedía.
  while (lineas.length && !lineas[0].trozos.length) lineas.shift();
  while (lineas.length && !lineas[lineas.length - 1].trozos.length) lineas.pop();
  return lineas;
}

function pintarMarcado(
  ctx: CanvasRenderingContext2D,
  lineas: LineaMarcada[],
  x: number,
  y: number,
  interlinea: number,
  tam: number,
  fuente: string,
  peso: string,
  pesoFuerte: string,
  colores: { normal: string; marcado: string },
  donde: Donde = "izquierda",
  ancho = 0,
): number {
  for (const linea of lineas) {
    let dx = donde === "centro" ? x + (ancho - linea.ancho) / 2 : x;
    for (const t of linea.trozos) {
      ctx.font = `${t.marca ? pesoFuerte : peso} ${tam}px ${fuente}`;
      ctx.fillStyle = t.marca ? colores.marcado : colores.normal;
      ctx.fillText(t.texto, dx, y);
      dx += t.ancho;
    }
    y += interlinea;
  }
  return y;
}

/** Letras separadas, para las versalitas del modelo mínimo. */
function espaciado(
  ctx: CanvasRenderingContext2D,
  texto: string,
  x: number,
  y: number,
  separacion: number,
  donde: Donde,
  ancho: number,
) {
  const letras = [...texto];
  const total =
    letras.reduce((s, c) => s + ctx.measureText(c).width, 0) + separacion * (letras.length - 1);
  let dx = donde === "centro" ? x + (ancho - total) / 2 : x;
  for (const c of letras) {
    ctx.fillText(c, dx, y);
    dx += ctx.measureText(c).width + separacion;
  }
}

/** El trazo de marcador: una barra redondeada detrás del texto. */
function marcador(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, color: string) {
  ctx.save();
  ctx.fillStyle = color;
  caja(ctx, x, y, w, h, h / 2);
  ctx.fill();
  ctx.restore();
}

// ── Modelo 1 · Captura ──────────────────────────────────────────────────────
//
// Una publicación de red social. Lo que lo define: la cabecera con su cara y su
// arroba se repite IDÉNTICA en las ocho láminas, el texto va centrado, y no hay
// pie, ni número de página, ni «desliza». Comprobado lámina por lámina en la
// referencia: las ocho son la misma lámina con otro texto.


function pintarCaptura(ctx: CanvasRenderingContext2D, l: Lamina, o: Opciones, t: Tinta) {
  const f = o.fuentes.interfaz;
  const margen = 88;
  const util = ANCHO - margen * 2;

  ctx.fillStyle = t.fondo;
  ctx.fillRect(0, 0, ANCHO, ALTO);

  // ── La cabecera ──
  const lado = 258;
  if (o.marca?.avatar) {
    redondo(ctx, o.marca.avatar, margen, 118, lado);
  } else {
    ctx.fillStyle = mezclarHex(t.fondo, t.tinta, 0.12);
    ctx.beginPath();
    ctx.arc(margen + lado / 2, 118 + lado / 2, lado / 2, 0, Math.PI * 2);
    ctx.fill();
  }

  const x = margen + lado + 40;
  const nombre = o.marca?.nombre?.trim() || "Tu nombre";
  ctx.font = `700 46px ${f}`;
  ctx.fillStyle = t.tinta;
  ctx.fillText(nombre, x, 198);

  // El sello azul de verificado. Va porque está en la referencia y porque sin
  // él la cabecera no se lee como una captura, que es todo el truco.
  const anchoNombre = ctx.measureText(nombre).width;
  const cx = x + anchoNombre + 30;
  ctx.fillStyle = "#1D9BF0";
  ctx.beginPath();
  ctx.arc(cx, 220, 21, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#FFFFFF";
  ctx.lineWidth = 4;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.beginPath();
  ctx.moveTo(cx - 9, 220);
  ctx.lineTo(cx - 2, 227);
  ctx.lineTo(cx + 10, 212);
  ctx.stroke();

  if (o.marca?.handle?.trim()) {
    ctx.font = `400 40px ${f}`;
    ctx.fillStyle = t.suave;
    ctx.fillText(`@${o.marca.handle.trim()}`, x, 262);
  }

  // Una raya finísima donde la referencia tiene el escalón de tono.
  ctx.fillStyle = t.tinta;
  ctx.globalAlpha = 0.08;
  ctx.fillRect(0, 540, ANCHO, 2);
  ctx.globalAlpha = 1;

  // ── La foto, adjunta debajo ──
  // En una publicación de red social la imagen va DEBAJO del texto, no detrás:
  // ponerla de fondo con un velo rompe lo único que hace que esta lámina se
  // lea como una captura. Si la hay, el texto se aprieta para dejarle sitio.
  const altoFoto = o.foto ? 420 : 0;
  const suelo = ALTO - 88 - altoFoto - (o.foto ? 44 : 0);
  if (o.foto) fotoEnCaja(ctx, o.foto, margen, ALTO - 88 - altoFoto, util, altoFoto, 28);

  // ── El texto, centrado ──
  const hueco = suelo - 600;
  let y = 600;
  const h = encajar(ctx, l.titular, util, Math.min(320, hueco * 0.5), 62, 34, {
    fuente: f, peso: "700", aire: 1.3,
  });
  ctx.font = `700 ${h.tam}px ${f}`;
  ctx.fillStyle = t.tinta;
  y = escribir(ctx, h.lineas, margen, y, h.interlinea, "centro", util);

  if (!l.cuerpo?.trim()) return;
  y += o.foto ? 44 : 78;
  const base = encajar(ctx, l.cuerpo.replace(/[*]/g, ""), util, suelo - y, 54, 28, {
    fuente: f, peso: "400", aire: 1.34,
  });
  const lineas = repartirMarcado(ctx, l.cuerpo, util, base.tam, f, "400", "700");
  pintarMarcado(
    ctx, lineas, margen, y, base.interlinea, base.tam, f, "400", "700",
    { normal: t.tinta, marcado: t.tinta }, "centro", util,
  );
}

// ── Modelo 5 · Mínimo ───────────────────────────────────────────────────────
//
// Blanco y negro, todo centrado, y la firma manuscrita abajo. La portada apila
// el titular en mayúsculas y remata con una línea mucho mayor; las de dentro
// son un número enorme, una etiqueta en versalitas espaciadas y una frase con
// palabras en negrita. No hay pie ni contador: el número ES el contador.


function pintarMinimo(ctx: CanvasRenderingContext2D, l: Lamina, o: Opciones, t: Tinta, rol: Rol) {
  const f = o.fuentes.geometrica;
  const margen = 110;
  const util = ANCHO - margen * 2;

  ctx.fillStyle = t.fondo;
  ctx.fillRect(0, 0, ANCHO, ALTO);

  // La foto va abajo, centrada y redondeada. Este modelo vive del vacío, así
  // que la imagen ocupa el hueco de abajo y nunca el fondo: un blanco que deja
  // de ser blanco deja de ser este modelo.
  const anchoFoto = 560;
  const altoFoto = o.foto ? 380 : 0;
  const techoFoto = 1150 - altoFoto;
  if (o.foto) fotoEnCaja(ctx, o.foto, (ANCHO - anchoFoto) / 2, techoFoto, anchoFoto, altoFoto, 26);

  const firma = () => {
    if (!o.marca?.handle?.trim()) return;
    ctx.font = `400 60px ${o.fuentes.manuscrita}`;
    ctx.fillStyle = t.tinta;
    const texto = `@${o.marca.handle.trim()}`;
    ctx.fillText(texto, (ANCHO - ctx.measureText(texto).width) / 2, 1230);
  };

  if (rol === "portada") {
    // Apilada y centrada, con el remate mucho mayor. Sin remate, el titular
    // entero crece: una portada a media altura no para el dedo.
    const remate = l.remate?.trim();
    const altoTitular = (remate ? 520 : 700) - (o.foto ? 300 : 0);
    const h = encajar(ctx, l.titular.toLocaleUpperCase("es"), util, altoTitular, 86, 44, {
      fuente: f, peso: "700", aire: 1.16,
    });
    const r = remate
      ? encajar(ctx, remate.toLocaleUpperCase("es"), util, 220, 160, 70, {
          fuente: f, peso: "900", aire: 1.05,
        })
      : null;

    const alto = h.lineas.length * h.interlinea + (r ? r.lineas.length * r.interlinea : 0);
    let y = Math.max(160, ((o.foto ? techoFoto : ALTO) - alto) / 2 - 40);

    ctx.font = `700 ${h.tam}px ${f}`;
    ctx.fillStyle = t.tinta;
    y = escribir(ctx, h.lineas, margen, y, h.interlinea, "centro", util);

    if (r) {
      ctx.font = `900 ${r.tam}px ${f}`;
      escribir(ctx, r.lineas, margen, y, r.interlinea, "centro", util);
    }
    firma();
    return;
  }

  // ── Dentro: número, etiqueta y frase ──
  ctx.font = `900 250px ${f}`;
  ctx.fillStyle = t.tinta;
  const numero = String(l.numero - 1);
  ctx.fillText(numero, (ANCHO - ctx.measureText(numero).width) / 2, 230);

  let y = 520;
  const etiqueta = l.etiqueta?.trim();
  if (etiqueta) {
    ctx.font = `500 44px ${f}`;
    ctx.fillStyle = t.tinta;
    espaciado(ctx, etiqueta.toLocaleUpperCase("es"), margen, y, 7, "centro", util);
    y += 110;
  }

  // Solo el cuerpo: en este modelo el `remate` es la línea gigante de la
  // PORTADA, y pegarlo aquí detrás le añadía una frase suelta sin sitio.
  const cuerpo = l.cuerpo?.trim() ?? "";
  if (cuerpo) {
    const base = encajar(ctx, cuerpo.replace(/[*]/g, ""), util, techoFoto - y - 40, 52, 30, {
      fuente: f, peso: "400", aire: 1.42,
    });
    const lineas = repartirMarcado(ctx, cuerpo, util, base.tam, f, "400", "700");
    pintarMarcado(
      ctx, lineas, margen, y, base.interlinea, base.tam, f, "400", "700",
      { normal: t.tinta, marcado: t.tinta }, "centro", util,
    );
  }
  firma();
}

// ── Modelo 3 · Terminal ─────────────────────────────────────────────────────
//
// Dos láminas distintas, no una: la portada y el cierre van sobre foto a sangre
// con el titular en condensada y mayúsculas, alternando blanco y acento por lo
// que venga marcado; las de dentro son monoespacio sobre oscuro —TÍTULO
// INCLUIDO, que es la mitad del carácter— con los huecos en rojo, viñetas de
// flecha y un pie con «Guarda esto» y el arroba.


function sobreFoto(ctx: CanvasRenderingContext2D, l: Lamina, o: Opciones, t: Tinta, rol: Rol) {
  const f = o.fuentes.condensada;
  const margen = 70;
  const util = ANCHO - margen * 2;

  ctx.fillStyle = "#0B0908";
  ctx.fillRect(0, 0, ANCHO, ALTO);
  if (o.foto) llenar(ctx, o.foto, 0, 0, ANCHO, ALTO);

  // El velo: transparente arriba y negro sólido abajo, que es lo que deja
  // leer un titular de seis líneas encima de cualquier fotografía.
  const velo = ctx.createLinearGradient(0, ALTO * 0.28, 0, ALTO);
  velo.addColorStop(0, "#00000000");
  velo.addColorStop(0.42, "#000000D9");
  velo.addColorStop(0.62, "#000000");
  velo.addColorStop(1, "#000000");
  ctx.fillStyle = velo;
  ctx.fillRect(0, 0, ANCHO, ALTO);

  const pie = rol === "cierre" && l.etiqueta?.trim() ? 1200 : 1270;
  const texto = l.titular.toLocaleUpperCase("es");
  const base = encajar(ctx, texto.replace(/[*[\]]/g, ""), util, 620, 86, 48, {
    fuente: f, peso: "700", aire: 1.08,
  });
  const lineas = repartirMarcado(ctx, texto, util, base.tam, f, "700", "700");
  const alto = lineas.length * base.interlinea;
  let y = pie - 72 - alto;

  // La insignia: su cara entre dos filetes, como el logo de la referencia.
  if (o.marca?.avatar) {
    const lado = 72;
    redondo(ctx, o.marca.avatar, (ANCHO - lado) / 2, y - 112, lado);
    ctx.fillStyle = t.tinta;
    ctx.globalAlpha = 0.5;
    ctx.fillRect(ANCHO / 2 - 230, y - 78, 150, 2);
    ctx.fillRect(ANCHO / 2 + 80, y - 78, 150, 2);
    ctx.globalAlpha = 1;
  }

  y = pintarMarcado(
    ctx, lineas, margen, y, base.interlinea, base.tam, f, "700", "700",
    { normal: "#FFFFFF", marcado: t.acento }, "centro", util,
  );

  if (rol === "cierre" && l.etiqueta?.trim()) {
    // El enlace subrayado del final.
    ctx.font = `500 44px ${o.fuentes.monoespacio}`;
    ctx.fillStyle = t.acento;
    const enlace = l.etiqueta.trim();
    const w = ctx.measureText(enlace).width;
    const ex = (ANCHO - w) / 2;
    ctx.fillText(enlace, ex, y + 24);
    ctx.fillRect(ex, y + 24 + 50, w, 3);
    return;
  }

  ctx.font = `500 30px ${f}`;
  ctx.fillStyle = "#FFFFFF";
  ctx.globalAlpha = 0.85;
  espaciado(ctx, "DESLIZA  →", margen, 1278, 6, "centro", util);
  ctx.globalAlpha = 1;
}

function pintarTerminal(ctx: CanvasRenderingContext2D, l: Lamina, o: Opciones, t: Tinta, rol: Rol) {
  if (rol !== "desarrollo") return sobreFoto(ctx, l, o, t, rol);

  const f = o.fuentes.monoespacio;
  const margen = 72;
  const util = ANCHO - margen * 2;

  ctx.fillStyle = t.fondo;
  ctx.fillRect(0, 0, ANCHO, ALTO);
  // Aquí sí va al fondo, y muy velada: es una pantalla de consola, y una foto
  // nítida detrás de veinte líneas de monoespacio no deja leer ninguna.
  if (o.foto) {
    ctx.save();
    llenar(ctx, o.foto, 0, 0, ANCHO, ALTO);
    ctx.globalAlpha = 0.88;
    ctx.fillStyle = t.fondo;
    ctx.fillRect(0, 0, ANCHO, ALTO);
    ctx.restore();
  }

  const suelo = ALTO - 150;
  let y = 96;

  // El número delante del titular, en gris, y el titular en monoespacio: en la
  // referencia el título NO cambia de familia, y por eso se lee como consola.
  const prefijo = `${l.numero - 1}. `;
  const h = encajar(ctx, prefijo + l.titular, util, 260, 56, 34, {
    fuente: f, peso: "700", aire: 1.22,
  });
  ctx.font = `700 ${h.tam}px ${f}`;
  const anchoPrefijo = ctx.measureText(prefijo).width;
  ctx.fillStyle = t.suave;
  ctx.fillText(prefijo, margen, y);
  ctx.fillStyle = t.tinta;
  const primera = h.lineas[0]?.slice(prefijo.length) ?? "";
  ctx.fillText(primera, margen + anchoPrefijo, y);
  y += h.interlinea;
  if (h.lineas.length > 1) {
    y = escribir(ctx, h.lineas.slice(1), margen + anchoPrefijo, y, h.interlinea);
  }

  if (l.etiqueta?.trim()) {
    y += 16;
    const s = encajar(ctx, l.etiqueta, util, 140, 34, 24, {
      fuente: f, peso: "italic 400", aire: 1.3,
    });
    ctx.font = `italic 400 ${s.tam}px ${f}`;
    ctx.fillStyle = t.suave;
    y = escribir(ctx, s.lineas, margen, y, s.interlinea);
  }

  const puntos = l.puntos ?? [];
  const bloque = l.bloque?.trim() || l.cuerpo?.trim() || "";

  if (bloque) {
    y += 54;
    ctx.font = `400 30px ${f}`;
    ctx.fillStyle = t.suave;
    ctx.fillText("Prompt:", margen, y);
    y += 58;

    const reservado = puntos.length * 96;
    const base = encajar(ctx, bloque.replace(/[*]/g, ""), util, suelo - y - reservado, 50, 22, {
      fuente: f, peso: "400", aire: 1.38,
    });
    const lineas = repartirMarcado(ctx, bloque, util, base.tam, f, "400", "400");
    y = pintarMarcado(
      ctx, lineas, margen, y, base.interlinea, base.tam, f, "400", "400",
      { normal: t.tinta, marcado: t.acento },
    );
  }

  // Las viñetas de flecha, cada una con su sangría.
  for (const punto of puntos) {
    y += 22;
    const sangra = 52;
    const base = encajar(ctx, punto.replace(/[*]/g, ""), util - sangra, suelo - y, 34, 20, {
      fuente: f, peso: "400", aire: 1.34,
    });
    ctx.font = `400 ${base.tam}px ${f}`;
    ctx.fillStyle = t.acento;
    ctx.fillText("→", margen, y);
    const lineas = repartirMarcado(ctx, punto, util - sangra, base.tam, f, "400", "400");
    y = pintarMarcado(
      ctx, lineas, margen + sangra, y, base.interlinea, base.tam, f, "400", "400",
      { normal: t.tinta, marcado: t.acento },
    );
  }

  // El pie: filete, «Guarda esto» y el arroba.
  const pie = ALTO - 86;
  ctx.fillStyle = t.tinta;
  ctx.globalAlpha = 0.18;
  ctx.fillRect(margen, pie - 46, util, 2);
  ctx.globalAlpha = 1;

  ctx.font = `700 34px ${f}`;
  ctx.fillStyle = t.tinta;
  ctx.fillText("Guarda esto", margen, pie);
  if (o.marca?.handle?.trim()) {
    ctx.font = `italic 400 34px ${f}`;
    ctx.fillStyle = t.suave;
    const arroba = `@${o.marca.handle.trim()}`;
    ctx.fillText(arroba, ANCHO - margen - ctx.measureText(arroba).width, pie);
  }
}

// ── Modelo 4 · Manchas ──────────────────────────────────────────────────────
//
// El fondo es la marca: manchas orgánicas en las cuatro esquinas, los mismos en
// todas las láminas, con una tarjeta encima. Ni una sola foto — y por eso este
// modelo no depende de nada externo. La portada va sin tarjeta, con el título
// en una serif de display, una pastilla y un pie en versalitas.


/**
 * Una mancha: un círculo al que se le mueven los radios.
 *
 * Los radios van escritos, no sorteados: la referencia usa el MISMO fondo en
 * las seis láminas, y una mancha distinta en cada una convertiría un carrusel
 * en seis cosas sueltas. Un `Math.random()` aquí sería además imposible de
 * repetir al volver a pintar.
 */
function mancha(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  radio: number,
  radios: number[],
  color: string,
) {
  const n = radios.length;
  const punto = (i: number) => {
    const a = (i / n) * Math.PI * 2;
    const r = radio * radios[((i % n) + n) % n];
    return [cx + Math.cos(a) * r, cy + Math.sin(a) * r] as const;
  };
  ctx.fillStyle = color;
  ctx.beginPath();
  const medio = (i: number) => {
    const [x1, y1] = punto(i);
    const [x2, y2] = punto(i + 1);
    return [(x1 + x2) / 2, (y1 + y2) / 2] as const;
  };
  const [mx, my] = medio(n - 1);
  ctx.moveTo(mx, my);
  for (let i = 0; i < n; i++) {
    const [px, py] = punto(i);
    const [nx, ny] = medio(i);
    ctx.quadraticCurveTo(px, py, nx, ny);
  }
  ctx.closePath();
  ctx.fill();
}

/** Tres rayitas, de las que acompañan a un elemento en estos diseños. */
function destellos(ctx: CanvasRenderingContext2D, cx: number, cy: number, color: string, giro = 0) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(giro);
  ctx.strokeStyle = color;
  ctx.lineWidth = 9;
  ctx.lineCap = "round";
  for (const a of [-0.55, 0, 0.55]) {
    ctx.save();
    ctx.rotate(a);
    ctx.beginPath();
    ctx.moveTo(26, 0);
    ctx.lineTo(62, 0);
    ctx.stroke();
    ctx.restore();
  }
  ctx.restore();
}

function fondoManchas(ctx: CanvasRenderingContext2D, t: Tinta, o: Opciones) {
  ctx.fillStyle = t.fondo;
  ctx.fillRect(0, 0, ANCHO, ALTO);

  // Tres tonos distintos, girados desde su acento. Sacados los tres del mismo
  // color salían tres variaciones de lo mismo y el fondo se veía embarrado.
  const suave = mezclarHex(girarTono(t.acento, 28), t.fondo, 0.5);
  const medio = mezclarHex(girarTono(t.acento, -34), t.fondo, 0.28);
  const verde = mezclarHex(girarTono(t.acento, 120), t.fondo, 0.46);

  mancha(ctx, 120, 60, 420, [1, 0.72, 0.95, 0.6, 0.88, 0.7], verde);
  mancha(ctx, 1010, 1180, 400, [0.9, 1, 0.66, 0.92, 0.7, 1], medio);
  mancha(ctx, 60, 1230, 360, [0.8, 1, 0.7, 0.95, 0.62, 0.9], suave);
  mancha(ctx, 1040, 300, 180, [0.9, 0.7, 1, 0.75, 0.95, 0.68], suave);

  if (o.marca?.handle?.trim()) {
    ctx.font = `800 36px ${o.fuentes.redonda}`;
    ctx.fillStyle = mezclarHex(t.fondo, t.tinta, 0.62);
    const texto = `@${o.marca.handle.trim()}`;
    ctx.fillText(texto, (ANCHO - ctx.measureText(texto).width) / 2, 64);
  }
}

function pintarManchas(ctx: CanvasRenderingContext2D, l: Lamina, o: Opciones, t: Tinta, rol: Rol) {
  fondoManchas(ctx, t, o);
  const sans = o.fuentes.redonda;

  if (rol === "portada") {
    const margen = 110;
    const util = ANCHO - margen * 2;
    const h = encajar(ctx, l.titular, util, 460, 140, 70, {
      fuente: o.fuentes.display, peso: "italic 700", aire: 1.02,
    });
    ctx.font = `italic 700 ${h.tam}px ${o.fuentes.display}`;
    ctx.fillStyle = t.tinta;
    let y = 400;
    y = escribir(ctx, h.lineas, margen, y, h.interlinea, "centro", util);

    destellos(ctx, ANCHO - 140, 430, t.acento, -0.5);
    destellos(ctx, 150, 700, t.tinta, Math.PI - 0.4);

    // En la portada la foto va en un círculo grande a un lado, que es como la
    // mete este tipo de diseño cuando la mete.
    if (o.foto) {
      const lado = 300;
      ctx.save();
      ctx.beginPath();
      ctx.arc(ANCHO - 230, 1080, lado / 2, 0, Math.PI * 2);
      ctx.clip();
      llenar(ctx, o.foto, ANCHO - 230 - lado / 2, 1080 - lado / 2, lado, lado);
      ctx.restore();
    }

    if (l.etiqueta?.trim()) {
      // La pastilla: una cápsula de color con el texto en mayúsculas dentro.
      y += 40;
      ctx.font = `600 52px ${sans}`;
      const texto = l.etiqueta.toLocaleUpperCase("es");
      const w = ctx.measureText(texto).width;
      const px = (ANCHO - w - 110) / 2;
      ctx.fillStyle = mezclarHex(t.acento, t.fondo, 0.42);
      caja(ctx, px, y, w + 110, 104, 52);
      ctx.fill();
      ctx.strokeStyle = t.tinta;
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.fillStyle = t.tinta;
      ctx.fillText(texto, px + 55, y + 26);
      y += 150;
    }

    if (l.remate?.trim()) {
      ctx.font = `400 40px ${sans}`;
      ctx.fillStyle = t.tinta;
      espaciado(ctx, l.remate.toLocaleUpperCase("es"), margen, y, 8, "centro", util);
    }
    return;
  }

  // ── Dentro y cierre: la tarjeta ──
  const cx = 100;
  const cy = 240;
  const cw = ANCHO - cx * 2;
  const ch = ALTO - cy - 240;
  const dentro = 60;
  const util = cw - dentro * 2;
  const margen = cx + dentro;

  ctx.fillStyle =
    rol === "cierre"
      ? mezclarHex(t.acento, "#FFFFFF", 0.74)
      : mezclarHex(t.fondo, "#FFFFFF", 0.62);
  caja(ctx, cx, cy, cw, ch, 44);
  ctx.fill();

  // La foto va DENTRO de la tarjeta, arriba y con sus esquinas: detrás de las
  // manchas no se vería, y a sangre taparía el fondo que es la marca.
  //
  // Y se lleva lo que SOBRE, no una altura fija. Con 330 fijos y una lámina
  // con etiqueta, bloque y remate no cabía todo: el remate se salía por debajo
  // de la tarjeta. Primero se reserva lo que el texto necesita de verdad, y la
  // foto entra solo si lo que queda da para verla.
  const paraTexto =
    120 +
    (l.etiqueta?.trim() ? 108 : 0) +
    (l.remate?.trim() ? 128 : 0) +
    ((l.bloque?.trim() || l.cuerpo?.trim() || "").length > 10 ? 170 : 0);
  const sobra = ch - dentro * 2 - paraTexto - 44;
  const altoFoto = o.foto && sobra >= 180 ? Math.min(330, sobra) : 0;
  if (altoFoto) fotoEnCaja(ctx, o.foto!, margen, cy + dentro, util, altoFoto, 28);

  let y = cy + dentro + (altoFoto ? altoFoto + 44 : 0);
  const h = encajar(ctx, l.titular, util, altoFoto ? 150 : 240, 76, 36, {
    fuente: sans, peso: "800", aire: 1.14,
  });
  ctx.font = `800 ${h.tam}px ${sans}`;
  ctx.fillStyle = t.tinta;
  y = escribir(ctx, h.lineas, margen, y, h.interlinea);

  if (l.etiqueta?.trim()) {
    // La etiqueta con su trazo de marcador detrás, inclinada como en la
    // referencia. El trazo se mide sobre el texto, no es una caja fija.
    y += 34;
    ctx.save();
    ctx.font = `700 54px ${o.fuentes.manuscrita}`;
    const texto = l.etiqueta.toLocaleUpperCase("es");
    const w = ctx.measureText(texto).width;
    ctx.translate(margen + w / 2, y + 30);
    ctx.rotate(-0.06);
    marcador(ctx, -w / 2 - 22, -28, w + 44, 62, mezclarHex(t.acento, "#FFFFFF", 0.6));
    ctx.fillStyle = t.tinta;
    ctx.fillText(texto, -w / 2, -26);
    ctx.restore();
    y += 108;
  }

  const bloque = l.bloque?.trim() || l.cuerpo?.trim() || "";
  if (bloque) {
    const reservado = l.remate?.trim() ? 230 : 40;
    const base = encajar(ctx, bloque.replace(/[*]/g, ""), util, cy + ch - y - reservado, 46, 26, {
      fuente: sans, peso: "400", aire: 1.4,
    });
    const lineas = repartirMarcado(ctx, bloque, util, base.tam, sans, "400", "600");
    y = pintarMarcado(
      ctx, lineas, margen, y, base.interlinea, base.tam, sans, "400", "600",
      { normal: t.tinta, marcado: t.tinta }, "centro", util,
    );
  }

  if (l.remate?.trim()) {
    // Clavado dentro de la tarjeta: si el texto de arriba creció, el remate se
    // queda en su sitio en vez de salirse por el borde de abajo.
    y = Math.min(y + 48, cy + ch - 124);
    ctx.font = `800 48px ${sans}`;
    const texto = l.remate.trim();
    const w = Math.min(ctx.measureText(texto).width, util - 40);
    marcador(ctx, margen + (util - w - 72) / 2, y - 14, w + 72, 80, mezclarHex(t.acento, "#FFFFFF", 0.52));
    ctx.fillStyle = t.tinta;
    ctx.fillText(texto, margen + (util - ctx.measureText(texto).width) / 2, y);
  }
}

// ── El despacho ─────────────────────────────────────────────────────────────

const PINTORES: Record<
  Modelo,
  (ctx: CanvasRenderingContext2D, l: Lamina, o: Opciones, t: Tinta, rol: Rol) => void
> = {
  captura: (ctx, l, o, t) => pintarCaptura(ctx, l, o, t),
  minimo: pintarMinimo,
  terminal: pintarTerminal,
  manchas: pintarManchas,
};

/** Qué familias hace falta tener cargadas antes de pintar este modelo. */
export function fuentesDe(modelo: Modelo, f: Fuentes): string[] {
  if (modelo === "captura") return [f.interfaz];
  if (modelo === "minimo") return [f.geometrica, f.manuscrita];
  if (modelo === "terminal") return [f.monoespacio, f.condensada];
  return [f.display, f.redonda, f.manuscrita];
}

export function dibujar(lienzo: HTMLCanvasElement, l: Lamina, o: Opciones): void {
  lienzo.width = ANCHO;
  lienzo.height = ALTO;
  const ctx = lienzo.getContext("2d");
  if (!ctx) return;

  ctx.textBaseline = "top";
  const modelo = BASES[o.modelo] ? o.modelo : "captura";
  PINTORES[modelo](ctx, l, o, tintasDe(modelo, o.paleta), rolDe(l.numero, o.total));
}

export function aPng(lienzo: HTMLCanvasElement): Promise<Blob> {
  return new Promise((listo, falla) =>
    lienzo.toBlob((b) => (b ? listo(b) : falla(new Error("No se pudo crear la imagen."))), "image/png"),
  );
}
