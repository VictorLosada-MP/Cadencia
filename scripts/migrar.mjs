#!/usr/bin/env node
/**
 * Corre las migraciones de db/ en orden, una sola vez cada una.
 *
 * En Node y no con psql a propósito: psql no viene instalado en Windows ni en
 * medio mundo, y pedirle a alguien que instale una herramienta de línea de
 * comandos para arrancar un proyecto es una barrera que no hace falta.
 */
import fs from "node:fs";
import path from "node:path";
import { cargarEnv, opcionesSSL, revisarClaveEnURL } from "./entorno.mjs";
import { Pool } from "pg";

const RAIZ = process.cwd();


const { valores: env } = cargarEnv();

const url = env.DATABASE_URL ?? process.env.DATABASE_URL;
if (!url || !/^postgres(ql)?:\/\//.test(url)) {
  console.error("\nFalta DATABASE_URL, o no es una cadena de Postgres.");
  console.error("Corre `npm run comprobar`: te dice qué archivo leyó y qué encontró.\n");
  process.exit(1);
}

const clave = revisarClaveEnURL(url);
if (!clave.ok) {
  console.error("\nLa contraseña dentro de DATABASE_URL lleva caracteres que parten la cadena.");
  console.error("Corre `npm run comprobar` para el detalle y cómo arreglarlo.\n");
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
  await pool.query(`
    create table if not exists migracion (
      nombre   text primary key,
      aplicada timestamptz not null default now()
    )`);

  const { rows } = await pool.query("select nombre from migracion");
  const hechas = new Set(rows.map((r) => r.nombre));

  let nuevas = 0;
  for (const archivo of archivos) {
    if (hechas.has(archivo)) {
      console.log(`  ya estaba   ${archivo}`);
      continue;
    }
    const sql = fs.readFileSync(path.join(RAIZ, "db", archivo), "utf8");
    const cliente = await pool.connect();
    try {
      // Cada migración va entera o no va: a medias es peor que no correrla.
      await cliente.query("begin");
      await cliente.query(sql);
      await cliente.query("insert into migracion (nombre) values ($1)", [archivo]);
      await cliente.query("commit");
      console.log(`  aplicada    ${archivo}`);
      nuevas++;
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
      nuevas === 0
        ? "\nNada que hacer: la base ya está al día.\n"
        : `\n${nuevas} ${nuevas === 1 ? "migración aplicada" : "migraciones aplicadas"}. Arranca con: npm run dev\n`,
    );
  }
} catch (e) {
  console.error(`\nNo se pudo conectar: ${e.message}\n`);
  process.exitCode = 1;
} finally {
  await pool.end().catch(() => {});
}
