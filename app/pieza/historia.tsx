"use client";

import { useState } from "react";
import { COMO_PEDIRLA, type Historia, type QuienCuenta } from "@/types/banco";

/**
 * La historia, contada por él y ordenada por el sistema.
 *
 * Existe porque los días de "historia personal" y "prueba social" salían mal
 * de las dos formas posibles: o el sistema fabricaba una historia verosímil
 * —y una historia fabricada se nota al contarla en cámara—, o le dejaba una
 * nota pidiéndole que dejara sus casos escritos en el perfil. Lo segundo es
 * peor: es trabajo por adelantado para algo que a lo mejor no usa, y al que
 * llega de internet a probar la herramienta le pone un formulario delante
 * antes de enseñarle nada.
 *
 * Aquí se le pide el día que hace falta, en dos líneas, como se la contaría a
 * un amigo. Lo que el botón hace es ordenar y apretar: no añade un solo dato
 * que él no haya escrito, y dice en qué tocó para que pueda deshacerlo.
 */
export function Contarla({
  quien,
  idea,
  angulo,
  valor,
  alCambiar,
}: {
  quien: QuienCuenta;
  idea: string;
  angulo: string;
  /** El texto que se va a usar para escribir la pieza. */
  valor: string;
  alCambiar: (texto: string) => void;
}) {
  const copia = COMO_PEDIRLA[quien];
  /** Lo que escribió él, intacto. Nunca se pisa: es a donde puede volver. */
  const [mia, setMia] = useState("");
  const [salida, setSalida] = useState<Historia | null>(null);
  const [puliendo, setPuliendo] = useState(false);
  const [error, setError] = useState("");
  /** Cuál de las dos se está usando. La suya manda mientras no pula. */
  const usandoLaSuya = !salida || valor === mia;

  async function pulir() {
    setPuliendo(true);
    setError("");
    try {
      const r = await fetch("/api/historia", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ crudo: mia, quien, idea, angulo }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error ?? "No se pudo.");
      const h = d.historia as Historia;
      setSalida(h);
      // Si no dio para una historia, se queda la suya y lo que se le enseña
      // son las preguntas: devolverle un hueco sería peor que no tocar nada.
      if (h.historia?.trim()) alCambiar(h.historia.trim());
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo ordenar la historia.");
    } finally {
      setPuliendo(false);
    }
  }

  return (
    <section className="revela mt-10" style={{ ["--tarda" as string]: "0.06s" }}>
      <h2 className="font-mono text-[11px] uppercase tracking-[0.12em] text-neutral-500">
        2b · Tu historia
      </h2>
      <div className="mt-2 rounded-lg border-l-[3px] border-teal-700 bg-teal-50 p-4 dark:border-teal-400 dark:bg-teal-950/30">
        <p className="font-semibold">{copia.titulo}</p>
        <p className="mt-1 text-sm leading-relaxed text-neutral-700 dark:text-neutral-300">
          {copia.pista}
        </p>
        <p className="mt-2 text-sm leading-relaxed text-neutral-600 dark:text-neutral-400">
          {copia.ejemplo}
        </p>
      </div>

      <textarea
        value={mia}
        onChange={(e) => {
          setMia(e.target.value);
          // Mientras no pula, lo que se usa es lo suyo tal cual. Así, si se
          // salta el botón, la pieza se escribe igual con su material.
          if (usandoLaSuya) alCambiar(e.target.value);
        }}
        rows={6}
        placeholder="Cuéntala aquí. Como te salga."
        className="mt-3 w-full rounded-lg border border-neutral-300 bg-white p-3 text-sm leading-relaxed outline-none focus:border-teal-700 dark:border-neutral-700 dark:bg-neutral-900 dark:focus:border-teal-400"
      />

      <div className="mt-2 flex flex-wrap items-center gap-3">
        <button
          onClick={() => void pulir()}
          disabled={mia.trim().length < 25 || puliendo}
          className="empuja rounded-full border border-teal-700 px-4 py-2 text-sm font-semibold text-teal-800 transition hover:bg-teal-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-teal-400 dark:text-teal-300 dark:hover:bg-teal-950/40"
        >
          {puliendo ? "Ordenándola…" : salida ? "Volver a ordenarla" : "Ordenarla con la IA"}
        </button>
        <p className="text-xs text-neutral-500">
          No inventa nada: ordena, aprieta y te deja tus palabras. No gasta corrida.
        </p>
      </div>

      {error && (
        <p className="mt-3 rounded-lg border-l-[3px] border-red-700 bg-red-50 p-3 text-sm text-red-900 dark:bg-red-950/40 dark:text-red-200">
          {error}
        </p>
      )}

      {salida && (
        <div className="mt-4 rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
          {salida.historia?.trim() ? (
            <>
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="font-mono text-[10px] uppercase tracking-wider text-neutral-500">
                  {usandoLaSuya ? "Ordenada — no se está usando" : "Ordenada — es la que se usa"}
                </p>
                <button
                  onClick={() =>
                    alCambiar(usandoLaSuya ? salida.historia.trim() : mia)
                  }
                  className="font-mono text-[10px] uppercase tracking-wider text-teal-700 underline underline-offset-4 dark:text-teal-400"
                >
                  {usandoLaSuya ? "usar esta" : "volver a la mía"}
                </button>
              </div>
              <textarea
                value={usandoLaSuya ? salida.historia : valor}
                onChange={(e) => {
                  // Editable: la última palabra sobre su historia es suya.
                  setSalida({ ...salida, historia: e.target.value });
                  if (!usandoLaSuya) alCambiar(e.target.value);
                }}
                rows={6}
                className="mt-2 w-full rounded-lg border border-neutral-300 bg-white p-3 text-sm leading-relaxed outline-none focus:border-teal-700 dark:border-neutral-700 dark:bg-neutral-900 dark:focus:border-teal-400"
              />
            </>
          ) : (
            <p className="text-sm text-neutral-700 dark:text-neutral-300">
              Con eso todavía no hay historia que ordenar. Contéstame lo de
              abajo dentro del recuadro de arriba y vuelve a darle.
            </p>
          )}

          <Lista
            titulo="Qué toqué"
            items={salida.que_hice}
            vacio="Nada: estaba ya como para contarla."
          />
          <Lista
            titulo="Lo que solo puedes contestar tú"
            items={salida.que_falta}
            vacio=""
          />
          <Lista titulo="Lo que no pude saber" items={salida.limites} vacio="" />
        </div>
      )}
    </section>
  );
}

function Lista({
  titulo,
  items,
  vacio,
}: {
  titulo: string;
  items?: string[];
  vacio: string;
}) {
  const hay = (items ?? []).filter((t) => t?.trim());
  if (!hay.length && !vacio) return null;
  return (
    <div className="mt-4">
      <p className="font-mono text-[10px] uppercase tracking-wider text-neutral-500">{titulo}</p>
      {hay.length ? (
        <ul className="mt-1 space-y-1">
          {hay.map((t, i) => (
            <li key={i} className="text-sm leading-snug text-neutral-700 dark:text-neutral-300">
              · {t}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-1 text-sm text-neutral-500">{vacio}</p>
      )}
    </div>
  );
}
