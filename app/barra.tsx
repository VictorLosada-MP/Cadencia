"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { signOut, useSession } from "@/lib/auth-cliente";

/**
 * Las cuatro funciones son estaciones de una misma cadena, no un menú de
 * herramientas. La barra lo dice: van numeradas y en orden.
 */
const PASOS = [
  { href: "/", n: "1", nombre: "Diagnóstico" },
  { href: "/semana", n: "2", nombre: "La semana" },
  { href: "/guion", n: "3", nombre: "La pieza" },
  { href: "/pieza", n: "4", nombre: "Lista para subir" },
];

type Cuota = {
  plan: { nombre: string };
  cortesia: boolean;
  usadas: number;
  limite: number | null;
};

export function Barra() {
  const aqui = usePathname();
  const { data: sesion } = useSession();
  const router = useRouter();
  const [cuota, setCuota] = useState<Cuota | null>(null);

  useEffect(() => {
    if (!sesion) return;
    let vivo = true;
    fetch("/api/negocio")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (vivo && d?.cuota) setCuota(d.cuota);
      })
      .catch(() => {});
    return () => {
      vivo = false;
    };
  }, [sesion, aqui]);

  if (!sesion) return null;

  // Se avisa al 80%, una sola vez y en la página. Nunca un aviso a mitad de una
  // corrida: eso interrumpe el trabajo por el que ya pagó.
  const cerca =
    cuota?.limite != null && cuota.usadas >= Math.floor(cuota.limite * 0.8);

  return (
    <div className="mb-6 flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-neutral-200 pb-3 dark:border-neutral-800">
      <nav className="flex flex-wrap gap-x-4 gap-y-1">
        {PASOS.map((p) => {
          const actual = aqui === p.href;
          return (
            <Link
              key={p.href}
              href={p.href}
              aria-current={actual ? "page" : undefined}
              className={`font-mono text-[11px] uppercase tracking-wider ${
                actual
                  ? "font-bold text-neutral-900 dark:text-neutral-100"
                  : "text-neutral-500 underline underline-offset-4 hover:text-teal-700 hover:no-underline dark:hover:text-teal-400"
              }`}
            >
              <span className="mr-1 text-teal-700 dark:text-teal-400">{p.n}</span>
              {p.nombre}
            </Link>
          );
        })}
      </nav>

      <span className="ml-auto flex items-center gap-3 text-xs text-neutral-500">
        {cuota?.limite != null && (
          <span
            className={`font-mono tabular-nums ${
              cerca ? "font-bold text-amber-700 dark:text-amber-500" : ""
            }`}
            title={
              cuota.cortesia
                ? `Plan ${cuota.plan.nombre}, de cortesía`
                : `Plan ${cuota.plan.nombre}`
            }
          >
            {cuota.usadas}/{cuota.limite}
            {cuota.cortesia && " ·  cortesía"}
          </span>
        )}
        <span className="font-mono">{sesion.user.email}</span>
        <button
          onClick={() =>
            signOut().then(() => {
              router.push("/");
              router.refresh();
            })
          }
          className="font-mono uppercase tracking-wider underline underline-offset-4 hover:no-underline"
        >
          salir
        </button>
      </span>
    </div>
  );
}
