"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useSession } from "@/lib/auth-cliente";
import { Barra } from "../barra";
import {
  buscarSilencios,
  medirNiveles,
  primerSonido,
  revisar,
  segundos,
  UMBRAL_SILENCIO,
  veredicto,
  type Chequeo,
  type Medidas,
} from "@/lib/pieza";

/** Lee todo lo medible del archivo, sin subirlo a ninguna parte. */
async function medir(archivo: File): Promise<Medidas> {
  const url = URL.createObjectURL(archivo);
  try {
    const video = document.createElement("video");
    video.preload = "metadata";
    video.muted = true;
    video.src = url;

    await new Promise<void>((listo, falla) => {
      video.onloadedmetadata = () => listo();
      video.onerror = () => falla(new Error("No se pudo abrir ese archivo como video."));
    });

    const ancho = video.videoWidth;
    const alto = video.videoHeight;
    const duracion = video.duration;

    // Primer fotograma: se busca al segundo 0 y se mide su luminancia.
    let luzPrimerFotograma: number | null = null;
    try {
      await new Promise<void>((listo) => {
        video.onseeked = () => listo();
        video.currentTime = 0.05;
        setTimeout(listo, 2500);
      });
      const lienzo = document.createElement("canvas");
      const lado = 80;
      lienzo.width = lado;
      lienzo.height = Math.max(1, Math.round((lado * alto) / Math.max(1, ancho)));
      const ctx = lienzo.getContext("2d", { willReadFrequently: true });
      if (ctx) {
        ctx.drawImage(video, 0, 0, lienzo.width, lienzo.height);
        const { data } = ctx.getImageData(0, 0, lienzo.width, lienzo.height);
        let suma = 0;
        for (let i = 0; i < data.length; i += 4) {
          suma += (0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2]) / 255;
        }
        luzPrimerFotograma = suma / (data.length / 4);
      }
    } catch {
      // Si el navegador no deja leer el fotograma, ese chequeo no sale. No se
      // inventa un resultado.
    }

    let audio: Medidas["audio"] = "ilegible";
    let niveles: number[] = [];
    let picoMax = 0;

    try {
      const bytes = await archivo.arrayBuffer();
      const ctx = new AudioContext();
      const buffer = await ctx.decodeAudioData(bytes);
      await ctx.close();

      if (buffer.numberOfChannels === 0 || buffer.length === 0) {
        audio = "no";
      } else {
        const medido = medirNiveles(buffer.getChannelData(0), buffer.sampleRate);
        niveles = medido.niveles;
        picoMax = medido.pico;
        audio = picoMax > 0 ? "si" : "no";
      }
    } catch {
      audio = "ilegible";
    }

    return {
      ancho,
      alto,
      duracion,
      niveles,
      silencios: audio === "si" ? buscarSilencios(niveles) : [],
      arranqueAudio: audio === "si" ? primerSonido(niveles) : null,
      picoMax,
      luzPrimerFotograma,
      audio,
    };
  } finally {
    URL.revokeObjectURL(url);
  }
}

