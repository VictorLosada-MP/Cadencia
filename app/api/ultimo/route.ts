import { ultimaCorrida } from "@/lib/historial";
import { negocioDe, usuarioActual } from "@/lib/negocio";

/**
 * Lo último que produjo una función, para que al volver esté como se dejó.
 * Leer no gasta cuota ni llama al modelo: sale de la base.
 */
export async function GET(request: Request) {
  const usuario = await usuarioActual();
  if (!usuario) return Response.json({ error: "Entra a tu cuenta." }, { status: 401 });

  const funcion = Number(new URL(request.url).searchParams.get("funcion"));
  if (![1, 2, 3].includes(funcion)) {
    return Response.json({ error: "Función desconocida." }, { status: 400 });
  }

  try {
    const negocio = await negocioDe(usuario.id);
    if (!negocio) return Response.json({ corrida: null });
    return Response.json({ corrida: await ultimaCorrida(negocio.id, funcion as 1 | 2 | 3) });
  } catch (e) {
    console.error("ultimo:", e instanceof Error ? e.message : e);
    return Response.json({ error: "No se pudo leer." }, { status: 500 });
  }
}
