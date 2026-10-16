import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { consultar, una } from "@/lib/db";
import { GUARDADAS, deHex, imagenValida, paletaGuardada } from "@/lib/marca";
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
export async function negocioDe(usuarioId: string): Promise<NegocioGuardado | null> {
  const fila = await una<NegocioGuardado & Columnas>(
    `select id, tipo, nombre, oferta, cliente, despues, freno, accion, voz,
            senales, detalle, paleta_fondo, paleta_tinta, paleta_acento,
            handle, avatar, cuadricula, actualizado
       from negocio
      where usuario_id = $1`,
    [usuarioId],
  );
  return fila ? conPaleta(fila) : null;
}

/** Las tres columnas de la paleta, tal como salen de la base. */
type Columnas = {
  paleta_fondo?: string | null;
  paleta_tinta?: string | null;
  paleta_acento?: string | null;
};

/**
 * Tres columnas fuera, un objeto dentro.
 *
 * En la base son tres `text` porque un `check` las puede vigilar una por una;
 * en el resto del sistema es una paleta, que es lo que se dibuja. Las columnas
 * sueltas se quitan de la respuesta para que nadie acabe leyendo la mitad por
 * un sitio y la mitad por otro.
 */
function conPaleta(fila: NegocioGuardado & Columnas): NegocioGuardado {
  const paleta = paletaGuardada(fila);
  const limpio = { ...fila, paleta };
  delete limpio.paleta_fondo;
  delete limpio.paleta_tinta;
  delete limpio.paleta_acento;
  return limpio;
}

/** Vacío o los tres colores. Media paleta no se guarda: la vigila el `check`. */
function paletaValida(p: Negocio["paleta"]): [string, string, string] {
  if (!p) return ["", "", ""];
  const tres = [p.fondo, p.tinta, p.acento].map((c) => (c ?? "").trim());
  if (tres.some((c) => !deHex(c))) return ["", "", ""];
  return [tres[0].toUpperCase(), tres[1].toUpperCase(), tres[2].toUpperCase()];
}

/** Solo lo que la columna acepta. Lo de fuera entra como «no lo dijo». */
function tipoValido(t: unknown): TipoNegocio {
  return t === "empresa" || t === "persona" ? t : "";
}

export async function guardarNegocio(
  usuarioId: string,
  n: Negocio,
): Promise<NegocioGuardado> {
  const [fondo, tinta, acento] = paletaValida(n.paleta);
  const filas = await consultar<NegocioGuardado & Columnas>(
    `insert into negocio (usuario_id, tipo, nombre, oferta, cliente, despues, freno, accion, voz, senales,
                          detalle, paleta_fondo, paleta_tinta, paleta_acento,
                          handle, avatar, cuadricula)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
     on conflict (usuario_id) do update set
       tipo          = excluded.tipo,
       nombre        = excluded.nombre,
       oferta        = excluded.oferta,
       cliente       = excluded.cliente,
       despues       = excluded.despues,
       freno         = excluded.freno,
       accion        = excluded.accion,
       voz           = excluded.voz,
       senales       = excluded.senales,
       detalle       = excluded.detalle,
       paleta_fondo  = excluded.paleta_fondo,
       paleta_tinta  = excluded.paleta_tinta,
       paleta_acento = excluded.paleta_acento,
       handle        = excluded.handle,
       avatar        = excluded.avatar,
       cuadricula    = excluded.cuadricula
     returning id, tipo, nombre, oferta, cliente, despues, freno, accion, voz, senales,
               detalle, paleta_fondo, paleta_tinta, paleta_acento,
               handle, avatar, cuadricula, actualizado`,
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
      n.detalle?.trim() ?? "",
      fondo,
      tinta,
      acento,
      // El arroba se guarda sin «@»: lo pone quien lo pinta, y así no acaban
      // existiendo dos arrobas en las cuentas que lo escriben y las que no.
      (n.handle ?? "").trim().replace(/^@+/, "").slice(0, 99),
      imagenValida(n.avatar, GUARDADAS.avatar.tope),
      imagenValida(n.cuadricula, GUARDADAS.cuadricula.tope),
    ],
  );
  return conPaleta(filas[0]);
}

/**
 * Cambia SOLO lo de la marca, dejando el resto del negocio como está.
 *
 * Existe porque la cuadrícula se sube en el diagnóstico, y desde ahí no se
 * tiene el negocio entero: mandar un `insert ... on conflict` con lo que haya
 * en esa pantalla borraría la voz y las señales que el dueño llenó en otra.
 * Devuelve `false` si no hay negocio todavía — no se crea uno a medias.
 */
export async function guardarMarca(
  usuarioId: string,
  m: Pick<Negocio, "paleta" | "cuadricula" | "avatar" | "handle">,
): Promise<boolean> {
  const campos: string[] = [];
  const valores: unknown[] = [usuarioId];
  const poner = (columna: string, valor: string) => {
    valores.push(valor);
    campos.push(`${columna} = $${valores.length}`);
  };

  if (m.paleta !== undefined) {
    const [fondo, tinta, acento] = paletaValida(m.paleta);
    poner("paleta_fondo", fondo);
    poner("paleta_tinta", tinta);
    poner("paleta_acento", acento);
  }
  if (m.cuadricula !== undefined) {
    poner("cuadricula", imagenValida(m.cuadricula, GUARDADAS.cuadricula.tope));
  }
  if (m.avatar !== undefined) {
    poner("avatar", imagenValida(m.avatar, GUARDADAS.avatar.tope));
  }
  if (m.handle !== undefined) {
    poner("handle", m.handle.trim().replace(/^@+/, "").slice(0, 99));
  }
  if (!campos.length) return false;

  const filas = await consultar<{ id: string }>(
    `update negocio set ${campos.join(", ")} where usuario_id = $1 returning id`,
    valores,
  );
  return filas.length > 0;
}
