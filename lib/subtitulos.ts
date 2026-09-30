import { reubicar, type Tramo } from "@/lib/silencios";

/** Una palabra con sus tiempos, como los devuelve la transcripción. */
export type Palabra = {
  palabra: string;
  desde: number;
  hasta: number;
  /**
   * Su sitio en la transcripción original.
   *
   * Es lo que permite que una corrección a mano sobreviva a mover los
   * deslizadores de silencio: los tiempos cambian, el sitio no.
   */
  i?: number;
};

/** Lo que se ve de una vez en pantalla, con las palabras que la componen. */
export type Linea = {
  texto: string;
  desde: number;
  hasta: number;
  /** Los tiempos de cada palabra. Son los que encienden una a una. */
  palabras: Palabra[];
};

/**
 * Cuántas palabras caben de un golpe.
 *
 * Tres, no una frase entera. En vertical y a la altura del pulgar, una línea
 * larga obliga a leer en vez de escuchar, y el video pasa a ser un texto con
 * una cara detrás.
 */
export const MAX_PALABRAS = 3;
/** Y ninguna se queda en pantalla más que esto, aunque sea una sola palabra. */
export const MAX_SEGUNDOS = 2.2;
/** Un hueco mayor que esto entre dos palabras es una frase nueva. */
const CORTE_POR_PAUSA = 0.6;

/**
 * Ensancha los tramos para que ningún corte caiga dentro de una palabra.
 *
 * **Es el arreglo de "se come palabras".** El detector de silencios mira la
 * onda y no sabe qué es una palabra: el arranque de una ese o de una vocal
 * suave queda por debajo del umbral, el corte entra ahí, y en el video se oye
 * media palabra que además pierde su subtítulo porque su tiempo cayó dentro
 * del trozo quitado.
 *
 * Con la transcripción hecha ya se sabe dónde empieza y acaba cada palabra, y
 * entonces la regla es dura: **un corte nunca parte una palabra.** Si lo iba a
 * hacer, el tramo se estira hasta el borde de la palabra.
 *
 * Se llama después de transcribir, así que antes de eso los cortes son los
 * mismos de siempre. Por eso conviene transcribir antes de montar.
 */
export function protegerPalabras(tramos: Tramo[], palabras: Palabra[]): Tramo[] {
  if (palabras.length === 0 || tramos.length === 0) return tramos;

  const estirados = tramos.map((t) => ({ ...t }));

  for (const p of palabras) {
    for (const t of estirados) {
      // La palabra empieza antes del tramo y acaba dentro: se adelanta el
      // arranque hasta el principio de la palabra.
      if (p.desde < t.desde && p.hasta > t.desde) t.desde = Math.min(t.desde, p.desde);
      // Acaba después del tramo y empezó dentro: se alarga el final.
      if (p.hasta > t.hasta && p.desde < t.hasta) t.hasta = Math.max(t.hasta, p.hasta);
    }
  }

  // Estirar puede hacer que dos tramos se toquen o se pisen. Se funden, o el
  // concat de ffmpeg repetiría los fotogramas del solape.
  estirados.sort((a, b) => a.desde - b.desde);
  const juntos: Tramo[] = [];
  for (const t of estirados) {
    const ultimo = juntos[juntos.length - 1];
    if (ultimo && t.desde <= ultimo.hasta + 0.01) ultimo.hasta = Math.max(ultimo.hasta, t.hasta);
    else juntos.push({ ...t });
  }
  return juntos;
}

/**
 * Pasa los tiempos del video original al video ya cortado.
 *
 * Una palabra que cayó entera dentro de un silencio quitado desaparece — y eso
 * es correcto: si no se oye, no se subtitula. Una que quedó a caballo se
 * recorta al trozo que sobrevive, en vez de tirarla: el espectador la oye.
 */
export function reubicarPalabras(palabras: Palabra[], tramos: Tramo[]): Palabra[] {
  const salida: Palabra[] = [];
  for (const p of palabras) {
    const desde = reubicar(p.desde, tramos);
    const hasta = reubicar(p.hasta, tramos);
    if (desde === null && hasta === null) continue;
    const a = desde ?? reubicar(siguienteVivo(p.desde, tramos), tramos);
    const b = hasta ?? reubicar(anteriorVivo(p.hasta, tramos), tramos);
    if (a === null || b === null || b <= a) continue;
    // Se conserva `p` entero —incluido `i`— y solo se cambian los tiempos:
    // sin el sitio, la línea pierde su identidad y una corrección a mano
    // no tiene dónde pegarse.
    salida.push({ ...p, desde: a, hasta: b });
  }
  return salida;
}

