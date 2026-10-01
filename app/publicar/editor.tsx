"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { aWav, leerAudio } from "@/lib/audio";
import {
  AJUSTES,
  duracionDe,
  envolvente,
  reubicar,
  tramosAudibles,
  sinMuletillas,
  umbralSugerido,
  type Ajustes,
  type Tramo,
} from "@/lib/silencios";
import {
  ANIMACIONES,
  finDelGancho,
  aASS,
  enLineas,
  protegerPalabras,
  rehacerLinea,
  reubicarPalabras,
  type Animacion,
  type Linea,
  type Palabra,
} from "@/lib/subtitulos";
import {
  MAX_BYTES,
  MAX_SEGUNDOS,
  MAX_TRANSICIONES,
  SALIDA,
  extraerAudio,
  medirConMotor,
  montar,
  recorteDe,
  type Medida,
} from "@/lib/video";
import { apuntarHecho } from "@/lib/hecho";
import { EFECTOS, MAX_SUBIDO_S, delArchivo, efecto, type Efecto } from "@/lib/sonido";
import { insertosDe, useApoyos } from "./apoyo";
import { apoyosDe } from "@/lib/apoyos";
import { planos } from "@/lib/ritmo";
import { Onda } from "./onda";
import { Siguiente } from "./publicar";

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
export function Editor({
  guion,
  corridaId,
  graba,
}: {
  guion?: {
    descripcion?: string;
    gancho?: string;
    golpes?: { texto: string; apoyo?: string; apoyo_tuyo?: boolean }[];
  };
  corridaId?: string | null;
  /**
   * Qué grabó el dueño. En "voz en off" es SOLO audio, y entonces el video no
   * existe: lo arma el sistema con las imágenes. Pedirle un video en ese
   * formato era pedirle lo único que ese formato dice que no va a grabar.
   */
  graba?: "video" | "audio";
}) {
  const soloVoz = graba === "audio";
  const [nivel, setNivel] = useState<"base" | "completa">("completa");
  // El guion pide imágenes de apoyo cuando el formato es "con producción" o
  // "voz en off". El editor todavía no las coloca solo, así que lo dice y las
  // pone delante: es lo que hace falta tener a mano mientras se graba.
  const conApoyo = (guion?.golpes ?? []).filter((g) => g.apoyo?.trim());
  const [fuente, setFuente] = useState<Fuente | null>(null);
  const [fallo, setFallo] = useState("");
  const [analizando, setAnalizando] = useState(false);

  const [env, setEnv] = useState<Float32Array | null>(null);
  const [wav, setWav] = useState<Blob | null>(null);
  const [conAudio, setConAudio] = useState(true);
  const [ajustes, setAjustes] = useState<Ajustes>(AJUSTES);
  const [cortar, setCortar] = useState(true);
  const [quitarMuletillas, setQuitarMuletillas] = useState(true);

  const [palabras, setPalabras] = useState<Palabra[] | null>(null);
  const [transcribiendo, setTranscribiendo] = useState(false);
  const [subtitular, setSubtitular] = useState(true);
  const [animacion, setAnimacion] = useState<Animacion>("palabra");
  /**
   * Lo que el dueño corrigió a mano, por el sitio de la primera palabra de la
   * línea en la transcripción. Por el sitio y no por el tiempo: así mover los
   * deslizadores de silencio no le borra las correcciones.
   */
  const [correcciones, setCorrecciones] = useState<Record<number, string>>({});

  const [posicion, setPosicion] = useState(0.5);
  /**
   * La imagen que se está mirando en grande.
   *
   * La miniatura de la lista es de 90 píxeles de ancho y en un monitor no se
   * distingue si la foto que trajo el banco es la que va: se aceptaba a ciegas
   * y el fallo se veía con el MP4 ya montado, que tarda minutos.
   */
  const [mirando, setMirando] = useState<{ url: string; pide: string } | null>(null);

  /**
   * Qué suena en cada transición.
   *
   * Se elige y se puede oír antes de montar. Con un solo efecto fijo, al dueño
   * que no le gustaba no le quedaba más salida que bajar a la edición base y
   * quedarse sin transiciones: una preferencia de sonido le costaba la mitad
   * del montaje.
   */
  const [cualSonido, setCualSonido] = useState<Efecto | "mio">("golpe");
  const [mio, setMio] = useState<{ nombre: string; blob: Blob } | null>(null);
  const [falloSonido, setFalloSonido] = useState("");
  const oyendo = useRef<HTMLAudioElement | null>(null);

  const [montando, setMontando] = useState(false);
  const [avance, setAvance] = useState({ parte: 0, mensaje: "" });
  const [resultado, setResultado] = useState<{
    url: string;
    bytes: number;
    /** El fotograma que va a la ficha de "lo hecho". Lo saca ffmpeg al montar. */
    portada: string | null;
  } | null>(null);
  const [bajado, setBajado] = useState(false);

  const {
    lista: apoyos,
    buscar,
    poner,
    alternar,
    agregar,
    quitar,
    mover,
  } = useApoyos(guion?.golpes, palabras, fuente?.duracion ?? 0);


  const video = useRef<HTMLVideoElement>(null);
  const [cabeza, setCabeza] = useState<number | null>(null);
  const [saltando, setSaltando] = useState(false);

  // Los tramos se recalculan en cada movimiento del deslizador. Es barato
  // porque la envolvente ya está: decodificar es lo que costaba.
  const tramos: Tramo[] = useMemo(() => {
    if (!env || !fuente) return [];
    if (!cortar) return [{ desde: 0, hasta: fuente.duracion }];
    const crudos = tramosAudibles(env, fuente.duracion, ajustes);
    if (!palabras?.length) return crudos;
    // En cuanto hay transcripción, ningún corte puede partir una palabra. Es
    // lo que hacía que el video dijera media palabra y además se quedara sin
    // su subtítulo: el arranque de una ese suave cae por debajo del umbral.
    const protegidos = protegerPalabras(crudos, palabras);
    // Y las muletillas se quitan por lo que SON, no por su volumen: un "eh"
    // suena de sobra para pasar cualquier umbral.
    return quitarMuletillas ? sinMuletillas(protegidos, palabras) : protegidos;
  }, [env, fuente, ajustes, cortar, palabras, quitarMuletillas]);

  /** El WAV que se le pasa a ffmpeg. El suyo manda si lo trajo. */
  const sonido = useMemo(
    () => (cualSonido === "mio" ? (mio?.blob ?? efecto("golpe")) : efecto(cualSonido)),
    [cualSonido, mio],
  );

  /** Oírlo aquí, sin montar nada: montar tarda minutos y esto es un segundo. */
  const oir = useCallback((que: Blob) => {
    oyendo.current?.pause();
    const url = URL.createObjectURL(que);
    const a = new Audio(url);
    a.onended = () => URL.revokeObjectURL(url);
    oyendo.current = a;
    void a.play().catch(() => URL.revokeObjectURL(url));
  }, []);

  const traerSonido = useCallback(async (archivo: File) => {
    setFalloSonido("");
    try {
      const blob = await delArchivo(archivo);
      setMio({ nombre: archivo.name, blob });
      setCualSonido("mio");
      oir(blob);
    } catch {
      setFalloSonido("No pude leer ese archivo. Prueba con un MP3, un WAV o un M4A.");
    }
  }, [oir]);

  /**
   * Dónde va cada transición.
   *
   * Al principio de cada bloque del guion, no en cada corte de silencio. Un
   * corte de silencio tiene que ser invisible: señalarlo con un efecto delata
   * cada respiración que se quitó, y en un reel de treinta segundos serían
   * quince. Los bloques son tres o cuatro.
   */
  const transiciones = useMemo(() => {
    if (!palabras?.length || !guion?.golpes?.length) return [];
    // Los mismos momentos que los apoyos: se reparten aunque no se encuentre
    // la frase literal. Antes usaban el buscador estricto y, como solo el
    // gancho casa palabra por palabra, salía UNA transición en todo el video.
    return apoyosDeGolpes(guion.golpes, palabras)
      .map((m) => {
        const t = reubicar(m, tramos);
        return t === null ? null : { en: t, sonido };
      })
      .filter((t): t is { en: number; sonido: Blob } => t !== null)
      // La primera del video no: no hay de dónde venir.
      .filter((t) => t.en > 0.4)
      .slice(0, MAX_TRANSICIONES);
  }, [palabras, guion, tramos, sonido]);

  /**
   * El ritmo, en tiempos del video ya cortado.
   *
   * Sale de medir tres reels de referencia: un corte cada 2,0–5,1 segundos y
   * el plano mediano entre 1,9 y 3,4. Sin esto el video salía de una sola
   * toma quieta de principio a fin, por muy bien que estuvieran los
   * subtítulos.
   */
  const ritmo = useMemo(() => {
    if (!fuente) return [];
    const enCorte = (palabras ?? [])
      .map((p) => {
        const d = reubicar(p.desde, tramos);
        const h = reubicar(p.hasta, tramos);
        return d === null || h === null ? null : { ...p, desde: d, hasta: h };
      })
      .filter((p): p is NonNullable<typeof p> => p !== null);
    return planos(enCorte, duracionDe(tramos.length ? tramos : [{ desde: 0, hasta: fuente.duracion }]));
  }, [palabras, tramos, fuente]);

  const puestos = useMemo(
    () => (fuente ? insertosDe(apoyos, tramos, fuente.duracion) : []),
    [apoyos, tramos, fuente],
  );

  const duracionFinal = tramos.length ? duracionDe(tramos) : (fuente?.duracion ?? 0);
  const cortes = Math.max(0, tramos.length - 1);

  const lineas: Linea[] = useMemo(() => {
    if (!palabras || !subtitular) return [];
    const crudas = enLineas(reubicarPalabras(palabras, tramos));
    // Y encima se aplican las correcciones que ya hizo a mano.
    return crudas
      .map((l) => {
        const sitio = l.palabras[0]?.i;
        const texto = sitio === undefined ? undefined : correcciones[sitio];
        return texto === undefined ? l : rehacerLinea(l, texto);
      })
      .filter((l): l is Linea => l !== null);
  }, [palabras, tramos, subtitular, correcciones]);

  /**
   * El gancho en grande sobre la primera imagen, mientras lo dice.
   *
   * Dura lo que él tarda en decirlo, sacado de los tiempos de las palabras, y
   * no 1,8 segundos fijos. Por eso se calcula DESPUÉS de las líneas: necesita
   * saber dónde acaban.
   */
  const caratula = useMemo(
    () =>
      nivel === "completa" && guion?.gancho?.trim()
        ? { texto: guion.gancho.trim(), hasta: finDelGancho(guion.gancho, lineas) }
        : null,
    [nivel, guion, lineas],
  );

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

    // El audio se decodifica aquí y una sola vez, porque sirve para las dos
    // cosas que vienen después: dar la duración y sacar la envolvente.
    // Decodificar es lo caro de todo el análisis.
    let audio = await leerAudio(archivo).catch(() => null);

    let verEnPantalla = true;
    let medido: Medida | null = null;

    if (soloVoz) {
      // En voz en off no hay imagen que mostrar: lo que se enseña es la onda.
      verEnPantalla = false;
      if (!audio) {
        // El filtro del selector no cubre el arrastre, así que un video puede
        // entrar igual. En vez de rechazarlo se le saca la voz, que es lo
        // único que este formato necesita de él. Por ahí pasan también los
        // formatos que el navegador no abre.
        setAvance({
          parte: 0,
          mensaje: archivo.type.startsWith("video")
            ? "Eso es un video. Me quedo con tu voz…"
            : "Tu navegador no sabe leer ese formato. Abriendo el motor…",
        });
        const delMotor = await extraerAudio(archivo, setAvance);
        if (delMotor) audio = await leerAudio(delMotor).catch(() => null);
      }
      // Un audio no tiene ancho ni alto: se le da el tamaño de salida y punto.
      if (audio) medido = { duracion: audio.duracion_s, ancho: SALIDA.ancho, alto: SALIDA.alto };
      if (!medido) {
        const solo = await medirConMotor(archivo, setAvance).catch(() => null);
        if (solo) medido = { ...solo, ancho: SALIDA.ancho, alto: SALIDA.alto };
      }
      if (!medido) {
        URL.revokeObjectURL(url);
        setAnalizando(false);
        setFallo(
          "No pude leer ese audio. Prueba con un MP3, un M4A, un WAV o el archivo tal cual te lo dio la grabadora del teléfono.",
        );
        return;
      }
    } else {
      // Primero el navegador, que es instantáneo. Si no sabe leer el formato
      // —los iPhone graban en HEVC y Chrome no siempre puede— lo mide ffmpeg,
      // y entonces se monta igual: lo único que se pierde es la vista previa.
      medido = await medir(url).catch(() => null);
      if (!medido) {
        verEnPantalla = false;
        setAvance({
          parte: 0,
          mensaje: "Tu navegador no sabe leer ese formato. Abriendo el motor…",
        });
        medido = await medirConMotor(archivo, setAvance).catch(() => null);
      }
      if (!medido) {
        URL.revokeObjectURL(url);
        setAnalizando(false);
        setFallo("No pude leer ese archivo. ¿Seguro que es un video?");
        return;
      }
      // Ahora que el motor también mide los audios, un archivo sin imagen
      // llega hasta aquí en vez de morir con un "¿seguro que es un video?".
      // Decirle qué pasó y adónde ir es más útil que repetirle la pregunta.
      if (!medido.ancho || !medido.alto) {
        URL.revokeObjectURL(url);
        setAnalizando(false);
        setFallo(
          "Eso es un audio, no un video. Si no quieres salir en cámara, vuelve al paso 3 y elige «Voz en off»: ahí es exactamente lo que se pide.",
        );
        return;
      }
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
      // Si el navegador no supo abrir el contenedor —otra vez los HEVC de
      // iPhone— el motor saca el audio a WAV, que sí abre cualquiera. Sin esto
      // un video de iPhone perdería las dos cosas que valen de este editor:
      // los cortes y los subtítulos.
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
      setPalabras(
        ((d.palabras ?? []) as Palabra[]).map((p, i) => ({ ...p, i })),
      );
      setCorrecciones({});
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
      const montaje = await montar(
        {
          video: fuente.archivo,
          tramos: tramos.length ? tramos : [{ desde: 0, hasta: fuente.duracion }],
          encuadre: { ancho: fuente.ancho, alto: fuente.alto, posicion },
          // La carátula solo en la edición completa: es lo que abre los reels
          // de referencia, y en la base estorba.
          ass:
            lineas.length || caratula
              ? aASS(lineas, animacion, undefined, caratula)
              : null,
          conAudio,
          insertos: puestos,
          soloVoz,
          // En la edición base no hay transiciones ni efecto: es el corte
          // limpio, los subtítulos y el apoyo, y nada más.
          transiciones: nivel === "completa" ? transiciones : [],
          ritmo,
        },
        setAvance,
      );
      setResultado({
        url: URL.createObjectURL(montaje.video),
        bytes: montaje.video.size,
        portada: montaje.portada,
      });
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
      <Paso
        n="1"
        titulo={soloVoz ? "El audio que grabaste" : "El video que grabaste"}
        hecho={Boolean(fuente)}
      >
        <label className="block cursor-pointer rounded-lg border-2 border-dashed border-neutral-300 p-6 text-center transition-colors hover:border-teal-600 dark:border-neutral-700 dark:hover:border-teal-400">
          <input
            type="file"
            // Solo audio. Dejarlo en "audio/*,video/*" era seguir pidiéndole
            // un video en el formato que dice que no graba video.
            // Las extensiones van escritas además del tipo MIME a propósito.
            // En Windows, `audio/*` se resuelve contra el registro, y .m4a y
            // .aac a menudo no tienen tipo declarado allí: el selector los
            // pintaba en gris y no se podían ni elegir. Son justo los dos que
            // sueltan la grabadora de Android y los audios de WhatsApp.
            accept={
              soloVoz
                ? "audio/*,.m4a,.aac,.mp3,.wav,.ogg,.oga,.opus,.amr,.3gp,.3gpp,.weba,.webm,.flac,.caf"
                : "video/*,.mp4,.mov,.m4v,.webm,.mkv,.avi,.3gp,.3gpp"
            }
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void cargar(f);
              e.target.value = "";
            }}
          />
          <span className="font-semibold text-teal-700 dark:text-teal-400">
            {fuente
              ? soloVoz ? "Elegir otro audio" : "Elegir otro video"
              : soloVoz ? "Elegir el audio" : "Elegir el video"}
          </span>
          <span className="mt-1 block text-sm text-neutral-500">
            {soloVoz
              ? "Solo tu voz: una nota de voz del teléfono sirve. El video lo arma el sistema con las imágenes del guion."
              : "Sale de tu teléfono y se queda en tu navegador."}{" "}
            Hasta {MAX_SEGUNDOS / 60} minutos y {MAX_BYTES / 1e6} MB.
          </span>
        </label>

        {fuente && (
          <p className="mt-3 font-mono text-[11px] uppercase tracking-wider text-neutral-500">
            {fuente.ancho}×{fuente.alto} · {reloj(fuente.duracion)} ·{" "}
            {(fuente.archivo.size / 1e6).toFixed(1)} MB
            {!conAudio && " · sin pista de audio"}
          </p>
        )}

        {fuente && !fuente.verEnPantalla && !soloVoz && (
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

                {cortes === 0 && cortar && (
                  <p className="mt-3 rounded-lg border-l-[3px] border-amber-600 bg-amber-50 p-3 text-sm leading-relaxed dark:bg-amber-950/25">
                    <strong>No hay nada por debajo del umbral</strong>, así que el
                    video sale con la misma duración. Suele ser el cuarto: si se
                    oye la nevera, el aire o la calle, tus silencios no son
                    silencio para el medidor.{" "}
                    <strong>Sube «qué cuenta como silencio»</strong> hasta que
                    veas rojo en la onda entre frase y frase.
                  </p>
                )}

                <div>
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

                <div className="mt-4 space-y-2">
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={cortar}
                      onChange={(e) => setCortar(e.target.checked)}
                      className="accent-teal-700"
                    />
                    Cortar los silencios
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={quitarMuletillas}
                      disabled={!palabras}
                      onChange={(e) => setQuitarMuletillas(e.target.checked)}
                      className="accent-teal-700"
                    />
                    Quitar las muletillas sueltas
                    <span className="text-xs text-neutral-500">
                      {palabras
                        ? "«eh», «mmm», «o sea» cuando van solas entre pausas"
                        : "necesita los subtítulos del paso 3"}
                    </span>
                  </label>
                </div>
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
                  <>
                    <fieldset className="mt-4">
                      <legend className="font-mono text-[10px] uppercase tracking-wider text-neutral-500">
                        Cómo se mueven
                      </legend>
                      <div className="mt-2 grid gap-2 sm:grid-cols-3">
                        {ANIMACIONES.map((a) => (
                          <label
                            key={a.id}
                            className={`tarjeta cursor-pointer rounded-lg border p-3 ${
                              animacion === a.id
                                ? "border-teal-600 bg-teal-50/60 dark:border-teal-400 dark:bg-teal-950/25"
                                : "border-neutral-200 hover:border-neutral-400 dark:border-neutral-800"
                            }`}
                          >
                            <input
                              type="radio"
                              name="animacion"
                              className="sr-only"
                              checked={animacion === a.id}
                              onChange={() => setAnimacion(a.id)}
                            />
                            <span className="block text-sm font-semibold">{a.nombre}</span>
                            <span className="mt-0.5 block text-xs leading-snug text-neutral-500">
                              {a.que}
                            </span>
                          </label>
                        ))}
                      </div>
                    </fieldset>

                    <div className="mt-4">
                      <p className="font-mono text-[10px] uppercase tracking-wider text-neutral-500">
                        Lo que vas a quemar — corrígelo si falta algo
                      </p>
                      <div className="mt-2 max-h-72 space-y-1.5 overflow-y-auto rounded-lg border border-neutral-200 p-2 dark:border-neutral-800">
                        {lineas.map((l, i) => {
                          const sitio = l.palabras[0]?.i;
                          return (
                            <div key={sitio ?? i} className="flex items-center gap-2">
                              <span className="w-12 shrink-0 font-mono text-[11px] tabular-nums text-neutral-400">
                                {reloj(l.desde)}
                              </span>
                              <input
                                value={l.texto}
                                onChange={(e) => {
                                  if (sitio === undefined) return;
                                  setCorrecciones((c) => ({ ...c, [sitio]: e.target.value }));
                                }}
                                aria-label={`Subtítulo en ${reloj(l.desde)}`}
                                className="w-full rounded border border-transparent bg-neutral-50 px-2 py-1 text-sm outline-none hover:border-neutral-300 focus:border-teal-700 dark:bg-neutral-950 dark:hover:border-neutral-700 dark:focus:border-teal-400"
                              />
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    <div className="mt-2 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                      <p className="text-xs text-neutral-500">
                        {lineas.length} {lineas.length === 1 ? "línea" : "líneas"}. Los
                        tiempos ya vienen corridos por los cortes del paso 2, y ningún
                        corte parte una palabra.
                      </p>
                      {Object.keys(correcciones).length > 0 && (
                        <button
                          onClick={() => setCorrecciones({})}
                          className="font-mono text-[11px] uppercase tracking-wider text-neutral-500 underline underline-offset-4 hover:no-underline"
                        >
                          deshacer mis correcciones
                        </button>
                      )}
                    </div>
                  </>
                )}
              </>
            )}
          </Paso>

          {/* ── El apoyo, que ahora coloca el sistema ── */}
          {true && (
            <Paso
              n="3b"
              titulo="Las imágenes de apoyo"
              hecho={apoyos.some((a) => a.imagen && a.usar)}
              nota={
                palabras
                  ? "El sistema busca y coloca solo lo que se puede sacar de un banco. Lo que es tuyo de verdad te lo pide, y puedes añadir las tuyas donde quieras."
                  : "Saca primero los subtítulos: sin ellos no se sabe en qué segundo dices cada frase."
              }
            >
              {!palabras ? (
                <p className="text-sm text-neutral-500">
                  {conApoyo.length
                    ? `${conApoyo.length} ${conApoyo.length === 1 ? "imagen pendiente" : "imágenes pendientes"}.`
                    : "Este guion no pide ninguna, pero podrás añadir las tuyas."}
                </p>
              ) : (
                <ul className="space-y-2">
                  {apoyos.map((a) => (
                    <li
                      key={a.golpe}
                      className="flex flex-wrap items-start gap-3 rounded-lg border border-neutral-200 p-3 dark:border-neutral-800"
                    >
                      <button
                        type="button"
                        onClick={() => a.vista && setMirando({ url: a.vista, pide: a.pide })}
                        disabled={!a.vista}
                        aria-label={a.vista ? "Ver la imagen en grande" : undefined}
                        className="group/foto relative h-32 w-[72px] shrink-0 overflow-hidden rounded bg-neutral-100 disabled:cursor-default sm:h-40 sm:w-[90px] dark:bg-neutral-900"
                      >
                        {a.vista ? (
                          <>
                            {/* El recuadro es 9:16 y recorta igual que el video
                                (force_original_aspect_ratio=increase + crop):
                                lo que se ve aquí es lo que va a salir. */}
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={a.vista} alt="" className="h-full w-full object-cover" />
                            <span className="pointer-events-none absolute inset-x-0 bottom-0 bg-black/55 py-0.5 text-center font-mono text-[9px] uppercase tracking-wider text-white opacity-0 transition group-hover/foto:opacity-100">
                              ver grande
                            </span>
                          </>
                        ) : (
                          <span className="flex h-full items-center justify-center text-[10px] text-neutral-400">
                            {a.buscando ? "…" : "—"}
                          </span>
                        )}
                      </button>

                      <div className="min-w-0 flex-1">
                        <p className="text-sm leading-snug">
                          <span className="text-neutral-500">se ve:</span>{" "}
                          <strong>{a.pide}</strong>
                        </p>
                        <p className="mt-0.5 text-xs text-neutral-500">
                          {a.golpe < 0 && a.momento ? (
                            <>
                              <input
                                type="number"
                                min={0}
                                max={Math.floor(fuente.duracion)}
                                step={0.5}
                                value={a.momento.desde}
                                onChange={(e) => mover(a.golpe, Number(e.target.value))}
                                aria-label="En qué segundo entra"
                                className="w-16 rounded border border-neutral-300 bg-neutral-50 px-1 py-0.5 text-xs tabular-nums dark:border-neutral-700 dark:bg-neutral-950"
                              />{" "}
                              segundo · tuya
                            </>
                          ) : a.momento ? (
                            <>
                              {reloj(a.momento.desde)} ·{" "}
                              {a.exacto ? (
                                <>mientras dices «{a.texto.slice(0, 44)}{a.texto.length > 44 ? "…" : ""}»</>
                              ) : (
                                <span className="text-amber-700 dark:text-amber-500">
                                  sitio aproximado — no dijiste esa frase igual que el guion
                                </span>
                              )}
                            </>
                          ) : (
                            "no se coloca"
                          )}
                        </p>
                        {a.fallo && (
                          <p className="mt-0.5 text-xs text-red-700 dark:text-red-400">{a.fallo}</p>
                        )}

                        <div className="mt-2 flex flex-wrap items-center gap-3">
                          {esTuya(guion, a.golpe) ? (
                            <span className="rounded-full bg-amber-100 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-amber-900 dark:bg-amber-950 dark:text-amber-300">
                              tiene que ser tuya
                            </span>
                          ) : (
                            <button
                              onClick={() =>
                                void buscar(
                                  a.golpe,
                                  a.pide,
                                  a.vista ? { candidatas: a.candidatas, cual: a.cual } : undefined,
                                )
                              }
                              disabled={a.buscando}
                              className="font-mono text-[11px] uppercase tracking-wider text-teal-700 underline underline-offset-4 hover:no-underline disabled:opacity-40 dark:text-teal-400"
                            >
                              {a.buscando ? "buscando…" : a.vista ? "buscar otra" : "buscar en el banco"}
                            </button>
                          )}
                          <label className="cursor-pointer font-mono text-[11px] uppercase tracking-wider text-neutral-500 underline underline-offset-4 hover:no-underline">
                            <input
                              type="file"
                              accept="image/*"
                              className="hidden"
                              onChange={(e) => {
                                const f = e.target.files?.[0];
                                if (f) poner(a.golpe, f);
                                e.target.value = "";
                              }}
                            />
                            subir la mía
                          </label>
                          {a.golpe < 0 && (
                            <button
                              onClick={() => quitar(a.golpe)}
                              className="font-mono text-[11px] uppercase tracking-wider text-neutral-400 underline underline-offset-4 hover:text-red-700 hover:no-underline dark:hover:text-red-400"
                            >
                              quitar
                            </button>
                          )}
                          {a.momento && a.imagen && (
                            <label className="flex items-center gap-1.5 text-xs text-neutral-500">
                              <input
                                type="checkbox"
                                checked={a.usar}
                                onChange={() => alternar(a.golpe, a.usar)}
                                className="accent-teal-700"
                              />
                              usarla
                            </label>
                          )}
                        </div>
                      </div>
                    </li>
                  ))}
                  {apoyos.length === 0 && (
                    <li className="rounded-lg border border-dashed border-neutral-300 p-4 text-sm text-neutral-500 dark:border-neutral-700">
                      Este guion no pide imágenes de apoyo. Puedes añadir las
                      tuyas: una cada pocos segundos es lo que rompe el plano
                      fijo.
                    </li>
                  )}
                </ul>
              )}

              {palabras && (
                <button
                  onClick={agregar}
                  className="mt-3 font-mono text-[11px] uppercase tracking-wider text-teal-700 underline underline-offset-4 hover:no-underline dark:text-teal-400"
                >
                  + añadir una imagen mía
                </button>
              )}
            </Paso>
          )}

          {/* ── 4 · El encuadre y la prueba ── */}
          <Paso
            n="4"
            titulo={soloVoz ? "Cómo va a verse" : "El encuadre"}
            hecho
            nota={
              soloVoz
                ? "No hay nada que encuadrar: el video lo arman las imágenes del guion."
                : undefined
            }
          >
            <div className="grid gap-6 sm:grid-cols-[auto_1fr]">
              <div className="relative w-56 shrink-0 overflow-hidden rounded-lg bg-neutral-900">
                {!fuente.verEnPantalla && (
                  <p className="p-4 text-center text-xs text-neutral-400">
                    {soloVoz
                      ? "Grabaste solo la voz: aquí no hay imagen que mostrar. Se ve al montar."
                      : "Sin vista previa en este formato. El recorte se aplica igual."}
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
                    {soloVoz
                      ? "El video sale en 9:16 con las imágenes del guion y tu voz encima."
                      : "Ya lo grabaste en vertical: entra entero, no hay nada que recortar."}
                  </p>
                )}

                <p className="mt-4 text-sm text-neutral-600 dark:text-neutral-400">
                  {soloVoz ? (
                    <>
                      Dale a reproducir para <strong>oír cómo queda</strong> antes de
                      montarlo: salta los cortes igual que el montaje.
                    </>
                  ) : (
                    <>
                      Dale a reproducir para ver el resultado{" "}
                      <strong>antes de montarlo</strong>: el reproductor salta los
                      cortes. No monta nada, así que es inmediato.
                    </>
                  )}
                </p>
                <p className="mt-2 font-mono text-[11px] uppercase tracking-wider text-neutral-500">
                  Sale {SALIDA.ancho}×{SALIDA.alto} · MP4 · H.264
                </p>
              </div>
            </div>
          </Paso>

          {/* ── 5 · Montar ── */}
          <Paso
            n="5"
            titulo="Montarlo"
            hecho={Boolean(resultado)}
            nota="Cuánto se edita lo decides aquí, no en cómo te grabaste."
          >
            <fieldset className="mb-5 grid gap-2 sm:grid-cols-2">
              {NIVELES.map((n) => (
                <label
                  key={n.id}
                  className={`tarjeta cursor-pointer rounded-lg border p-4 ${
                    nivel === n.id
                      ? "border-teal-600 bg-teal-50/60 dark:border-teal-400 dark:bg-teal-950/25"
                      : "border-neutral-200 hover:border-neutral-400 dark:border-neutral-800"
                  }`}
                >
                  <input
                    type="radio"
                    name="nivel"
                    className="sr-only"
                    checked={nivel === n.id}
                    onChange={() => setNivel(n.id)}
                  />
                  <span className="block font-semibold">{n.nombre}</span>
                  <span className="mt-1 block text-sm leading-snug text-neutral-500">
                    {n.que}
                  </span>
                </label>
              ))}
            </fieldset>

            {nivel === "completa" && (
              <fieldset className="mb-5 rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
                <legend className="px-1 font-mono text-[10px] uppercase tracking-wider text-neutral-500">
                  El sonido de las transiciones
                </legend>
                <p className="text-sm text-neutral-600 dark:text-neutral-400">
                  Suena al empezar cada bloque del guion
                  {transiciones.length > 0 &&
                    `: ${transiciones.length === 1 ? "una vez" : `${transiciones.length} veces`} en este video`}
                  . Óyelo antes de montar.
                </p>
                <div className="mt-3 grid gap-2 sm:grid-cols-3">
                  {EFECTOS.map((e) => (
                    <label
                      key={e.id}
                      className={`tarjeta cursor-pointer rounded-lg border p-3 ${
                        cualSonido === e.id
                          ? "border-teal-600 bg-teal-50/60 dark:border-teal-400 dark:bg-teal-950/25"
                          : "border-neutral-200 hover:border-neutral-400 dark:border-neutral-800"
                      }`}
                    >
                      <input
                        type="radio"
                        name="sonido"
                        className="sr-only"
                        checked={cualSonido === e.id}
                        onChange={() => {
                          setCualSonido(e.id);
                          oir(efecto(e.id));
                        }}
                      />
                      <span className="flex items-baseline justify-between gap-2">
                        <span className="text-sm font-semibold">{e.nombre}</span>
                        <button
                          type="button"
                          onClick={(ev) => {
                            ev.preventDefault();
                            oir(efecto(e.id));
                          }}
                          className="shrink-0 font-mono text-[10px] uppercase tracking-wider text-teal-700 underline dark:text-teal-400"
                        >
                          oír
                        </button>
                      </span>
                      <span className="mt-0.5 block text-xs leading-snug text-neutral-500">
                        {e.que}
                      </span>
                    </label>
                  ))}
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-3">
                  <label className="empuja cursor-pointer rounded-full border border-neutral-300 px-4 py-1.5 text-sm font-semibold dark:border-neutral-700">
                    {mio ? "Cambiar el mío" : "Poner uno mío"}
                    <input
                      type="file"
                      accept="audio/*,.m4a,.aac,.mp3,.wav,.ogg,.opus,.flac"
                      className="sr-only"
                      onChange={(ev) => {
                        const a = ev.target.files?.[0];
                        ev.target.value = "";
                        if (a) void traerSonido(a);
                      }}
                    />
                  </label>
                  {mio && (
                    <label
                      className={`tarjeta flex cursor-pointer items-baseline gap-2 rounded-lg border px-3 py-1.5 ${
                        cualSonido === "mio"
                          ? "border-teal-600 bg-teal-50/60 dark:border-teal-400 dark:bg-teal-950/25"
                          : "border-neutral-200 hover:border-neutral-400 dark:border-neutral-800"
                      }`}
                    >
                      <input
                        type="radio"
                        name="sonido"
                        className="sr-only"
                        checked={cualSonido === "mio"}
                        onChange={() => {
                          setCualSonido("mio");
                          oir(mio.blob);
                        }}
                      />
                      <span className="max-w-[16rem] truncate text-sm font-semibold">
                        {mio.nombre}
                      </span>
                      <button
                        type="button"
                        onClick={(ev) => {
                          ev.preventDefault();
                          oir(mio.blob);
                        }}
                        className="shrink-0 font-mono text-[10px] uppercase tracking-wider text-teal-700 underline dark:text-teal-400"
                      >
                        oír
                      </button>
                    </label>
                  )}
                </div>
                <p className="mt-2 text-xs text-neutral-500">
                  Se queda con los primeros {MAX_SUBIDO_S} segundos y lo nivela, para que no te
                  tape la voz. El archivo no sale de tu navegador.
                </p>
                {falloSonido && (
                  <p className="mt-2 text-sm text-red-700 dark:text-red-400">{falloSonido}</p>
                )}
              </fieldset>
            )}

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

                  <ul className="mt-4 space-y-1 text-sm">
                    <Hizo
                      si={cortes > 0}
                      hecho={`Cortados ${cortes} ${cortes === 1 ? "silencio" : "silencios"}: ${reloj(fuente.duracion)} → ${reloj(duracionFinal)}`}
                      no="Sin cortar silencios — no había nada por debajo del umbral"
                    />
                    <Hizo
                      si={hayQueEncuadrar}
                      hecho={`Recortado de ${fuente.ancho}×${fuente.alto} a 9:16`}
                      no={`Ya venía en 9:16 (${fuente.ancho}×${fuente.alto}): no hubo nada que recortar`}
                    />
                    <Hizo
                      si={puestos.length > 0}
                      hecho={`${puestos.length} ${puestos.length === 1 ? "imagen de apoyo colocada" : "imágenes de apoyo colocadas"} en su sitio`}
                      no={
                        conApoyo.length > 0
                          ? "Sin imágenes de apoyo — no llegaste a elegirlas"
                          : "Este guion no pedía imágenes de apoyo"
                      }
                    />
                    <Hizo
                      si={Boolean(caratula)}
                      hecho="Carátula de entrada con el gancho"
                      no={
                        nivel === "base"
                          ? "Sin carátula — elegiste la edición base"
                          : "Sin carátula — el guion no trae gancho"
                      }
                    />
                    <Hizo
                      si={nivel === "completa" && transiciones.length > 0}
                      hecho={`${transiciones.length} ${transiciones.length === 1 ? "transición" : "transiciones"} entre bloques · ${cualSonido === "mio" ? "tu sonido" : EFECTOS.find((e) => e.id === cualSonido)?.nombre.toLowerCase()}`}
                      no={
                        nivel === "base"
                          ? "Sin transiciones — elegiste la edición base"
                          : "Sin transiciones — no encontré dónde cambian los bloques"
                      }
                    />
                    <Hizo
                      si={lineas.length > 0}
                      hecho={`${lineas.length} ${lineas.length === 1 ? "línea quemada" : "líneas quemadas"} · ${ANIMACIONES.find((a) => a.id === animacion)?.nombre.toLowerCase()}`}
                      no="Sin subtítulos"
                    />
                  </ul>
                  <a
                    href={resultado.url}
                    download="cadencia.mp4"
                    onClick={() => {
                      void apuntarHecho({
                        tipo: "video",
                        titulo: guion?.gancho ?? "",
                        detalle: `${reloj(duracionFinal)} · ${SALIDA.ancho}×${SALIDA.alto}`,
                        corridaId,
                        // Ya lo sacó el motor al montar: no hay que esperar a
                        // que el navegador decodifique nada.
                        portada: resultado.portada,
                      });
                      setBajado(true);
                    }}
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

            {bajado && <Siguiente que="El video ya está en tu carpeta de descargas." />}
          </Paso>
        </>
      )}

      {mirando && <Lupa {...mirando} cerrar={() => setMirando(null)} />}
    </div>
  );
}

