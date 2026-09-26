import { buscarFotos, esDePexels, hayFotos } from "@/lib/fotos";
import { usuarioActual } from "@/lib/negocio";

export const maxDuration = 60;

/**
 * Buscar fotos, y traerlas.
 *
 * La imagen viaja por aquí y no directa al navegador por una razón concreta:
 * así llega del mismo origen que la página y se puede dibujar en el canvas sin
 * que quede marcado y deje de poder exportarse.
 */
export async function GET(request: Request) {
  const usuario = await usuarioActual();
  if (!usuario) return Response.json({ error: "Entra a tu cuenta." }, { status: 401 });

  const params = new URL(request.url).searchParams;
  const traer = params.get("traer");

  if (traer) {
    if (!esDePexels(traer)) {
      return Response.json({ error: "Origen no permitido." }, { status: 400 });
    }
    const r = await fetch(traer, { signal: AbortSignal.timeout(20_000) });
    if (!r.ok) return Response.json({ error: "No se pudo traer la foto." }, { status: 502 });
    return new Response(r.body, {
      headers: {
        "Content-Type": r.headers.get("content-type") ?? "image/jpeg",
        "Cache-Control": "private, max-age=3600",
      },
    });
  }

  if (!hayFotos()) {
    return Response.json(
      {
        error:
          "Falta la clave de Pexels. Es gratis: se saca en pexels.com/api y se pone en .env.local.",
        sinClave: true,
      },
      { status: 422 },
    );
  }

  const consulta = params.get("q")?.trim();
  if (!consulta) return Response.json({ error: "Dime qué buscar." }, { status: 400 });

  const orientacion = params.get("o");
  try {
    return Response.json({
      fotos: await buscarFotos(
        consulta,
        orientacion === "portrait" || orientacion === "square" ? orientacion : "landscape",
      ),
    });
  } catch (e) {
    console.error("fotos:", e instanceof Error ? e.message : e);
    return Response.json({ error: "No se pudo buscar ahora mismo." }, { status: 502 });
  }
}
