import Link from "next/link";
import { planesDisponibles, type Plan } from "@/lib/cuota";
import { usuarioActual } from "@/lib/negocio";
import { Planes } from "./planes";

/**
 * La portada lee los planes de la base, que es donde están de verdad: si el
 * precio se cambia por SQL y aquí hay una copia escrita a mano, la página de
 * precios empieza a mentir el mismo día. Por eso se sirve por petición y no se
 * prerenderiza — así `next build` tampoco necesita credenciales de la base.
 */
export const dynamic = "force-dynamic";

const PASOS = [
  {
    n: "1",
    nombre: "Diagnóstico",
    texto:
      "Pones tu perfil —o una captura de él— y sale qué le está costando conversaciones, punto por punto, con el texto ya corregido. No es un puntaje: son frases que puedes copiar y pegar.",
  },
  {
    n: "2",
    nombre: "La semana",
    texto:
      "Cinco piezas de lunes a viernes, cada una hablándole a alguien que está en un punto distinto: el que no sabe que tiene el problema y el que ya está decidiendo a quién comprarle no leen lo mismo.",
  },
  {
    n: "3",
    nombre: "La pieza",
    texto:
      "Eliges el día y decides si va en video o en carrusel. Sale el guion —con lo que dices y lo que haces— o las láminas, escritas con tu forma de hablar, no con la de cualquiera.",
  },
  {
    n: "4",
    nombre: "Lista para subir",
    texto:
      "El carrusel sale armado en imágenes listas para subir, montadas en tu navegador. El editor de video es lo siguiente que entra.",
  },
];

