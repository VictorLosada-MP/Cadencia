import { cargarContexto, FaltaNegocio } from "@/lib/contexto";
import { revisarCuota } from "@/lib/cuota";
import { guardarCorrida } from "@/lib/historial";
import { extraerJSON, generar } from "@/lib/modelo";
import { usuarioActual } from "@/lib/negocio";
import { cargarPrompt } from "@/lib/perfil";
import { familiaDe, formatoPorId, PROMPT_DE, type Ganchos, type Pieza } from "@/types/guion";

export const maxDuration = 300;

/** Lo mismo que acepta /api/historia: lo que no cabe ahí no cabe aquí. */
const MAX_HISTORIA = 6000;

type Cuerpo = {
  /** "ganchos" afila la idea y devuelve tres; "pieza" produce lo que toque. */
  paso: "ganchos" | "pieza";
  formato: string;
  idea: string;
  angulo?: string;
  /** Solo en el paso "guion": lo que devolvió el primero. */
  idea_afilada?: string;
  gancho?: string;
  /**
   * La historia que contó él, ya ordenada. Solo viene en los días que la
   * piden. Cuando viene, es la única fuente de hechos: el prompt tiene
   * prohibido inventar, y hasta ahora esos días salían con una historia
   * fabricada o con una nota diciéndole que la dejara escrita en su perfil.
   */
  historia?: string;
};

export async function POST(request: Request) {
  const usuario = await usuarioActual();
  if (!usuario) {
    return Response.json({ error: "Entra a tu cuenta para escribir la pieza." }, { status: 401 });
  }

  let cuerpo: Cuerpo;
  try {
    cuerpo = await request.json();
  } catch {
    return Response.json({ error: "Cuerpo inválido." }, { status: 400 });
  }

  const formato = formatoPorId(cuerpo.formato);
  if (!formato) return Response.json({ error: "Elige un formato." }, { status: 400 });
  if (!cuerpo.idea?.trim()) {
    return Response.json({ error: "Dime de qué va la pieza." }, { status: 400 });
  }
  if (cuerpo.paso === "pieza" && !cuerpo.gancho?.trim()) {
    return Response.json({ error: "Elige uno de los tres ganchos." }, { status: 400 });
  }

  try {
    const contexto = await cargarContexto(usuario.id);

    // Regla 3·4 del reglamento: sin muestras de voz no genera, las pide. Un
    // guion sin voz sale correcto y no suena a nadie — es el techo genérico.
    if (!contexto.voz) {
      return Response.json(
        {
          error:
            "Para escribir algo que suene a ti hacen falta muestras de cómo hablas. " +
            "Pega algo tuyo tal cual en «Cómo hablas», dentro de tu negocio: " +
            "un audio transcrito, un mensaje a un cliente. Sin eso sale correcto " +
            "y no suena a ti.",
          falta: "voz",
        },
        { status: 422 },
      );
    }

    const familia = familiaDe(formato.id);
    const instrucciones = await cargarPrompt(
      cuerpo.paso === "ganchos" ? "3-ganchos.md" : PROMPT_DE[familia],
    );

    const historia = (cuerpo.historia ?? "").trim().slice(0, MAX_HISTORIA);
    const comun = [
      `## Formato elegido`,
      `${formato.nombre} — ${formato.que} (${formato.detalle})`,
      cuerpo.angulo?.trim() ? `\n## Ángulo\n${cuerpo.angulo.trim()}` : "",
      historia
        ? `\n## Su historia, contada por él\n\nEs la ÚNICA fuente de hechos de esta pieza. No añades ninguno.\n\n${historia}`
        : "",
    ];

    const texto =
      cuerpo.paso === "ganchos"
        ? [...comun, `\n## La idea, como la escribió el dueño\n${cuerpo.idea.trim()}`,
           "\nDevuelve solo el JSON."].join("\n")
        : [
            ...comun,
            `\n## La idea afilada\n${cuerpo.idea_afilada?.trim() || cuerpo.idea.trim()}`,
            `\n## El gancho que eligió — el primer golpe es este, literal\n${cuerpo.gancho!.trim()}`,
            "\nDevuelve solo el JSON.",
          ].join("\n");

    const permiso = await revisarCuota(usuario.id, contexto.negocioId, 3);
    if (!permiso.ok) {
      return Response.json(
        { error: permiso.mensaje, cuota: permiso.cuota, agotada: true },
        { status: 402 },
      );
    }

    const r = await generar({ sistema: instrucciones, estable: contexto.estable, texto });
    const salida = extraerJSON<Ganchos | Pieza>(r.texto);

    // Solo se guarda el guion terminado: los tres ganchos son un paso
    // intermedio y guardarlos llenaría el historial de borradores.
    if (cuerpo.paso === "pieza" && contexto.negocioId) {
      await guardarCorrida(contexto.negocioId, 3, salida, r.modelo, {
        formato: cuerpo.formato,
        familia,
        idea: cuerpo.idea,
        gancho: cuerpo.gancho,
        historia: historia || undefined,
      });
    }

    return Response.json({
      [cuerpo.paso]: salida,
      familia,
      meta: { proveedor: r.proveedor, modelo: r.modelo, uso: r.uso },
    });
  } catch (e) {
    if (e instanceof FaltaNegocio) {
      return Response.json({ error: e.message }, { status: 400 });
    }
    console.error("guion:", e instanceof Error ? e.message : e);
    return Response.json(
      { error: "No se pudo escribir la pieza. Vuelve a intentarlo." },
      { status: 500 },
    );
  }
}
