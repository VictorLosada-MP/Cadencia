/**
 * La cadena de conexión de Postgres, arreglada antes de usarla.
 *
 * Las contraseñas que generan los proveedores llevan símbolos, y dentro de una
 * URL algunos significan otra cosa: un `@` parte la cadena donde no toca y un
 * `%` suelto hace reventar al driver cuando la descifra. Pedirle al dueño que
 * codifique eso a mano es exportarle un problema que aquí se resuelve una vez.
 */

/** Separa la cadena en sus piezas. El host no puede llevar `@`, así que el
 *  último `@` es siempre el que divide credenciales de servidor. */
function partir(url) {
  const i = url.indexOf("://");
  if (i < 0) return null;

  const esquema = url.slice(0, i + 3);
  const resto = url.slice(i + 3);
  const corte = resto.lastIndexOf("@");
  if (corte < 0) return { esquema, usuario: "", clave: "", servidor: resto, credenciales: false };

  const credenciales = resto.slice(0, corte);
  const servidor = resto.slice(corte + 1);
  const dosPuntos = credenciales.indexOf(":");

  return dosPuntos < 0
    ? { esquema, usuario: credenciales, clave: "", servidor, credenciales: true }
    : {
        esquema,
        usuario: credenciales.slice(0, dosPuntos),
        clave: credenciales.slice(dosPuntos + 1),
        servidor,
        credenciales: true,
      };
}

const SUELTO = /%(?![0-9A-Fa-f]{2})/;
const PARTEN = "@/?#[]";

/** ¿Este trozo ya se puede meter tal cual en una URL? */
function yaEstaBien(trozo) {
  return !SUELTO.test(trozo) && ![...trozo].some((c) => PARTEN.includes(c));
}

/**
 * Devuelve la cadena lista para el driver. Si el usuario o la contraseña traen
 * símbolos sin codificar, los codifica; si ya venían codificados, no los toca
 * —volver a codificar convertiría `%40` en `%2540`—.
 */
export function normalizarURL(url) {
  const p = partir(url);
  if (!p || !p.credenciales) return url;

  const usuario = yaEstaBien(p.usuario) ? p.usuario : encodeURIComponent(p.usuario);
  const clave = yaEstaBien(p.clave) ? p.clave : encodeURIComponent(p.clave);

  return `${p.esquema}${usuario}${p.clave === "" ? "" : `:${clave}`}@${p.servidor}`;
}

/**
 * Qué le pasa al hueco de la contraseña, si es que le pasa algo.
 *
 * Son dos errores distintos y hay que decirlos distinto: no haberla puesto, y
 * haberla puesto dejando los corchetes de la plantilla. El segundo es el que
 * más despista, porque quien lo hace ya cambió el texto y le dicen que no.
 */
export function revisarClave(url) {
  const clave = partir(url)?.clave ?? "";

  if (/YOUR-PASSWORD/i.test(clave)) {
    return {
      ok: false,
      motivo: "DATABASE_URL todavía trae el hueco de la plantilla",
      arreglo: "cambia [YOUR-PASSWORD] por tu contraseña, y quita también los corchetes",
    };
  }
  if (/^\[.*\]$/s.test(clave)) {
    return {
      ok: false,
      motivo: "la contraseña está entre corchetes",
      arreglo:
        "quita el [ y el ] que rodean la contraseña. Los corchetes eran de la plantilla de " +
        "Supabase, no parte de la clave — el resto de la línea está bien",
    };
  }
  if (clave.includes("[") || clave.includes("]")) {
    return {
      ok: false,
      motivo: "la contraseña lleva un corchete suelto",
      arreglo: "quita los corchetes: eran de la plantilla de Supabase",
    };
  }
  return { ok: true };
}

export function servidorDe(url) {
  return new URL(normalizarURL(url)).hostname;
}
