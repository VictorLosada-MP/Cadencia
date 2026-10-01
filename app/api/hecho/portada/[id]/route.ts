import { una } from "@/lib/db";
import { negocioDe, usuarioActual } from "@/lib/negocio";

/**
 * El fotograma de una pieza entregada.
 *
 * Aparte de la lista y no dentro de su JSON: así el navegador los pide en
 * paralelo, los cachea y solo baja los que se ven. Metidos en la respuesta de
 * /api/hecho serían dos megas en cada carga de la pantalla, para unas miniaturas
 * que casi nunca cambian.
 *
 * Y se comprueba el negocio en el propio select: el id va en la URL, así que
 * sin ese `and negocio_id` cualquiera que adivinara un uuid vería la portada
 * de otra cuenta.
 */
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return new Response(null, { status: 400 });

  const usuario = await usuarioActual();
  if (!usuario) return new Response(null, { status: 401 });

  try {
    const negocio = await negocioDe(usuario.id);
    if (!negocio) return new Response(null, { status: 404 });

    const fila = await una<{ portada: string | null }>(
      `select portada from entregado where id = $1 and negocio_id = $2`,
      [id, negocio.id],
    );
    if (!fila?.portada) return new Response(null, { status: 404 });

    const bytes = Buffer.from(fila.portada, "base64");
    return new Response(new Uint8Array(bytes), {
      headers: {
        "Content-Type": "image/jpeg",
        "Content-Length": String(bytes.length),
        // La portada de una pieza entregada no vuelve a cambiar nunca: la fila
        // se escribe una vez, al descargar. Un año de caché privada.
        "Cache-Control": "private, max-age=31536000, immutable",
      },
    });
  } catch (e) {
    console.error("portada GET:", e instanceof Error ? e.message : e);
    return new Response(null, { status: 500 });
  }
}
