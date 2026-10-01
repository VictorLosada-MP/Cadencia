"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useSession } from "@/lib/auth-cliente";
import { Barra } from "../barra";
import type { Entregado } from "../api/hecho/route";

const FECHA = new Intl.DateTimeFormat("es", { day: "numeric", month: "long" });

/**
 * Lo que ya está hecho.
 *
 * Hecho es el archivo en la mano, no la pieza escrita: aquí solo entra lo que
 * se descargó. Una lista que contara lo generado sería un inventario de buenas
 * intenciones, y lo que hace falta ver de un vistazo es con qué constancia
 * está saliendo material de verdad.
 */
export default function PantallaHecho() {
  const { data: sesion, isPending } = useSession();
  const [lista, setLista] = useState<Entregado[] | null>(null);

  useEffect(() => {
    if (!sesion) return;
    let vivo = true;
    fetch("/api/hecho")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (vivo) setLista(d?.entregados ?? []);
      })
      .catch(() => vivo && setLista([]));
    return () => {
      vivo = false;
    };
  }, [sesion]);

  if (isPending) return <main className="mx-auto max-w-5xl px-6 py-14" />;

  if (!sesion) {
    return (
      <main className="mx-auto max-w-5xl px-6 py-20">
        <h1 className="text-4xl font-bold tracking-tight">Lo hecho</h1>
        <p className="mt-4 text-neutral-600 dark:text-neutral-400">
          Entra a tu cuenta para verlo.
        </p>
        <Link
          href="/entrar"
          className="empuja mt-6 inline-block rounded-full bg-teal-700 px-5 py-2.5 font-semibold text-white dark:bg-teal-600"
        >
          Entrar o crear cuenta
        </Link>
      </main>
    );
  }

  const videos = lista?.filter((e) => e.tipo === "video").length ?? 0;
  const carruseles = lista?.filter((e) => e.tipo === "carrusel").length ?? 0;
  const semana = contarUltimos(lista ?? [], 7);
  const mes = contarUltimos(lista ?? [], 30);

  return (
    <main className="mx-auto max-w-5xl px-6 py-14">
      <Barra />

      <header className="entra border-b-2 border-neutral-900 pb-7 dark:border-neutral-100">
        <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-teal-700 dark:text-teal-400">
          Lo hecho
        </p>
        <h1 className="mt-4 text-4xl font-bold leading-none tracking-tight sm:text-5xl">
          Lo que ya tienes listo
        </h1>
        <p className="mt-4 max-w-xl text-neutral-600 dark:text-neutral-400">
          Aquí solo entra lo que <strong>descargaste</strong>: el video montado o
          las láminas del carrusel. Una pieza escrita y no bajada se quedó en la
          pantalla.
        </p>
      </header>

      {lista === null ? (
        <p className="mt-9 text-sm text-neutral-500">Buscando…</p>
      ) : lista.length === 0 ? (
        <section className="revela mt-9">
          <div className="rounded-lg border border-neutral-200 bg-white p-6 dark:border-neutral-800 dark:bg-neutral-900">
            <p className="font-semibold">Todavía no has bajado nada</p>
            <p className="mt-2 max-w-lg text-sm leading-relaxed text-neutral-700 dark:text-neutral-300">
              En cuanto descargues un carrusel o un video montado, aparece aquí
              con su fecha. Es la forma de ver si estás publicando con
              constancia o a rachas.
            </p>
            <Link
              href="/semana"
              className="empuja mt-4 inline-block rounded-full bg-teal-700 px-5 py-2.5 font-semibold text-white dark:bg-teal-600"
            >
              Ir a la semana
            </Link>
          </div>
        </section>
      ) : (
        <>
          <section className="revela mt-9 grid gap-px overflow-hidden rounded-lg border border-neutral-200 bg-neutral-200 grid-cols-2 sm:grid-cols-4 dark:border-neutral-800 dark:bg-neutral-800">
            <Cifra n={lista.length} que="en total" />
            <Cifra n={semana} que="en los últimos 7 días" />
            <Cifra n={mes} que="en los últimos 30" />
            <Cifra n={videos} que={`${videos === 1 ? "video" : "videos"} · ${carruseles} ${carruseles === 1 ? "carrusel" : "carruseles"}`} />
          </section>

          <section
            className="revela mt-8"
            style={{ ["--tarda" as string]: "0.06s" }}
          >
            <h2 className="font-mono text-[11px] uppercase tracking-[0.12em] text-neutral-500">
              Uno por uno
            </h2>
            <ul className="mt-3 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              {lista.map((e) => (
                <Ficha key={e.id} e={e} />
              ))}
            </ul>
          </section>

          <section className="revela mt-8" style={{ ["--tarda" as string]: "0.1s" }}>
            <Link
              href="/semana"
              className="empuja inline-block rounded-full bg-teal-700 px-5 py-2.5 font-semibold text-white dark:bg-teal-600"
            >
              Escribir la siguiente
            </Link>
          </section>
        </>
      )}
    </main>
  );
}

