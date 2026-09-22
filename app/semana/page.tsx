"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSession } from "@/lib/auth-cliente";
import { Barra } from "../barra";
import { BRECHAS, NIVELES, type Banco, type PiezaSemana } from "@/types/banco";

export default function Semana() {
  const { data: sesion, isPending } = useSession();
  const [senales, setSenales] = useState("");
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState("");
  const [banco, setBanco] = useState<Banco | null>(null);

  useEffect(() => {
    if (!sesion) return;
    let vivo = true;
    fetch("/api/negocio")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (vivo && d?.negocio?.senales) setSenales(d.negocio.senales);
      })
      .catch(() => {});
    return () => {
      vivo = false;
    };
  }, [sesion]);

  async function armar() {
    setCargando(true);
    setError("");
    try {
      const r = await fetch("/api/banco", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ senales }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error ?? "No se pudo armar la semana.");
      setBanco(d.banco);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error inesperado.");
    } finally {
      setCargando(false);
    }
  }

  if (isPending) return <main className="mx-auto max-w-3xl px-6 py-14" />;

  if (!sesion) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-20">
        <h1 className="text-4xl font-bold tracking-tight">La semana</h1>
        <p className="mt-4 text-neutral-600 dark:text-neutral-400">
          Necesitas una cuenta: la semana se arma con tu Perfil de Negocio.
        </p>
        <Link
          href="/entrar"
          className="mt-6 inline-block rounded bg-teal-700 px-5 py-2.5 font-semibold text-white dark:bg-teal-600"
        >
          Entrar o crear cuenta
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-3xl px-6 py-14">
      <Barra />

      <header className="border-b-2 border-neutral-900 pb-7 dark:border-neutral-100">
        <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-teal-700 dark:text-teal-400">
          Función 2 · Banco de la semana
        </p>
        <h1 className="mt-4 text-5xl font-bold leading-none tracking-tight">La semana</h1>
        <p className="mt-4 max-w-xl text-neutral-600 dark:text-neutral-400">
          Cinco piezas, de lunes a viernes. Cada una sube a tu audiencia un
          escalón — y trae cómo responder al mensaje que genere.
        </p>
      </header>

      <section className="mt-9">
        <label
          htmlFor="senales"
          className="font-mono text-[11px] uppercase tracking-[0.12em] text-neutral-500"
        >
          Qué te escriben
        </label>
        <p className="mb-2 mt-0.5 text-sm text-neutral-500">
          Lo que te preguntan por privado o en comentarios. Es lo que dice en qué
          punto está tu gente — nadie pregunta desde un escalón que no es el suyo.
          Si lo dejas vacío, se deduce de tu perfil.
        </p>
        <textarea
          id="senales"
          value={senales}
          onChange={(e) => setSenales(e.target.value)}
          rows={5}
          placeholder="«¿cuánto cuesta?» · «¿esto me sirve si apenas empiezo?» · «¿y si después no sé usarlo?»"
          className="w-full rounded border border-neutral-300 bg-white p-3 text-sm leading-relaxed outline-none focus:border-teal-700 dark:border-neutral-700 dark:bg-neutral-900 dark:focus:border-teal-400"
        />

        <button
          onClick={armar}
          disabled={cargando}
          className="mt-4 rounded bg-teal-700 px-5 py-2.5 font-semibold text-white transition hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-teal-600 dark:hover:bg-teal-500"
        >
          {cargando ? "Armando…" : banco ? "Volver a armar" : "Armar la semana"}
        </button>
        {cargando && (
          <p className="mt-3 text-sm text-neutral-500">
            Ubicando a tu audiencia y repartiendo los cinco escalones.
          </p>
        )}
        {error && (
          <p className="mt-4 rounded border-l-[3px] border-red-700 bg-red-50 p-3 text-sm text-red-900 dark:bg-red-950/40 dark:text-red-200">
            {error}
          </p>
        )}
      </section>

      {banco && <Resultado b={banco} />}
    </main>
  );
}

