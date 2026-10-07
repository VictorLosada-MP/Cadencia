"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useSession } from "@/lib/auth-cliente";
import { Barra } from "../barra";
import type { Imagen } from "@/lib/modelo";
import type { Comparacion } from "@/lib/historial";
import type { Diagnostico, DiagnosticoRed } from "@/types/diagnostico";
import type { Negocio } from "@/types/negocio";
import {
  BloqueNegocio,
  NEGOCIO_VACIO,
  borrarBorrador,
  desdeBase,
  guardarBorrador,
  leerBorrador,
  tieneAlgo,
} from "../negocio/negocio";
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
  /**
   * Las respuestas a medio escribir.
   *
   * Sin esto, irse a la semana y volver —o recargar— las borraba todas. Son lo
   * más caro de recuperar de esta pantalla: lo demás se copia de un perfil en
   * un minuto, y esto hay que volver a pensarlo.
   */
  respuestas?: Record<string, string>;
  /**
   * A qué diagnóstico pertenecen esas respuestas, por su fecha. Si el
   * diagnóstico que vuelve del servidor es otro, las preguntas ya no son las
   * mismas y arrastrarlas sería pegar respuestas debajo de preguntas ajenas.
   */
  para?: string;
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
  // Se lee una sola vez, al montar. Antes se leía en cada render, así que en
  // cuanto se guardaba algo dejaba de significar "lo que había al abrir".
  const [guardado] = useState(leerGuardado);
  const [redes, setRedes] = useState<EntradaRed[]>(
    () =>
      guardado?.redes ?? [{ id: "red-1", plataforma: "Instagram", casillas: { ...CASILLAS_VACIAS } }],
  );
  const [publicado, setPublicado] = useState<Publicado>(() => ({
    cuadriculas: [],
    textos: guardado?.textos ?? "",
    ventana: guardado?.ventana,
  }));
  const [respuestasGuardadas] = useState(() => guardado?.respuestas ?? {});
  const [borradorNegocio] = useState(leerBorrador);
  const [negocio, setNegocio] = useState<Negocio>(() => borradorNegocio ?? NEGOCIO_VACIO);
  const [negocioEnBase, setNegocioEnBase] = useState(false);
  const [comparacion, setComparacion] = useState<Comparacion | null>(null);
  const [creado, setCreado] = useState<string | null>(null);
  const [semilla, setSemilla] = useState(false);
  // El perfil semilla lee `perfiles/victor.json`, que es el negocio de quien
  // construyó esto. Sirve para probar el sistema en la máquina de uno; en el
  // producto desplegado le ofrecería a un desconocido diagnosticarse contra un
  // negocio ajeno, y eso no es una opción: es una fuga.
  const enPruebas = process.env.NODE_ENV !== "production";

  const { data: sesion, isPending: cargandoSesion } = useSession();
  const [respuestas, setRespuestas] = useState<Record<string, string>>(() => respuestasGuardadas);
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
          respuestas,
          para: creado ?? undefined,
        } satisfies Guardado),
      );
    } catch {
      // Sin espacio o en incógnito: se sigue trabajando, solo no se recuerda.
    }
  }, [redes, publicado.textos, publicado.ventana, respuestas, creado]);

  useEffect(() => {
    if (!sesion) return;
    let vivo = true;

    // El último diagnóstico vuelve tal cual, con lo que se usó para hacerlo. Un
    // diagnóstico que desaparece al cerrar la pestaña no es un diagnóstico.
    fetch("/api/ultimo?funcion=1")
      .then((r) => (r.ok ? r.json() : null))
      .then((u) => {
        if (!vivo || !u?.corrida) return;
        setDx(u.corrida.resultado);
        setCreado(u.corrida.creado);

        // Lo de la corrida anterior solo rellena lo que está en blanco.
        //
        // Antes lo pisaba siempre, y eso borraba lo que se estaba escribiendo
        // cada vez que la pantalla se volvía a montar: bastaba con ir a la
        // semana y volver para que una bio a medio corregir regresara a la
        // versión vieja.
        const e = u.corrida.entrada;
        if (Array.isArray(e?.redes) && e.redes.length && !guardado?.redes?.length) {
          setRedes(e.redes);
        }
        if (e?.publicado && !guardado?.textos) {
          setPublicado((pub) => ({
            ...pub,
            textos: e.publicado.textos ?? "",
            ventana: e.publicado.ventana,
          }));
        }

        // Y las respuestas a medio escribir solo vuelven si son de ESTE
        // diagnóstico. Si es otro, las preguntas cambiaron.
        if (guardado?.para && guardado.para !== u.corrida.creado) setRespuestas({});
      })
      .catch(() => {});

    fetch("/api/negocio")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!vivo || !d?.negocio) return;
        // Igual que en /negocio: lo del servidor no pisa lo que está a medias.
        if (!tieneAlgo(borradorNegocio)) {
          setNegocio(desdeBase(d.negocio));
          setNegocioEnBase(true);
        }
        if (d.comparacion) setComparacion(d.comparacion);
      })
      .catch(() => {
        // Sin negocio guardado se empieza en blanco, que es lo correcto.
      });
    return () => {
      vivo = false;
    };
  }, [sesion, guardado, borradorNegocio]);

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
          respuestas: conRespuestas ? preguntadas : undefined,
        }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error ?? "Falló el diagnóstico.");
      setDx(d.diagnostico);
      setCreado(new Date().toISOString());
      if (!conRespuestas) setRespuestas({});
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error inesperado.");
    } finally {
      setCargando(false);
    }
  }

  const hayRespuestas = Object.values(respuestas).some((v) => v.trim());

  // Todas las que se le ofrecieron, con o sin respuesta: es lo que evita que
  // la ronda siguiente le vuelva a poner delante lo que ya decidió saltarse.
  const preguntadas = (dx?.preguntas ?? []).map((q) => ({
    pregunta: q.pregunta,
    respuesta: respuestas[q.pregunta] ?? "",
  }));
  const piezas = contarPiezas(publicado.textos);

  if (cargandoSesion) return <main className="mx-auto max-w-5xl px-6 py-14" />;

  if (!sesion) {
    return (
      <main className="mx-auto max-w-5xl px-6 py-20">
        <h1 className="text-4xl font-bold tracking-tight">Diagnóstico</h1>
        <p className="mt-4 text-neutral-600 dark:text-neutral-400">
          Necesitas una cuenta para que tu negocio y tus diagnósticos queden
          guardados de una visita a la otra.
        </p>
        <div className="mt-6 flex flex-wrap items-center gap-4">
          <Link
            href="/entrar"
            className="inline-block empuja rounded-full bg-teal-700 px-5 py-2.5 font-semibold text-white dark:bg-teal-600"
          >
            Entrar o crear cuenta
          </Link>
          <Link
            href="/"
            className="font-mono text-[11px] uppercase tracking-wider underline underline-offset-4 hover:no-underline"
          >
            qué es Cadencia →
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-5xl px-6 py-14">
      <Barra />

      <header className="entra border-b-2 border-neutral-900 pb-7 dark:border-neutral-100">
        <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-teal-700 dark:text-teal-400">
          Función 1 · Diagnóstico
        </p>
        <h1 className="mt-4 text-5xl font-bold leading-none tracking-tight">Diagnóstico</h1>
        <p className="mt-4 max-w-xl text-neutral-600 dark:text-neutral-400">
          Qué le está costando conversaciones a tu perfil, con el texto ya
          corregido. Escribe las casillas o rellénalas desde una captura — lo
          que se revisa es siempre lo que tú confirmes.
        </p>
      </header>

      {comparacion && <Movido c={comparacion} />}

      <section className="revela mt-9" style={{ ["--tarda" as string]: "0.04s" }}>
        <h2 className="font-mono text-[11px] uppercase tracking-[0.12em] text-neutral-500">
          Tu negocio
        </h2>
        {negocioEnBase && !semilla ? (
          <div className="mt-1.5 flex flex-wrap items-start justify-between gap-4 rounded-lg border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900">
            <div className="min-w-0">
              <p className="font-mono text-[10px] uppercase tracking-wider text-neutral-500">
                Voy a leer tu perfil contra
              </p>
              <p className="mt-1 font-semibold leading-snug">{recortar(negocio.oferta, 90)}</p>
              {negocio.cliente.trim() && (
                <p className="mt-0.5 text-sm text-neutral-500">
                  para {recortar(negocio.cliente, 80)}
                </p>
              )}
            </div>
            <Link
              href="/negocio"
              className="shrink-0 rounded-full border border-neutral-300 px-3 py-1.5 font-mono text-[11px] uppercase tracking-wider text-neutral-600 transition-colors hover:border-teal-600 hover:text-teal-700 dark:border-neutral-700 dark:text-neutral-400 dark:hover:border-teal-400 dark:hover:text-teal-400"
            >
              cambiarlo →
            </Link>
          </div>
        ) : (
          <>
            <p className="mb-3 mt-0.5 text-sm text-neutral-500">
              Esto se llena una vez y lo usan las cuatro funciones. Sin ello, las
              correcciones se escriben sobre un negocio que no es el tuyo.
            </p>
            <BloqueNegocio
              negocio={negocio}
              onCambio={(c) => {
                const nuevo = { ...negocio, ...c };
                setNegocio(nuevo);
                setNegocioEnBase(false);
                guardarBorrador(nuevo);
              }}
              guardado={negocioEnBase}
              onGuardado={() => {
                setNegocioEnBase(true);
                borrarBorrador();
              }}
              semilla={enPruebas ? semilla : undefined}
              onSemilla={enPruebas ? setSemilla : undefined}
            />
          </>
        )}
      </section>

      <section className="revela mt-10" style={{ ["--tarda" as string]: "0.08s" }}>
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

      <section className="revela mt-10" style={{ ["--tarda" as string]: "0.12s" }}>
        <h2 className="font-mono text-[11px] uppercase tracking-[0.12em] text-neutral-500">
          Lo que ya publicaste
        </h2>
        <p className="mb-3 mt-0.5 text-sm text-neutral-500">
          Opcional, y <strong>lo más reciente</strong> — las últimas tres o
          cuatro, no las de hace dos años. No se corrige ni se borra nada:
          sirve para saber de dónde partes.
        </p>

        <div className="rounded-lg border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
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
                  className="max-h-32 rounded-lg border border-neutral-300 dark:border-neutral-700"
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
            línea en blanco — o pega el enlace y los leo por ti.
          </p>
          <PorEnlace
            onTexto={(t) =>
              setPublicado((p) => ({
                ...p,
                textos: p.textos.trim() ? `${p.textos.trim()}\n\n${t}` : t,
              }))
            }
          />
          <textarea
            value={publicado.textos}
            onChange={(e) => setPublicado({ ...publicado, textos: e.target.value })}
            rows={6}
            placeholder={"El texto de una publicación…\n\nEl de otra…"}
            className="mt-2 w-full rounded-lg border border-neutral-300 bg-neutral-50 p-3 text-sm leading-relaxed outline-none focus:border-teal-700 dark:border-neutral-700 dark:bg-neutral-950 dark:focus:border-teal-400"
          />
          {piezas > 0 && (
            <>
              <p className="mt-1.5 text-xs text-neutral-500">
                Detecté {piezas} {piezas === 1 ? "pieza" : "piezas"}.
                {piezas < MIN_PIEZAS_PARA_PATRON &&
                  ` Con menos de ${MIN_PIEZAS_PARA_PATRON} no se puede afirmar un "siempre" ni un "nunca" — se dirá "en las que subiste".`}
              </p>
              <ComoHablas textos={publicado.textos} />
            </>
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
              className="mt-2 block rounded-lg border border-neutral-300 bg-white px-2 py-1.5 text-sm outline-none focus:border-teal-700 dark:border-neutral-700 dark:bg-neutral-950 dark:focus:border-teal-400"
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
          className="empuja rounded-full bg-teal-700 px-5 py-2.5 font-semibold text-white transition hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-teal-600 dark:hover:bg-teal-500"
        >
          {cargando ? "Revisando…" : dx ? "Volver a diagnosticar" : "Diagnosticar"}
        </button>
        {dx && creado && !cargando && (
          <p className="mt-3 text-sm text-neutral-500">
            Este es el diagnóstico del{" "}
            {new Date(creado).toLocaleDateString("es", { day: "numeric", month: "long" })}. Se queda
            así hasta que vuelvas a diagnosticar.
          </p>
        )}
        {cargando && (
          <p className="mt-3 text-sm text-neutral-500">
            Leyendo {listas.length > 1 ? "los perfiles" : "el perfil"}
            {hayPublicado(publicado) ? " y lo que ya publicaste" : ""}. Suele
            tardar cerca de un minuto.
          </p>
        )}
        {error && (
          <p className="mt-4 rounded-lg border-l-[3px] border-red-700 bg-red-50 p-3 text-sm text-red-900 dark:bg-red-950/40 dark:text-red-200">
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

/** La primera frase, para reconocer el negocio sin reabrir el formulario. */
function recortar(t: string, max: number): string {
  const limpio = t.trim().split(/[.\n]/)[0].trim();
  return limpio.length > max ? `${limpio.slice(0, max).trimEnd()}…` : limpio;
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
    <div className="mt-8 rounded-lg border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900">
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
  const esSitio = red.plataforma === "Sitio web";

  async function leerElSitio() {
    setLeyendo(true);
    setFallo("");
    try {
      const r = await fetch("/api/sitio", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: red.casillas.link }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error ?? "No pude abrir ese sitio.");
      onCambio({
        casillas: { ...red.casillas, ...d.casillas },
        transcritas: (Object.keys(d.casillas) as Casilla[]).filter((c) => d.casillas[c]),
        cortadas: d.vacias ?? [],
      });
    } catch (e) {
      setFallo(e instanceof Error ? e.message : "No pude abrir ese sitio.");
    } finally {
      setLeyendo(false);
    }
  }
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
    <div className="rounded-lg border border-neutral-300 bg-white p-4 dark:border-neutral-700 dark:bg-neutral-900">
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={red.plataforma}
          onChange={(e) => onCambio({ plataforma: e.target.value as Plataforma })}
          className="rounded-lg border border-neutral-300 bg-white px-2 py-1.5 text-sm outline-none focus:border-teal-700 dark:border-neutral-700 dark:bg-neutral-950 dark:focus:border-teal-400"
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
            className="w-32 rounded-lg border border-neutral-300 bg-white px-2 py-1.5 text-sm outline-none focus:border-teal-700 dark:border-neutral-700 dark:bg-neutral-950 dark:focus:border-teal-400"
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

      {esSitio ? (
        <div className="mt-3 rounded-lg border border-dashed border-neutral-300 p-3 dark:border-neutral-700">
          <p className="text-sm text-neutral-600 dark:text-neutral-400">
            Escribe la dirección y leo la página por ti: el nombre, lo que dice
            arriba y el botón principal.
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <input
              value={red.casillas.link ?? ""}
              onChange={(e) =>
                onCambio({ casillas: { ...red.casillas, link: e.target.value } })
              }
              placeholder="mantiscapital.net"
              className="min-w-0 flex-1 rounded-lg border border-neutral-300 bg-white px-2 py-1.5 text-sm outline-none focus:border-teal-700 dark:border-neutral-700 dark:bg-neutral-950 dark:focus:border-teal-400"
            />
            <button
              onClick={leerElSitio}
              disabled={leyendo || !red.casillas.link?.trim()}
              className="rounded-lg border border-teal-700 px-3 py-1.5 font-mono text-[11px] uppercase tracking-wider text-teal-700 transition hover:bg-teal-50 disabled:opacity-40 dark:border-teal-400 dark:text-teal-400 dark:hover:bg-teal-950/40"
            >
              {leyendo ? "leyendo…" : "leer el sitio"}
            </button>
          </div>
          {fallo && <p className="mt-2 text-xs text-amber-700 dark:text-amber-500">{fallo}</p>}
        </div>
      ) : (
      <div className="mt-3 rounded-lg border border-dashed border-neutral-300 p-3 dark:border-neutral-700">
        <p className="text-sm text-neutral-600 dark:text-neutral-400">
          ¿Prefieres no escribirlo? Sube una captura y se rellenan solas — tú las
          revisas antes de que se diagnostique nada.
        </p>
        <p className="mt-1.5 text-xs text-neutral-500">
          Captura tu perfil como lo ve un desconocido, no la pantalla de{" "}
          <em>Editar perfil</em> — esa muestra tu correo y tu teléfono.
        </p>
        <label
          className="mt-2 inline-flex cursor-pointer items-center rounded-lg border border-teal-700 px-3 py-1.5 font-mono text-[11px] uppercase tracking-wider text-teal-700 transition hover:bg-teal-50 dark:border-teal-400 dark:text-teal-400 dark:hover:bg-teal-950/40"
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
      )}

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
            className: `mt-1 w-full rounded-lg border bg-neutral-50 p-2 font-mono text-sm outline-none focus:border-teal-700 dark:bg-neutral-950 dark:focus:border-teal-400 ${
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

/**
 * Leer una publicación desde su enlace. Funciona porque la página publica sus
 * propias etiquetas para que cualquier enlace se previsualice — lo mismo que
 * hace WhatsApp. No siempre lo permiten, y por eso pegar el texto sigue ahí.
 */
function PorEnlace({ onTexto }: { onTexto: (t: string) => void }) {
  const [url, setUrl] = useState("");
  const [leyendo, setLeyendo] = useState(false);
  const [aviso, setAviso] = useState("");

  async function leer() {
    setLeyendo(true);
    setAviso("");
    try {
      const r = await fetch("/api/publicacion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error ?? "No pude leer ese enlace.");
      onTexto(d.texto);
      setUrl("");
    } catch (e) {
      setAviso(e instanceof Error ? e.message : "No pude leer ese enlace.");
    } finally {
      setLeyendo(false);
    }
  }

  return (
    <div className="mt-2">
      <div className="flex flex-wrap gap-2">
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="Pega el enlace de una publicación"
          className="min-w-0 flex-1 rounded-lg border border-neutral-300 bg-white px-2 py-1.5 text-sm outline-none focus:border-teal-700 dark:border-neutral-700 dark:bg-neutral-950 dark:focus:border-teal-400"
        />
        <button
          onClick={leer}
          disabled={leyendo || !url.trim()}
          className="rounded-lg border border-teal-700 px-3 py-1.5 font-mono text-[11px] uppercase tracking-wider text-teal-700 transition hover:bg-teal-50 disabled:opacity-40 dark:border-teal-400 dark:text-teal-400 dark:hover:bg-teal-950/40"
        >
          {leyendo ? "leyendo…" : "leer el enlace"}
        </button>
      </div>
      {aviso && <p className="mt-1.5 text-xs text-amber-700 dark:text-amber-500">{aviso}</p>}
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
      <label className="flex cursor-pointer items-center rounded-lg border border-dashed border-neutral-400 px-3 py-2 text-sm text-neutral-600 transition hover:border-teal-700 hover:text-teal-800 dark:border-neutral-600 dark:text-neutral-400 dark:hover:border-teal-400 dark:hover:text-teal-300">
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
    <section className="revela mt-12 border-t border-neutral-200 pt-10 dark:border-neutral-800" style={{ ["--tarda" as string]: "0.16s" }}>
      {dx.redes?.map((r) => <BloqueRed key={r.id ?? r.red} r={r} />)}

      {dx.coherencia && (
        <div
          className={`mt-10 rounded-lg border-l-[3px] p-4 ${
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
        <div className="mt-10 rounded-lg border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900">
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
                className="rounded-lg border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900"
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
                  className="mt-2 w-full rounded-lg border border-neutral-300 bg-neutral-50 p-2 text-sm outline-none focus:border-teal-700 dark:border-neutral-700 dark:bg-neutral-950 dark:focus:border-teal-400"
                />
              </div>
            ))}
          </div>
          <button
            onClick={reDiagnosticar}
            disabled={cargando || !hayRespuestas}
            className="mt-3 rounded-lg border border-teal-700 px-5 py-2.5 font-semibold text-teal-700 transition hover:bg-teal-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-teal-400 dark:text-teal-400 dark:hover:bg-teal-950/40"
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

      {/* La cadena sigue. Antes el diagnóstico se acababa y el sistema se
          quedaba callado, como si corregir el perfil fuera el final. */}
      <div className="mt-12 rounded-lg border border-teal-700/30 bg-teal-50/60 p-5 dark:border-teal-400/25 dark:bg-teal-950/20">
        <p className="font-semibold">Con el perfil corregido, ya se puede armar la semana</p>
        <p className="mt-1 max-w-xl text-sm text-neutral-600 dark:text-neutral-400">
          Cinco piezas de lunes a viernes, cada una hablándole a alguien que
          está en un punto distinto. Usa lo que acabas de corregir.
        </p>
        <Link
          href="/semana"
          className="empuja mt-4 inline-block rounded-full bg-teal-700 px-5 py-2.5 font-semibold text-white dark:bg-teal-600"
        >
          Armar mi semana →
        </Link>
      </div>
    </section>
  );
}

function BloqueRed({ r }: { r: DiagnosticoRed }) {
  const fuera = r.puntos?.filter((p) => p.aplica === false).length ?? 0;
  const noVistos = r.puntos?.filter((p) => p.aplica !== false && !p.visible).length ?? 0;
  const evaluados = (r.puntos?.length ?? 5) - fuera - noVistos;

  return (
    <article className="mt-10 first:mt-0">
      <div className="flex flex-wrap items-baseline gap-5">
        {/* Un 0/5 cuando no se pudo revisar nada dice que falló los cinco, y es
            falso: no se miró ninguno. Sin dato no hay marcador. */}
        {evaluados > 0 ? (
          <span className="font-mono text-4xl font-bold tabular-nums text-teal-700 dark:text-teal-400">
            {r.pasan}
            <span className="text-2xl text-neutral-400">/5</span>
          </span>
        ) : (
          <span className="font-mono text-2xl font-bold text-neutral-400">sin revisar</span>
        )}
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

      {evaluados === 0 && (
        <p className="mt-3 rounded-lg border-l-[3px] border-amber-500 bg-amber-50 p-3 text-sm dark:bg-amber-950/30">
          No pude revisar ningún punto de esta red: las casillas llegaron
          vacías. Llénalas arriba —o sube la captura— y vuelve a diagnosticar.
        </p>
      )}

      {evaluados > 0 && noVistos + fuera > 0 && (
        <p className="mt-3 text-xs text-neutral-500">
          De los cinco, {noVistos + fuera === 1 ? "uno no se pudo revisar" : `${noVistos + fuera} no se pudieron revisar`}
          {noVistos > 0 && ` — ${noVistos === 1 ? "una casilla llegó vacía" : `${noVistos} casillas llegaron vacías`}`}
          {fuera > 0 && `${noVistos > 0 ? " y" : " —"} ${fuera === 1 ? "un punto no aplica" : `${fuera} puntos no aplican`} en esta red`}
          . Los que no se revisan no cuentan como fallo.
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

      <div className="mt-5 divide-y divide-neutral-200 overflow-hidden rounded-lg border border-neutral-200 dark:divide-neutral-800 dark:border-neutral-800">
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
                className="rounded-lg border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900"
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
    <div className="mt-2 rounded-lg border-l-2 border-teal-700 bg-neutral-50 p-3 dark:border-teal-400 dark:bg-neutral-950">
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

/**
 * Lo que publicó, guardado como muestras de cómo habla.
 *
 * Es lo que le saca partido de verdad al lector de enlaces. Una publicación
 * suelta no sirve para afirmar un patrón —una pieza no es un patrón— pero es
 * una muestra buenísima de cómo escribe, que es el campo que casi nadie rellena
 * y el único sin el que la función 3 se niega a escribir nada. Ya está escrito:
 * no hay por qué pedírselo otra vez en otro formulario.
 */
function ComoHablas({ textos }: { textos: string }) {
  const [estado, setEstado] = useState<"" | "yendo" | "listo" | "mal">("");
  const [dicho, setDicho] = useState("");

  async function guardar() {
    setEstado("yendo");
    try {
      const r = await fetch("/api/negocio/voz", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ textos }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error ?? "No se pudo guardar.");
      setEstado("listo");
      setDicho(
        d.añadidos === 0
          ? "Ya estaban guardados."
          : `Guardado${d.añadidos === 1 ? "" : "s"} ${d.añadidos} en «Cómo hablas».`,
      );
    } catch (e) {
      setEstado("mal");
      setDicho(e instanceof Error ? e.message : "No se pudo guardar.");
    }
  }

  return (
    <div className="mt-2 flex flex-wrap items-center gap-3">
      <button
        onClick={() => void guardar()}
        disabled={estado === "yendo"}
        className="rounded-lg border border-teal-700 px-3 py-1.5 font-mono text-[11px] uppercase tracking-wider text-teal-700 transition hover:bg-teal-50 disabled:opacity-40 dark:border-teal-400 dark:text-teal-400 dark:hover:bg-teal-950/40"
      >
        {estado === "yendo" ? "guardando…" : "usar esto como «cómo hablas»"}
      </button>
      <p
        className={`text-xs ${
          estado === "mal" ? "text-red-700 dark:text-red-400" : "text-neutral-500"
        }`}
      >
        {dicho ||
          "Estas son tus palabras de verdad. Sin ellas, la función 3 no escribe: sale correcto y no suena a ti."}
      </p>
    </div>
  );
}
