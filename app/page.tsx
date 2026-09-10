"use client";

import { useState } from "react";
import type { Imagen } from "@/lib/modelo";
import type { Diagnostico, DiagnosticoRed } from "@/types/diagnostico";
import {
  MAX_PIEZAS,
  MAX_REDES,
  PLATAFORMAS,
  nombreRed,
  piezaTieneContenido,
  tieneContenido,
  type EntradaPieza,
  type EntradaRed,
  type Plataforma,
} from "@/types/entrada";

/**
 * Las capturas de un teléfono pesan varios megas y el modelo no aprovecha más
 * de ~1800px de lado largo. Se reducen aquí y no en el servidor: así lo que
 * viaja por la red ya es lo que hace falta, y nada más.
 */
async function comprimir(file: File): Promise<Imagen> {
  const bitmap = await createImageBitmap(file);
  const LADO = 1800;
  const escala = Math.min(1, LADO / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * escala);
  const h = Math.round(bitmap.height * escala);

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("No se pudo leer la imagen.");
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();

  // Calidad alta a propósito: aquí lo que importa es que el texto se lea.
  const url = canvas.toDataURL("image/jpeg", 0.9);
  return { media_type: "image/jpeg", data: url.split(",")[1] };
}

const fuente = (i: Imagen) => `data:${i.media_type};base64,${i.data}`;

export default function Home() {
  const [redes, setRedes] = useState<EntradaRed[]>([{ plataforma: "Instagram" }]);
  const [piezas, setPiezas] = useState<EntradaPieza[]>([]);
  const [respuestas, setRespuestas] = useState<Record<string, string>>({});
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState("");
  const [dx, setDx] = useState<Diagnostico | null>(null);

  const listas = redes.filter(tieneContenido);

  function cambiarRed(i: number, cambio: Partial<EntradaRed>) {
    setRedes(redes.map((r, j) => (i === j ? { ...r, ...cambio } : r)));
  }

  function cambiarPieza(i: number, cambio: Partial<EntradaPieza>) {
    setPiezas(piezas.map((p, j) => (i === j ? { ...p, ...cambio } : p)));
  }

  async function diagnosticar(conRespuestas = false) {
    setCargando(true);
    setError("");
    try {
      const r = await fetch("/api/diagnostico", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          perfilId: "victor",
          redes: listas,
          piezas: piezas.filter(piezaTieneContenido),
          respuestas: conRespuestas
            ? Object.entries(respuestas)
                .filter(([, v]) => v.trim())
                .map(([pregunta, respuesta]) => ({ pregunta, respuesta }))
            : undefined,
        }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error ?? "Falló el diagnóstico.");
      setDx(d.diagnostico);
      if (!conRespuestas) setRespuestas({});
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error inesperado.");
    } finally {
      setCargando(false);
    }
  }

  const hayRespuestas = Object.values(respuestas).some((v) => v.trim());

  return (
    <main className="mx-auto max-w-3xl px-6 py-14">
      <header className="border-b-2 border-neutral-900 pb-7 dark:border-neutral-100">
        <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-teal-700 dark:text-teal-400">
          Función 1 · Diagnóstico
        </p>
        <h1 className="mt-4 text-5xl font-bold leading-none tracking-tight">
          Cadencia
        </h1>
        <p className="mt-4 max-w-xl text-neutral-600 dark:text-neutral-400">
          Qué le está costando conversaciones a tu perfil, con el texto ya
          corregido. Sube una captura — es lo que ve quien llega a tu perfil.
        </p>
      </header>

      <section className="mt-9">
        <h2 className="font-mono text-[11px] uppercase tracking-[0.12em] text-neutral-500">
          Tu perfil
        </h2>
        <p className="mb-3 mt-0.5 text-sm text-neutral-500">
          Con una red basta para empezar. La segunda sirve para ver si dices lo
          mismo en las dos.
        </p>

        <div className="space-y-3">
          {redes.map((r, i) => (
            <TarjetaRed
              key={i}
              red={r}
              indice={i}
              puedeQuitar={redes.length > 1}
              onCambio={(c) => cambiarRed(i, c)}
              onQuitar={() => setRedes(redes.filter((_, j) => j !== i))}
            />
          ))}
        </div>

        {redes.length < MAX_REDES ? (
          <button
            onClick={() => setRedes([...redes, { plataforma: "LinkedIn" }])}
            className="mt-3 font-mono text-[11px] uppercase tracking-wider text-teal-700 underline underline-offset-4 hover:no-underline dark:text-teal-400"
          >
            + añadir otra red
          </button>
        ) : (
          <p className="mt-3 text-xs text-neutral-500">
            Con dos basta. Una tercera no añade lectura nueva — solo trabajo.
          </p>
        )}
      </section>

      <section className="mt-10">
        <h2 className="font-mono text-[11px] uppercase tracking-[0.12em] text-neutral-500">
          Lo que ya publicaste
        </h2>
        <p className="mb-3 mt-0.5 text-sm text-neutral-500">
          Opcional, y con tres o cuatro alcanza. No se corrige ni se borra nada:
          sirve para saber de dónde partes.
        </p>

        {piezas.length > 0 && (
          <div className="space-y-3">
            {piezas.map((p, i) => (
              <TarjetaPieza
                key={i}
                pieza={p}
                indice={i}
                onCambio={(c) => cambiarPieza(i, c)}
                onQuitar={() => setPiezas(piezas.filter((_, j) => j !== i))}
              />
            ))}
          </div>
        )}

        {piezas.length < MAX_PIEZAS && (
          <button
            onClick={() => setPiezas([...piezas, {}])}
            className="mt-3 font-mono text-[11px] uppercase tracking-wider text-teal-700 underline underline-offset-4 hover:no-underline dark:text-teal-400"
          >
            + añadir pieza
          </button>
        )}
      </section>

      <div className="mt-10">
        <button
          onClick={() => diagnosticar(false)}
          disabled={cargando || listas.length === 0}
          className="rounded bg-teal-700 px-5 py-2.5 font-semibold text-white transition hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-teal-600 dark:hover:bg-teal-500"
        >
          {cargando ? "Revisando…" : dx ? "Volver a diagnosticar" : "Diagnosticar"}
        </button>
        {cargando && (
          <p className="mt-3 text-sm text-neutral-500">
            Leyendo {listas.length === 2 ? "los dos perfiles" : "el perfil"}. Suele
            tardar cerca de un minuto.
          </p>
        )}
        {error && (
          <p className="mt-4 rounded border-l-[3px] border-red-700 bg-red-50 p-3 text-sm text-red-900 dark:bg-red-950/40 dark:text-red-200">
            {error}
          </p>
        )}
      </div>

      {dx && (
        <Resultado
          dx={dx}
          respuestas={respuestas}
          setRespuestas={setRespuestas}
          hayRespuestas={hayRespuestas}
          cargando={cargando}
          reDiagnosticar={() => diagnosticar(true)}
        />
      )}
    </main>
  );
}

