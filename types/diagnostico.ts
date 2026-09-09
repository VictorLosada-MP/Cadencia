export type Punto = {
  campo: string;
  pasa: boolean;
  actual: string;
  por_que: string;
  corregido: string;
};

export type Diagnostico = {
  score: number;
  veredicto: string;
  lo_que_funciona: string[];
  puntos: Punto[];
  el_que_mas_cuesta: string;
  bios: { angulo: string; texto: string }[];
  avisos: string[];
};
