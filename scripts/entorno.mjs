/** Lo que comparten los scripts: leer .env y decidir el TLS de la conexión. */
import fs from "node:fs";
import path from "node:path";

const LINEA = /^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/;

/**
 * Lee el texto de un .env venga como venga.
 *
 * Windows es el motivo de casi todo lo que hay aquí: el Bloc de notas y
 * PowerShell guardan en UTF-16, y git deja los archivos con saltos CRLF. Un
 * lector que solo entienda UTF-8 con saltos LF le dice a alguien que su archivo
 * está vacío cuando lo tiene lleno.
 */
function leerTexto(ruta) {
  const bytes = fs.readFileSync(ruta);

  if (bytes[0] === 0xff && bytes[1] === 0xfe) {
    return { texto: bytes.subarray(2).toString("utf16le"), codificacion: "UTF-16" };
  }
  if (bytes[0] === 0xfe && bytes[1] === 0xff) {
    const volteado = Buffer.from(bytes.subarray(2));
    volteado.swap16();
    return { texto: volteado.toString("utf16le"), codificacion: "UTF-16" };
  }
  // UTF-16 sin marca: los caracteres normales dejan un byte cero de por medio.
  if (bytes.length > 4 && bytes[1] === 0x00 && bytes[3] === 0x00) {
    return { texto: bytes.toString("utf16le"), codificacion: "UTF-16" };
  }

  let texto = bytes.toString("utf8");
  if (texto.charCodeAt(0) === 0xfeff) texto = texto.slice(1);
  return { texto, codificacion: "UTF-8" };
}

/**
 * Lee .env.local y .env sin depender de ningún paquete. Nunca imprime nada.
 * Devuelve también qué archivos leyó y cuántas variables sacó de cada uno, que
 * es lo único que permite explicar un "no encuentro nada".
 */
export function cargarEnv(raiz = process.cwd()) {
  const valores = {};
  const fuentes = [];

  for (const archivo of [".env.local", ".env"]) {
    const ruta = path.join(raiz, archivo);
    if (!fs.existsSync(ruta)) continue;

    const { texto, codificacion } = leerTexto(ruta);
    let encontradas = 0;

    for (const linea of texto.split(/\r?\n/)) {
      if (!linea.trim() || linea.trim().startsWith("#")) continue;
      const m = linea.match(LINEA);
      if (!m) continue;
      encontradas++;
      const valor = m[2].replace(/^["']|["']$/g, "");
      if (valor && !(m[1] in valores)) valores[m[1]] = valor;
    }

    fuentes.push({ archivo, codificacion, encontradas, bytes: fs.statSync(ruta).size });
  }

  return { valores, fuentes };
}

/**
 * Un Postgres en tu propia máquina no habla TLS y se atraganta si se lo pides;
 * uno administrado lo exige. La misma regla que aplica lib/db.ts, para que un
 * script no diga que algo falla cuando en la app funciona.
 */
export function opcionesSSL(url) {
  const local = /^(localhost|127\.0\.0\.1|\[::1\]|::1)$/.test(new URL(url).hostname);
  return local ? undefined : { rejectUnauthorized: false };
}

/**
 * Una contraseña con caracteres especiales dentro de la cadena de conexión es
 * la trampa más común: el `@` parte la cadena donde no toca, y un `%` suelto
 * hace que el driver reviente al descifrarla.
 */
export function revisarClaveEnURL(url) {
  const resto = url.slice(url.indexOf("://") + 3);
  const corte = resto.lastIndexOf("@");
  if (corte < 0) return { ok: true };

  const credenciales = resto.slice(0, corte);
  const dosPuntos = credenciales.indexOf(":");
  if (dosPuntos < 0) return { ok: true };

  const clave = credenciales.slice(dosPuntos + 1);
  const conflictivos = [...new Set([...clave].filter((c) => "@/?#[]".includes(c)))];
  const porcentajeSuelto = /%(?![0-9A-Fa-f]{2})/.test(clave);

  if (!conflictivos.length && !porcentajeSuelto) return { ok: true };
  return { ok: false, conflictivos, porcentajeSuelto };
}
