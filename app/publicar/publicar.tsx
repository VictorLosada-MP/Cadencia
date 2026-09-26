"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSession } from "@/lib/auth-cliente";
import { Barra } from "../barra";
import { ALTO, ANCHO, PALETAS, aPng, dibujar, type Paleta } from "@/lib/lamina";
import { esCarrusel, type Carrusel, type Pieza } from "@/types/guion";

export default function Lista() {
  const { data: sesion, isPending } = useSession();
  const [pieza, setPieza] = useState<Pieza | null>(null);
  const [paleta, setPaleta] = useState(PALETAS[0].id);
  const [creado, setCreado] = useState<string | null>(null);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    if (!sesion) return;
    let vivo = true;
    fetch("/api/ultimo?funcion=3")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!vivo) return;
        if (d?.corrida?.resultado) {
          setPieza(d.corrida.resultado);
          setCreado(d.corrida.creado);
        }
      })
      .catch(() => {})
      .finally(() => vivo && setCargando(false));
    return () => {
      vivo = false;
    };
  }, [sesion]);

  if (isPending) return <main className="mx-auto max-w-3xl px-6 py-14" />;

  if (!sesion) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-20">
        <h1 className="text-4xl font-bold tracking-tight">Lista para subir</h1>
        <p className="mt-4 text-neutral-600 dark:text-neutral-400">Entra a tu cuenta para usarla.</p>
        <Link
          href="/entrar"
          className="mt-6 inline-block rounded bg-teal-700 px-5 py-2.5 font-semibold text-white dark:bg-teal-600"
        >
          Entrar o crear cuenta
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-3xl px-6 py-14">
      <Barra />

      <header className="border-b-2 border-neutral-900 pb-7 dark:border-neutral-100">
        <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-teal-700 dark:text-teal-400">
          Función 4 · Lista para subir
        </p>
        <h1 className="mt-4 text-5xl font-bold leading-none tracking-tight">Lista para subir</h1>
        <p className="mt-4 max-w-xl text-neutral-600 dark:text-neutral-400">
          Aquí lo que escribiste en el paso 3 se convierte en el archivo que
          subes. Todo se arma en tu navegador: nada se sube a ningún servidor.
        </p>
      </header>

      {cargando ? (
        <p className="mt-9 text-sm text-neutral-500">Buscando lo último que escribiste…</p>
      ) : !pieza ? (
        <div className="mt-9 rounded border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900">
          <p className="text-sm leading-relaxed text-neutral-700 dark:text-neutral-300">
            Todavía no hay nada que armar. Escribe una pieza en el paso 3 y
            vuelve — si es un carrusel, aquí salen las láminas listas.
          </p>
          <Link
            href="/pieza"
            className="mt-3 inline-block font-mono text-[11px] uppercase tracking-wider text-teal-700 underline underline-offset-4 hover:no-underline dark:text-teal-400"
          >
            ir a escribir la pieza →
          </Link>
        </div>
      ) : esCarrusel(pieza) ? (
        <DeCarrusel c={pieza} paletaId={paleta} onPaleta={setPaleta} creado={creado} />
      ) : (
        <EsVideo />
      )}
    </main>
  );
}

