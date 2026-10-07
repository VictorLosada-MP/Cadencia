import { consultar, una } from "@/lib/db";

export type Plan = {
  id: string;
  nombre: string;
  precio_mes: string;
  corridas_mes: number | null;
  corridas_total: number | null;
  negocios: number;
  historial_meses: number | null;
  /** Falso en el VIP: existe, se regala, y no sale en la página de precios. */
  publico: boolean;
  /**
   * Lo que se cobra de verdad, en pesos colombianos enteros.
   *
   * Aparte de `precio_mes`, que es lo que se anuncia: Wompi cobra en COP y en
   * centavos, y mezclar la moneda del escaparate con la del cobro es como se
   * cobra de más. En null mientras no se le ponga precio, y entonces el plan no
   * se puede comprar y la pantalla lo dice.
   */
  precio_cop: number | null;
};

export type Cuota = {
  plan: Plan;
  /** Verdad cuando el plan en vigor es un regalo, no una compra. */
  cortesia: boolean;
  usadas: number;
  limite: number | null;
  /** Cuándo se reinicia. null en el plan de por vida: no se reinicia. */
  reinicia: string | null;
};

const PRUEBA = "prueba";

/**
 * El plan en vigor de una cuenta.
 *
 * La cortesía gana mientras no haya caducado. Si caduca o se retira, la cuenta
 * cae a su plan sin que se borre nada.
 */
export async function planEnVigor(usuarioId: string): Promise<{ plan: Plan; cortesia: boolean }> {
  const fila = await una<{
    plan_id: string;
    plan_hasta: string | null;
    cortesia_plan: string | null;
    cortesia_hasta: string | null;
  }>(
    `select plan_id, plan_hasta, cortesia_plan, cortesia_hasta
       from suscripcion where usuario_id = $1`,
    [usuarioId],
  );

  const sigueValiendo = (hasta: string | null | undefined) =>
    !hasta || new Date(hasta).getTime() > Date.now();

  const vigente = fila?.cortesia_plan && sigueValiendo(fila.cortesia_hasta);

  // Un pago del checkout compra UN MES, no suscribe: pasado `plan_hasta` la
  // cuenta vuelve a prueba sola. En null es sin caducidad, que es lo que tienen
  // las cuentas de antes y lo que pone a mano el panel.
  const comprado = fila?.plan_id && sigueValiendo(fila.plan_hasta) ? fila.plan_id : PRUEBA;

  const id = vigente ? fila!.cortesia_plan! : comprado;
  const plan = await una<Plan>(`select * from plan where id = $1`, [id]);

  // Si el plan al que apunta desapareció, la cuenta no se queda sin servicio:
  // cae a prueba, que existe siempre.
  if (!plan) {
    const base = await una<Plan>(`select * from plan where id = $1`, [PRUEBA]);
    return { plan: base!, cortesia: false };
  }
  return { plan, cortesia: Boolean(vigente) };
}

/** Cuántas corridas lleva. Se cuenta la tabla `corrida`: solo tiene éxitos. */
async function contar(negocioId: string, desde: Date | null): Promise<number> {
  const fila = await una<{ n: string }>(
    desde
      ? `select count(*) as n from corrida where negocio_id = $1 and creado >= $2`
      : `select count(*) as n from corrida where negocio_id = $1`,
    desde ? [negocioId, desde.toISOString()] : [negocioId],
  );
  return Number(fila?.n ?? 0);
}

function inicioDelMes(): Date {
  const hoy = new Date();
  return new Date(Date.UTC(hoy.getUTCFullYear(), hoy.getUTCMonth(), 1));
}

export async function cuotaDe(usuarioId: string, negocioId: string | null): Promise<Cuota> {
  const { plan, cortesia } = await planEnVigor(usuarioId);

  // Sin negocio guardado todavía no hay nada que contar.
  if (!negocioId) {
    return { plan, cortesia, usadas: 0, limite: plan.corridas_mes ?? plan.corridas_total, reinicia: null };
  }

  if (plan.corridas_total !== null) {
    return {
      plan,
      cortesia,
      usadas: await contar(negocioId, null),
      limite: plan.corridas_total,
      reinicia: null,
    };
  }

  const desde = inicioDelMes();
  const siguiente = new Date(Date.UTC(desde.getUTCFullYear(), desde.getUTCMonth() + 1, 1));
  return {
    plan,
    cortesia,
    usadas: await contar(negocioId, desde),
    limite: plan.corridas_mes,
    reinicia: siguiente.toISOString(),
  };
}

export type Veredicto = { ok: true; cuota: Cuota } | { ok: false; mensaje: string; cuota: Cuota };

/**
 * El portero. Se llama antes de gastar dinero, nunca después.
 *
 * Cierra la puerta de CREAR, jamás la de LEER: lo ya entregado se sigue
 * abriendo, copiando y exportando sin pagar.
 */
export async function revisarCuota(
  usuarioId: string,
  negocioId: string | null,
): Promise<Veredicto> {
  const cuota = await cuotaDe(usuarioId, negocioId);
  if (cuota.limite === null || cuota.usadas < cuota.limite) return { ok: true, cuota };

  const mensaje =
    cuota.plan.corridas_total !== null
      ? "La prueba incluye una corrida. Lo que ya generaste sigue disponible: puedes abrirlo, leerlo y copiarlo cuando quieras."
      : `Llegaste a las ${cuota.limite} corridas de este mes. Se reinician el 1. Lo que ya generaste sigue disponible.`;

  return { ok: false, mensaje, cuota };
}

/**
 * Los planes que se anuncian. El VIP no está, y es el motivo de la columna.
 *
 * Un plan de cero euros con todo ilimitado en la lista pública no sería una
 * oferta: sería la puerta de atrás, anunciada.
 */
export async function planesDisponibles(): Promise<Plan[]> {
  return consultar<Plan>(`select * from plan where publico order by orden`);
}
