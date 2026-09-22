import { negocioDe } from "@/lib/negocio";
import { cargarPerfil, perfilDesdeNegocio } from "@/lib/perfil";

/**
 * El contexto que leen todas las funciones: el Perfil de Negocio y las muestras
 * de voz, ya armados para el modelo.
 *
 * Vive en un solo sitio porque las cuatro funciones lo necesitan igual, y
 * porque el bloque `estable` es el que lleva marca de caché: si cada ruta lo
 * construyera a su manera, dejarían de compartir prefijo y el caché no serviría.
 */
export type Contexto = {
  /** El bloque caro que no cambia entre corridas. Va con marca de caché. */
  estable: string;
  voz: string;
  senales: string;
  accion: string;
  /** null cuando se corrió con un perfil semilla del repositorio. */
  negocioId: string | null;
};

export class FaltaNegocio extends Error {
  constructor() {
    super("Llena primero tu negocio: qué vendes, a quién le sirve y cómo queda después.");
  }
}

export async function cargarContexto(
  usuarioId: string,
  perfilId?: string,
): Promise<Contexto> {
  let perfil, voz, senales = "";
  let negocioId: string | null = null;

  if (perfilId) {
    ({ perfil, voz } = await cargarPerfil(perfilId));
  } else {
    const guardado = await negocioDe(usuarioId);
    if (!guardado) throw new FaltaNegocio();
    perfil = perfilDesdeNegocio(guardado);
    voz = guardado.voz?.trim() ?? "";
    senales = guardado.senales?.trim() ?? "";
    negocioId = guardado.id;
  }

  // La voz va aparte y en crudo; dentro del JSON solo estorbaría su ruta.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { voz: _fuente, ...nucleo } = perfil.nucleo;

  return {
    estable: [
      "## Perfil de Negocio",
      JSON.stringify({ ...perfil, nucleo }, null, 2),
      voz ? `\n## Muestras de voz\n\n${voz}` : "\n## Muestras de voz\n\n(ninguna)",
    ].join("\n"),
    voz,
    senales,
    accion: perfil.nucleo.accion?.texto?.trim() ?? "",
    negocioId,
  };
}
