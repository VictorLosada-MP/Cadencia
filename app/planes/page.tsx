import Link from "next/link";
import { cuotaDe, planesDisponibles, type Plan } from "@/lib/cuota";
import { negocioDe, usuarioActual } from "@/lib/negocio";
import { Barra } from "../barra";
import { Planes } from "../planes";
import { Renovacion } from "../pago/renovacion";
import { suscripcionDe } from "@/lib/pagos";

/** Lee la sesión y la base: nunca es la misma página para dos personas. */
export const dynamic = "force-dynamic";

export default async function PaginaPlanes() {
  const usuario = await usuarioActual().catch(() => null);

  const planes = await planesDisponibles().catch((e): Plan[] => {
    console.error("planes:", e instanceof Error ? e.message : e);
    return [];
  });

  if (!usuario) {
    return (
      <main className="mx-auto max-w-5xl px-6 py-14">
        <h1 className="text-4xl font-bold tracking-tight">Planes</h1>
        <div className="mt-8">
          <Planes planes={planes} />
        </div>
        <Link
          href="/"
          className="mt-8 inline-block font-mono text-[11px] uppercase tracking-wider underline underline-offset-4 hover:no-underline"
        >
          ← volver a la portada
        </Link>
      </main>
    );
  }

  const negocio = await negocioDe(usuario.id).catch(() => null);
  const cuota = await cuotaDe(usuario.id, negocio?.id ?? null).catch(() => null);
  const sus = await suscripcionDe(usuario.id).catch(() => null);

  return (
    <main className="mx-auto max-w-5xl px-6 py-14">
      <Barra />

      <header className="entra border-b-2 border-neutral-900 pb-7 dark:border-neutral-100">
        <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-teal-700 dark:text-teal-400">
          Tu plan
        </p>
        <h1 className="mt-4 text-4xl font-bold leading-none tracking-tight">
          {cuota ? cuota.plan.nombre : "Planes"}
        </h1>
        {cuota && (
          <p className="mt-4 text-neutral-600 dark:text-neutral-400">
            {cuota.limite === null
              ? "Sin límite de corridas."
              : `Llevas ${cuota.usadas} de ${cuota.limite} corridas${
                  cuota.plan.corridas_total !== null ? "" : " este mes"
                }.`}
            {cuota.cortesia && " Es un plan de cortesía, no una compra."}
            {cuota.reinicia &&
              ` Se reinician el ${new Date(cuota.reinicia).toLocaleDateString("es", {
                day: "numeric",
                month: "long",
              })}.`}
          </p>
        )}
      </header>

      <section className="revela mt-9" style={{ ["--tarda" as string]: "0.04s" }}>
        {sus?.fuente_pago_id && !cuota?.cortesia && (
          <Renovacion
            renovar={sus.renovar}
            hasta={sus.plan_hasta}
            tarjeta={
              sus.fuente_marca || sus.fuente_ultimos4
                ? `${sus.fuente_marca ?? "tarjeta"} ·· ${sus.fuente_ultimos4 ?? ""}`.trim()
                : "tarjeta guardada"
            }
          />
        )}

        <Planes planes={planes} actual={cuota?.plan.id} dentro />
      </section>
    </main>
  );
}