/** El primer instante vivo desde t hacia adelante. */
function siguienteVivo(t: number, tramos: Tramo[]): number {
  for (const tr of tramos) if (tr.hasta > t) return Math.max(t, tr.desde);
  return t;
}

/** El último instante vivo desde t hacia atrás. */
function anteriorVivo(t: number, tramos: Tramo[]): number {
  let ultimo = t;
  for (const tr of tramos) if (tr.desde < t) ultimo = Math.min(t, tr.hasta);
  return ultimo;
}

/** Agrupa palabras en líneas cortas, cortando donde el habla se detiene. */
export function enLineas(
  palabras: Palabra[],
  maxPalabras = MAX_PALABRAS,
  maxSegundos = MAX_SEGUNDOS,
): Linea[] {
  const lineas: Linea[] = [];
  let grupo: Palabra[] = [];

  const cerrar = () => {
    if (grupo.length === 0) return;
    lineas.push({
      texto: grupo.map((p) => p.palabra).join(" ").trim(),
      desde: grupo[0].desde,
      hasta: grupo[grupo.length - 1].hasta,
      palabras: grupo,
    });
    grupo = [];
  };

  for (const p of palabras) {
    if (grupo.length > 0) {
      const anterior = grupo[grupo.length - 1];
      const pausa = p.desde - anterior.hasta;
      const largo = p.hasta - grupo[0].desde;
      if (grupo.length >= maxPalabras || pausa > CORTE_POR_PAUSA || largo > maxSegundos) {
        cerrar();
      }
    }
    grupo.push(p);
  }
  cerrar();

  // Dos líneas no pueden solaparse ni pisarse: libass dibujaría las dos encima.
  for (let i = 1; i < lineas.length; i++) {
    if (lineas[i].desde < lineas[i - 1].hasta) lineas[i - 1].hasta = lineas[i].desde;
  }
  return lineas.filter((l) => l.texto && l.hasta > l.desde);
}

/**
 * Rehace una línea que el dueño corrigió a mano.
 *
 * Existe porque la transcripción se come palabras, y hasta ahora lo único que
 * se podía hacer era aguantarse. Si el número de palabras no cambió, se
 * conservan los tiempos originales y solo cambia el texto — que es el caso
 * normal: una tilde, un nombre propio mal oído. Si cambió, el tiempo de la
 * línea se reparte entre las palabras nuevas según lo que ocupa cada una, que
 * es una aproximación honesta: hablamos más rato las palabras largas.
 */
export function rehacerLinea(linea: Linea, texto: string): Linea | null {
  const trozos = texto.trim().split(/\s+/).filter(Boolean);
  if (trozos.length === 0) return null;

  if (trozos.length === linea.palabras.length) {
    const palabras = linea.palabras.map((p, i) => ({ ...p, palabra: trozos[i] }));
    return { ...linea, texto: trozos.join(" "), palabras };
  }

  const total = trozos.reduce((s, t) => s + t.length, 0) || 1;
  const largo = linea.hasta - linea.desde;
  const sitio = linea.palabras[0]?.i;
  let cursor = linea.desde;
  const palabras = trozos.map((t, j) => {
    const dura = (t.length / total) * largo;
    // La primera hereda el sitio de la original: es lo que identifica a la
    // línea, y sin él una segunda corrección sobre la misma línea se perdería.
    const p: Palabra = { palabra: t, desde: cursor, hasta: cursor + dura, ...(j === 0 ? { i: sitio } : {}) };
    cursor += dura;
    return p;
  });
  return { ...linea, texto: trozos.join(" "), palabras };
}

/* ─────────────────────────── El archivo ASS ─────────────────────────── */

