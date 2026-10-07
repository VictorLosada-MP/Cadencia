import { ultimaCorrida } from "@/lib/historial";
import { negocioDe } from "@/lib/negocio";
import { perfilDesdeNegocio } from "@/lib/perfil";

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

/**
 * El contexto de ESTA cuenta. No hay otra fuente.
 *
 * Existió un «perfil semilla» que leía un negocio de ejemplo del repositorio,
 * para probar el sistema sin llenar nada. Se quitó entero: en un producto
 * desplegado, eso le ofrecía a un desconocido diagnosticarse contra el negocio
 * de otro. No era una comodidad de desarrollo con un interruptor, era una
 * puerta — y una puerta que existe se acaba abriendo.
 */
export async function cargarContexto(usuarioId: string): Promise<Contexto> {
  const guardado = await negocioDe(usuarioId);
  if (!guardado) throw new FaltaNegocio();
  const perfil = perfilDesdeNegocio(guardado);
  const voz = guardado.voz?.trim() ?? "";
  const senales = guardado.senales?.trim() ?? "";
  const negocioId: string | null = guardado.id;

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
