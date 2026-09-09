import Anthropic from "@anthropic-ai/sdk";

export const MODELO = "claude-opus-5";

export function cliente() {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error(
      "Falta ANTHROPIC_API_KEY. Créala en console.anthropic.com y ponla en .env.local",
    );
  }
  return new Anthropic();
}

/** Extrae el JSON de la respuesta aunque venga envuelto en texto o en un bloque. */
export function extraerJSON<T>(texto: string): T {
  const limpio = texto.trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "");
  try {
    return JSON.parse(limpio) as T;
  } catch {
    const i = limpio.indexOf("{");
    const j = limpio.lastIndexOf("}");
    if (i === -1 || j <= i) throw new Error("La respuesta no traía JSON.");
    return JSON.parse(limpio.slice(i, j + 1)) as T;
  }
}
