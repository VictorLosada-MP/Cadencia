"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useSession } from "@/lib/auth-cliente";
import { Barra } from "../barra";
import type { Negocio } from "@/types/negocio";
import { BloqueNegocio, NEGOCIO_VACIO, desdeBase } from "./negocio";

/**
 * El Perfil de Negocio tiene pantalla propia porque no es de la Función 1: es
 * de las cuatro. Mientras vivió dentro del diagnóstico, cambiar una frase de la
 * oferta obligaba a pasar por una pantalla que pide capturas y redes.
 */
export default function PantallaNegocio() {
  const { data: sesion, isPending } = useSession();
  const [negocio, setNegocio] = useState<Negocio>(NEGOCIO_VACIO);
  const [enBase, setEnBase] = useState(false);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    // Sin sesión no se pide nada, y `cargando` no se toca: esta pantalla
    // devuelve la invitación a entrar antes de llegar a mirarlo.
    if (!sesion) return;
    let vivo = true;
    // Ligero: aquí no hacen falta ni la comparación ni la cuota.
    fetch("/api/negocio?ligero=1")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!vivo) return;
        if (d?.negocio) {
          setNegocio(desdeBase(d.negocio));
          setEnBase(true);
        }
      })
      .catch(() => {})
      .finally(() => {
        if (vivo) setCargando(false);
      });
    return () => {
      vivo = false;
    };
  }, [sesion]);

  if (isPending) return <main className="mx-auto max-w-5xl px-6 py-14" />;

  if (!sesion) {
    return (
      <main className="mx-auto max-w-5xl px-6 py-20">
        <h1 className="text-3xl font-bold tracking-tight">Tu negocio</h1>
        <p className="mt-4 text-neutral-600 dark:text-neutral-400">
          Entra a tu cuenta para llenarlo. Se guarda una vez y lo usan las
          cuatro funciones.
        </p>
        <a
          href="/entrar"
          className="mt-7 inline-block empuja rounded-full bg-teal-700 px-5 py-2.5 font-semibold text-white transition hover:bg-teal-800 dark:bg-teal-600 dark:hover:bg-teal-500"
        >
          Entrar o crear cuenta
        </a>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-5xl px-6 py-14">
      <Barra />

      <header className="entra border-b-2 border-neutral-900 pb-7 dark:border-neutral-100">
        <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-teal-700 dark:text-teal-400">
          Tu negocio
        </p>
        <h1 className="mt-4 text-4xl font-bold leading-none tracking-tight">
          Contra qué se escribe todo
        </h1>
        <p className="mt-4 max-w-xl text-neutral-600 dark:text-neutral-400">
          Esto se llena una vez. El diagnóstico corrige con esto, la semana se
          arma con esto y la pieza se escribe con esto. Cámbialo cuando cambie
          el negocio, no antes.
        </p>
      </header>

      {cargando ? (
        <p className="mt-9 text-sm text-neutral-500">Buscando lo que ya guardaste…</p>
      ) : (
        <section className="revela mt-9" style={{ ["--tarda" as string]: "0.04s" }}>
          <BloqueNegocio
            negocio={negocio}
            onCambio={(c) => {
              setNegocio({ ...negocio, ...c });
              setEnBase(false);
            }}
            guardado={enBase}
            onGuardado={() => setEnBase(true)}
          />
          {enBase && (
            <Link
              href="/diagnostico"
              className="mt-5 inline-block font-mono text-[11px] uppercase tracking-wider text-teal-700 underline underline-offset-4 hover:no-underline dark:text-teal-400"
            >
              ir al diagnóstico →
            </Link>
          )}
        </section>
      )}
    </main>
  );
}
