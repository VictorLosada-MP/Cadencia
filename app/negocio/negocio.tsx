"use client";

import { borrar, guardar, leer } from "@/lib/guardado";
import {
  GUARDADAS,
  leerCuadricula,
  paletaGuardada,
  reducirImagen,
  type Paleta,
} from "@/lib/marca";
import { useEffect, useState } from "react";
import {
  CAMPOS_EXTRA,
  CAMPOS_NUCLEO,
  CAMPO_VOZ,
  TIPOS,
  etiquetaNombre,
  negocioListo,
  pistaNombre,
  type Negocio,
  type TipoNegocio,
} from "@/types/negocio";

/** El negocio en blanco: lo mismo que ve alguien que llega por primera vez. */
export const NEGOCIO_VACIO: Negocio = {
  tipo: "",
  nombre: "",
  oferta: "",
  cliente: "",
  despues: "",
};

const BORRADOR = "negocio";

/**
 * Lo que está escrito y sin guardar.
 *
 * Existe porque sin esto se perdía: escribías media oferta, te ibas a la
 * semana, volvías, y el campo había vuelto solo a la versión vieja del
 * servidor. Parecía que no guardaba — y en realidad es que nunca llegó a
 * guardarse, y encima lo tapaba con lo de antes.
 *
 * **El borrador gana sobre lo del servidor** mientras exista. Se borra al
 * guardar, que es el único momento en que lo del servidor ya es lo suyo.
 */
export const leerBorrador = (de: string | undefined) => leer<Negocio>(BORRADOR, de);
export const guardarBorrador = (de: string | undefined, n: Negocio) => guardar(BORRADOR, de, n);
export const borrarBorrador = (de: string | undefined) => borrar(BORRADOR, de);

/**
 * Avisa antes de cerrar la pestaña con algo escrito y sin guardar.
 *
 * El borrador ya lo recupera todo, pero un aviso del propio navegador es la
 * única forma de parar a alguien que está a punto de cerrar sin darse cuenta.
 */
export function useAvisarSinGuardar(hay: boolean) {
  useEffect(() => {
    if (!hay) return;
    const avisar = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", avisar);
    return () => window.removeEventListener("beforeunload", avisar);
  }, [hay]);
}

/** ¿Hay algo escrito de verdad? Un borrador todo en blanco no es un borrador. */
export function tieneAlgo(n: Negocio | null): boolean {
  return Boolean(
    n && Object.values(n).some((v) => typeof v === "string" && v.trim().length > 0),
  );
}

/**
 * Lo que devuelve /api/negocio, ya normalizado a cadenas. La base guarda null
 * en lo opcional y un textarea con value={null} deja de ser controlado.
 */
export function desdeBase(n: Record<string, unknown>): Negocio {
  const t = (v: unknown) => (typeof v === "string" ? v : "");
  const tipo = t(n.tipo);
  return {
    tipo: (tipo === "empresa" || tipo === "persona" ? tipo : "") as TipoNegocio,
    nombre: t(n.nombre),
    oferta: t(n.oferta),
    cliente: t(n.cliente),
    despues: t(n.despues),
    freno: t(n.freno),
    accion: t(n.accion),
    voz: t(n.voz),
    // Vale tanto la paleta ya armada como las tres columnas sueltas: por la
    // API llega armada, pero el borrador de una pestaña vieja puede traer lo
    // otro, y perder los colores al recargar sería el mismo fallo de antes.
    paleta:
      (n.paleta as Paleta | null | undefined) ??
      paletaGuardada(n as Parameters<typeof paletaGuardada>[0]),
    handle: t(n.handle),
    avatar: t(n.avatar),
    cuadricula: t(n.cuadricula),
    senales: t(n.senales),
  };
}

