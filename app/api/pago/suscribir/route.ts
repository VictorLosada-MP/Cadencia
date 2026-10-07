import { una } from "@/lib/db";
import { usuarioActual } from "@/lib/negocio";
import { crearPago, guardarFuente } from "@/lib/pagos";
import { cobrar, config, crearFuente, nuevaReferencia } from "@/lib/wompi";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

/**
 * Guarda la tarjeta y cobra el primer mes.
 *
 * Lo que llega aquí es un TOKEN, no una tarjeta: el navegador ya la tokenizó
 * contra Wompi con la clave pública. Por este servidor no pasa ningún número de
 * tarjeta, ni entra en ningún registro, ni queda en la base.
 *
 * El cobro se dispara aquí pero NO activa el plan: eso lo hace el evento
 * firmado, igual que en el pago suelto. Un cobro que Wompi acepta hoy puede
 * revertirse mañana, y el único que lo cuenta de verdad es el evento.
 */
export async function POST(request: Request) {
  const usuario = await usuarioActual();
  if (!usuario) return Response.json({ error: "Entra a tu cuenta." }, { status: 401 });

  const c = config();
  if (!c?.privada) {
    return Response.json({ error: "Los pagos todavía no están configurados." }, { status: 503 });
  }

  let cuerpo: { plan?: string; token?: string; aceptacion?: string; datos?: string };
  try {
    cuerpo = await request.json();
  } catch {
    return Response.json({ error: "Cuerpo inválido." }, { status: 400 });
  }
  if (!cuerpo.token || !cuerpo.aceptacion) {
    return Response.json({ error: "Falta la tarjeta o el permiso." }, { status: 400 });
  }

  try {
    const plan = await una<{ id: string; nombre: string; precio_cop: number | null }>(
      `select id, nombre, precio_cop from plan where id = $1 and publico`,
      [String(cuerpo.plan ?? "")],
    );
    if (!plan?.precio_cop) {
      return Response.json({ error: "Ese plan no se puede comprar." }, { status: 400 });
    }

    const fuente = await crearFuente(c, {
      token: cuerpo.token,
      correo: usuario.email,
      aceptacion: cuerpo.aceptacion,
      datos: cuerpo.datos,
    });

    const centavos = plan.precio_cop * 100;
    const referencia = nuevaReferencia();
    await crearPago(usuario.id, plan.id, referencia, centavos, "suscripcion");

    const t = await cobrar(c, {
      fuente,
      centavos,
      referencia,
      correo: usuario.email,
    });

    // La tarjeta se guarda aunque el primer cobro quede pendiente: Wompi
    // devuelve PENDING a menudo y el resultado llega por el evento. Si se
    // guardara solo al aprobar, el reintento de mañana no tendría con qué.
    await guardarFuente(usuario.id, plan.id, {
      id: fuente,
      marca: "",
      ultimos4: "",
    });

    return Response.json({ referencia, estado: t.status });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    console.error("suscribir:", msg);
    return Response.json(
      {
        // Lo que dice Wompi de una tarjeta rechazada le sirve al dueño; lo
        // demás no, y además puede llevar detalles de dentro.
        error: /declin|rechaz|insufficient|invalid/i.test(msg)
          ? "Tu banco no aceptó esa tarjeta. Prueba con otra."
          : "No se pudo guardar la tarjeta. Inténtalo en un momento.",
      },
      { status: 502 },
    );
  }
}
