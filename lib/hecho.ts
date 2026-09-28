/**
 * Apunta que una pieza salió de verdad.
 *
 * Se llama al DESCARGAR, nunca al generar. Y no puede romper la descarga: si
 * el servidor no contesta, el dueño ya tiene su archivo y eso es lo que
 * importaba — la ficha es para él, no para nosotros.
 */
export function apuntarHecho(p: {
  tipo: "video" | "carrusel";
  titulo?: string;
  detalle?: string;
  corridaId?: string | null;
}) {
  return fetch("/api/hecho", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      tipo: p.tipo,
      titulo: p.titulo ?? "",
      detalle: p.detalle ?? "",
      corridaId: p.corridaId ?? undefined,
    }),
  }).catch(() => null);
}
