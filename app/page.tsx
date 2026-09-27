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
    n: "01",
    nombre: "Diagnóstico",
    resumen: "Qué le está costando conversaciones tu perfil",
    texto:
      "Pones tu perfil —o una captura de él— y sale punto por punto, con el texto ya corregido. No es un puntaje: son frases que copias y pegas.",
  },
  {
    n: "02",
    nombre: "La semana",
    resumen: "Cinco piezas de lunes a viernes",
    texto:
      "Cada una le habla a alguien que está en un punto distinto: el que no sabe que tiene el problema y el que ya está decidiendo a quién comprarle no leen lo mismo.",
  },
  {
    n: "03",
    nombre: "La pieza",
    resumen: "El guion o las láminas del día que te toca",
    texto:
      "Eliges el día y decides si va en video o en carrusel. Sale el guion —con lo que dices y lo que haces— o las láminas, escritas con tu forma de hablar.",
  },
  {
    n: "04",
    nombre: "Lista para subir",
    resumen: "El archivo, armado en tu navegador",
    texto:
      "El carrusel sale en imágenes listas para subir. El editor de video —9:16, cortar silencios, quemar subtítulos— es lo siguiente que entra.",
  },
];

const SI = [
  "Tienes un negocio que ya vende, aunque sea poco.",
  "Publicas a rachas y luego desapareces tres semanas.",
  "No tienes editor, ni agencia, ni ganas de contratar una.",
  "Quieres escribir tú, pero sin empezar de cero cada vez.",
];

const NO = [
  "Lo que buscas es crecer en seguidores.",
  "Vives de marcas que te patrocinan, no de lo que vendes.",
  "Quieres que alguien publique por ti y no volver a mirarlo.",
];