/**
 * La imagen de apoyo en grande, recortada como va a salir.
 *
 * El recuadro es 9:16 y la foto va en object-cover, que es exactamente lo que
 * hace el montaje (`force_original_aspect_ratio=increase` y luego `crop`). Una
 * vista previa que enseñara la foto entera mentiría justo en lo que hay que
 * decidir: si lo que importa de esa foto se queda dentro del recorte.
 */
function Lupa({ url, pide, cerrar }: { url: string; pide: string; cerrar: () => void }) {
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => e.key === "Escape" && cerrar();
    window.addEventListener("keydown", tecla);
    return () => window.removeEventListener("keydown", tecla);
  }, [cerrar]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="La imagen de apoyo en grande"
      onClick={cerrar}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-6"
    >
      <div className="max-h-full" onClick={(e) => e.stopPropagation()}>
        <div className="mx-auto aspect-[9/16] max-h-[78vh] overflow-hidden rounded-lg bg-neutral-900">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={url} alt="" className="h-full w-full object-cover" />
        </div>
        <p className="mx-auto mt-3 max-w-sm text-center text-sm text-neutral-300">
          Así va a salir, ya recortada a 9:16. Pedía: <strong>{pide}</strong>
        </p>
        <button
          onClick={cerrar}
          className="mx-auto mt-3 block rounded-full bg-white px-4 py-1.5 text-sm font-semibold text-neutral-900"
        >
          Cerrar
        </button>
      </div>
    </div>
  );
}

