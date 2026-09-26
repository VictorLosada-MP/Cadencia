import { extraerJSON, generar, type Adjunto } from "@/lib/modelo";
import { cargarPrompt } from "@/lib/perfil";
import type { Diagnostico } from "@/types/diagnostico";
import { cargarContexto, FaltaNegocio } from "@/lib/contexto";
import { revisarCuota } from "@/lib/cuota";
import { estadoAnterior, guardarCorrida } from "@/lib/historial";
import { usuarioActual } from "@/lib/negocio";
import {
  CASILLAS,
  MAX_REDES,
  MIN_PIEZAS_PARA_PATRON,
  casillasDe,
  contarPiezas,
  puntosQueNoAplican,
  nombreRed,
  tieneContenido,
  type EntradaRed,
  type Publicado,
} from "@/types/entrada";

export const maxDuration = 300;

const MAX_CUADRICULAS = 2;
const MAX_BYTES_IMAGEN = 5_000_000;

type Cuerpo = {
  /**
   * Un perfil semilla del repositorio, solo para probar el sistema. El negocio
   * de verdad sale de la sesión, nunca del cuerpo: si viniera de aquí, escribir
   * el id de otro devolvería su oferta, su cliente y sus muestras de voz.
   */
  perfilId?: string;
  /** Una o dos redes, con las casillas ya confirmadas por el dueño. */
  redes?: EntradaRed[];
  publicado?: Publicado;
  /** Respuestas a las preguntas de una ronda anterior. */
  respuestas?: { pregunta: string; respuesta: string }[];
};

const rotulo = (id: string) => CASILLAS.find((c) => c.id === id)?.etiqueta ?? id;

