"use client";

import { useEffect, useRef, useState } from "react";
import { useSession } from "@/lib/auth-cliente";
import { Barra } from "./barra";
import type { Imagen } from "@/lib/modelo";
import type { Comparacion } from "@/lib/historial";
import type { Diagnostico, DiagnosticoRed } from "@/types/diagnostico";
import {
  CAMPOS_EXTRA,
  CAMPOS_NUCLEO,
  negocioListo,
  type Negocio,
} from "@/types/negocio";
import {
  CASILLAS,
  CASILLAS_VACIAS,
  MAX_REDES,
  MIN_PIEZAS_PARA_PATRON,
  PLATAFORMAS,
  VENTANAS,
  casillasVisibles,
  contarPiezas,
  hayPublicado,
  redVacia,
  rotuloCasilla,
  tieneContenido,
  type Casilla,
  type EntradaRed,
  type Plataforma,
  type Publicado,
  type Transcripcion,
  type Ventana,
} from "@/types/entrada";

/**
 * Las capturas de un teléfono pesan varios megas y el modelo no aprovecha más
 * de ~1800px de lado largo. Se reducen aquí y no en el servidor: así lo que
 * viaja ya es lo que hace falta, y nada más.
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

/**
 * Lo guardado entre visitas. Solo texto: las capturas nunca se guardan — es lo
 * único comparable entre dos fechas y lo único que no arrastra un teléfono o un
 * correo al almacenamiento. Es, en pequeño, lo que hará la base de datos.
 */
type Guardado = {
  redes?: EntradaRed[];
  textos?: string;
  ventana?: Ventana;
};

function leerGuardado(): Guardado | null {
  try {
    const crudo = localStorage.getItem("cadencia");
    return crudo ? (JSON.parse(crudo) as Guardado) : null;
  } catch {
    // Un guardado ilegible no puede impedir usar la app.
    return null;
  }
}

