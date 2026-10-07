import { revisarCuota } from "@/lib/cuota";
import { negocioDe, usuarioActual } from "@/lib/negocio";
import { leerPublicacion } from "@/lib/sitio";

export const maxDuration = 60;

export async function POST(request: Request) {
  const usuario = await usuarioActual();
  if (!usuario) return Response.json({ error: "Entra a tu cuenta." }, { status: 401 });

  let cuerpo: { url?: string };
  try {
    cuerpo = await request.json();
  } catch {
    return Response.json({ error: "Cuerpo inválido." }, { status: 400 });
  }
  if (!cuerpo.url?.trim()) {
    return Response.json({ error: "Pega el enlace de la publicación." }, { status: 400 });
  }

  const negocio = await negocioDe(usuario.id);
  const permiso = await revisarCuota(usuario.id, negocio?.id ?? null, 1, { intermedio: true });
  if (!permiso.ok) {
    return Response.json({ error: permiso.mensaje, agotada: true }, { status: 402 });
  }

  try {
    const { texto, de } = await leerPublicacion(cuerpo.url);
    return Response.json({ texto, de });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    console.error("publicacion:", msg);
    return Response.json(
      {
        error:
          msg.includes("429") || msg.includes("respondió")
            ? "Esa red no me dejó leer el enlace ahora mismo. Pega el texto a mano."
            : msg && msg.length < 120
              ? msg
              : "No pude leer ese enlace. Pega el texto a mano.",
      },
      { status: 422 },
    );
  }
}