export async function POST(request: Request) {
  const usuario = await usuarioActual();
  if (!usuario) {
    return Response.json({ error: "Entra a tu cuenta para diagnosticar." }, { status: 401 });
  }

  let cuerpo: Cuerpo;
  try {
    cuerpo = await request.json();
  } catch {
    return Response.json({ error: "Cuerpo inválido." }, { status: 400 });
  }


  const redes = (cuerpo.redes ?? []).filter(tieneContenido);
  if (redes.length === 0) {
    return Response.json(
      { error: "Llena al menos una casilla de una red para poder revisarla." },
      { status: 400 },
    );
  }
  if (redes.length > MAX_REDES) {
    return Response.json(
      { error: `Con ${MAX_REDES} redes basta. La tercera no añade lectura nueva.` },
      { status: 400 },
    );
  }

  const publicado: Publicado = {
    cuadriculas: cuerpo.publicado?.cuadriculas ?? [],
    textos: cuerpo.publicado?.textos ?? "",
    ventana: cuerpo.publicado?.ventana,
  };

  if (publicado.cuadriculas.length > MAX_CUADRICULAS) {
    return Response.json(
      { error: `Con ${MAX_CUADRICULAS} capturas de la cuadrícula basta.` },
      { status: 400 },
    );
  }
  if (publicado.cuadriculas.some((i) => i.data.length > MAX_BYTES_IMAGEN)) {
    return Response.json(
      { error: "Una de las capturas pesa demasiado. Vuelve a subirla." },
      { status: 413 },
    );
  }

  try {
    const [instrucciones, contexto] = await Promise.all([
      cargarPrompt("1-diagnostico.md"),
      cargarContexto(usuario.id, cuerpo.perfilId),
    ]);

    // Lo único que viaja como imagen es la cuadrícula. El perfil ya es texto
    // confirmado: más barato, comparable entre corridas, y sin nada que inventar.
    const adjuntos: Adjunto[] = publicado.cuadriculas.map((imagen, i) => ({
      etiqueta: `Captura de la cuadrícula de publicaciones ${i + 1}:`,
      imagen,
    }));

    const bloqueRedes = redes
      .map((r) => {
        const aplican = casillasDe(r.plataforma);
        const noTiene = CASILLAS.map((c) => c.id).filter((c) => !aplican.includes(c));

        const lineas = aplican.map((c) => {
          const v = r.casillas[c]?.trim();
          const cortada = r.cortadas?.includes(c) ? "  [venía cortada con «… más»]" : "";
          return `- ${rotulo(c)}: ${v ? `«${v}»${cortada}` : "(vacía)"}`;
        });

        if (noTiene.length) {
          lineas.push(`- Esta red no tiene casilla de: ${noTiene.map(rotulo).join(", ")}.`);
        }
        const fueraDePunto = puntosQueNoAplican(r.plataforma);
        if (fueraDePunto.length) {
          lineas.push(
            `- Puntos que no aplican en esta red: ${fueraDePunto.join(", ")} — van con aplica: false.`,
          );
        }
        if (r.transcritas?.length) {
          lineas.push(
            `- Salieron de una captura y el dueño las confirmó: ${r.transcritas
              .map(rotulo)
              .join(", ")}.`,
          );
        }

        return `### ${nombreRed(r)}  (id: ${r.id})\n${lineas.join("\n")}`;
      })
      .join("\n\n");

    const piezas = contarPiezas(publicado.textos);
    const bloquePublicado = [
      publicado.ventana
        ? `Ventana temporal declarada: ${publicado.ventana}.`
        : "Ventana temporal: no la declaró — no afirmes ningún ritmo.",
      publicado.cuadriculas.length
        ? `Cuadrículas adjuntas: ${publicado.cuadriculas.length}. Dan ritmo, formato y temas repetidos. No dan las palabras.`
        : "Cuadrículas: ninguna.",
      piezas
        ? `Textos completos pegados: ${piezas}. De aquí y solo de aquí salen las palabras.${
            piezas < MIN_PIEZAS_PARA_PATRON
              ? ` Son menos de ${MIN_PIEZAS_PARA_PATRON}: no escribas «siempre» ni «nunca».`
              : ""
          }\n\n${publicado.textos.trim()}`
        : "Textos completos pegados: ninguno.",
    ].join("\n");

    const hayPublicado = publicado.cuadriculas.length > 0 || piezas > 0;

    // Para no volver a proponer una corrección que ya aplicó. No para
    // re-evaluar el pasado: eso convertiría el historial en examen.
    const anterior = contexto.negocioId ? await estadoAnterior(contexto.negocioId) : "";

    const texto = [
      anterior ? `${anterior}\n` : "",
      `## Redes a revisar (${redes.length})`,
      "Las casillas ya vienen confirmadas por el dueño. Cópialas literal en `actual`.",
      "",
      bloqueRedes,
      "\n## Lo ya publicado",
      hayPublicado ? bloquePublicado : "(nada — dilo en limites y deja linea_base vacía)",
      // Van TODAS las que ya se preguntaron, contestadas o no. Si solo viajaran
      // las contestadas, las que dejó en blanco volverían a salir la ronda
      // siguiente — y eso es no haberle escuchado.
      cuerpo.respuestas?.length
        ? "\n## Preguntas que ya le hiciste — no repitas ninguna\n\n" +
          cuerpo.respuestas
            .map(
              (r) =>
                `P: ${r.pregunta}\nR: ${r.respuesta.trim() || "(la dejó en blanco a propósito)"}`,
            )
            .join("\n\n")
        : "",
      "\nDevuelve solo el JSON.",
    ].join("\n");

    const permiso = await revisarCuota(usuario.id, contexto.negocioId);
    if (!permiso.ok) {
      return Response.json(
        { error: permiso.mensaje, cuota: permiso.cuota, agotada: true },
        { status: 402 },
      );
    }

    const r = await generar({
      sistema: instrucciones,
      estable: contexto.estable,
      texto,
      adjuntos,
    });

    const salida = extraerJSON<Diagnostico>(r.texto);

    if (contexto.negocioId) {
      await guardarCorrida(contexto.negocioId, 1, salida, r.modelo, {
        redes,
        publicado: { textos: publicado.textos, ventana: publicado.ventana },
      });
    }

    return Response.json({
      diagnostico: salida,
      meta: { proveedor: r.proveedor, modelo: r.modelo, uso: r.uso },
    });
  } catch (e) {
    if (e instanceof FaltaNegocio) {
      return Response.json({ error: e.message }, { status: 400 });
    }
    // El mensaje del proveedor llega en inglés y no le sirve a quien lo lee.
    console.error("diagnostico:", e instanceof Error ? e.message : e);
    return Response.json(
      { error: "No se pudo completar el diagnóstico. Vuelve a intentarlo." },
      { status: 500 },
    );
  }
}
