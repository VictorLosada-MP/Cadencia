import { cargarContexto, FaltaNegocio } from "@/lib/contexto";
import { revisarCuota } from "@/lib/cuota";
import { extraerJSON, generar } from "@/lib/modelo";
import { usuarioActual } from "@/lib/negocio";
import { cargarPrompt } from "@/lib/perfil";
import type { Historia, QuienCuenta } from "@/types/banco";

export const maxDuration = 300;

/** Lo más largo que se acepta en crudo. Un reel no sale de más que esto. */
const MAX = 6000;
/** Por debajo de esto no hay historia que ordenar, hay un título. */
const MINIMO = 25;

type Cuerpo = {
  crudo: string;
  quien?: QuienCuenta;
  idea?: string;
  angulo?: string;
};

/**
 * Le ordena la historia que acaba de escribir. No la inventa.
 *
 * No guarda corrida y por tanto no gasta cuota: ordenar un párrafo es un paso
 * intermedio dentro de escribir una pieza, y cobrarle una corrida por él haría
 * que un día de historia valiera el doble que los otros cuatro. Sí se mira que
 * le quede cuota, igual que en el paso de los ganchos.
 *
 * Tampoco exige muestras de voz, al revés que el guion: lo que acaba de pegar
 * es, él mismo, la mejor muestra de cómo habla que va a dar nunca. Pedirle que
 * rellene su perfil para poder pulir su propia historia sería exactamente el
 * trámite que esta pantalla existe para quitar.
 */
export async function POST(request: Request) {
  const usuario = await usuarioActual();
  if (!usuario) {
    return Response.json({ error: "Entra a tu cuenta." }, { status: 401 });
  }

  let cuerpo: Cuerpo;
  try {
    cuerpo = await request.json();
  } catch {
    return Response.json({ error: "Cuerpo inválido." }, { status: 400 });
  }

  const crudo = (cuerpo.crudo ?? "").trim().slice(0, MAX);
  if (crudo.length < MINIMO) {
    return Response.json(
      { error: "Cuéntala un poco más: qué pasó, cuándo y cómo acabó. Con dos líneas me vale." },
      { status: 400 },
    );
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

    const instrucciones = await cargarPrompt("3-historia.md");
    const texto = [
      cuerpo.quien === "cliente"
        ? "## De quién es la historia\nDe un cliente suyo."
        : "## De quién es la historia\nSuya.",
      cuerpo.idea?.trim() ? `\n## Para qué pieza es\n${cuerpo.idea.trim()}` : "",
      cuerpo.angulo?.trim() ? `\n## Ángulo de la pieza\n${cuerpo.angulo.trim()}` : "",
      `\n## La historia, como la escribió él\n${crudo}`,
      "\nDevuelve solo el JSON.",
    ].join("\n");

    const r = await generar({ sistema: instrucciones, estable: contexto.estable, texto });
    const salida = extraerJSON<Historia>(r.texto);

    return Response.json({
      historia: salida,
      meta: { proveedor: r.proveedor, modelo: r.modelo, uso: r.uso },
    });
  } catch (e) {
    if (e instanceof FaltaNegocio) {
      return Response.json({ error: e.message }, { status: 400 });
    }
    console.error("historia:", e instanceof Error ? e.message : e);
    return Response.json(
      { error: "No se pudo ordenar la historia. Vuelve a intentarlo." },
      { status: 500 },
    );
  }
}
