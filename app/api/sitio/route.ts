import { revisarCuota } from "@/lib/cuota";
import { negocioDe, usuarioActual } from "@/lib/negocio";
import { leerSitio } from "@/lib/sitio";

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
    return Response.json({ error: "Escribe la dirección del sitio." }, { status: 400 });
  }

  // Leer una página no llama al modelo y no cuesta, pero abre una petición
  // desde el servidor: una cuenta agotada no la abre.
  const negocio = await negocioDe(usuario.id);
  const permiso = await revisarCuota(usuario.id, negocio?.id ?? null);
  if (!permiso.ok) {
    return Response.json({ error: permiso.mensaje, agotada: true }, { status: 402 });
  }

  try {
    const lectura = await leerSitio(cuerpo.url);
    return Response.json({
      casillas: {
        usuario: "",
        nombre: lectura.nombre,
        bio: [lectura.titular, lectura.promesa].filter(Boolean).join("\n"),
        cta: lectura.cta,
        link: lectura.link,
      },
      vacias: (["nombre", "bio", "cta"] as const).filter(
        (k) => !(k === "bio" ? lectura.titular || lectura.promesa : lectura[k === "nombre" ? "nombre" : "cta"]),
      ),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    console.error("sitio:", msg);
    return Response.json(
      {
        error:
          msg && msg.length < 120
            ? msg
            : "No pude abrir ese sitio. Revisa la dirección, o escribe las casillas a mano.",
      },
      { status: 422 },
    );
  }
}
