/**
 * Los efectos de sonido, sintetizados aquí.
 *
 * No se descargan de ningún banco: se calculan. Un whoosh es ruido filtrado
 * con una envolvente, y escribirlo son treinta líneas.
 *
 * La razón no es de gusto. Un banco de efectos mete una licencia de un tercero
 * dentro de los videos del dueño, y si mañana ese banco cambia sus términos el
 * problema es de él, que ya publicó. Lo que se calcula aquí no tiene licencia
 * de nadie.
 */

const MUESTREO = 44100;

export type Efecto = "whoosh" | "golpe";

/** Ruido blanco con la semilla fija: el mismo efecto suena igual siempre. */
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
 * Un whoosh: ruido rosa cuyo filtro sube y baja mientras la envolvente abre y
 * cierra. Es lo que el oído lee como "algo pasó volando".
 */
function whoosh(duracion = 0.42): Float32Array {
  const n = Math.round(duracion * MUESTREO);
  const salida = new Float32Array(n);
  const dado = ruido(0x5eed1);

  // Un paso bajo de un polo cuyo corte barre de grave a agudo y vuelve.
  let anterior = 0;
  for (let i = 0; i < n; i++) {
    const t = i / n;
    // La curva del barrido: sube rápido, baja despacio.
    const barrido = Math.sin(Math.PI * Math.pow(t, 0.6));
    const corte = 0.02 + barrido * 0.5;
    anterior += corte * (dado() - anterior);

    // Envolvente: ataque corto, caída larga. Sin esto suena a estática.
    const ataque = Math.min(1, t / 0.08);
    const caida = Math.pow(1 - t, 1.6);
    salida[i] = anterior * ataque * caida * 0.9;
  }
  return salida;
}

/** Un golpe seco y grave, para el arranque de un bloque. */
function golpe(duracion = 0.22): Float32Array {
  const n = Math.round(duracion * MUESTREO);
  const salida = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / MUESTREO;
    // Un seno que cae de 140 Hz a 50 Hz: el "boom" de toda la vida.
    const hz = 140 * Math.pow(50 / 140, i / n);
    const caida = Math.exp(-t * 14);
    salida[i] = Math.sin(2 * Math.PI * hz * t) * caida * 0.8;
  }
  return salida;
}

/** WAV de 16 bits, que es lo que ffmpeg lee sin pensárselo. */
function aWav(canal: Float32Array): Blob {
  const datos = canal.length * 2;
  const buffer = new ArrayBuffer(44 + datos);
  const v = new DataView(buffer);
  const texto = (pos: number, s: string) => {
    for (let i = 0; i < s.length; i++) v.setUint8(pos + i, s.charCodeAt(i));
  };
  texto(0, "RIFF");
  v.setUint32(4, 36 + datos, true);
  texto(8, "WAVEfmt ");
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true);
  v.setUint16(22, 1, true);
  v.setUint32(24, MUESTREO, true);
  v.setUint32(28, MUESTREO * 2, true);
  v.setUint16(32, 2, true);
  v.setUint16(34, 16, true);
  texto(36, "data");
  v.setUint32(40, datos, true);
  for (let i = 0; i < canal.length; i++) {
    const m = Math.max(-1, Math.min(1, canal[i]));
    v.setInt16(44 + i * 2, m < 0 ? m * 0x8000 : m * 0x7fff, true);
  }
  return new Blob([buffer], { type: "audio/wav" });
}

/** Se calcula una vez por pestaña: son los mismos dos archivos siempre. */
const hechos = new Map<Efecto, Blob>();

export function efecto(cual: Efecto): Blob {
  const ya = hechos.get(cual);
  if (ya) return ya;
  const b = aWav(cual === "whoosh" ? whoosh() : golpe());
  hechos.set(cual, b);
  return b;
}
