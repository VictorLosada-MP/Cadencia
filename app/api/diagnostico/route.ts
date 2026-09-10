import { extraerJSON, generar, type Imagen } from "@/lib/modelo";
import { cargarPerfil, cargarPrompt } from "@/lib/perfil";
import type { Diagnostico } from "@/types/diagnostico";

export const maxDuration = 120;

type Cuerpo = {
  perfilId: string;
  /** El perfil social a revisar: texto pegado, captura, o ambos. */
  texto?: string;
  imagen?: Imagen;
  /** Piezas ya publicadas. Sin esto el diagnóstico se queda en la bio. */
  contenido?: string;
  /** Respuestas a las preguntas de una ronda anterior. */
  respuestas?: { pregunta: string; respuesta: string }[];
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

    const texto = [
      "## Perfil de Negocio",
      JSON.stringify({ ...perfil, nucleo }, null, 2),
      voz ? `\n## Muestras de voz\n\n${voz}` : "\n## Muestras de voz\n\n(ninguna)",
      "\n## Perfil social a revisar",
      cuerpo.imagen ? "Está en la captura adjunta." : "",
      cuerpo.texto?.trim() ?? "",
      cuerpo.contenido?.trim()
        ? `\n## Piezas publicadas\n\n${cuerpo.contenido.trim()}`
        : "\n## Piezas publicadas\n\n(ninguna — dilo en limites)",
      cuerpo.respuestas?.length
        ? "\n## Respuestas del dueño a preguntas anteriores\n\n" +
          cuerpo.respuestas
            .filter((r) => r.respuesta.trim())
            .map((r) => `P: ${r.pregunta}\nR: ${r.respuesta.trim()}`)
            .join("\n\n")
        : "",
      "\nDevuelve solo el JSON.",
    ].join("\n");

    const r = await generar({ sistema: instrucciones, texto, imagen: cuerpo.imagen });

    return Response.json({
      diagnostico: extraerJSON<Diagnostico>(r.texto),
      meta: { proveedor: r.proveedor, modelo: r.modelo, uso: r.uso },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error inesperado.";
    console.error("diagnostico:", msg);
    return Response.json({ error: msg }, { status: 500 });
  }
}
