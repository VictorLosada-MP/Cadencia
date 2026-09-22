/**
 * Las verificaciones mecánicas de una pieza. Todas corren en el navegador: el
 * video no sale de la máquina de su dueño, no cuesta un centavo y no gasta
 * cuota.
 *
 * Esto NO opina sobre el contenido. Mide lo que se mide: proporción, duración,
 * dónde hay silencio, si el audio se oye, si el primer fotograma está negro.
 * El criterio de si una pieza merece publicarse es de su dueño; lo que aquí se
 * comprueba es que nada mecánico la esté estropeando.
 */

export type Estado = "pasa" | "revisa" | "falla" | "sin-dato";

export type Chequeo = {
  id: string;
  titulo: string;
  estado: Estado;
  detalle: string;
  /** Qué hacer si no pasa. Vacío cuando pasa. */
  arreglo?: string;
};

export type Tramo = { desde: number; hasta: number };

export type Medidas = {
  ancho: number;
  alto: number;
  duracion: number;
  /** Nivel medio por ventana de 20 ms, normalizado al pico. */
  niveles: number[];
  silencios: Tramo[];
  /** Segundos hasta que se oye algo. */
  arranqueAudio: number | null;
  picoMax: number;
  /** Luminancia media del primer fotograma, 0 a 1. */
  luzPrimerFotograma: number | null;
  /**
   * "no" es un hecho: el archivo no trae pista. "ilegible" es un límite
   * nuestro: el navegador no supo decodificarla. Confundirlos sería decirle
   * que su video no tiene audio cuando sí lo tiene.
   */
  audio: "si" | "no" | "ilegible";
};

export const VENTANA_MS = 20;
/** Por debajo de esta fracción del pico, se considera silencio. */
export const UMBRAL_SILENCIO = 0.06;
/** Un silencio más largo que esto se nota al ver la pieza. */
export const SILENCIO_LARGO_S = 0.6;

const NUEVE_DIECISEIS = 9 / 16;

export function segundos(s: number): string {
  const m = Math.floor(s / 60);
  const r = s - m * 60;
  return m > 0 ? `${m}:${r.toFixed(1).padStart(4, "0")}` : `${r.toFixed(1)}s`;
}

/** Niveles por ventana, normalizados al pico de la propia pieza. */
export function medirNiveles(datos: Float32Array, muestreo: number) {
  const porVentana = Math.max(1, Math.round((muestreo * VENTANA_MS) / 1000));
  const niveles: number[] = [];
  let pico = 0;

  for (let i = 0; i < datos.length; i += porVentana) {
    let suma = 0;
    const fin = Math.min(i + porVentana, datos.length);
    for (let j = i; j < fin; j++) suma += datos[j] * datos[j];
    const rms = Math.sqrt(suma / (fin - i));
    niveles.push(rms);
    if (rms > pico) pico = rms;
  }

  // El umbral es relativo a su propio pico, no un valor absoluto: una pieza
  // grabada bajito no es una pieza muda.
  return { niveles: pico > 0 ? niveles.map((n) => n / pico) : niveles, pico };
}

export function buscarSilencios(niveles: number[]): Tramo[] {
  const tramos: Tramo[] = [];
  let inicio: number | null = null;

  for (let i = 0; i <= niveles.length; i++) {
    const callado = i < niveles.length && niveles[i] < UMBRAL_SILENCIO;
    if (callado && inicio === null) inicio = i;
    if (!callado && inicio !== null) {
      const desde = (inicio * VENTANA_MS) / 1000;
      const hasta = (i * VENTANA_MS) / 1000;
      if (hasta - desde >= SILENCIO_LARGO_S) tramos.push({ desde, hasta });
      inicio = null;
    }
  }
  return tramos;
}

export function primerSonido(niveles: number[]): number | null {
  const i = niveles.findIndex((n) => n >= UMBRAL_SILENCIO);
  return i < 0 ? null : (i * VENTANA_MS) / 1000;
}

/**
 * Los chequeos, a partir de las medidas. Es una función pura: las mismas
 * medidas dan siempre los mismos chequeos.
 */
