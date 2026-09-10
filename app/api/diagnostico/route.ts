import { extraerJSON, generar, type Adjunto } from "@/lib/modelo";
import { cargarPerfil, cargarPrompt, perfilDesdeNegocio } from "@/lib/perfil";
import type { Diagnostico } from "@/types/diagnostico";
import { negocioDe, usuarioActual } from "@/lib/negocio";
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
    const instrucciones = await cargarPrompt("1-diagnostico.md");

    let perfil, voz;
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
    }

    // La voz va aparte y en crudo; dentro del JSON solo estorbaría su ruta.
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { voz: _fuente, ...nucleo } = perfil.nucleo;

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

    // El perfil y la voz no cambian entre corridas: van aparte para poder
    // cachearlos. "Afinar con mis respuestas" los reenvía idénticos.
    const estable = [
      "## Perfil de Negocio",
      JSON.stringify({ ...perfil, nucleo }, null, 2),
      voz ? `\n## Muestras de voz\n\n${voz}` : "\n## Muestras de voz\n\n(ninguna)",
    ].join("\n");

    const texto = [
      `## Redes a revisar (${redes.length})`,
      "Las casillas ya vienen confirmadas por el dueño. Cópialas literal en `actual`.",
      "",
      bloqueRedes,
      "\n## Lo ya publicado",
      hayPublicado ? bloquePublicado : "(nada — dilo en limites y deja linea_base vacía)",
      cuerpo.respuestas?.length
        ? "\n## Respuestas del dueño a preguntas anteriores\n\n" +
          cuerpo.respuestas
            .filter((r) => r.respuesta.trim())
            .map((r) => `P: ${r.pregunta}\nR: ${r.respuesta.trim()}`)
            .join("\n\n")
        : "",
      "\nDevuelve solo el JSON.",
    ].join("\n");

    const r = await generar({ sistema: instrucciones, estable, texto, adjuntos });

    return Response.json({
      diagnostico: extraerJSON<Diagnostico>(r.texto),
      meta: { proveedor: r.proveedor, modelo: r.modelo, uso: r.uso },
    });
  } catch (e) {
    // El mensaje del proveedor llega en inglés y no le sirve a quien lo lee.
    console.error("diagnostico:", e instanceof Error ? e.message : e);
    return Response.json(
      { error: "No se pudo completar el diagnóstico. Vuelve a intentarlo." },
      { status: 500 },
    );
  }
}
