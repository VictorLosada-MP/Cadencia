/**
 * Capa de proveedor. Las funciones del sistema no saben con qué modelo hablan.
 *
 * Cambiar de proveedor es cambiar una variable de entorno, no tocar código.
 * Es la misma independencia que el producto le promete a su usuario.
 */
import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";

export type Imagen = { media_type: string; data: string };

export type Peticion = {
  sistema: string;
  texto: string;
  imagen?: Imagen;
};

export type Respuesta = {
  texto: string;
  proveedor: "anthropic" | "openai";
  modelo: string;
  uso: { entrada: number; salida: number };
};

const MODELO_ANTHROPIC = process.env.MODELO_ANTHROPIC ?? "claude-opus-5";
const MODELO_OPENAI = process.env.MODELO_OPENAI ?? "gpt-5";

export function proveedorActivo(): "anthropic" | "openai" | null {
  const forzado = process.env.PROVEEDOR;
  if (forzado === "anthropic" || forzado === "openai") return forzado;
  if (process.env.ANTHROPIC_API_KEY) return "anthropic";
  if (process.env.OPENAI_API_KEY) return "openai";
  return null;
}

export async function generar(p: Peticion): Promise<Respuesta> {
  const proveedor = proveedorActivo();
  if (!proveedor) {
    throw new Error(
      "Falta la clave del modelo. Pon OPENAI_API_KEY o ANTHROPIC_API_KEY en .env.local",
    );
  }
  return proveedor === "anthropic" ? conAnthropic(p) : conOpenAI(p);
}

async function conAnthropic({ sistema, texto, imagen }: Peticion): Promise<Respuesta> {
  const contenido: Anthropic.ContentBlockParam[] = [];
  if (imagen) {
    contenido.push({
      type: "image",
      source: {
        type: "base64",
        media_type: imagen.media_type as "image/png",
        data: imagen.data,
      },
    });
  }
  contenido.push({ type: "text", text: texto });

  const r = await new Anthropic().messages.create({
    model: MODELO_ANTHROPIC,
    max_tokens: 16000,
    system: [{ type: "text", text: sistema, cache_control: { type: "ephemeral" } }],
    thinking: { type: "adaptive" },
    messages: [{ role: "user", content: contenido }],
  });

  if (r.stop_reason === "refusal") throw new Error("El modelo declinó esta solicitud.");

  return {
    texto: r.content.filter((b) => b.type === "text").map((b) => b.text).join(""),
    proveedor: "anthropic",
    modelo: MODELO_ANTHROPIC,
    uso: { entrada: r.usage.input_tokens, salida: r.usage.output_tokens },
  };
}

async function conOpenAI({ sistema, texto, imagen }: Peticion): Promise<Respuesta> {
  const contenido: OpenAI.Chat.ChatCompletionContentPart[] = [];
  if (imagen) {
    contenido.push({
      type: "image_url",
      image_url: { url: `data:${imagen.media_type};base64,${imagen.data}` },
    });
  }
  contenido.push({ type: "text", text: texto });

  const r = await new OpenAI().chat.completions.create({
    model: MODELO_OPENAI,
    messages: [
      { role: "system", content: sistema },
      { role: "user", content: contenido },
    ],
  });

  const salida = r.choices[0]?.message?.content;
  if (!salida) throw new Error("El modelo devolvió una respuesta vacía.");

  return {
    texto: salida,
    proveedor: "openai",
    modelo: MODELO_OPENAI,
    uso: {
      entrada: r.usage?.prompt_tokens ?? 0,
      salida: r.usage?.completion_tokens ?? 0,
    },
  };
}

/** Extrae el JSON aunque venga envuelto en texto o en un bloque de código. */
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
