"use client";

import dynamic from "next/dynamic";

/**
 * Lee al arrancar la idea que dejó la semana, y eso no existe en el servidor.
 * Se carga solo en el cliente en vez de reconciliar dos verdades.
 */
const Guion = dynamic(() => import("./guion"), {
  ssr: false,
  loading: () => <main className="mx-auto max-w-3xl px-6 py-14" />,
});

export default function PaginaGuion() {
  return <Guion />;
}
