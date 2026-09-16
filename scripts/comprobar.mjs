#!/usr/bin/env node
/**
 * Comprueba que la configuración esté bien antes de arrancar.
 *
 * Nunca imprime el valor de una clave: dice si está, si tiene la forma correcta
 * y, en el caso de la base de datos, si de verdad conecta.
 */
import { cargarEnv, opcionesSSL, revisarURL } from "./entorno.mjs";
import { servidorDe } from "../lib/postgres-url.mjs";

const { valores: env, fuentes, repetidas } = cargarEnv();
let fallos = 0;

const bien = (m) => console.log(`  ok    ${m}`);
const mal = (m, arreglo) => {
  fallos++;
  console.log(`  FALTA ${m}`);
  if (arreglo) console.log(`        → ${arreglo}`);
};

console.log("\nDe dónde leo");
if (fuentes.length === 0) {
  mal(
    "no encuentro ni .env.local ni .env en esta carpeta",
    "copia .env.example a .env.local y rellénalo",
  );
} else {
  for (const f of fuentes) {
    const detalle = `${f.archivo} · ${f.encontradas} ${
      f.encontradas === 1 ? "variable" : "variables"
    } · ${f.codificacion}`;
    if (f.encontradas === 0) {
      mal(
        `${detalle} — no pude leer ninguna línea`,
        f.bytes === 0
          ? "el archivo está vacío"
          : "revisa que cada línea sea NOMBRE=valor, sin espacios raros",
      );
    } else {
      bien(detalle);
    }
  }
}

if (repetidas.length) {
  mal(
    `escritas dos veces: ${repetidas.join(", ")}`,
    "me quedo con la última de cada una. Borra las líneas de arriba que sobren",
  );
}

console.log("\nEl modelo");
if (env.ANTHROPIC_API_KEY) bien("ANTHROPIC_API_KEY puesta");
else if (env.OPENAI_API_KEY) bien("OPENAI_API_KEY puesta");
else mal("no hay clave de modelo", "pon ANTHROPIC_API_KEY o OPENAI_API_KEY");

console.log("\nLa base de datos");
const url = env.DATABASE_URL;
const veredicto = revisarURL(url);
let urlUsable = false;

if (!veredicto.ok) {
  mal(veredicto.motivo, veredicto.arreglo);
} else {
  bien(`DATABASE_URL con forma correcta (${servidorDe(url)})`);
  urlUsable = true;
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

if (urlUsable) {
  console.log("\nProbando la conexión…");
  const { Pool } = await import("pg");
  const pool = new Pool({
    connectionString: url,
    ssl: opcionesSSL(url),
    connectionTimeoutMillis: 15_000,
  });
  try {
    const r = await pool.query(
      `select to_regclass('public.negocio') is not null as negocio,
              to_regclass('public.user')    is not null as usuarios`,
    );
    bien("conecta con la base");
    if (r.rows[0].usuarios && r.rows[0].negocio) bien("las tablas están creadas");
    else mal("faltan tablas", "npm run migrar");
  } catch (e) {
    mal(`no conecta: ${e.message}`, "si habla de la contraseña, revisa que no lleve símbolos");
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
