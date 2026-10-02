/**
 * Los efectos de sonido, sintetizados aquí.
 *
 * No se descargan de ningún banco: se calculan. Un golpe es un seno que cae y
 * un barrido es ruido filtrado con una envolvente, y escribirlos son treinta
 * líneas cada uno.
 *
 * La razón no es de gusto. Un banco de efectos mete una licencia de un tercero
 * dentro de los videos del dueño, y si mañana ese banco cambia sus términos el
 * problema es de él, que ya publicó. Lo que se calcula aquí no tiene licencia
 * de nadie.
 *
 * Son tres y se pueden oír antes de montar, porque "el efecto no me gusta" es
 * una queja legítima que no se puede resolver con un solo sonido fijo. Y el
 * dueño puede traer el suyo: ahí la licencia ya es asunto suyo, y el archivo
 * no sale de su navegador.
 */

import { aWav } from "./audio";

const MUESTREO = 44100;

export type Efecto = "golpe" | "clic" | "barrido" | "flash" | "impacto";

/** Lo que ve el dueño en el editor. El orden es el de la lista. */
export const EFECTOS: { id: Efecto; nombre: string; que: string }[] = [
  { id: "golpe", nombre: "Golpe", que: "Grave y seco. Marca el cambio sin taparte la voz." },
  { id: "clic", nombre: "Clic", que: "Corto y agudo. Casi no se nota, solo apoya el corte." },
  { id: "barrido", nombre: "Barrido", que: "El “swish” de siempre: aire que pasa." },
  { id: "flash", nombre: "Flash", que: "Dos disparos seguidos, como el obturador de una cámara." },
  { id: "impacto", nombre: "Impacto", que: "Entra subiendo y revienta en grave. El más dramático." },
];

/** Ruido con la semilla fija: el mismo efecto suena igual siempre. */
function ruido(semilla: number): () => number {
  let s = semilla >>> 0;
  return () => {
    // xorshift: barato y suficiente. No hace falta azar de verdad.
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return ((s >>> 0) / 0xffffffff) * 2 - 1;
  };
}

/**
 * Un golpe seco y grave, para el arranque de un bloque.
 *
 * El chasquido de los primeros milisegundos no es un adorno: sin él el seno
 * grave se pierde en el altavoz de un teléfono, que no baja de 300 Hz.
 */
function golpe(duracion = 0.24): Float32Array {
  const n = Math.round(duracion * MUESTREO);
  const salida = new Float32Array(n);
  const dado = ruido(0x9017e);
  for (let i = 0; i < n; i++) {
    const t = i / MUESTREO;
    // Un seno que cae de 150 Hz a 45 Hz: el "boom" de toda la vida.
    const hz = 150 * Math.pow(45 / 150, i / n);
    const cuerpo = Math.sin(2 * Math.PI * hz * t) * Math.exp(-t * 13) * 0.85;
    // Seis milisegundos de ruido encima, para que se oiga en un teléfono.
    const punta = t < 0.006 ? dado() * (1 - t / 0.006) * 0.3 : 0;
    salida[i] = cuerpo + punta;
  }
  return salida;
}

/**
 * Un clic: ruido agudo de cincuenta milisegundos.
 *
 * Es el que se pone cuando el video ya tiene bastante encima. Suena a corte
 * de montaje, no a efecto, y eso es justo lo que se le pide.
 */
function clic(duracion = 0.055): Float32Array {
  const n = Math.round(duracion * MUESTREO);
  const salida = new Float32Array(n);
  const dado = ruido(0xc11c0);
  // Dos pasos altos en cascada: deja el ruido en la banda de los 3 kHz, que
  // es donde el oído lee "tic" en vez de "pff".
  let b1 = 0;
  let b2 = 0;
  for (let i = 0; i < n; i++) {
    const t = i / MUESTREO;
    const x = dado();
    b1 += 0.55 * (x - b1);
    const alto1 = x - b1;
    b2 += 0.55 * (alto1 - b2);
    const alto2 = alto1 - b2;
    // Un poco de tono para que tenga altura y no sea solo aire.
    const tono = Math.sin(2 * Math.PI * 1800 * t) * 0.25;
    salida[i] = (alto2 * 1.4 + tono) * Math.exp(-t * 95) * 0.9;
  }
  return salida;
}

