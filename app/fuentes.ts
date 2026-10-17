import {
  Caveat,
  Inter,
  JetBrains_Mono,
  Montserrat,
  Oswald,
  Playfair_Display,
  Poppins,
} from "next/font/google";

/**
 * Las tipografías de los modelos de carrusel.
 *
 * Una por modelo, y no por gusto: la letra ES media mitad de lo que hace que
 * un modelo se reconozca. El de la captura de red social con una serif no
 * parece una captura, y el del terminal sin monoespacio no dice «esto se
 * copia tal cual».
 *
 * Todas son de Google Fonts, así que no cuestan nada y `next/font` las
 * autoaloja al compilar: no se le pide un archivo a nadie al abrir la página.
 *
 * Se declaran aquí, en la capa de la aplicación, porque `next/font` genera el
 * nombre de familia al compilar. `lib/lamina.ts` las recibe como parámetro:
 * así el motor de dibujo no depende de Next ni de una fuente concreta.
 */

/** Modelo «Captura»: la sans de interfaz, como la de una app. */
export const interfaz = Inter({ subsets: ["latin"], weight: ["400", "600", "700"] });

/** Modelo «Mínimo»: geométrica, de versalitas espaciadas y números enormes. */
export const geometrica = Montserrat({ subsets: ["latin"], weight: ["400", "500", "700", "900"] });

/** Modelo «Terminal»: monoespacio, titulares incluidos. */
export const monoespacio = JetBrains_Mono({ subsets: ["latin"], weight: ["400", "700"] });

/** Y su portada, que va en condensada de mucho peso sobre la foto. */
export const condensada = Oswald({ subsets: ["latin"], weight: ["500", "700"] });

/** Modelo «Manchas»: la serif de display del título. */
export const display = Playfair_Display({ subsets: ["latin"], weight: ["700"], style: ["italic"] });

/** Y su sans redonda para el cuerpo. */
export const redonda = Poppins({ subsets: ["latin"], weight: ["400", "600", "800"] });

/** La manuscrita: la firma del «Mínimo» y la palabra suelta del «Manchas». */
export const manuscrita = Caveat({ subsets: ["latin"], weight: ["400", "700"] });

/** Lo que el motor de dibujo necesita saber de las letras. */
export type Fuentes = {
  interfaz: string;
  geometrica: string;
  monoespacio: string;
  condensada: string;
  display: string;
  redonda: string;
  manuscrita: string;
};

export const FUENTES: Fuentes = {
  interfaz: interfaz.style.fontFamily,
  geometrica: geometrica.style.fontFamily,
  monoespacio: monoespacio.style.fontFamily,
  condensada: condensada.style.fontFamily,
  display: display.style.fontFamily,
  redonda: redonda.style.fontFamily,
  manuscrita: manuscrita.style.fontFamily,
};

/**
 * Espera a que las letras estén cargadas de verdad antes de pintar.
 *
 * Sin esto el canvas pinta con la de palo y no avisa: `fillText` no espera a
 * nada. Se piden los dos pesos que de verdad se usan de cada una, porque
 * `document.fonts.ready` sola no garantiza que una familia que todavía no se
 * ha pintado esté descargada.
 */
export async function esperarFuentes(familias: string[]): Promise<void> {
  try {
    await Promise.all(
      familias.flatMap((f) => {
        const primera = f.split(",")[0]?.trim();
        if (!primera) return [];
        return [
          document.fonts.load(`400 48px ${primera}`),
          document.fonts.load(`700 48px ${primera}`),
        ];
      }),
    );
    await document.fonts.ready;
  } catch {
    // Si el navegador no tiene la API, se pinta con lo que haya.
  }
}