const NO_HACE = [
  {
    titulo: "No te pide la contraseña de ninguna red",
    texto:
      "Ni de Instagram, ni de TikTok, ni de ninguna. No se conecta a tus cuentas: tú escribes o pegas una captura, y lo que se revisa es lo que tú confirmes.",
  },
  {
    titulo: "No publica por ti",
    texto:
      "Te deja el texto y el archivo. Subirlo lo haces tú, desde tu teléfono, cuando quieras.",
  },
  {
    titulo: "No inventa datos tuyos",
    texto:
      "Si no le diste un número, un testimonio o un caso, no aparece ninguno. Cuando le falta algo para afinar, te lo pregunta en vez de rellenarlo.",
  },
  {
    titulo: "No te ata a nadie",
    texto:
      "Lo que sale es texto y son imágenes. Te los llevas a donde quieras, también el día que dejes de usar esto.",
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

  const irA = dentro ? "/diagnostico" : "/entrar";

  return (
    <>
      {/* ───────────────────────── Barra ───────────────────────── */}
      <header className="sticky top-0 z-50 border-b border-neutral-200/70 bg-[var(--background)]/85 backdrop-blur-md dark:border-neutral-800/70">
        <div className="mx-auto flex max-w-[1400px] items-center justify-between px-6 py-4 lg:px-12">
          <Link href="/" className="group flex items-center gap-2.5">
            <span className="late block h-2 w-2 rounded-full bg-teal-600 dark:bg-teal-400" />
            <span className="font-mono text-[12px] font-semibold uppercase tracking-[0.22em]">
              Cadencia
            </span>
          </Link>
          <nav className="flex items-center gap-6">
            <a
              href="#funciones"
              className="hidden font-mono text-[11px] uppercase tracking-wider text-neutral-500 transition-colors hover:text-teal-700 sm:block dark:hover:text-teal-400"
            >
              cómo funciona
            </a>
            <a
              href="#planes"
              className="hidden font-mono text-[11px] uppercase tracking-wider text-neutral-500 transition-colors hover:text-teal-700 sm:block dark:hover:text-teal-400"
            >
              planes
            </a>
            <Link
              href={irA}
              className="empuja rounded-full bg-neutral-900 px-4 py-1.5 font-mono text-[11px] uppercase tracking-wider text-white dark:bg-neutral-100 dark:text-neutral-900"
            >
              {dentro ? "mi cuenta" : "entrar"}
            </Link>
          </nav>
        </div>
      </header>

      {/* ───────────────────────── Héroe ───────────────────────── */}
      <section className="relative flex min-h-[calc(100svh-61px)] items-center overflow-hidden">
        {/* Las manchas de color y la retícula. aria-hidden porque no dicen
            nada: quien navega con lector de pantalla no se pierde un fondo. */}
        <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
          <div className="deriva absolute -left-[25%] top-[-25%] h-[95vw] w-[95vw] rounded-full bg-teal-400/20 blur-[90px] lg:h-[55vw] lg:w-[55vw] lg:blur-[100px] dark:bg-teal-500/12" />
          <div
            className="deriva absolute -right-[20%] bottom-[-30%] h-[85vw] w-[85vw] rounded-full bg-amber-300/20 blur-[100px] lg:h-[48vw] lg:w-[48vw] lg:blur-[110px] dark:bg-amber-500/10"
            style={{ ["--tarda" as string]: "-8s" }}
          />
          <div className="absolute inset-0 bg-[linear-gradient(to_right,rgb(0_0_0/0.045)_1px,transparent_1px),linear-gradient(to_bottom,rgb(0_0_0/0.045)_1px,transparent_1px)] bg-[size:72px_72px] [mask-image:radial-gradient(ellipse_at_center,black,transparent_78%)] dark:bg-[linear-gradient(to_right,rgb(255_255_255/0.05)_1px,transparent_1px),linear-gradient(to_bottom,rgb(255_255_255/0.05)_1px,transparent_1px)]" />
        </div>

        <div className="mx-auto w-full max-w-[1400px] px-6 py-20 lg:px-12">
          <div className="grid items-center gap-14 lg:grid-cols-[minmax(0,1fr)_minmax(340px,420px)] lg:gap-20">
            <div>
              <p
                className="entra font-mono text-[11px] uppercase tracking-[0.2em] text-teal-700 dark:text-teal-400"
                style={{ ["--tarda" as string]: "0.05s" }}
              >
                Sistema de contenido para dueños de negocio
              </p>

              <h1 className="mt-6 text-[clamp(2.75rem,7.2vw,6rem)] font-bold leading-[0.95] tracking-tight">
                <span className="entra block" style={{ ["--tarda" as string]: "0.14s" }}>
                  Ya vendes.
                </span>
                <span
                  className="entra mt-1 block text-neutral-400 dark:text-neutral-600"
                  style={{ ["--tarda" as string]: "0.26s" }}
                >
                  Lo que falta
                </span>
                <span className="entra mt-1 block" style={{ ["--tarda" as string]: "0.38s" }}>
                  es qué publicar.
                </span>
              </h1>

              <div
                className="raya mt-8 h-px w-40 bg-neutral-900 dark:bg-neutral-100"
                style={{ animationDelay: "0.5s" }}
              />

              <p
                className="entra mt-8 max-w-[36rem] text-pretty text-lg leading-relaxed text-neutral-600 sm:text-xl dark:text-neutral-400"
                style={{ ["--tarda" as string]: "0.56s" }}
              >
                Cadencia te dice qué le está costando conversaciones a tu perfil
                y te deja escrita la semana. Con tu oferta, tu cliente y tu
                forma de hablar — no con plantillas.
              </p>

              <div
                className="entra mt-10 flex flex-wrap items-center gap-5"
                style={{ ["--tarda" as string]: "0.68s" }}
              >
                <Link
                  href={irA}
                  className="empuja rounded-full bg-teal-700 px-7 py-3.5 font-semibold text-white dark:bg-teal-600"
                >
                  {dentro ? "Seguir donde ibas" : "Diagnosticar mi perfil gratis"}
                </Link>
                <a
                  href="#funciones"
                  className="group font-mono text-[11px] uppercase tracking-wider text-neutral-500 transition-colors hover:text-teal-700 dark:hover:text-teal-400"
                >
                  ver cómo funciona{" "}
                  <span className="inline-block transition-transform group-hover:translate-x-1">
                    →
                  </span>
                </a>
              </div>

              <p
                className="entra mt-7 font-mono text-[11px] uppercase tracking-wider text-neutral-400"
                style={{ ["--tarda" as string]: "0.8s" }}
              >
                Sin tarjeta · Sin contraseñas de tus redes · Un minuto
              </p>
            </div>

            {/* La cadena, a la derecha. Es lo que compra: cuatro estaciones en
                orden, no un menú de herramientas. */}
            <div
              className="entra-caja hidden rounded-2xl border border-neutral-200/80 bg-[var(--background)]/70 p-8 shadow-[0_30px_70px_-50px_rgb(0_0_0/0.45)] backdrop-blur-sm lg:block dark:border-neutral-800/80"
              style={{ ["--tarda" as string]: "0.55s" }}
            >
              <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-neutral-400">
                La cadena, de principio a fin
              </p>
              <ol className="mt-6 space-y-1">
                {PASOS.map((p, i) => (
                  <li
                    key={p.n}
                    className="entra-lado group flex items-baseline gap-5 rounded-lg border-l-2 border-neutral-200 py-3.5 pl-5 transition-colors hover:border-teal-600 hover:bg-teal-50/50 dark:border-neutral-800 dark:hover:border-teal-400 dark:hover:bg-teal-950/20"
                    style={{ ["--tarda" as string]: `${0.68 + i * 0.1}s` }}
                  >
                    <span className="font-mono text-xs tabular-nums text-neutral-400 transition-colors group-hover:text-teal-700 dark:group-hover:text-teal-400">
                      {p.n}
                    </span>
                    <div>
                      <p className="font-semibold tracking-tight">{p.nombre}</p>
                      <p className="mt-0.5 text-sm leading-snug text-neutral-500">{p.resumen}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </div>
      </section>

      {/* ───────────────────── Para quién es ───────────────────── */}
      <section className="border-y border-neutral-200 bg-[var(--papel)] dark:border-neutral-800">
        <div className="mx-auto max-w-[1400px] px-6 py-24 lg:px-12 lg:py-32">
          <h2 className="revela font-mono text-[11px] uppercase tracking-[0.2em] text-neutral-500">
            Para quién es
          </h2>
          <div className="mt-10 grid gap-px overflow-hidden rounded-lg border border-neutral-200 bg-neutral-200 md:grid-cols-2 dark:border-neutral-800 dark:bg-neutral-800">
            <div
              className="revela bg-[var(--background)] p-8 lg:p-12"
              style={{ ["--tarda" as string]: "0.06s" }}
            >
              <p className="text-2xl font-bold tracking-tight">Es para ti si…</p>
              <ul className="mt-6 space-y-4">
                {SI.map((t, i) => (
                  <li
                    key={t}
                    className="revela flex gap-3 text-[15px] leading-relaxed text-neutral-700 dark:text-neutral-300"
                    style={{ ["--tarda" as string]: `${0.12 + i * 0.07}s` }}
                  >
                    <span className="mt-2 block h-1.5 w-1.5 shrink-0 rounded-full bg-teal-600 dark:bg-teal-400" />
                    {t}
                  </li>
                ))}
              </ul>
            </div>
            <div
              className="revela bg-[var(--background)] p-8 lg:p-12"
              style={{ ["--tarda" as string]: "0.14s" }}
            >
              <p className="text-2xl font-bold tracking-tight text-neutral-400 dark:text-neutral-500">
                No es para ti si…
              </p>
              <ul className="mt-6 space-y-4">
                {NO.map((t, i) => (
                  <li
                    key={t}
                    className="revela flex gap-3 text-[15px] leading-relaxed text-neutral-500"
                    style={{ ["--tarda" as string]: `${0.2 + i * 0.07}s` }}
                  >
                    <span className="mt-2.5 block h-px w-3 shrink-0 bg-neutral-400" />
                    {t}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ─────────────────── Las cuatro funciones ─────────────────── */}
      <section id="funciones" className="scroll-mt-16">
        <div className="mx-auto max-w-[1400px] px-6 py-24 lg:px-12 lg:py-32">
          <div className="max-w-2xl">
            <h2 className="revela font-mono text-[11px] uppercase tracking-[0.2em] text-neutral-500">
              Las cuatro funciones
            </h2>
            <p
              className="revela mt-4 text-3xl font-bold leading-tight tracking-tight sm:text-4xl"
              style={{ ["--tarda" as string]: "0.06s" }}
            >
              Van en orden. Cada una usa lo que dejó la anterior.
            </p>
          </div>

          <ol className="mt-14 grid gap-px overflow-hidden rounded-lg border border-neutral-200 bg-neutral-200 sm:grid-cols-2 dark:border-neutral-800 dark:bg-neutral-800">
            {PASOS.map((p, i) => (
              <li
                key={p.n}
                className="revela tarjeta group bg-[var(--background)] p-8 lg:p-10"
                style={{ ["--tarda" as string]: `${i * 0.09}s` }}
              >
                <span className="cuenta block font-mono text-5xl font-bold tabular-nums leading-none text-neutral-200 group-hover:text-teal-600 dark:text-neutral-800 dark:group-hover:text-teal-400">
                  {p.n}
                </span>
                <p className="mt-6 text-2xl font-bold tracking-tight">{p.nombre}</p>
                <p className="mt-3 text-[15px] leading-relaxed text-neutral-600 dark:text-neutral-400">
                  {p.texto}
                </p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ───────────────────── Lo que no hace ───────────────────── */}
      <section className="border-y border-neutral-200 bg-[var(--papel)] dark:border-neutral-800">
        <div className="mx-auto max-w-[1400px] px-6 py-24 lg:px-12 lg:py-32">
          <div className="grid gap-12 lg:grid-cols-[1fr_1.5fr]">
            <div>
              <h2 className="revela font-mono text-[11px] uppercase tracking-[0.2em] text-neutral-500">
                Lo que no hace
              </h2>
              <p
                className="revela mt-4 text-3xl font-bold leading-tight tracking-tight sm:text-4xl"
                style={{ ["--tarda" as string]: "0.06s" }}
              >
                Va aquí arriba y no en la letra pequeña.
              </p>
              <p
                className="revela mt-4 text-[15px] leading-relaxed text-neutral-500"
                style={{ ["--tarda" as string]: "0.12s" }}
              >
                Porque es lo que decide si esto te sirve.
              </p>
            </div>
            <ul className="space-y-8">
              {NO_HACE.map((n, i) => (
                <li
                  key={n.titulo}
                  className="revela border-l-2 border-neutral-300 pl-6 transition-colors hover:border-teal-600 dark:border-neutral-700 dark:hover:border-teal-400"
                  style={{ ["--tarda" as string]: `${i * 0.08}s` }}
                >
                  <p className="text-lg font-semibold tracking-tight">{n.titulo}</p>
                  <p className="mt-1.5 text-[15px] leading-relaxed text-neutral-600 dark:text-neutral-400">
                    {n.texto}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* ───────────────────────── Planes ───────────────────────── */}
      <section id="planes" className="scroll-mt-16">
        <div className="mx-auto max-w-[1400px] px-6 py-24 lg:px-12 lg:py-32">
          <div className="max-w-2xl">
            <h2 className="revela font-mono text-[11px] uppercase tracking-[0.2em] text-neutral-500">
              Planes
            </h2>
            <p
              className="revela mt-4 text-3xl font-bold leading-tight tracking-tight sm:text-4xl"
              style={{ ["--tarda" as string]: "0.06s" }}
            >
              Se cobra por corridas, no por funciones.
            </p>
            <p
              className="revela mt-4 text-[15px] leading-relaxed text-neutral-500"
              style={{ ["--tarda" as string]: "0.12s" }}
            >
              Todos los planes traen las cuatro completas. Nada se recorta para
              venderte el arreglo.
            </p>
          </div>
          <div className="mt-14">
            <Planes planes={planes} />
          </div>
        </div>
      </section>

      {/* ───────────────────────── Cierre ───────────────────────── */}
      <section className="relative overflow-hidden border-t border-neutral-200 bg-neutral-900 text-neutral-100 dark:border-neutral-800 dark:bg-[var(--papel)]">
        <div aria-hidden className="pointer-events-none absolute inset-0 -z-0">
          <div className="deriva absolute left-1/2 top-1/2 h-[70vw] w-[70vw] -translate-x-1/2 -translate-y-1/2 rounded-full bg-teal-500/20 blur-[120px]" />
        </div>
        <div className="relative mx-auto max-w-[1400px] px-6 py-28 text-center lg:px-12 lg:py-36">
          <h2 className="revela mx-auto max-w-3xl text-[clamp(2rem,4.5vw,3.5rem)] font-bold leading-[1.05] tracking-tight">
            Empieza por el diagnóstico. Es gratis y tarda un minuto.
          </h2>
          <p
            className="revela mx-auto mt-6 max-w-xl text-lg text-neutral-400"
            style={{ ["--tarda" as string]: "0.08s" }}
          >
            Sale con el texto corregido, listo para copiar. Si no te sirve, no
            seguiste.
          </p>
          <div className="revela mt-10" style={{ ["--tarda" as string]: "0.16s" }}>
            <Link
              href={irA}
              className="empuja inline-block rounded-full bg-teal-600 px-8 py-4 text-lg font-semibold text-white"
            >
              {dentro ? "Seguir donde ibas" : "Crear mi cuenta"}
            </Link>
          </div>
        </div>
      </section>

      <footer className="border-t border-neutral-200 dark:border-neutral-800">
        <div className="mx-auto flex max-w-[1400px] flex-wrap items-center justify-between gap-4 px-6 py-8 lg:px-12">
          <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-neutral-400">
            Cadencia
          </span>
          <nav className="flex gap-6">
            <Link
              href="/planes"
              className="font-mono text-[11px] uppercase tracking-wider text-neutral-500 transition-colors hover:text-teal-700 dark:hover:text-teal-400"
            >
              planes
            </Link>
            <Link
              href="/entrar"
              className="font-mono text-[11px] uppercase tracking-wider text-neutral-500 transition-colors hover:text-teal-700 dark:hover:text-teal-400"
            >
              entrar
            </Link>
          </nav>
        </div>
      </footer>
    </>
  );
}
