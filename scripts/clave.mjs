#!/usr/bin/env node
/**
 * Cambia la contraseña de una cuenta directamente en la base.
 *
 * Es la llave maestra del dueño de la base de datos, para cuando no hay
 * proveedor de correo montado y hace falta entrar ya. No sustituye al flujo de
 * recuperación de la app: ese va por correo y con enlace de un solo uso.
 *
 *   npm run clave                      → lista las cuentas
 *   npm run clave correo@ejemplo.com   → le pone una contraseña nueva al azar
 *   npm run clave correo@ejemplo.com miClaveNueva
 */
import { Pool } from "pg";
import { randomBytes } from "node:crypto";
import { hashPassword } from "better-auth/crypto";
import { cargarEnv, opcionesSSL } from "./entorno.mjs";
import { normalizarURL } from "../lib/postgres-url.mjs";

const { valores: env } = cargarEnv();
const url = env.DATABASE_URL;

if (!url || !/^postgres(ql)?:\/\//.test(url)) {
  console.error("\nFalta DATABASE_URL. Corre `npm run comprobar`.\n");
  process.exit(1);
}

const [correo, claveDada] = process.argv.slice(2);
const pool = new Pool({ connectionString: normalizarURL(url), ssl: opcionesSSL(url) });

try {
  if (!correo) {
    const { rows } = await pool.query(
      `select u.email, u.name, u."createdAt",
              (select count(*) from negocio n where n.usuario_id = u.id) as negocios
         from "user" u order by u."createdAt"`,
    );
    if (!rows.length) {
      console.log("\nNo hay ninguna cuenta todavía.\n");
    } else {
      console.log("\nCuentas en esta base:\n");
      for (const r of rows) {
        const fecha = new Date(r.createdAt).toISOString().slice(0, 10);
        const negocio = Number(r.negocios) > 0 ? "con negocio" : "sin negocio";
        console.log(`  ${r.email}   ${fecha} · ${negocio}`);
      }
      console.log("\nPara cambiarle la contraseña a una:");
      console.log("  npm run clave -- correo@ejemplo.com\n");
    }
    process.exit(0);
  }

  const { rows } = await pool.query('select id from "user" where lower(email) = lower($1)', [
    correo,
  ]);
  if (!rows.length) {
    console.error(`\nNo hay ninguna cuenta con ${correo}.`);
    console.error("Corre `npm run clave` sin argumentos para ver las que sí hay.\n");
    process.exit(1);
  }

  const usuarioId = rows[0].id;
  const nueva = claveDada ?? randomBytes(9).toString("base64url");
  if (nueva.length < 10) {
    console.error("\nLa contraseña tiene que tener diez caracteres o más.\n");
    process.exit(1);
  }

  const cifrada = await hashPassword(nueva);
  const actualizado = await pool.query(
    `update account set password = $1, "updatedAt" = now()
      where "userId" = $2 and "providerId" = 'credential'`,
    [cifrada, usuarioId],
  );

  if (actualizado.rowCount === 0) {
    // La cuenta existe pero nunca tuvo contraseña propia. Se le crea la fila.
    await pool.query(
      `insert into account (id, "accountId", "providerId", "userId", password, "createdAt", "updatedAt")
       values ($1, $2, 'credential', $2, $3, now(), now())`,
      [randomBytes(16).toString("hex"), usuarioId, cifrada],
    );
  }

  // Las sesiones abiertas se cierran: si alguien entró con la vieja, sale.
  await pool.query('delete from session where "userId" = $1', [usuarioId]);

  console.log(`\nListo. ${correo} ya entra con:\n`);
  console.log(`  ${nueva}\n`);
  console.log("Cámbiala desde la app cuando entres. Las sesiones abiertas se cerraron.\n");
} catch (e) {
  console.error(`\nNo se pudo: ${e.message}\n`);
  process.exitCode = 1;
} finally {
  await pool.end().catch(() => {});
}
