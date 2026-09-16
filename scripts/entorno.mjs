/** Lo que comparten los scripts: leer .env y decidir el TLS de la conexión. */
import fs from "node:fs";
import path from "node:path";
import { normalizarURL, revisarClave } from "../lib/postgres-url.mjs";

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
  const repetidas = new Set();

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
      if (!valor) continue;
      // Una variable escrita dos veces es casi siempre una edición a medias: se
      // queda la última, que es lo que la persona acaba de escribir, y se avisa.
      if (m[1] in valores) repetidas.add(m[1]);
      valores[m[1]] = valor;
    }

    fuentes.push({ archivo, codificacion, encontradas, bytes: fs.statSync(ruta).size });
  }

  return { valores, fuentes, repetidas: [...repetidas] };
}

/**
 * Un Postgres en tu propia máquina no habla TLS y se atraganta si se lo pides;
 * uno administrado lo exige. La misma regla que aplica lib/db.ts, para que un
 * script no diga que algo falla cuando en la app funciona.
 */
export function opcionesSSL(url) {
  const host = new URL(normalizarURL(url)).hostname;
  const local = /^(localhost|127\.0\.0\.1|\[::1\]|::1)$/.test(host);
  return local ? undefined : { rejectUnauthorized: false };
}

/**
 * El veredicto sobre DATABASE_URL, en un solo sitio, para que `migrar` y
 * `comprobar` no puedan decir cosas distintas del mismo archivo.
 */
export function revisarURL(url) {
  if (!url) {
    return {
      ok: false,
      motivo: "DATABASE_URL vacía",
      arreglo: "en Supabase: botón Connect (arriba) → Connection string → Transaction pooler",
    };
  }
  if (url.startsWith("https://")) {
    return {
      ok: false,
      motivo: "DATABASE_URL es la dirección de la API, no la de Postgres",
      arreglo: "empieza por postgresql://, no por https://. Es otra pantalla: Connect → Connection string",
    };
  }
  if (!/^postgres(ql)?:\/\//.test(url)) {
    return {
      ok: false,
      motivo: "DATABASE_URL no parece una cadena de Postgres",
      arreglo: "tiene que empezar por postgresql://",
    };
  }
  const clave = revisarClave(url);
  if (!clave.ok) return clave;
  try {
    new URL(normalizarURL(url));
  } catch {
    return {
      ok: false,
      motivo: "DATABASE_URL no se puede interpretar",
      arreglo: "vuelve a copiarla entera desde Supabase",
    };
  }
  return { ok: true };
}
