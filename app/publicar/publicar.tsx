"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSession } from "@/lib/auth-cliente";
import { Barra } from "../barra";
import { ALTO, ANCHO, PALETAS, aPng, dibujar, type Marca, type Paleta } from "@/lib/lamina";
import { esperarFuente, manuscrita } from "../fuentes";
import {
  ESTILOS,
  NOMBRE_MOLDE,
  moldeDe,
  moldesPosibles,
  esCarrusel,
  esEstilo,
  grabaDe,
  mismaFrase,
  type Carrusel,
  type Estilo,
  type Guion,
  type Lamina,
  type Molde,
  type Pieza,
} from "@/types/guion";
import { apuntarHecho } from "@/lib/hecho";
import { deLienzo } from "@/lib/portada";
import { Editor } from "./editor";

/** El id de la paleta propia. No está en PALETAS: se añade si la tiene. */
const MIA = "mia";

export default function Lista() {
  const { data: sesion, isPending } = useSession();
  const [pieza, setPieza] = useState<Pieza | null>(null);
  const [paleta, setPaleta] = useState(PALETAS[0].id);
  /**
   * Los colores de su marca, los que salieron de su cuadrícula.
   *
   * Se piden aquí y no en cada hijo porque los usan los dos caminos: las
   * láminas del carrusel y la carátula del video. Si no los tiene, llega null
   * y todo sigue como antes con las paletas de serie.
   */
  const [marca, setMarca] = useState<Paleta | null>(null);
  /** Su cara y su arroba, lo que va impreso en las láminas. */
  const [firma, setFirma] = useState<Marca | null>(null);
  const [creado, setCreado] = useState<string | null>(null);
  const [corridaId, setCorridaId] = useState<string | null>(null);
  const [formato, setFormato] = useState<string>("camara");
  const [cargando, setCargando] = useState(true);
  /**
   * "Ya lo tengo grabado": se monta sin guion escrito.
   *
   * Es la puerta del que llega con el video hecho porque lo tenía en la
   * cabeza. Obligarle a pasar por el paso 3 era obligarle a inventarse una
   * idea para que el sistema le escribiera un texto que él ya dijo mejor — y
   * al que llega de internet a probar, a pasar antes por el diagnóstico y la
   * semana, que es la fricción más alta que tiene esto.
   */
  const [grabado, setGrabado] = useState(false);

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
          setCorridaId(d.corrida.id ?? null);
          // El formato viaja en la entrada de la corrida: dice si grabó
          // video o solo audio, y eso cambia lo que el paso 4 le pide.
          if (d.corrida.entrada?.formato) setFormato(String(d.corrida.entrada.formato));
        }
      })
      .catch(() => {})
      .finally(() => vivo && setCargando(false));

    fetch("/api/negocio?ligero=1")
      .then((r) => (r.ok ? r.json() : null))
      .then(async (d) => {
        const n = d?.negocio as
          | { paleta?: Paleta | null; avatar?: string; handle?: string; nombre?: string }
          | undefined;
        if (!vivo || !n) return;
        if (n.paleta) {
          setMarca(n.paleta);
          // Y queda elegida de entrada: si se tomó el trabajo de darnos sus
          // colores, abrir en «Hueso» es ignorarlos. Solo si todavía no ha
          // tocado nada — lo que ya eligió, manda.
          setPaleta((actual) => (actual === PALETAS[0].id ? MIA : actual));
        }
        const avatar = n.avatar ? await aBitmap(n.avatar) : null;
        if (!vivo) return;
        if (avatar || n.handle?.trim() || n.nombre?.trim()) {
          setFirma({ avatar, handle: n.handle ?? "", nombre: n.nombre ?? "" });
        }
      })
      .catch(() => {});
    return () => {
      vivo = false;
    };
  }, [sesion]);

  // Las de serie, con la suya delante cuando la hay.
  const paletas = marca
    ? [{ id: MIA, nombre: "La tuya", p: marca }, ...PALETAS]
    : PALETAS;

  if (isPending) return <main className="mx-auto max-w-5xl px-6 py-14" />;

  if (!sesion) {
    return (
      <main className="mx-auto max-w-5xl px-6 py-20">
        <h1 className="text-4xl font-bold tracking-tight">Lista para subir</h1>
        <p className="mt-4 text-neutral-600 dark:text-neutral-400">Entra a tu cuenta para usarla.</p>
        <Link
          href="/entrar"
          className="mt-6 inline-block empuja rounded-full bg-teal-700 px-5 py-2.5 font-semibold text-white dark:bg-teal-600"
        >
          Entrar o crear cuenta
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-5xl px-6 py-14">
      <Barra />

      <header className="entra border-b-2 border-neutral-900 pb-7 dark:border-neutral-100">
        <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-teal-700 dark:text-teal-400">
          Función 4 · Lista para subir
        </p>
        <h1 className="mt-4 text-5xl font-bold leading-none tracking-tight">Lista para subir</h1>
        <p className="mt-4 max-w-xl text-neutral-600 dark:text-neutral-400">
          Aquí se convierte en el archivo que subes: lo que escribiste en el
          paso 3, o lo que ya grabaste por tu cuenta. Todo se arma en tu
          navegador: nada se sube a ningún servidor.
        </p>
      </header>

      {cargando ? (
        <p className="mt-9 text-sm text-neutral-500">Buscando lo último que escribiste…</p>
      ) : grabado ? (
        <YaGrabado volver={() => setGrabado(false)} marca={marca} />
      ) : !pieza ? (
        <>
          <div className="revela mt-9 rounded-lg border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900">
            <p className="text-sm leading-relaxed text-neutral-700 dark:text-neutral-300">
              Todavía no hay nada escrito que armar. Escribe una pieza en el
              paso 3 y vuelve — si es un carrusel, aquí salen las láminas listas.
            </p>
            <Link
              href="/pieza"
              className="mt-3 inline-block font-mono text-[11px] uppercase tracking-wider text-teal-700 underline underline-offset-4 hover:no-underline dark:text-teal-400"
            >
              ir a escribir la pieza →
            </Link>
          </div>
          <Puerta abrir={() => setGrabado(true)} />
        </>
      ) : esCarrusel(pieza) ? (
        <DeCarrusel
          c={pieza}
          paletas={paletas}
          paletaId={paleta}
          onPaleta={setPaleta}
          firma={firma}
          creado={creado}
          corridaId={corridaId}
        />
      ) : (
        <>
          <EsVideo
            guion={pieza as Guion}
            corridaId={corridaId}
            formato={formato}
            marca={marca}
          />
          <Puerta abrir={() => setGrabado(true)} discreta />
        </>
      )}
    </main>
  );
}

