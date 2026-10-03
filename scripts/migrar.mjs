#!/usr/bin/env node
/**
 * Corre los archivos de db/ en orden. Todos, cada vez.
 *
 * No hay cuaderno que lleve la cuenta de cuáles ya pasaron: las consultas viven
 * en el código y el esquema vive en db/, así que una tabla que solo guardaba
 * nombres de archivo era una pieza más que mantener para no repetir un trabajo
 * que es barato repetir.
 *
 * El trato que eso impone, y es el único que lo sostiene: **cada archivo de db/
 * tiene que poder correrse dos veces seguidas sin cambiar el resultado.**
 * `create table if not exists`, `add column if not exists`, `create or replace`,
 * `on conflict do nothing`. Una orden que no aguante repetirse —un `insert` sin
 * conflicto, un `update` que suma en vez de fijar— corrompería los datos en el
 * siguiente despliegue y sin avisar.
 *
 * En Node y no con psql a propósito: psql no viene instalado en Windows ni en
 * medio mundo, y pedirle a alguien que instale una herramienta de línea de
 * comandos para arrancar un proyecto es una barrera que no hace falta.
 */
import fs from "node:fs";
import path from "node:path";
import { cargarEnv, opcionesSSL, revisarURL } from "./entorno.mjs";
import { Pool } from "pg";

const RAIZ = process.cwd();


const { valores: env } = cargarEnv();

const url = env.DATABASE_URL ?? process.env.DATABASE_URL;
const veredicto = revisarURL(url);
if (!veredicto.ok) {
  console.error(`\n  ${veredicto.motivo}`);
  if (veredicto.arreglo) console.error(`  → ${veredicto.arreglo}\n`);
  process.exit(1);
}

const pool = new Pool({
  connectionString: url,
  ssl: opcionesSSL(url),
  connectionTimeoutMillis: 15_000,
});

const archivos = fs
  .readdirSync(path.join(RAIZ, "db"))
  .filter((f) => f.endsWith(".sql"))
  .sort();

try {
  let hechos = 0;
  for (const archivo of archivos) {
    const sql = fs.readFileSync(path.join(RAIZ, "db", archivo), "utf8");
    const cliente = await pool.connect();
    try {
      // Cada archivo va entero o no va: a medias es peor que no correrlo.
      await cliente.query("begin");
      await cliente.query(sql);
      await cliente.query("commit");
      console.log(`  ok   ${archivo}`);
      hechos++;
    } catch (e) {
      await cliente.query("rollback").catch(() => {});
      console.error(`\n  FALLÓ       ${archivo}`);
      console.error(`  ${e.message}\n`);
      console.error("  No se aplicó nada de ese archivo. La base queda como estaba.\n");
      process.exitCode = 1;
      break;
    } finally {
      cliente.release();
    }
  }

  if (!process.exitCode) {
    console.log(
      `\n${hechos} ${hechos === 1 ? "archivo" : "archivos"} al día. Arranca con: npm run dev\n`,
    );
  }
} catch (e) {
  console.error(`\nNo se pudo conectar: ${e.message}\n`);
  process.exitCode = 1;
} finally {
  await pool.end().catch(() => {});
}
