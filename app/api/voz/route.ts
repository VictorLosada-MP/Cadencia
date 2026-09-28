import OpenAI from "openai";
import { negocioDe, usuarioActual } from "@/lib/negocio";
import { MAX_SEGUNDOS, apuntarVoz, revisarVoz } from "@/lib/voz";
import type { Palabra } from "@/lib/subtitulos";

export const maxDuration = 300;

/** Mono a 16 kHz: tres minutos son 5,7 MB. Con margen para la cabecera. */
const MAX_BYTES = 8_000_000;

/**
 * Transcribe la voz de un video con los tiempos de cada palabra.
 *
 * Lo que sale de la máquina del dueño es SOLO el audio, ya bajado a mono y a
 * 16 kHz — nunca el video. Y sale porque no hay otra forma de tener tiempos
 * por palabra sin bajarse un modelo de sesenta megas a un teléfono.
 *
 * Es la única parte del editor que no corre en el navegador, y la pantalla lo
 * dice donde se decide, no en la letra pequeña: se puede montar el video
 * entero sin pasar por aquí, y entonces no sale nada de la máquina.
 */
export async function POST(request: Request) {
  const usuario = await usuarioActual();
  if (!usuario) return Response.json({ error: "Entra a tu cuenta." }, { status: 401 });

  if (!process.env.OPENAI_API_KEY) {
    return Response.json(
      {
        error:
          "Los subtítulos necesitan OPENAI_API_KEY en .env.local. El resto del montaje funciona sin eso.",
      },
      { status: 503 },
    );
  }

  let forma: FormData;
  try {
    forma = await request.formData();
  } catch {
    return Response.json({ error: "Cuerpo inválido." }, { status: 400 });
  }

  const audio = forma.get("audio");
  const segundos = Number(forma.get("segundos") ?? 0);

  if (!(audio instanceof File)) {
    return Response.json({ error: "Falta el audio." }, { status: 400 });
  }
  if (audio.size > MAX_BYTES) {
    return Response.json({ error: "El audio pesa demasiado." }, { status: 413 });
  }
  if (!Number.isFinite(segundos) || segundos <= 0 || segundos > MAX_SEGUNDOS) {
    return Response.json(
      { error: `Los subtítulos llegan hasta ${MAX_SEGUNDOS / 60} minutos de video.` },
      { status: 400 },
    );
  }

  const negocio = await negocioDe(usuario.id).catch(() => null);
  if (!negocio) {
    return Response.json({ error: "Guarda tu negocio antes de usar esto." }, { status: 400 });
  }

  const permiso = await revisarVoz(negocio.id, segundos);
  if (!permiso.ok) {
    return Response.json({ error: permiso.mensaje, tope: true }, { status: 429 });
  }

  try {
    // whisper-1 y no los modelos nuevos de transcripción: es el único que
    // devuelve tiempos POR PALABRA, y sin eso no hay subtítulo que siga el
    // habla — solo un bloque de texto quieto debajo.
    const r = await new OpenAI().audio.transcriptions.create({
      file: audio,
      model: "whisper-1",
      response_format: "verbose_json",
      timestamp_granularities: ["word"],
      language: "es",
    });

    const palabras: Palabra[] = (r.words ?? []).map((w) => ({
      palabra: w.word,
      desde: w.start,
      hasta: w.end,
    }));

    await apuntarVoz(negocio.id, segundos).catch((e) => {
      // Que falle el contador no puede tirar una transcripción ya pagada.
      console.error("voz/apuntar:", e instanceof Error ? e.message : e);
    });

    return Response.json({ palabras, texto: r.text ?? "" });
  } catch (e) {
    console.error("voz:", e instanceof Error ? e.message : e);
    return Response.json(
      { error: "No se pudo transcribir. El video se monta igual sin subtítulos." },
      { status: 500 },
    );
  }
}
