"use client";

import { useState } from "react";
import type { Diagnostico } from "@/types/diagnostico";

const EJEMPLO = `Nombre: Víctor Losada
Usuario: @victorlosada
Bio: Te construyo el sistema que tu negocio necesita.
Ventas y contenido sin depender de terceros.
Aplicá acá 👇
Link: victorlosada.com`;

export default function Home() {
  const [texto, setTexto] = useState("");
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState("");
  const [dx, setDx] = useState<Diagnostico | null>(null);

  async function diagnosticar() {
    setCargando(true);
    setError("");
    setDx(null);
    try {
      const r = await fetch("/api/diagnostico", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ perfilId: "victor", texto }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error ?? "Falló el diagnóstico.");
      setDx(d.diagnostico);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error inesperado.");
    } finally {
      setCargando(false);
    }
  }

  return (
    <main className="mx-auto max-w-3xl px-6 py-14">
      <header className="border-b-2 border-neutral-900 pb-7 dark:border-neutral-100">
        <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-teal-700 dark:text-teal-400">
          Función 1 · Diagnóstico
        </p>
        <h1 className="mt-4 text-5xl font-bold leading-none tracking-tight">
          Cadencia
        </h1>
        <p className="mt-4 max-w-xl text-neutral-600 dark:text-neutral-400">
          Pega tu perfil como se ve hoy. Te devuelve qué está costando
          conversiones y el texto ya corregido.
        </p>
      </header>

      <section className="mt-9">
        <div className="mb-2 flex items-baseline justify-between">
          <label
            htmlFor="perfil"
            className="font-mono text-[11px] uppercase tracking-[0.12em] text-neutral-500"
          >
            Tu perfil hoy
          </label>
          <button
            type="button"
            onClick={() => setTexto(EJEMPLO)}
            className="font-mono text-[11px] text-teal-700 underline underline-offset-2 hover:no-underline dark:text-teal-400"
          >
            usar ejemplo
          </button>
        </div>
        <textarea
          id="perfil"
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          rows={8}
          placeholder="Nombre, usuario, bio, CTA y link — tal como aparecen."
          className="w-full rounded border border-neutral-300 bg-white p-3 font-mono text-sm leading-relaxed outline-none focus:border-teal-700 dark:border-neutral-700 dark:bg-neutral-900 dark:focus:border-teal-400"
        />
        <button
          onClick={diagnosticar}
          disabled={cargando || !texto.trim()}
          className="mt-3 rounded bg-teal-700 px-5 py-2.5 font-semibold text-white transition hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-teal-600 dark:hover:bg-teal-500"
        >
          {cargando ? "Revisando…" : "Diagnosticar"}
        </button>

        {error && (
          <p className="mt-4 rounded border-l-[3px] border-red-700 bg-red-50 p-3 text-sm text-red-900 dark:bg-red-950/40 dark:text-red-200">
            {error}
          </p>
        )}
      </section>

      {dx && <Resultado dx={dx} />}
    </main>
  );
}

function Resultado({ dx }: { dx: Diagnostico }) {
  return (
    <section className="mt-12 border-t border-neutral-200 pt-10 dark:border-neutral-800">
      <div className="flex flex-wrap items-baseline gap-5">
        <span className="font-mono text-5xl font-bold tabular-nums text-teal-700 dark:text-teal-400">
          {dx.score}
        </span>
        <div>
          <p className="text-lg font-semibold leading-snug">{dx.veredicto}</p>
          <p className="mt-1 font-mono text-[11px] uppercase tracking-[0.1em] text-neutral-500">
            lo que más cuesta · {dx.el_que_mas_cuesta}
          </p>
        </div>
      </div>

      {dx.lo_que_funciona?.length > 0 && (
        <ul className="mt-7 space-y-1.5">
          {dx.lo_que_funciona.map((x, i) => (
            <li
              key={i}
              className="text-sm text-green-800 before:mr-2 before:content-['✓'] dark:text-green-400"
            >
              {x}
            </li>
          ))}
        </ul>
      )}

      <h2 className="mt-10 font-mono text-[11px] uppercase tracking-[0.12em] text-neutral-500">
        Los cinco puntos
      </h2>
      <div className="mt-3 divide-y divide-neutral-200 overflow-hidden rounded border border-neutral-200 dark:divide-neutral-800 dark:border-neutral-800">
        {dx.puntos.map((p) => (
          <article key={p.campo} className="bg-white p-4 dark:bg-neutral-900">
            <div className="flex items-center gap-2.5">
              <span
                className={`font-mono text-[10px] font-bold uppercase tracking-wider ${
                  p.pasa
                    ? "text-green-700 dark:text-green-400"
                    : "text-red-700 dark:text-red-400"
                }`}
              >
                {p.pasa ? "pasa" : "no pasa"}
              </span>
              <h3 className="font-semibold">{p.campo}</h3>
            </div>
            {p.actual && (
              <p className="mt-2 font-mono text-xs text-neutral-500">
                hoy: {p.actual}
              </p>
            )}
            {!p.pasa && (
              <>
                <p className="mt-2 text-sm text-neutral-700 dark:text-neutral-300">
                  {p.por_que}
                </p>
                {p.corregido && <Copiable texto={p.corregido} />}
              </>
            )}
          </article>
        ))}
      </div>

      {dx.bios?.length > 0 && (
        <>
          <h2 className="mt-10 font-mono text-[11px] uppercase tracking-[0.12em] text-neutral-500">
            Tres bios listas
          </h2>
          <div className="mt-3 space-y-3">
            {dx.bios.map((b, i) => (
              <div
                key={i}
                className="rounded border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900"
              >
                <p className="font-mono text-[10px] uppercase tracking-wider text-teal-700 dark:text-teal-400">
                  {b.angulo}
                </p>
                <Copiable texto={b.texto} />
              </div>
            ))}
          </div>
        </>
      )}

      {dx.avisos?.length > 0 && (
        <ul className="mt-8 space-y-1 border-l-[3px] border-amber-500 bg-amber-50 p-3 text-sm dark:bg-amber-950/30">
          {dx.avisos.map((a, i) => (
            <li key={i}>{a}</li>
          ))}
        </ul>
      )}
    </section>
  );
}

function Copiable({ texto }: { texto: string }) {
  const [copiado, setCopiado] = useState(false);
  return (
    <div className="mt-2 rounded border-l-2 border-teal-700 bg-neutral-50 p-3 dark:border-teal-400 dark:bg-neutral-950">
      <p className="whitespace-pre-wrap text-sm leading-relaxed">{texto}</p>
      <button
        onClick={() => {
          navigator.clipboard?.writeText(texto).then(
            () => {
              setCopiado(true);
              setTimeout(() => setCopiado(false), 1800);
            },
            () => setCopiado(false),
          );
        }}
        className="mt-2 font-mono text-[11px] text-teal-700 underline underline-offset-2 hover:no-underline dark:text-teal-400"
      >
        {copiado ? "copiado" : "copiar"}
      </button>
    </div>
  );
}
