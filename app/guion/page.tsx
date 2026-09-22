"use client";

import { useState } from "react";
import Link from "next/link";
import { useSession } from "@/lib/auth-cliente";
import { Barra } from "../barra";
import { FORMATOS, type Formato, type Ganchos, type Guion } from "@/types/guion";

export default function PaginaGuion() {
  const { data: sesion, isPending } = useSession();

  const [formato, setFormato] = useState<Formato | null>(null);
  const [idea, setIdea] = useState("");
  const [angulo, setAngulo] = useState("");
  const [ganchos, setGanchos] = useState<Ganchos | null>(null);
  const [elegido, setElegido] = useState<string | null>(null);
  const [guion, setGuion] = useState<Guion | null>(null);
  const [cargando, setCargando] = useState<"" | "ganchos" | "guion">("");
  const [error, setError] = useState("");
  const [faltaVoz, setFaltaVoz] = useState(false);

  async function pedir(paso: "ganchos" | "guion") {
    setCargando(paso);
    setError("");
    setFaltaVoz(false);
    try {
      const r = await fetch("/api/guion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          paso,
          formato,
          idea,
          angulo,
          idea_afilada: ganchos?.idea_afilada,
          gancho: elegido,
        }),
      });
      const d = await r.json();
      if (!r.ok) {
        if (d.falta === "voz") setFaltaVoz(true);
        throw new Error(d.error ?? "No se pudo.");
      }
      if (paso === "ganchos") {
        setGanchos(d.ganchos);
        setElegido(null);
        setGuion(null);
      } else {
        setGuion(d.guion);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error inesperado.");
    } finally {
      setCargando("");
    }
  }

  if (isPending) return <main className="mx-auto max-w-3xl px-6 py-14" />;

  if (!sesion) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-20">
        <h1 className="text-4xl font-bold tracking-tight">El guion</h1>
        <p className="mt-4 text-neutral-600 dark:text-neutral-400">
          Necesitas una cuenta: el guion se escribe con tu voz y tu negocio.
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
          Función 3 · Guion listo para grabar
        </p>
        <h1 className="mt-4 text-5xl font-bold leading-none tracking-tight">El guion</h1>
        <p className="mt-4 max-w-xl text-neutral-600 dark:text-neutral-400">
          Primero el formato, después el gancho, y el guion al final. En ese orden
          — porque rechazar tres líneas es barato y rechazar ochocientas palabras
          no.
        </p>
      </header>

      <section className="mt-9">
        <h2 className="font-mono text-[11px] uppercase tracking-[0.12em] text-neutral-500">
          1 · Qué vas a grabar
        </h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          {FORMATOS.map((f) => (
            <button
              key={f.id}
              onClick={() => setFormato(f.id)}
              className={`rounded border p-4 text-left transition ${
                formato === f.id
                  ? "border-teal-700 bg-teal-50 dark:border-teal-400 dark:bg-teal-950/30"
                  : "border-neutral-300 bg-white hover:border-teal-700 dark:border-neutral-700 dark:bg-neutral-900 dark:hover:border-teal-400"
              }`}
            >
              <p className="font-semibold leading-snug">{f.nombre}</p>
              <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">{f.que}</p>
              <p className="mt-2 font-mono text-[10px] uppercase tracking-wider text-neutral-500">
                {f.golpes}
              </p>
            </button>
          ))}
        </div>
        <p className="mt-2 text-xs text-neutral-500">
          No están VS ni POV a propósito: exigen actuar, y tú no eres actor.
        </p>
      </section>

      <section className="mt-10">
        <h2 className="font-mono text-[11px] uppercase tracking-[0.12em] text-neutral-500">
          2 · De qué va
        </h2>
        <p className="mb-2 mt-0.5 text-sm text-neutral-500">
          La idea, como la dirías. Si sale de tu semana, pega la idea de ese día.
        </p>
        <textarea
          value={idea}
          onChange={(e) => setIdea(e.target.value)}
          rows={3}
          placeholder="Lo que quieres que quede claro en esta pieza"
          className="w-full rounded border border-neutral-300 bg-white p-3 text-sm leading-relaxed outline-none focus:border-teal-700 dark:border-neutral-700 dark:bg-neutral-900 dark:focus:border-teal-400"
        />
        <input
          value={angulo}
          onChange={(e) => setAngulo(e.target.value)}
          placeholder="El ángulo, si ya lo tienes (opcional)"
          className="mt-2 w-full rounded border border-neutral-300 bg-white p-2 text-sm outline-none focus:border-teal-700 dark:border-neutral-700 dark:bg-neutral-900 dark:focus:border-teal-400"
        />

        <button
          onClick={() => pedir("ganchos")}
          disabled={!formato || !idea.trim() || cargando !== ""}
          className="mt-4 rounded bg-teal-700 px-5 py-2.5 font-semibold text-white transition hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-teal-600 dark:hover:bg-teal-500"
        >
          {cargando === "ganchos" ? "Afilando…" : ganchos ? "Otros tres ganchos" : "Afilar y darme tres ganchos"}
        </button>

        {error && (
          <div className="mt-4 rounded border-l-[3px] border-red-700 bg-red-50 p-3 text-sm text-red-900 dark:bg-red-950/40 dark:text-red-200">
            <p>{error}</p>
            {faltaVoz && (
              <Link
                href="/"
                className="mt-2 inline-block font-mono text-[11px] uppercase tracking-wider underline underline-offset-4"
              >
                ir a llenar mi voz →
              </Link>
            )}
          </div>
        )}
      </section>

      {ganchos && (
        <section className="mt-10">
          <h2 className="font-mono text-[11px] uppercase tracking-[0.12em] text-neutral-500">
            3 · La idea con filo
          </h2>
          <p className="mt-2 text-lg font-semibold leading-snug">{ganchos.idea_afilada}</p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div className="rounded border-l-[3px] border-red-700 bg-red-50 p-3 text-sm dark:bg-red-950/30">
              <p className="font-mono text-[10px] uppercase tracking-wider text-red-700 dark:text-red-400">
                así no
              </p>
              <p className="mt-1.5 leading-relaxed">{ganchos.asi_no}</p>
            </div>
            <div className="rounded border-l-[3px] border-green-700 bg-green-50 p-3 text-sm dark:bg-green-950/30">
              <p className="font-mono text-[10px] uppercase tracking-wider text-green-700 dark:text-green-400">
                así sí
              </p>
              <p className="mt-1.5 leading-relaxed">{ganchos.asi_si}</p>
            </div>
          </div>

          <h2 className="mt-8 font-mono text-[11px] uppercase tracking-[0.12em] text-neutral-500">
            4 · Elige el gancho
          </h2>
          <p className="mb-3 mt-0.5 text-sm text-neutral-500">
            Son los primeros tres segundos, literales. El guion se escribe
            alrededor del que elijas.
          </p>
          <div className="space-y-3">
            {ganchos.ganchos?.map((g, i) => (
              <button
                key={i}
                onClick={() => setElegido(g.texto)}
                className={`block w-full rounded border p-4 text-left transition ${
                  elegido === g.texto
                    ? "border-teal-700 bg-teal-50 dark:border-teal-400 dark:bg-teal-950/30"
                    : "border-neutral-300 bg-white hover:border-teal-700 dark:border-neutral-700 dark:bg-neutral-900 dark:hover:border-teal-400"
                }`}
              >
                <p className="font-mono text-[10px] uppercase tracking-wider text-teal-700 dark:text-teal-400">
                  {g.camino}
                </p>
                <p className="mt-1.5 text-lg font-semibold leading-snug">{g.texto}</p>
                <p className="mt-1.5 text-sm text-neutral-600 dark:text-neutral-400">{g.por_que}</p>
              </button>
            ))}
          </div>

          <button
            onClick={() => pedir("guion")}
            disabled={!elegido || cargando !== ""}
            className="mt-4 rounded bg-teal-700 px-5 py-2.5 font-semibold text-white transition hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-teal-600 dark:hover:bg-teal-500"
          >
            {cargando === "guion" ? "Escribiendo…" : "Escribir el guion"}
          </button>

          {ganchos.limites?.length > 0 && (
            <ul className="mt-4 space-y-1 border-l-[3px] border-neutral-400 bg-neutral-50 p-3 text-sm text-neutral-600 dark:bg-neutral-900 dark:text-neutral-400">
              {ganchos.limites.map((l, i) => (
                <li key={i}>{l}</li>
              ))}
            </ul>
          )}
        </section>
      )}

      {guion && <Resultado g={guion} />}
    </main>
  );
}