export default function Pieza() {
  const { data: sesion, isPending } = useSession();
  const [medidas, setMedidas] = useState<Medidas | null>(null);
  const [chequeos, setChequeos] = useState<Chequeo[] | null>(null);
  const [palabras, setPalabras] = useState("");
  const [nombre, setNombre] = useState("");
  const [midiendo, setMidiendo] = useState(false);
  const [error, setError] = useState("");
  const archivoRef = useRef<File | null>(null);

  async function tomar(archivo: File | undefined | null) {
    if (!archivo) return;
    archivoRef.current = archivo;
    setNombre(archivo.name);
    setMidiendo(true);
    setError("");
    try {
      const m = await medir(archivo);
      setMedidas(m);
      setChequeos(revisar(m, contarGuion(palabras)));
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo leer el video.");
      setMedidas(null);
      setChequeos(null);
    } finally {
      setMidiendo(false);
    }
  }

  function contarGuion(texto: string) {
    const n = texto.trim().split(/\s+/).filter(Boolean).length;
    return n > 0 ? { palabras: n } : undefined;
  }

  function reevaluar(texto: string) {
    setPalabras(texto);
    if (medidas) setChequeos(revisar(medidas, contarGuion(texto)));
  }

  if (isPending) return <main className="mx-auto max-w-3xl px-6 py-14" />;

  if (!sesion) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-20">
        <h1 className="text-4xl font-bold tracking-tight">La pieza</h1>
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

  const v = chequeos ? veredicto(chequeos) : null;

  return (
    <main className="mx-auto max-w-3xl px-6 py-14">
      <Barra />

      <header className="border-b-2 border-neutral-900 pb-7 dark:border-neutral-100">
        <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-teal-700 dark:text-teal-400">
          Función 4 · Pieza publicable
        </p>
        <h1 className="mt-4 text-5xl font-bold leading-none tracking-tight">La pieza</h1>
        <p className="mt-4 max-w-xl text-neutral-600 dark:text-neutral-400">
          Sube el video ya editado y te digo si algo mecánico lo está
          estropeando: proporción, arranque mudo, baches de silencio, nivel de
          audio, primer fotograma en negro.
        </p>
        <p className="mt-3 max-w-xl text-sm text-neutral-500">
          El video <strong>no se sube a ningún servidor</strong> — se mide aquí,
          en tu navegador. Por eso no gasta corrida ni cuesta nada.
        </p>
      </header>

      <section className="mt-9">
        <label className="flex cursor-pointer items-center justify-center rounded border border-dashed border-neutral-400 px-4 py-8 text-sm text-neutral-600 transition hover:border-teal-700 hover:text-teal-800 dark:border-neutral-600 dark:text-neutral-400 dark:hover:border-teal-400 dark:hover:text-teal-300">
          <input
            type="file"
            accept="video/*"
            className="sr-only"
            onChange={(e) => tomar(e.target.files?.[0])}
          />
          {midiendo ? "Midiendo…" : nombre ? `${nombre} — elegir otro` : "Elegir el video"}
        </label>

        {error && (
          <p className="mt-4 rounded border-l-[3px] border-red-700 bg-red-50 p-3 text-sm text-red-900 dark:bg-red-950/40 dark:text-red-200">
            {error}
          </p>
        )}

        <div className="mt-5">
          <label
            htmlFor="guion"
            className="font-mono text-[10px] uppercase tracking-wider text-neutral-500"
          >
            El guion que grabaste (opcional)
          </label>
          <p className="mb-1.5 mt-0.5 text-sm text-neutral-500">
            Pégalo y comparo la duración contra la que debería tener. Nada más:
            no se juzga el contenido.
          </p>
          <textarea
            id="guion"
            value={palabras}
            onChange={(e) => reevaluar(e.target.value)}
            rows={3}
            className="w-full rounded border border-neutral-300 bg-white p-3 text-sm leading-relaxed outline-none focus:border-teal-700 dark:border-neutral-700 dark:bg-neutral-900 dark:focus:border-teal-400"
          />
        </div>
      </section>

      {medidas && chequeos && v && (
        <section className="mt-12 border-t border-neutral-200 pt-10 dark:border-neutral-800">
          <div className="flex flex-wrap items-baseline gap-5">
            <span
              className={`font-mono text-4xl font-bold tabular-nums ${
                v.publicable ? "text-green-700 dark:text-green-400" : "text-red-700 dark:text-red-400"
              }`}
            >
              {chequeos.filter((c) => c.estado === "pasa").length}
              <span className="text-2xl text-neutral-400">
                /{chequeos.filter((c) => c.estado !== "sin-dato").length}
              </span>
            </span>
            <div>
              <p className="text-lg font-semibold leading-snug">
                {v.publicable
                  ? v.revisar > 0
                    ? "Nada la rompe, pero hay cosas que mirar"
                    : "Mecánicamente, esta ya se puede publicar"
                  : v.fallan === 1
                    ? "Hay una cosa que arreglar antes de publicarla"
                    : `Hay ${v.fallan} cosas que arreglar antes de publicarla`}
              </p>
              <p className="mt-1 font-mono text-[11px] uppercase tracking-wider text-neutral-500">
                {medidas.ancho}×{medidas.alto} · {segundos(medidas.duracion)}
              </p>
            </div>
          </div>

          {medidas.niveles.length > 0 && (
            <Onda niveles={medidas.niveles} duracion={medidas.duracion} />
          )}

          <div className="mt-6 divide-y divide-neutral-200 overflow-hidden rounded border border-neutral-200 dark:divide-neutral-800 dark:border-neutral-800">
            {chequeos.map((c) => (
              <div key={c.id} className="bg-white p-4 dark:bg-neutral-900">
                <div className="flex items-center gap-2.5">
                  <span
                    className={`font-mono text-[10px] font-bold uppercase tracking-wider ${
                      c.estado === "pasa"
                        ? "text-green-700 dark:text-green-400"
                        : c.estado === "falla"
                          ? "text-red-700 dark:text-red-400"
                          : c.estado === "revisa"
                            ? "text-amber-700 dark:text-amber-500"
                            : "text-neutral-400"
                    }`}
                  >
                    {c.estado === "sin-dato" ? "sin dato" : c.estado}
                  </span>
                  <h3 className="font-semibold">{c.titulo}</h3>
                </div>
                <p className="mt-1.5 text-sm text-neutral-700 dark:text-neutral-300">{c.detalle}</p>
                {c.arreglo && (
                  <p className="mt-2 border-l-2 border-neutral-300 pl-2.5 text-sm text-neutral-600 dark:border-neutral-700 dark:text-neutral-400">
                    {c.arreglo}
                  </p>
                )}
              </div>
            ))}
          </div>

          <p className="mt-8 rounded border-l-[3px] border-neutral-400 bg-neutral-50 p-3 text-sm leading-relaxed text-neutral-600 dark:bg-neutral-900 dark:text-neutral-400">
            Esto mide lo mecánico. <strong>Si la pieza merece publicarse lo
            decides tú</strong> — y ese criterio sale de grabar, editar y anotar
            qué revisas antes de darle a publicar. Cuando lo tengas escrito,
            entra aquí como chequeo más.
          </p>
        </section>
      )}
    </main>
  );
}

/** El audio de la pieza, con los silencios en rojo. */
function Onda({ niveles, duracion }: { niveles: number[]; duracion: number }) {
  const columnas = 220;
  const porColumna = Math.max(1, Math.ceil(niveles.length / columnas));
  const barras: number[] = [];
  for (let i = 0; i < niveles.length; i += porColumna) {
    barras.push(Math.max(...niveles.slice(i, i + porColumna)));
  }

  return (
    <div className="mt-6">
      <div className="flex h-16 items-end gap-px overflow-hidden rounded border border-neutral-200 bg-neutral-50 p-1 dark:border-neutral-800 dark:bg-neutral-950">
        {barras.map((n, i) => (
          <div
            key={i}
            style={{ height: `${Math.max(2, n * 100)}%` }}
            className={`flex-1 rounded-sm ${
              n < UMBRAL_SILENCIO ? "bg-red-400/70" : "bg-teal-600/80 dark:bg-teal-500/80"
            }`}
          />
        ))}
      </div>
      <p className="mt-1.5 font-mono text-[10px] uppercase tracking-wider text-neutral-500">
        el audio de la pieza · en rojo, silencio · 0 a {segundos(duracion)}
      </p>
    </div>
  );
}
