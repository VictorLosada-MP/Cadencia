/**
 * Capa de proveedor. Las funciones del sistema no saben con qué modelo hablan.
 *
 * Cambiar de proveedor es cambiar una variable de entorno, no tocar código.
 * Es la misma independencia que el producto le promete a su usuario.
 */
import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";

export type Imagen = { media_type: string; data: string };

/** Una captura con la etiqueta que dice de dónde salió. */
export type Adjunto = { etiqueta: string; imagen: Imagen };

/** Los mismos niveles que expone el proveedor. Transcribir no es razonar. */
export type Esfuerzo = "low" | "medium" | "high" | "xhigh" | "max";

export type Peticion = {
  sistema: string;
  /**
   * El bloque caro que no cambia entre corridas — el perfil y las muestras de
   * voz. Va antes que nada y con marca de caché, porque "Afinar con mis
   * respuestas" lo reenvía idéntico.
   */
  estable?: string;
  texto: string;
  /** Van antes del texto, cada una precedida de su etiqueta. */
  adjuntos?: Adjunto[];
  esfuerzo?: Esfuerzo;
};

export type Respuesta = {
  texto: string;
  proveedor: "anthropic" | "openai";
  modelo: string;
  /** `cache` en cero corrida tras corrida significa que la marca no sirve. */
  uso: { entrada: number; salida: number; cache?: number };
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

async function conAnthropic({
  sistema,
  estable,
  texto,
  adjuntos,
  esfuerzo,
}: Peticion): Promise<Respuesta> {
  const contenido: Anthropic.ContentBlockParam[] = [];
  // El prefijo cacheable tiene que ir primero, antes de las imágenes: si una
  // imagen se cuela delante, el prefijo cambia en cada corrida y no se reusa.
  if (estable) {
    contenido.push({
      type: "text",
      text: estable,
      cache_control: { type: "ephemeral" },
    });
  }
  for (const a of adjuntos ?? []) {
    contenido.push({ type: "text", text: a.etiqueta });
    contenido.push({
      type: "image",
      source: {
        type: "base64",
        media_type: a.imagen.media_type as "image/png",
        data: a.imagen.data,
      },
    });
  }
  contenido.push({ type: "text", text: texto });

  // Con max_tokens alto y respuestas largas, streaming es lo que evita que la
  // petición muera por tiempo después de haberse facturado entera.
  const r = await new Anthropic().messages
    .stream({
      model: MODELO_ANTHROPIC,
      max_tokens: 16000,
      system: [{ type: "text", text: sistema, cache_control: { type: "ephemeral" } }],
      thinking: { type: "adaptive" },
      ...(esfuerzo ? { output_config: { effort: esfuerzo } } : {}),
      messages: [{ role: "user", content: contenido }],
    })
    .finalMessage();

  if (r.stop_reason === "refusal") throw new Error("El modelo declinó esta solicitud.");
  // Sin esta comprobación el JSON llega cortado y extraerJSON recorta hasta la
  // última llave: devolvería un diagnóstico sin la segunda red, y sin avisar.
  if (r.stop_reason === "max_tokens") {
    throw new Error("La respuesta salió más larga de lo que cabe. Prueba con una sola red.");
  }

  return {
    texto: r.content.filter((b) => b.type === "text").map((b) => b.text).join(""),
    proveedor: "anthropic",
    modelo: MODELO_ANTHROPIC,
    uso: {
      entrada: r.usage.input_tokens,
      salida: r.usage.output_tokens,
      cache: r.usage.cache_read_input_tokens ?? 0,
    },
  };
}

async function conOpenAI({ sistema, estable, texto, adjuntos }: Peticion): Promise<Respuesta> {
  const contenido: OpenAI.Chat.ChatCompletionContentPart[] = [];
  if (estable) contenido.push({ type: "text", text: estable });
  for (const a of adjuntos ?? []) {
    contenido.push({ type: "text", text: a.etiqueta });
    contenido.push({
      type: "image_url",
      image_url: { url: `data:${a.imagen.media_type};base64,${a.imagen.data}` },
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
  if (r.choices[0]?.finish_reason === "length") {
    throw new Error("La respuesta salió más larga de lo que cabe. Prueba con una sola red.");
  }

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
