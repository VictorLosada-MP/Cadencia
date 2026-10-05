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

/** El usuario de esta petición, solo si administra. */
export async function adminActual() {
  const u = await usuarioActual();
  if (!u) return null;
  const fila = await una<{ role: string | null }>(
    `select role from "user" where id = $1`,
    [u.id],
  );
  return fila?.role === "admin" ? u : null;
}

/**
 * Las cuentas, con lo que hace falta para decidir.
 *
 * Una sola consulta con subconsultas y no una por cuenta: con doscientas
 * cuentas, lo segundo son seiscientas idas y vueltas a la base para pintar una
 * tabla.
 */
export function cuentas(): Promise<Cuenta[]> {
  return consultar<Cuenta>(
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
      order by u."createdAt" desc
      limit 500`,
  );
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