export function BloqueNegocio({
  negocio,
  onCambio,
  guardado,
  onGuardado,
}: {
  negocio: Negocio;
  onCambio: (c: Partial<Negocio>) => void;
  guardado: boolean;
  onGuardado: () => void;
}) {
  const [abierto, setAbierto] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [fallo, setFallo] = useState("");

  async function guardar() {
    setGuardando(true);
    setFallo("");
    try {
      const r = await fetch("/api/negocio", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(negocio),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error ?? "No se pudo guardar.");
      onGuardado();
    } catch (e) {
      setFallo(e instanceof Error ? e.message : "No se pudo guardar.");
    } finally {
      setGuardando(false);
    }
  }

  const falta = [
    !negocio.tipo && "decir si es una empresa o eres tú",
    !negocio.nombre?.trim() && etiquetaNombre(negocio.tipo).toLowerCase(),
    ...CAMPOS_NUCLEO.filter((c) => !negocio[c.id]?.trim()).map((c) =>
      c.etiqueta.toLowerCase(),
    ),
  ].filter((x): x is string => Boolean(x));

  return (
    <div className="rounded-lg border border-neutral-300 bg-white p-4 dark:border-neutral-700 dark:bg-neutral-900">
      <div className="space-y-3">
          {/*
            Quién es, antes de qué vende.
            El diagnóstico juzga el nombre del perfil como su primer punto, y
            ese juicio es distinto según el caso: una empresa ya tiene nombre
            registrado y lo que se corrige es lo que va al lado; una marca
            personal se llama como su dueño y ahí el arreglo sí es el nombre.
            Hasta ahora no se preguntaba, así que corregía a ciegas.
          */}
          <fieldset>
            <legend className="font-mono text-[10px] uppercase tracking-wider text-neutral-500">
              Tu negocio es
            </legend>
            <div className="mt-1.5 flex flex-wrap gap-2">
              {TIPOS.map((t) => {
                const puesto = negocio.tipo === t.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    aria-pressed={puesto}
                    onClick={() => onCambio({ tipo: t.id })}
                    title={t.pista}
                    className={`empuja rounded-full border px-3.5 py-1.5 text-sm transition ${
                      puesto
                        ? "border-teal-700 bg-teal-50 font-semibold text-teal-800 dark:border-teal-400 dark:bg-teal-950/40 dark:text-teal-300"
                        : "border-neutral-300 text-neutral-600 hover:border-teal-700 dark:border-neutral-700 dark:text-neutral-400 dark:hover:border-teal-400"
                    }`}
                  >
                    {t.etiqueta}
                  </button>
                );
              })}
            </div>
            <p className="mt-1.5 text-xs text-neutral-500">
              {TIPOS.find((t) => t.id === negocio.tipo)?.pista ??
                "Cambia lo que el diagnóstico te puede corregir del nombre."}
            </p>
          </fieldset>

          <div>
            <label
              htmlFor="nombre"
              className="font-mono text-[10px] uppercase tracking-wider text-neutral-500"
            >
              {etiquetaNombre(negocio.tipo)}
            </label>
            <input
              id="nombre"
              type="text"
              value={negocio.nombre ?? ""}
              onChange={(e) => onCambio({ nombre: e.target.value })}
              placeholder={pistaNombre(negocio.tipo)}
              className="mt-1 w-full rounded-lg border border-neutral-300 bg-neutral-50 p-2 text-sm outline-none focus:border-teal-700 dark:border-neutral-700 dark:bg-neutral-950 dark:focus:border-teal-400"
            />
          </div>

          {CAMPOS_NUCLEO.map((c) => (
            <div key={c.id}>
              <label
                htmlFor={c.id}
                className="font-mono text-[10px] uppercase tracking-wider text-neutral-500"
              >
                {c.etiqueta}
              </label>
              <textarea
                id={c.id}
                value={negocio[c.id] ?? ""}
                onChange={(e) => onCambio({ [c.id]: e.target.value })}
                rows={c.filas}
                placeholder={c.pista}
                className="mt-1 w-full rounded-lg border border-neutral-300 bg-neutral-50 p-2 text-sm leading-relaxed outline-none focus:border-teal-700 dark:border-neutral-700 dark:bg-neutral-950 dark:focus:border-teal-400"
              />
            </div>
          ))}

          <div className="rounded-lg border border-neutral-300 bg-neutral-50 p-3 dark:border-neutral-700 dark:bg-neutral-950">
            <label
              htmlFor={CAMPO_VOZ.id}
              className="font-mono text-[10px] uppercase tracking-wider text-neutral-500"
            >
              {CAMPO_VOZ.etiqueta}
            </label>
            <p className="mb-1.5 mt-0.5 text-sm text-neutral-600 dark:text-neutral-400">
              {CAMPO_VOZ.pista}.
            </p>
            <p className="mb-2 text-xs text-amber-700 dark:text-amber-500">
              El diagnóstico funciona sin esto, pero sale en español llano.{" "}
              <strong>El guion no se escribe sin esto</strong> — es lo que hace que
              suene a ti y no a cualquiera.
            </p>
            <textarea
              id={CAMPO_VOZ.id}
              value={negocio.voz ?? ""}
              onChange={(e) => onCambio({ voz: e.target.value })}
              rows={CAMPO_VOZ.filas}
              className="w-full rounded-lg border border-neutral-300 bg-white p-2 text-sm leading-relaxed outline-none focus:border-teal-700 dark:border-neutral-700 dark:bg-neutral-900 dark:focus:border-teal-400"
            />
          </div>

          <BloqueMarca negocio={negocio} onCambio={onCambio} />

          <button
            onClick={() => setAbierto(!abierto)}
            className="font-mono text-[11px] uppercase tracking-wider text-teal-700 underline underline-offset-4 hover:no-underline dark:text-teal-400"
          >
            {abierto ? "− ocultar lo opcional" : "+ afinar más (opcional)"}
          </button>

          {abierto &&
            CAMPOS_EXTRA.map((c) => (
              <div key={c.id}>
                <label
                  htmlFor={c.id}
                  className="font-mono text-[10px] uppercase tracking-wider text-neutral-500"
                >
                  {c.etiqueta}
                </label>
                <textarea
                  id={c.id}
                  value={negocio[c.id] ?? ""}
                  onChange={(e) => onCambio({ [c.id]: e.target.value })}
                  rows={c.filas}
                  placeholder={c.pista}
                  className="mt-1 w-full rounded-lg border border-neutral-300 bg-neutral-50 p-2 text-sm leading-relaxed outline-none focus:border-teal-700 dark:border-neutral-700 dark:bg-neutral-950 dark:focus:border-teal-400"
                />
              </div>
            ))}

          {/*
            Qué falta, por su nombre. Un botón apagado sin decir por qué deja
            a la gente tocándolo: ya pasó con el de la pieza.
          */}
          {falta.length > 0 && (
            <p className="text-xs text-amber-700 dark:text-amber-500">
              Falta {falta.join(", ")}.
            </p>
          )}

          <div className="flex flex-wrap items-center gap-3 pt-1">
            <button
              onClick={guardar}
              disabled={guardando || guardado || !negocioListo(negocio)}
              className="empuja rounded-lg border border-teal-700 px-4 py-2 font-semibold text-teal-700 transition hover:bg-teal-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-teal-400 dark:text-teal-400 dark:hover:bg-teal-950/40"
            >
              {guardando ? "Guardando…" : guardado ? "Guardado" : "Guardar mi negocio"}
            </button>
            {guardado && (
              <span className="text-xs text-neutral-500">
                Se llena una vez. La próxima visita ya está aquí.
              </span>
            )}
          </div>
          {fallo && <p className="text-xs text-red-700 dark:text-red-400">{fallo}</p>}
      </div>
    </div>
  );
}

