"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "@/lib/auth-cliente";
import { Barra } from "../barra";
import {
  BRECHAS,
  NIVELES,
  historiaQuePide,
  sugerenciaPorAngulo,
  type Banco,
  type PiezaSemana,
} from "@/types/banco";

export default function Semana() {
  const { data: sesion, isPending } = useSession();
  const [senales, setSenales] = useState("");
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState("");
  const [banco, setBanco] = useState<Banco | null>(null);
  const [creado, setCreado] = useState<string | null>(null);

  useEffect(() => {
    if (!sesion) return;
    let vivo = true;

    // La semana que ya se armó vuelve tal cual. Volver a generarla en cada
    // visita daría una semana distinta cada vez con los mismos datos, y eso no
    // es un plan: es una tirada de dados.
    //
    // Las dos peticiones van sueltas y no en Promise.all: la semana se pinta en
    // cuanto llega la suya, sin quedarse esperando a la otra.
    fetch("/api/ultimo?funcion=2")
      .then((r) => (r.ok ? r.json() : null))
      .then((u) => {
        if (!vivo || !u?.corrida) return;
        if (u.corrida.entrada?.senales) setSenales(u.corrida.entrada.senales);
        if (u.corrida.resultado) {
          setBanco(u.corrida.resultado);
          setCreado(u.corrida.creado);
        }
      })
      .catch(() => {});

    fetch("/api/negocio?ligero=1")
      .then((r) => (r.ok ? r.json() : null))
      .then((n) => {
        // Solo rellena si lo guardado no trajo nada: lo de la última corrida
        // manda, porque es lo que de verdad produjo esta semana.
        if (vivo && n?.negocio?.senales) setSenales((s) => s || n.negocio.senales);
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
      setCreado(new Date().toISOString());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error inesperado.");
    } finally {
      setCargando(false);
    }
  }

  if (isPending) return <main className="mx-auto max-w-5xl px-6 py-14" />;

  if (!sesion) {
    return (
      <main className="mx-auto max-w-5xl px-6 py-20">
        <h1 className="text-4xl font-bold tracking-tight">La semana</h1>
        <p className="mt-4 text-neutral-600 dark:text-neutral-400">
          Necesitas una cuenta: la semana se arma con tu Perfil de Negocio.
        </p>
        <Link
          href="/entrar"
          className="mt-6 inline-block empuja rounded-full bg-teal-700 px-5 py-2.5 font-semibold text-white dark:bg-teal-600"
        >
          Entrar o crear cuenta
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-5xl px-6 py-14">
      <Barra />

      <header className="entra border-b-2 border-neutral-900 pb-7 dark:border-neutral-100">
        <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-teal-700 dark:text-teal-400">
          Función 2 · Banco de la semana
        </p>
        <h1 className="mt-4 text-5xl font-bold leading-none tracking-tight">La semana</h1>
        <p className="mt-4 max-w-xl text-neutral-600 dark:text-neutral-400">
          Cinco piezas, de lunes a viernes. Cada una sube a tu audiencia un
          escalón — y trae cómo responder al mensaje que genere.
        </p>
      </header>

      <section className="revela mt-9" style={{ ["--tarda" as string]: "0.04s" }}>
        <label
          htmlFor="senales"
          className="font-mono text-[11px] uppercase tracking-[0.12em] text-neutral-500"
        >
          Qué te escriben
        </label>
        <p className="mb-2 mt-0.5 text-sm text-neutral-500">
          Lo que te preguntan por privado o en comentarios. Copia dos o tres tal
          cual, aunque sean cortas. De aquí sale todo lo demás — si esto lo
          adivino, la semana entera queda adivinada.
        </p>
        <textarea
          id="senales"
          value={senales}
          onChange={(e) => setSenales(e.target.value)}
          rows={5}
          placeholder="«¿cuánto cuesta?» · «¿esto me sirve si apenas empiezo?» · «¿y si después no sé usarlo?»"
          className="w-full rounded-lg border border-neutral-300 bg-white p-3 text-sm leading-relaxed outline-none focus:border-teal-700 dark:border-neutral-700 dark:bg-neutral-900 dark:focus:border-teal-400"
        />

        <button
          onClick={armar}
          disabled={cargando || senales.trim().length < 10}
          className="mt-4 empuja rounded-full bg-teal-700 px-5 py-2.5 font-semibold text-white transition hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-teal-600 dark:hover:bg-teal-500"
        >
          {cargando ? "Armando…" : banco ? "Volver a armar la semana" : "Armar la semana"}
        </button>
        {senales.trim().length < 10 && (
          <p className="mt-2 text-xs text-neutral-500">
            Escribe al menos una pregunta que te hayan hecho de verdad.
          </p>
        )}
        {banco && creado && !cargando && (
          <p className="mt-2 text-xs text-neutral-500">
            Esta es la semana que armaste el{" "}
            {new Date(creado).toLocaleDateString("es", { day: "numeric", month: "long" })}. Se
            queda así hasta que la vuelvas a armar.
          </p>
        )}
        {cargando && (
          <p className="mt-3 text-sm text-neutral-500">
            Ubicando a tu audiencia y repartiendo los cinco escalones.
          </p>
        )}
        {error && (
          <p className="mt-4 rounded-lg border-l-[3px] border-red-700 bg-red-50 p-3 text-sm text-red-900 dark:bg-red-950/40 dark:text-red-200">
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
    <section className="revela mt-12 border-t border-neutral-200 pt-10 dark:border-neutral-800" style={{ ["--tarda" as string]: "0.08s" }}>
      <div className="rounded-lg border-l-[3px] border-teal-700 bg-teal-50 p-4 dark:border-teal-400 dark:bg-teal-950/30">
        <p className="font-mono text-[10px] uppercase tracking-wider text-teal-800 dark:text-teal-400">
          Dónde está tu gente
        </p>
        <p className="mt-1.5 text-lg font-semibold leading-snug">
          {BRECHAS[b.brecha] ?? b.brecha}
        </p>
        {NIVELES[b.nivel_dominante] && (
          <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
            {NIVELES[b.nivel_dominante].plano}.
          </p>
        )}
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
        <div className="mt-8 rounded-lg border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900">
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
                className="rounded-lg border border-neutral-200 bg-white p-3 text-sm dark:border-neutral-800 dark:bg-neutral-900"
              >
                <span className="mr-2 font-mono text-[11px] font-bold text-teal-700 dark:text-teal-400">
                  {i + 1}
                </span>
                {q}
              </li>
            ))}
          </ol>
          {b.guion_respuesta.cuando_ofrecer && (
            <p className="mt-3 rounded-lg border-l-2 border-teal-700 bg-neutral-50 p-3 text-sm leading-relaxed dark:border-teal-400 dark:bg-neutral-950">
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
  const router = useRouter();

  // El puente: de la idea a la pieza sin copiar y pegar nada. La salida de una
  // función es la entrada de la siguiente; si hay que copiarla a mano, no es un
  // sistema, son dos herramientas sueltas.
  //
  // La familia la elige él, aquí, el día que le toca. La misma idea sirve para
  // grabarse o para un carrusel, y eso depende del tiempo y las ganas de ese
  // día — no de lo que decidiera el domingo.
  function hacerla(familia: string) {
    try {
      sessionStorage.setItem(
        "cadencia:pieza",
        JSON.stringify({ idea: p.idea, angulo: p.angulo, dia: p.dia, familia }),
      );
    } catch {
      // Sin sessionStorage se llega en blanco, que sigue funcionando.
    }
    router.push("/pieza?de=semana");
  }

  const sugerida = sugerenciaPorAngulo(p.angulo ?? "");
  const pideHistoria = historiaQuePide(p.angulo ?? "");

  return (
    <article className="rounded-lg border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 border-b border-neutral-200 p-4 dark:border-neutral-800">
        <span className="font-mono text-[11px] font-bold uppercase tracking-wider text-teal-700 dark:text-teal-400">
          {p.dia}
        </span>
        <span className="font-mono text-[10px] uppercase tracking-wider text-neutral-500">
          {NIVELES[p.nivel]?.corto ?? p.nivel} → {NIVELES[p.mueve_a]?.corto ?? p.mueve_a}
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

        {pideHistoria && (
          // Se avisa, no se pide. La historia se cuenta en la pantalla de la
          // pieza el día que toca: tenerla que dejar escrita de antemano era
          // trabajo por adelantado para algo que a lo mejor no llega a usar.
          <p className="mt-3 rounded-lg border-l-[3px] border-teal-700 bg-teal-50 p-2.5 text-sm dark:border-teal-400 dark:bg-teal-950/30">
            Este día va con{" "}
            <strong>
              {pideHistoria === "cliente" ? "el caso de un cliente" : "una historia tuya"}
            </strong>
            . No hace falta que la dejes escrita ahora: te la pido al abrirla, en
            dos líneas y con tus palabras.
          </p>
        )}

        <p className="mt-4 font-mono text-[10px] uppercase tracking-wider text-neutral-500">
          ¿Cómo la haces?
        </p>
        <div className="mt-1.5 flex flex-wrap gap-2">
          {(
            [
              ["video", "Video"],
              ["carrusel", "Carrusel"],
            ] as const
          ).map(([id, nombre]) => (
            <button
              key={id}
              onClick={() => hacerla(id)}
              className={`rounded-lg border px-3 py-1.5 text-sm font-semibold transition ${
                sugerida === id
                  ? "border-teal-700 bg-teal-700 text-white hover:bg-teal-800 dark:border-teal-500 dark:bg-teal-600 dark:hover:bg-teal-500"
                  : "border-neutral-300 text-neutral-700 hover:border-teal-700 hover:text-teal-800 dark:border-neutral-700 dark:text-neutral-300 dark:hover:border-teal-400 dark:hover:text-teal-300"
              }`}
            >
              {nombre}
              {sugerida === id && " ·  va bien aquí"}
            </button>
          ))}
        </div>
        <p className="mt-1.5 text-xs text-neutral-500">
          La idea es la misma en los tres. Elige según el día que tengas.
        </p>

        <br />
        <button
          onClick={() => setAbierto(!abierto)}
          className="mt-3 font-mono text-[11px] uppercase tracking-wider text-teal-700 underline underline-offset-4 hover:no-underline dark:text-teal-400"
        >
          {abierto ? "− ocultar la respuesta" : "+ si te escriben por esta"}
        </button>
        {abierto && (
          <p className="mt-2 rounded-lg border-l-2 border-teal-700 bg-neutral-50 p-3 text-sm leading-relaxed dark:border-teal-400 dark:bg-neutral-950">
            {p.apertura_respuesta}
          </p>
        )}
      </div>
    </article>
  );
}
