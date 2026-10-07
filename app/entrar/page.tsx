"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { requestPasswordReset, signIn, signUp } from "@/lib/auth-cliente";

/**
 * A dónde se va después de entrar.
 *
 * Solo rutas de aquí dentro: una dirección completa en el parámetro convertiría
 * esta pantalla en un trampolín para mandar a alguien a otro sitio después de
 * poner su contraseña. Por eso tiene que empezar por una sola barra —`//otro.com`
 * es una dirección de fuera disfrazada de ruta.
 */
function aDonde(volver: string | null): string {
  if (!volver || !volver.startsWith("/") || volver.startsWith("//")) return "/diagnostico";
  return volver;
}

function Formulario() {
  const router = useRouter();
  const volver = aDonde(useSearchParams().get("volver"));
  const [modo, setModo] = useState<"entrar" | "crear" | "olvide">("entrar");
  const [correo, setCorreo] = useState("");
  const [clave, setClave] = useState("");
  const [nombre, setNombre] = useState("");
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState("");
  const [pedido, setPedido] = useState(false);

  const creando = modo === "crear";
  const olvidado = modo === "olvide";

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setCargando(true);
    setError("");
    if (olvidado) {
      await requestPasswordReset({ email: correo, redirectTo: "/restablecer" });
      setCargando(false);
      // Siempre el mismo mensaje, exista o no la cuenta: si cambiara, esta
      // pantalla se convertiría en una forma de averiguar quién está dentro.
      setPedido(true);
      return;
    }

    const r = creando
      ? await signUp.email({ email: correo, password: clave, name: nombre })
      : await signIn.email({ email: correo, password: clave });
    setCargando(false);

    if (r.error) {
      setError(
        r.error.message ??
          (creando ? "No se pudo crear la cuenta." : "Correo o contraseña que no cuadran."),
      );
      return;
    }
    router.push(volver);
    router.refresh();
  }

  return (
    <main className="relative flex min-h-svh items-center justify-center overflow-hidden px-6 py-16">
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        <div className="deriva absolute -left-[20%] top-[-25%] h-[60vw] w-[60vw] rounded-full bg-teal-400/18 blur-[110px] dark:bg-teal-500/10" />
        <div
          className="deriva absolute -right-[18%] bottom-[-30%] h-[52vw] w-[52vw] rounded-full bg-amber-300/18 blur-[120px] dark:bg-amber-500/8"
          style={{ ["--tarda" as string]: "-8s" }}
        />
      </div>

      <div className="entra-caja w-full max-w-md rounded-xl border border-neutral-200 bg-[var(--background)]/80 p-8 shadow-[0_30px_80px_-50px_rgb(0_0_0/0.4)] backdrop-blur-sm sm:p-10 dark:border-neutral-800">
      <Link
        href="/"
        className="flex items-center gap-2.5 font-mono text-[11px] uppercase tracking-[0.2em] text-teal-700 dark:text-teal-400"
      >
        <span className="late block h-2 w-2 rounded-full bg-teal-600 dark:bg-teal-400" />
        Cadencia
      </Link>
      <h1 className="mt-4 text-3xl font-bold tracking-tight">
        {olvidado ? "Recupera tu cuenta" : creando ? "Crea tu cuenta" : "Entra a tu cuenta"}
      </h1>
      <p className="mt-3 text-sm text-neutral-600 dark:text-neutral-400">
        {olvidado
          ? "Pon tu correo y te mando un enlace para elegir una contraseña nueva. Vale una hora."
          : "Es la cuenta de Cadencia. Aquí no se pide ni se guarda ninguna contraseña de Instagram, TikTok ni de ninguna red — y no se va a pedir nunca."}
      </p>

      {/*
        Las condiciones de la prueba, dichas ANTES de crear la cuenta y no
        después. El dueño lo pidió así —«eso toca dejarle claro al usuario, por
        ejemplo tan pronto cree su cuenta»— y antes es mejor que después: una
        condición que aparece cuando ya estás dentro se lee como letra pequeña.
      */}
      {creando && (
        <div className="mt-5 rounded-lg border-l-[3px] border-teal-700 bg-teal-50 p-3.5 text-sm leading-relaxed dark:border-teal-400 dark:bg-teal-950/30">
          <strong>La prueba es una pasada completa, gratis:</strong> un
          diagnóstico, una semana de contenido, una pieza escrita y su montaje.
          Una vez cada función. Se cierra cuando bajes ese primer video o
          carrusel — y desde ahí todo lo que te generó se queda en tu cuenta
          para abrirlo, copiarlo y descargarlo cuando quieras.
        </div>
      )}

      {pedido ? (
        <div className="mt-8">
          <p className="rounded-lg border-l-[3px] border-teal-700 bg-teal-50 p-3 text-sm dark:border-teal-400 dark:bg-teal-950/30">
            Si esa cuenta existe, el enlace ya va en camino. Revisa tu correo.
          </p>
          <p className="mt-3 text-xs text-neutral-500">
            ¿Corriendo esto en tu máquina y sin proveedor de correo configurado?
            El enlace sale impreso en la terminal donde tienes{" "}
            <code className="font-mono">npm run dev</code>.
          </p>
          <button
            onClick={() => {
              setPedido(false);
              setModo("entrar");
            }}
            className="mt-5 font-mono text-[11px] uppercase tracking-wider text-teal-700 underline underline-offset-4 hover:no-underline dark:text-teal-400"
          >
            volver a entrar
          </button>
        </div>
      ) : (
      <form onSubmit={enviar} className="mt-8 space-y-4">
        {creando && (
          <Campo
            id="nombre"
            etiqueta="Tu nombre"
            tipo="text"
            valor={nombre}
            onChange={setNombre}
            autoComplete="name"
          />
        )}
        <Campo
          id="correo"
          etiqueta="Correo"
          tipo="email"
          valor={correo}
          onChange={setCorreo}
          autoComplete="email"
        />
        {!olvidado && (
          <Campo
            id="clave"
            etiqueta="Contraseña"
            tipo="password"
            valor={clave}
            onChange={setClave}
            autoComplete={creando ? "new-password" : "current-password"}
            nota={creando ? "Diez caracteres o más" : undefined}
          />
        )}

        <button
          type="submit"
          disabled={cargando || !correo.trim() || (!olvidado && !clave.trim())}
          className="w-full empuja rounded-full bg-teal-700 px-5 py-2.5 font-semibold text-white transition hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-teal-600 dark:hover:bg-teal-500"
        >
          {cargando
            ? "Un momento…"
            : olvidado
              ? "Mándame el enlace"
              : creando
                ? "Crear cuenta"
                : "Entrar"}
        </button>

        {error && (
          <p className="rounded-lg border-l-[3px] border-red-700 bg-red-50 p-3 text-sm text-red-900 dark:bg-red-950/40 dark:text-red-200">
            {error}
          </p>
        )}
      </form>
      )}

      {!pedido && (
        <div className="mt-6 flex flex-wrap gap-x-6 gap-y-2">
          <button
            onClick={() => {
              setModo(creando || olvidado ? "entrar" : "crear");
              setError("");
            }}
            className="font-mono text-[11px] uppercase tracking-wider text-teal-700 underline underline-offset-4 hover:no-underline dark:text-teal-400"
          >
            {creando || olvidado ? "ya tengo cuenta" : "crear una cuenta"}
          </button>
          {!olvidado && (
            <button
              onClick={() => {
                setModo("olvide");
                setError("");
              }}
              className="font-mono text-[11px] uppercase tracking-wider text-neutral-500 underline underline-offset-4 hover:no-underline"
            >
              olvidé mi contraseña
            </button>
          )}
        </div>
      )}
      </div>
    </main>
  );
}

