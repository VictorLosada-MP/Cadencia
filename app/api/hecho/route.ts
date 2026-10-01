import { consultar, una } from "@/lib/db";
import { negocioDe, usuarioActual } from "@/lib/negocio";

export type Entregado = {
  id: string;
  corrida_id: string | null;
  tipo: "video" | "carrusel";
  titulo: string;
  detalle: string;
  creado: string;
  /** Si tiene fotograma. La imagen se pide aparte, a /api/hecho/portada/[id]. */
  portada: boolean;
};

const TIPOS = ["video", "carrusel"];
const MAX_TITULO = 300;

/**
 * Tope del JPEG que se acepta, en caracteres de base64.
 *
 * Un fotograma de 180 píxeles de ancho ronda los diez mil; sesenta mil deja
 * sitio de sobra y a la vez impide que alguien use esta columna como disco.
 */
const MAX_PORTADA = 60_000;

/** base64 y nada más: lo que entra aquí se va a servir como una imagen. */
const BASE64 = /^[A-Za-z0-9+/]+={0,2}$/;

function limpiarPortada(valor: unknown): string | null {
  if (typeof valor !== "string") return null;
  const bruto = valor.includes(",") ? valor.slice(valor.indexOf(",") + 1) : valor;
  const texto = bruto.trim();
  if (!texto || texto.length > MAX_PORTADA || !BASE64.test(texto)) return null;
  return texto;
}

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
      `select id, corrida_id, tipo, titulo, detalle, creado,
              (portada is not null and portada <> '') as portada
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

  let cuerpo: {
    tipo?: string;
    titulo?: string;
    detalle?: string;
    corridaId?: string;
    portada?: string;
  };
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

    // Una portada que no cuadre no tumba el apunte: se guarda la fila sin
    // ella. La pieza ya está bajada y perder la ficha por un fotograma sería
    // cambiar lo que importa por lo que decora.
    const fila = await una<{ id: string }>(
      `insert into entregado (negocio_id, corrida_id, tipo, titulo, detalle, portada)
            values ($1, $2, $3, $4, $5, $6)
         returning id`,
      [
        negocio.id,
        corridaId,
        cuerpo.tipo,
        (cuerpo.titulo ?? "").slice(0, MAX_TITULO),
        (cuerpo.detalle ?? "").slice(0, 120),
        limpiarPortada(cuerpo.portada),
      ],
    );
    return Response.json({ id: fila?.id });
  } catch (e) {
    console.error("hecho POST:", e instanceof Error ? e.message : e);
    return Response.json({ error: "No se pudo apuntar." }, { status: 500 });
  }
}
