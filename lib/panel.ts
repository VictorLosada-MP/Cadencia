import { consultar, una } from "@/lib/db";
import { usuarioActual } from "@/lib/negocio";
import { VIP, type Cuenta } from "@/types/panel";

/**
 * El panel de administración: quién entra y qué puede hacer.
 *
 * Dos cerrojos, y hace falta pasar los dos.
 *
 * **La llave de la URL** (`PANEL_LLAVE`) no deja ni ver que el panel existe:
 * sin ella la ruta devuelve un 404 igual que cualquier dirección inventada. No
 * va escrita en el repositorio a propósito — una ruta fija en el código la sabe
 * cualquiera que lea el código, y el código se puede leer.
 *
 * **El rol** es el que de verdad protege. Una URL secreta deja de serlo en
 * cuanto se escribe en un chat, se queda en el historial del navegador o viaja
 * en un `Referer`. Por eso la llave no autoriza nada por sí sola: hace falta
 * además una sesión iniciada cuyo `role` sea `admin`.
 *
 * Lo que el panel NO hace, y es deliberado: no borra cuentas, no edita
 * negocios, no lee guiones. Mirar y regalar el VIP. Un panel que lo puede todo
 * es un panel del que hay que fiarse siempre; uno que solo hace dos cosas se
 * audita en un minuto.
 */

/** Verdad solo si la llave de la URL es la del entorno. */
export function llaveCorrecta(llave: string): boolean {
  const buena = process.env.PANEL_LLAVE?.trim();
  // Sin llave configurada el panel no existe. Que un despliegue sin variable
  // abriera la puerta sería el peor valor por defecto posible.
  if (!buena || buena.length < 16) return false;
  return llave === buena;
}

export async function esAdmin(usuarioId: string): Promise<boolean> {
  const fila = await una<{ role: string | null }>(
    `select role from "user" where id = $1`,
    [usuarioId],
  );
  return fila?.role === "admin";
}

/** El usuario de esta petición, solo si administra. */
export async function adminActual() {
  const u = await usuarioActual();
  if (!u) return null;
  return (await esAdmin(u.id)) ? u : null;
}

/**
 * La dirección del panel, para enseñársela a quien ya puede entrar.
 *
 * Quien administra no tiene por qué acordarse de una dirección de treinta
 * caracteres ni guardarla en un marcador. Se le pinta en la barra y ya está —
 * y solo a él: esto devuelve null para todos los demás, así que la llave nunca
 * llega al navegador de quien no la podría usar igualmente.
 */
export function enlaceDelPanel(): string | null {
  const llave = process.env.PANEL_LLAVE?.trim();
  return llave && llave.length >= 16 ? `/panel/${llave}` : null;
}

/** Cuántas caben en una pantalla sin tener que buscar con el dedo. */
export const POR_PAGINA = 25;

export type Pagina = {
  lista: Cuenta[];
  /** Cuántas cuentas casan con la búsqueda, no cuántas vienen en esta página. */
  total: number;
};

export type Resumen = {
  cuentas: number;
  con_negocio: number;
  vips: number;
  corridas_mes: number;
};

/**
 * Las cuatro cifras de arriba, de TODAS las cuentas.
 *
 * Aparte de la lista a propósito: si salieran de contar las filas que se
 * pintan, el día que haya mil cuentas dirían «25 cuentas» con toda la cara.
 */
export function resumen(): Promise<Resumen | null> {
  return una<Resumen>(
    `select count(*)::int as cuentas,
            count(n.id)::int as con_negocio,
            count(*) filter (
              where s.cortesia_plan = $1
                and (s.cortesia_hasta is null or s.cortesia_hasta > now())
            )::int as vips,
            (select count(*)::int from corrida
              where creado >= date_trunc('month', now())) as corridas_mes
       from "user" u
       left join negocio n     on n.usuario_id = u.id
       left join suscripcion s on s.usuario_id = u.id`,
    [VIP],
  );
}