function DeCarrusel({
  c,
  paletaId,
  onPaleta,
  creado,
}: {
  c: Carrusel;
  paletaId: string;
  onPaleta: (id: string) => void;
  creado: string | null;
}) {
  const lienzos = useRef<(HTMLCanvasElement | null)[]>([]);
  const [bajando, setBajando] = useState(false);
  // Las fotos viven solo en esta pantalla: no se suben, no se guardan.
  const [fotos, setFotos] = useState<Record<number, ImageBitmap>>({});
  const [buscando, setBuscando] = useState<number | null>(null);
  const paleta: Paleta = (PALETAS.find((p) => p.id === paletaId) ?? PALETAS[0]).p;
  const total = c.laminas?.length ?? 0;

  useEffect(() => {
    c.laminas?.forEach((l, i) => {
      const lienzo = lienzos.current[i];
      if (lienzo) dibujar(lienzo, { ...l, total }, paleta, fotos[l.numero]);
    });
  }, [c.laminas, paleta, total, fotos]);

  async function ponerFoto(numero: number, archivo: File | undefined | null) {
    if (!archivo) return;
    try {
      const bitmap = await createImageBitmap(archivo);
      setFotos((f) => ({ ...f, [numero]: bitmap }));
    } catch {
      // Si no se puede leer, la lámina se queda sin foto y ya está.
    }
  }

  async function bajar(i?: number) {
    setBajando(true);
    try {
      const cuales = i === undefined ? c.laminas.map((_, j) => j) : [i];
      for (const j of cuales) {
        const lienzo = lienzos.current[j];
        if (!lienzo) continue;
        const blob = await aPng(lienzo);
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `lamina-${String(j + 1).padStart(2, "0")}.png`;
        a.click();
        URL.revokeObjectURL(url);
        // Un respiro entre descargas: encadenadas sin pausa, el navegador
        // bloquea las siguientes creyendo que es una avalancha.
        await new Promise((r) => setTimeout(r, 250));
      }
    } finally {
      setBajando(false);
    }
  }

  return (
    <section className="mt-9">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-wider text-neutral-500">
            {total} láminas · 1080 × 1350
          </p>
          {creado && (
            <p className="mt-0.5 text-xs text-neutral-500">
              del carrusel que escribiste el{" "}
              {new Date(creado).toLocaleDateString("es", { day: "numeric", month: "long" })}
            </p>
          )}
        </div>
        <button
          onClick={() => bajar()}
          disabled={bajando}
          className="rounded bg-teal-700 px-5 py-2.5 font-semibold text-white transition hover:bg-teal-800 disabled:opacity-40 dark:bg-teal-600 dark:hover:bg-teal-500"
        >
          {bajando ? "Bajando…" : "Bajar las láminas"}
        </button>
      </div>

      <fieldset className="mt-5">
        <legend className="font-mono text-[10px] uppercase tracking-wider text-neutral-500">
          Colores
        </legend>
        <p className="mb-2 mt-0.5 text-xs text-neutral-500">
          Uno manda, uno para el texto, uno que resalta — la regla 60-30-10.
        </p>
        <div className="flex flex-wrap gap-2">
          {PALETAS.map((p) => (
            <button
              key={p.id}
              onClick={() => onPaleta(p.id)}
              className={`flex items-center gap-2 rounded border px-3 py-1.5 text-sm transition ${
                paletaId === p.id
                  ? "border-teal-700 font-semibold dark:border-teal-400"
                  : "border-neutral-300 hover:border-teal-700 dark:border-neutral-700 dark:hover:border-teal-400"
              }`}
            >
              <span className="flex overflow-hidden rounded-sm border border-neutral-300 dark:border-neutral-700">
                {[p.p.fondo, p.p.tinta, p.p.acento].map((c) => (
                  <span key={c} style={{ background: c }} className="block h-4 w-3" />
                ))}
              </span>
              {p.nombre}
            </button>
          ))}
        </div>
      </fieldset>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        {c.laminas?.map((l, i) => (
          <div key={l.numero}>
            <canvas
              ref={(el) => {
                lienzos.current[i] = el;
              }}
              width={ANCHO}
              height={ALTO}
              className="w-full rounded border border-neutral-200 dark:border-neutral-800"
            />
            <div className="mt-1.5 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
              <p className="font-mono text-[10px] uppercase tracking-wider text-neutral-500">
                lámina {l.numero}
              </p>
              <span className="flex gap-3">
                <label className="cursor-pointer font-mono text-[10px] uppercase tracking-wider text-teal-700 underline underline-offset-4 hover:no-underline dark:text-teal-400">
                  <input
                    type="file"
                    accept="image/*"
                    className="sr-only"
                    onChange={(e) => ponerFoto(l.numero, e.target.files?.[0])}
                  />
                  {fotos[l.numero] ? "cambiar mi foto" : "poner mi foto"}
                </label>
                <button
                  onClick={() => setBuscando(buscando === l.numero ? null : l.numero)}
                  className="font-mono text-[10px] uppercase tracking-wider text-teal-700 underline underline-offset-4 hover:no-underline dark:text-teal-400"
                >
                  buscar foto
                </button>
                {fotos[l.numero] && (
                  <button
                    onClick={() =>
                      setFotos((f) =>
                        Object.fromEntries(
                          Object.entries(f).filter(([n]) => Number(n) !== l.numero),
                        ),
                      )
                    }
                    className="font-mono text-[10px] uppercase tracking-wider text-neutral-400 hover:text-red-700 dark:hover:text-red-400"
                  >
                    quitar
                  </button>
                )}
                <button
                  onClick={() => bajar(i)}
                  className="font-mono text-[10px] uppercase tracking-wider text-teal-700 underline underline-offset-4 hover:no-underline dark:text-teal-400"
                >
                  bajar esta
                </button>
              </span>
            </div>
            {l.imagen && !fotos[l.numero] && (
              <p className="mt-1 text-xs leading-relaxed text-neutral-500">
                Qué foto le va: {l.imagen}
              </p>
            )}
            {buscando === l.numero && (
              <Buscador
                consulta={l.imagen || l.titular}
                orientacion={l.numero === 1 ? "portrait" : "landscape"}
                onElegida={(bitmap) => {
                  setFotos((f) => ({ ...f, [l.numero]: bitmap }));
                  setBuscando(null);
                }}
              />
            )}
          </div>
        ))}
      </div>

      {c.descripcion && (
        <div className="mt-8">
          <h2 className="font-mono text-[11px] uppercase tracking-[0.12em] text-neutral-500">
            El pie, para pegar al subirlo
          </h2>
          <p className="mt-2 whitespace-pre-wrap rounded border-l-2 border-teal-700 bg-neutral-50 p-3 text-sm leading-relaxed dark:border-teal-400 dark:bg-neutral-950">
            {c.descripcion}
          </p>
        </div>
      )}
    </section>
  );
}

