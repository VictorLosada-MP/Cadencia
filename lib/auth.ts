import { betterAuth } from "better-auth";
import { enviar } from "@/lib/correo";
import { consultar, pool } from "@/lib/db";

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
        // De paso, fuera los tokens vencidos.
        //
        // `verification` no puede tener clave foránea a `user` —un token
        // existe antes de saber de quién es, y tiene que morir solo al
        // caducar— así que nada los limpiaba y se quedaban para siempre. Aquí
        // y no en una tarea aparte porque es el único momento en que la tabla
        // se toca, y porque una tarea programada es una pieza más que
        // mantener para borrar unos bytes.
        //
        // Antes de mandar el correo y sin `await` que lo retrase: si la
        // limpieza falla, el dueño tiene que recibir su enlace igual.
        void consultar(`delete from verification where "expiresAt" < now()`).catch(
          (e) => console.error("limpiar verification:", e instanceof Error ? e.message : e),
        );

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
    /**
     * Cuántos intentos se aceptan, y en cuánto tiempo.
     *
     * Se declara aquí y no se deja el de la librería por dos razones. La
     * primera es que el suyo solo se enciende en producción, así que esto no
     * se podía probar antes de desplegarlo. La segunda es que era demasiado
     * corto para una persona: tres contraseñas mal escritas —que es lo normal
     * cuando no te acuerdas de cuál era— y la puerta se cerraba con un
     * «Too many requests» en inglés, sin decir cuánto había que esperar.
     *
     * Los números: entrar admite diez intentos por minuto, que es más de lo
     * que teclea una persona y mucho menos de lo que prueba un programa. Crear
     * cuenta y pedir contraseña nueva van por hora, porque ahí lo que se
     * frena no es adivinar una clave: es dar de alta cuentas en cadena y
     * mandarle correos a direcciones ajenas.
     */
    rateLimit: {
      enabled: true,
      window: 60,
      max: 100,
      customRules: {
        "/sign-in/email": { window: 60, max: 10 },
        "/sign-up/email": { window: 3600, max: 5 },
        "/request-password-reset": { window: 3600, max: 5 },
        "/reset-password": { window: 3600, max: 10 },
      },
    },
  });
}

let instancia: ReturnType<typeof crear> | undefined;

export function auth(): ReturnType<typeof crear> {
  instancia ??= crear();
  return instancia;
}