/**
 * Un barrido: ruido cuyo filtro se abre de golpe y se cierra cayendo.
 *
 * Abre y no vuelve a cerrar el corte a mitad de camino, como hacía la primera
 * versión: un barrido simétrico suena a estática, y lo que se busca es la "sh"
 * de algo que pasó volando.
 */
function barrido(duracion = 0.3): Float32Array {
  const n = Math.round(duracion * MUESTREO);
  const salida = new Float32Array(n);
  const dado = ruido(0x5eed1);
  let bajo = 0;
  let rumor = 0;
  for (let i = 0; i < n; i++) {
    const t = i / n;
    const x = dado();
    // El corte sube de grave a agudo y se queda arriba.
    bajo += (0.03 + Math.pow(t, 0.45) * 0.55) * (x - bajo);
    // Y se le quita el rumor de abajo: en un reel esa parte solo embarra.
    rumor += 0.012 * (bajo - rumor);
    const ataque = Math.min(1, t / 0.05);
    const caida = Math.pow(1 - t, 2.2);
    salida[i] = (bajo - rumor) * ataque * caida * 1.1;
  }
  return salida;
}

/**
 * Dos disparos de obturador: impactos a 26 ms, cuerpo en 410 Hz y cola corta.
 *
 * Medido: el 85% de la energía cae entre 250 y 500 Hz. Ahí es donde el oído
 * lee "cámara" en vez de "palmada".
 */
function flash(duracion = 0.22): Float32Array {
  const n = Math.round(duracion * MUESTREO);
  const salida = new Float32Array(n);
  const dado = ruido(0xf1a54);
  // Paso bajo ~520 Hz y paso alto ~180 Hz: deja la banda del golpe y tira el
  // aire de arriba y el retumbo de abajo.
  const aLo = 1 - Math.exp((-2 * Math.PI * 520) / MUESTREO);
  const aHi = 1 - Math.exp((-2 * Math.PI * 180) / MUESTREO);
  let lo1 = 0;
  let lo2 = 0;
  let hi = 0;
  for (let i = 0; i < n; i++) {
    const t = i / MUESTREO;
    const x = dado();
    lo1 += aLo * (x - lo1);
    lo2 += aLo * (lo1 - lo2);
    hi += aHi * (lo2 - hi);
    const cuerpo = lo2 - hi;
    // Dos obturadores. El segundo llega 26 ms después y un poco más flojo.
    const env = Math.exp(-t * 28) + 0.72 * Math.exp(-Math.max(0, t - 0.026) * 34);
    const tono =
      Math.sin(2 * Math.PI * 410 * t) * 0.35 + Math.sin(2 * Math.PI * 820 * t) * 0.08;
    salida[i] = (cuerpo * 1.6 + tono) * env * 0.42;
  }
  return salida;
}

/**
 * Sube 160 ms, pega, rebota a los 80 y se apaga.
 *
 * Medido: el 67% por debajo de 120 Hz, y el resto hasta 1 kHz concentrado en
 * el golpe. Es el único de los cinco que se anuncia antes de sonar, así que
 * marca un cambio de bloque más fuerte que los demás.
 */
function impacto(duracion = 0.48): Float32Array {
  const n = Math.round(duracion * MUESTREO);
  const salida = new Float32Array(n);
  const dado = ruido(0xf1a52);
  const chasquido = ruido(0xf1a53);
  const aLo = 1 - Math.exp((-2 * Math.PI * 160) / MUESTREO);
  const aHi = 1 - Math.exp((-2 * Math.PI * 900) / MUESTREO);
  let lo1 = 0;
  let lo2 = 0;
  let c1 = 0;
  let c2 = 0;
  for (let i = 0; i < n; i++) {
    const t = i / MUESTREO;
    const x = dado();
    lo1 += aLo * (x - lo1);
    lo2 += aLo * (lo1 - lo2);
    // El impacto trae un poco de medio que el retumbo no tiene.
    const c = chasquido();
    c1 += aHi * (c - c1);
    const alto = c - c1;
    c2 += aHi * (alto - c2);
    const medio = alto - c2;
    const subida = Math.min(1, t / 0.16) ** 1.7;
    const golpe = Math.exp(-Math.max(0, t - 0.16) * 9);
    const rebote = 0.45 * Math.exp(-Math.max(0, t - 0.24) * 14);
    const env = (subida * 0.35 + golpe + rebote) * Math.exp(-t * 1.2);
    const tono =
      Math.sin(2 * Math.PI * 68 * t) * 0.7 +
      Math.sin(2 * Math.PI * 136 * t) * 0.25 +
      Math.sin(2 * Math.PI * 40 * t) * 0.2;
    const transiente = medio * Math.exp(-Math.max(0, t - 0.16) * 40) * 0.55;
    salida[i] = (lo2 * 1.3 + tono + transiente) * env * 0.5;
  }
  return salida;
}

