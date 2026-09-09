import { cliente, extraerJSON, MODELO } from "@/lib/claude";
import { cargarPerfil, cargarPrompt } from "@/lib/perfil";
import type { Diagnostico } from "@/types/diagnostico";
import type Anthropic from "@anthropic-ai/sdk";

export const maxDuration = 120;

type Cuerpo = {
  perfilId: string;
  /** El perfil social a revisar: texto pegado, imagen en base64, o ambos. */
  texto?: string;
  imagen?: { media_type: string; data: string };
};

export async function POST(request: Request) {
  let cuerpo: Cuerpo;
  try {
    cuerpo = await request.json();
  } catch {
    return Response.json({ error: "Cuerpo inválido." }, { status: 400 });
  }

  if (!cuerpo.perfilId) {
    return Response.json({ error: "Falta el perfil." }, { status: 400 });
  }
  if (!cuerpo.texto?.trim() && !cuerpo.imagen) {
    return Response.json(
      { error: "Pega el perfil o sube una captura para poder revisarlo." },
      { status: 400 },
    );
  }

  try {
    const [{ perfil, voz }, instrucciones] = await Promise.all([
      cargarPerfil(cuerpo.perfilId),
      cargarPrompt("1-diagnostico.md"),
    ]);

    // La voz va aparte y en crudo; dentro del JSON solo estorbaría su ruta.
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { voz: _fuente, ...nucleo } = perfil.nucleo;
    const contexto = [
      "## Perfil de Negocio",
      JSON.stringify({ ...perfil, nucleo }, null, 2),
      voz ? `\n## Muestras de voz\n\n${voz}` : "\n## Muestras de voz\n\n(ninguna)",
    ].join("\n");

    const contenido: Anthropic.ContentBlockParam[] = [];
    if (cuerpo.imagen) {
      contenido.push({
        type: "image",
        source: {
          type: "base64",
          media_type: cuerpo.imagen.media_type as "image/png",
          data: cuerpo.imagen.data,
        },
      });
    }
    contenido.push({
      type: "text",
      text: [
        contexto,
        "\n## Perfil social a revisar",
        cuerpo.imagen ? "Está en la captura de arriba." : "",
        cuerpo.texto?.trim() ?? "",
        "\nDevuelve solo el JSON.",
      ].join("\n"),
    });

    const respuesta = await cliente().messages.create({
      model: MODELO,
      max_tokens: 16000,
      system: [{ type: "text", text: instrucciones, cache_control: { type: "ephemeral" } }],
      thinking: { type: "adaptive" },
      messages: [{ role: "user", content: contenido }],
    });

    if (respuesta.stop_reason === "refusal") {
      return Response.json(
        { error: "El modelo declinó esta solicitud." },
        { status: 422 },
      );
    }

    const texto = respuesta.content
      .filter((b) => b.type === "text")
      .map((b) => b.text)
      .join("");

    return Response.json({
      diagnostico: extraerJSON<Diagnostico>(texto),
      uso: {
        entrada: respuesta.usage.input_tokens,
        salida: respuesta.usage.output_tokens,
        cache: respuesta.usage.cache_read_input_tokens ?? 0,
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error inesperado.";
    console.error("diagnostico:", msg);
    return Response.json({ error: msg }, { status: 500 });
  }
}