/**
 * La otra puerta: montar algo que ya está grabado.
 *
 * Discreta cuando ya hay una pieza escrita —ahí la principal es la de arriba—
 * y a la vista cuando no hay nada, que es cuando esta pantalla se quedaba en
 * un callejón sin salida.
 */
function Puerta({ abrir, discreta }: { abrir: () => void; discreta?: boolean }) {
  if (discreta) {
    return (
      <p className="revela mt-10 border-t border-neutral-200 pt-6 text-sm text-neutral-500 dark:border-neutral-800">
        ¿Grabaste otra cosa, sin guion?{" "}
        <button
          onClick={abrir}
          className="font-semibold text-teal-700 underline underline-offset-4 hover:no-underline dark:text-teal-400"
        >
          Móntala igual
        </button>{" "}
        — el guion sale de lo que dijiste.
      </p>
    );
  }

  return (
    <section
      className="revela mt-6 rounded-lg border-2 border-teal-700/40 bg-teal-50/50 p-5 dark:border-teal-400/30 dark:bg-teal-950/20"
      style={{ ["--tarda" as string]: "0.06s" }}
    >
      <p className="font-mono text-[10px] uppercase tracking-wider text-teal-700 dark:text-teal-400">
        O si no
      </p>
      <p className="mt-2 text-lg font-semibold leading-snug">Ya lo tengo grabado</p>
      <p className="mt-1.5 max-w-xl text-sm leading-relaxed text-neutral-700 dark:text-neutral-300">
        Lo tenías en la cabeza y lo dijiste. Súbelo tal cual:{" "}
        <strong>el guion sale de lo que dijiste</strong>, repartido en los
        bloques donde callaste. De ahí salen los cortes, los subtítulos, la
        carátula y las transiciones, sin pasar por el paso 3 y sin gastar una
        corrida.
      </p>
      <button
        onClick={abrir}
        className="empuja mt-4 rounded-full bg-teal-700 px-5 py-2.5 font-semibold text-white dark:bg-teal-600"
      >
        Subir lo que grabé
      </button>
    </section>
  );
}

