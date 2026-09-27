import Link from "next/link";
import type { Plan } from "@/lib/cuota";

/**
 * Lo que se anuncia es SOLO lo que el código cobra: las corridas. `negocios` e
 * `historial_meses` existen como columnas del plan pero todavía no los hace
 * cumplir nadie, y poner en una página de precios un límite que no se aplica
 * es prometer lo que no se entrega.
 */
function limite(p: Plan): string {
  if (p.corridas_total !== null) {
    return p.corridas_total === 1
      ? "1 corrida, una sola vez"
      : `${p.corridas_total} corridas, una sola vez`;
  }
  if (p.corridas_mes !== null) return `${p.corridas_mes} corridas al mes`;
  return "Corridas sin límite";
}

function precio(p: Plan): string {
  const n = Number(p.precio_mes);
  return Number.isFinite(n) && n > 0 ? `US$${n % 1 === 0 ? n : n.toFixed(2)}` : "Gratis";
}

const NOTAS = [
  {
    titulo: "Una corrida",
    texto:
      "es cada vez que el sistema escribe algo: un diagnóstico, una semana, una pieza. Afinar un diagnóstico con tus respuestas cuenta como otra, porque cuesta lo mismo que la primera.",
  },
  {
    titulo: "Si una corrida falla, no se te cuenta.",
    texto: "El contador solo suma lo que terminó bien.",
  },
  {
    titulo: "Lo ya entregado se lee siempre,",
    texto:
      "con plan o sin él. Tus correcciones y tus piezas no se quedan encerradas cuando se acaba el mes.",
  },
];

export function Planes({
  planes,
  actual,
}: {
  planes: Plan[];
  /** El plan en vigor de quien mira, si entró a su cuenta. */
  actual?: string;
}) {
  if (planes.length === 0) {
    return (
      <p className="rounded-lg border-l-[3px] border-amber-600 bg-amber-50 p-4 text-sm dark:bg-amber-950/30">
        Los planes no cargaron. Recarga la página en un momento — lo demás de
        esta página sigue siendo cierto.
      </p>
    );
  }

  // El del medio se destaca cuando no hay uno propio que destacar. Es una
  // señal de por dónde empezar, no un truco: tiene el mismo producto dentro.
  const sugerido = actual ? null : planes[Math.floor(planes.length / 2)]?.id;

  return (
    <>
      <div className="grid gap-5 lg:grid-cols-3">
        {planes.map((p, i) => {
          const gratis = Number(p.precio_mes) === 0;
          const esteEs = actual === p.id;
          const destaca = esteEs || sugerido === p.id;

          return (
            <div
              key={p.id}
              className={`revela tarjeta relative flex flex-col rounded-xl border p-8 ${
                destaca
                  ? "border-teal-600 bg-[var(--background)] shadow-[0_18px_50px_-30px_rgb(15_118_110/0.55)] lg:-my-3 lg:py-11 dark:border-teal-400"
                  : "border-neutral-200 bg-[var(--background)] dark:border-neutral-800"
              }`}
              style={{ ["--tarda" as string]: `${i * 0.1}s` }}
            >
              {destaca && (
                <span className="absolute -top-3 left-8 rounded-full bg-teal-700 px-3 py-1 font-mono text-[10px] uppercase tracking-wider text-white dark:bg-teal-500 dark:text-neutral-900">
                  {esteEs ? "tu plan de hoy" : "por aquí se empieza"}
                </span>
              )}

              <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-neutral-500">
                {p.nombre}
              </p>

              <p className="mt-4 flex items-baseline gap-1.5">
                <span className="text-5xl font-bold tracking-tight">{precio(p)}</span>
                {!gratis && (
                  <span className="text-sm text-neutral-500">/ mes</span>
                )}
              </p>

              <div className="my-7 h-px bg-neutral-200 dark:bg-neutral-800" />

              <ul className="space-y-3 text-[15px] leading-relaxed">
                <li className="flex gap-3">
                  <span className="mt-2 block h-1.5 w-1.5 shrink-0 rounded-full bg-teal-600 dark:bg-teal-400" />
                  <span className="font-semibold">{limite(p)}</span>
                </li>
                <li className="flex gap-3 text-neutral-600 dark:text-neutral-400">
                  <span className="mt-2 block h-1.5 w-1.5 shrink-0 rounded-full bg-teal-600 dark:bg-teal-400" />
                  Las cuatro funciones, completas
                </li>
                <li className="flex gap-3 text-neutral-600 dark:text-neutral-400">
                  <span className="mt-2 block h-1.5 w-1.5 shrink-0 rounded-full bg-teal-600 dark:bg-teal-400" />
                  Lo ya entregado se lee siempre
                </li>
                <li className="flex gap-3 text-neutral-600 dark:text-neutral-400">
                  <span className="mt-2 block h-1.5 w-1.5 shrink-0 rounded-full bg-teal-600 dark:bg-teal-400" />
                  Sin contraseñas de tus redes
                </li>
              </ul>

              <div className="mt-8 pt-1">
                {esteEs ? (
                  <span className="block rounded-full border border-neutral-300 px-5 py-3 text-center font-mono text-[11px] uppercase tracking-wider text-neutral-500 dark:border-neutral-700">
                    en vigor
                  </span>
                ) : (
                  <Link
                    href="/entrar"
                    className={`empuja block rounded-full px-5 py-3 text-center font-semibold ${
                      destaca || gratis
                        ? "bg-teal-700 text-white dark:bg-teal-600"
                        : "border border-neutral-300 hover:border-teal-700 dark:border-neutral-700 dark:hover:border-teal-400"
                    }`}
                  >
                    {gratis ? "Empezar gratis" : "Quiero este plan"}
                  </Link>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="revela mt-14 grid gap-6 border-t border-neutral-200 pt-10 sm:grid-cols-3 dark:border-neutral-800">
        {NOTAS.map((n) => (
          <p
            key={n.titulo}
            className="text-sm leading-relaxed text-neutral-600 dark:text-neutral-400"
          >
            <strong className="text-neutral-900 dark:text-neutral-100">{n.titulo}</strong>{" "}
            {n.texto}
          </p>
        ))}
      </div>

      <p className="revela mt-8 border-l-[3px] border-amber-600 pl-4 text-sm leading-relaxed text-neutral-600 dark:text-neutral-400">
        El cobro automático todavía no está conectado. Crea tu cuenta, empieza
        por la prueba, y si quieres un plan de pago escríbeme y te lo activo a
        mano.
      </p>
    </>
  );
}
