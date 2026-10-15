import { cuotaDe } from "@/lib/cuota";
import { compararUltimas } from "@/lib/historial";
import { guardarMarca, guardarNegocio, negocioDe, usuarioActual } from "@/lib/negocio";
import { negocioListo, type Negocio } from "@/types/negocio";

export async function GET(request: Request) {
  const usuario = await usuarioActual();
  if (!usuario) return Response.json({ error: "Entra a tu cuenta." }, { status: 401 });

  try {
    const negocio = await negocioDe(usuario.id);

    // Quien solo necesita los campos del negocio no paga la comparación ni la
    // cuota, que son otras cuatro consultas contra una base que está lejos.
    if (new URL(request.url).searchParams.get("ligero")) {
      return Response.json({ negocio });
    }

    const [comparacion, cuota] = await Promise.all([
      negocio ? compararUltimas(negocio.id) : null,
      cuotaDe(usuario.id, negocio?.id ?? null),
    ]);
    return Response.json({ negocio, comparacion, cuota });
  } catch (e) {
    console.error("negocio GET:", e instanceof Error ? e.message : e);
    return Response.json({ error: "No se pudo leer tu negocio." }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  const usuario = await usuarioActual();
  if (!usuario) return Response.json({ error: "Entra a tu cuenta." }, { status: 401 });

  let n: Negocio;
  try {
    n = await request.json();
  } catch {
    return Response.json({ error: "Cuerpo inválido." }, { status: 400 });
  }

  if (!negocioListo(n)) {
    return Response.json(
      {
        error:
          "Falta algo: si es una empresa o eres tú, el nombre, qué vendes, a quién le sirve y cómo queda después.",
      },
      { status: 400 },
    );
  }

  try {
    return Response.json({ negocio: await guardarNegocio(usuario.id, n) });
  } catch (e) {
    console.error("negocio PUT:", e instanceof Error ? e.message : e);
    return Response.json({ error: "No se pudo guardar tu negocio." }, { status: 500 });
  }
}

/**
 * Solo lo de la marca: los colores, la cuadrícula, la foto y el arroba.
 *
 * Aparte del PUT porque quien lo llama —la pantalla del diagnóstico, al subir
 * la cuadrícula— no tiene el negocio entero en la mano. Mandar el PUT desde
 * ahí con lo que hubiera en esa pantalla borraría la voz y las señales.
 */
export async function PATCH(request: Request) {
  const usuario = await usuarioActual();
  if (!usuario) return Response.json({ error: "Entra a tu cuenta." }, { status: 401 });

  let cuerpo: Parameters<typeof guardarMarca>[1];
  try {
    cuerpo = await request.json();
  } catch {
    return Response.json({ error: "Cuerpo inválido." }, { status: 400 });
  }

  try {
    const hecho = await guardarMarca(usuario.id, {
      paleta: cuerpo.paleta,
      cuadricula: cuerpo.cuadricula,
      avatar: cuerpo.avatar,
      handle: cuerpo.handle,
    });
    if (!hecho) {
      // Sin negocio todavía no hay a qué pegarle una marca, y crear uno a
      // medias desde aquí dejaría una fila sin oferta ni cliente.
      return Response.json(
        { error: "Guarda primero tu negocio.", sinNegocio: true },
        { status: 409 },
      );
    }
    return Response.json({ negocio: await negocioDe(usuario.id) });
  } catch (e) {
    console.error("negocio PATCH:", e instanceof Error ? e.message : e);
    return Response.json({ error: "No se pudo guardar tu marca." }, { status: 500 });
  }
}
