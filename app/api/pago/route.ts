import { una } from "@/lib/db";
import { usuarioActual } from "@/lib/negocio";
import { crearPago } from "@/lib/pagos";
import { CHECKOUT, MONEDA, config, firmaIntegridad, nuevaReferencia } from "@/lib/wompi";

export const dynamic = "force-dynamic";

/**
 * Prepara un pago: crea la referencia y la firma con la que ir al checkout.
 *
 * El monto NO viene del cuerpo de la petición, sale del plan en la base. Es la
 * única forma de que nadie compre el plan Marca por cien pesos cambiando un
 * número en la pantalla, y es también la razón de que la firma se calcule aquí:
 * el secreto de integridad nunca puede llegar al navegador.
 */
export async function POST(request: Request) {
  const usuario = await usuarioActual();
  if (!usuario) return Response.json({ error: "Entra a tu cuenta." }, { status: 401 });

  const claves = config();
  if (!claves) {
    return Response.json(
      { error: "Los pagos todavía no están configurados." },
      { status: 503 },
    );
  }

  let cuerpo: { plan?: string };
  try {
    cuerpo = await request.json();
  } catch {
    return Response.json({ error: "Cuerpo inválido." }, { status: 400 });
  }

  try {
    const plan = await una<{ id: string; nombre: string; precio_cop: number | null }>(
      `select id, nombre, precio_cop from plan where id = $1 and publico`,
      [String(cuerpo.plan ?? "")],
    );
    if (!plan) return Response.json({ error: "Ese plan no existe." }, { status: 400 });
    if (!plan.precio_cop || plan.precio_cop <= 0) {
      return Response.json({ error: "Ese plan todavía no tiene precio." }, { status: 400 });
    }

    const centavos = plan.precio_cop * 100;
    const referencia = nuevaReferencia();
    const guardado = await crearPago(usuario.id, plan.id, referencia, centavos);
    if (!guardado) throw new Error("no se pudo apuntar el pago");

    return Response.json({
      checkout: CHECKOUT,
      publica: claves.publica,
      moneda: MONEDA,
      centavos,
      referencia,
      // El correo se le da ya escrito al checkout para que no lo teclee otra
      // vez; Wompi lo usa para el recibo, no para identificar la cuenta.
      correo: usuario.email,
      firma: firmaIntegridad(referencia, centavos, claves.integridad),
    });
  } catch (e) {
    console.error("pago:", e instanceof Error ? e.message : e);
    return Response.json({ error: "No se pudo preparar el pago." }, { status: 500 });
  }
}
