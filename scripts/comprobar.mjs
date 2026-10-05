#!/usr/bin/env node
/**
 * Comprueba que la configuración esté bien antes de arrancar.
 *
 * Nunca imprime el valor de una clave: dice si está, si tiene la forma correcta
 * y, en el caso de la base de datos, si de verdad conecta.
 */
import fs from "node:fs";
import path from "node:path";
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
/** Ni bien ni mal: funciona en local y no funcionaría en producción. */
const ojo = (m, arreglo) => {
  console.log(`  OJO   ${m}`);
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

// .env.example SÍ va a git: es la plantilla. Un valor real escrito ahí acaba
// publicado en el repositorio, y una clave que se ve una vez ya está quemada.
const plantilla = path.join(process.cwd(), ".env.example");
if (fs.existsSync(plantilla)) {
  const rellenas = fs
    .readFileSync(plantilla, "utf8")
    .split(/\r?\n/)
    .map((l) => l.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.+?)\s*$/))
    .filter((m) => m && m[2] && !/^http:\/\/localhost/.test(m[2]))
    .map((m) => m[1]);

  if (rellenas.length) {
    console.log("\nCuidado");
    mal(
      `.env.example tiene valores escritos: ${rellenas.join(", ")}`,
      "ese archivo sí se sube a git. Mueve los valores a .env.local y déjalo vacío: " +
        "git checkout -- .env.example",
    );
  }
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

// El correo no es opcional en cuanto el sitio está publicado, y es el único
// trozo del sistema que falla EN SILENCIO: sin proveedor, "olvidé mi
// contraseña" sigue contestando que todo fue bien y el mensaje se queda en la
// terminal del servidor, donde nadie lo lee. En local eso es lo correcto; en
// producción es un usuario que se quedó fuera de su cuenta para siempre.
if (env.RESEND_API_KEY && env.CORREO_DESDE) {
  bien(`el correo sale por Resend, desde ${env.CORREO_DESDE}`);
} else if (/localhost|127\.0\.0\.1/.test(env.BETTER_AUTH_URL ?? "")) {
  ojo(
    "sin proveedor de correo: los enlaces salen por la terminal",
    "en local está bien. Antes de publicar: RESEND_API_KEY y CORREO_DESDE",
  );
} else {
  mal(
    "sin proveedor de correo, y esto NO es local",
    "nadie va a recibir el enlace de «olvidé mi contraseña». Pon RESEND_API_KEY y CORREO_DESDE",
  );
}

const panel = env.PANEL_LLAVE?.trim();
if (!panel) {
  ojo("PANEL_LLAVE vacía: el panel de administración no existe", "npm run llave");
} else if (panel.length < 16) {
  mal("PANEL_LLAVE demasiado corta", "npm run llave");
} else {
  bien(`el panel está en /panel/${panel.slice(0, 6)}…`);
}

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
