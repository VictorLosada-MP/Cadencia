#!/usr/bin/env node
/**
 * Regala un plan a una cuenta, o se lo retira.
 *
 * La cortesía apunta a un plan real: si mañana cambia lo que incluye el plan
 * Cadencia, las cortesías con Cadencia cambian solas. Y el consumo se sigue
 * contando, así que se puede ver lo que cuesta la generosidad cada mes.
 *
 *   npm run cortesia                                → quién tiene qué
 *   npm run cortesia -- correo@x.com cadencia       → se lo regala, sin caducidad
 *   npm run cortesia -- correo@x.com cadencia 2027-12-31
 *   npm run cortesia -- correo@x.com quitar         → lo deja en su plan
 */
import { Pool } from "pg";
import { cargarEnv, opcionesSSL } from "./entorno.mjs";
import { normalizarURL } from "../lib/postgres-url.mjs";

const { valores: env } = cargarEnv();
const url = env.DATABASE_URL;
if (!url || !/^postgres(ql)?:\/\//.test(url)) {
  console.error("\nFalta DATABASE_URL. Corre `npm run comprobar`.\n");
  process.exit(1);
}

const [correo, plan, hasta] = process.argv.slice(2);
const pool = new Pool({ connectionString: normalizarURL(url), ssl: opcionesSSL(url) });

try {
  if (!correo) {
    const { rows } = await pool.query(
      `select u.email,
              coalesce(s.plan_id, 'prueba') as plan,
              s.cortesia_plan, s.cortesia_hasta, s.cortesia_motivo,
              (select count(*) from corrida c
                 join negocio n on n.id = c.negocio_id
                where n.usuario_id = u.id
                  and c.creado >= date_trunc('month', now())) as este_mes
         from "user" u
         left join suscripcion s on s.usuario_id = u.id
        order by u."createdAt"`,
    );
    if (!rows.length) {
      console.log("\nNo hay cuentas todavía.\n");
    } else {
      console.log("\nCuentas y planes:\n");
      for (const r of rows) {
        const regalo = r.cortesia_plan
          ? `  ← cortesía: ${r.cortesia_plan}${
              r.cortesia_hasta ? ` hasta ${r.cortesia_hasta.toISOString().slice(0, 10)}` : " (sin caducidad)"
            }`
          : "";
        console.log(`  ${r.email.padEnd(32)} ${r.plan.padEnd(10)} ${r.este_mes} este mes${regalo}`);
      }
      console.log("\n  npm run cortesia -- correo@x.com cadencia\n");
    }
    process.exit(0);
  }

  const { rows: usuarios } = await pool.query(
    'select id from "user" where lower(email) = lower($1)',
    [correo],
  );
  if (!usuarios.length) {
    console.error(`\nNo hay ninguna cuenta con ${correo}.\n`);
    process.exit(1);
  }
  const usuarioId = usuarios[0].id;

  if (!plan || plan === "quitar") {
    await pool.query(
      `insert into suscripcion (usuario_id, plan_id) values ($1, 'prueba')
       on conflict (usuario_id) do update set
         cortesia_plan = null, cortesia_hasta = null, cortesia_motivo = ''`,
      [usuarioId],
    );
    console.log(`\nCortesía retirada. ${correo} queda en su plan; no se borró nada.\n`);
    process.exit(0);
  }

  const { rows: planes } = await pool.query("select id, nombre from plan where id = $1", [plan]);
  if (!planes.length) {
    const { rows: todos } = await pool.query("select id from plan order by orden");
    console.error(`\nNo existe el plan «${plan}». Hay: ${todos.map((p) => p.id).join(", ")}\n`);
    process.exit(1);
  }

  await pool.query(
    `insert into suscripcion (usuario_id, plan_id, cortesia_plan, cortesia_hasta, cortesia_motivo)
     values ($1, 'prueba', $2, $3, 'cliente de la marca')
     on conflict (usuario_id) do update set
       cortesia_plan = excluded.cortesia_plan,
       cortesia_hasta = excluded.cortesia_hasta,
       cortesia_motivo = excluded.cortesia_motivo`,
    [usuarioId, plan, hasta ?? null],
  );

  console.log(`\n${correo} tiene ahora el plan ${planes[0].nombre} de cortesía`);
  console.log(hasta ? `  hasta el ${hasta}.\n` : "  sin caducidad.\n");
} catch (e) {
  console.error(`\nNo se pudo: ${e.message}\n`);
  process.exitCode = 1;
} finally {
  await pool.end().catch(() => {});
}