const CLAVES: { id: keyof Paleta; etiqueta: string; papel: string }[] = [
  { id: "fondo", etiqueta: "Fondo", papel: "el que manda" },
  { id: "tinta", etiqueta: "Texto", papel: "lo que se lee" },
  { id: "acento", etiqueta: "Acento", papel: "lo que remata" },
];

/**
 * Los colores de su marca, sacados de su propia cuadrícula.
 *
 * Por qué una captura y no un selector de colores en blanco: nadie se sabe de
 * memoria el hexadecimal de su marca, pero todo el mundo tiene su cuadrícula a
 * un pantallazo de distancia, y ahí están los colores que ya usa.
 *
 * La captura NO se sube ni se guarda: los colores se cuentan aquí, en el
 * navegador, y lo que viaja son tres cadenas de siete caracteres. Y se pueden
 * cambiar a mano, porque en una captura también salen la interfaz de Instagram
 * y su foto de perfil: esto propone, no decide.
 */
/**
 * Su marca: los colores, su cara y su arroba.
 *
 * Están juntos porque son lo mismo —lo que hace que una pieza se reconozca como
 * suya— y porque se llenan de una vez, no cada vez que se publica.
 *
 * La cuadrícula se guarda reducida; la foto también. Es un cambio respecto a
 * antes, cuando ninguna captura se guardaba, y es deliberado: una lámina que
 * lleva su cara impresa no puede depender de que vuelva a subir la foto en
 * cada aparato desde el que entre. La captura del PERFIL del diagnóstico sigue
 * sin guardarse — ahí salen mensajes de terceros, y eso no es suyo.
 */