/**
 * Una pieza, con su fotograma.
 *
 * El fotograma no es adorno: dos videos del mismo guion se leen igual en una
 * lista de titulares, y el dueño que viene a buscar "el del taller" lo
 * reconoce de un vistazo o no lo encuentra.
 *
 * El MP4 no está aquí y no va a estarlo: guardar los archivos sería
 * almacenamiento por objetos y facturación por gigabyte para algo que el dueño
 * ya tiene bajado en la carpeta desde donde lo va a subir. Esto es el registro,
 * no el disco.
 */
function Ficha({ e }: { e: Entregado }) {
  const video = e.tipo === "video";
  return (
    <li className="tarjeta group overflow-hidden rounded-lg border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900">
      <div
        className={`relative overflow-hidden bg-neutral-100 dark:bg-neutral-800 ${
          video ? "aspect-[9/16]" : "aspect-[4/5]"
        }`}
      >
        {e.portada ? (
          // next/image no sirve aquí: el optimizador pide la imagen desde el
          // servidor, sin la cookie de sesión, y esta ruta exige sesión —
          // saldrían todas en blanco. Y optimizar un JPEG de 180 píxeles que
          // ya pesa ocho kilobytes no ahorra nada.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={`/api/hecho/portada/${e.id}`}
            alt=""
            loading="lazy"
            decoding="async"
            className="h-full w-full object-cover"
          />
        ) : (
          // Las piezas bajadas antes de que esto existiera no tienen
          // fotograma, y volver atrás a inventárselo no es posible: el archivo
          // está en el disco del dueño.
          <div className="flex h-full w-full items-center justify-center p-3 text-center">
            <p className="text-xs leading-snug text-neutral-400">
              Sin portada — se bajó antes de que las guardáramos
            </p>
          </div>
        )}
        <span
          className={`absolute left-2 top-2 rounded-full px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider backdrop-blur-sm ${
            video
              ? "bg-teal-100/90 text-teal-900 dark:bg-teal-950/90 dark:text-teal-300"
              : "bg-amber-100/90 text-amber-900 dark:bg-amber-950/90 dark:text-amber-300"
          }`}
        >
          {e.tipo}
        </span>
      </div>
      <div className="p-3">
        <p className="line-clamp-3 text-sm leading-snug">
          {e.titulo || <span className="text-neutral-400">sin título</span>}
        </p>
        <p className="mt-1.5 font-mono text-[11px] tabular-nums text-neutral-500">
          {FECHA.format(new Date(e.creado))}
          {e.detalle && ` · ${e.detalle}`}
        </p>
      </div>
    </li>
  );
}

function Cifra({ n, que }: { n: number; que: string }) {
  return (
    <div className="bg-[var(--background)] p-5">
      <p className="text-3xl font-bold tabular-nums tracking-tight">{n}</p>
      <p className="mt-0.5 text-sm text-neutral-500">{que}</p>
    </div>
  );
}

function contarUltimos(lista: Entregado[], dias: number): number {
  const desde = Date.now() - dias * 24 * 60 * 60 * 1000;
  return lista.filter((e) => new Date(e.creado).getTime() >= desde).length;
}
