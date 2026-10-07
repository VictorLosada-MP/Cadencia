import { createHash, randomUUID, timingSafeEqual } from "node:crypto";

/**
 * Wompi: las firmas y nada más.
 *
 * Las dos firmas de Wompi son distintas y se confunden con facilidad, así que
 * van juntas aquí, con su fórmula al lado:
 *
 * - **Integridad**, para MANDAR al checkout:
 *   `SHA256(referencia + monto_en_centavos + moneda + secreto_de_integridad)`
 * - **Eventos**, para COMPROBAR lo que vuelve:
 *   `SHA256(valores de signature.properties en orden + timestamp + secreto_de_eventos)`
 *
 * Las dos se calculan en el servidor y solo en el servidor. La de integridad
 * existe precisamente para que nadie pueda cambiar el precio desde el
 * navegador: si saliera del cliente, el secreto estaría en el navegador y la
 * firma no valdría nada.
 */

export const MONEDA = "COP";
/** Es el mismo para pruebas y para producción: lo que cambia es la clave. */
export const CHECKOUT = "https://checkout.wompi.co/p/";

export type Config = {
  publica: string;
  integridad: string;
  eventos: string;
};

/**
 * Las claves, o null si no están puestas.
 *
 * Null y no una excepción: sin claves, el sitio tiene que seguir funcionando
 * entero y lo único que desaparece es el botón de pagar. Un despliegue a medio
 * configurar no puede tumbar la portada.
 */
export function config(): Config | null {
  const publica = process.env.WOMPI_PUBLIC_KEY?.trim();
  const integridad = process.env.WOMPI_INTEGRITY_SECRET?.trim();
  const eventos = process.env.WOMPI_EVENTS_SECRET?.trim();
  if (!publica || !integridad || !eventos) return null;
  return { publica, integridad, eventos };
}

/** Verdad cuando las claves son las de pruebas. Se dice en pantalla. */
export const esPrueba = (publica: string) => publica.startsWith("pub_test_");

/**
 * La referencia del pago.
 *
 * Única siempre, porque es la que une el checkout, el evento y la fila de la
 * base: si se repitiera, un evento viejo podría activar un plan nuevo. Sin
 * datos de la persona dentro — viaja en una URL y acaba en el historial del
 * navegador y en los registros de Wompi.
 */
export const nuevaReferencia = () => `cad-${randomUUID().replace(/-/g, "")}`;

/** SHA256(referencia + monto + moneda + secreto). En hex, como lo pide. */
export function firmaIntegridad(
  referencia: string,
  centavos: number,
  secreto: string,
  moneda = MONEDA,
): string {
  return createHash("sha256")
    .update(`${referencia}${centavos}${moneda}${secreto}`)
    .digest("hex");
}

export type Evento = {
  event?: string;
  data?: { transaction?: Record<string, unknown> };
  signature?: { properties?: string[]; checksum?: string };
  timestamp?: number;
};

/** Saca "transaction.status" de { transaction: { status } }. */
function porRuta(raiz: unknown, ruta: string): string {
  let aqui: unknown = raiz;
  for (const parte of ruta.split(".")) {
    if (aqui === null || typeof aqui !== "object") return "";
    aqui = (aqui as Record<string, unknown>)[parte];
  }
  return aqui === null || aqui === undefined ? "" : String(aqui);
}

/**
 * ¿Lo mandó Wompi de verdad?
 *
 * La lista de propiedades se lee del propio evento y NO se escribe aquí a
 * mano: Wompi dice en su documentación que puede cambiar, y una lista fija
 * haría que el día que cambie se rechacen todos los pagos buenos.
 *
 * La comparación es en tiempo constante. Comparar dos textos con `===` tarda
 * más cuanto más coinciden, y esa diferencia, medida muchas veces, deja
 * adivinar la firma carácter a carácter.
 *
 * Devuelve también las dos firmas —no el secreto— porque hace falta poder ver
 * en el registro por qué se rechazó un evento. La documentación de Wompi trae
 * un ejemplo cuyo checksum impreso no cuadra con sus propios datos de entrada,
 * así que la fórmula está puesta como la describe el texto y la prueba de
 * verdad es el primer evento de su entorno de pruebas. Si algo no cuadrara,
 * esto rechaza: un pago que no entra se arregla; uno falso que entra, no.
 */
export function eventoAutentico(
  evento: Evento,
  secreto: string,
  deCabecera?: string | null,
): { ok: boolean; mio: string; dicho: string } {
  const propiedades = evento.signature?.properties;
  const dicho = String(evento.signature?.checksum ?? deCabecera ?? "").toLowerCase();
  const vacio = { ok: false, mio: "", dicho };
  if (!Array.isArray(propiedades) || !propiedades.length || !dicho) return vacio;
  if (typeof evento.timestamp !== "number") return vacio;

  const cadena =
    propiedades.map((r) => porRuta(evento.data, r)).join("") +
    String(evento.timestamp) +
    secreto;
  const mio = createHash("sha256").update(cadena).digest("hex");

  const a = Buffer.from(mio, "utf8");
  const b = Buffer.from(dicho, "utf8");
  return { ok: a.length === b.length && timingSafeEqual(a, b), mio, dicho };
}
