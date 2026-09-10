#!/usr/bin/env node
/**
 * Comprueba que .env.local esté bien antes de arrancar.
 *
 * Nunca imprime el valor de una clave: dice si está, si tiene la forma correcta
 * y, en el caso de la base de datos, si de verdad conecta.
 */
import { cargarEnv, opcionesSSL } from "./entorno.mjs";


const env = cargarEnv();
let fallos = 0;

const bien = (m) => console.log(`  ok    ${m}`);
const mal = (m, arreglo) => {
  fallos++;
  console.log(`  FALTA ${m}`);
  if (arreglo) console.log(`        → ${arreglo}`);
};

console.log("\nEl modelo");
if (env.ANTHROPIC_API_KEY) bien("ANTHROPIC_API_KEY puesta");
else if (env.OPENAI_API_KEY) bien("OPENAI_API_KEY puesta");
else mal("no hay clave de modelo", "pon ANTHROPIC_API_KEY o OPENAI_API_KEY");

console.log("\nLa base de datos");
const url = env.DATABASE_URL;
if (!url) {
  mal(
    "DATABASE_URL vacía",
    "en Supabase: botón Connect (arriba) → Connection string → Transaction pooler",
  );
} else if (url.startsWith("https://")) {
  mal(
    "DATABASE_URL es la dirección de la API, no la de Postgres",
    "empieza por postgresql://, no por https://. Es otra pantalla: Connect → Connection string",
  );
} else if (!/^postgres(ql)?:\/\//.test(url)) {
  mal("DATABASE_URL no parece una cadena de Postgres", "tiene que empezar por postgresql://");
} else if (url.includes("[") || url.includes("YOUR-PASSWORD")) {
  mal(
    "DATABASE_URL trae el hueco de la contraseña sin rellenar",
    "cambia [YOUR-PASSWORD] por la contraseña de la base",
  );
} else {
  bien(`DATABASE_URL con forma correcta (${new URL(url).hostname})`);
}

console.log("\nLas cuentas");
const secreto = env.BETTER_AUTH_SECRET;
if (!secreto) {
  mal("BETTER_AUTH_SECRET vacío", "genéralo tú: npm run secreto");
} else if (/^sb_|^sbp_|^eyJ/.test(secreto)) {
  mal(
    "BETTER_AUTH_SECRET es una clave de Supabase",
    "no sale de Supabase: es un texto al azar que generas tú. Corre: npm run secreto",
  );
} else if (secreto.length < 32) {
  mal("BETTER_AUTH_SECRET demasiado corto", "npm run secreto");
} else {
  bien("BETTER_AUTH_SECRET con forma correcta");
}

if (env.BETTER_AUTH_URL) bien(`BETTER_AUTH_URL = ${env.BETTER_AUTH_URL}`);
else mal("BETTER_AUTH_URL vacía", "en local: http://localhost:3000");

if (url && /^postgres(ql)?:\/\//.test(url) && !url.includes("[")) {
  console.log("\nProbando la conexión…");
  const { Pool } = await import("pg");
  const pool = new Pool({
    connectionString: url,
    ssl: opcionesSSL(url),
    connectionTimeoutMillis: 10_000,
  });
  try {
    const r = await pool.query(
      `select to_regclass('public.negocio') is not null as negocio,
              to_regclass('public.user')    is not null as usuarios`,
    );
    bien("conecta con la base");
    if (r.rows[0].usuarios) bien("las tablas de cuentas existen");
    else mal("faltan las tablas de cuentas", "npx @better-auth/cli migrate");
    if (r.rows[0].negocio) bien("la tabla negocio existe");
    else
      mal("falta la tabla negocio", 'psql "$DATABASE_URL" -f db/001-cuentas-y-negocio.sql');
  } catch (e) {
    mal(`no conecta: ${e.message}`);
  } finally {
    await pool.end().catch(() => {});
  }
}

console.log(
  fallos === 0
    ? "\nTodo listo. Arranca con: npm run dev\n"
    : `\n${fallos} ${fallos === 1 ? "cosa" : "cosas"} por arreglar.\n`,
);
process.exit(fallos === 0 ? 0 : 1);