function BloqueMarca({
  negocio,
  onCambio,
}: {
  negocio: Negocio;
  onCambio: (c: Partial<Negocio>) => void;
}) {
  const [leyendo, setLeyendo] = useState<"cuadricula" | "avatar" | null>(null);
  const [fallo, setFallo] = useState("");
  const paleta = negocio.paleta ?? null;

  /**
   * De la cuadrícula salen dos cosas de una sola lectura: los colores y la
   * copia reducida. Se hacen en el mismo paso para no pedirle la captura dos
   * veces ni decodificar el mismo archivo dos veces.
   */
  async function tomarCuadricula(archivo: File | null) {
    if (!archivo) return;
    setLeyendo("cuadricula");
    setFallo("");
    const leida = await leerCuadricula(archivo);
    setLeyendo(null);
    if (!leida) {
      setFallo(
        "No pude leer esa imagen. Prueba con un PNG o un JPG de la cuadrícula, o con un recorte si pesa mucho.",
      );
      return;
    }
    onCambio({ paleta: leida.paleta, cuadricula: leida.guardable });
  }

  async function leerAvatar(archivo: File | null) {
    if (!archivo) return;
    setLeyendo("avatar");
    setFallo("");
    const chico = await reducirImagen(archivo, GUARDADAS.avatar.lado, GUARDADAS.avatar.calidad);
    setLeyendo(null);
    if (!chico || chico.length > GUARDADAS.avatar.tope) {
      setFallo("No pude usar esa foto. Prueba con un PNG o un JPG más pequeño.");
      return;
    }
    onCambio({ avatar: chico });
  }

  return (
    <div className="rounded-lg border border-neutral-300 bg-neutral-50 p-3 dark:border-neutral-700 dark:bg-neutral-950">
      <p className="font-mono text-[10px] uppercase tracking-wider text-neutral-500">
        Tu marca
      </p>
      <p className="mb-3 mt-0.5 text-sm text-neutral-600 dark:text-neutral-400">
        Tu cara, tu arroba y tus colores. Es lo que va impreso en las láminas de
        tus carruseles y en la carátula de tus videos — hoy salen con los
        colores de serie, iguales para todos.
      </p>

      {/* ── La cara y el arroba ─────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-3">
          {negocio.avatar ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={`data:image/jpeg;base64,${negocio.avatar}`}
              alt="tu foto de perfil"
              className="h-14 w-14 rounded-full border border-neutral-300 object-cover dark:border-neutral-700"
            />
          ) : (
            <span
              aria-hidden
              className="flex h-14 w-14 items-center justify-center rounded-full border border-dashed border-neutral-300 text-[10px] text-neutral-400 dark:border-neutral-700"
            >
              sin foto
            </span>
          )}
          <span className="flex flex-col gap-1">
            <Captura
              leyendo={leyendo === "avatar"}
              onArchivo={leerAvatar}
              etiqueta={negocio.avatar ? "Cambiar la foto" : "Subir tu foto de perfil"}
            />
            {negocio.avatar && (
              <button
                type="button"
                onClick={() => onCambio({ avatar: "" })}
                className="text-left font-mono text-[11px] uppercase tracking-wider text-neutral-500 underline underline-offset-4 hover:no-underline"
              >
                quitar la foto
              </button>
            )}
          </span>
        </div>

        <label className="block">
          <span className="font-mono text-[10px] uppercase tracking-wider text-neutral-500">
            Tu arroba
          </span>
          <span className="mt-1 flex items-center rounded-lg border border-neutral-300 bg-white pl-2 focus-within:border-teal-700 dark:border-neutral-700 dark:bg-neutral-900 dark:focus-within:border-teal-400">
            <span className="text-sm text-neutral-400">@</span>
            <input
              type="text"
              value={negocio.handle ?? ""}
              onChange={(e) =>
                // El «@» se escribe solo delante: si lo pega también él, en la
                // lámina salían dos.
                onCambio({ handle: e.target.value.replace(/^@+/, "") })
              }
              placeholder="tu_usuario"
              className="w-44 bg-transparent p-2 text-sm outline-none"
            />
          </span>
        </label>
      </div>

      {/* ── Los colores ─────────────────────────────────────────────────── */}
      <p className="mt-5 font-mono text-[10px] uppercase tracking-wider text-neutral-500">
        Tus colores
      </p>
      <p className="mb-2 mt-0.5 text-sm text-neutral-600 dark:text-neutral-400">
        Sube un pantallazo de tu cuadrícula y saco de ahí los colores que ya
        usas. Se guarda la captura reducida, para que esté aquí cuando entres
        desde otro aparato.
      </p>

      {paleta ? (
        <>
          <div className="flex flex-wrap items-end gap-3">
            {CLAVES.map((c) => (
              <label key={c.id} className="block">
                <span className="font-mono text-[10px] uppercase tracking-wider text-neutral-500">
                  {c.etiqueta}
                </span>
                <span className="mt-1 flex items-center gap-2">
                  <input
                    type="color"
                    aria-label={c.etiqueta}
                    value={paleta[c.id]}
                    onChange={(e) =>
                      onCambio({ paleta: { ...paleta, [c.id]: e.target.value.toUpperCase() } })
                    }
                    className="h-9 w-9 cursor-pointer rounded border border-neutral-300 bg-transparent p-0.5 dark:border-neutral-700"
                  />
                  <span className="font-mono text-[11px] tabular-nums text-neutral-500">
                    {paleta[c.id]}
                    <span className="block text-[10px]">{c.papel}</span>
                  </span>
                </span>
              </label>
            ))}
          </div>

          <div className="mt-3 flex flex-wrap items-start gap-3">
            {/* Una lámina en pequeño. Tres cuadraditos de color no dicen si la
                combinación se lee; un titular sobre el fondo, sí. */}
            <div
              className="min-w-56 flex-1 rounded-lg p-4"
              style={{ backgroundColor: paleta.fondo }}
              aria-label="así se verá una lámina"
            >
              <div className="flex items-center gap-2">
                {negocio.avatar && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={`data:image/jpeg;base64,${negocio.avatar}`}
                    alt=""
                    className="h-6 w-6 rounded-full object-cover"
                  />
                )}
                {negocio.handle?.trim() && (
                  <span className="font-mono text-[10px]" style={{ color: paleta.tinta }}>
                    @{negocio.handle.trim()}
                  </span>
                )}
              </div>
              <div
                className="mb-2 mt-2 h-1.5 w-12 rounded-full"
                style={{ backgroundColor: paleta.acento }}
              />
              <p className="text-base font-bold leading-snug" style={{ color: paleta.tinta }}>
                Así se va a leer tu titular
              </p>
              <p className="mt-1 font-mono text-[11px]" style={{ color: paleta.acento }}>
                01 / 05
              </p>
            </div>

            {negocio.cuadricula && (
              <figure className="w-28">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`data:image/jpeg;base64,${negocio.cuadricula}`}
                  alt="la cuadrícula de la que salieron tus colores"
                  className="w-full rounded-lg border border-neutral-300 dark:border-neutral-700"
                />
                <figcaption className="mt-1 text-[10px] text-neutral-500">
                  de aquí salieron
                </figcaption>
              </figure>
            )}
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-4">
            <Captura
              leyendo={leyendo === "cuadricula"}
              onArchivo={tomarCuadricula}
              etiqueta="Leer otra captura"
            />
            <button
              type="button"
              onClick={() => onCambio({ paleta: null, cuadricula: "" })}
              className="font-mono text-[11px] uppercase tracking-wider text-neutral-500 underline underline-offset-4 hover:no-underline"
            >
              volver a los de serie
            </button>
          </div>
        </>
      ) : (
        <Captura
          leyendo={leyendo === "cuadricula"}
          onArchivo={tomarCuadricula}
          etiqueta="Subir captura de la cuadrícula"
        />
      )}

      {fallo && <p className="mt-2 text-xs text-red-700 dark:text-red-400">{fallo}</p>}
    </div>
  );
}

function Captura({
  leyendo,
  onArchivo,
  etiqueta,
}: {
  leyendo: boolean;
  onArchivo: (f: File | null) => void;
  etiqueta: string;
}) {
  return (
    <label className="inline-block cursor-pointer rounded-lg border border-neutral-300 px-3 py-1.5 text-sm transition hover:border-teal-700 dark:border-neutral-700 dark:hover:border-teal-400">
      {leyendo ? "Leyendo los colores…" : etiqueta}
      <input
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          onArchivo(e.target.files?.[0] ?? null);
          // Se limpia para que subir la MISMA captura otra vez vuelva a
          // disparar el cambio. Sin esto, el segundo intento no hace nada.
          e.target.value = "";
        }}
      />
    </label>
  );
}
