/**
 * Fotos de archivo, gratis.
 *
 * Pexels: su API no cuesta nada, las fotos se pueden usar comercialmente y no
 * hay que dar crédito. Sale de sus propios apuntes, donde ya estaba anotado
 * como el banco de B-roll.
 *
 * Lo que NO hace esto: generar imágenes. Eso es otro proveedor y cuesta por
 * lámina. Esto busca entre fotos que ya existen.
 */

export type Foto = {
  id: number;
  /** Para dibujarla: se pide por el proxy, no directo. */
  url: string;
  /** Para verla en la rejilla, pequeña. */
  mini: string;
  autor: string;
  /** La ficha en Pexels. Se enseña porque es de alguien. */
  origen: string;
  alto: number;
  ancho: number;
};

const API = "https://api.pexels.com/v1/search";

export function hayFotos(): boolean {
  return Boolean(process.env.PEXELS_API_KEY);
}

export async function buscarFotos(
  consulta: string,
  orientacion: "portrait" | "landscape" | "square" = "landscape",
): Promise<Foto[]> {
  const clave = process.env.PEXELS_API_KEY;
  if (!clave) throw new Error("Falta PEXELS_API_KEY.");

  const url = new URL(API);
  url.searchParams.set("query", consulta.slice(0, 120));
  url.searchParams.set("per_page", "8");
  url.searchParams.set("orientation", orientacion);
  // Pexels indexa en inglés, pero acepta consultas en español si se le dice.
  url.searchParams.set("locale", "es-ES");

  const r = await fetch(url, {
    headers: { Authorization: clave },
    signal: AbortSignal.timeout(12_000),
  });
  if (!r.ok) throw new Error(`Pexels respondió ${r.status}.`);

  const d = (await r.json()) as {
    photos?: {
      id: number;
      width: number;
      height: number;
      url: string;
      photographer: string;
      src: { large2x?: string; large?: string; medium?: string; tiny?: string };
    }[];
  };

  return (d.photos ?? []).map((f) => ({
    id: f.id,
    url: f.src.large2x ?? f.src.large ?? f.src.medium ?? "",
    mini: f.src.medium ?? f.src.tiny ?? "",
    autor: f.photographer,
    origen: f.url,
    ancho: f.width,
    alto: f.height,
  }));
}

/** Los dominios de los que este servidor acepta traer una imagen. */
export function esDePexels(url: string): boolean {
  try {
    return new URL(url).hostname.endsWith("pexels.com");
  } catch {
    return false;
  }
}