/** h:mm:ss.cc, que es lo único que ASS entiende. */
function reloj(t: number): string {
  const seguro = Math.max(0, t);
  const h = Math.floor(seguro / 3600);
  const m = Math.floor((seguro % 3600) / 60);
  const s = Math.floor(seguro % 60);
  const c = Math.floor((seguro * 100) % 100);
  return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}.${String(c).padStart(2, "0")}`;
}

/**
 * Una línea de diálogo ASS no puede llevar saltos ni llaves: `{` abre una
 * etiqueta de estilo y una llave suelta en el texto se come el resto.
 */
function limpiar(t: string): string {
  return t.replace(/[{}\\]/g, "").replace(/\s*\n\s*/g, " ").trim();
}

/**
 * Los tres modos, y qué hace cada uno.
 *
 * No son tres decoraciones: son tres formas distintas de sostener la mirada.
 * El de una palabra es el que más aguanta en vertical, y el que más cansa si
 * el video es largo.
 */
export const ANIMACIONES = [
  {
    id: "palabra" as const,
    nombre: "Palabra a palabra",
    que: "La línea entera se ve, y cada palabra se enciende cuando la dices. Es lo que más se usa en reels.",
  },
  {
    id: "una" as const,
    nombre: "Una sola palabra",
    que: "Solo la palabra que estás diciendo, grande y en el centro. La que más engancha, y la que más cansa si el video es largo.",
  },
  {
    id: "golpe" as const,
    nombre: "Línea de golpe",
    que: "La línea aparece entera de una vez, con un pequeño salto. La más tranquila.",
  },
];

export type Animacion = (typeof ANIMACIONES)[number]["id"];

export type EstiloSubtitulo = {
  alto: number;
  ancho: number;
  /** Qué tan arriba del borde de abajo se sientan. En proporción del alto. */
  margen: number;
  /** El color de la palabra que se está diciendo, en RGB de toda la vida. */
  realce: string;
};

/**
 * Medido sobre tres reels de referencia, no elegido a ojo.
 *
 * En los tres el subtítulo se sienta con su centro al **62–64% del alto** —no
 * abajo del todo— y la altura de las letras es del **2,0 al 2,3% del cuadro**.
 * Lo que había aquí antes estaba al 78% y al doble de tamaño: quedaba bajo,
 * gordo y encima de donde Instagram pone sus botones.
 */
export const ESTILO: EstiloSubtitulo = {
  ancho: 1080,
  alto: 1920,
  // Distancia desde abajo. El centro del texto cae así al 63% del alto.
  margen: 0.35,
  realce: "#FFD400",
};

/**
 * El cuerpo del tipo, en píxeles.
 *
 * 3,2% del alto da una altura de letra del 2,2% — justo lo medido en las tres
 * referencias. Lo que había antes era el 5%, más del doble, y se comía el
 * cuadro. La palabra suelta va mayor porque no tiene nada al lado con que
 * compararse.
 */
function cuerpoDe(animacion: Animacion, alto: number): number {
  // 4% del alto. Se llegó midiendo: con 3,2% la letra salía al 1,7% del
  // cuadro y las referencias están entre el 2,0 y el 2,3.
  return Math.round(alto * (animacion === "una" ? 0.068 : 0.04));
}

/** ASS guarda el color al revés: &HBBGGRR&. Un #RRGGBB pasa a eso. */
function aColorASS(hex: string): string {
  const h = hex.replace("#", "").padEnd(6, "0");
  return `&H00${h.slice(4, 6)}${h.slice(2, 4)}${h.slice(0, 2)}`.toUpperCase() + "&";
}

const BLANCO = "&H00FFFFFF&";
const NEGRO = "&H00000000&";

/**
 * El guion de subtítulos, en ASS y no en SRT.
 *
 * SRT no lleva ni estilo ni tiempo por palabra: el reproductor decide, y aquí
 * no hay reproductor porque las letras se queman en el video. ASS lleva
 * tipografía, contorno, posición y —lo que hace falta para que se muevan—
 * etiquetas dentro de la propia línea.
 */
/**
 * La carátula de entrada.
 *
 * Los tres reels de referencia abren igual: el gancho en grande sobre una
 * imagen, dos o tres renglones, la línea que remata en otro color. Dura poco
 * —menos de dos segundos— y es lo que decide si alguien se queda.
 */
export type Caratula = { texto: string; hasta: number };

/** Cuánto se queda. Medido: en las referencias, entre 1,5 y 2 segundos. */
export const CARATULA_S = 1.8;

/** Parte el gancho en renglones cortos, sin cortar palabras. */
function enRenglones(texto: string, porRenglon = 22): string[] {
  const salida: string[] = [];
  let linea = "";
  for (const w of limpiar(texto).split(/\s+/)) {
    if (linea && (linea + " " + w).length > porRenglon) {
      salida.push(linea);
      linea = w;
    } else {
      linea = linea ? `${linea} ${w}` : w;
    }
  }
  if (linea) salida.push(linea);
  // Cuatro renglones ya es un párrafo, y un párrafo no es un gancho.
  return salida.slice(0, 4);
}

export function aASS(
  lineas: Linea[],
  animacion: Animacion = "palabra",
  estilo: EstiloSubtitulo = ESTILO,
  caratula?: Caratula | null,
): string {
  const base = cuerpoDe(animacion, estilo.alto);
  const contorno = Math.max(2, Math.round(base * 0.13));
  const margenV = Math.round(estilo.alto * estilo.margen);
  const margenH = Math.round(estilo.ancho * 0.08);
  const realce = aColorASS(estilo.realce);

  const cabecera = [
    "[Script Info]",
    "ScriptType: v4.00+",
    "WrapStyle: 0",
    "ScaledBorderAndShadow: yes",
    `PlayResX: ${estilo.ancho}`,
    `PlayResY: ${estilo.alto}`,
    "",
    "[V4+ Styles]",
    "Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding",
    // Alignment 2 = abajo y centrado. El margen vertical lo sube hasta donde
    // la interfaz de Instagram no le pone encima los botones.
    `Style: Voz,Outfit,${base},${BLANCO},${BLANCO},${NEGRO},&H64000000,-1,0,0,0,100,100,0,0,1,${contorno},${Math.round(contorno * 0.8)},2,${margenH},${margenH},${margenV},1`,
    "",
    // La carátula tiene su propio estilo: más grande, centrada en el cuadro
    // (Alignment 5) y con el contorno más grueso para que aguante encima de
    // cualquier foto.
    `Style: Gancho,Outfit,${Math.round(estilo.alto * 0.062)},${BLANCO},${BLANCO},${NEGRO},&H96000000,-1,0,0,0,100,100,0,0,1,${Math.round(contorno * 1.6)},${contorno},5,${margenH},${margenH},0,1`,
    "",
    "[Events]",
    "Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text",
  ];

  const evento = (desde: number, hasta: number, texto: string) =>
    `Dialogue: 0,${reloj(desde)},${reloj(hasta)},Voz,,0,0,0,,${texto}`;

  const eventos: string[] = [];

  if (caratula?.texto.trim()) {
    const renglones = enRenglones(caratula.texto);
    // El último renglón va en el color de realce: es el que remata la idea,
    // y es lo que hacen las tres referencias.
    const cuerpo = renglones
      .map((r, i) => (i === renglones.length - 1 ? `{\\c${realce}}${r}` : r))
      .join("\\N");
    eventos.push(
      `Dialogue: 1,${reloj(0)},${reloj(caratula.hasta)},Gancho,,0,0,0,,` +
        // Entra creciendo y se va con un desvanecido: sin movimiento parece
        // una marca de agua, no una entrada.
        `{\\fad(0,220)\\fscx88\\fscy88\\t(0,180,\\fscx100\\fscy100)}${cuerpo}`,
    );
  }

  for (const l of lineas) {
    // Mientras está la carátula no hay subtítulo: dos textos a la vez sobre
    // la misma imagen no se lee ninguno.
    if (caratula && l.hasta <= caratula.hasta) continue;

    const ps = l.palabras.length ? l.palabras : [{ palabra: l.texto, desde: l.desde, hasta: l.hasta }];

    if (animacion === "golpe") {
      // Entra con un saltito y se va con un desvanecido corto. \t interpola
      // entre dos estados; \fad hace la entrada y la salida.
      eventos.push(
        evento(l.desde, l.hasta, `{\\fad(70,60)\\fscx86\\fscy86\\t(0,130,\\fscx100\\fscy100)}${limpiar(l.texto)}`),
      );
      continue;
    }

    if (animacion === "una") {
      // Una palabra por evento, y cada una entra con su propio golpe.
      ps.forEach((p, i) => {
        const fin = i + 1 < ps.length ? ps[i + 1].desde : l.hasta;
        if (fin <= p.desde) return;
        eventos.push(
          evento(
            p.desde,
            fin,
            `{\\fad(40,0)\\fscx78\\fscy78\\t(0,110,\\fscx104\\fscy104)\\t(110,180,\\fscx100\\fscy100)\\c${realce}}${limpiar(p.palabra)}`,
          ),
        );
      });
      continue;
    }

    // "palabra": la línea entera se queda quieta y va encendiendo una a una.
    // Un evento por palabra con el resto en blanco — más fiable que el
    // karaoke \k, que depende de que el reproductor lo entienda, y aquí el
    // reproductor es libass quemando píxeles.
    ps.forEach((p, i) => {
      const fin = i + 1 < ps.length ? ps[i + 1].desde : l.hasta;
      if (fin <= p.desde) return;
      const texto = ps
        .map((q, j) =>
          j === i
            ? `{\\c${realce}\\fscx112\\fscy112}${limpiar(q.palabra)}{\\c${BLANCO}\\fscx100\\fscy100}`
            : limpiar(q.palabra),
        )
        .join(" ");
      // El desvanecido solo en la primera palabra: uno por palabra parpadea.
      eventos.push(evento(p.desde, fin, (i === 0 ? "{\\fad(70,0)}" : "") + texto));
    });
  }

  return [...cabecera, ...eventos].join("\n") + "\n";
}
