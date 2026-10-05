"use client";

import { useMemo, useState } from "react";
import { VIP, type Cuenta } from "@/types/panel";

const FECHA = new Intl.DateTimeFormat("es", { day: "numeric", month: "short", year: "2-digit" });
const fecha = (s: string | null) => (s ? FECHA.format(new Date(s)) : "—");

/**
 * Lo que el panel deja hacer: mirar, y regalar o retirar el VIP.
 *
 * Nada más. No borra cuentas, no edita negocios, no abre guiones. Un panel que
 * lo puede todo es un panel del que hay que fiarse siempre; uno que hace dos
 * cosas se audita de un vistazo.
 */
export function Panel({
  llave,
  lista,
  quien,
}: {
  llave: string;
  lista: Cuenta[];
  quien: string;
}) {
  const [cuentas, setCuentas] = useState(lista);
  const [buscando, setBuscando] = useState("");
  const [guardando, setGuardando] = useState<string | null>(null);
  const [fallo, setFallo] = useState("");

  const vistas = useMemo(() => {
    const q = buscando.trim().toLowerCase();
    if (!q) return cuentas;
    return cuentas.filter((c) =>
      [c.email, c.nombre, c.negocio_nombre, c.oferta].some((t) =>
        (t ?? "").toLowerCase().includes(q),
      ),
    );
  }, [cuentas, buscando]);

  const vips = cuentas.filter((c) => c.cortesia === VIP).length;
  const conNegocio = cuentas.filter((c) => c.negocio_id).length;

  async function cambiar(c: Cuenta, vip: boolean) {
    setGuardando(c.id);
    setFallo("");
    try {
      const r = await fetch("/api/panel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ llave, usuarioId: c.id, vip }),
      });
      if (!r.ok) throw new Error(r.status === 404 ? "Se cerró la sesión." : "No se pudo guardar.");
      setCuentas((antes) =>
        antes.map((x) =>
          x.id === c.id ? { ...x, cortesia: vip ? VIP : null, cortesia_hasta: null } : x,
        ),
      );
    } catch (e) {
      setFallo(e instanceof Error ? e.message : "No se pudo guardar.");
    } finally {
      setGuardando(null);
    }
  }

  return (
    <main className="mx-auto max-w-6xl px-6 py-12">
      <header className="border-b-2 border-neutral-900 pb-6 dark:border-neutral-100">
        <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-teal-700 dark:text-teal-400">
          Panel · {quien}
        </p>
        <h1 className="mt-3 text-4xl font-bold tracking-tight">Las cuentas</h1>
        <p className="mt-3 max-w-2xl text-sm text-neutral-600 dark:text-neutral-400">
          Desde aquí solo se mira y se regala el VIP. No se borra nada, no se
          edita ningún negocio y no se abre ningún guion.
        </p>
      </header>

      <section className="mt-7 grid gap-px overflow-hidden rounded-lg border border-neutral-200 bg-neutral-200 grid-cols-2 sm:grid-cols-4 dark:border-neutral-800 dark:bg-neutral-800">
        <Cifra n={cuentas.length} que="cuentas" />
        <Cifra n={conNegocio} que="con su negocio lleno" />
        <Cifra n={vips} que={vips === 1 ? "VIP" : "VIP"} />
        <Cifra
          n={cuentas.reduce((a, c) => a + c.corridas_mes, 0)}
          que="corridas este mes"
        />
      </section>

      <input
        value={buscando}
        onChange={(e) => setBuscando(e.target.value)}
        placeholder="Buscar por correo, nombre o lo que vende"
        className="mt-6 w-full rounded-lg border border-neutral-300 bg-white p-2.5 text-sm outline-none focus:border-teal-700 dark:border-neutral-700 dark:bg-neutral-900 dark:focus:border-teal-400"
      />

      {fallo && (
        <p className="mt-3 rounded-lg border-l-[3px] border-red-700 bg-red-50 p-3 text-sm text-red-900 dark:bg-red-950/40 dark:text-red-200">
          {fallo}
        </p>
      )}

      <ul className="mt-4 space-y-3">
        {vistas.map((c) => {
          const esVip = c.cortesia === VIP;
          return (
            <li
              key={c.id}
              className={`rounded-lg border p-4 ${
                esVip
                  ? "border-teal-600 bg-teal-50/50 dark:border-teal-400/50 dark:bg-teal-950/20"
                  : "border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900"
              }`}
            >
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <span className="font-semibold">{c.email}</span>
                {c.nombre && <span className="text-sm text-neutral-500">{c.nombre}</span>}
                <span className="ml-auto font-mono text-[11px] text-neutral-500">
                  alta {fecha(c.creado)}
                </span>
              </div>

              <div className="mt-2 flex flex-wrap items-center gap-2">
                <Etiqueta
                  texto={esVip ? "VIP" : c.plan}
                  tono={esVip ? "teal" : c.plan === "prueba" ? "gris" : "ambar"}
                />
                {c.cortesia && !esVip && (
                  <Etiqueta texto={`cortesía: ${c.cortesia}`} tono="ambar" />
                )}
                {esVip && c.plan !== "prueba" && (
                  <span className="font-mono text-[10px] uppercase tracking-wider text-neutral-500">
                    debajo tiene {c.plan}
                  </span>
                )}
                <span className="font-mono text-[11px] tabular-nums text-neutral-500">
                  {c.corridas_mes} este mes · {c.corridas_total} en total ·{" "}
                  {c.entregados} {c.entregados === 1 ? "pieza bajada" : "piezas bajadas"} ·
                  última {fecha(c.ultima)}
                </span>
              </div>

              {c.negocio_id ? (
                <dl className="mt-3 grid gap-x-6 gap-y-1.5 text-sm sm:grid-cols-3">
                  <Dato que="vende" valor={c.oferta} />
                  <Dato que="a quién" valor={c.cliente} />
                  <Dato que="cómo queda" valor={c.despues} />
                </dl>
              ) : (
                <p className="mt-3 text-sm text-neutral-500">
                  Todavía no ha llenado su negocio.
                </p>
              )}

              <div className="mt-3 flex flex-wrap items-center gap-3">
                <button
                  onClick={() => void cambiar(c, !esVip)}
                  disabled={guardando === c.id}
                  className={`empuja rounded-full px-4 py-1.5 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-40 ${
                    esVip
                      ? "border border-neutral-300 text-neutral-700 hover:bg-neutral-100 dark:border-neutral-700 dark:text-neutral-200 dark:hover:bg-neutral-800"
                      : "bg-teal-700 text-white dark:bg-teal-600"
                  }`}
                >
                  {guardando === c.id
                    ? "Guardando…"
                    : esVip
                      ? "Quitarle el VIP"
                      : "Hacerlo VIP"}
                </button>
                <span className="text-xs text-neutral-500">
                  {esVip
                    ? `Se queda como estaba: vuelve a su plan ${c.plan}.`
                    : "Corridas y plan sin límite, sin caducidad."}
                </span>
              </div>
            </li>
          );
        })}
        {vistas.length === 0 && (
          <li className="rounded-lg border border-dashed border-neutral-300 p-6 text-sm text-neutral-500 dark:border-neutral-700">
            {cuentas.length === 0 ? "Todavía no hay cuentas." : "Nada con eso."}
          </li>
        )}
      </ul>
    </main>
  );
}

function Cifra({ n, que }: { n: number; que: string }) {
  return (
    <div className="bg-[var(--background)] p-4">
      <p className="text-2xl font-bold tabular-nums tracking-tight">{n}</p>
      <p className="mt-0.5 text-sm text-neutral-500">{que}</p>
    </div>
  );
}

function Dato({ que, valor }: { que: string; valor: string | null }) {
  return (
    <div>
      <dt className="font-mono text-[10px] uppercase tracking-wider text-neutral-500">{que}</dt>
      <dd className="mt-0.5 leading-snug">{valor?.trim() || <span className="text-neutral-400">—</span>}</dd>
    </div>
  );
}

function Etiqueta({ texto, tono }: { texto: string; tono: "teal" | "ambar" | "gris" }) {
  const colores = {
    teal: "bg-teal-100 text-teal-900 dark:bg-teal-950 dark:text-teal-300",
    ambar: "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-300",
    gris: "bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300",
  };
  return (
    <span
      className={`rounded-full px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider ${colores[tono]}`}
    >
      {texto}
    </span>
  );
}
