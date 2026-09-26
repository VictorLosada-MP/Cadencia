"use client";

import dynamic from "next/dynamic";

/**
 * La pantalla lee lo guardado del navegador al arrancar, y eso no existe en el
 * servidor. Se carga solo en el cliente en vez de reconciliar dos verdades.
 */
const Diagnostico = dynamic(() => import("./diagnostico"), {
  ssr: false,
  loading: () => <main className="mx-auto max-w-3xl px-6 py-14" />,
});

export default function PaginaDiagnostico() {
  return <Diagnostico />;
}
