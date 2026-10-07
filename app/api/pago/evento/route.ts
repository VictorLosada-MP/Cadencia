import { cerrarPago } from "@/lib/pagos";
import { config, eventoAutentico, type Evento } from "@/lib/wompi";

export const dynamic = "force-dynamic";

/**
 * La URL de eventos de Wompi. Esto es lo que activa un plan — nada más.
 *
 * Que sea esto y no la pantalla de vuelta es la decisión importante: la URL a
 * la que Wompi devuelve al usuario la puede abrir cualquiera escribiéndola a
 * mano, sin haber pagado un peso. Esta viene firmada con un secreto que solo
 * tienen Wompi y el servidor.
 *
 * Se pone en el panel de Wompi, en «URL de eventos»:
 *
 *   https://cadencia-jade.vercel.app/api/pago/evento
 *
 * Contesta 200 a casi todo a propósito. Wompi reintenta lo que no sea 200, y
 * reintentar un evento que ya se procesó, o uno de un tipo que no nos toca, no
 * arregla nada: solo deja la cola de Wompi dando vueltas para siempre. Lo único
 * que devuelve error es la firma mala, porque eso sí hay que verlo.
 */
export async function POST(request: Request) {
  const claves = config();
  if (!claves) return new Response(null, { status: 503 });

  let evento: Evento;
  try {
    evento = await request.json();
  } catch {
    return new Response(null, { status: 400 });
  }

  const firma = eventoAutentico(
    evento,
    claves.eventos,
    request.headers.get("x-event-checksum"),
  );
  if (!firma.ok) {
    // Los dos primeros caracteres de cada firma, nunca el secreto: lo justo
    // para distinguir «llegó sin firma» de «la firma no cuadra».
    console.error(
      `pago/evento: firma rechazada · mía ${firma.mio.slice(0, 8)}… · dicha ${firma.dicho.slice(0, 8)}…`,
    );
    return new Response(null, { status: 401 });
  }

  // Hoy solo nos toca uno. Los de Nequi y Bancolombia llegan a la misma URL.
  if (evento.event !== "transaction.updated") return Response.json({ ok: true });

  const t = (evento.data?.transaction ?? {}) as Record<string, unknown>;
  const referencia = String(t.reference ?? "");
  const estado = String(t.status ?? "");
  if (!referencia || !estado) return Response.json({ ok: true });

  try {
    const r = await cerrarPago(referencia, estado, t.id ? String(t.id) : null);
    console.log(
      `pago/evento: ${referencia} ${estado}` +
        (r.cerrado ? (r.aprobado ? " → plan activado" : "") : " → ya estaba cerrado"),
    );
    return Response.json({ ok: true });
  } catch (e) {
    // Aquí SÍ se devuelve error: si falló la base, se quiere el reintento.
    console.error("pago/evento:", e instanceof Error ? e.message : e);
    return new Response(null, { status: 500 });
  }
}
