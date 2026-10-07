"use client";

import { useState } from "react";

/**
 * El botón de pagar.
 *
 * Pide al servidor la referencia y la firma, y con ellas manda un formulario
 * normal al checkout de Wompi. Un formulario y no una redirección con la
 * información en la URL: así el monto y la firma no acaban en el historial del
 * navegador ni en la cabecera `Referer` de la página siguiente.
 *
 * Aquí no se decide ningún precio. Lo que vuelve del servidor ya viene firmado
 * contra el monto del plan, y Wompi rechaza el cobro si no cuadran.
 */
export function Pagar({
  plan,
  nombre,
  destaca,
}: {
  plan: string;
  nombre: string;
  destaca?: boolean;
}) {
  const [yendo, setYendo] = useState(false);
  const [fallo, setFallo] = useState("");

  async function ir() {
    setYendo(true);
    setFallo("");
    try {
      const r = await fetch("/api/pago", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error ?? "No se pudo empezar el pago.");

      const f = document.createElement("form");
      f.method = "POST";
      f.action = d.checkout;
      const campos: Record<string, string> = {
        "public-key": d.publica,
        currency: d.moneda,
        "amount-in-cents": String(d.centavos),
        reference: d.referencia,
        "signature:integrity": d.firma,
        "customer-data:email": d.correo,
        "redirect-url": `${window.location.origin}/pago`,
      };
      for (const [k, v] of Object.entries(campos)) {
        const i = document.createElement("input");
        i.type = "hidden";
        i.name = k;
        i.value = v;
        f.appendChild(i);
      }
      document.body.appendChild(f);
      f.submit();
    } catch (e) {
      setFallo(e instanceof Error ? e.message : "No se pudo empezar el pago.");
      setYendo(false);
    }
  }

  return (
    <>
      <button
        onClick={() => void ir()}
        disabled={yendo}
        className={`empuja block w-full rounded-full px-5 py-3 text-center font-semibold disabled:opacity-50 ${
          destaca
            ? "bg-teal-700 text-white dark:bg-teal-600"
            : "border border-neutral-300 hover:border-teal-700 dark:border-neutral-700 dark:hover:border-teal-400"
        }`}
      >
        {yendo ? "Llevándote a pagar…" : `Pagar ${nombre}`}
      </button>
      {fallo && (
        <p className="mt-2 text-center text-xs text-red-700 dark:text-red-400">{fallo}</p>
      )}
    </>
  );
}
