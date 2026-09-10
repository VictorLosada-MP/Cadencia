import { guardarNegocio, negocioDe, usuarioActual } from "@/lib/negocio";
import { negocioListo, type Negocio } from "@/types/negocio";

export async function GET() {
  const usuario = await usuarioActual();
  if (!usuario) return Response.json({ error: "Entra a tu cuenta." }, { status: 401 });

  try {
    return Response.json({ negocio: await negocioDe(usuario.id) });
  } catch (e) {
    console.error("negocio GET:", e instanceof Error ? e.message : e);
    return Response.json({ error: "No se pudo leer tu negocio." }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  const usuario = await usuarioActual();
  if (!usuario) return Response.json({ error: "Entra a tu cuenta." }, { status: 401 });

  let n: Negocio;
  try {
    n = await request.json();
  } catch {
    return Response.json({ error: "Cuerpo inválido." }, { status: 400 });
  }

  if (!negocioListo(n)) {
    return Response.json(
      { error: "Llena qué vendes, a quién le sirve y cómo queda después." },
      { status: 400 },
    );
  }

  try {
    return Response.json({ negocio: await guardarNegocio(usuario.id, n) });
  } catch (e) {
    console.error("negocio PUT:", e instanceof Error ? e.message : e);
    return Response.json({ error: "No se pudo guardar tu negocio." }, { status: 500 });
  }
}
