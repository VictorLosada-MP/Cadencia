import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

/**
 * Lee un sitio web público y saca lo que ve quien llega.
 *
 * Es el equivalente de la captura para una web: nadie va a fotografiar su
 * propia página para que el sistema la lea. Y no es scraping de una red social
 * — es una página pública que su dueño acaba de escribir en un formulario.
 */

export type Lectura = {
  nombre: string;
  titular: string;
  promesa: string;
  cta: string;
  link: string;
};

const LIMITE_BYTES = 800_000;
const SALTOS = 3;

/**
 * Ninguna petición puede acabar dentro de la red donde corre el servidor.
 * Sin esto, escribir "http://localhost:5432" en un formulario convierte esta
 * función en una ventana a lo que haya detrás.
 */
async function esPublica(host: string): Promise<boolean> {
  const ip = isIP(host) ? host : (await lookup(host)).address;
  if (isIP(ip) === 6) {
    const bajo = ip.toLowerCase();
    return !(
      bajo === "::1" ||
      bajo.startsWith("fc") ||
      bajo.startsWith("fd") ||
      bajo.startsWith("fe80") ||
      bajo.startsWith("::ffff:127.") ||
      bajo.startsWith("::ffff:10.") ||
      bajo.startsWith("::ffff:192.168.")
    );
  }
  const [a, b] = ip.split(".").map(Number);
  return !(
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    a >= 224
  );
}

export function normalizar(entrada: string): string {
  const limpio = entrada.trim();
  return /^https?:\/\//i.test(limpio) ? limpio : `https://${limpio}`;
}

async function traer(url: string): Promise<{ html: string; final: string }> {
  let actual = url;

  for (let salto = 0; salto <= SALTOS; salto++) {
    const u = new URL(actual);
    if (u.protocol !== "http:" && u.protocol !== "https:") {
      throw new Error("Solo puedo leer direcciones http y https.");
    }
    if (!(await esPublica(u.hostname))) {
      throw new Error("Esa dirección no es pública.");
    }

    const r = await fetch(actual, {
      redirect: "manual",
      headers: { "User-Agent": "Cadencia/1.0 (lector de perfil, +sin almacenamiento)" },
      signal: AbortSignal.timeout(12_000),
    });

    if (r.status >= 300 && r.status < 400) {
      const destino = r.headers.get("location");
      if (!destino) throw new Error("La página redirige a ninguna parte.");
      actual = new URL(destino, actual).toString();
      continue;
    }
    if (!r.ok) throw new Error(`La página respondió ${r.status}.`);

    const tipo = r.headers.get("content-type") ?? "";
    if (!tipo.includes("html")) throw new Error("Esa dirección no devuelve una página web.");

    // Se corta la lectura: no hace falta el sitio entero para leer su portada.
    const bytes = new Uint8Array(await r.arrayBuffer());
    return {
      html: new TextDecoder().decode(bytes.slice(0, LIMITE_BYTES)),
      final: actual,
    };
  }
  throw new Error("La página redirige demasiadas veces.");
}

const quitar = (html: string) =>
  html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ");

const texto = (trozo: string) =>
  trozo
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();

function primero(html: string, etiqueta: string): string {
  const m = html.match(new RegExp(`<${etiqueta}[^>]*>([\\s\\S]*?)</${etiqueta}>`, "i"));
  return m ? texto(m[1]) : "";
}

function meta(html: string, nombre: string): string {
  const patrones = [
    new RegExp(`<meta[^>]+(?:name|property)=["']${nombre}["'][^>]+content=["']([^"']*)["']`, "i"),
    new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]+(?:name|property)=["']${nombre}["']`, "i"),
  ];
  for (const p of patrones) {
    const m = html.match(p);
    if (m) return texto(m[1]);
  }
  return "";
}

