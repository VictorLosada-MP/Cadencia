import { extraerJSON, generar, type Adjunto } from "@/lib/modelo";
import { cargarPerfil, cargarPrompt } from "@/lib/perfil";
import type { Diagnostico } from "@/types/diagnostico";
import {
  MAX_PIEZAS,
  MAX_REDES,
  nombreRed,
  piezaTieneContenido,
  tieneContenido,
  type EntradaPieza,
  type EntradaRed,
} from "@/types/entrada";

export const maxDuration = 300;

type Cuerpo = {
  perfilId: string;
  /** Una o dos redes. Cada una con captura, con texto, o con las dos. */
  redes?: EntradaRed[];
  /** Piezas ya publicadas. Sin esto el diagnóstico se queda en la bio. */
  piezas?: EntradaPieza[];
  /** Respuestas a las preguntas de una ronda anterior. */
  respuestas?: { pregunta: string; respuesta: string }[];
};

/** Cada imagen viaja en base64, así que pesa un tercio más que el archivo. */
const MAX_BYTES_IMAGEN = 5_000_000;

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

  const redes = (cuerpo.redes ?? []).filter(tieneContenido);
  if (redes.length === 0) {
    return Response.json(
      { error: "Sube la captura de tu perfil o pega los campos para poder revisarlo." },
      { status: 400 },
    );
  }
  if (redes.length > MAX_REDES) {
    return Response.json(
      { error: `Con ${MAX_REDES} redes basta. La tercera no añade lectura nueva.` },
      { status: 400 },
    );
  }

  const piezas = (cuerpo.piezas ?? []).filter(piezaTieneContenido).slice(0, MAX_PIEZAS);

  const pesada = [...redes, ...piezas].find(
    (x) => x.imagen && x.imagen.data.length > MAX_BYTES_IMAGEN,
  );
  if (pesada) {
    return Response.json(
      { error: "Una de las capturas pesa demasiado. Vuelve a subirla." },
      { status: 413 },
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

    const adjuntos: Adjunto[] = [];
    for (const r of redes) {
      if (r.imagen) {
        adjuntos.push({ etiqueta: `Captura del perfil de ${nombreRed(r)}:`, imagen: r.imagen });
      }
    }
    piezas.forEach((p, i) => {
      if (p.imagen) {
        const de = [p.red, p.cuando].filter(Boolean).join(", ");
        adjuntos.push({
          etiqueta: `Captura de una pieza publicada ${de ? `(${de})` : `#${i + 1}`}:`,
          imagen: p.imagen,
        });
      }
    });

    const bloqueRedes = redes
      .map((r) => {
        const partes = [`### ${nombreRed(r)}`];
        if (r.imagen) partes.push("Su captura viene adjunta arriba.");
        if (r.texto?.trim()) partes.push(`Campos pegados por el dueño:\n${r.texto.trim()}`);
        return partes.join("\n");
      })
      .join("\n\n");

    const bloquePiezas = piezas.length
      ? piezas
          .map((p, i) => {
            const cabecera = [`### Pieza ${i + 1}`, p.red, p.cuando]
              .filter(Boolean)
              .join(" · ");
            const cuerpoPieza = p.texto?.trim() || "(solo la captura adjunta)";
            return `${cabecera}\n${cuerpoPieza}`;
          })
          .join("\n\n")
      : "(ninguna — dilo en limites)";

    const texto = [
      "## Perfil de Negocio",
      JSON.stringify({ ...perfil, nucleo }, null, 2),
      voz ? `\n## Muestras de voz\n\n${voz}` : "\n## Muestras de voz\n\n(ninguna)",
      `\n## Redes a revisar (${redes.length})`,
      bloqueRedes,
      "\n## Piezas publicadas",
      bloquePiezas,
      cuerpo.respuestas?.length
        ? "\n## Respuestas del dueño a preguntas anteriores\n\n" +
          cuerpo.respuestas
            .filter((r) => r.respuesta.trim())
            .map((r) => `P: ${r.pregunta}\nR: ${r.respuesta.trim()}`)
            .join("\n\n")
        : "",
      "\nDevuelve solo el JSON.",
    ].join("\n");

    const r = await generar({ sistema: instrucciones, texto, adjuntos });

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