export function revisar(m: Medidas, guion?: { palabras: number }): Chequeo[] {
  const chequeos: Chequeo[] = [];
  const proporcion = m.alto > 0 ? m.ancho / m.alto : 0;

  // 1 · Proporción
  const desvio = Math.abs(proporcion - NUEVE_DIECISEIS) / NUEVE_DIECISEIS;
  chequeos.push(
    desvio < 0.02
      ? {
          id: "proporcion",
          titulo: "9:16",
          estado: "pasa",
          detalle: `${m.ancho}×${m.alto}`,
        }
      : {
          id: "proporcion",
          titulo: "9:16",
          estado: "falla",
          detalle: `${m.ancho}×${m.alto} — es ${proporcion.toFixed(3)} y 9:16 es 0,563`,
          arreglo:
            proporcion > NUEVE_DIECISEIS
              ? "Está horizontal o cuadrado. Recórtalo a vertical: en el móvil se ve con franjas y ocupa la mitad."
              : "Es más estrecho que 9:16 y va a salir con franjas a los lados.",
        },
  );

  // 2 · Resolución
  chequeos.push(
    m.alto >= 1920
      ? { id: "resolucion", titulo: "Resolución", estado: "pasa", detalle: `${m.alto}p de alto` }
      : m.alto >= 1280
        ? {
            id: "resolucion",
            titulo: "Resolución",
            estado: "revisa",
            detalle: `${m.alto} de alto — se ve, pero no es lo que da el teléfono`,
            arreglo: "Exporta a 1080×1920 si tu editor te deja.",
          }
        : {
            id: "resolucion",
            titulo: "Resolución",
            estado: "falla",
            detalle: `${m.alto} de alto`,
            arreglo: "Por debajo de 1280 el texto en pantalla se lee mal en un teléfono.",
          },
  );

  // 3 · Audio presente
  if (m.audio === "no") {
    chequeos.push({
      id: "audio",
      titulo: "Audio",
      estado: "falla",
      detalle: "el archivo no trae pista de audio",
      arreglo: "Vuelve a exportar con el audio incluido.",
    });
    return chequeos;
  }
  if (m.audio === "ilegible") {
    chequeos.push({
      id: "audio",
      titulo: "Audio",
      estado: "sin-dato",
      detalle: "este navegador no supo leer la pista de audio, así que no la reviso",
      arreglo: "Pruébalo en Chrome, o exporta el video como MP4.",
    });
    // Sin poder leer el audio no se puede decir nada del arranque, del nivel ni
    // de los silencios. Callarse es más honesto que adivinar.
    return chequeos;
  }

  // 4 · Arranque del audio
  const arranque = m.arranqueAudio;
  chequeos.push(
    arranque === null
      ? {
          id: "arranque",
          titulo: "Arranca hablando",
          estado: "falla",
          detalle: "no se oye nada en toda la pieza",
          arreglo: "Revisa que el micrófono estuviera grabando.",
        }
      : arranque <= 0.4
        ? {
            id: "arranque",
            titulo: "Arranca hablando",
            estado: "pasa",
            detalle: `se oye desde ${segundos(arranque)}`,
          }
        : {
            id: "arranque",
            titulo: "Arranca hablando",
            estado: "falla",
            detalle: `el primer sonido llega a ${segundos(arranque)}`,
            arreglo:
              "Corta ese arranque mudo. En los primeros segundos se decide si se quedan, y ahí no estás diciendo nada.",
          },
  );

  // 5 · Nivel
  chequeos.push(
    m.picoMax < 0.05
      ? {
          id: "nivel",
          titulo: "Se oye",
          estado: "falla",
          detalle: "el audio está muy bajo",
          arreglo: "Normaliza el volumen: en un teléfono, en la calle, esto no se oye.",
        }
      : m.picoMax > 0.99
        ? {
            id: "nivel",
            titulo: "Se oye",
            estado: "revisa",
            detalle: "el audio llega al techo y puede estar saturando",
            arreglo: "Baja un par de decibelios para que no distorsione.",
          }
        : { id: "nivel", titulo: "Se oye", estado: "pasa", detalle: "nivel correcto" },
  );

  // 6 · Silencios
  const largos = m.silencios.filter((s) => s.hasta - s.desde >= SILENCIO_LARGO_S);
  const interiores = largos.filter((s) => s.desde > 0.4 && s.hasta < m.duracion - 0.3);
  chequeos.push(
    interiores.length === 0
      ? { id: "silencios", titulo: "Sin baches", estado: "pasa", detalle: "no hay silencios largos" }
      : {
          id: "silencios",
          titulo: "Sin baches",
          estado: "revisa",
          detalle: `${interiores.length} ${
            interiores.length === 1 ? "silencio" : "silencios"
          } de más de ${SILENCIO_LARGO_S}s: ${interiores
            .slice(0, 6)
            .map((s) => segundos(s.desde))
            .join(", ")}${interiores.length > 6 ? "…" : ""}`,
          arreglo: "Córtalos. Cada bache es una oportunidad de que se vayan.",
        },
  );

  // 7 · Primer fotograma
  if (m.luzPrimerFotograma !== null) {
    chequeos.push(
      m.luzPrimerFotograma > 0.06
        ? { id: "primer-fotograma", titulo: "Abre con imagen", estado: "pasa", detalle: "el primer fotograma tiene imagen" }
        : {
            id: "primer-fotograma",
            titulo: "Abre con imagen",
            estado: "falla",
            detalle: "el primer fotograma está en negro",
            arreglo: "Quita ese negro del principio: parece que el video no cargó.",
          },
    );
  }

  // 8 · Duración contra el guion
  if (guion && guion.palabras > 0) {
    const esperada = guion.palabras / 2.5;
    const diferencia = Math.abs(m.duracion - esperada) / esperada;
    chequeos.push(
      diferencia <= 0.25
        ? {
            id: "duracion",
            titulo: "Cuadra con el guion",
            estado: "pasa",
            detalle: `${segundos(m.duracion)} — el guion daba ${segundos(esperada)}`,
          }
        : {
            id: "duracion",
            titulo: "Cuadra con el guion",
            estado: "revisa",
            detalle: `${segundos(m.duracion)} contra los ${segundos(esperada)} que daba el guion`,
            arreglo:
              m.duracion > esperada
                ? "Sobra metraje: o hay pausas largas o se dijo más de lo escrito."
                : "Falta: o se habló muy rápido o se quedó algo del guion sin decir.",
          },
    );
  } else {
    chequeos.push({
      id: "duracion",
      titulo: "Cuadra con el guion",
      estado: "sin-dato",
      detalle: `${segundos(m.duracion)} — pega el guion para comparar`,
    });
  }

  return chequeos;
}

export function veredicto(chequeos: Chequeo[]): {
  publicable: boolean;
  fallan: number;
  revisar: number;
} {
  const fallan = chequeos.filter((c) => c.estado === "falla").length;
  const revisar = chequeos.filter((c) => c.estado === "revisa").length;
  return { publicable: fallan === 0, fallan, revisar };
}
