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
      <p className="rounded border-l-[3px] border-amber-600 bg-amber-50 p-3 text-sm dark:bg-amber-950/30">
        Los planes no cargaron. Recarga la página en un momento — lo demás de
        esta página sigue siendo cierto.
      </p>
    );
  }

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-3">
        {planes.map((p) => {
          const gratis = Number(p.precio_mes) === 0;
          const esteEs = actual === p.id;
          return (
            <div
              key={p.id}
              className={`flex flex-col rounded border p-5 ${
                esteEs
                  ? "border-teal-700 bg-teal-50 dark:border-teal-400 dark:bg-teal-950/30"
                  : "border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900"
              }`}
            >
              <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-neutral-500">
                {p.nombre}
              </p>
              <p className="mt-2 text-3xl font-bold tracking-tight">
                {precio(p)}
                {!gratis && (
                  <span className="text-sm font-normal text-neutral-500"> / mes</span>
                )}
              </p>
              <p className="mt-3 text-sm text-neutral-700 dark:text-neutral-300">{limite(p)}</p>
              <p className="mt-1.5 text-sm text-neutral-600 dark:text-neutral-400">
                Las cuatro funciones, completas. Nada se recorta por plan.
              </p>

              <div className="mt-5 pt-1">
                {esteEs ? (
                  <span className="font-mono text-[11px] uppercase tracking-wider text-teal-700 dark:text-teal-400">
                    tu plan de hoy
                  </span>
                ) : (
                  <Link
                    href="/entrar"
                    className={`inline-block rounded px-4 py-2 text-sm font-semibold transition ${
                      gratis
                        ? "bg-teal-700 text-white hover:bg-teal-800 dark:bg-teal-600 dark:hover:bg-teal-500"
                        : "border border-teal-700 text-teal-700 hover:bg-teal-50 dark:border-teal-400 dark:text-teal-400 dark:hover:bg-teal-950/40"
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

      <div className="mt-5 space-y-2 text-sm text-neutral-600 dark:text-neutral-400">
        <p>
          <strong>Una corrida</strong> es cada vez que el sistema escribe algo:
          un diagnóstico, una semana, una pieza. Afinar un diagnóstico con tus
          respuestas cuenta como otra, porque cuesta lo mismo que la primera.
        </p>
        <p>
          Si una corrida falla, no se te cuenta. El contador solo suma lo que
          terminó bien.
        </p>
        <p>
          <strong>Lo ya entregado se lee siempre</strong>, con plan o sin él.
          Tus correcciones y tus piezas no se quedan encerradas cuando se acaba
          el mes.
        </p>
        <p className="border-l-[3px] border-amber-600 pl-3">
          El cobro automático todavía no está conectado. Crea tu cuenta, empieza
          por la prueba, y si quieres un plan de pago escríbeme y te lo activo a
          mano.
        </p>
      </div>
    </>
  );
}
