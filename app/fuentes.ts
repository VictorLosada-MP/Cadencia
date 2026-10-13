import { Patrick_Hand } from "next/font/google";

/**
 * La letra a mano del estilo «cuaderno».
 *
 * Patrick Hand y no una cursiva de verdad porque la lámina se lee de reojo en
 * un teléfono: una cursiva enlazada se parece más a la referencia y se lee
 * peor, y en un carrusel lo que no se lee de un vistazo no existe. Esta es
 * manuscrita de imprenta — se nota que está escrita a mano y se lee a 24
 * píxeles.
 *
 * Se declara aquí, en la capa de la aplicación, porque `next/font` genera el
 * nombre de familia al compilar. `lib/lamina.ts` lo recibe como parámetro: así
 * el motor de dibujo no depende de Next ni de una fuente concreta.
 */
export const manuscrita = Patrick_Hand({
  weight: "400",
  subsets: ["latin"],
  display: "swap",
});

/**
 * Espera a que la fuente esté cargada de verdad.
 *
 * Sin esto el canvas pinta con la de palo y no avisa: `drawImage` y `fillText`
 * no esperan a nada. Se pide un tamaño cualquiera porque lo que se carga es la
 * familia, no el cuerpo.
 */
export async function esperarFuente(familia: string): Promise<void> {
  try {
    const primera = familia.split(",")[0]?.trim();
    if (!primera) return;
    await document.fonts.load(`400 48px ${primera}`);
    await document.fonts.ready;
  } catch {
    // Si el navegador no tiene la API, se pinta con lo que haya.
  }
}
