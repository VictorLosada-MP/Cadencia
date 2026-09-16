import { extraerJSON, generar } from "@/lib/modelo";
import { negocioDe, usuarioActual } from "@/lib/negocio";
import { cargarPerfil, cargarPrompt, perfilDesdeNegocio } from "@/lib/perfil";
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
    const instrucciones = await cargarPrompt("2-banco.md");

    let perfil, voz;
    let guardadas = "";
    if (cuerpo.perfilId) {
      ({ perfil, voz } = await cargarPerfil(cuerpo.perfilId));
    } else {
      const guardado = await negocioDe(usuario.id);
      if (!guardado) {
        return Response.json(
          { error: "Llena primero tu negocio: qué vendes, a quién le sirve y cómo queda después." },
          { status: 400 },
        );
      }
      perfil = perfilDesdeNegocio(guardado);
      voz = guardado.voz?.trim() ?? "";
      guardadas = guardado.senales?.trim() ?? "";
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { voz: _fuente, ...nucleo } = perfil.nucleo;

    const estable = [
      "## Perfil de Negocio",
      JSON.stringify({ ...perfil, nucleo }, null, 2),
      voz ? `\n## Muestras de voz\n\n${voz}` : "\n## Muestras de voz\n\n(ninguna)",
    ].join("\n");

    // Lo que mande la pantalla gana; si no viene, lo guardado en el negocio.
    const senales = cuerpo.senales?.trim() || guardadas;
    const texto = [
      "## Lo que le escriben y le preguntan",
      senales
        ? senales
        : "(no lo dijo — dedúcelo de las objeciones del Perfil, y si tampoco hay, asume N0–N1 y dilo en limites)",
      "\nDevuelve solo el JSON.",
    ].join("\n");

    const r = await generar({ sistema: instrucciones, estable, texto });

    return Response.json({
      banco: extraerJSON<Banco>(r.texto),
      meta: { proveedor: r.proveedor, modelo: r.modelo, uso: r.uso },
    });
  } catch (e) {
    console.error("banco:", e instanceof Error ? e.message : e);
    return Response.json(
      { error: "No se pudo armar la semana. Vuelve a intentarlo." },
      { status: 500 },
    );
  }
}
