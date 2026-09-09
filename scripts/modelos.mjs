/**
 * Dice qué modelos puede usar tu clave. `npm run modelos`
 *
 * Lee la clave de .env.local — no la pide, no la imprime, no la manda a
 * ningún lado que no sea el propio proveedor.
 */
import fs from "node:fs";

// Carga .env.local sin dependencias
for (const linea of (fs.existsSync(".env.local")
  ? fs.readFileSync(".env.local", "utf8")
  : ""
).split("\n")) {
  const m = linea.match(/^\s*([A-Z_]+)\s*=\s*(.*)\s*$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}

const openai = process.env.OPENAI_API_KEY;
const anthropic = process.env.ANTHROPIC_API_KEY;

if (!openai && !anthropic) {
  console.log("No encontré ninguna clave en .env.local.");
  console.log("Copia .env.example a .env.local y pega la tuya.");
  process.exit(1);
}

if (openai) {
  console.log("\nOPENAI — modelos que tu clave puede usar\n");
  const r = await fetch("https://api.openai.com/v1/models", {
    headers: { Authorization: `Bearer ${openai}` },
  });
  if (!r.ok) {
    const e = await r.json().catch(() => ({}));
    console.log(`  ✗ ${r.status} — ${e.error?.message ?? "clave rechazada"}`);
  } else {
    const { data } = await r.json();
    const utiles = data
      .map((m) => m.id)
      .filter((id) => /^(gpt|o[0-9])/.test(id) && !/audio|realtime|transcribe|tts|image/.test(id))
      .sort();
    utiles.forEach((id) => console.log("  •", id));
    console.log(`\n  Pon uno de esos en MODELO_OPENAI dentro de .env.local.`);
    console.log(`  Total disponibles: ${data.length}`);
  }
}

if (anthropic) {
  console.log("\nANTHROPIC — modelos que tu clave puede usar\n");
  const r = await fetch("https://api.anthropic.com/v1/models", {
    headers: { "x-api-key": anthropic, "anthropic-version": "2023-06-01" },
  });
  if (!r.ok) {
    console.log(`  ✗ ${r.status} — clave rechazada`);
  } else {
    const { data } = await r.json();
    data.forEach((m) => console.log("  •", m.id));
  }
}
console.log();