const DE: Record<Efecto, () => Float32Array> = { golpe, clic, barrido, flash, impacto };

/** Se calcula una vez por pestaña: son los mismos cinco archivos siempre. */
const hechos = new Map<Efecto, Blob>();

export function efecto(cual: Efecto): Blob {
  const ya = hechos.get(cual);
  if (ya) return ya;
  const b = aWav(arreglar((DE[cual] ?? golpe)()), MUESTREO);
  hechos.set(cual, b);
  return b;
}

/** Lo más largo que se acepta de un archivo traído de fuera. */
export const MAX_SUBIDO_S = 2;

/**
 * El efecto del dueño, pasado a lo que ffmpeg lee sin pensárselo.
 *
 * Se decodifica y se vuelve a escribir como WAV mono en vez de pasarle el
 * archivo tal cual: así da igual si trajo un MP3, un M4A o un OGG, y de paso
 * se recorta a dos segundos y se nivela. Un efecto que viene cinco decibelios
 * por encima de la voz tapa la frase justo donde importa.
 */
export async function delArchivo(archivo: Blob): Promise<Blob> {
  const bytes = await archivo.arrayBuffer();
  // El contexto de decodificación va a 44,1 kHz: a 16 kHz, que es lo que basta
  // para la voz, un clic pierde todo lo que lo hace un clic.
  const ctx = new OfflineAudioContext(1, 1, MUESTREO);
  const crudo = await ctx.decodeAudioData(bytes);
  if (!crudo.duration) throw new Error("Ese archivo no tiene sonido.");

  const largo = Math.max(1, Math.ceil(Math.min(crudo.duration, MAX_SUBIDO_S) * MUESTREO));
  const destino = new OfflineAudioContext(1, largo, MUESTREO);
  const fuente = destino.createBufferSource();
  fuente.buffer = crudo;
  fuente.connect(destino.destination);
  fuente.start();
  const mezclado = await destino.startRendering();

  return aWav(arreglar(mezclado.getChannelData(0)), MUESTREO);
}

/**
 * Nivela al mismo pico y cierra los bordes.
 *
 * Los tres milisegundos de entrada y los veinte de salida están para que no
 * suene un chasquido donde empieza o donde se recortó: una onda cortada a
 * mitad de ciclo es un salto, y un salto en una señal es un clic.
 */
function arreglar(canal: Float32Array): Float32Array {
  // Los bordes primero y el nivel despues, no al reves: en un golpe el pico
  // esta en el primer milisegundo, justo dentro de la entrada, asi que medirlo
  // antes de aplicarla dejaba el efecto tres decibelios por debajo del resto.
  const entra = Math.max(1, Math.min(Math.floor(canal.length / 4), Math.round(0.003 * MUESTREO)));
  const sale = Math.max(1, Math.min(Math.floor(canal.length / 4), Math.round(0.02 * MUESTREO)));
  const salida = new Float32Array(canal.length);
  for (let i = 0; i < canal.length; i++) {
    const abre = i < entra ? i / entra : 1;
    const cierra = i >= canal.length - sale ? (canal.length - i) / sale : 1;
    salida[i] = canal[i] * abre * cierra;
  }

  let pico = 0;
  for (let i = 0; i < salida.length; i++) pico = Math.max(pico, Math.abs(salida[i]));
  if (pico > 1e-4) {
    const ganancia = 0.85 / pico;
    for (let i = 0; i < salida.length; i++) salida[i] *= ganancia;
  }
  return salida;
}
