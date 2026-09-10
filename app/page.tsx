"use client";

import { useState } from "react";
import type { Diagnostico } from "@/types/diagnostico";

export default function Home() {
  const [texto, setTexto] = useState("");
  const [contenido, setContenido] = useState("");
  const [respuestas, setRespuestas] = useState<Record<string, string>>({});
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState("");
  const [dx, setDx] = useState<Diagnostico | null>(null);

  async function diagnosticar(conRespuestas = false) {
    setCargando(true);
    setError("");
    try {
      const r = await fetch("/api/diagnostico", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          perfilId: "victor",
          texto,
          contenido,
          respuestas: conRespuestas
            ? Object.entries(respuestas)
                .filter(([, v]) => v.trim())
                .map(([pregunta, respuesta]) => ({ pregunta, respuesta }))
            : undefined,
        }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error ?? "Falló el diagnóstico.");
      setDx(d.diagnostico);
      if (!conRespuestas) setRespuestas({});
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error inesperado.");
    } finally {
      setCargando(false);
    }
  }

  const hayRespuestas = Object.values(respuestas).some((v) => v.trim());

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
          Qué le está costando conversaciones a tu perfil, con el texto ya
          corregido. Cuantas más piezas pegues, menos tiene que adivinar.
        </p>
      </header>

      <section className="mt-9 space-y-6">
        <Campo
          id="perfil"
          etiqueta="Tu perfil hoy"
          nota="Nombre, bio, CTA y link — tal como aparecen"
          valor={texto}
          onChange={setTexto}
          filas={7}
        />
        <Campo
          id="contenido"
          etiqueta="Tus últimas piezas"
          nota="Opcional, y es lo que le da profundidad — pega los textos de 3 a 5 publicaciones"
          valor={contenido}
          onChange={setContenido}
          filas={7}
        />

        <div>
          <button
            onClick={() => diagnosticar(false)}
            disabled={cargando || !texto.trim()}
            className="rounded bg-teal-700 px-5 py-2.5 font-semibold text-white transition hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-teal-600 dark:hover:bg-teal-500"
          >
            {cargando ? "Revisando…" : dx ? "Volver a diagnosticar" : "Diagnosticar"}
          </button>
          {error && (
            <p className="mt-4 rounded border-l-[3px] border-red-700 bg-red-50 p-3 text-sm text-red-900 dark:bg-red-950/40 dark:text-red-200">
              {error}
            </p>
          )}
        </div>
      </section>

      {dx && (
        <Resultado
          dx={dx}
          respuestas={respuestas}
          setRespuestas={setRespuestas}
          hayRespuestas={hayRespuestas}
          cargando={cargando}
          reDiagnosticar={() => diagnosticar(true)}
        />
      )}
    </main>
  );
}

function Campo({
  id,
  etiqueta,
  nota,
  valor,
  onChange,
  filas,
}: {
  id: string;
  etiqueta: string;
  nota: string;
  valor: string;
  onChange: (v: string) => void;
  filas: number;
}) {
  return (
    <div>
      <label
        htmlFor={id}
        className="font-mono text-[11px] uppercase tracking-[0.12em] text-neutral-500"
      >
        {etiqueta}
      </label>
      <p className="mb-2 mt-0.5 text-sm text-neutral-500">{nota}</p>
      <textarea
        id={id}
        value={valor}
        onChange={(e) => onChange(e.target.value)}
        rows={filas}
        className="w-full rounded border border-neutral-300 bg-white p-3 font-mono text-sm leading-relaxed outline-none focus:border-teal-700 dark:border-neutral-700 dark:bg-neutral-900 dark:focus:border-teal-400"
      />
    </div>
  );
}

function Resultado({
  dx,
  respuestas,
  setRespuestas,
  hayRespuestas,
  cargando,
  reDiagnosticar,
}: {
  dx: Diagnostico;
  respuestas: Record<string, string>;
  setRespuestas: (r: Record<string, string>) => void;
  hayRespuestas: boolean;
  cargando: boolean;
  reDiagnosticar: () => void;
}) {
  return (
    <section className="mt-12 border-t border-neutral-200 pt-10 dark:border-neutral-800">
      <div className="flex flex-wrap items-baseline gap-5">
        <span className="font-mono text-4xl font-bold tabular-nums text-teal-700 dark:text-teal-400">
          {dx.pasan}
          <span className="text-2xl text-neutral-400">/5</span>
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

      {dx.preguntas?.length > 0 && (
        <>
          <h2 className="mt-10 font-mono text-[11px] uppercase tracking-[0.12em] text-neutral-500">
            Lo que le falta saber
          </h2>
          <p className="mb-3 mt-1 text-sm text-neutral-500">
            Responde lo que quieras. Cada respuesta afina el diagnóstico — y
            ninguna es obligatoria.
          </p>
          <div className="space-y-3">
            {dx.preguntas.map((q, i) => (
              <div
                key={i}
                className="rounded border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900"
              >
                <p className="font-semibold leading-snug">{q.pregunta}</p>
                <p className="mt-1 text-sm text-neutral-500">{q.para_que}</p>
                <textarea
                  value={respuestas[q.pregunta] ?? ""}
                  onChange={(e) =>
                    setRespuestas({ ...respuestas, [q.pregunta]: e.target.value })
                  }
                  rows={2}
                  placeholder="Tu respuesta, si quieres"
                  className="mt-2 w-full rounded border border-neutral-300 bg-neutral-50 p-2 text-sm outline-none focus:border-teal-700 dark:border-neutral-700 dark:bg-neutral-950 dark:focus:border-teal-400"
                />
              </div>
            ))}
          </div>
          <button
            onClick={reDiagnosticar}
            disabled={cargando || !hayRespuestas}
            className="mt-3 rounded border border-teal-700 px-5 py-2.5 font-semibold text-teal-700 transition hover:bg-teal-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-teal-400 dark:text-teal-400 dark:hover:bg-teal-950/40"
          >
            {cargando ? "Afinando…" : "Afinar con mis respuestas"}
          </button>
        </>
      )}

      {dx.bios?.length > 0 && (
        <>
          <h2 className="mt-10 font-mono text-[11px] uppercase tracking-[0.12em] text-neutral-500">
            Bios alternativas
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

      {dx.limites?.length > 0 && (
        <div className="mt-10 border-l-[3px] border-amber-500 bg-amber-50 p-3 dark:bg-amber-950/30">
          <p className="font-mono text-[10px] uppercase tracking-wider text-amber-700 dark:text-amber-500">
            Lo que no pudo ver
          </p>
          <ul className="mt-1.5 space-y-1 text-sm">
            {dx.limites.map((l, i) => (
              <li key={i}>{l}</li>
            ))}
          </ul>
        </div>
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
