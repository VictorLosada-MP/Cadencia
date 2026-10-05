import { cuotaDe } from "@/lib/cuota";
import { negocioDe, usuarioActual } from "@/lib/negocio";
import { enlaceDelPanel, esAdmin } from "@/lib/panel";

/**
 * Solo la cuota, para la barra de arriba.
 *
 * Existe aparte porque la barra está en todas las pantallas: si pidiera el
 * negocio entero —con su comparación y su historial— cada página pagaría cuatro
 * consultas para pintar un contador de dos números.
 *
 * Y de paso dice si esta cuenta administra, para que la barra le pinte el
 * enlace al panel. Aquí y no en una llamada aparte: la barra ya hace esta, y
 * una segunda petición en todas las pantallas para una línea que casi nadie ve
 * sería pagar por todos lo que usa uno.
 */
export async function GET() {
  const usuario = await usuarioActual();
  if (!usuario) return Response.json({ error: "Entra a tu cuenta." }, { status: 401 });

  try {
    const negocio = await negocioDe(usuario.id);
    // `panel` sale null para todo el mundo menos para quien administra: la
    // llave no llega al navegador de quien no podría usarla.
    const panel = (await esAdmin(usuario.id)) ? enlaceDelPanel() : null;
    return Response.json({
      cuota: await cuotaDe(usuario.id, negocio?.id ?? null),
      panel,
    });
  } catch (e) {
    console.error("cuota:", e instanceof Error ? e.message : e);
    return Response.json({ error: "No se pudo leer." }, { status: 500 });
  }
}
