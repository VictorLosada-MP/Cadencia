import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { consultar, una } from "@/lib/db";
import type { Negocio, TipoNegocio } from "@/types/negocio";

export type NegocioGuardado = Negocio & {
  id: string;
  tipo: TipoNegocio;
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
    `select id, tipo, nombre, oferta, cliente, despues, freno, accion, voz,
            senales, actualizado
       from negocio
      where usuario_id = $1`,
    [usuarioId],
  );
}

/** Solo lo que la columna acepta. Lo de fuera entra como «no lo dijo». */
function tipoValido(t: unknown): TipoNegocio {
  return t === "empresa" || t === "persona" ? t : "";
}

export async function guardarNegocio(
  usuarioId: string,
  n: Negocio,
): Promise<NegocioGuardado> {
  const filas = await consultar<NegocioGuardado>(
    `insert into negocio (usuario_id, tipo, nombre, oferta, cliente, despues, freno, accion, voz, senales)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     on conflict (usuario_id) do update set
       tipo    = excluded.tipo,
       nombre  = excluded.nombre,
       oferta  = excluded.oferta,
       cliente = excluded.cliente,
       despues = excluded.despues,
       freno   = excluded.freno,
       accion  = excluded.accion,
       voz     = excluded.voz,
       senales = excluded.senales
     returning id, tipo, nombre, oferta, cliente, despues, freno, accion, voz, senales, actualizado`,
    [
      usuarioId,
      tipoValido(n.tipo),
      n.nombre?.trim() ?? "",
      n.oferta.trim(),
      n.cliente.trim(),
      n.despues.trim(),
      n.freno?.trim() ?? "",
      n.accion?.trim() ?? "",
      n.voz?.trim() ?? "",
      n.senales?.trim() ?? "",
    ],
  );
  return filas[0];
}
