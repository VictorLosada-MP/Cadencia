import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { consultar, una } from "@/lib/db";
import type { Negocio } from "@/types/negocio";

export type NegocioGuardado = Negocio & {
  id: string;
  nombre: string;
  actualizado: string;
};

/** El usuario de esta petición, o null. Nunca se deduce del cuerpo. */
export async function usuarioActual() {
  const s = await auth().api.getSession({ headers: await headers() });
  return s?.user ?? null;
}

/**
 * El negocio de un usuario.
 *
 * `usuario_id` va siempre en el WHERE, no como comprobación aparte. Sin eso,
 * con doscientos negocios dentro, pedir el id de otro devolvería su oferta, su
 * cliente y sus muestras de voz redactadas como diagnóstico.
 */
export function negocioDe(usuarioId: string) {
  return una<NegocioGuardado>(
    `select id, oferta, cliente, despues, freno, accion, voz, nombre,
            actualizado
       from negocio
      where usuario_id = $1`,
    [usuarioId],
  );
}

export async function guardarNegocio(
  usuarioId: string,
  n: Negocio & { nombre?: string },
): Promise<NegocioGuardado> {
  const filas = await consultar<NegocioGuardado>(
    `insert into negocio (usuario_id, oferta, cliente, despues, freno, accion, voz, nombre)
     values ($1, $2, $3, $4, $5, $6, $7, $8)
     on conflict (usuario_id) do update set
       oferta  = excluded.oferta,
       cliente = excluded.cliente,
       despues = excluded.despues,
       freno   = excluded.freno,
       accion  = excluded.accion,
       voz     = excluded.voz,
       nombre  = excluded.nombre
     returning id, oferta, cliente, despues, freno, accion, voz, nombre, actualizado`,
    [
      usuarioId,
      n.oferta.trim(),
      n.cliente.trim(),
      n.despues.trim(),
      n.freno?.trim() ?? "",
      n.accion?.trim() ?? "",
      n.voz?.trim() ?? "",
      n.nombre?.trim() ?? "",
    ],
  );
  return filas[0];
}
