"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { aWav, leerAudio } from "@/lib/audio";
import {
  AJUSTES,
  duracionDe,
  envolvente,
  tramosAudibles,
  umbralSugerido,
  type Ajustes,
  type Tramo,
} from "@/lib/silencios";
import {
  aASS,
  enLineas,
  reubicarPalabras,
  type Linea,
  type Palabra,
} from "@/lib/subtitulos";
import {
  MAX_BYTES,
  MAX_SEGUNDOS,
  SALIDA,
  extraerAudio,
  medirConMotor,
  montar,
  recorteDe,
} from "@/lib/video";
import { Onda } from "./onda";

type Fuente = {
  archivo: File;
  url: string;
  duracion: number;
  ancho: number;
  alto: number;
  /** Falso cuando el navegador no sabe decodificar el formato y solo lo lee ffmpeg. */
  verEnPantalla: boolean;
};

const reloj = (s: number) => {
  const m = Math.floor(s / 60);
  const r = s - m * 60;
  return `${m}:${r.toFixed(1).padStart(4, "0")}`;
};

/**
 * El editor de video.
 *
 * Todo pasa en el navegador menos una cosa, y esa cosa está señalada donde se
 * decide: los subtítulos mandan el audio —solo el audio, ya bajado a mono y a
 * 16 kHz— a transcribir. El video no sale nunca de la máquina, y el montaje
 * entero funciona sin pasar por ahí.
 */
