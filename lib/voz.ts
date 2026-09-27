import { una } from "@/lib/db";

/**
 * El tope de transcripción.
 *
 * Los subtítulos no gastan una corrida —transcribir no escribe nada, copia lo
 * que el dueño ya dijo— pero tampoco pueden ser una factura abierta. El tope
 * va por segundos de audio al día, que es lo que se corresponde con el cargo
 * real del proveedor.
 */
export const MINUTOS_AL_DIA = 20;
const TOPE_S = MINUTOS_AL_DIA * 60;

/** Lo más largo que se acepta de una vez. Un reel no dura más. */
export const MAX_SEGUNDOS = 180;

export type Permiso =
  | { ok: true; gastados: number }
  | { ok: false; mensaje: string; gastados: number };

export async function revisarVoz(negocioId: string, segundos: number): Promise<Permiso> {
  const fila = await una<{ segundos: number }>(
    `select segundos from uso_voz where negocio_id = $1 and dia = current_date`,
    [negocioId],
  );
  const gastados = Number(fila?.segundos ?? 0);

  if (gastados + segundos > TOPE_S) {
    return {
      ok: false,
      gastados,
      mensaje:
        `Hoy ya transcribiste ${Math.round(gastados / 60)} de los ${MINUTOS_AL_DIA} minutos ` +
        "del día. Mañana se reinicia. El video se monta igual sin subtítulos.",
    };
  }
  return { ok: true, gastados };
}

/**
 * Apunta lo gastado. Se llama DESPUÉS de que el proveedor responda bien: un
 * fallo suyo no se le cobra al dueño, igual que con las corridas.
 */
export function apuntarVoz(negocioId: string, segundos: number) {
  return una(
    `insert into uso_voz (negocio_id, dia, segundos)
          values ($1, current_date, $2)
     on conflict (negocio_id, dia)
       do update set segundos = uso_voz.segundos + excluded.segundos`,
    [negocioId, Math.ceil(segundos)],
  );
}