function YaGrabado({ volver, marca }: { volver: () => void; marca: Paleta | null }) {
  return (
    <section className="revela mt-9">
      <div className="rounded-lg border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <p className="font-semibold">Lo que grabaste, sin guion escrito</p>
          <button
            onClick={volver}
            className="font-mono text-[11px] uppercase tracking-wider text-teal-700 underline underline-offset-4 hover:no-underline dark:text-teal-400"
          >
            volver a lo escrito
          </button>
        </div>
        <p className="mt-2 text-sm leading-relaxed text-neutral-700 dark:text-neutral-300">
          Súbelo y saca los subtítulos: de ahí sale el guion, con tus palabras y
          sin cambiar ninguna. Lo único que no se puede sacar de tu voz es qué
          imagen va encima de cada bloque, y eso se pide aparte en el paso 3b.
        </p>
      </div>

      <Editor deLaVoz marca={marca} />
    </section>
  );
}

type Opcion = { id: string; nombre: string; p: Paleta };

/**
 * Su foto, de base64 a algo que el canvas sepa pintar.
 *
 * Un `<img>` suelto también valdría, pero su `width` no es el del archivo hasta
 * que el navegador lo coloca, y aquí nunca se coloca: se pinta. El bitmap trae
 * sus medidas de verdad.
 */
async function aBitmap(base64: string): Promise<ImageBitmap | null> {
  try {
    const r = await fetch(`data:image/jpeg;base64,${base64}`);
    return await createImageBitmap(await r.blob());
  } catch {
    return null;
  }
}