export function Editor({ guion }: { guion?: { descripcion?: string } }) {
  const [fuente, setFuente] = useState<Fuente | null>(null);
  const [fallo, setFallo] = useState("");
  const [analizando, setAnalizando] = useState(false);

  const [env, setEnv] = useState<Float32Array | null>(null);
  const [wav, setWav] = useState<Blob | null>(null);
  const [conAudio, setConAudio] = useState(true);
  const [ajustes, setAjustes] = useState<Ajustes>(AJUSTES);
  const [cortar, setCortar] = useState(true);

  const [palabras, setPalabras] = useState<Palabra[] | null>(null);
  const [transcribiendo, setTranscribiendo] = useState(false);
  const [subtitular, setSubtitular] = useState(true);

  const [posicion, setPosicion] = useState(0.5);

  const [montando, setMontando] = useState(false);
  const [avance, setAvance] = useState({ parte: 0, mensaje: "" });
  const [resultado, setResultado] = useState<{ url: string; bytes: number } | null>(null);

  const video = useRef<HTMLVideoElement>(null);
  const [cabeza, setCabeza] = useState<number | null>(null);
  const [saltando, setSaltando] = useState(false);

  // Los tramos se recalculan en cada movimiento del deslizador. Es barato
  // porque la envolvente ya está: decodificar es lo que costaba.
  const tramos: Tramo[] = useMemo(() => {
    if (!env || !fuente) return [];
    if (!cortar) return [{ desde: 0, hasta: fuente.duracion }];
    return tramosAudibles(env, fuente.duracion, ajustes);
  }, [env, fuente, ajustes, cortar]);

  const duracionFinal = tramos.length ? duracionDe(tramos) : (fuente?.duracion ?? 0);
  const cortes = Math.max(0, tramos.length - 1);

  const lineas: Linea[] = useMemo(() => {
    if (!palabras || !subtitular) return [];
    return enLineas(reubicarPalabras(palabras, tramos));
  }, [palabras, tramos, subtitular]);

  const recorte = fuente
    ? recorteDe({ ancho: fuente.ancho, alto: fuente.alto, posicion })
    : null;
  // Cuando el video ya viene en 9:16 no hay nada que elegir: el recorte es el
  // cuadro entero y un deslizador que no mueve nada solo confunde.
  const hayQueEncuadrar =
    Boolean(recorte && fuente) &&
    (recorte!.ancho < fuente!.ancho - 2 || recorte!.alto < fuente!.alto - 2);

  useEffect(() => {
    return () => {
      if (fuente) URL.revokeObjectURL(fuente.url);
    };
  }, [fuente]);

  async function cargar(archivo: File) {
    setFallo("");
    setResultado(null);
    setPalabras(null);
    setEnv(null);

    if (archivo.size > MAX_BYTES) {
      setFallo(
        `Ese archivo pesa ${(archivo.size / 1e6).toFixed(0)} MB. El montaje corre dentro del navegador y por encima de ${MAX_BYTES / 1e6} MB se queda sin memoria. Baja la calidad al grabar o córtalo antes.`,
      );
      return;
    }

    const url = URL.createObjectURL(archivo);
    setAnalizando(true);

    // Primero el navegador, que es instantáneo. Si no sabe leer el formato
    // —los iPhone graban en HEVC y Chrome no siempre puede— lo mide ffmpeg, y
    // entonces se monta igual: lo único que se pierde es la vista previa.
    let verEnPantalla = true;
    let medido = await medir(url).catch(() => null);
    if (!medido) {
      verEnPantalla = false;
      setAvance({ parte: 0, mensaje: "Tu navegador no sabe leer ese formato. Abriendo el motor…" });
      medido = await medirConMotor(archivo, setAvance).catch(() => null);
    }

    if (!medido) {
      URL.revokeObjectURL(url);
      setAnalizando(false);
      setFallo("No pude leer ese archivo. ¿Seguro que es un video?");
      return;
    }
    if (medido.duracion > MAX_SEGUNDOS) {
      URL.revokeObjectURL(url);
      setAnalizando(false);
      setFallo(
        `Ese video dura ${Math.round(medido.duracion)} segundos. El editor llega hasta ${MAX_SEGUNDOS / 60} minutos, que es más de lo que dura cualquier reel.`,
      );
      return;
    }

    setFuente({ archivo, url, verEnPantalla, ...medido });
    try {
      // El navegador primero. Si no sabe abrir el contenedor —otra vez los
      // HEVC de iPhone— el motor saca el audio a WAV, que sí abre cualquiera.
      // Sin esto, un video de iPhone perdería las dos cosas que valen de todo
      // este editor: los cortes y los subtítulos.
      let audio = await leerAudio(archivo).catch(() => null);
      if (!audio) {
        setAvance({ parte: 0, mensaje: "Sacando el audio con el motor…" });
        const delMotor = await extraerAudio(archivo, setAvance);
        if (delMotor) audio = await leerAudio(delMotor).catch(() => null);
      }
      if (!audio) throw new Error("sin pista de audio");

      const e = envolvente(audio.canal, audio.muestreo);
      setEnv(e);
      setWav(aWav(audio.canal));
      setConAudio(true);
      setCortar(true);
      // El umbral se propone a partir de SU cuarto, no de un número fijo.
      setAjustes({ ...AJUSTES, umbral_db: umbralSugerido(e) });
    } catch {
      // Un video sin pista de audio se monta igual: se recorta y se sube.
      setConAudio(false);
      setEnv(null);
      setWav(null);
      setCortar(false);
      setSubtitular(false);
    } finally {
      setAnalizando(false);
    }
  }

  async function transcribir() {
    if (!wav || !fuente) return;
    setTranscribiendo(true);
    setFallo("");
    try {
      const cuerpo = new FormData();
      cuerpo.append("audio", new File([wav], "voz.wav", { type: "audio/wav" }));
      cuerpo.append("segundos", String(Math.ceil(fuente.duracion)));
      const r = await fetch("/api/voz", { method: "POST", body: cuerpo });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error ?? "No se pudo transcribir.");
      setPalabras(d.palabras ?? []);
      setSubtitular(true);
    } catch (e) {
      setFallo(e instanceof Error ? e.message : "No se pudo transcribir.");
    } finally {
      setTranscribiendo(false);
    }
  }

  async function armar() {
    if (!fuente) return;
    setMontando(true);
    setFallo("");
    setResultado(null);
    try {
      const blob = await montar(
        {
          video: fuente.archivo,
          tramos: tramos.length ? tramos : [{ desde: 0, hasta: fuente.duracion }],
          encuadre: { ancho: fuente.ancho, alto: fuente.alto, posicion },
          ass: lineas.length ? aASS(lineas) : null,
          conAudio,
        },
        setAvance,
      );
      setResultado({ url: URL.createObjectURL(blob), bytes: blob.size });
    } catch (e) {
      setFallo(
        e instanceof Error
          ? `No se pudo montar: ${e.message}`
          : "No se pudo montar el video.",
      );
    } finally {
      setMontando(false);
    }
  }

  /** La vista previa salta los cortes sin montar nada: se ve al instante. */
  const vigilar = useCallback(() => {
    const v = video.current;
    if (!v || tramos.length === 0) return;
    const t = v.currentTime;
    setCabeza(t);
    if (!saltando) return;
    const dentro = tramos.find((tr) => t >= tr.desde - 0.02 && t <= tr.hasta);
    if (dentro) return;
    const siguiente = tramos.find((tr) => tr.desde > t);
    if (siguiente) v.currentTime = siguiente.desde;
    else v.pause();
  }, [tramos, saltando]);

  useEffect(() => {
    const v = video.current;
    if (!v) return;
    const id = setInterval(vigilar, 40);
    return () => clearInterval(id);
  }, [vigilar]);

  return (
    <div className="mt-9 space-y-10">
      {/* ── 1 · El archivo ── */}
      <Paso n="1" titulo="El video que grabaste" hecho={Boolean(fuente)}>
        <label className="block cursor-pointer rounded-lg border-2 border-dashed border-neutral-300 p-6 text-center transition-colors hover:border-teal-600 dark:border-neutral-700 dark:hover:border-teal-400">
          <input
            type="file"
            accept="video/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void cargar(f);
              e.target.value = "";
            }}
          />
          <span className="font-semibold text-teal-700 dark:text-teal-400">
            {fuente ? "Elegir otro video" : "Elegir el video"}
          </span>
          <span className="mt-1 block text-sm text-neutral-500">
            Sale de tu teléfono y se queda en tu navegador. Hasta{" "}
            {MAX_SEGUNDOS / 60} minutos y {MAX_BYTES / 1e6} MB.
          </span>
        </label>

        {fuente && (
          <p className="mt-3 font-mono text-[11px] uppercase tracking-wider text-neutral-500">
            {fuente.ancho}×{fuente.alto} · {reloj(fuente.duracion)} ·{" "}
            {(fuente.archivo.size / 1e6).toFixed(1)} MB
            {!conAudio && " · sin pista de audio"}
          </p>
        )}

        {fuente && !fuente.verEnPantalla && (
          <p className="mt-2 rounded-lg border-l-[3px] border-amber-600 bg-amber-50 p-3 text-sm dark:bg-amber-950/30">
            Tu navegador no sabe mostrar este formato —suele pasar con los
            videos de iPhone grabados en <strong>Alta eficiencia</strong>— así
            que aquí no vas a ver la vista previa. Se monta igual: el motor sí
            lo lee, y el MP4 que sale se ve en todas partes.
          </p>
        )}
      </Paso>

      {fallo && (
        <p className="rounded-lg border-l-[3px] border-red-700 bg-red-50 p-3 text-sm text-red-900 dark:bg-red-950/40 dark:text-red-200">
          {fallo}
        </p>
      )}

      {fuente && (
        <>
          {/* ── 2 · Los silencios ── */}
          <Paso
            n="2"
            titulo="Los silencios"
            hecho={Boolean(env)}
            nota={
              conAudio
                ? "Se calcula aquí, sobre la onda. El audio no sale de tu máquina para esto."
                : "Este video no trae audio, así que no hay nada que cortar."
            }
          >
            {analizando && <p className="text-sm text-neutral-500">Escuchando el audio…</p>}

            {env && (
              <>
                <div className="flex flex-wrap items-baseline gap-x-6 gap-y-1">
                  <p className="text-2xl font-bold tracking-tight tabular-nums">
                    {reloj(fuente.duracion)} → {reloj(duracionFinal)}
                  </p>
                  <p className="text-sm text-neutral-500">
                    {cortes === 0
                      ? "Sin cortes con estos ajustes."
                      : `${cortes} ${cortes === 1 ? "corte" : "cortes"}, ${Math.round(
                          fuente.duracion - duracionFinal,
                        )}s fuera.`}
                  </p>
                </div>

                <div className="mt-4">
                  <Onda
                    env={env}
                    tramos={tramos}
                    duracion={fuente.duracion}
                    umbral={ajustes.umbral_db}
                    cabeza={cabeza}
                    alIrA={(s) => {
                      if (video.current) video.current.currentTime = s;
                    }}
                  />
                  <p className="mt-1.5 text-xs text-neutral-500">
                    Verde se queda, rojo se va. Toca la onda para saltar ahí.
                  </p>
                </div>

                <div className="mt-5 grid gap-5 sm:grid-cols-2">
                  <Deslizador
                    etiqueta="Qué cuenta como silencio"
                    valor={ajustes.umbral_db}
                    min={-60}
                    max={-20}
                    paso={1}
                    unidad=" dB"
                    pista="Súbelo si te deja silencios dentro. Bájalo si se come palabras."
                    alCambiar={(v) => setAjustes({ ...ajustes, umbral_db: v })}
                  />
                  <Deslizador
                    etiqueta="Pausa mínima para cortar"
                    valor={ajustes.silencio_min_s}
                    min={0.15}
                    max={1.5}
                    paso={0.05}
                    unidad=" s"
                    pista="Por debajo de esto es una respiración y se respeta."
                    alCambiar={(v) => setAjustes({ ...ajustes, silencio_min_s: v })}
                  />
                </div>

                <label className="mt-4 flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={cortar}
                    onChange={(e) => setCortar(e.target.checked)}
                    className="accent-teal-700"
                  />
                  Cortar los silencios
                </label>
              </>
            )}
          </Paso>

          {/* ── 3 · Los subtítulos ── */}
          <Paso
            n="3"
            titulo="Los subtítulos"
            hecho={Boolean(palabras?.length)}
            nota="Es lo único de todo el editor que sale de tu máquina, y sale solo el audio —nunca el video. Si lo saltas, el montaje funciona igual."
          >
            {!conAudio ? (
              <p className="text-sm text-neutral-500">Sin audio no hay nada que subtitular.</p>
            ) : !palabras ? (
              <button
                onClick={() => void transcribir()}
                disabled={transcribiendo || !wav}
                className="empuja rounded-full bg-teal-700 px-5 py-2.5 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40 dark:bg-teal-600"
              >
                {transcribiendo ? "Escuchando lo que dices…" : "Sacar los subtítulos"}
              </button>
            ) : lineas.length === 0 && subtitular ? (
              <p className="text-sm text-neutral-500">
                No se entendió ninguna palabra. Se monta sin subtítulos.
              </p>
            ) : (
              <>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={subtitular}
                    onChange={(e) => setSubtitular(e.target.checked)}
                    className="accent-teal-700"
                  />
                  Quemar los subtítulos en el video
                </label>
                {subtitular && (
                  <div className="mt-3 max-h-56 overflow-y-auto rounded-lg border border-neutral-200 dark:border-neutral-800">
                    {lineas.map((l, i) => (
                      <p
                        key={i}
                        className="flex gap-3 border-b border-neutral-100 px-3 py-1.5 text-sm last:border-0 dark:border-neutral-900"
                      >
                        <span className="shrink-0 font-mono text-[11px] tabular-nums text-neutral-400">
                          {reloj(l.desde)}
                        </span>
                        {l.texto}
                      </p>
                    ))}
                  </div>
                )}
                <p className="mt-2 text-xs text-neutral-500">
                  {lineas.length} {lineas.length === 1 ? "línea" : "líneas"}. Los tiempos
                  ya vienen corridos por los cortes del paso 2.
                </p>
              </>
            )}
          </Paso>

          {/* ── 4 · El encuadre y la prueba ── */}
          <Paso n="4" titulo="El encuadre" hecho>
            <div className="grid gap-6 sm:grid-cols-[auto_1fr]">
              <div className="relative w-56 shrink-0 overflow-hidden rounded-lg bg-neutral-900">
                {!fuente.verEnPantalla && (
                  <p className="p-4 text-center text-xs text-neutral-400">
                    Sin vista previa en este formato. El recorte se aplica igual.
                  </p>
                )}
                <video
                  hidden={!fuente.verEnPantalla}
                  ref={video}
                  src={fuente.url}
                  controls
                  playsInline
                  className="w-full"
                  onPlay={() => setSaltando(cortar)}
                />
                {recorte && hayQueEncuadrar && (
                  <div
                    aria-hidden
                    className="pointer-events-none absolute inset-0"
                    style={{
                      boxShadow: "inset 0 0 0 9999px rgba(0,0,0,0.55)",
                      clipPath: `inset(${(recorte.y / fuente.alto) * 100}% ${
                        100 - ((recorte.x + recorte.ancho) / fuente.ancho) * 100
                      }% ${100 - ((recorte.y + recorte.alto) / fuente.alto) * 100}% ${
                        (recorte.x / fuente.ancho) * 100
                      }%)`,
                    }}
                  />
                )}
              </div>

              <div>
                {hayQueEncuadrar ? (
                  <Deslizador
                    etiqueta={
                      fuente.ancho / fuente.alto > SALIDA.ancho / SALIDA.alto
                        ? "Qué parte del ancho se queda"
                        : "Qué parte del alto se queda"
                    }
                    valor={posicion}
                    min={0}
                    max={1}
                    paso={0.01}
                    unidad="%"
                    pista="Lo oscuro es lo que se va. Ponte tú dentro."
                    alCambiar={setPosicion}
                  />
                ) : (
                  <p className="text-sm text-neutral-500">
                    Ya lo grabaste en vertical: entra entero, no hay nada que recortar.
                  </p>
                )}

                <p className="mt-4 text-sm text-neutral-600 dark:text-neutral-400">
                  Dale a reproducir para ver el resultado <strong>antes de montarlo</strong>:
                  el reproductor salta los cortes. No monta nada, así que es inmediato.
                </p>
                <p className="mt-2 font-mono text-[11px] uppercase tracking-wider text-neutral-500">
                  Sale {SALIDA.ancho}×{SALIDA.alto} · MP4 · H.264
                </p>
              </div>
            </div>
          </Paso>

          {/* ── 5 · Montar ── */}
          <Paso n="5" titulo="Montarlo" hecho={Boolean(resultado)}>
            <button
              onClick={() => void armar()}
              disabled={montando}
              className="empuja rounded-full bg-teal-700 px-5 py-2.5 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40 dark:bg-teal-600"
            >
              {montando ? "Montando…" : resultado ? "Volver a montar" : "Montar el video"}
            </button>

            {montando && (
              <div className="mt-4">
                <div className="h-1.5 overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-800">
                  <div
                    className="h-full rounded-full bg-teal-600 transition-[width] duration-300 dark:bg-teal-400"
                    style={{ width: `${Math.round(avance.parte * 100)}%` }}
                  />
                </div>
                <p className="mt-2 text-sm text-neutral-500">{avance.mensaje}</p>
                <p className="mt-1 text-xs text-neutral-500">
                  Corre dentro de tu navegador, así que tarda: cuenta con más o menos
                  un minuto por cada quince segundos de video. Puedes dejar la pestaña
                  abierta y seguir en otra.
                </p>
              </div>
            )}

            {resultado && !montando && (
              <div className="mt-5 grid gap-5 sm:grid-cols-[auto_1fr]">
                <video
                  src={resultado.url}
                  controls
                  playsInline
                  className="w-56 rounded-lg bg-neutral-900"
                />
                <div>
                  <p className="font-semibold">Listo para subir</p>
                  <p className="mt-1 font-mono text-[11px] uppercase tracking-wider text-neutral-500">
                    {SALIDA.ancho}×{SALIDA.alto} · {reloj(duracionFinal)} ·{" "}
                    {(resultado.bytes / 1e6).toFixed(1)} MB
                  </p>
                  <a
                    href={resultado.url}
                    download="cadencia.mp4"
                    className="empuja mt-4 inline-block rounded-full bg-teal-700 px-5 py-2.5 font-semibold text-white dark:bg-teal-600"
                  >
                    Descargar el MP4
                  </a>
                  {guion?.descripcion && (
                    <div className="mt-5">
                      <p className="font-mono text-[10px] uppercase tracking-wider text-neutral-500">
                        La descripción que escribiste en el paso 3
                      </p>
                      <p className="mt-1 whitespace-pre-wrap rounded-lg border border-neutral-200 p-3 text-sm dark:border-neutral-800">
                        {guion.descripcion}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </Paso>
        </>
      )}
    </div>
  );
}

function Paso({
  n,
  titulo,
  nota,
  hecho,
  children,
}: {
  n: string;
  titulo: string;
  nota?: string;
  hecho?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div className="flex items-baseline gap-3">
        <span
          className={`font-mono text-xs tabular-nums ${
            hecho ? "text-teal-700 dark:text-teal-400" : "text-neutral-400"
          }`}
        >
          {n}
        </span>
        <h3 className="font-semibold tracking-tight">{titulo}</h3>
      </div>
      {nota && <p className="ml-7 mt-0.5 text-sm text-neutral-500">{nota}</p>}
      <div className="ml-7 mt-3">{children}</div>
    </section>
  );
}

function Deslizador({
  etiqueta,
  valor,
  min,
  max,
  paso,
  unidad,
  pista,
  alCambiar,
}: {
  etiqueta: string;
  valor: number;
  min: number;
  max: number;
  paso: number;
  unidad: string;
  pista: string;
  alCambiar: (v: number) => void;
}) {
  return (
    <label className="block">
      <span className="flex items-baseline justify-between gap-3">
        <span className="font-mono text-[10px] uppercase tracking-wider text-neutral-500">
          {etiqueta}
        </span>
        <span className="font-mono text-xs tabular-nums">
          {unidad === "%"
            ? `${Math.round(valor * 100)}%`
            : paso < 1
              ? `${valor.toFixed(2)}${unidad}`
              : `${Math.round(valor)}${unidad}`}
        </span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={paso}
        value={valor}
        onChange={(e) => alCambiar(Number(e.target.value))}
        className="mt-1.5 w-full accent-teal-700"
      />
      <span className="block text-xs text-neutral-500">{pista}</span>
    </label>
  );
}

/** Ancho, alto y duración, leídos del propio archivo. */
function medir(url: string) {
  return new Promise<{ duracion: number; ancho: number; alto: number }>((ok, mal) => {
    const v = document.createElement("video");
    v.preload = "metadata";
    v.onloadedmetadata = () => {
      if (!v.videoWidth || !Number.isFinite(v.duration)) return mal(new Error("ilegible"));
      ok({ duracion: v.duration, ancho: v.videoWidth, alto: v.videoHeight });
    };
    v.onerror = () => mal(new Error("ilegible"));
    v.src = url;
  });
}
