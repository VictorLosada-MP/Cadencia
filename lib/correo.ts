/**
 * La única capa que envía correo.
 *
 * Sin proveedor configurado —que es el caso en local— el mensaje se imprime en
 * la terminal donde corre el servidor. No es un apaño: es la forma honesta de
 * que el flujo completo funcione y se pueda probar sin montar un proveedor, y
 * de que quede evidente que en producción hace falta uno.
 */

export type Envio = {
  para: string;
  asunto: string;
  texto: string;
};

export type Entrega = { via: "consola" | "resend" };

export async function enviar(e: Envio): Promise<Entrega> {
  const clave = process.env.RESEND_API_KEY;
  const desde = process.env.CORREO_DESDE;

  if (!clave || !desde) {
    console.log(
      [
        "",
        "─".repeat(72),
        `  CORREO SIN ENVIAR — no hay proveedor configurado`,
        `  Para:    ${e.para}`,
        `  Asunto:  ${e.asunto}`,
        "",
        e.texto
          .split("\n")
          .map((l) => `  ${l}`)
          .join("\n"),
        "─".repeat(72),
        "",
      ].join("\n"),
    );
    return { via: "consola" };
  }

  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${clave}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from: desde, to: e.para, subject: e.asunto, text: e.texto }),
  });

  if (!r.ok) {
    // Se registra y no se relanza: que un correo falle no puede tumbar el
    // flujo ni revelarle a nadie si una dirección existe o no.
    console.error("correo:", r.status, await r.text().catch(() => ""));
  }
  return { via: "resend" };
}