/** El botón principal: el primer enlace o botón con texto que pida una acción. */
function botonPrincipal(html: string): string {
  const candidatos = [...html.matchAll(/<(?:button|a)\b[^>]*>([\s\S]*?)<\/(?:button|a)>/gi)]
    .map((m) => texto(m[1]))
    .filter((t) => t.length >= 3 && t.length <= 60);

  const pide =
    /\b(empieza|empezar|comienza|prueba|pruébalo|agenda|reserva|solicita|pide|contacta|contáctanos|únete|unete|registra|regístrate|compra|descarga|aplica|habla|escríbenos|escribenos|cotiza|suscr)/i;

  return candidatos.find((t) => pide.test(t)) ?? candidatos[0] ?? "";
}

/**
 * Lee una publicación desde su enlace.
 *
 * Funciona porque una página pública publica sus propias etiquetas `og:` para
 * que cualquier enlace se previsualice — es lo mismo que hace WhatsApp cuando
 * pegas un link. No es entrar a una cuenta ni automatizar nada.
 *
 * Comprobado el 25 de septiembre de 2026: el enlace de una publicación de
 * Instagram devuelve su texto; el de un perfil devuelve 429. Puede dejar de
 * funcionar el día que ellos quieran, y por eso pegar el texto a mano sigue
 * estando.
 */
export async function leerPublicacion(entrada: string): Promise<{ texto: string; de: string }> {
  const { html, final } = await traer(normalizar(entrada));
  const limpio = quitar(html);

  const crudo =
    meta(limpio, "og:description") || meta(limpio, "description") || primero(limpio, "title");

  if (!crudo) throw new Error("Esa página no publica su texto; pégalo a mano.");

  return { texto: sinContadores(crudo), de: new URL(final).hostname.replace(/^www\./, "") };
}

/**
 * Fuera los contadores antes de que el modelo los vea.
 *
 * Instagram mete "280 likes, 149 comments - fulano on 23 September:" delante
 * del texto. Si eso entra al prompt, el sistema empieza a comparar piezas entre
 * sí — y comparar piezas es calificarlas, que es justo lo que prohíbe la regla
 * de línea base. La defensa tiene que estar aquí, no en pedirle al modelo que
 * se contenga.
 */
export function sinContadores(texto: string): string {
  let t = texto
    .replace(
      /^[\d.,KkMm]+\s*(likes?|me gusta|comments?|comentarios?|views?|reproducciones?)(,\s*)?/gi,
      "",
    )
    .replace(
      /^[\d.,KkMm]+\s*(likes?|me gusta|comments?|comentarios?|views?|reproducciones?)(,\s*)?/gi,
      "",
    );

  // "- fulano on September 23, 2026:" es la cabecera que Instagram antepone.
  t = t.replace(/^\s*[-–—]\s*[^:]{0,60}?\son\s[^:]{0,40}:\s*/i, "");
  t = t.replace(/^\s*[-–—]\s*/, "");

  return t
    .replace(/&#x([0-9a-f]+);/gi, (_, c) => String.fromCodePoint(parseInt(c, 16)))
    .replace(/&#(\d+);/g, (_, c) => String.fromCodePoint(Number(c)))
    // Las comillas con las que envuelven el texto, y el punto que cierra la
    // frase de ellos — no el del dueño.
    .replace(/^["“”']+/, "")
    .replace(/["“”']+\s*\.?\s*$/, "")
    .trim();
}

export async function leerSitio(entrada: string): Promise<Lectura> {
  const { html, final } = await traer(normalizar(entrada));
  const limpio = quitar(html);

  const titulo = primero(limpio, "title") || meta(limpio, "og:site_name");
  const h1 = primero(limpio, "h1");
  const descripcion = meta(limpio, "description") || meta(limpio, "og:description");
  const h2 = primero(limpio, "h2");

  return {
    // El nombre del sitio: lo de antes del separador del título suele serlo.
    nombre: (meta(limpio, "og:site_name") || titulo.split(/\s[|·—–-]\s/)[0] || "").trim(),
    titular: h1 || titulo,
    promesa: descripcion || h2,
    cta: botonPrincipal(limpio),
    link: final,
  };
}
