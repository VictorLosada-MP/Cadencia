import { betterAuth } from "better-auth";
import { admin } from "better-auth/plugins";
import { enviar } from "@/lib/correo";
import { pool } from "@/lib/db";

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
    session: {
      // Vuelven cada varias semanas a ver qué cambió. Que no tengan que entrar
      // otra vez en cada visita.
      expiresIn: 60 * 60 * 24 * 60,
      updateAge: 60 * 60 * 24,
    },
    plugins: [
      // Es lo que deja dar de alta a un cliente de la marca y regalarle la
      // cuenta, sin tocar la base a mano.
      admin(),
    ],
  });
}

let instancia: ReturnType<typeof crear> | undefined;

export function auth(): ReturnType<typeof crear> {
  instancia ??= crear();
  return instancia;
}
