import { timingSafeEqual } from "node:crypto";
import { apuntarIntento, crearPago, porRenovar } from "@/lib/pagos";
import { cobrar, config, nuevaReferencia } from "@/lib/wompi";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

/**
 * El cobro mensual. Lo dispara una tarea programada, una vez al día.
 *
 * No activa nada: cobra y se calla. Quien extiende el mes es el evento firmado,
 * igual que en todo lo demás — así hay un solo sitio en el código donde un plan
 * se activa, y ese sitio comprueba una firma.
 *
 * Diario y no mensual a propósito: así el que falló hoy se reintenta mañana sin
 * esperar otro mes, y una tarea que no corrió un día no deja a nadie sin plan.
 */
async function correr(request: Request) {
  const esperado = process.env.RENOVAR_PLAN_SECRET?.trim();
  if (!esperado || esperado.length < 16) return new Response(null, { status: 503 });

  // Vercel manda `Authorization: Bearer <RENOVAR_PLAN_SECRET>` en sus tareas.
  const dado = (request.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  const a = Buffer.from(dado);
  const b = Buffer.from(esperado);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return new Response(null, { status: 404 });
  }

  const c = config();
  if (!c?.privada) return new Response(null, { status: 503 });

  let cobrados = 0;
  let fallados = 0;

  try {
    const pendientes = await porRenovar();
    for (const s of pendientes) {
      const centavos = (s.precio_cop ?? 0) * 100;
      if (!centavos || !s.fuente_pago_id) continue;
      const referencia = nuevaReferencia();
      try {
        await crearPago(s.usuario_id, s.plan_id, referencia, centavos, "suscripcion");
        await cobrar(c, {
          fuente: Number(s.fuente_pago_id),
          centavos,
          referencia,
          correo: s.correo,
        });
        // Bien es «Wompi aceptó el intento», no «entró el dinero». Lo segundo
        // lo dice el evento, y si viene mal, el contador de fallos no se toca
        // aquí sino al reintentar mañana.
        await apuntarIntento(s.usuario_id, true);
        cobrados++;
      } catch (e) {
        await apuntarIntento(s.usuario_id, false);
        fallados++;
        console.error(`renovar ${s.usuario_id}:`, e instanceof Error ? e.message : e);
      }
    }
    console.log(`renovar: ${cobrados} cobrados, ${fallados} fallados de ${pendientes.length}`);
    return Response.json({ cobrados, fallados, mirados: pendientes.length });
  } catch (e) {
    console.error("renovar:", e instanceof Error ? e.message : e);
    return Response.json({ error: "falló" }, { status: 500 });
  }
}

/**
 * Vercel dispara sus tareas con GET, así que ese es el que cuenta. El POST se
 * queda para poder dispararla a mano desde una terminal sin montar nada.
 */
export const GET = correr;
export const POST = correr;
