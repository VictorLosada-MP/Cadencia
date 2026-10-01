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
export function sugerenciaPorAngulo(angulo: string): "video" | "carrusel" {
  const a = angulo.toLowerCase();
  if (/lista|proceso|enseñanza|ensenanza/.test(a)) return "carrusel";
  return "video";
}

/**
 * Qué historia pide este ángulo, si pide alguna.
 *
 * Hay días de la semana que solo funcionan con algo que pasó de verdad: una
 * historia suya o la de un cliente. El sistema no puede inventarla —la regla
 * de no inventar es dura y es correcta— y durante un tiempo la salida fue
 * pedirle que la dejara escrita en su perfil antes. Eso está mal por dos
 * razones: le pide trabajo por adelantado para algo que a lo mejor no usa, y
 * al que llega de internet a probar la herramienta le pone un formulario
 * delante antes de enseñarle nada.
 *
 * Así que no se pide por adelantado: se pide el día que toca, en la pantalla
 * de la pieza, en dos líneas y como se la contaría a un amigo. De pulirla ya
 * se encarga el sistema.
 *
 * Es una tabla fija, como `sugerenciaPorAngulo`: una tabla no necesita una
 * llamada a la IA.
 */
export type QuienCuenta = "propia" | "cliente";

export function historiaQuePide(angulo: string): QuienCuenta | null {
  const a = (angulo ?? "").toLowerCase();
  if (/prueba social|testimonio|caso (de|real)|resultado de un cliente/.test(a)) return "cliente";
  if (/historia|personal|detr[aá]s|por qu[eé] empec|c[oó]mo empec/.test(a)) return "propia";
  return null;
}

/** Cómo se le pide cada una. En su idioma, no en el del sistema. */
export const COMO_PEDIRLA: Record<QuienCuenta, { titulo: string; pista: string; ejemplo: string }> = {
  propia: {
    titulo: "Esta pieza va con una historia tuya",
    pista:
      "Cuéntala como se la contarías a un amigo en la mesa. Sin pulir, sin ordenar, con las palabras que te salgan. De eso se encarga el botón de abajo.",
    ejemplo:
      "Qué pasó, cuándo fue, qué pensaste en ese momento y cómo acabó. Si te acuerdas de algo que dijiste o que te dijeron, ponlo tal cual.",
  },
  cliente: {
    titulo: "Esta pieza va con el caso de un cliente",
    pista:
      "Uno de verdad, aunque no digas su nombre. Cuéntalo como se lo contarías a un amigo: sin pulir y con las palabras que te salgan.",
    ejemplo:
      "Cómo llegó, qué tenía, qué le hiciste y cómo quedó. Si te acuerdas de algo que te dijo, ponlo tal cual: eso es lo que no se puede inventar.",
  },
};

export type Historia = {
  /** La suya, ordenada y apretada. Ni un dato que no estuviera en la cruda. */
  historia: string;
  /** Qué se tocó y por qué. Él tiene que poder deshacerlo. */
  que_hice: string[];
  /** Los huecos que solo él puede llenar. */
  que_falta: string[];
  limites: string[];
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
