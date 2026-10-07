import { una } from "@/lib/db";
import { negocioDe, usuarioActual } from "@/lib/negocio";

/** Lo que cabe en «cómo hablas». Más allá, el prompt no lo aprovecha mejor. */
const MAX = 6000;

/**
 * Guarda como muestras de voz los textos que ya publicó.
 *
 * Es el remate que le faltaba al lector de enlaces. Leer la descripción de una
 * publicación sirve de poco para diagnosticar un patrón —una pieza no es un
 * patrón— pero es una muestra excelente de CÓMO ESCRIBE, que es justo el campo
 * que casi nadie rellena y el único sin el que la función 3 se niega a escribir
 * nada. Lo que ya estaba escrito se reaprovecha en vez de pedírselo otra vez.
 *
 * Se añade, nunca se pisa: lo que él escribió a mano vale más que lo que se
 * copió de ahí. Y endpoint propio en vez de un PUT del negocio entero para que
 * la pantalla no tenga que mandar de vuelta campos que no está editando — un
 * PUT con un campo olvidado borra ese campo.
 */
export async function POST(request: Request) {
  const usuario = await usuarioActual();
  if (!usuario) return Response.json({ error: "Entra a tu cuenta." }, { status: 401 });

  let cuerpo: { textos?: string };
  try {
    cuerpo = await request.json();
  } catch {
    return Response.json({ error: "Cuerpo inválido." }, { status: 400 });
  }

  const nuevos = (cuerpo.textos ?? "")
    .split(/\n\s*\n/)
    .map((t) => t.trim())
    .filter(Boolean);
  if (!nuevos.length) {
    return Response.json({ error: "No hay textos que guardar." }, { status: 400 });
  }

  try {
    const negocio = await negocioDe(usuario.id);
    if (!negocio) {
      return Response.json({ error: "Guarda tu negocio primero." }, { status: 400 });
    }

    const tenia = (negocio.voz ?? "").trim();
    // Lo que ya estaba no se repite: pulsar el botón dos veces no puede dejar
    // la muestra duplicada, y una muestra duplicada le enseña al modelo que esa
    // frase pesa el doble.
    const faltan = nuevos.filter((t) => !tenia.includes(t));
    if (!faltan.length) {
      return Response.json({ voz: tenia, añadidos: 0 });
    }

    const voz = [tenia, ...faltan].filter(Boolean).join("\n\n").slice(0, MAX);
    await una(`update negocio set voz = $2 where id = $1`, [negocio.id, voz]);
    return Response.json({ voz, añadidos: faltan.length });
  } catch (e) {
    console.error("negocio/voz:", e instanceof Error ? e.message : e);
    return Response.json({ error: "No se pudo guardar." }, { status: 500 });
  }
}