type Foto = { id: number; url: string; mini: string; autor: string; origen: string };

/**
 * Busca fotos de archivo con lo que el prompt escribió que se ve en la lámina.
 * Gratis, y sin generar nada: son fotos que ya existen.
 */
function Buscador({
  consulta,
  orientacion,
  onElegida,
}: {
  consulta: string;
  orientacion: "portrait" | "landscape";
  onElegida: (b: ImageBitmap) => void;
}) {
  const [texto, setTexto] = useState(consulta);
  const [fotos, setFotos] = useState<Foto[] | null>(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState("");
  const [sinClave, setSinClave] = useState(false);

  async function buscar() {
    setCargando(true);
    setError("");
    try {
      const r = await fetch(
        `/api/fotos?q=${encodeURIComponent(texto)}&o=${orientacion}`,
      );
      const d = await r.json();
      if (!r.ok) {
        setSinClave(Boolean(d.sinClave));
        throw new Error(d.error ?? "No se pudo buscar.");
      }
      setFotos(d.fotos);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo buscar.");
    } finally {
      setCargando(false);
    }
  }

  async function elegir(f: Foto) {
    try {
      // Viene por el proxy para que el canvas no quede marcado y se pueda
      // seguir exportando la lámina.
      const r = await fetch(`/api/fotos?traer=${encodeURIComponent(f.url)}`);
      onElegida(await createImageBitmap(await r.blob()));
    } catch {
      setError("No se pudo traer esa foto.");
    }
  }

  return (
    <div className="mt-2 rounded border border-neutral-200 bg-neutral-50 p-3 dark:border-neutral-800 dark:bg-neutral-950">
      <div className="flex flex-wrap gap-2">
        <input
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && buscar()}
          className="min-w-0 flex-1 rounded border border-neutral-300 bg-white px-2 py-1.5 text-sm outline-none focus:border-teal-700 dark:border-neutral-700 dark:bg-neutral-900 dark:focus:border-teal-400"
        />
        <button
          onClick={buscar}
          disabled={cargando || !texto.trim()}
          className="rounded border border-teal-700 px-3 py-1.5 font-mono text-[11px] uppercase tracking-wider text-teal-700 transition hover:bg-teal-50 disabled:opacity-40 dark:border-teal-400 dark:text-teal-400 dark:hover:bg-teal-950/40"
        >
          {cargando ? "buscando…" : "buscar"}
        </button>
      </div>

      {error && (
        <p className="mt-2 text-xs text-amber-700 dark:text-amber-500">
          {error}
          {sinClave && (
            <>
              {" "}
              Mientras tanto puedes poner tus propias fotos, o dejar la lámina
              solo con texto.
            </>
          )}
        </p>
      )}

      {fotos && fotos.length === 0 && (
        <p className="mt-2 text-xs text-neutral-500">
          Nada con esas palabras. Prueba con menos, o en inglés.
        </p>
      )}

      {fotos && fotos.length > 0 && (
        <>
          <div className="mt-2 grid grid-cols-4 gap-1.5">
            {fotos.map((f) => (
              <button
                key={f.id}
                onClick={() => elegir(f)}
                title={`Foto de ${f.autor}`}
                className="overflow-hidden rounded border border-neutral-300 transition hover:border-teal-700 dark:border-neutral-700 dark:hover:border-teal-400"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={f.mini} alt="" className="aspect-square w-full object-cover" />
              </button>
            ))}
          </div>
          <p className="mt-1.5 text-[10px] text-neutral-500">
            Fotos de Pexels. Se pueden usar sin pagar y sin dar crédito.
          </p>
        </>
      )}
    </div>
  );
}

function EsVideo() {
  return (
    <section className="mt-9">
      <div className="rounded border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900">
        <p className="font-semibold">Lo último que escribiste es un guion de video</p>
        <p className="mt-2 text-sm leading-relaxed text-neutral-700 dark:text-neutral-300">
          El editor de video —recortar a 9:16, cortar los silencios y quemar los
          subtítulos— todavía no está. Es lo siguiente que construyo, y va a
          correr aquí mismo, en tu navegador.
        </p>
        <Link
          href="/pieza"
          className="mt-3 inline-block font-mono text-[11px] uppercase tracking-wider text-teal-700 underline underline-offset-4 hover:no-underline dark:text-teal-400"
        >
          volver al paso 3 →
        </Link>
      </div>
    </section>
  );
}