function DeCarrusel({
  c,
  paletas,
  paletaId,
  onPaleta,
  firma,
  creado,
  corridaId,
}: {
  c: Carrusel;
  paletas: Opcion[];
  paletaId: string;
  onPaleta: (id: string) => void;
  firma: Marca | null;
  creado: string | null;
  corridaId: string | null;
}) {
  const lienzos = useRef<(HTMLCanvasElement | null)[]>([]);
  const [bajando, setBajando] = useState(false);
  const [bajado, setBajado] = useState(false);
  // Las fotos viven solo en esta pantalla: no se suben, no se guardan.
  const [fotos, setFotos] = useState<Record<number, ImageBitmap>>({});
  const [buscando, setBuscando] = useState<number | null>(null);
  const paleta: Paleta = (paletas.find((p) => p.id === paletaId) ?? paletas[0]).p;
  const total = c.laminas?.length ?? 0;
  /**
   * El estilo con el que se escribió, y que se puede repintar.
   *
   * Arranca en el que eligió en el paso 3 porque el texto se midió para ese;
   * cambiarlo aquí no gasta corrida —los dos estilos saben pintar los seis
   * moldes— pero en el cuaderno el renglón es más corto, así que la pantalla
   * lo dice en vez de dejar que lo descubra viendo un titular apretado.
   */
  const [estilo, setEstilo] = useState<Estilo>(esEstilo(c.estilo) ? c.estilo : "limpio");
  /**
   * El molde que el dueño eligió a mano para una lámina, si lo cambió.
   *
   * El reparto automático acierta casi siempre, pero «casi» no es «siempre», y
   * dejar la pantalla sin forma de corregirlo convertía un acierto del 90% en
   * una lámina que no se puede arreglar. Vacío = el que escribió el modelo.
   */
  const [moldes, setMoldes] = useState<Record<number, Molde>>({});
  const conMolde = useCallback(
    (l: Lamina): Lamina => (moldes[l.numero] ? { ...l, molde: moldes[l.numero] } : l),
    [moldes],
  );
  const mano = manuscrita.style.fontFamily;

  useEffect(() => {
    let vivo = true;
    // Se espera a la letra a mano antes de pintar: el canvas no espera a nada y
    // pintaría la primera pasada con la de palo, sin avisar.
    void (async () => {
      if (estilo === "cuaderno") await esperarFuente(mano);
      if (!vivo) return;
      c.laminas?.forEach((l, i) => {
        const lienzo = lienzos.current[i];
        if (lienzo) {
          dibujar(lienzo, l, {
            paleta,
            estilo,
            total,
            foto: fotos[l.numero],
            marca: firma,
            mano,
          });
        }
      });
    })();
    return () => {
      vivo = false;
    };
  }, [c.laminas, paleta, estilo, total, fotos, firma, mano, conMolde]);

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
      if (i === undefined) {
        void apuntarHecho({
          tipo: "carrusel",
          titulo: c.laminas[0]?.titular ?? "",
          detalle: `${total} láminas`,
          corridaId,
          // La primera lámina, que es la que se ve en el feed.
          portada: lienzos.current[0] ? deLienzo(lienzos.current[0]) : null,
        });
        setBajado(true);
      }
    } finally {
      setBajando(false);
    }
  }

  return (
    <section className="revela mt-9" style={{ ["--tarda" as string]: "0.04s" }}>
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
          className="empuja rounded-full bg-teal-700 px-5 py-2.5 font-semibold text-white transition hover:bg-teal-800 disabled:opacity-40 dark:bg-teal-600 dark:hover:bg-teal-500"
        >
          {bajando ? "Bajando…" : bajado ? "Volver a bajarlas" : "Bajar las láminas"}
        </button>
      </div>

      {bajado && <Siguiente que="El carrusel ya está en tu carpeta de descargas." />}

      <fieldset className="mt-5">
        <legend className="font-mono text-[10px] uppercase tracking-wider text-neutral-500">
          Estilo
        </legend>
        <p className="mb-2 mt-0.5 text-xs text-neutral-500">
          Repintar no gasta corrida. Ojo con una cosa: el texto se escribió
          midiendo para el que elegiste en el paso 3 —en cuaderno el renglón es
          más corto—, así que al cambiar revisa que todo siga cabiendo.
        </p>
        <div className="flex flex-wrap gap-2">
          {ESTILOS.map((e) => (
            <button
              key={e.id}
              onClick={() => setEstilo(e.id)}
              title={e.que}
              className={`rounded-lg border px-3 py-1.5 text-sm transition ${
                estilo === e.id
                  ? "border-teal-700 font-semibold dark:border-teal-400"
                  : "border-neutral-300 hover:border-teal-700 dark:border-neutral-700 dark:hover:border-teal-400"
              }`}
            >
              {e.nombre}
              {c.estilo === e.id && (
                <span className="ml-1.5 font-mono text-[10px] uppercase text-neutral-500">
                  escrito para este
                </span>
              )}
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset className="mt-5">
        <legend className="font-mono text-[10px] uppercase tracking-wider text-neutral-500">
          Colores
        </legend>
        <p className="mb-2 mt-0.5 text-xs text-neutral-500">
          Uno manda, uno para el texto, uno que resalta — la regla 60-30-10.
        </p>
        <div className="flex flex-wrap gap-2">
          {paletas.map((p) => (
            <button
              key={p.id}
              onClick={() => onPaleta(p.id)}
              className={`flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm transition ${
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
              className="w-full rounded-lg border border-neutral-200 dark:border-neutral-800"
            />
            <div className="mt-1.5 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
              <p className="font-mono text-[10px] uppercase tracking-wider text-neutral-500">
                lámina {l.numero}
                {l.numero > 1 && (
                  <>
                    {" · "}
                    <select
                      aria-label={`molde de la lámina ${l.numero}`}
                      value={moldeDe(conMolde(l), total)}
                      onChange={(e) =>
                        setMoldes((m) => ({ ...m, [l.numero]: e.target.value as Molde }))
                      }
                      className="cursor-pointer rounded border border-neutral-300 bg-transparent px-1 py-0.5 font-mono text-[10px] uppercase tracking-wider text-teal-700 outline-none dark:border-neutral-700 dark:text-teal-400"
                    >
                      {moldesPosibles(l, total).map((m) => (
                        <option key={m} value={m}>
                          {NOMBRE_MOLDE[m]}
                        </option>
                      ))}
                    </select>
                  </>
                )}
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
          <p className="mt-2 whitespace-pre-wrap rounded-lg border-l-2 border-teal-700 bg-neutral-50 p-3 text-sm leading-relaxed dark:border-teal-400 dark:bg-neutral-950">
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
    <div className="mt-2 rounded-lg border border-neutral-200 bg-neutral-50 p-3 dark:border-neutral-800 dark:bg-neutral-950">
      <div className="flex flex-wrap gap-2">
        <input
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && buscar()}
          className="min-w-0 flex-1 rounded-lg border border-neutral-300 bg-white px-2 py-1.5 text-sm outline-none focus:border-teal-700 dark:border-neutral-700 dark:bg-neutral-900 dark:focus:border-teal-400"
        />
        <button
          onClick={buscar}
          disabled={cargando || !texto.trim()}
          className="rounded-lg border border-teal-700 px-3 py-1.5 font-mono text-[11px] uppercase tracking-wider text-teal-700 transition hover:bg-teal-50 disabled:opacity-40 dark:border-teal-400 dark:text-teal-400 dark:hover:bg-teal-950/40"
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
                className="overflow-hidden rounded-lg border border-neutral-300 transition hover:border-teal-700 dark:border-neutral-700 dark:hover:border-teal-400"
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

function EsVideo({
  guion,
  corridaId,
  formato,
  marca,
}: {
  guion: Guion;
  corridaId: string | null;
  formato: string;
  marca: Paleta | null;
}) {
  const graba = grabaDe(formato);
  return (
    <section className="revela mt-9" style={{ ["--tarda" as string]: "0.08s" }}>
      <div className="rounded-lg border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900">
        <p className="font-semibold">
          {graba === "audio"
            ? "Tu guion de voz en off, listo para montar"
            : "Tu guion de video, listo para montar"}
        </p>
        <p className="mt-2 text-sm leading-relaxed text-neutral-700 dark:text-neutral-300">
          {graba === "audio"
            ? "Graba solo tu voz —una nota de voz sirve— y súbela aquí. El sistema arma el video con las imágenes del guion, le pone tu voz encima y quema los subtítulos."
            : "Graba con el teléfono y súbelo aquí. Se cortan los silencios, se recorta a 9:16 y se queman los subtítulos —todo dentro de tu navegador— y sale el MP4 que subes a Instagram o TikTok."}
        </p>
        <details className="mt-3">
          <summary className="cursor-pointer font-mono text-[11px] uppercase tracking-wider text-teal-700 dark:text-teal-400">
            ver el guion mientras grabo
          </summary>
          <div className="mt-3 space-y-2 border-l-2 border-neutral-200 pl-4 text-sm dark:border-neutral-800">
            {/* El primer golpe ES el gancho, literal: escribirlo además arriba
                lo dejaba dos veces seguidas en el guion que lee mientras
                graba. El primero va en negrita, que es lo que marcaba. */}
            {!mismaFrase(guion.gancho, guion.golpes[0]?.texto) && (
              <p className="font-semibold">{guion.gancho}</p>
            )}
            {guion.golpes.map((g, i) => (
              <p
                key={i}
                className={
                  i === 0 && mismaFrase(guion.gancho, g.texto)
                    ? "font-semibold"
                    : "text-neutral-700 dark:text-neutral-300"
                }
              >
                {g.texto}
                {g.direccion && (
                  <span className="block text-xs font-normal italic text-neutral-500">
                    {g.direccion}
                  </span>
                )}
              </p>
            ))}
            <p className="text-neutral-700 dark:text-neutral-300">{guion.cierre.texto}</p>
          </div>
        </details>
      </div>

      <Editor
        guion={guion}
        corridaId={corridaId}
        graba={graba === "audio" ? "audio" : "video"}
        marca={marca}
      />
    </section>
  );
}

/**
 * Qué hacer después.
 *
 * La pantalla se acababa en un botón de descargar: se bajaba el archivo y el
 * sistema se quedaba callado, como si la cadena terminara ahí. La cadena
 * termina cuando hay otra pieza escrita.
 */
export function Siguiente({ que }: { que: string }) {
  return (
    <div className="mt-6 rounded-lg border border-teal-700/30 bg-teal-50/60 p-5 dark:border-teal-400/25 dark:bg-teal-950/20">
      <p className="font-semibold">{que}</p>
      <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
        Ya cuenta como hecho. Lo siguiente es la pieza del día que viene.
      </p>
      <div className="mt-4 flex flex-wrap gap-3">
        <Link
          href="/semana"
          className="empuja rounded-full bg-teal-700 px-5 py-2.5 font-semibold text-white dark:bg-teal-600"
        >
          Escribir la siguiente
        </Link>
        <Link
          href="/hecho"
          className="rounded-full border border-neutral-300 px-5 py-2.5 font-semibold transition-colors hover:border-teal-700 hover:text-teal-700 dark:border-neutral-700 dark:hover:border-teal-400 dark:hover:text-teal-400"
        >
          Ver lo que llevo hecho
        </Link>
      </div>
    </div>
  );
}
