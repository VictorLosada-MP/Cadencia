export const FORMATOS = [
  {
    id: "camara" as const,
    nombre: "A cámara",
    que: "Tú hablando al teléfono. Nada más.",
    golpes: "3–4 golpes",
  },
  {
    id: "lista" as const,
    nombre: "Lista con números",
    que: "Tú hablando, con un número grande por punto.",
    golpes: "N + 2 golpes",
  },
  {
    id: "voz-en-off" as const,
    nombre: "Voz en off + texto",
    que: "Sin salir en cámara: imágenes, tu voz y texto.",
    golpes: "4–5 golpes",
  },
];

export type Formato = (typeof FORMATOS)[number]["id"];

export type Gancho = {
  texto: string;
  por_que: string;
  camino: string;
};

export type Ganchos = {
  idea_afilada: string;
  asi_no: string;
  asi_si: string;
  ganchos: Gancho[];
  limites: string[];
};

export type Golpe = {
  texto: string;
  /** Una acción o expresión física. Nunca una emoción abstracta. */
  direccion: string;
};

export type Guion = {
  gancho: string;
  golpes: Golpe[];
  cierre: {
    texto: string;
    caso_logico: string;
    caso_emocional: string;
  };
  como_grabar: {
    luz: string;
    fondo: string;
    encuadre: string;
    voz: string;
  };
  descripcion: string;
  palabras: number;
  duracion_s: number;
  valor: string;
  limites: string[];
};
