/**
 * El fotograma que identifica una pieza en "lo hecho".
 *
 * Se saca en el navegador: el servidor no tiene el archivo y no debería
 * tenerlo. Lo que sube es un JPEG de 180 píxeles de ancho, unos ocho
 * kilobytes, y no un recorte del MP4.
 *
 * El del VIDEO no sale de aquí, sale de ffmpeg al montar (lib/video.ts). Se
 * intentó pintando el MP4 en un <video> y falla en cuanto el navegador no sabe
 * decodificar H.264: devolvía null sin ruido y la ficha quedaba sin fotograma.
 * Aquí solo queda el del carrusel, que ya está pintado en un lienzo.
 */

/** Lo bastante grande para reconocerlo en una cuadrícula, y nada más. */
export const PORTADA = { ancho: 180, calidad: 0.62 };

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