function Resultado({ g }: { g: Guion }) {
  const completo = [
    g.gancho,
    ...(g.golpes?.map((x) => x.texto) ?? []),
    g.cierre?.texto,
  ]
    .filter(Boolean)
    .join("\n\n");

  return (
    <section className="mt-12 border-t border-neutral-200 pt-10 dark:border-neutral-800">
      <div className="flex flex-wrap items-baseline gap-4">
        <span className="font-mono text-4xl font-bold tabular-nums text-teal-700 dark:text-teal-400">
          {g.duracion_s}
          <span className="text-2xl text-neutral-400">s</span>
        </span>
        <p className="font-mono text-[11px] uppercase tracking-wider text-neutral-500">
          {g.palabras} palabras · {g.golpes?.length ?? 0} golpes
        </p>
      </div>

      <div className="mt-6 divide-y divide-neutral-200 overflow-hidden rounded border border-neutral-200 dark:divide-neutral-800 dark:border-neutral-800">
        {g.golpes?.map((golpe, i) => (
          <div key={i} className="bg-white p-4 dark:bg-neutral-900">
            <p className="font-mono text-[10px] uppercase tracking-wider text-teal-700 dark:text-teal-400">
              {i === 0 ? "gancho" : `golpe ${i}`}
            </p>
            <p className="mt-1.5 leading-relaxed">{golpe.texto}</p>
            <p className="mt-2 border-l-2 border-neutral-300 pl-2.5 text-sm italic text-neutral-500 dark:border-neutral-700">
              {golpe.direccion}
            </p>
          </div>
        ))}
        {g.cierre && (
          <div className="bg-neutral-50 p-4 dark:bg-neutral-950">
            <p className="font-mono text-[10px] uppercase tracking-wider text-teal-700 dark:text-teal-400">
              cierre
            </p>
            <p className="mt-1.5 leading-relaxed">{g.cierre.texto}</p>
            <div className="mt-3 grid gap-2 text-sm text-neutral-600 sm:grid-cols-2 dark:text-neutral-400">
              <p>
                <span className="font-mono text-[10px] uppercase tracking-wider">lógico · </span>
                {g.cierre.caso_logico}
              </p>
              <p>
                <span className="font-mono text-[10px] uppercase tracking-wider">emocional · </span>
                {g.cierre.caso_emocional}
              </p>
            </div>
          </div>
        )}
      </div>

      <Copiable texto={completo} etiqueta="copiar el guion entero" />

      {g.como_grabar && (
        <>
          <h2 className="mt-10 font-mono text-[11px] uppercase tracking-[0.12em] text-neutral-500">
            Cómo grabarlo
          </h2>
          <dl className="mt-3 divide-y divide-neutral-200 overflow-hidden rounded border border-neutral-200 dark:divide-neutral-800 dark:border-neutral-800">
            {(
              [
                ["Luz", g.como_grabar.luz],
                ["Fondo", g.como_grabar.fondo],
                ["Encuadre", g.como_grabar.encuadre],
                ["Voz", g.como_grabar.voz],
              ] as const
            ).map(([k, v]) => (
              <div key={k} className="bg-white p-4 dark:bg-neutral-900">
                <dt className="font-mono text-[10px] uppercase tracking-wider text-neutral-500">
                  {k}
                </dt>
                <dd className="mt-1 text-sm leading-relaxed">{v}</dd>
              </div>
            ))}
          </dl>
        </>
      )}

      {g.descripcion && (
        <>
          <h2 className="mt-10 font-mono text-[11px] uppercase tracking-[0.12em] text-neutral-500">
            El pie de la publicación
          </h2>
          <p className="mb-1 mt-0.5 text-sm text-neutral-500">
            Es lo que dices al inicio del video. Los hashtags no mueven la aguja.
          </p>
          <Copiable texto={g.descripcion} etiqueta="copiar" />
        </>
      )}

      {g.valor && (
        <p className="mt-8 rounded border-l-[3px] border-teal-700 bg-teal-50 p-3 text-sm leading-relaxed dark:border-teal-400 dark:bg-teal-950/30">
          <span className="font-mono text-[10px] uppercase tracking-wider text-teal-800 dark:text-teal-400">
            qué mueve esta pieza ·{" "}
          </span>
          {g.valor}
        </p>
      )}

      {g.limites?.length > 0 && (
        <ul className="mt-6 space-y-1 border-l-[3px] border-neutral-400 bg-neutral-50 p-3 text-sm text-neutral-600 dark:bg-neutral-900 dark:text-neutral-400">
          {g.limites.map((l, i) => (
            <li key={i}>{l}</li>
          ))}
        </ul>
      )}
    </section>
  );
}

function Copiable({ texto, etiqueta }: { texto: string; etiqueta: string }) {
  const [copiado, setCopiado] = useState(false);
  return (
    <div className="mt-3 rounded border-l-2 border-teal-700 bg-neutral-50 p-3 dark:border-teal-400 dark:bg-neutral-950">
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
        {copiado ? "copiado" : etiqueta}
      </button>
    </div>
  );
}
