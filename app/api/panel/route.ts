import { adminActual, llaveCorrecta, ponerVip, quitarVip } from "@/lib/panel";

export const dynamic = "force-dynamic";

/**
 * El único botón del panel: poner o quitar el VIP.
 *
 * Vuelve a comprobar la llave Y el rol. No se fía de que la pantalla ya los
 * comprobara: la pantalla es un cliente, y un cliente se puede saltar. Quien
 * decide quién entra es siempre el servidor, en cada petición.
 */
export async function POST(request: Request) {
  let cuerpo: { llave?: string; usuarioId?: string; vip?: boolean };
  try {
    cuerpo = await request.json();
  } catch {
    return Response.json({ error: "Cuerpo inválido." }, { status: 400 });
  }

  // El mismo 404 que daría una dirección inventada: desde fuera, este panel no
  // existe. Un 401 confirmaría que hay algo detrás que merece la pena buscar.
  if (!llaveCorrecta(String(cuerpo.llave ?? ""))) {
    return new Response(null, { status: 404 });
  }

  const admin = await adminActual();
  if (!admin) return new Response(null, { status: 404 });

  const usuarioId = String(cuerpo.usuarioId ?? "");
  if (!usuarioId) return Response.json({ error: "Falta de quién." }, { status: 400 });

  try {
    if (cuerpo.vip) await ponerVip(usuarioId, admin.id);
    else await quitarVip(usuarioId);
    return Response.json({ ok: true });
  } catch (e) {
    console.error("panel:", e instanceof Error ? e.message : e);
    return Response.json({ error: "No se pudo guardar." }, { status: 500 });
  }
}
