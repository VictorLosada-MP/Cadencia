/**
 * Los cinco niveles de conciencia. El eje de toda la semana.
 *
 * `plano` es lo único que ve el usuario. "N2 · Encontrando solución" es
 * vocabulario de dentro: quien llega de internet no lo ha estudiado, y una
 * pantalla que habla en clave obliga a aprenderse el sistema antes de usarlo.
 */
export const NIVELES: Record<string, { plano: string; corto: string }> = {
  N0: { plano: "Todavía no saben que tienen ese problema", corto: "no lo saben" },
  N1: { plano: "Saben que lo tienen, pero no cómo resolverlo", corto: "lo saben" },
  N2: { plano: "Ya saben cómo se resuelve y están viendo cómo hacerlo", corto: "buscan cómo" },
  N3: { plano: "Están comparando con quién resolverlo", corto: "comparan" },
  N4: { plano: "Ya saben qué quieren comprar", corto: "deciden" },
};

/** Las tres razones por las que una venta no ocurre, dichas en plano. */
export const BRECHAS: Record<string, string> = {
  problema: "Tu gente todavía no ve el problema que tú resuelves",
  costo: "Ven el problema, pero no lo que les cuesta dejarlo así",
  "por-que-tu": "Ven el problema y el costo — falta que entiendan por qué tú",
};

export const CUANTO_VIDEO = [
  { id: "toda", etiqueta: "Toda la semana video", videos: 5 },
  { id: "algo", etiqueta: "Dos o tres videos", videos: 3 },
  { id: "poco", etiqueta: "Un video, no más", videos: 1 },
  { id: "nada", etiqueta: "Esta semana no me grabo", videos: 0 },
] as const;

export type CuantoVideo = (typeof CUANTO_VIDEO)[number]["id"];

export type PiezaSemana = {
  dia: string;
  /** camara · lista · voz-en-off · carrusel · foto · texto */
  formato: string;
  nivel: string;
  /** El escalón al que sube a quien la vea. Nadie sube dos de una pieza. */
  mueve_a: string;
  angulo: string;
  /** Cuánto se usa en el mercado. Un ángulo poco usado es espacio vacío. */
  peso_mercado: string;
  idea: string;
  gancho: string;
  /** Qué tiene que quedar entendido. Sin esto, la pieza no tiene trabajo. */
  trabajo: string;
  apertura_respuesta: string;
};

export type Banco = {
  brecha: string;
  nivel_dominante: string;
  por_que_ese_nivel: string;
  semana: PiezaSemana[];
  guion_respuesta: {
    las_tres_preguntas: string[];
    cuando_ofrecer: string;
  };
  donde_no_hay_competencia: string;
  limites: string[];
};
