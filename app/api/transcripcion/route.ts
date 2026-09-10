import { extraerJSON, generar, type Imagen } from "@/lib/modelo";
import { cargarPrompt } from "@/lib/perfil";
import {
  CASILLAS_VACIAS,
  casillasDe,
  PLATAFORMAS,
  type Casilla,
  type Plataforma,
  type Transcripcion,
} from "@/types/entrada";

export const maxDuration = 120;

/** Base64 pesa un tercio más que el archivo. El cliente ya reduce antes de subir. */
const MAX_BYTES_IMAGEN = 5_000_000;

type Cuerpo = { plataforma?: Plataforma; imagen?: Imagen };

/**
 * Transcribe una captura a casillas. No diagnostica: eso corre después, y sobre
 * lo que el dueño confirme. Partir los dos pasos es lo que evita que una bio
 * cortada con "… más" se convierta en un "no pasa" que era mentira.
 */
export async function POST(request: Request) {
  let cuerpo: Cuerpo;
  try {
    cuerpo = await request.json();
  } catch {
    return Response.json({ error: "Cuerpo inválido." }, { status: 400 });
  }

  const { plataforma, imagen } = cuerpo;
  if (!plataforma || !PLATAFORMAS.includes(plataforma)) {
    return Response.json({ error: "Falta la red." }, { status: 400 });
  }
  if (!imagen?.data) {
    return Response.json({ error: "Falta la captura." }, { status: 400 });
  }
  if (imagen.data.length > MAX_BYTES_IMAGEN) {
    return Response.json(
      { error: "La captura pesa demasiado. Vuelve a subirla." },
      { status: 413 },
    );
  }

  try {
    const instrucciones = await cargarPrompt("0-transcripcion.md");
    const aplican = casillasDe(plataforma);

    const texto = [
      `Red: ${plataforma}.`,
      `Casillas que esta red tiene: ${aplican.join(", ")}.`,
      "Las demás van vacías y no entran en cortados ni en no_legible.",
      "",
      "Devuelve solo el JSON.",
    ].join("\n");

    const r = await generar({
      sistema: instrucciones,
      texto,
      adjuntos: [{ etiqueta: `Captura del perfil de ${plataforma}:`, imagen }],
    });

    const cruda = extraerJSON<Partial<Transcripcion>>(r.texto);

    // El modelo puede omitir casillas o nombrar una que esta red no tiene. Se
    // normaliza aquí para que la pantalla nunca reciba una forma a medias.
    const casillas = { ...CASILLAS_VACIAS, ...(cruda.casillas ?? {}) };
    const soloDeEsta = (xs: unknown): Casilla[] =>
      Array.isArray(xs) ? (xs.filter((c) => aplican.includes(c as Casilla)) as Casilla[]) : [];

    const transcripcion: Transcripcion = {
      casillas,
      cortados: soloDeEsta(cruda.cortados),
      no_legible: soloDeEsta(cruda.no_legible),
      datos_personales: Boolean(cruda.datos_personales),
    };

    return Response.json({
      transcripcion,
      meta: { proveedor: r.proveedor, modelo: r.modelo, uso: r.uso },
    });
  } catch (e) {
    console.error("transcripcion:", e instanceof Error ? e.message : e);
    return Response.json(
      { error: "No se pudo leer la captura. Puedes escribir las casillas a mano." },
      { status: 500 },
    );
  }
}
