import { cuotaDe } from "@/lib/cuota";
import { negocioDe, usuarioActual } from "@/lib/negocio";

/**
 * Solo la cuota, para la barra de arriba.
 *
 * Existe aparte porque la barra está en todas las pantallas: si pidiera el
 * negocio entero —con su comparación y su historial— cada página pagaría cuatro
 * consultas para pintar un contador de dos números.
 */
export async function GET() {
  const usuario = await usuarioActual();
  if (!usuario) return Response.json({ error: "Entra a tu cuenta." }, { status: 401 });

  try {
    const negocio = await negocioDe(usuario.id);
    return Response.json({ cuota: await cuotaDe(usuario.id, negocio?.id ?? null) });
  } catch (e) {
    console.error("cuota:", e instanceof Error ? e.message : e);
    return Response.json({ error: "No se pudo leer." }, { status: 500 });
  }
}