export default function Diagnostico() {
  const guardado = leerGuardado();
  const [redes, setRedes] = useState<EntradaRed[]>(
    () =>
      guardado?.redes ?? [{ id: "red-1", plataforma: "Instagram", casillas: { ...CASILLAS_VACIAS } }],
  );
  const [publicado, setPublicado] = useState<Publicado>(() => ({
    cuadriculas: [],
    textos: guardado?.textos ?? "",
    ventana: guardado?.ventana,
  }));
  const [negocio, setNegocio] = useState<Negocio>({ oferta: "", cliente: "", despues: "" });
  const [negocioEnBase, setNegocioEnBase] = useState(false);
  const [comparacion, setComparacion] = useState<Comparacion | null>(null);
  const [semilla, setSemilla] = useState(false);

  const { data: sesion, isPending: cargandoSesion } = useSession();
  const [respuestas, setRespuestas] = useState<Record<string, string>>({});
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState("");
  const [dx, setDx] = useState<Diagnostico | null>(null);

  useEffect(() => {
    try {
      const sinImagenes = redes.map((r) => ({ ...r, casillas: { ...r.casillas } }));
      localStorage.setItem(
        "cadencia",
        JSON.stringify({
          redes: sinImagenes,
          textos: publicado.textos,
          ventana: publicado.ventana,
        }),
      );
    } catch {
      // Sin espacio o en incógnito: se sigue trabajando, solo no se recuerda.
    }
  }, [redes, publicado.textos, publicado.ventana]);

  useEffect(() => {
    if (!sesion) return;
    let vivo = true;
    fetch("/api/negocio")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!vivo || !d?.negocio) return;
        const n = d.negocio;
        setNegocio({
          oferta: n.oferta ?? "",
          cliente: n.cliente ?? "",
          despues: n.despues ?? "",
          freno: n.freno ?? "",
          accion: n.accion ?? "",
          voz: n.voz ?? "",
        });
        setNegocioEnBase(true);
        if (d.comparacion) setComparacion(d.comparacion);
      })
      .catch(() => {
        // Sin negocio guardado se empieza en blanco, que es lo correcto.
      });
    return () => {
      vivo = false;
    };
  }, [sesion]);

  const listas = redes.filter(tieneContenido);
  const usadas = redes.map((r) => r.plataforma);
  const libre = PLATAFORMAS.find((p) => !usadas.includes(p)) ?? "Otra";

  function cambiarRed(id: string, cambio: Partial<EntradaRed>) {
    setRedes((rs) => rs.map((r) => (r.id === id ? { ...r, ...cambio } : r)));
  }

  async function diagnosticar(conRespuestas = false) {
    setCargando(true);
    setError("");
    try {
      const r = await fetch("/api/diagnostico", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(semilla ? { perfilId: "victor" } : {}),
          redes: listas,
          publicado,
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
  const piezas = contarPiezas(publicado.textos);

  if (cargandoSesion) return <main className="mx-auto max-w-3xl px-6 py-14" />;

  if (!sesion) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-20">
        <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-teal-700 dark:text-teal-400">
          Función 1 · Diagnóstico
        </p>
        <h1 className="mt-4 text-5xl font-bold leading-none tracking-tight">Cadencia</h1>
        <p className="mt-5 max-w-xl text-neutral-600 dark:text-neutral-400">
          Qué le está costando conversaciones a tu perfil, con el texto ya
          corregido. Necesitas una cuenta para que tu negocio y tus diagnósticos
          queden guardados de una visita a la otra.
        </p>
        <a
          href="/entrar"
          className="mt-7 inline-block rounded bg-teal-700 px-5 py-2.5 font-semibold text-white transition hover:bg-teal-800 dark:bg-teal-600 dark:hover:bg-teal-500"
        >
          Entrar o crear cuenta
        </a>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-3xl px-6 py-14">
      <Barra />

      <header className="border-b-2 border-neutral-900 pb-7 dark:border-neutral-100">
        <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-teal-700 dark:text-teal-400">
          Función 1 · Diagnóstico
        </p>
        <h1 className="mt-4 text-5xl font-bold leading-none tracking-tight">Cadencia</h1>
        <p className="mt-4 max-w-xl text-neutral-600 dark:text-neutral-400">
          Qué le está costando conversaciones a tu perfil, con el texto ya
          corregido. Escribe las casillas o rellénalas desde una captura — lo
          que se revisa es siempre lo que tú confirmes.
        </p>
      </header>

      {comparacion && <Movido c={comparacion} />}

      <section className="mt-9">
        <h2 className="font-mono text-[11px] uppercase tracking-[0.12em] text-neutral-500">
          Tu negocio
        </h2>
        <p className="mb-3 mt-0.5 text-sm text-neutral-500">
          Esto se llena una vez. Sin ello, las correcciones se escriben sobre un
          negocio que no es el tuyo.
        </p>
        <BloqueNegocio
          negocio={negocio}
          onCambio={(c) => {
            setNegocio({ ...negocio, ...c });
            setNegocioEnBase(false);
          }}
          guardado={negocioEnBase}
          onGuardado={() => setNegocioEnBase(true)}
          semilla={semilla}
          onSemilla={setSemilla}
        />
      </section>

      <section className="mt-10">
        <h2 className="font-mono text-[11px] uppercase tracking-[0.12em] text-neutral-500">
          Tu perfil
        </h2>
        <p className="mb-3 mt-0.5 text-sm text-neutral-500">
          Con una red basta para empezar. La segunda sirve para ver si dices lo
          mismo en las dos.
        </p>

        <div className="space-y-3">
          {redes.map((r) => (
            <Ficha
              key={r.id}
              red={r}
              puedeQuitar={redes.length > 1}
              onCambio={(c) => cambiarRed(r.id, c)}
              onQuitar={() => setRedes(redes.filter((x) => x.id !== r.id))}
            />
          ))}
        </div>

        {redes.length < MAX_REDES ? (
          <button
            onClick={() => setRedes([...redes, redVacia(libre)])}
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
          Opcional. No se corrige ni se borra nada: sirve para saber de dónde
          partes.
        </p>

        <div className="rounded border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
          <p className="text-sm text-neutral-600 dark:text-neutral-400">
            <span className="font-semibold">La cuadrícula</span> da el ritmo, el
            formato y los temas que se repiten.
          </p>
          <div className="mt-2 flex flex-wrap items-start gap-3">
            {publicado.cuadriculas.map((img, i) => (
              <div key={i} className="flex items-start gap-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={fuente(img)}
                  alt={`cuadrícula ${i + 1}`}
                  className="max-h-32 rounded border border-neutral-300 dark:border-neutral-700"
                />
                <button
                  onClick={() =>
                    setPublicado({
                      ...publicado,
                      cuadriculas: publicado.cuadriculas.filter((_, j) => j !== i),
                    })
                  }
                  className="font-mono text-[11px] uppercase tracking-wider text-neutral-400 hover:text-red-700 dark:hover:text-red-400"
                >
                  quitar
                </button>
              </div>
            ))}
            {publicado.cuadriculas.length < 2 && (
              <SubirImagen
                etiqueta="Subir captura de la cuadrícula"
                onImagen={(img) =>
                  setPublicado({ ...publicado, cuadriculas: [...publicado.cuadriculas, img] })
                }
              />
            )}
          </div>

          <p className="mt-5 text-sm text-neutral-600 dark:text-neutral-400">
            <span className="font-semibold">Los textos completos</span> son lo
            único que da tus palabras. Pega los que quieras, separados por una
            línea en blanco.
          </p>
          <textarea
            value={publicado.textos}
            onChange={(e) => setPublicado({ ...publicado, textos: e.target.value })}
            rows={6}
            placeholder={"El texto de una publicación…\n\nEl de otra…"}
            className="mt-2 w-full rounded border border-neutral-300 bg-neutral-50 p-3 text-sm leading-relaxed outline-none focus:border-teal-700 dark:border-neutral-700 dark:bg-neutral-950 dark:focus:border-teal-400"
          />
          {piezas > 0 && (
            <p className="mt-1.5 text-xs text-neutral-500">
              Detecté {piezas} {piezas === 1 ? "pieza" : "piezas"}.
              {piezas < MIN_PIEZAS_PARA_PATRON &&
                ` Con menos de ${MIN_PIEZAS_PARA_PATRON} no se puede afirmar un "siempre" ni un "nunca" — se dirá "en las que subiste".`}
            </p>
          )}

          <label className="mt-5 block">
            <span className="text-sm text-neutral-600 dark:text-neutral-400">
              <span className="font-semibold">¿De cuándo es esto?</span> Es lo
              único que permite hablar de ritmo.
            </span>
            <select
              value={publicado.ventana ?? ""}
              onChange={(e) =>
                setPublicado({ ...publicado, ventana: (e.target.value || undefined) as Ventana })
              }
              className="mt-2 block rounded border border-neutral-300 bg-white px-2 py-1.5 text-sm outline-none focus:border-teal-700 dark:border-neutral-700 dark:bg-neutral-950 dark:focus:border-teal-400"
            >
              <option value="">Elige…</option>
              {VENTANAS.map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </select>
          </label>
        </div>
      </section>

      <div className="mt-10">
        <button
          onClick={() => diagnosticar(false)}
          disabled={
            cargando || listas.length === 0 || (!semilla && !negocioEnBase)
          }
          className="rounded bg-teal-700 px-5 py-2.5 font-semibold text-white transition hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-teal-600 dark:hover:bg-teal-500"
        >
          {cargando ? "Revisando…" : dx ? "Volver a diagnosticar" : "Diagnosticar"}
        </button>
        {cargando && (
          <p className="mt-3 text-sm text-neutral-500">
            Leyendo {listas.length > 1 ? "los perfiles" : "el perfil"}
            {hayPublicado(publicado) ? " y lo que ya publicaste" : ""}. Suele
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

/**
 * Lo que se movió desde la corrida anterior. Es una cuenta, no un veredicto: se
 * calcula comparando dos instantáneas guardadas, sin pedirle nada al modelo. Y
 * va en pasado, porque es de dónde vienes, no una nota.
 */
function Movido({ c }: { c: Comparacion }) {
  const fecha = new Date(c.desde).toLocaleDateString("es", {
    day: "numeric",
    month: "long",
  });
  const total = c.arreglados.length + c.cambiados.length;
  if (total === 0) return null;

  return (
    <div className="mt-8 rounded border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900">
      <p className="font-mono text-[10px] uppercase tracking-wider text-neutral-500">
        Desde el {fecha}
      </p>
      {c.arreglados.length > 0 && (
        <p className="mt-1.5 text-sm leading-relaxed">
          <span className="font-semibold text-green-800 dark:text-green-400">
            {c.arreglados.length === 1 ? "Empezó a pasar" : "Empezaron a pasar"}
          </span>{" "}
          {c.arreglados.map((m) => `${m.campo} en ${m.red}`).join(", ")}.
        </p>
      )}
      {c.cambiados.length > 0 && (
        <p className="mt-1 text-sm leading-relaxed text-neutral-700 dark:text-neutral-300">
          Cambiaste el texto de {c.cambiados.map((m) => `${m.campo} en ${m.red}`).join(", ")}.
        </p>
      )}
    </div>
  );
}

function BloqueNegocio({
  negocio,
  onCambio,
  guardado,
  onGuardado,
  semilla,
  onSemilla,
}: {
  negocio: Negocio;
  onCambio: (c: Partial<Negocio>) => void;
  guardado: boolean;
  onGuardado: () => void;
  semilla: boolean;
  onSemilla: (v: boolean) => void;
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

  return (
    <div className="rounded border border-neutral-300 bg-white p-4 dark:border-neutral-700 dark:bg-neutral-900">
      <label className="flex items-center gap-2 text-sm text-neutral-600 dark:text-neutral-400">
        <input
          type="checkbox"
          checked={semilla}
          onChange={(e) => onSemilla(e.target.checked)}
          className="accent-teal-700"
        />
        Usar el perfil de prueba del repositorio
      </label>

      {semilla ? (
        <p className="mt-2 text-xs text-amber-700 dark:text-amber-500">
          Con esto marcado, el diagnóstico lee el negocio de{" "}
          <code className="font-mono">perfiles/victor.json</code> — sirve para
          probar el sistema, no para diagnosticar otro negocio.
        </p>
      ) : (
        <div className="mt-3 space-y-3">
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
                className="mt-1 w-full rounded border border-neutral-300 bg-neutral-50 p-2 text-sm leading-relaxed outline-none focus:border-teal-700 dark:border-neutral-700 dark:bg-neutral-950 dark:focus:border-teal-400"
              />
            </div>
          ))}

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
                  className="mt-1 w-full rounded border border-neutral-300 bg-neutral-50 p-2 text-sm leading-relaxed outline-none focus:border-teal-700 dark:border-neutral-700 dark:bg-neutral-950 dark:focus:border-teal-400"
                />
              </div>
            ))}

          <div className="flex flex-wrap items-center gap-3 pt-1">
            <button
              onClick={guardar}
              disabled={guardando || guardado || !negocioListo(negocio)}
              className="rounded border border-teal-700 px-4 py-2 font-semibold text-teal-700 transition hover:bg-teal-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-teal-400 dark:text-teal-400 dark:hover:bg-teal-950/40"
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
      )}
    </div>
  );
}

function Ficha({
  red,
  puedeQuitar,
  onCambio,
  onQuitar,
}: {
  red: EntradaRed;
  puedeQuitar: boolean;
  onCambio: (c: Partial<EntradaRed>) => void;
  onQuitar: () => void;
}) {
  const [leyendo, setLeyendo] = useState(false);
  const [avisoPrivacidad, setAvisoPrivacidad] = useState(false);
  const [fallo, setFallo] = useState("");
  const primeraCortada = useRef<HTMLTextAreaElement | HTMLInputElement | null>(null);

  // Se pintan las de la plataforma más las que ya tengan algo escrito: cambiar
  // de red nunca puede hacer desaparecer texto que el dueño ya puso.
  const aplican = casillasVisibles(red);
  const cortadas = red.cortadas ?? [];
  const transcritas = red.transcritas ?? [];
  // El cursor va a la primera que quedó cortada: es la que hay que completar.
  const aCompletar = CASILLAS.find(
    (c) => aplican.includes(c.id) && cortadas.includes(c.id),
  )?.id;

  async function transcribir(file: File | undefined | null) {
    if (!file) return;
    setLeyendo(true);
    setFallo("");
    try {
      const imagen = await comprimir(file);
      const r = await fetch("/api/transcripcion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plataforma: red.plataforma, imagen }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error ?? "No se pudo leer la captura.");

      const t: Transcripcion = d.transcripcion;
      const rellenas = (Object.keys(t.casillas) as Casilla[]).filter((c) =>
        t.casillas[c]?.trim(),
      );
      onCambio({
        casillas: { ...red.casillas, ...t.casillas },
        transcritas: rellenas,
        cortadas: [...t.cortados, ...t.no_legible],
      });
      if (t.datos_personales) {
        setFallo(
          "En la captura había datos personales (un teléfono, un correo o un mensaje). No se copiaron.",
        );
      }
      setTimeout(() => primeraCortada.current?.focus(), 0);
    } catch (e) {
      setFallo(e instanceof Error ? e.message : "No se pudo leer la captura.");
    } finally {
      setLeyendo(false);
    }
  }

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
            value={red.otra ?? ""}
            onChange={(e) => onCambio({ otra: e.target.value })}
            placeholder="¿Cuál?"
            className="w-32 rounded border border-neutral-300 bg-white px-2 py-1.5 text-sm outline-none focus:border-teal-700 dark:border-neutral-700 dark:bg-neutral-950 dark:focus:border-teal-400"
          />
        )}

        {puedeQuitar && (
          <button
            onClick={onQuitar}
            className="ml-auto font-mono text-[11px] uppercase tracking-wider text-neutral-400 hover:text-red-700 dark:hover:text-red-400"
          >
            quitar
          </button>
        )}
      </div>

      <div className="mt-3 rounded border border-dashed border-neutral-300 p-3 dark:border-neutral-700">
        <p className="text-sm text-neutral-600 dark:text-neutral-400">
          ¿Prefieres no escribirlo? Sube una captura y se rellenan solas — tú las
          revisas antes de que se diagnostique nada.
        </p>
        <p className="mt-1.5 text-xs text-neutral-500">
          Captura tu perfil como lo ve un desconocido, no la pantalla de{" "}
          <em>Editar perfil</em> — esa muestra tu correo y tu teléfono.
        </p>
        <label
          className="mt-2 inline-flex cursor-pointer items-center rounded border border-teal-700 px-3 py-1.5 font-mono text-[11px] uppercase tracking-wider text-teal-700 transition hover:bg-teal-50 dark:border-teal-400 dark:text-teal-400 dark:hover:bg-teal-950/40"
          onMouseEnter={() => setAvisoPrivacidad(true)}
        >
          <input
            type="file"
            accept="image/*"
            className="sr-only"
            disabled={leyendo}
            onChange={(e) => transcribir(e.target.files?.[0])}
          />
          {leyendo ? "leyendo la captura…" : "rellenar desde una captura"}
        </label>
        {avisoPrivacidad && !leyendo && (
          <span className="ml-2 text-xs text-neutral-500">
            La captura no se guarda.
          </span>
        )}
        {fallo && <p className="mt-2 text-xs text-amber-700 dark:text-amber-500">{fallo}</p>}
      </div>

      <div className="mt-3 space-y-2.5">
        {CASILLAS.filter((c) => aplican.includes(c.id)).map((c) => {
          const cortada = cortadas.includes(c.id);
          const enfocar = c.id === aCompletar;
          const valor = red.casillas[c.id] ?? "";

          const comun = {
            value: valor,
            onChange: (e: { target: { value: string } }) =>
              onCambio({
                casillas: { ...red.casillas, [c.id]: e.target.value },
                cortadas: cortadas.filter((x) => x !== c.id),
              }),
            placeholder: c.pista,
            className: `mt-1 w-full rounded border bg-neutral-50 p-2 font-mono text-sm outline-none focus:border-teal-700 dark:bg-neutral-950 dark:focus:border-teal-400 ${
              cortada
                ? "border-amber-500 dark:border-amber-500"
                : "border-neutral-300 dark:border-neutral-700"
            }`,
          };

          return (
            <div key={c.id}>
              <label className="flex items-baseline gap-2">
                <span className="font-mono text-[10px] uppercase tracking-wider text-neutral-500">
                  {rotuloCasilla(red.plataforma, c.id)}
                </span>
                {transcritas.includes(c.id) && !cortada && (
                  <span className="font-mono text-[10px] text-teal-700 dark:text-teal-400">
                    de tu captura
                  </span>
                )}
              </label>
              {c.filas ? (
                <textarea
                  {...comun}
                  rows={c.filas}
                  ref={enfocar ? (primeraCortada as React.RefObject<HTMLTextAreaElement>) : null}
                />
              ) : (
                <input
                  {...comun}
                  ref={enfocar ? (primeraCortada as React.RefObject<HTMLInputElement>) : null}
                />
              )}
              {cortada && (
                <p className="mt-1 text-xs text-amber-700 dark:text-amber-500">
                  Esto venía cortado con «… más». Complétalo — si no, este punto
                  no se evalúa.
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function SubirImagen({
  etiqueta,
  onImagen,
}: {
  etiqueta: string;
  onImagen: (i: Imagen) => void;
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

  return (
    <div>
      <label className="flex cursor-pointer items-center rounded border border-dashed border-neutral-400 px-3 py-2 text-sm text-neutral-600 transition hover:border-teal-700 hover:text-teal-800 dark:border-neutral-600 dark:text-neutral-400 dark:hover:border-teal-400 dark:hover:text-teal-300">
        <input
          type="file"
          accept="image/*"
          className="sr-only"
          onChange={(e) => tomar(e.target.files?.[0])}
        />
        {ocupado ? "Preparando…" : etiqueta}
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
      {dx.redes?.map((r) => <BloqueRed key={r.id ?? r.red} r={r} />)}

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
  const fuera = r.puntos?.filter((p) => p.aplica === false).length ?? 0;
  const noVistos = r.puntos?.filter((p) => p.aplica !== false && !p.visible).length ?? 0;

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
          {noVistos === 1 ? "Una casilla llegó vacía" : `${noVistos} casillas llegaron vacías`}, así
          que {noVistos === 1 ? "ese punto no cuenta" : "esos puntos no cuentan"}. Si quieres que
          entren, escríbelas y vuelve a diagnosticar.
        </p>
      )}
      {fuera > 0 && (
        <p className="mt-1 text-xs text-neutral-500">
          {fuera === 1 ? "Un punto no aplica" : `${fuera} puntos no aplican`} en esta red.
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
        {r.puntos?.map((p) => {
          const estado =
            p.aplica === false ? "no aplica" : !p.visible ? "sin dato" : p.pasa ? "pasa" : "no pasa";
          const color =
            p.aplica === false || !p.visible
              ? "text-neutral-400"
              : p.pasa
                ? "text-green-700 dark:text-green-400"
                : "text-red-700 dark:text-red-400";
          return (
            <div key={p.campo} className="bg-white p-4 dark:bg-neutral-900">
              <div className="flex items-center gap-2.5">
                <span
                  className={`font-mono text-[10px] font-bold uppercase tracking-wider ${color}`}
                >
                  {estado}
                </span>
                <h3 className="font-semibold">{p.campo}</h3>
              </div>
              {p.actual && (
                <p className="mt-2 font-mono text-xs text-neutral-500">hoy: {p.actual}</p>
              )}
              {p.aplica !== false && p.visible && !p.pasa && (
                <>
                  <p className="mt-2 text-sm text-neutral-700 dark:text-neutral-300">{p.por_que}</p>
                  {p.corregido && <Copiable texto={p.corregido} />}
                </>
              )}
            </div>
          );
        })}
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
