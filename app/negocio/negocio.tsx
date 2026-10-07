"use client";

import { borrar, guardar, leer } from "@/lib/guardado";
import { useEffect, useState } from "react";
import {
  CAMPOS_EXTRA,
  CAMPOS_NUCLEO,
  CAMPO_VOZ,
  TIPOS,
  etiquetaNombre,
  negocioListo,
  pistaNombre,
  type Negocio,
  type TipoNegocio,
} from "@/types/negocio";

/** El negocio en blanco: lo mismo que ve alguien que llega por primera vez. */
export const NEGOCIO_VACIO: Negocio = {
  tipo: "",
  nombre: "",
  oferta: "",
  cliente: "",
  despues: "",
};

const BORRADOR = "negocio";

/**
 * Lo que está escrito y sin guardar.
 *
 * Existe porque sin esto se perdía: escribías media oferta, te ibas a la
 * semana, volvías, y el campo había vuelto solo a la versión vieja del
 * servidor. Parecía que no guardaba — y en realidad es que nunca llegó a
 * guardarse, y encima lo tapaba con lo de antes.
 *
 * **El borrador gana sobre lo del servidor** mientras exista. Se borra al
 * guardar, que es el único momento en que lo del servidor ya es lo suyo.
 */
export const leerBorrador = (de: string | undefined) => leer<Negocio>(BORRADOR, de);
export const guardarBorrador = (de: string | undefined, n: Negocio) => guardar(BORRADOR, de, n);
export const borrarBorrador = (de: string | undefined) => borrar(BORRADOR, de);

/**
 * Avisa antes de cerrar la pestaña con algo escrito y sin guardar.
 *
 * El borrador ya lo recupera todo, pero un aviso del propio navegador es la
 * única forma de parar a alguien que está a punto de cerrar sin darse cuenta.
 */
export function useAvisarSinGuardar(hay: boolean) {
  useEffect(() => {
    if (!hay) return;
    const avisar = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", avisar);
    return () => window.removeEventListener("beforeunload", avisar);
  }, [hay]);
}

/** ¿Hay algo escrito de verdad? Un borrador todo en blanco no es un borrador. */
export function tieneAlgo(n: Negocio | null): boolean {
  return Boolean(
    n && Object.values(n).some((v) => typeof v === "string" && v.trim().length > 0),
  );
}

/**
 * Lo que devuelve /api/negocio, ya normalizado a cadenas. La base guarda null
 * en lo opcional y un textarea con value={null} deja de ser controlado.
 */
export function desdeBase(n: Record<string, unknown>): Negocio {
  const t = (v: unknown) => (typeof v === "string" ? v : "");
  const tipo = t(n.tipo);
  return {
    tipo: (tipo === "empresa" || tipo === "persona" ? tipo : "") as TipoNegocio,
    nombre: t(n.nombre),
    oferta: t(n.oferta),
    cliente: t(n.cliente),
    despues: t(n.despues),
    freno: t(n.freno),
    accion: t(n.accion),
    voz: t(n.voz),
    senales: t(n.senales),
  };
}

