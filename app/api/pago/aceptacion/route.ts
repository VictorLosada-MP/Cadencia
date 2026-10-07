import { usuarioActual } from "@/lib/negocio";
import { aceptacion, config } from "@/lib/wompi";

export const dynamic = "force-dynamic";

/**
 * Los permisos que hay que enseñar antes de guardar una tarjeta, y la clave
 * pública con la que el navegador va a tokenizarla.
 *
 * La clave pública se manda al navegador a propósito: es pública, Wompi la
 * declara segura para el cliente, y es lo que permite que el número de la
 * tarjeta vaya del navegador a Wompi **sin pasar por este servidor**. La
 * privada, la que mueve dinero, no sale de aquí jamás.
 */
export async function GET() {
  const usuario = await usuarioActual();
  if (!usuario) return Response.json({ error: "Entra a tu cuenta." }, { status: 401 });

  const c = config();
  if (!c?.privada) {
    return Response.json({ error: "Los pagos todavía no están configurados." }, { status: 503 });
  }

  try {
    const a = await aceptacion(c.publica);
    if (!a.token) throw new Error("Wompi no devolvió el permiso de aceptación.");
    return Response.json({ publica: c.publica, aceptacion: a });
  } catch (e) {
    console.error("aceptacion:", e instanceof Error ? e.message : e);
    return Response.json({ error: "No se pudo empezar. Inténtalo en un momento." }, { status: 502 });
  }
}
