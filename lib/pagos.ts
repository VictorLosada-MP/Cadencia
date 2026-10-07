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
  origen: "checkout" | "suscripcion" = "checkout",
): Promise<Pago | null> {
  return una<Pago>(
    `insert into pago (usuario_id, plan_id, referencia, monto_centavos, origen)
          values ($1, $2, $3, $4, $5)
       returning *`,
    [usuarioId, planId, referencia, centavos, origen],
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

export type Suscripcion = {
  usuario_id: string;
  plan_id: string;
  plan_hasta: string | null;
  fuente_pago_id: string | null;
  fuente_marca: string | null;
  fuente_ultimos4: string | null;
  renovar: boolean;
  fallos: number;
  correo: string;
  precio_cop: number | null;
};

/** Guarda la tarjeta de alguien y deja la renovación encendida. */
export async function guardarFuente(
  usuarioId: string,
  planId: string,
  fuente: { id: number; marca: string; ultimos4: string },
): Promise<void> {
  await una(
    `insert into suscripcion (usuario_id, plan_id, fuente_pago_id, fuente_marca, fuente_ultimos4, renovar, fallos)
          values ($1, $2, $3, $4, $5, true, 0)
     on conflict (usuario_id) do update
            set plan_id = excluded.plan_id,
                fuente_pago_id = excluded.fuente_pago_id,
                fuente_marca = excluded.fuente_marca,
                fuente_ultimos4 = excluded.fuente_ultimos4,
                renovar = true,
                fallos = 0`,
    [usuarioId, planId, String(fuente.id), fuente.marca, fuente.ultimos4],
  );
}

/** El dueño apaga o enciende la renovación desde su pantalla de plan. */
export async function renovacion(usuarioId: string, encendida: boolean): Promise<void> {
  await una(`update suscripcion set renovar = $2 where usuario_id = $1`, [usuarioId, encendida]);
}

export function suscripcionDe(usuarioId: string): Promise<Suscripcion | null> {
  return una<Suscripcion>(
    `select s.*, u.email as correo, p.precio_cop
       from suscripcion s
       join "user" u on u.id = s.usuario_id
       left join plan p on p.id = s.plan_id
      where s.usuario_id = $1`,
    [usuarioId],
  );
}

/** Cuántos días antes de que se acabe se intenta cobrar. */
export const AVISO_DIAS = 1;
/** A la tercera se para. Insistir no arregla una tarjeta vencida. */
export const MAX_FALLOS = 3;

/**
 * A quién toca cobrarle.
 *
 * Solo quien tiene tarjeta guardada, la renovación encendida, no ha agotado los
 * intentos, le queda un día o menos, y no se le intentó ya hoy. Esa última
 * condición es la que impide que una tarea disparada dos veces cobre dos veces.
 */
export function porRenovar(): Promise<Suscripcion[]> {
  return consultar<Suscripcion>(
    `select s.*, u.email as correo, p.precio_cop
       from suscripcion s
       join "user" u on u.id = s.usuario_id
       join plan p on p.id = s.plan_id
      where s.renovar
        and s.fuente_pago_id is not null
        and s.fallos < $1
        and p.precio_cop is not null
        and s.plan_hasta is not null
        and s.plan_hasta <= now() + ($2 || ' days')::interval
        and (s.ultimo_intento is null or s.ultimo_intento < date_trunc('day', now()))
      order by s.plan_hasta
      limit 200`,
    [MAX_FALLOS, String(AVISO_DIAS)],
  );
}

export async function apuntarIntento(usuarioId: string, bien: boolean): Promise<void> {
  await una(
    `update suscripcion
        set ultimo_intento = now(),
            fallos = case when $2 then 0 else fallos + 1 end
      where usuario_id = $1`,
    [usuarioId, bien],
  );
}
