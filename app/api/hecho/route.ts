import { consultar, una } from "@/lib/db";
import { negocioDe, usuarioActual } from "@/lib/negocio";

export type Entregado = {
  id: string;
  corrida_id: string | null;
  tipo: "video" | "carrusel";
  titulo: string;
  detalle: string;
  creado: string;
};

const TIPOS = ["video", "carrusel"];
const MAX_TITULO = 300;

/**
 * Lo que ya está hecho.
 *
 * Se escribe al DESCARGAR, no al generar: una pieza escrita y nunca bajada se
 * quedó en la pantalla, y contarla como hecha convertiría esta lista en un
 * inventario de buenas intenciones.
 */
export async function GET() {
  const usuario = await usuarioActual();
  if (!usuario) return Response.json({ error: "Entra a tu cuenta." }, { status: 401 });

  try {
    const negocio = await negocioDe(usuario.id);
    if (!negocio) return Response.json({ entregados: [] });

    const entregados = await consultar<Entregado>(
      `select id, corrida_id, tipo, titulo, detalle, creado
         from entregado
        where negocio_id = $1
        order by creado desc
        limit 200`,
      [negocio.id],
    );
    return Response.json({ entregados });
  } catch (e) {
    console.error("hecho GET:", e instanceof Error ? e.message : e);
    return Response.json({ error: "No se pudo leer lo que llevas hecho." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const usuario = await usuarioActual();
  if (!usuario) return Response.json({ error: "Entra a tu cuenta." }, { status: 401 });

  let cuerpo: { tipo?: string; titulo?: string; detalle?: string; corridaId?: string };
  try {
    cuerpo = await request.json();
  } catch {
    return Response.json({ error: "Cuerpo inválido." }, { status: 400 });
  }

  if (!cuerpo.tipo || !TIPOS.includes(cuerpo.tipo)) {
    return Response.json({ error: "Falta de qué pieza es." }, { status: 400 });
  }

  try {
    const negocio = await negocioDe(usuario.id);
    if (!negocio) return Response.json({ error: "Guarda tu negocio primero." }, { status: 400 });

    // La corrida se comprueba contra ESTE negocio antes de guardarla. Sin eso,
    // un id copiado de otra cuenta quedaría enganchado a la ficha de aquí.
    let corridaId: string | null = null;
    if (cuerpo.corridaId) {
      const suya = await una<{ id: string }>(
        `select id from corrida where id = $1 and negocio_id = $2`,
        [cuerpo.corridaId, negocio.id],
      );
      corridaId = suya?.id ?? null;
    }

    const fila = await una<{ id: string }>(
      `insert into entregado (negocio_id, corrida_id, tipo, titulo, detalle)
            values ($1, $2, $3, $4, $5)
         returning id`,
      [
        negocio.id,
        corridaId,
        cuerpo.tipo,
        (cuerpo.titulo ?? "").slice(0, MAX_TITULO),
        (cuerpo.detalle ?? "").slice(0, 120),
      ],
    );
    return Response.json({ id: fila?.id });
  } catch (e) {
    console.error("hecho POST:", e instanceof Error ? e.message : e);
    return Response.json({ error: "No se pudo apuntar." }, { status: 500 });
  }
}
