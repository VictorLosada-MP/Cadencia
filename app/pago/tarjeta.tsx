"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type Aceptacion = { token: string; enlace: string; datos: string; datosEnlace: string };

/**
 * El formulario de la tarjeta.
 *
 * Lo importante está en una línea: `fetch` va **directo a Wompi**, no a
 * Cadencia. El número de la tarjeta sale del navegador hacia ellos y no pasa
 * por este servidor, no entra en ningún registro y no queda en la base. Lo
 * único que vuelve aquí es un token, que sin la clave privada de Wompi no sirve
 * para cobrar nada.
 *
 * Por eso la clave pública se manda al navegador: Wompi la declara segura para
 * el cliente y es justo para esto. La privada no sale del servidor.
 */
export function Tarjeta({
  plan,
  nombre,
  precio,
  cerrar,
}: {
  plan: string;
  nombre: string;
  precio: string;
  cerrar: () => void;
}) {
  const [publica, setPublica] = useState("");
  const [permisos, setPermisos] = useState<Aceptacion | null>(null);
  const [acepta, setAcepta] = useState(false);
  const [numero, setNumero] = useState("");
  const [vence, setVence] = useState("");
  const [cvc, setCvc] = useState("");
  const [titular, setTitular] = useState("");
  const [yendo, setYendo] = useState(false);
  const [fallo, setFallo] = useState("");
  const router = useRouter();

  useEffect(() => {
    let vivo = true;
    fetch("/api/pago/aceptacion")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("no"))))
      .then((d) => {
        if (!vivo) return;
        setPublica(d.publica);
        setPermisos(d.aceptacion);
      })
      .catch(() => vivo && setFallo("No se pudieron cargar los términos. Recarga."));
    return () => {
      vivo = false;
    };
  }, []);

  const digitos = numero.replace(/\D/g, "");
  const [mes, anio] = vence.split("/").map((x) => x?.trim() ?? "");
  const listo =
    acepta &&
    permisos?.token &&
    digitos.length >= 13 &&
    mes?.length === 2 &&
    anio?.length === 2 &&
    cvc.length >= 3 &&
    titular.trim().length > 2;

  async function pagar() {
    if (!listo || !permisos) return;
    setYendo(true);
    setFallo("");
    try {
      // ── Directo a Wompi. La tarjeta no toca el servidor de Cadencia. ──
      const base = publica.startsWith("pub_test_")
        ? "https://api-sandbox.co.uat.wompi.dev/v1"
        : "https://production.wompi.co/v1";
      const t = await fetch(`${base}/tokens/cards`, {
        method: "POST",
        headers: { Authorization: `Bearer ${publica}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          number: digitos,
          cvc,
          exp_month: mes,
          exp_year: anio,
          card_holder: titular.trim(),
        }),
      });
      const td = await t.json();
      if (!t.ok || !td?.data?.id) {
        throw new Error(
          td?.error?.messages
            ? "Revisa los datos de la tarjeta."
            : "No se pudo validar la tarjeta.",
        );
      }

      const r = await fetch("/api/pago/suscribir", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          plan,
          token: td.data.id,
          aceptacion: permisos.token,
          datos: permisos.datos || undefined,
        }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error ?? "No se pudo.");
      router.push("/pago");
      router.refresh();
    } catch (e) {
      setFallo(e instanceof Error ? e.message : "No se pudo.");
      setYendo(false);
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Pagar ${nombre}`}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-5"
      onClick={cerrar}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="max-h-full w-full max-w-md overflow-y-auto rounded-xl bg-[var(--background)] p-6 shadow-2xl"
      >
        <p className="font-mono text-[10px] uppercase tracking-wider text-teal-700 dark:text-teal-400">
          Plan {nombre}
        </p>
        <h2 className="mt-1 text-2xl font-bold tracking-tight">{precio} al mes</h2>
        <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
          Se cobra hoy y luego cada mes. Puedes apagar la renovación cuando
          quieras desde tu plan, y el mes que pagaste se queda hasta su fecha.
        </p>

        <div className="mt-5 space-y-3">
          <Campo
            etiqueta="Número de la tarjeta"
            valor={numero}
            alCambiar={(v) => setNumero(v.replace(/[^\d ]/g, "").slice(0, 23))}
            modo="numeric"
            auto="cc-number"
            marcador="4242 4242 4242 4242"
          />
          <div className="grid grid-cols-2 gap-3">
            <Campo
              etiqueta="Vence"
              valor={vence}
              alCambiar={(v) => setVence(v.replace(/[^\d/]/g, "").slice(0, 5))}
              modo="numeric"
              auto="cc-exp"
              marcador="08/28"
            />
            <Campo
              etiqueta="CVC"
              valor={cvc}
              alCambiar={(v) => setCvc(v.replace(/\D/g, "").slice(0, 4))}
              modo="numeric"
              auto="cc-csc"
              marcador="123"
            />
          </div>
          <Campo
            etiqueta="Quién figura en la tarjeta"
            valor={titular}
            alCambiar={setTitular}
            auto="cc-name"
            marcador="Como está impreso"
          />
        </div>

        <label className="mt-4 flex gap-2.5 text-sm leading-snug">
          <input
            type="checkbox"
            checked={acepta}
            onChange={(e) => setAcepta(e.target.checked)}
            className="mt-0.5 accent-teal-700"
          />
          <span className="text-neutral-700 dark:text-neutral-300">
            Acepto el{" "}
            <a
              href={permisos?.enlace}
              target="_blank"
              rel="noopener noreferrer"
              className="underline underline-offset-2"
            >
              reglamento de Wompi
            </a>
            {permisos?.datosEnlace && (
              <>
                {" "}y la{" "}
                <a
                  href={permisos.datosEnlace}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline underline-offset-2"
                >
                  autorización de datos personales
                </a>
              </>
            )}
            .
          </span>
        </label>

        {fallo && (
          <p className="mt-3 rounded-lg border-l-[3px] border-red-700 bg-red-50 p-3 text-sm text-red-900 dark:bg-red-950/40 dark:text-red-200">
            {fallo}
          </p>
        )}

        <div className="mt-5 flex gap-3">
          <button
            onClick={cerrar}
            className="rounded-full border border-neutral-300 px-4 py-2.5 text-sm font-semibold dark:border-neutral-700"
          >
            Cancelar
          </button>
          <button
            onClick={() => void pagar()}
            disabled={!listo || yendo}
            className="empuja flex-1 rounded-full bg-teal-700 px-5 py-2.5 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40 dark:bg-teal-600"
          >
            {yendo ? "Cobrando…" : `Pagar ${precio}`}
          </button>
        </div>

        <p className="mt-3 text-center text-[11px] text-neutral-500">
          Tu tarjeta va directa a Wompi. No pasa por Cadencia ni se guarda aquí.
        </p>
      </div>
    </div>
  );
}

function Campo({
  etiqueta,
  valor,
  alCambiar,
  marcador,
  modo,
  auto,
}: {
  etiqueta: string;
  valor: string;
  alCambiar: (v: string) => void;
  marcador?: string;
  modo?: "numeric";
  auto?: string;
}) {
  return (
    <label className="block">
      <span className="font-mono text-[10px] uppercase tracking-wider text-neutral-500">
        {etiqueta}
      </span>
      <input
        value={valor}
        onChange={(e) => alCambiar(e.target.value)}
        inputMode={modo}
        autoComplete={auto}
        placeholder={marcador}
        className="mt-1 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm outline-none focus:border-teal-700 dark:border-neutral-700 dark:bg-neutral-900 dark:focus:border-teal-400"
      />
    </label>
  );
}