/**
 * Una página de cuentas, con lo que hace falta para decidir.
 *
 * Se pagina y se busca EN LA BASE, no en el navegador. Traer las mil cuentas
 * con su oferta, su cliente y su después para enseñar veinticinco son varios
 * megas de prosa en cada carga, y una búsqueda que solo encuentra lo que ya se
 * había bajado no es una búsqueda.
 *
 * Y una sola consulta con subconsultas, no una por cuenta: lo segundo son
 * setenta y cinco idas y vueltas a la base para pintar una tabla.
 */
export async function cuentas(
  { busca = "", pagina = 0 }: { busca?: string; pagina?: number } = {},
): Promise<Pagina> {
  const q = busca.trim().slice(0, 120);
  // `%` y `_` son comodines de LIKE: sin escaparlos, buscar «100_%» traería
  // cosas que no se parecen en nada a lo que se escribió.
  const patron = q ? `%${q.replace(/[\\%_]/g, (c) => "\\" + c)}%` : null;
  const desde = Math.max(0, Math.floor(pagina)) * POR_PAGINA;

  const donde = patron
    ? `where u.email ilike $1 escape '\\'
          or u.name  ilike $1 escape '\\'
          or n.oferta ilike $1 escape '\\'
          or n.nombre ilike $1 escape '\\'`
    : "";

  const [lista, cuenta] = await Promise.all([
    consultar<Cuenta>(
      `select u.id,
              u.email,
              u.name                        as nombre,
              u."createdAt"                 as creado,
              n.id                          as negocio_id,
              n.oferta, n.cliente, n.despues,
              n.nombre                      as negocio_nombre,
              coalesce(s.plan_id, 'prueba') as plan,
              case
                when s.cortesia_plan is not null
                 and (s.cortesia_hasta is null or s.cortesia_hasta > now())
                then s.cortesia_plan
              end                           as cortesia,
              s.cortesia_hasta,
              (select count(*) from corrida c
                where c.negocio_id = n.id
                  and c.creado >= date_trunc('month', now()))::int as corridas_mes,
              (select count(*) from corrida c where c.negocio_id = n.id)::int as corridas_total,
              (select count(*) from entregado e where e.negocio_id = n.id)::int as entregados,
              (select max(c.creado) from corrida c where c.negocio_id = n.id) as ultima
         from "user" u
         left join negocio n     on n.usuario_id = u.id
         left join suscripcion s on s.usuario_id = u.id
         ${donde}
        order by u."createdAt" desc
        limit ${POR_PAGINA} offset ${desde}`,
      patron ? [patron] : [],
    ),
    una<{ n: number }>(
      `select count(*)::int as n
         from "user" u
         left join negocio n     on n.usuario_id = u.id
         left join suscripcion s on s.usuario_id = u.id
         ${donde}`,
      patron ? [patron] : [],
    ),
  ]);

  return { lista, total: cuenta?.n ?? lista.length };
}

/**
 * Regala el VIP, o lo retira.
 *
 * Retirarlo NO le quita su plan: la cortesía apunta a un plan aparte y lo que
 * se borra es el regalo, así que la cuenta cae en lo que de verdad tenía. Esa
 * es toda la razón de que el VIP sea una cortesía y no un cambio de plan —
 * poder deshacerlo sin tener que acordarse de qué tenía antes.
 */
export async function ponerVip(usuarioId: string, quien: string): Promise<void> {
  await una(
    `insert into suscripcion (usuario_id, plan_id, cortesia_plan, cortesia_motivo, cortesia_por)
          values ($1, 'prueba', $2, 'Cliente de la marca', $3)
     on conflict (usuario_id) do update
            set cortesia_plan   = excluded.cortesia_plan,
                cortesia_hasta  = null,
                cortesia_motivo = excluded.cortesia_motivo,
                cortesia_por    = excluded.cortesia_por`,
    [usuarioId, VIP, quien],
  );
}

export async function quitarVip(usuarioId: string): Promise<void> {
  await una(
    `update suscripcion
        set cortesia_plan = null, cortesia_hasta = null,
            cortesia_motivo = '', cortesia_por = null
      where usuario_id = $1`,
    [usuarioId],
  );
}
