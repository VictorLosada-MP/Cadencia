"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { resetPassword } from "@/lib/auth-cliente";

export default function Restablecer() {
  return (
    <Suspense fallback={<main className="mx-auto max-w-md px-6 py-20" />}>
      <Formulario />
    </Suspense>
  );
}

function Formulario() {
  const router = useRouter();
  const parametros = useSearchParams();
  const token = parametros.get("token") ?? "";
  const fallo = parametros.get("error");

  const [clave, setClave] = useState("");
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState("");
  const [listo, setListo] = useState(false);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setCargando(true);
    setError("");
    const r = await resetPassword({ newPassword: clave, token });
    setCargando(false);

    if (r.error) {
      setError(r.error.message ?? "No se pudo cambiar la contraseña.");
      return;
    }
    setListo(true);
    setTimeout(() => router.push("/entrar"), 1800);
  }

  if (!token || fallo) {
    return (
      <main className="mx-auto max-w-md px-6 py-20">
        <h1 className="text-3xl font-bold tracking-tight">Ese enlace ya no sirve</h1>
        <p className="mt-4 text-sm text-neutral-600 dark:text-neutral-400">
          Los enlaces valen una hora y solo se usan una vez. Pide uno nuevo.
        </p>
        <Link
          href="/entrar"
          className="mt-6 inline-block empuja rounded-full bg-teal-700 px-5 py-2.5 font-semibold text-white dark:bg-teal-600"
        >
          Volver a entrar
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-md px-6 py-20">
      <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-teal-700 dark:text-teal-400">
        Cadencia
      </p>
      <h1 className="mt-3 text-3xl font-bold tracking-tight">Elige una contraseña nueva</h1>

      {listo ? (
        <p className="mt-6 rounded-lg border-l-[3px] border-green-700 bg-green-50 p-3 text-sm dark:bg-green-950/30">
          Cambiada. Te llevo a entrar…
        </p>
      ) : (
        <form onSubmit={enviar} className="mt-8 space-y-4">
          <div>
            <label
              htmlFor="clave"
              className="font-mono text-[10px] uppercase tracking-wider text-neutral-500"
            >
              Contraseña nueva
            </label>
            <input
              id="clave"
              type="password"
              value={clave}
              autoComplete="new-password"
              onChange={(e) => setClave(e.target.value)}
              className="mt-1 w-full rounded-lg border border-neutral-300 bg-neutral-50 p-2 text-sm outline-none focus:border-teal-700 dark:border-neutral-700 dark:bg-neutral-950 dark:focus:border-teal-400"
            />
            <p className="mt-1 text-xs text-neutral-500">Diez caracteres o más</p>
          </div>

          <button
            type="submit"
            disabled={cargando || clave.trim().length < 10}
            className="w-full empuja rounded-full bg-teal-700 px-5 py-2.5 font-semibold text-white transition hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-teal-600 dark:hover:bg-teal-500"
          >
            {cargando ? "Cambiando…" : "Cambiar contraseña"}
          </button>

          {error && (
            <p className="rounded-lg border-l-[3px] border-red-700 bg-red-50 p-3 text-sm text-red-900 dark:bg-red-950/40 dark:text-red-200">
              {error}
            </p>
          )}
        </form>
      )}
    </main>
  );
}
