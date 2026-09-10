export type Punto = {
  campo: string;
  /**
   * Falso cuando esta red no tiene ese campo — un sitio web no tiene punto
   * Link, el sitio es el destino. Distinto de no haberlo podido leer.
   */
  aplica: boolean;
  /**
   * Falso cuando la casilla llegó vacía o cortada. Un campo que no se pudo leer
   * no es un campo que falla: contarlo como "no pasa" sería inventar.
   */
  visible: boolean;
  pasa: boolean;
  actual: string;
  por_que: string;
  corregido: string;
};

export type Bio = {
  angulo: string;
  texto: string;
};

/** Un diagnóstico completo de un perfil. Con dos redes hay dos de estos. */
export type DiagnosticoRed = {
  /** El mismo id de la ficha. La pantalla casa por aquí, no por el nombre. */
  id: string;
  red: string;
  /** Cuántos puntos pasan, de los que se pudieron evaluar. */
  pasan: number;
  /** Cuántos aplican y además llegaron con algo escrito. */
  evaluados: number;
  veredicto: string;
  lo_que_funciona: string[];
  puntos: Punto[];
  el_que_mas_cuesta: string;
  bios: Bio[];
};

/**
 * La lectura que solo existe con dos perfiles del mismo negocio. Es null con
 * una sola red — no se simula.
 */
export type Coherencia = {
  dicen_lo_mismo: boolean;
  /** Qué dice en una y qué en la otra. Descripción, no reproche. */
  lectura: string;
  /** El campo concreto que conviene igualar, y a cuál de las dos versiones. */
  que_alinear: string;
};

export type Pregunta = {
  pregunta: string;
  para_que: string;
};

export type Diagnostico = {
  redes: DiagnosticoRed[];
  coherencia: Coherencia | null;
  /** De dónde parte, leído de lo ya publicado. Contexto, nunca juicio. */
  linea_base: string;
  preguntas: Pregunta[];
  limites: string[];
};
