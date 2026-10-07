import { consultar, una } from "@/lib/db";

export type Plan = {
  id: string;
  nombre: string;
  precio_mes: string;
  corridas_mes: number | null;
  corridas_total: number | null;
  /**
   * Límite POR FUNCIÓN. Es la prueba gratis: una pasada entera y se cierra.
   *
   * Es por función y no un total de tres porque un total de tres se gasta en
   * tres diagnósticos —medido: eso era justo lo que pasaba con el total de
   * uno— y la cuenta se queda otra vez sin ver la semana, la pieza ni el
   * montaje. Lo que se regala es el recorrido completo, no tres fichas.
   */
  corridas_funcion: number | null;
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

/** 1 diagnóstico, 2 la semana, 3 la pieza. Las mismas que guarda `corrida`. */
export type Funcion = 1 | 2 | 3;

export const FUNCIONES: Funcion[] = [1, 2, 3];

const NOMBRE_FUNCION: Record<Funcion, string> = {
  1: "el diagnóstico",
  2: "la semana",
  3: "la pieza",
};

export type Cuota = {
  plan: Plan;
  /** Verdad cuando el plan en vigor es un regalo, no una compra. */
  cortesia: boolean;
  usadas: number;
  limite: number | null;
  /** Cuándo se reinicia. null en el plan de por vida: no se reinicia. */
  reinicia: string | null;
  /**
   * Verdad cuando el límite se cuenta por función, no al mes.
   *
   * La pantalla lo necesita para no decir «20 corridas al mes» donde son
   * «una por función»: son dos cosas distintas y confundirlas en la barra es
   * prometer lo que no hay.
   */
  porFuncion: boolean;
  /**
   * La pasada ya se cerró: salió un video o un carrusel de verdad.
   *
   * Solo significa algo cuando `porFuncion`. Es lo que el dueño pidió en sus
   * palabras: la prueba termina en cuanto el sistema le entrega una pieza
   * montada, no antes.
   */
  cerrada: boolean;
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
async function contar(
  negocioId: string,
  desde: Date | null,
  funcion: Funcion | null = null,
): Promise<number> {
  const donde = ["negocio_id = $1"];
  const valores: unknown[] = [negocioId];
  if (desde) {
    valores.push(desde.toISOString());
    donde.push(`creado >= $${valores.length}`);
  }
  if (funcion) {
    valores.push(funcion);
    donde.push(`funcion = $${valores.length}`);
  }
  const fila = await una<{ n: string }>(
    `select count(*) as n from corrida where ${donde.join(" and ")}`,
    valores,
  );
  return Number(fila?.n ?? 0);
}

/** De cuántas funciones distintas ya hay corrida. Es el avance de la pasada. */
async function funcionesUsadas(negocioId: string): Promise<number> {
  const fila = await una<{ n: string }>(
    `select count(distinct funcion) as n from corrida where negocio_id = $1`,
    [negocioId],
  );
  return Number(fila?.n ?? 0);
}

/**
 * ¿Ya salió una pieza de verdad?
 *
 * `entregado` se escribe al DESCARGAR, no al generar, así que esta pregunta es
 * exactamente «el sistema ya le entregó un video o un carrusel». Es lo que
 * cierra la prueba.
 */
async function yaEntrego(negocioId: string): Promise<boolean> {
  const fila = await una<{ n: string }>(
    `select count(*) as n from entregado where negocio_id = $1`,
    [negocioId],
  );
  return Number(fila?.n ?? 0) > 0;
}

function inicioDelMes(): Date {
  const hoy = new Date();
  return new Date(Date.UTC(hoy.getUTCFullYear(), hoy.getUTCMonth(), 1));
}

/**
 * La cuota de una cuenta.
 *
 * Con `funcion` responde por esa función; sin ella responde por la pasada
 * entera, que es lo que necesita la barra para pintar un contador que se
 * entienda («2/3» son dos de las tres funciones, no dos corridas de tres).
 */
export async function cuotaDe(
  usuarioId: string,
  negocioId: string | null,
  funcion: Funcion | null = null,
): Promise<Cuota> {
  const { plan, cortesia } = await planEnVigor(usuarioId);
  const porFuncion = plan.corridas_funcion !== null;

  const base = { plan, cortesia, porFuncion, cerrada: false };

  // Sin negocio guardado todavía no hay nada que contar.
  if (!negocioId) {
    const limite = porFuncion
      ? funcion
        ? plan.corridas_funcion
        : plan.corridas_funcion! * FUNCIONES.length
      : (plan.corridas_mes ?? plan.corridas_total);
    return { ...base, usadas: 0, limite, reinicia: null };
  }

  if (porFuncion) {
    const [usadas, cerrada] = await Promise.all([
      funcion ? contar(negocioId, null, funcion) : funcionesUsadas(negocioId),
      yaEntrego(negocioId),
    ]);
    return {
      ...base,
      cerrada,
      usadas,
      limite: funcion ? plan.corridas_funcion : plan.corridas_funcion! * FUNCIONES.length,
      reinicia: null,
    };
  }

  if (plan.corridas_total !== null) {
    return {
      ...base,
      usadas: await contar(negocioId, null),
      limite: plan.corridas_total,
      reinicia: null,
    };
  }

  const desde = inicioDelMes();
  const siguiente = new Date(Date.UTC(desde.getUTCFullYear(), desde.getUTCMonth() + 1, 1));
  return {
    ...base,
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
 *
 * `intermedio` marca los pasos que NO guardan corrida y que son parte de
 * terminar lo que ya se generó: transcribir para subtitular, buscar apoyos,
 * ordenar un párrafo. En la prueba esos pasos siguen abiertos hasta que la
 * pasada se cierra — si no, la cuenta se quedaba con un guion escrito y el
 * montaje bloqueado, que es tener el producto a medias en la mano.
 */
export async function revisarCuota(
  usuarioId: string,
  negocioId: string | null,
  funcion: Funcion,
  opciones: { intermedio?: boolean } = {},
): Promise<Veredicto> {
  const cuota = await cuotaDe(usuarioId, negocioId, funcion);

  if (cuota.porFuncion) {
    if (opciones.intermedio) {
      if (!cuota.cerrada) return { ok: true, cuota };
      return {
        ok: false,
        mensaje:
          "La prueba se cierra cuando el sistema te entrega la primera pieza, y ya la bajaste. " +
          "Todo lo hecho sigue en tu cuenta: se abre, se lee, se copia y se descarga.",
        cuota,
      };
    }
    if (cuota.limite === null || cuota.usadas < cuota.limite) return { ok: true, cuota };
    return {
      ok: false,
      mensaje:
        `La prueba trae una pasada por función y ya usaste la de ${NOMBRE_FUNCION[funcion]}. ` +
        "Sigue abierto: puedes abrir, leer, copiar y descargar lo que ya te generó.",
      cuota,
    };
  }

  if (cuota.limite === null || cuota.usadas < cuota.limite) return { ok: true, cuota };

  const mensaje =
    cuota.plan.corridas_total !== null
      ? "Este plan incluye un número fijo de corridas y ya se usaron. Lo que generaste sigue disponible: puedes abrirlo, leerlo y copiarlo cuando quieras."
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