function TarjetaRed({
  red,
  indice,
  puedeQuitar,
  onCambio,
  onQuitar,
}: {
  red: EntradaRed;
  indice: number;
  puedeQuitar: boolean;
  onCambio: (c: Partial<EntradaRed>) => void;
  onQuitar: () => void;
}) {
  const [pegando, setPegando] = useState(false);

  return (
    <div className="rounded border border-neutral-300 bg-white p-4 dark:border-neutral-700 dark:bg-neutral-900">
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={red.plataforma}
          onChange={(e) => onCambio({ plataforma: e.target.value as Plataforma })}
          className="rounded border border-neutral-300 bg-white px-2 py-1.5 text-sm outline-none focus:border-teal-700 dark:border-neutral-700 dark:bg-neutral-950 dark:focus:border-teal-400"
        >
          {PLATAFORMAS.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>

        {red.plataforma === "Otra" && (
          <input
            value={red.nombre ?? ""}
            onChange={(e) => onCambio({ nombre: e.target.value })}
            placeholder="¿Cuál?"
            className="w-32 rounded border border-neutral-300 bg-white px-2 py-1.5 text-sm outline-none focus:border-teal-700 dark:border-neutral-700 dark:bg-neutral-950 dark:focus:border-teal-400"
          />
        )}

        <span className="ml-auto flex items-center gap-3">
          <button
            onClick={() => setPegando(!pegando)}
            className="font-mono text-[11px] uppercase tracking-wider text-neutral-500 underline underline-offset-4 hover:text-neutral-800 hover:no-underline dark:hover:text-neutral-200"
          >
            {pegando ? "ocultar texto" : "o pegar el texto"}
          </button>
          {puedeQuitar && (
            <button
              onClick={onQuitar}
              aria-label={`Quitar la red ${indice + 1}`}
              className="font-mono text-[11px] uppercase tracking-wider text-neutral-400 hover:text-red-700 dark:hover:text-red-400"
            >
              quitar
            </button>
          )}
        </span>
      </div>

      <ZonaCaptura
        imagen={red.imagen}
        etiqueta={`captura de ${nombreRed(red)}`}
        onImagen={(imagen) => onCambio({ imagen })}
      />

      {(pegando || red.texto) && (
        <textarea
          value={red.texto ?? ""}
          onChange={(e) => onCambio({ texto: e.target.value })}
          rows={5}
          placeholder="Nombre, bio, CTA y link — tal como aparecen"
          className="mt-3 w-full rounded border border-neutral-300 bg-neutral-50 p-3 font-mono text-sm leading-relaxed outline-none focus:border-teal-700 dark:border-neutral-700 dark:bg-neutral-950 dark:focus:border-teal-400"
        />
      )}
    </div>
  );
}

function TarjetaPieza({
  pieza,
  indice,
  onCambio,
  onQuitar,
}: {
  pieza: EntradaPieza;
  indice: number;
  onCambio: (c: Partial<EntradaPieza>) => void;
  onQuitar: () => void;
}) {
  return (
    <div className="rounded border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
      <div className="flex flex-wrap items-center gap-2">
        <input
          value={pieza.red ?? ""}
          onChange={(e) => onCambio({ red: e.target.value })}
          placeholder="¿De qué red?"
          className="w-36 rounded border border-neutral-300 bg-white px-2 py-1.5 text-sm outline-none focus:border-teal-700 dark:border-neutral-700 dark:bg-neutral-950 dark:focus:border-teal-400"
        />
        <input
          value={pieza.cuando ?? ""}
          onChange={(e) => onCambio({ cuando: e.target.value })}
          placeholder="¿Cuándo? (aprox.)"
          className="w-40 rounded border border-neutral-300 bg-white px-2 py-1.5 text-sm outline-none focus:border-teal-700 dark:border-neutral-700 dark:bg-neutral-950 dark:focus:border-teal-400"
        />
        <button
          onClick={onQuitar}
          aria-label={`Quitar la pieza ${indice + 1}`}
          className="ml-auto font-mono text-[11px] uppercase tracking-wider text-neutral-400 hover:text-red-700 dark:hover:text-red-400"
        >
          quitar
        </button>
      </div>

      <textarea
        value={pieza.texto ?? ""}
        onChange={(e) => onCambio({ texto: e.target.value })}
        rows={3}
        placeholder="El texto de la pieza, o déjalo vacío y sube la captura"
        className="mt-3 w-full rounded border border-neutral-300 bg-neutral-50 p-3 text-sm leading-relaxed outline-none focus:border-teal-700 dark:border-neutral-700 dark:bg-neutral-950 dark:focus:border-teal-400"
      />

      <ZonaCaptura
        imagen={pieza.imagen}
        etiqueta={`captura de la pieza ${indice + 1}`}
        onImagen={(imagen) => onCambio({ imagen })}
        compacta
      />
    </div>
  );
}

function ZonaCaptura({
  imagen,
  etiqueta,
  onImagen,
  compacta = false,
}: {
  imagen?: Imagen;
  etiqueta: string;
  onImagen: (i: Imagen | undefined) => void;
  compacta?: boolean;
}) {
  const [ocupado, setOcupado] = useState(false);
  const [fallo, setFallo] = useState("");

  async function tomar(file: File | undefined | null) {
    if (!file) return;
    setOcupado(true);
    setFallo("");
    try {
      onImagen(await comprimir(file));
    } catch {
      setFallo("No se pudo leer esa imagen. Prueba con un PNG o un JPG.");
    } finally {
      setOcupado(false);
    }
  }

  if (imagen) {
    return (
      <div className="mt-3 flex items-start gap-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={fuente(imagen)}
          alt={etiqueta}
          className="max-h-40 rounded border border-neutral-300 dark:border-neutral-700"
        />
        <button
          onClick={() => onImagen(undefined)}
          className="font-mono text-[11px] uppercase tracking-wider text-neutral-500 underline underline-offset-4 hover:text-red-700 hover:no-underline dark:hover:text-red-400"
        >
          cambiar
        </button>
      </div>
    );
  }

  return (
    <div className={compacta ? "mt-2" : "mt-3"}>
      <label
        className="flex cursor-pointer items-center gap-2 rounded border border-dashed border-neutral-400 px-3 py-2.5 text-sm text-neutral-600 transition hover:border-teal-700 hover:text-teal-800 dark:border-neutral-600 dark:text-neutral-400 dark:hover:border-teal-400 dark:hover:text-teal-300"
        onPaste={(e) => tomar(e.clipboardData.files[0])}
      >
        <input
          type="file"
          accept="image/*"
          className="sr-only"
          onChange={(e) => tomar(e.target.files?.[0])}
        />
        {ocupado ? "Preparando…" : compacta ? "Subir captura (opcional)" : "Subir captura"}
      </label>
      {fallo && <p className="mt-1.5 text-xs text-red-700 dark:text-red-400">{fallo}</p>}
    </div>
  );
}

function Resultado({
  dx,
  respuestas,
  setRespuestas,
  hayRespuestas,
  cargando,
  reDiagnosticar,
}: {
  dx: Diagnostico;
  respuestas: Record<string, string>;
  setRespuestas: (r: Record<string, string>) => void;
  hayRespuestas: boolean;
  cargando: boolean;
  reDiagnosticar: () => void;
}) {
  return (
    <section className="mt-12 border-t border-neutral-200 pt-10 dark:border-neutral-800">
      {dx.redes?.map((r) => <BloqueRed key={r.red} r={r} />)}

      {dx.coherencia && (
        <div
          className={`mt-10 rounded border-l-[3px] p-4 ${
            dx.coherencia.dicen_lo_mismo
              ? "border-green-700 bg-green-50 dark:bg-green-950/30"
              : "border-amber-500 bg-amber-50 dark:bg-amber-950/30"
          }`}
        >
          <p className="font-mono text-[10px] uppercase tracking-wider text-neutral-600 dark:text-neutral-400">
            Entre las dos redes
          </p>
          <p className="mt-1.5 text-sm leading-relaxed">{dx.coherencia.lectura}</p>
          {!dx.coherencia.dicen_lo_mismo && (
            <p className="mt-2 text-sm font-semibold leading-relaxed">
              {dx.coherencia.que_alinear}
            </p>
          )}
        </div>
      )}

      {dx.linea_base && (
        <div className="mt-10 rounded border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900">
          <p className="font-mono text-[10px] uppercase tracking-wider text-neutral-500">
            De dónde partes
          </p>
          <p className="mt-1.5 text-sm leading-relaxed text-neutral-700 dark:text-neutral-300">
            {dx.linea_base}
          </p>
          <p className="mt-2 text-xs text-neutral-500">
            Nada de esto se corrige ni se borra. Es el punto de partida — el
            cambio se nota de aquí en adelante.
          </p>
        </div>
      )}

      {dx.preguntas?.length > 0 && (
        <>
          <h2 className="mt-10 font-mono text-[11px] uppercase tracking-[0.12em] text-neutral-500">
            Lo que le falta saber
          </h2>
          <p className="mb-3 mt-1 text-sm text-neutral-500">
            Responde lo que quieras. Cada respuesta afina el diagnóstico — y
            ninguna es obligatoria.
          </p>
          <div className="space-y-3">
            {dx.preguntas.map((q, i) => (
              <div
                key={i}
                className="rounded border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900"
              >
                <p className="font-semibold leading-snug">{q.pregunta}</p>
                <p className="mt-1 text-sm text-neutral-500">{q.para_que}</p>
                <textarea
                  value={respuestas[q.pregunta] ?? ""}
                  onChange={(e) =>
                    setRespuestas({ ...respuestas, [q.pregunta]: e.target.value })
                  }
                  rows={2}
                  placeholder="Tu respuesta, si quieres"
                  className="mt-2 w-full rounded border border-neutral-300 bg-neutral-50 p-2 text-sm outline-none focus:border-teal-700 dark:border-neutral-700 dark:bg-neutral-950 dark:focus:border-teal-400"
                />
              </div>
            ))}
          </div>
          <button
            onClick={reDiagnosticar}
            disabled={cargando || !hayRespuestas}
            className="mt-3 rounded border border-teal-700 px-5 py-2.5 font-semibold text-teal-700 transition hover:bg-teal-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-teal-400 dark:text-teal-400 dark:hover:bg-teal-950/40"
          >
            {cargando ? "Afinando…" : "Afinar con mis respuestas"}
          </button>
        </>
      )}

      {dx.limites?.length > 0 && (
        <div className="mt-10 border-l-[3px] border-neutral-400 bg-neutral-50 p-3 dark:bg-neutral-900">
          <p className="font-mono text-[10px] uppercase tracking-wider text-neutral-500">
            Lo que no pudo ver
          </p>
          <ul className="mt-1.5 space-y-1 text-sm text-neutral-600 dark:text-neutral-400">
            {dx.limites.map((l, i) => (
              <li key={i}>{l}</li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

function BloqueRed({ r }: { r: DiagnosticoRed }) {
  const noVistos = r.puntos?.filter((p) => !p.visible).length ?? 0;

  return (
    <article className="mt-10 first:mt-0">
      <div className="flex flex-wrap items-baseline gap-5">
        <span className="font-mono text-4xl font-bold tabular-nums text-teal-700 dark:text-teal-400">
          {r.pasan}
          <span className="text-2xl text-neutral-400">/{r.evaluados}</span>
        </span>
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-neutral-500">
            {r.red}
          </p>
          <p className="mt-0.5 text-lg font-semibold leading-snug">{r.veredicto}</p>
          <p className="mt-1 font-mono text-[11px] uppercase tracking-[0.1em] text-neutral-500">
            lo que más cuesta · {r.el_que_mas_cuesta}
          </p>
        </div>
      </div>

      {noVistos > 0 && (
        <p className="mt-3 text-xs text-neutral-500">
          {noVistos === 1
            ? "Un campo no se alcanzaba a leer en la captura, así que no se cuenta."
            : `${noVistos} campos no se alcanzaban a leer en la captura, así que no se cuentan.`}{" "}
          Si quieres que entren, pega ese texto a mano.
        </p>
      )}

      {r.lo_que_funciona?.length > 0 && (
        <ul className="mt-5 space-y-1.5">
          {r.lo_que_funciona.map((x, i) => (
            <li
              key={i}
              className="text-sm text-green-800 before:mr-2 before:content-['✓'] dark:text-green-400"
            >
              {x}
            </li>
          ))}
        </ul>
      )}

      <div className="mt-5 divide-y divide-neutral-200 overflow-hidden rounded border border-neutral-200 dark:divide-neutral-800 dark:border-neutral-800">
        {r.puntos?.map((p) => (
          <div key={p.campo} className="bg-white p-4 dark:bg-neutral-900">
            <div className="flex items-center gap-2.5">
              <span
                className={`font-mono text-[10px] font-bold uppercase tracking-wider ${
                  !p.visible
                    ? "text-neutral-400"
                    : p.pasa
                      ? "text-green-700 dark:text-green-400"
                      : "text-red-700 dark:text-red-400"
                }`}
              >
                {!p.visible ? "no se veía" : p.pasa ? "pasa" : "no pasa"}
              </span>
              <h3 className="font-semibold">{p.campo}</h3>
            </div>
            {p.actual && (
              <p className="mt-2 font-mono text-xs text-neutral-500">hoy: {p.actual}</p>
            )}
            {p.visible && !p.pasa && (
              <>
                <p className="mt-2 text-sm text-neutral-700 dark:text-neutral-300">
                  {p.por_que}
                </p>
                {p.corregido && <Copiable texto={p.corregido} />}
              </>
            )}
          </div>
        ))}
      </div>

      {r.bios?.length > 0 && (
        <>
          <h3 className="mt-6 font-mono text-[11px] uppercase tracking-[0.12em] text-neutral-500">
            Bios alternativas para {r.red}
          </h3>
          <div className="mt-3 space-y-3">
            {r.bios.map((b, i) => (
              <div
                key={i}
                className="rounded border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900"
              >
                <p className="font-mono text-[10px] uppercase tracking-wider text-teal-700 dark:text-teal-400">
                  {b.angulo}
                </p>
                <Copiable texto={b.texto} />
              </div>
            ))}
          </div>
        </>
      )}
    </article>
  );
}

function Copiable({ texto }: { texto: string }) {
  const [copiado, setCopiado] = useState(false);
  return (
    <div className="mt-2 rounded border-l-2 border-teal-700 bg-neutral-50 p-3 dark:border-teal-400 dark:bg-neutral-950">
      <p className="whitespace-pre-wrap text-sm leading-relaxed">{texto}</p>
      <button
        onClick={() => {
          navigator.clipboard?.writeText(texto).then(
            () => {
              setCopiado(true);
              setTimeout(() => setCopiado(false), 1800);
            },
            () => setCopiado(false),
          );
        }}
        className="mt-2 font-mono text-[11px] text-teal-700 underline underline-offset-2 hover:no-underline dark:text-teal-400"
      >
        {copiado ? "copiado" : "copiar"}
      </button>
    </div>
  );
}
