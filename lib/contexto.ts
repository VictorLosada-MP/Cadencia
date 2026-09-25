import { ultimaCorrida } from "@/lib/historial";
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

  // Si no declaró un CTA en su negocio, se usa el que ya se leyó de su propio
  // perfil en el último diagnóstico. El sistema ya tenía el dato: pedírselo
  // otra vez es hacerle escribir dos veces lo mismo.
  let accion = perfil.nucleo.accion?.texto?.trim() ?? "";
  let accionLeida = false;
  if (!accion && negocioId) {
    const ultima = await ultimaCorrida(negocioId, 1);
    const redes = (ultima?.entrada as { redes?: { casillas?: { cta?: string } }[] })?.redes ?? [];
    const visto = redes.map((r) => r.casillas?.cta?.trim()).find(Boolean);
    if (visto) {
      accion = visto;
      accionLeida = true;
    }
  }

  return {
    estable: [
      "## Perfil de Negocio",
      JSON.stringify({ ...perfil, nucleo }, null, 2),
      voz ? `\n## Muestras de voz\n\n${voz}` : "\n## Muestras de voz\n\n(ninguna)",
      accion
        ? `\n## Su llamada a la acción\n\n«${accion}»${
            accionLeida ? " — leída de su propio perfil, no declarada por él" : ""
          }`
        : "",
    ].join("\n"),
    voz,
    senales,
    accion,
    negocioId,
  };
}
