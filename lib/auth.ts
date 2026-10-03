import { betterAuth } from "better-auth";
import { enviar } from "@/lib/correo";
import { pool } from "@/lib/db";

/** El origen de despliegue más el de desarrollo, sin barra final y sin repetir. */
function origenes(): string[] {
  const sinBarra = (u: string) => u.trim().replace(/\/+$/, "");
  const lista = [
    process.env.BETTER_AUTH_URL,
    // Vercel nombra cada despliegue de prueba con un dominio distinto. Sin
    // esto, una vista previa queda sin poder entrar a la cuenta.
    process.env.VERCEL_URL && `https://${process.env.VERCEL_URL}`,
    "http://localhost:3000",
  ]
    .filter((u): u is string => Boolean(u?.trim()))
    .map(sinBarra);
  return [...new Set(lista)];
}

/**
 * Cuentas de Cadencia. Nada que ver con las redes sociales del usuario: aquí no
 * se guarda ninguna credencial de Instagram, TikTok ni de nada parecido, y no
 * se va a guardar nunca.
 *
 * Los usuarios viven en el mismo Postgres que los negocios — un solo respaldo,
 * una sola transacción. Irse de esta librería sería cambiar de librería, no
 * rescatar identidades de casa ajena.
 *
 * Se construye a la primera petición, no al importar el módulo: compilar el
 * proyecto no puede exigir las credenciales de la base.
 */
function crear() {
  return betterAuth({
    database: pool(),
    emailAndPassword: {
      enabled: true,
      minPasswordLength: 10,
      // Una hora. Suficiente para leer el correo, corto para que un enlace
      // olvidado en una bandeja no siga abriendo la cuenta.
      resetPasswordTokenExpiresIn: 3600,
      sendResetPassword: async ({ user, url }) => {
        await enviar({
          para: user.email,
          asunto: "Cambiar tu contraseña de Cadencia",
          texto: [
            "Pediste cambiar tu contraseña de Cadencia.",
            "",
            "Abre este enlace y elige una nueva:",
            url,
            "",
            "El enlace vale una hora y solo sirve una vez.",
            "Si no fuiste tú, ignora este mensaje: tu contraseña no cambia.",
          ].join("\n"),
        });
      },
    },
    /**
     * De dónde se aceptan peticiones.
     *
     * Better Auth rechaza cualquier origen que no esté aquí, y eso es lo que
     * impide que una página de otro dominio use la sesión del dueño desde el
     * navegador. Sale de `BETTER_AUTH_URL` para que el repositorio no lleve
     * escrito a fuego dónde está desplegado: cambiar de dominio es cambiar la
     * variable, no el código.
     *
     * La barra final se quita a propósito. Un origen es esquema + host +
     * puerto, sin ruta, y `https://x.vercel.app/` con barra no casa nunca con
     * el `https://x.vercel.app` que manda el navegador. Es el fallo más tonto
     * de los que dejan toda la autenticación sin funcionar en producción.
     */
    trustedOrigins: origenes(),
    session: {
      // Vuelven cada varias semanas a ver qué cambió. Que no tengan que entrar
      // otra vez en cada visita.
      expiresIn: 60 * 60 * 24 * 60,
      updateAge: 60 * 60 * 24,
    },
  });
}

let instancia: ReturnType<typeof crear> | undefined;

export function auth(): ReturnType<typeof crear> {
  instancia ??= crear();
  return instancia;
}
