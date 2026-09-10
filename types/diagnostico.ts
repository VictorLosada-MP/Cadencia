export type Punto = {
  campo: string;
  pasa: boolean;
  actual: string;
  por_que: string;
  corregido: string;
};

export type Pregunta = {
  pregunta: string;
  para_que: string;
};

export type Diagnostico = {
  /** Cuántos de los cinco puntos pasan. No hay puntaje 0-100: no era comparable. */
  pasan: number;
  veredicto: string;
  lo_que_funciona: string[];
  puntos: Punto[];
  el_que_mas_cuesta: string;
  bios: { angulo: string; texto: string }[];
  preguntas: Pregunta[];
  limites: string[];
};
