/**
 * Lo que comparten el panel y su pantalla.
 *
 * Vive aquí y no en `lib/panel.ts` porque ese módulo lee la sesión, y leer la
 * sesión necesita `next/headers`, que solo existe en el servidor. Una pantalla
 * que importara el tipo de allí se arrastraría media librería de autenticación
 * al navegador — y el montaje se cae antes, que es lo bueno.
 */

/** El id del plan que se regala a los clientes de la marca. */
export const VIP = "vip";

export type Cuenta = {
  id: string;
  email: string;
  nombre: string;
  creado: string;
  /** Null cuando todavía no ha guardado su negocio. */
  negocio_id: string | null;
  oferta: string | null;
  cliente: string | null;
  despues: string | null;
  negocio_nombre: string | null;
  /** El plan que paga (o 'prueba'), al margen de la cortesía. */
  plan: string;
  /** El plan regalado, si lo hay. 'vip' cuando es VIP. */
  cortesia: string | null;
  cortesia_hasta: string | null;
  corridas_mes: number;
  corridas_total: number;
  entregados: number;
  ultima: string | null;
};
