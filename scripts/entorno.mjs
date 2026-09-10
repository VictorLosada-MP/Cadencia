/** Lo que comparten los scripts: leer .env y decidir el TLS de la conexión. */
import fs from "node:fs";
import path from "node:path";

/** Lee .env.local y .env sin depender de ningún paquete. Nunca imprime nada. */
export function cargarEnv(raiz = process.cwd()) {
  const env = {};
  for (const archivo of [".env.local", ".env"]) {
    const ruta = path.join(raiz, archivo);
    if (!fs.existsSync(ruta)) continue;
    for (const linea of fs.readFileSync(ruta, "utf8").split("\n")) {
      const m = linea.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)$/);
      if (!m) continue;
      const valor = m[2].trim().replace(/^["']|["']$/g, "");
      if (valor && !(m[1] in env)) env[m[1]] = valor;
    }
  }
  return env;
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
