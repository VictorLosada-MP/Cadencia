/** Los cinco niveles de conciencia. El eje de toda la semana. */
export const NIVELES: Record<string, { corto: string; dice: string }> = {
  N0: { corto: "Inconsciente", dice: "no sé que tengo un problema" },
  N1: {
    corto: "Consciente de la necesidad",
    dice: "sé que tengo un problema, no sé cómo resolverlo",
  },
  N2: { corto: "Encontrando solución", dice: "sé cómo resolverlo" },
  N3: { corto: "Analizando opciones", dice: "sé con quién resolverlo" },
  N4: { corto: "Seleccionando", dice: "sé qué producto comprar" },
};

/** Las tres razones por las que una venta no ocurre. */
export const BRECHAS: Record<string, string> = {
  problema: "Todavía no entiende su problema",
  costo: "No entiende el costo de no resolverlo",
  "por-que-tu": "No entiende por qué tú eres la solución",
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
