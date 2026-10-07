"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const DIA = new Intl.DateTimeFormat("es", { day: "numeric", month: "long" });

/**
 * Apagar o encender la renovación, desde la pantalla del plan.
 *
 * Tiene que estar aquí y no en un correo de soporte: un cobro que se repite y
 * solo se puede parar escribiéndole a alguien obliga a llamar al banco, y quien
 * llega a llamar al banco no vuelve nunca.
 *
 * Y apagarlo no corta el mes pagado. Eso también es a propósito: cobrar un mes
 * y quitarlo a mitad porque el dueño dijo «no me lo renueves» sería quedarse
 * con dinero por un servicio que no se dio.
 */
export function Renovacion({
  renovar,
  hasta,
  tarjeta,
}: {
  renovar: boolean;
  hasta: string | null;
  /** «VISA ·· 4242», o vacío si no llegó a guardarse. */
  tarjeta: string;
}) {
  const [puesto, setPuesto] = useState(renovar);
  const [yendo, setYendo] = useState(false);
  const router = useRouter();

  async function cambiar() {
    setYendo(true);
    try {
      const r = await fetch("/api/pago/renovacion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ renovar: !puesto }),
      });
      if (r.ok) {
        setPuesto(!puesto);
        router.refresh();
      }
    } finally {
      setYendo(false);
    }
  }

  const cuando = hasta ? DIA.format(new Date(hasta)) : null;

  return (
    <div className="mt-6 rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
      <p className="text-sm leading-relaxed">
        {puesto ? (
          <>
            Se renueva solo{cuando ? ` el ${cuando}` : ""}
            {tarjeta ? ` con tu ${tarjeta}` : ""}.
          </>
        ) : (
          <>
            La renovación está <strong>apagada</strong>. Tu plan sigue hasta
            {cuando ? ` el ${cuando}` : " su fecha"} y después vuelve a Prueba.
          </>
        )}
      </p>
      <button
        onClick={() => void cambiar()}
        disabled={yendo}
        className="mt-3 rounded-full border border-neutral-300 px-4 py-1.5 text-sm font-semibold transition hover:bg-neutral-100 disabled:opacity-40 dark:border-neutral-700 dark:hover:bg-neutral-800"
      >
        {yendo ? "…" : puesto ? "No renovar más" : "Volver a renovar"}
      </button>
    </div>
  );
}