export default async function Portada() {
  // Ni la base caída ni una sesión ilegible pueden tumbar la portada: es lo
  // único que ve alguien que todavía no es cliente.
  const [planes, dentro] = await Promise.all([
    planesDisponibles().catch((e): Plan[] => {
      console.error("portada/planes:", e instanceof Error ? e.message : e);
      return [];
    }),
    usuarioActual().catch(() => null),
  ]);

  return (
    <main className="mx-auto max-w-3xl px-6 py-14">
      <div className="flex items-center justify-between">
        <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-teal-700 dark:text-teal-400">
          Cadencia
        </span>
        <Link
          href={dentro ? "/diagnostico" : "/entrar"}
          className="font-mono text-[11px] uppercase tracking-wider underline underline-offset-4 hover:no-underline"
        >
          {dentro ? "ir a mi cuenta →" : "entrar"}
        </Link>
      </div>

      <header className="mt-12 border-b-2 border-neutral-900 pb-10 dark:border-neutral-100">
        <h1 className="text-5xl font-bold leading-[1.05] tracking-tight sm:text-6xl">
          Ya vendes.
          <br />
          Lo que falta es qué publicar.
        </h1>
        <p className="mt-6 max-w-xl text-lg leading-relaxed text-neutral-700 dark:text-neutral-300">
          Cadencia te dice qué le está costando conversaciones a tu perfil y te
          deja escrita la semana. Con tu oferta, tu cliente y tu forma de
          hablar — no con plantillas.
        </p>
        <div className="mt-8 flex flex-wrap items-center gap-4">
          <Link
            href={dentro ? "/diagnostico" : "/entrar"}
            className="rounded bg-teal-700 px-6 py-3 font-semibold text-white transition hover:bg-teal-800 dark:bg-teal-600 dark:hover:bg-teal-500"
          >
            {dentro ? "Seguir donde ibas" : "Diagnosticar mi perfil gratis"}
          </Link>
          <a
            href="#planes"
            className="font-mono text-[11px] uppercase tracking-wider underline underline-offset-4 hover:no-underline"
          >
            ver los planes
          </a>
        </div>
      </header>

      <section className="mt-14">
        <h2 className="font-mono text-[11px] uppercase tracking-[0.12em] text-neutral-500">
          Para quién es
        </h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div className="rounded border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900">
            <p className="font-semibold">Es para ti si…</p>
            <ul className="mt-3 space-y-2 text-sm leading-relaxed text-neutral-700 dark:text-neutral-300">
              <li>· Tienes un negocio que ya vende, aunque sea poco.</li>
              <li>· Publicas a rachas y luego desapareces tres semanas.</li>
              <li>· No tienes editor, ni agencia, ni ganas de contratar una.</li>
              <li>· Quieres escribir tú, pero sin empezar de cero cada vez.</li>
            </ul>
          </div>
          <div className="rounded border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900">
            <p className="font-semibold">No es para ti si…</p>
            <ul className="mt-3 space-y-2 text-sm leading-relaxed text-neutral-700 dark:text-neutral-300">
              <li>· Lo que buscas es crecer en seguidores.</li>
              <li>· Vives de marcas que te patrocinan, no de lo que vendes.</li>
              <li>· Quieres que alguien publique por ti y no volver a mirarlo.</li>
            </ul>
          </div>
        </div>
      </section>

      <section className="mt-14">
        <h2 className="font-mono text-[11px] uppercase tracking-[0.12em] text-neutral-500">
          Las cuatro funciones
        </h2>
        <p className="mb-5 mt-0.5 text-sm text-neutral-500">
          Van en orden. Cada una usa lo que dejó la anterior.
        </p>
        <ol className="space-y-5">
          {PASOS.map((p) => (
            <li key={p.n} className="flex gap-4">
              <span className="mt-0.5 font-mono text-2xl font-bold leading-none text-teal-700 dark:text-teal-400">
                {p.n}
              </span>
              <div>
                <p className="font-semibold">{p.nombre}</p>
                <p className="mt-1 text-sm leading-relaxed text-neutral-700 dark:text-neutral-300">
                  {p.texto}
                </p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section className="mt-14">
        <h2 className="font-mono text-[11px] uppercase tracking-[0.12em] text-neutral-500">
          Lo que no hace
        </h2>
        <p className="mb-4 mt-0.5 text-sm text-neutral-500">
          Va aquí arriba y no en la letra pequeña, porque es lo que decide si
          esto te sirve.
        </p>
        <ul className="space-y-2.5 text-sm leading-relaxed text-neutral-700 dark:text-neutral-300">
          <li>
            <strong>No te pide la contraseña de ninguna red.</strong> Ni de
            Instagram, ni de TikTok, ni de ninguna. No se conecta a tus cuentas:
            tú escribes o pegas una captura, y lo que se revisa es lo que tú
            confirmes.
          </li>
          <li>
            <strong>No publica por ti.</strong> Te deja el texto y el archivo;
            subirlo lo haces tú, desde tu teléfono, cuando quieras.
          </li>
          <li>
            <strong>No inventa datos tuyos.</strong> Si no le diste un número,
            un testimonio o un caso, no aparece ninguno. Cuando le falta algo
            para afinar, te lo pregunta en vez de rellenarlo.
          </li>
          <li>
            <strong>No te ata a nadie.</strong> Lo que sale es texto y son
            imágenes. Te los llevas a donde quieras, también el día que dejes de
            usar esto.
          </li>
        </ul>
      </section>

      <section id="planes" className="mt-14 scroll-mt-6">
        <h2 className="font-mono text-[11px] uppercase tracking-[0.12em] text-neutral-500">
          Planes
        </h2>
        <p className="mb-5 mt-0.5 text-sm text-neutral-500">
          Se cobra por corridas, no por funciones. Todos los planes traen las
          cuatro completas.
        </p>
        <Planes planes={planes} />
      </section>

      <section className="mt-16 border-t-2 border-neutral-900 pt-10 dark:border-neutral-100">
        <h2 className="text-2xl font-bold tracking-tight">
          Empieza por el diagnóstico. Es gratis y tarda un minuto.
        </h2>
        <p className="mt-3 max-w-lg text-neutral-600 dark:text-neutral-400">
          Sale con el texto corregido, listo para copiar. Si no te sirve, no
          seguiste.
        </p>
        <Link
          href={dentro ? "/diagnostico" : "/entrar"}
          className="mt-6 inline-block rounded bg-teal-700 px-6 py-3 font-semibold text-white transition hover:bg-teal-800 dark:bg-teal-600 dark:hover:bg-teal-500"
        >
          {dentro ? "Seguir donde ibas" : "Crear mi cuenta"}
        </Link>
      </section>
    </main>
  );
}
