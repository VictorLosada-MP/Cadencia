import { usuarioActual } from "@/lib/negocio";
import { renovacion, suscripcionDe } from "@/lib/pagos";

export const dynamic = "force-dynamic";

/**
 * Encender o apagar la renovación.
 *
 * Existe porque tiene que existir: un cobro que se repite y no se puede parar
 * desde dentro del producto obliga a llamar al banco, y quien llega ahí no
 * vuelve. Apagarlo NO cancela el mes pagado — se queda hasta su fecha, que es
 * lo que compró.
 */
export async function POST(request: Request) {
  const usuario = await usuarioActual();
  if (!usuario) return Response.json({ error: "Entra a tu cuenta." }, { status: 401 });

  let cuerpo: { renovar?: boolean };
  try {
    cuerpo = await request.json();
  } catch {
    return Response.json({ error: "Cuerpo inválido." }, { status: 400 });
  }

  try {
    await renovacion(usuario.id, Boolean(cuerpo.renovar));
    const s = await suscripcionDe(usuario.id);
    return Response.json({ renovar: s?.renovar ?? false, hasta: s?.plan_hasta ?? null });
  } catch (e) {
    console.error("renovacion:", e instanceof Error ? e.message : e);
    return Response.json({ error: "No se pudo guardar." }, { status: 500 });
  }
}
