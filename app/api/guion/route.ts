import { cargarContexto, FaltaNegocio } from "@/lib/contexto";
import { extraerJSON, generar } from "@/lib/modelo";
import { usuarioActual } from "@/lib/negocio";
import { cargarPrompt } from "@/lib/perfil";
import { FORMATOS, type Ganchos, type Guion } from "@/types/guion";

export const maxDuration = 300;

type Cuerpo = {
  /** "ganchos" afila la idea y devuelve tres; "guion" escribe alrededor del elegido. */
  paso: "ganchos" | "guion";
  formato: string;
  idea: string;
  angulo?: string;
  /** Solo en el paso "guion": lo que devolvió el primero. */
  idea_afilada?: string;
  gancho?: string;
  perfilId?: string;
};

export async function POST(request: Request) {
  const usuario = await usuarioActual();
  if (!usuario) {
    return Response.json({ error: "Entra a tu cuenta para escribir el guion." }, { status: 401 });
  }

  let cuerpo: Cuerpo;
  try {
    cuerpo = await request.json();
  } catch {
    return Response.json({ error: "Cuerpo inválido." }, { status: 400 });
  }

  const formato = FORMATOS.find((f) => f.id === cuerpo.formato);
  if (!formato) return Response.json({ error: "Elige un formato." }, { status: 400 });
  if (!cuerpo.idea?.trim()) {
    return Response.json({ error: "Dime de qué va la pieza." }, { status: 400 });
  }
  if (cuerpo.paso === "guion" && !cuerpo.gancho?.trim()) {
    return Response.json({ error: "Elige uno de los tres ganchos." }, { status: 400 });
  }

  try {
    const contexto = await cargarContexto(usuario.id, cuerpo.perfilId);

    // Regla 3·4 del reglamento: sin muestras de voz no genera, las pide. Un
    // guion sin voz sale correcto y no suena a nadie — es el techo genérico.
    if (!contexto.voz) {
      return Response.json(
        {
          error:
            "Para escribir un guion tuyo hacen falta muestras de cómo hablas. " +
            "Pega algo tuyo tal cual en «Cómo hablas», dentro de tu negocio: " +
            "un audio transcrito, un mensaje a un cliente. Sin eso el guion sale " +
            "correcto y no suena a ti.",
          falta: "voz",
        },
        { status: 422 },
      );
    }

    const instrucciones = await cargarPrompt(
      cuerpo.paso === "ganchos" ? "3-ganchos.md" : "3-guion.md",
    );

    const comun = [
      `## Formato elegido`,
      `${formato.nombre} — ${formato.que} (${formato.golpes})`,
      cuerpo.angulo?.trim() ? `\n## Ángulo\n${cuerpo.angulo.trim()}` : "",
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

    const r = await generar({ sistema: instrucciones, estable: contexto.estable, texto });
    const salida = extraerJSON<Ganchos | Guion>(r.texto);

    return Response.json({
      [cuerpo.paso]: salida,
      meta: { proveedor: r.proveedor, modelo: r.modelo, uso: r.uso },
    });
  } catch (e) {
    if (e instanceof FaltaNegocio) {
      return Response.json({ error: e.message }, { status: 400 });
    }
    console.error("guion:", e instanceof Error ? e.message : e);
    return Response.json(
      { error: "No se pudo escribir el guion. Vuelve a intentarlo." },
      { status: 500 },
    );
  }
}
