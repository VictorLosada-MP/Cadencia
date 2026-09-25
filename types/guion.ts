export const FORMATOS = [
  {
    id: "camara" as const,
    nombre: "A cámara",
    que: "Tú hablando al teléfono. Nada más: ni imágenes ni edición.",
    golpes: "3 o 4 frases",
  },
  {
    id: "lista" as const,
    nombre: "Los 3 errores, uno por uno",
    que: "Cuentas varias cosas seguidas y en pantalla va saliendo 1, 2, 3. Se guarda mucho porque se vuelve a ver.",
    golpes: "uno por punto, más la apertura y el cierre",
  },
  {
    id: "voz-en-off" as const,
    nombre: "Voz en off + texto",
    que: "No sales tú: pones imágenes, tu voz encima y texto. Para cuando no quieres grabarte.",
    golpes: "4 o 5 frases",
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
