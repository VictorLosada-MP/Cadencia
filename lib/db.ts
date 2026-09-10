import { readFileSync } from "node:fs";
import { Pool } from "pg";

/**
 * La única capa que sabe dónde viven los datos.
 *
 * Es SQL plano contra Postgres a propósito: sin cliente del proveedor y sin
 * extensiones propietarias, mudarse de Supabase a un servidor propio es cambiar
 * DATABASE_URL y nada más. La misma independencia que lib/modelo.ts le da al
 * proveedor de IA, aplicada a los datos.
 */

declare global {
  // En desarrollo el módulo se recarga en cada cambio; sin esto cada recarga
  // abriría un pool nuevo y acabaría agotando las conexiones de Supabase.
  var __cadenciaPool: Pool | undefined;
}

function crearPool(): Pool {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "Falta DATABASE_URL en .env.local. Corre `npm run comprobar` para ver qué falta.",
    );
  }
  // Supabase y cualquier Postgres administrado exigen TLS. Sin el certificado
  // raíz del proveedor la conexión va cifrada pero no se verifica quién está al
  // otro lado; con PGSSLROOTCERT apuntando a ese certificado, sí se verifica.
  const local = /^(localhost|127\.0\.0\.1|\[::1\])$/.test(new URL(url).hostname);
  const raiz = process.env.PGSSLROOTCERT;

  return new Pool({
    connectionString: url,
    ssl: local
      ? undefined
      : raiz
        ? { ca: readFileSync(raiz, "utf8"), rejectUnauthorized: true }
        : { rejectUnauthorized: false },
    max: 5,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
  });
}

export function pool(): Pool {
  if (!globalThis.__cadenciaPool) globalThis.__cadenciaPool = crearPool();
  return globalThis.__cadenciaPool;
}

export async function consultar<T>(sql: string, valores: unknown[] = []): Promise<T[]> {
  const r = await pool().query(sql, valores);
  return r.rows as T[];
}

/** La primera fila, o null. Para los muchos casos en que se busca una sola. */
export async function una<T>(sql: string, valores: unknown[] = []): Promise<T | null> {
  const filas = await consultar<T>(sql, valores);
  return filas[0] ?? null;
}