/**
 * Los dos niveles de edición.
 *
 * Se elige aquí y no en el paso 3 a propósito: cómo te grabaste no debería
 * decidir cuánto se edita. El guion de video siempre trae las imágenes de
 * apoyo; este paso decide qué se hace con ellas.
 */
const NIVELES = [
  {
    id: "base" as const,
    nombre: "Edición base",
    que: "Cortes limpios, 9:16, subtítulos animados y las imágenes de apoyo. Sin efectos: el corte no se nota.",
  },
  {
    id: "completa" as const,
    nombre: "Edición completa",
    que: "Todo lo anterior, más transiciones con sonido entre los bloques del guion. Más llamativa, y tarda más en montarse.",
  },
];

/**
 * El segundo en que arranca cada frase del guion, en el video original.
 *
 * Se buscan en orden y cada una empieza donde acabó la anterior: los golpes
 * van seguidos, y usar ese orden evita que la frase tres se enganche a una
 * palabra suelta del principio.
 */
function apoyosDeGolpes(golpes: { texto: string }[], palabras: Palabra[]): number[] {
  // Se reutiliza el mismo repartidor de los apoyos, poniéndole un apoyo
  // ficticio a cada golpe: así los que no se encuentran se colocan igual, en
  // vez de desaparecer.
  return apoyosDe(
    golpes.map((g) => ({ texto: g.texto, apoyo: "x" })),
    palabras,
  )
    .map((a) => a.momento?.desde)
    .filter((t): t is number => t !== undefined && t !== null);
}

/** Si el guion marcó ese apoyo como material suyo, no se busca: se le pide. */
function esTuya(
  guion: { golpes?: { apoyo_tuyo?: boolean }[] } | undefined,
  golpe: number,
): boolean {
  return Boolean(guion?.golpes?.[golpe]?.apoyo_tuyo);
}

/** Una línea del recibo: lo que se hizo, o por qué no se hizo. */
function Hizo({ si, hecho, no }: { si: boolean; hecho: string; no: string }) {
  return (
    <li className={`flex gap-2 ${si ? "" : "text-neutral-500"}`}>
      <span className={si ? "text-teal-700 dark:text-teal-400" : "text-neutral-400"}>
        {si ? "✓" : "—"}
      </span>
      {si ? hecho : no}
    </li>
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