export function BloqueNegocio({
  negocio,
  onCambio,
  guardado,
  onGuardado,
}: {
  negocio: Negocio;
  onCambio: (c: Partial<Negocio>) => void;
  guardado: boolean;
  onGuardado: () => void;
}) {
  const [abierto, setAbierto] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [fallo, setFallo] = useState("");

  async function guardar() {
    setGuardando(true);
    setFallo("");
    try {
      const r = await fetch("/api/negocio", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(negocio),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error ?? "No se pudo guardar.");
      onGuardado();
    } catch (e) {
      setFallo(e instanceof Error ? e.message : "No se pudo guardar.");
    } finally {
      setGuardando(false);
    }
  }

  const falta = [
    !negocio.tipo && "decir si es una empresa o eres tú",
    !negocio.nombre?.trim() && etiquetaNombre(negocio.tipo).toLowerCase(),
    ...CAMPOS_NUCLEO.filter((c) => !negocio[c.id]?.trim()).map((c) =>
      c.etiqueta.toLowerCase(),
    ),
  ].filter((x): x is string => Boolean(x));

  return (
    <div className="rounded-lg border border-neutral-300 bg-white p-4 dark:border-neutral-700 dark:bg-neutral-900">
      <div className="space-y-3">
          {/*
            Quién es, antes de qué vende.
            El diagnóstico juzga el nombre del perfil como su primer punto, y
            ese juicio es distinto según el caso: una empresa ya tiene nombre
            registrado y lo que se corrige es lo que va al lado; una marca
            personal se llama como su dueño y ahí el arreglo sí es el nombre.
            Hasta ahora no se preguntaba, así que corregía a ciegas.
          */}
          <fieldset>
            <legend className="font-mono text-[10px] uppercase tracking-wider text-neutral-500">
              Tu negocio es
            </legend>
            <div className="mt-1.5 flex flex-wrap gap-2">
              {TIPOS.map((t) => {
                const puesto = negocio.tipo === t.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    aria-pressed={puesto}
                    onClick={() => onCambio({ tipo: t.id })}
                    title={t.pista}
                    className={`empuja rounded-full border px-3.5 py-1.5 text-sm transition ${
                      puesto
                        ? "border-teal-700 bg-teal-50 font-semibold text-teal-800 dark:border-teal-400 dark:bg-teal-950/40 dark:text-teal-300"
                        : "border-neutral-300 text-neutral-600 hover:border-teal-700 dark:border-neutral-700 dark:text-neutral-400 dark:hover:border-teal-400"
                    }`}
                  >
                    {t.etiqueta}
                  </button>
                );
              })}
            </div>
            <p className="mt-1.5 text-xs text-neutral-500">
              {TIPOS.find((t) => t.id === negocio.tipo)?.pista ??
                "Cambia lo que el diagnóstico te puede corregir del nombre."}
            </p>
          </fieldset>

          <div>
            <label
              htmlFor="nombre"
              className="font-mono text-[10px] uppercase tracking-wider text-neutral-500"
            >
              {etiquetaNombre(negocio.tipo)}
            </label>
            <input
              id="nombre"
              type="text"
              value={negocio.nombre ?? ""}
              onChange={(e) => onCambio({ nombre: e.target.value })}
              placeholder={pistaNombre(negocio.tipo)}
              className="mt-1 w-full rounded-lg border border-neutral-300 bg-neutral-50 p-2 text-sm outline-none focus:border-teal-700 dark:border-neutral-700 dark:bg-neutral-950 dark:focus:border-teal-400"
            />
          </div>

          {CAMPOS_NUCLEO.map((c) => (
            <div key={c.id}>
              <label
                htmlFor={c.id}
                className="font-mono text-[10px] uppercase tracking-wider text-neutral-500"
              >
                {c.etiqueta}
              </label>
              <textarea
                id={c.id}
                value={negocio[c.id] ?? ""}
                onChange={(e) => onCambio({ [c.id]: e.target.value })}
                rows={c.filas}
                placeholder={c.pista}
                className="mt-1 w-full rounded-lg border border-neutral-300 bg-neutral-50 p-2 text-sm leading-relaxed outline-none focus:border-teal-700 dark:border-neutral-700 dark:bg-neutral-950 dark:focus:border-teal-400"
              />
            </div>
          ))}

          <div className="rounded-lg border border-neutral-300 bg-neutral-50 p-3 dark:border-neutral-700 dark:bg-neutral-950">
            <label
              htmlFor={CAMPO_VOZ.id}
              className="font-mono text-[10px] uppercase tracking-wider text-neutral-500"
            >
              {CAMPO_VOZ.etiqueta}
            </label>
            <p className="mb-1.5 mt-0.5 text-sm text-neutral-600 dark:text-neutral-400">
              {CAMPO_VOZ.pista}.
            </p>
            <p className="mb-2 text-xs text-amber-700 dark:text-amber-500">
              El diagnóstico funciona sin esto, pero sale en español llano.{" "}
              <strong>El guion no se escribe sin esto</strong> — es lo que hace que
              suene a ti y no a cualquiera.
            </p>
            <textarea
              id={CAMPO_VOZ.id}
              value={negocio.voz ?? ""}
              onChange={(e) => onCambio({ voz: e.target.value })}
              rows={CAMPO_VOZ.filas}
              className="w-full rounded-lg border border-neutral-300 bg-white p-2 text-sm leading-relaxed outline-none focus:border-teal-700 dark:border-neutral-700 dark:bg-neutral-900 dark:focus:border-teal-400"
            />
          </div>

          <button
            onClick={() => setAbierto(!abierto)}
            className="font-mono text-[11px] uppercase tracking-wider text-teal-700 underline underline-offset-4 hover:no-underline dark:text-teal-400"
          >
            {abierto ? "− ocultar lo opcional" : "+ afinar más (opcional)"}
          </button>

          {abierto &&
            CAMPOS_EXTRA.map((c) => (
              <div key={c.id}>
                <label
                  htmlFor={c.id}
                  className="font-mono text-[10px] uppercase tracking-wider text-neutral-500"
                >
                  {c.etiqueta}
                </label>
                <textarea
                  id={c.id}
                  value={negocio[c.id] ?? ""}
                  onChange={(e) => onCambio({ [c.id]: e.target.value })}
                  rows={c.filas}
                  placeholder={c.pista}
                  className="mt-1 w-full rounded-lg border border-neutral-300 bg-neutral-50 p-2 text-sm leading-relaxed outline-none focus:border-teal-700 dark:border-neutral-700 dark:bg-neutral-950 dark:focus:border-teal-400"
                />
              </div>
            ))}

          {/*
            Qué falta, por su nombre. Un botón apagado sin decir por qué deja
            a la gente tocándolo: ya pasó con el de la pieza.
          */}
          {falta.length > 0 && (
            <p className="text-xs text-amber-700 dark:text-amber-500">
              Falta {falta.join(", ")}.
            </p>
          )}

          <div className="flex flex-wrap items-center gap-3 pt-1">
            <button
              onClick={guardar}
              disabled={guardando || guardado || !negocioListo(negocio)}
              className="empuja rounded-lg border border-teal-700 px-4 py-2 font-semibold text-teal-700 transition hover:bg-teal-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-teal-400 dark:text-teal-400 dark:hover:bg-teal-950/40"
            >
              {guardando ? "Guardando…" : guardado ? "Guardado" : "Guardar mi negocio"}
            </button>
            {guardado && (
              <span className="text-xs text-neutral-500">
                Se llena una vez. La próxima visita ya está aquí.
              </span>
            )}
          </div>
          {fallo && <p className="text-xs text-red-700 dark:text-red-400">{fallo}</p>}
      </div>
    </div>
  );
}
