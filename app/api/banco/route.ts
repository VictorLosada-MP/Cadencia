import { extraerJSON, generar } from "@/lib/modelo";
import { cargarContexto, FaltaNegocio } from "@/lib/contexto";
import { revisarCuota } from "@/lib/cuota";
import { guardarCorrida } from "@/lib/historial";
import { usuarioActual } from "@/lib/negocio";
import { cargarPrompt } from "@/lib/perfil";
import type { Banco } from "@/types/banco";

export const maxDuration = 300;

type Cuerpo = {
  /**
   * Lo que le escriben y le preguntan. Es la señal más fiable de en qué
   * escalón está su audiencia: la gente pregunta desde donde está.
   */
  senales?: string;
  /** Perfil semilla del repositorio, solo para probar el sistema. */
  perfilId?: string;
};

export async function POST(request: Request) {
  const usuario = await usuarioActual();
  if (!usuario) {
    return Response.json({ error: "Entra a tu cuenta para armar la semana." }, { status: 401 });
  }

  let cuerpo: Cuerpo;
  try {
    cuerpo = await request.json();
  } catch {
    return Response.json({ error: "Cuerpo inválido." }, { status: 400 });
  }

  try {
    const [instrucciones, contexto] = await Promise.all([
      cargarPrompt("2-banco.md"),
      cargarContexto(usuario.id, cuerpo.perfilId),
    ]);

    // Lo que mande la pantalla gana; si no viene, lo guardado en el negocio.
    const senales = cuerpo.senales?.trim() || contexto.senales;
    if (!senales) {
      return Response.json(
        {
          error:
            "Escribe primero qué te preguntan tus clientes. De ahí sale todo lo demás — " +
            "si lo adivino, la semana entera queda adivinada.",
          falta: "senales",
        },
        { status: 422 },
      );
    }
    const texto = [
      "## Lo que le escriben y le preguntan",
      senales,
      "\nDevuelve solo el JSON.",
    ].join("\n");

    const permiso = await revisarCuota(usuario.id, contexto.negocioId);
    if (!permiso.ok) {
      return Response.json(
        { error: permiso.mensaje, cuota: permiso.cuota, agotada: true },
        { status: 402 },
      );
    }

    const r = await generar({ sistema: instrucciones, estable: contexto.estable, texto });

    const salida = extraerJSON<Banco>(r.texto);

    if (contexto.negocioId) {
      await guardarCorrida(contexto.negocioId, 2, salida, r.modelo, { senales });
    }

    return Response.json({
      banco: salida,
      meta: { proveedor: r.proveedor, modelo: r.modelo, uso: r.uso },
    });
  } catch (e) {
    if (e instanceof FaltaNegocio) {
      return Response.json({ error: e.message }, { status: 400 });
    }
    console.error("banco:", e instanceof Error ? e.message : e);
    return Response.json(
      { error: "No se pudo armar la semana. Vuelve a intentarlo." },
      { status: 500 },
    );
  }
}
