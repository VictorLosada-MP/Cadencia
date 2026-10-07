import { consultar, una } from "@/lib/db";

/**
 * Los pagos, contra la base.
 *
 * Dos reglas gobiernan todo esto:
 *
 * **El precio sale de aquí, nunca del navegador.** El monto se lee del plan en
 * la base y se firma en el servidor. Si viniera del cliente, cualquiera
 * compraría el plan Marca por cien pesos cambiando un número en la pantalla.
 *
 * **Quien activa el plan es el EVENTO, no la pantalla de vuelta.** La URL a la
 * que Wompi devuelve al usuario la puede abrir cualquiera, escrita a mano, sin
 * haber pagado nada. El evento viene firmado; la vuelta, no.
 */

export type Pago = {
  id: string;
  usuario_id: string;
  plan_id: string;
  referencia: string;
  monto_centavos: string;
  estado: string;
  transaccion_id: string | null;
  creado: string;
};

export function crearPago(
  usuarioId: string,
  planId: string,
  referencia: string,
  centavos: number,
): Promise<Pago | null> {
  return una<Pago>(
    `insert into pago (usuario_id, plan_id, referencia, monto_centavos)
          values ($1, $2, $3, $4)
       returning *`,
    [usuarioId, planId, referencia, centavos],
  );
}

export function pagoPorReferencia(referencia: string): Promise<Pago | null> {
  return una<Pago>(`select * from pago where referencia = $1`, [referencia]);
}

export function pagosDe(usuarioId: string): Promise<Pago[]> {
  return consultar<Pago>(
    `select * from pago where usuario_id = $1 order by creado desc limit 20`,
    [usuarioId],
  );
}

/** Cuánto dura lo comprado. Un pago del checkout compra un mes, no suscribe. */
export const DIAS_POR_PAGO = 30;

/**
 * Cierra un pago con lo que dijo Wompi, y si entró, activa el plan.
 *
 * Todo en una sola transacción, y el `where estado = 'PENDIENTE'` es lo que la
 * hace idempotente: Wompi reintenta sus eventos, y sin eso el mismo pago
 * sumaría treinta días cada vez que llegara repetido.
 *
 * Devuelve si ESTE evento fue el que lo cerró. Falso significa «ya estaba» —
 * que no es un error, es exactamente lo que tiene que pasar en el reintento.
 */
export async function cerrarPago(
  referencia: string,
  estado: string,
  transaccionId: string | null,
): Promise<{ cerrado: boolean; aprobado: boolean }> {
  const fila = await una<Pago>(
    `update pago
        set estado = $2, transaccion_id = $3, actualizado = now()
      where referencia = $1 and estado = 'PENDIENTE'
     returning *`,
    [referencia, estado, transaccionId],
  );
  if (!fila) return { cerrado: false, aprobado: false };
  if (estado !== "APPROVED") return { cerrado: true, aprobado: false };

  // `plan_hasta` se extiende desde HOY o desde donde llegara, lo que sea mayor:
  // quien renueva antes de que se le acabe no pierde los días que le quedaban.
  await una(
    `insert into suscripcion (usuario_id, plan_id, plan_hasta)
          values ($1, $2, now() + ($3 || ' days')::interval)
     on conflict (usuario_id) do update
            set plan_id = excluded.plan_id,
                plan_hasta = greatest(
                  coalesce(suscripcion.plan_hasta, now()), now()
                ) + ($3 || ' days')::interval`,
    [fila.usuario_id, fila.plan_id, String(DIAS_POR_PAGO)],
  );
  return { cerrado: true, aprobado: true };
}
