"use client";

import { useState } from "react";
import { Tarjeta } from "./tarjeta";

/**
 * El botón de suscribirse.
 *
 * Abre el formulario de tarjeta en vez de llevar al checkout de Wompi, porque
 * el checkout cobra UNA vez y no sabe guardar el medio de pago: para que se
 * cobre solo cada mes hace falta una fuente de pago, y eso solo se crea por
 * API con una tarjeta ya tokenizada.
 *
 * Aquí no se decide ningún precio: el monto se lee del plan en el servidor y se
 * firma allí. Lo que viaja desde esta pantalla es qué plan, nada más.
 */
export function Pagar({
  plan,
  nombre,
  precio,
  destaca,
}: {
  plan: string;
  nombre: string;
  /** Lo que se le enseña. El que se cobra sale de la base, no de aquí. */
  precio: string;
  destaca?: boolean;
}) {
  const [abierto, setAbierto] = useState(false);

  return (
    <>
      <button
        onClick={() => setAbierto(true)}
        className={`empuja block w-full rounded-full px-5 py-3 text-center font-semibold ${
          destaca
            ? "bg-teal-700 text-white dark:bg-teal-600"
            : "border border-neutral-300 hover:border-teal-700 dark:border-neutral-700 dark:hover:border-teal-400"
        }`}
      >
        Suscribirme a {nombre}
      </button>
      {abierto && (
        <Tarjeta
          plan={plan}
          nombre={nombre}
          precio={precio}
          cerrar={() => setAbierto(false)}
        />
      )}
    </>
  );
}
