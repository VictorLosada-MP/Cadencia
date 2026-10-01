/**
 * El fotograma que identifica una pieza en "lo hecho".
 *
 * Se saca en el navegador, con el video ya montado delante: el servidor no
 * tiene el archivo y no debería tenerlo. Lo que sube es un JPEG de 180 píxeles
 * de ancho, unos ocho kilobytes, y no un recorte del MP4.
 */

/** Lo bastante grande para reconocerlo en una cuadrícula, y nada más. */
export const PORTADA = { ancho: 180, calidad: 0.62 };

/** Si el video no llega a dar el fotograma, la pieza se apunta sin portada. */
const ESPERA_MS = 8000;

/**
 * Un fotograma del MP4 recién montado.
 *
 * No del segundo cero: el primer fotograma de un reel con carátula es el
 * fondo antes de que entre el título, y muchas cámaras arrancan con un cuadro
 * oscuro. Se toma a un segundo, o antes si el video es más corto que eso.
 */
export async function deVideo(url: string): Promise<string | null> {
  const v = document.createElement("video");
  v.muted = true;
  v.playsInline = true;
  v.preload = "auto";
  v.src = url;

  try {
    await nuevo(v, "loadeddata");
    const cuando = Math.min(1, Math.max(0, (v.duration || 1) * 0.5));
    if (Math.abs(v.currentTime - cuando) > 0.01) {
      v.currentTime = cuando;
      await nuevo(v, "seeked");
    }
    return dibujar(v, v.videoWidth, v.videoHeight);
  } catch {
    return null;
  } finally {
    v.removeAttribute("src");
    v.load();
  }
}

/** La primera lámina del carrusel, que ya está pintada en un lienzo. */
export function deLienzo(lienzo: HTMLCanvasElement): string | null {
  try {
    return dibujar(lienzo, lienzo.width, lienzo.height);
  } catch {
    return null;
  }
}

function dibujar(
  de: CanvasImageSource,
  ancho: number,
  alto: number,
): string | null {
  if (!ancho || !alto) return null;
  const lienzo = document.createElement("canvas");
  lienzo.width = PORTADA.ancho;
  lienzo.height = Math.max(1, Math.round((PORTADA.ancho * alto) / ancho));
  const ctx = lienzo.getContext("2d");
  if (!ctx) return null;
  ctx.drawImage(de, 0, 0, lienzo.width, lienzo.height);
  // Solo el base64: el prefijo "data:" lo vuelve a poner quien lo necesite, y
  // guardarlo en la base de datos serían veintidós bytes por fila a cambio de
  // nada.
  const url = lienzo.toDataURL("image/jpeg", PORTADA.calidad);
  const coma = url.indexOf(",");
  return coma < 0 ? null : url.slice(coma + 1);
}

/** Espera un evento del video, con tope: un archivo roto no cuelga la pantalla. */
function nuevo(v: HTMLVideoElement, evento: string): Promise<void> {
  return new Promise((listo, falla) => {
    const reloj = setTimeout(() => {
      limpiar();
      falla(new Error(`El video no llegó a ${evento}.`));
    }, ESPERA_MS);
    const bien = () => {
      limpiar();
      listo();
    };
    const mal = () => {
      limpiar();
      falla(new Error("El navegador no pudo leer el video."));
    };
    function limpiar() {
      clearTimeout(reloj);
      v.removeEventListener(evento, bien);
      v.removeEventListener("error", mal);
    }
    v.addEventListener(evento, bien, { once: true });
    v.addEventListener("error", mal, { once: true });
  });
}
