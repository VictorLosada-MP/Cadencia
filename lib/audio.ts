/**
 * El audio del video, una sola vez.
 *
 * Decodificar es lo caro de todo el análisis, así que se hace una vez al
 * cargar el archivo y de ahí salen las dos cosas que hacen falta: la onda para
 * buscar los silencios y un WAV pequeño para transcribir.
 */

/** Lo que hace falta para transcribir: mono y 16 kHz. Whisper no usa más. */
export const MUESTREO_VOZ = 16000;

export type AudioLeido = {
  /** Mono a 16 kHz. Es lo que analiza `envolvente`. */
  canal: Float32Array;
  muestreo: number;
  duracion_s: number;
};

/**
 * Baja el audio a mono y a 16 kHz de una vez.
 *
 * Con OfflineAudioContext y no a mano: el remuestreo del navegador está
 * escrito en C++ y filtra bien; hacerlo con un bucle en JavaScript produce
 * aliasing, y el aliasing sube el ruido de fondo justo en las frecuencias
 * donde se decide si alguien está hablando.
 */
export async function leerAudio(archivo: Blob): Promise<AudioLeido> {
  const bytes = await archivo.arrayBuffer();

  // El contexto de decodificación va al muestreo original: pedirle que
  // decodifique ya remuestreado no está soportado en todos los navegadores.
  const ctx = new OfflineAudioContext(1, 1, 44100);
  const crudo = await ctx.decodeAudioData(bytes);

  const destino = new OfflineAudioContext(
    1,
    Math.max(1, Math.ceil(crudo.duration * MUESTREO_VOZ)),
    MUESTREO_VOZ,
  );
  const fuente = destino.createBufferSource();
  fuente.buffer = crudo;
  fuente.connect(destino.destination);
  fuente.start();
  const mezclado = await destino.startRendering();

  return {
    canal: mezclado.getChannelData(0),
    muestreo: MUESTREO_VOZ,
    duracion_s: crudo.duration,
  };
}

/**
 * Un WAV de 16 bits, para mandar a transcribir.
 *
 * WAV sin comprimir y no MP3 porque comprimir aquí costaría traer un
 * codificador entero para ahorrar unos megas en una subida que ya es corta.
 * Tres minutos de mono a 16 kHz son 5,7 MB.
 */
export function aWav(canal: Float32Array, muestreo = MUESTREO_VOZ): Blob {
  const datos = canal.length * 2;
  const buffer = new ArrayBuffer(44 + datos);
  const v = new DataView(buffer);

  const texto = (pos: number, s: string) => {
    for (let i = 0; i < s.length; i++) v.setUint8(pos + i, s.charCodeAt(i));
  };

  texto(0, "RIFF");
  v.setUint32(4, 36 + datos, true);
  texto(8, "WAVEfmt ");
  v.setUint32(16, 16, true); // tamaño del bloque fmt
  v.setUint16(20, 1, true); // PCM
  v.setUint16(22, 1, true); // mono
  v.setUint32(24, muestreo, true);
  v.setUint32(28, muestreo * 2, true); // bytes por segundo
  v.setUint16(32, 2, true); // bytes por muestra
  v.setUint16(34, 16, true); // bits
  texto(36, "data");
  v.setUint32(40, datos, true);

  for (let i = 0; i < canal.length; i++) {
    // Recortar antes de escalar: una muestra en 1.2 daría la vuelta al entero
    // y sonaría como un chasquido en mitad de la palabra.
    const m = Math.max(-1, Math.min(1, canal[i]));
    v.setInt16(44 + i * 2, m < 0 ? m * 0x8000 : m * 0x7fff, true);
  }

  return new Blob([buffer], { type: "audio/wav" });
}