function Resultado({ b }: { b: Banco }) {
  return (
    <section className="mt-12 border-t border-neutral-200 pt-10 dark:border-neutral-800">
      <div className="rounded border-l-[3px] border-teal-700 bg-teal-50 p-4 dark:border-teal-400 dark:bg-teal-950/30">
        <p className="font-mono text-[10px] uppercase tracking-wider text-teal-800 dark:text-teal-400">
          Dónde está tu gente
        </p>
        <p className="mt-1.5 text-lg font-semibold leading-snug">
          {BRECHAS[b.brecha] ?? b.brecha}
        </p>
        <p className="mt-1 font-mono text-[11px] uppercase tracking-wider text-neutral-500">
          {b.nivel_dominante} · {NIVELES[b.nivel_dominante]?.corto ?? ""}
          {NIVELES[b.nivel_dominante] && ` — «${NIVELES[b.nivel_dominante].dice}»`}
        </p>
        <p className="mt-2.5 text-sm leading-relaxed text-neutral-700 dark:text-neutral-300">
          {b.por_que_ese_nivel}
        </p>
      </div>

      <h2 className="mt-10 font-mono text-[11px] uppercase tracking-[0.12em] text-neutral-500">
        Las cinco piezas
      </h2>
      <div className="mt-3 space-y-3">
        {b.semana?.map((p) => <Pieza key={p.dia} p={p} />)}
      </div>

      {b.donde_no_hay_competencia && (
        <div className="mt-8 rounded border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900">
          <p className="font-mono text-[10px] uppercase tracking-wider text-neutral-500">
            Dónde no hay competencia
          </p>
          <p className="mt-1.5 text-sm leading-relaxed">{b.donde_no_hay_competencia}</p>
        </div>
      )}

      {b.guion_respuesta && (
        <>
          <h2 className="mt-10 font-mono text-[11px] uppercase tracking-[0.12em] text-neutral-500">
            Cuando te escriban
          </h2>
          <p className="mb-3 mt-1 text-sm text-neutral-500">
            Nunca se abre con la oferta. Primero se pregunta y se escucha.
          </p>
          <ol className="space-y-2">
            {b.guion_respuesta.las_tres_preguntas?.map((q, i) => (
              <li
                key={i}
                className="rounded border border-neutral-200 bg-white p-3 text-sm dark:border-neutral-800 dark:bg-neutral-900"
              >
                <span className="mr-2 font-mono text-[11px] font-bold text-teal-700 dark:text-teal-400">
                  {i + 1}
                </span>
                {q}
              </li>
            ))}
          </ol>
          {b.guion_respuesta.cuando_ofrecer && (
            <p className="mt-3 rounded border-l-2 border-teal-700 bg-neutral-50 p-3 text-sm leading-relaxed dark:border-teal-400 dark:bg-neutral-950">
              {b.guion_respuesta.cuando_ofrecer}
            </p>
          )}
        </>
      )}

      {b.limites?.length > 0 && (
        <div className="mt-10 border-l-[3px] border-neutral-400 bg-neutral-50 p-3 dark:bg-neutral-900">
          <p className="font-mono text-[10px] uppercase tracking-wider text-neutral-500">
            Lo que no pudo saber
          </p>
          <ul className="mt-1.5 space-y-1 text-sm text-neutral-600 dark:text-neutral-400">
            {b.limites.map((l, i) => (
              <li key={i}>{l}</li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

function Pieza({ p }: { p: PiezaSemana }) {
  const [abierto, setAbierto] = useState(false);

  return (
    <article className="rounded border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 border-b border-neutral-200 p-4 dark:border-neutral-800">
        <span className="font-mono text-[11px] font-bold uppercase tracking-wider text-teal-700 dark:text-teal-400">
          {p.dia}
        </span>
        <span className="font-mono text-[10px] uppercase tracking-wider text-neutral-500">
          {p.nivel} → {p.mueve_a}
        </span>
        <span className="ml-auto font-mono text-[10px] uppercase tracking-wider text-neutral-500">
          {p.angulo} · {p.peso_mercado}
        </span>
      </div>

      <div className="p-4">
        <p className="text-lg font-semibold leading-snug">{p.gancho}</p>
        <p className="mt-2 text-sm leading-relaxed text-neutral-700 dark:text-neutral-300">
          {p.idea}
        </p>
        <p className="mt-2 font-mono text-[11px] uppercase tracking-wider text-neutral-500">
          para que entienda · {p.trabajo}
        </p>

        <button
          onClick={() => setAbierto(!abierto)}
          className="mt-3 font-mono text-[11px] uppercase tracking-wider text-teal-700 underline underline-offset-4 hover:no-underline dark:text-teal-400"
        >
          {abierto ? "− ocultar la respuesta" : "+ si te escriben por esta"}
        </button>
        {abierto && (
          <p className="mt-2 rounded border-l-2 border-teal-700 bg-neutral-50 p-3 text-sm leading-relaxed dark:border-teal-400 dark:bg-neutral-950">
            {p.apertura_respuesta}
          </p>
        )}
      </div>
    </article>
  );
}