function Campo({
  id,
  etiqueta,
  tipo,
  valor,
  onChange,
  autoComplete,
  nota,
}: {
  id: string;
  etiqueta: string;
  tipo: string;
  valor: string;
  onChange: (v: string) => void;
  autoComplete: string;
  nota?: string;
}) {
  return (
    <div>
      <label
        htmlFor={id}
        className="font-mono text-[10px] uppercase tracking-wider text-neutral-500"
      >
        {etiqueta}
      </label>
      <input
        id={id}
        type={tipo}
        value={valor}
        autoComplete={autoComplete}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded-lg border border-neutral-300 bg-neutral-50 p-2 text-sm outline-none focus:border-teal-700 dark:border-neutral-700 dark:bg-neutral-950 dark:focus:border-teal-400"
      />
      {nota && <p className="mt-1 text-xs text-neutral-500">{nota}</p>}
    </div>
  );
}

/**
 * `useSearchParams` obliga a envolverlo: esta pantalla se pinta estática y el
 * parámetro solo existe en el navegador. Sin la frontera, el montaje avisa y
 * la página entera pasaría a renderizarse en cada petición sin necesidad.
 */
export default function Entrar() {
  return (
    <Suspense fallback={<main className="min-h-svh" />}>
      <Formulario />
    </Suspense>
  );
}
