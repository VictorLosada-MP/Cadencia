import { cargarContexto, FaltaNegocio } from "@/lib/contexto";
import { revisarCuota } from "@/lib/cuota";
import { extraerJSON, generar } from "@/lib/modelo";
import { usuarioActual } from "@/lib/negocio";
import { cargarPrompt } from "@/lib/perfil";

export const maxDuration = 300;

const MAX_BLOQUES = 8;
const MAX_LARGO = 600;

type Salida = {
  apoyos: { i: number; apoyo: string; apoyo_tuyo?: boolean }[];
  limites?: string[];
};

/**
 * Qué se ve encima de cada bloque de un video que YA está grabado.
 *
 * Es la única parte de "ya lo tengo grabado" que no sale de su propia voz: los
 * cortes, los subtítulos, la carátula, el ritmo y las transiciones salen de la
 * transcripción sin pedirle nada a ningún modelo. Lo que no se puede deducir de
 * lo que dijo es qué imagen va encima, y para eso está esto.
 *
 * No guarda corrida y por tanto no gasta cuota. Dos razones: la pieza la
 * escribió él, no el sistema —cobrar por mirarla sería cobrar por su trabajo—,
 * y guardarla como corrida de función 3 pisaría en /publicar la pieza que sí
 * escribió en el paso 3. Sí se mira que le quede cuota, como en los demás
 * pasos intermedios.
 */
export async function POST(request: Request) {
  const usuario = await usuarioActual();
  if (!usuario) return Response.json({ error: "Entra a tu cuenta." }, { status: 401 });

  let cuerpo: { bloques?: string[] };
  try {
    cuerpo = await request.json();
  } catch {
    return Response.json({ error: "Cuerpo inválido." }, { status: 400 });
  }

  const bloques = (cuerpo.bloques ?? [])
    .map((b) => String(b ?? "").trim().slice(0, MAX_LARGO))
    .filter(Boolean)
    .slice(0, MAX_BLOQUES);

  if (!bloques.length) {
    return Response.json({ error: "No hay nada transcrito todavía." }, { status: 400 });
  }

  try {
    const contexto = await cargarContexto(usuario.id);

    const permiso = await revisarCuota(usuario.id, contexto.negocioId);
    if (!permiso.ok) {
      return Response.json(
        { error: permiso.mensaje, cuota: permiso.cuota, agotada: true },
        { status: 402 },
      );
    }

    const instrucciones = await cargarPrompt("3-apoyos.md");
    const texto = [
      "## Lo que dijo, por bloques",
      "",
      ...bloques.map((b, i) => `${i}. ${b}`),
      "",
      "Devuelve solo el JSON.",
    ].join("\n");

    const r = await generar({ sistema: instrucciones, estable: contexto.estable, texto });
    const salida = extraerJSON<Salida>(r.texto);

    // Se devuelve uno por bloque y en orden, pase lo que pase: la pantalla los
    // casa por posición, y un hueco le correría las imágenes de sitio.
    const porSitio = new Map((salida.apoyos ?? []).map((a) => [Number(a.i), a]));
    const apoyos = bloques.map((_, i) => ({
      apoyo: String(porSitio.get(i)?.apoyo ?? "").trim(),
      apoyo_tuyo: Boolean(porSitio.get(i)?.apoyo_tuyo),
    }));

    return Response.json({
      apoyos,
      limites: salida.limites ?? [],
      meta: { proveedor: r.proveedor, modelo: r.modelo, uso: r.uso },
    });
  } catch (e) {
    if (e instanceof FaltaNegocio) {
      return Response.json({ error: e.message }, { status: 400 });
    }
    console.error("apoyos:", e instanceof Error ? e.message : e);
    return Response.json(
      { error: "No se pudieron sacar las imágenes. Vuelve a intentarlo." },
      { status: 500 },
    );
  }
}
