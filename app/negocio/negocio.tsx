"use client";

import { useEffect, useState } from "react";
import {
  CAMPOS_EXTRA,
  CAMPOS_NUCLEO,
  CAMPO_VOZ,
  negocioListo,
  type Negocio,
} from "@/types/negocio";

/** El negocio en blanco: lo mismo que ve alguien que llega por primera vez. */
export const NEGOCIO_VACIO: Negocio = { oferta: "", cliente: "", despues: "" };

const BORRADOR = "cadencia:negocio";

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
export function leerBorrador(): Negocio | null {
  try {
    const crudo = localStorage.getItem(BORRADOR);
    return crudo ? (JSON.parse(crudo) as Negocio) : null;
  } catch {
    return null;
  }
}

export function guardarBorrador(n: Negocio) {
  try {
    localStorage.setItem(BORRADOR, JSON.stringify(n));
  } catch {
    // Sin espacio o en incógnito: se sigue escribiendo, solo no se recuerda.
  }
}

export function borrarBorrador() {
  try {
    localStorage.removeItem(BORRADOR);
  } catch {
    // Si no se puede borrar, el siguiente guardado lo pisa igual.
  }
}

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
  return {
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
  semilla,
  onSemilla,
}: {
  negocio: Negocio;
  onCambio: (c: Partial<Negocio>) => void;
  guardado: boolean;
  onGuardado: () => void;
  /**
   * El perfil semilla del repositorio. Solo lo ofrece el diagnóstico, que es
   * donde se prueba el sistema: en la pantalla del negocio no pinta nada.
   */
  semilla?: boolean;
  onSemilla?: (v: boolean) => void;
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

  return (
    <div className="rounded-lg border border-neutral-300 bg-white p-4 dark:border-neutral-700 dark:bg-neutral-900">
      {onSemilla && (
        <label className="flex items-center gap-2 text-sm text-neutral-600 dark:text-neutral-400">
          <input
            type="checkbox"
            checked={Boolean(semilla)}
            onChange={(e) => onSemilla(e.target.checked)}
            className="accent-teal-700"
          />
          Usar el perfil de prueba del repositorio
        </label>
      )}

      {semilla ? (
        <p className="text-xs text-amber-700 dark:text-amber-500">
          Con esto marcado, el diagnóstico lee el negocio de{" "}
          <code className="font-mono">perfiles/victor.json</code> — sirve para
          probar el sistema, no para diagnosticar otro negocio.
        </p>
      ) : (
        <div className={`space-y-3 ${onSemilla ? "mt-3" : ""}`}>
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
      )}
    </div>
  );
}
