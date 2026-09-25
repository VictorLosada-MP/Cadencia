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

export type PiezaSemana = {
  dia: string;
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

/**
 * Qué familia de formato le va mejor a cada ángulo.
 *
 * Es una sugerencia, no una decisión: quién decide si el martes se graba o no
 * es el dueño, el martes. Decidirlo por él el domingo es adivinar, y además le
 * quita la salida el día que no tiene ganas de ponerse delante de la cámara.
 *
 * Se calcula aquí y no se le pide al modelo: es una tabla fija, y una tabla no
 * necesita una llamada a la IA.
 */
export function sugerenciaPorAngulo(angulo: string): "video" | "carrusel" | "escrito" {
  const a = angulo.toLowerCase();
  if (/historia|error caro|pregunta que duele/.test(a)) return "video";
  if (/lista|proceso|enseñanza|ensenanza/.test(a)) return "carrusel";
  if (/contra la corriente|prueba social|invitaci/.test(a)) return "escrito";
  return "video";
}

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
