"use client";

import dynamic from "next/dynamic";

/** Lee la sesión del navegador al arrancar: no existe en el servidor. */
const PantallaNegocio = dynamic(() => import("./pantalla"), {
  ssr: false,
  loading: () => <main className="mx-auto max-w-5xl px-6 py-14" />,
});

export default function PaginaNegocio() {
  return <PantallaNegocio />;
}
