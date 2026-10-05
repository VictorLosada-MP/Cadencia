#!/usr/bin/env node
/**
 * Quién administra. Es la llave de verdad del panel.
 *
 * La dirección secreta del panel no autoriza nada por sí sola: deja de ser
 * secreta en cuanto se escribe en un chat o se queda en el historial del
 * navegador. Lo que de verdad abre la puerta es esto.
 *
 *   npm run rol                              → quién administra hoy
 *   npm run rol -- correo@x.com admin        → se lo da
 *   npm run rol -- correo@x.com quitar       → se lo quita
 *
 * Esto no crea ninguna cuenta ni ninguna forma distinta de entrar: la cuenta se
 * crea en /entrar como la de cualquiera, y se entra igual que cualquiera. Un
 * rol es un permiso ENCIMA de una cuenta normal.
 *
 * Y es exactamente lo mismo que correr esto en el SQL del proveedor, por si no
 * tienes la base a mano desde aquí:
 *
 *   update "user" set role = 'admin' where lower(email) = 'tu@correo.com';
 */
import { cargarEnv, opcionesSSL, revisarURL } from "./entorno.mjs";
import { normalizarURL } from "../lib/postgres-url.mjs";
import { Pool } from "pg";

const { valores: env } = cargarEnv();
const url = env.DATABASE_URL ?? process.env.DATABASE_URL;
const veredicto = revisarURL(url);
if (!veredicto.ok) {
  console.error(`\n  ${veredicto.motivo}`);
  if (veredicto.arreglo) console.error(`  → ${veredicto.arreglo}\n`);
  process.exit(1);
}

const [correo, rol] = process.argv.slice(2);
const pool = new Pool({ connectionString: normalizarURL(url), ssl: opcionesSSL(url) });

try {
  if (!correo) {
    const { rows } = await pool.query(
      `select email, role from "user" where role is not null and role <> '' order by email`,
    );
    console.log(
      rows.length
        ? `\nAdministran:\n${rows.map((r) => `  ${r.email}  (${r.role})`).join("\n")}\n`
        : "\nNadie administra todavía. Sin esto, el panel no se abre para nadie.\n",
    );
    console.log("  npm run rol -- correo@x.com admin\n");
    process.exit(0);
  }

  const { rows } = await pool.query('select id from "user" where lower(email) = lower($1)', [
    correo,
  ]);
  if (!rows.length) {
    console.error(`\nNo hay ninguna cuenta con ${correo}.\n`);
    process.exit(1);
  }

  const quitar = !rol || rol === "quitar";
  await pool.query('update "user" set role = $2 where id = $1', [
    rows[0].id,
    quitar ? null : rol,
  ]);
  console.log(
    quitar
      ? `\n${correo} ya no administra. La cuenta sigue igual para todo lo demás.\n`
      : `\n${correo} administra (role = ${rol}).\n`,
  );
} catch (e) {
  console.error(`\nNo se pudo: ${e.message}\n`);
  process.exitCode = 1;
} finally {
  await pool.end();
}
