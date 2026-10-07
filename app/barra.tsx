"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { signOut, useSession } from "@/lib/auth-cliente";
import { olvidarTodo } from "@/lib/guardado";

/**
 * Las cuatro funciones son estaciones de una misma cadena, no un menú de
 * herramientas. La barra lo dice: van numeradas y en orden.
 */
const PASOS = [
  { href: "/diagnostico", n: "01", nombre: "Diagnóstico" },
  { href: "/semana", n: "02", nombre: "La semana" },
  { href: "/pieza", n: "03", nombre: "La pieza" },
  { href: "/publicar", n: "04", nombre: "Lista para subir" },
];

type Cuota = {
  plan: { nombre: string };
  cortesia: boolean;
  usadas: number;
  limite: number | null;
};

const PASTILLA =
  "rounded-full px-3 py-1.5 font-mono text-[11px] uppercase tracking-wider transition-colors";
const ACTIVA = "bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900";
const QUIETA =
  "text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900 dark:hover:bg-neutral-900 dark:hover:text-neutral-100";

export function Barra() {
  const aqui = usePathname();
  const { data: sesion } = useSession();
  const router = useRouter();
  const [cuota, setCuota] = useState<Cuota | null>(null);
  /**
   * La dirección del panel, solo para quien administra.
   *
   * Está aquí porque la pregunta razonable es «entro y no me lleva al panel».
   * Y no lleva: entrar es entrar, igual para todos. Lo que faltaba era que,
   * una vez dentro, quien administra tuviera cómo llegar sin acordarse de una
   * dirección de treinta caracteres. Para los demás llega en null.
   */
  const [panel, setPanel] = useState<string | null>(null);

  useEffect(() => {
    if (!sesion) return;
    let vivo = true;
    fetch("/api/cuota")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!vivo) return;
        if (d?.cuota) setCuota(d.cuota);
        setPanel(d?.panel ?? null);
      })
      .catch(() => {});
    return () => {
      vivo = false;
    };
  }, [sesion, aqui]);

  if (!sesion) return null;

  // Se avisa al 80%, una sola vez y en la página. Nunca un aviso a mitad de una
  // corrida: eso interrumpe el trabajo por el que ya pagó.
  //
  // Hace falta haber gastado algo. Con el plan de prueba, que trae una sola
  // corrida, floor(1 × 0.8) es 0 y el aviso salía encendido en ámbar desde
  // antes de la primera corrida: la cuenta nueva nacía avisando.
  const cerca =
    cuota?.limite != null &&
    cuota.usadas > 0 &&
    cuota.usadas >= Math.ceil(cuota.limite * 0.8);

  // Dos filas a propósito. La marca, las cinco pastillas, el contador, el
  // correo y el botón de salir no caben en una línea, y dejar que el hueco
  // decida dónde partir deja el contador colgando solo en la segunda.
  return (
    <div className="entra -mx-6 mb-10 border-b border-neutral-200 bg-[var(--background)]/85 px-6 pb-3 backdrop-blur-md dark:border-neutral-800">
      <div className="flex items-center justify-between gap-4 border-b border-neutral-100 py-2.5 dark:border-neutral-900">
        <Link href="/" className="flex shrink-0 items-center gap-2">
          <span className="late block h-2 w-2 rounded-full bg-teal-600 dark:bg-teal-400" />
          <span className="font-mono text-[11px] font-semibold uppercase tracking-[0.2em]">
            Cadencia
          </span>
        </Link>

        <div className="flex items-center gap-3 text-xs text-neutral-500">
          {cuota?.limite != null && (
            <Link
              href="/planes"
              title={
                cuota.cortesia
                  ? `Plan ${cuota.plan.nombre}, de cortesía`
                  : `Plan ${cuota.plan.nombre}`
              }
              className={`rounded-full border px-2.5 py-1 font-mono text-[11px] tabular-nums transition-colors ${
                cerca
                  ? "border-amber-500 font-bold text-amber-700 hover:bg-amber-50 dark:text-amber-500 dark:hover:bg-amber-950/30"
                  : "border-neutral-200 hover:border-teal-600 hover:text-teal-700 dark:border-neutral-800 dark:hover:border-teal-400 dark:hover:text-teal-400"
              }`}
            >
              {cuota.usadas}/{cuota.limite}
              {cuota.cortesia && " · cortesía"}
            </Link>
          )}
          {panel && (
            <Link
              href={panel}
              className="rounded-full border border-teal-700 px-2.5 py-1 font-mono text-[11px] uppercase tracking-wider text-teal-700 transition-colors hover:bg-teal-50 dark:border-teal-400 dark:text-teal-400 dark:hover:bg-teal-950/30"
            >
              Panel
            </Link>
          )}
          <span className="hidden font-mono sm:inline">{sesion.user.email}</span>
          <button
            onClick={() =>
              signOut().then(() => {
                // Lo escrito a medias se va con la sesión. En un computador
                // compartido, dejarlo ahí es enseñárselo al siguiente.
                olvidarTodo();
                router.push("/");
                router.refresh();
              })
            }
            className="font-mono text-[11px] uppercase tracking-wider text-neutral-500 underline underline-offset-4 transition-colors hover:text-neutral-900 hover:no-underline dark:hover:text-neutral-100"
          >
            salir
          </button>
        </div>
      </div>

      <nav className="mt-2.5 flex flex-wrap items-center gap-1">
        {PASOS.map((p, i) => {
          const actual = aqui === p.href;
          return (
            <Link
              key={p.href}
              href={p.href}
              aria-current={actual ? "page" : undefined}
              style={{ ["--tarda" as string]: `${0.05 + i * 0.05}s` }}
              className={`entra-lado flex items-baseline gap-1.5 ${PASTILLA} ${
                actual ? ACTIVA : QUIETA
              }`}
            >
              <span
                className={`tabular-nums ${
                  actual ? "opacity-60" : "text-teal-700 dark:text-teal-400"
                }`}
              >
                {p.n}
              </span>
              {p.nombre}
            </Link>
          );
        })}

        <span
          aria-hidden
          className="mx-2 hidden h-4 w-px bg-neutral-200 sm:block dark:bg-neutral-800"
        />

        <Link
          href="/hecho"
          aria-current={aqui === "/hecho" ? "page" : undefined}
          style={{ ["--tarda" as string]: "0.3s" }}
          className={`entra-lado ${PASTILLA} ${aqui === "/hecho" ? ACTIVA : QUIETA}`}
        >
          Lo hecho
        </Link>
        <Link
          href="/negocio"
          aria-current={aqui === "/negocio" ? "page" : undefined}
          style={{ ["--tarda" as string]: "0.35s" }}
          className={`entra-lado ${PASTILLA} ${aqui === "/negocio" ? ACTIVA : QUIETA}`}
        >
          Tu negocio
        </Link>
      </nav>
    </div>
  );
}
