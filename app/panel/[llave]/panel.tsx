"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { VIP, type Cuenta } from "@/types/panel";
import type { Pagina, Resumen } from "@/lib/panel";

const DIA = new Intl.DateTimeFormat("es", { day: "numeric", month: "short", year: "2-digit" });
const dia = (s: string | null) => (s ? DIA.format(new Date(s)) : "—");
const POR_PAGINA = 25;

/**
 * Las cuentas, en tabla.
 *
 * Antes era una tarjeta por cuenta con el negocio entero desplegado, y con dos
 * cuentas ya llenaba la pantalla. Una pantalla de administración no se lee, se
 * BARRE: lo que hace falta de un vistazo es quién es, qué plan tiene y si está
 * usando esto. Todo eso cabe en una línea.
 *
 * Lo que no cabe —qué vende, a quién, cómo queda: tres párrafos— se abre al
 * pulsar la fila, y solo el de la fila que se abrió.
 *
 * Y se pagina y se busca en el servidor. Traer mil cuentas con su prosa para
 * enseñar veinticinco serían varios megas por carga, y una búsqueda que solo
 * encuentra lo que ya se bajó no es una búsqueda.
 */
export function Panel({
  llave,
  inicial,
  resumen,
  quien,
}: {
  llave: string;
  inicial: Pagina;
  resumen: Resumen | null;
  quien: string;
}) {
  const [pagina, setPagina] = useState(inicial);
  const [p, setP] = useState(0);
  const [busca, setBusca] = useState("");
  const [cargando, setCargando] = useState(false);
  const [abierta, setAbierta] = useState<string | null>(null);
  const [guardando, setGuardando] = useState<string | null>(null);
  const [fallo, setFallo] = useState("");
  /** Para descartar la respuesta de una búsqueda que ya no es la última. */
  const pedido = useRef(0);

  const traer = useCallback(
    async (q: string, cual: number) => {
      const mia = ++pedido.current;
      setCargando(true);
      try {
        const r = await fetch(
          `/api/panel?llave=${encodeURIComponent(llave)}&q=${encodeURIComponent(q)}&p=${cual}`,
        );
        if (!r.ok) throw new Error(r.status === 404 ? "Se cerró la sesión." : "No se pudo leer.");
        const d = (await r.json()) as Pagina;
        // Si mientras tanto salió otra búsqueda, esta respuesta ya no vale:
        // pintarla dejaría la tabla enseñando lo que se escribió hace dos letras.
        if (mia === pedido.current) setPagina(d);
      } catch (e) {
        if (mia === pedido.current) setFallo(e instanceof Error ? e.message : "No se pudo leer.");
      } finally {
        if (mia === pedido.current) setCargando(false);
      }
    },
    [llave],
  );

  // Se espera a que deje de escribir: una consulta por tecla es una consulta
  // por tecla.
  useEffect(() => {
    if (!busca && p === 0 && pedido.current === 0) return;
    const t = setTimeout(() => void traer(busca, p), busca ? 300 : 0);
    return () => clearTimeout(t);
  }, [busca, p, traer]);

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
      setPagina((antes) => ({
        ...antes,
        lista: antes.lista.map((x) =>
          x.id === c.id ? { ...x, cortesia: vip ? VIP : null, cortesia_hasta: null } : x,
        ),
      }));
    } catch (e) {
      setFallo(e instanceof Error ? e.message : "No se pudo guardar.");
    } finally {
      setGuardando(null);
    }
  }

  const { lista, total } = pagina;
  const paginas = Math.max(1, Math.ceil(total / POR_PAGINA));
  const desde = total === 0 ? 0 : p * POR_PAGINA + 1;
  const hasta = Math.min(total, (p + 1) * POR_PAGINA);

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <header className="flex flex-wrap items-end justify-between gap-4 border-b-2 border-neutral-900 pb-5 dark:border-neutral-100">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-teal-700 dark:text-teal-400">
            Panel · {quien}
          </p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight">Las cuentas</h1>
        </div>
        {resumen && (
          <dl className="flex flex-wrap gap-x-7 gap-y-2">
            <Cifra n={resumen.cuentas} que="cuentas" />
            <Cifra n={resumen.con_negocio} que="con negocio" />
            <Cifra n={resumen.vips} que="VIP" destaca />
            <Cifra n={resumen.corridas_mes} que="corridas este mes" />
          </dl>
        )}
      </header>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <input
          value={busca}
          onChange={(e) => {
            setBusca(e.target.value);
            setP(0);
          }}
          placeholder="Buscar por correo, nombre o lo que vende"
          className="min-w-64 flex-1 rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm outline-none focus:border-teal-700 dark:border-neutral-700 dark:bg-neutral-900 dark:focus:border-teal-400"
        />
        <p className="font-mono text-[11px] tabular-nums text-neutral-500">
          {cargando ? "buscando…" : total === 0 ? "nada" : `${desde}–${hasta} de ${total}`}
        </p>
      </div>

      {fallo && (
        <p className="mt-3 rounded-lg border-l-[3px] border-red-700 bg-red-50 p-3 text-sm text-red-900 dark:bg-red-950/40 dark:text-red-200">
          {fallo}
        </p>
      )}

      <div className="mt-4 overflow-x-auto rounded-lg border border-neutral-200 dark:border-neutral-800">
        <table className="w-full min-w-200 border-collapse text-sm">
          <thead>
            <tr className="border-b border-neutral-200 bg-neutral-50 text-left font-mono text-[10px] uppercase tracking-wider text-neutral-500 dark:border-neutral-800 dark:bg-neutral-900/60">
              <Th>Cuenta</Th>
              <Th>Plan</Th>
              <Th derecha>Mes</Th>
              <Th derecha>Total</Th>
              <Th derecha>Piezas</Th>
              <Th>Última</Th>
              <Th>Alta</Th>
              <Th />
            </tr>
          </thead>
          <tbody>
            {lista.map((c) => {
              const esVip = c.cortesia === VIP;
              const ve = abierta === c.id;
              return (
                <Fragmento key={c.id}>
                  <tr
                    onClick={() => setAbierta(ve ? null : c.id)}
                    className={`cursor-pointer border-b border-neutral-100 transition-colors last:border-0 dark:border-neutral-900 ${
                      ve
                        ? "bg-neutral-50 dark:bg-neutral-900/60"
                        : "hover:bg-neutral-50 dark:hover:bg-neutral-900/40"
                    }`}
                  >
                    <td className="px-3 py-2">
                      <span className="flex items-baseline gap-2">
                        <span
                          aria-hidden
                          className={`font-mono text-[9px] text-neutral-400 transition-transform ${ve ? "rotate-90" : ""}`}
                        >
                          ▶
                        </span>
                        <span className="font-medium">{c.email}</span>
                        {c.nombre && (
                          <span className="hidden truncate text-xs text-neutral-500 sm:inline">
                            {c.nombre}
                          </span>
                        )}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      {esVip ? (
                        <Etiqueta texto="VIP" tono="teal" />
                      ) : (
                        <Etiqueta texto={c.plan} tono={c.plan === "prueba" ? "gris" : "ambar"} />
                      )}
                    </td>
                    <Td derecha>{c.corridas_mes}</Td>
                    <Td derecha apagado>{c.corridas_total}</Td>
                    <Td derecha apagado>{c.entregados}</Td>
                    <Td apagado>{dia(c.ultima)}</Td>
                    <Td apagado>{dia(c.creado)}</Td>
                    <td className="px-3 py-2 text-right">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          void cambiar(c, !esVip);
                        }}
                        disabled={guardando === c.id}
                        className={`empuja whitespace-nowrap rounded-full px-3 py-1 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-40 ${
                          esVip
                            ? "border border-neutral-300 text-neutral-600 hover:bg-neutral-100 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800"
                            : "bg-teal-700 text-white dark:bg-teal-600"
                        }`}
                      >
                        {guardando === c.id ? "…" : esVip ? "Quitar VIP" : "Hacer VIP"}
                      </button>
                    </td>
                  </tr>

                  {ve && (
                    <tr className="border-b border-neutral-100 bg-neutral-50 dark:border-neutral-900 dark:bg-neutral-900/60">
                      <td colSpan={8} className="px-3 pb-4 pt-1">
                        {c.negocio_id ? (
                          <dl className="grid gap-x-8 gap-y-3 sm:grid-cols-3">
                            <Dato que="vende" valor={c.oferta} />
                            <Dato que="a quién" valor={c.cliente} />
                            <Dato que="cómo queda" valor={c.despues} />
                          </dl>
                        ) : (
                          <p className="text-sm text-neutral-500">
                            Todavía no ha llenado su negocio.
                          </p>
                        )}
                        <p className="mt-3 font-mono text-[10px] uppercase tracking-wider text-neutral-500">
                          {esVip
                            ? `VIP de cortesía · debajo tiene ${c.plan}`
                            : c.cortesia
                              ? `cortesía: ${c.cortesia} · debajo tiene ${c.plan}`
                              : `plan ${c.plan}`}
                        </p>
                      </td>
                    </tr>
                  )}
                </Fragmento>
              );
            })}
            {lista.length === 0 && (
              <tr>
                <td colSpan={8} className="px-3 py-8 text-center text-sm text-neutral-500">
                  {busca ? "Nada con eso." : "Todavía no hay cuentas."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {paginas > 1 && (
        <div className="mt-4 flex items-center justify-between gap-3">
          <Paso texto="← Anteriores" a={p - 1} actual={p} tope={paginas} ir={setP} />
          <p className="font-mono text-[11px] tabular-nums text-neutral-500">
            página {p + 1} de {paginas}
          </p>
          <Paso texto="Siguientes →" a={p + 1} actual={p} tope={paginas} ir={setP} />
        </div>
      )}
    </main>
  );
}

/** `<>` no acepta key en un map de dos filas; esto sí. */
function Fragmento({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

function Paso({
  texto,
  a,
  actual,
  tope,
  ir,
}: {
  texto: string;
  a: number;
  actual: number;
  tope: number;
  ir: (n: number) => void;
}) {
  const puede = a >= 0 && a < tope && a !== actual;
  return (
    <button
      onClick={() => puede && ir(a)}
      disabled={!puede}
      className="empuja rounded-full border border-neutral-300 px-4 py-1.5 text-sm font-semibold transition hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-30 dark:border-neutral-700 dark:hover:bg-neutral-800"
    >
      {texto}
    </button>
  );
}

function Th({ children, derecha }: { children?: React.ReactNode; derecha?: boolean }) {
  return (
    <th className={`px-3 py-2 font-normal ${derecha ? "text-right" : ""}`}>{children}</th>
  );
}

function Td({
  children,
  derecha,
  apagado,
}: {
  children: React.ReactNode;
  derecha?: boolean;
  apagado?: boolean;
}) {
  return (
    <td
      className={`whitespace-nowrap px-3 py-2 font-mono text-[11px] tabular-nums ${
        derecha ? "text-right" : ""
      } ${apagado ? "text-neutral-500" : ""}`}
    >
      {children}
    </td>
  );
}

function Cifra({ n, que, destaca }: { n: number; que: string; destaca?: boolean }) {
  return (
    <div>
      <dt className="sr-only">{que}</dt>
      <dd
        className={`text-xl font-bold tabular-nums leading-none ${
          destaca && n > 0 ? "text-teal-700 dark:text-teal-400" : ""
        }`}
      >
        {n}
      </dd>
      <p className="mt-0.5 font-mono text-[10px] uppercase tracking-wider text-neutral-500">
        {que}
      </p>
    </div>
  );
}

function Dato({ que, valor }: { que: string; valor: string | null }) {
  return (
    <div>
      <dt className="font-mono text-[10px] uppercase tracking-wider text-neutral-500">{que}</dt>
      <dd className="mt-1 text-sm leading-relaxed">
        {valor?.trim() || <span className="text-neutral-400">—</span>}
      </dd>
    </div>
  );
}

function Etiqueta({ texto, tono }: { texto: string; tono: "teal" | "ambar" | "gris" }) {
  const colores = {
    teal: "bg-teal-100 text-teal-900 dark:bg-teal-950 dark:text-teal-300",
    ambar: "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-300",
    gris: "bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300",
  };
  return (
    <span
      className={`whitespace-nowrap rounded-full px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider ${colores[tono]}`}
    >
      {texto}
    </span>
  );
}
