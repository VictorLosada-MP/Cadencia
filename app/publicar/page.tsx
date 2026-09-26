"use client";

import dynamic from "next/dynamic";

/** Dibuja sobre un canvas y lee archivos del disco: solo existe en el navegador. */
const Publicar = dynamic(() => import("./publicar"), {
  ssr: false,
  loading: () => <main className="mx-auto max-w-3xl px-6 py-14" />,
});

export default function PaginaPublicar() {
  return <Publicar />;
}
