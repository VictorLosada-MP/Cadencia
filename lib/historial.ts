import { consultar, una } from "@/lib/db";
import type { Diagnostico } from "@/types/diagnostico";

/** Una corrida guardada de cualquiera de las funciones. */
export type Corrida = {
  id: string;
  funcion: number;
  creado: string;
  resultado: unknown;
};

export async function guardarCorrida(
  negocioId: string,
  funcion: 1 | 2 | 3,
  resultado: unknown,
  modelo: string,
  entrada: unknown = {},
): Promise<string | null> {
  try {
    const filas = await consultar<{ id: string }>(
      `insert into corrida (negocio_id, funcion, resultado, modelo, entrada)
       values ($1, $2, $3, $4, $5) returning id`,
      [negocioId, funcion, JSON.stringify(resultado), modelo, JSON.stringify(entrada)],
    );
    const id = filas[0]?.id ?? null;

    if (id && funcion === 1) {
      const dx = resultado as Diagnostico;
      for (const red of dx.redes ?? []) {
        for (const p of red.puntos ?? []) {
          await consultar(
            `insert into punto (corrida_id, red, campo, aplica, visible, pasa, actual)
             values ($1, $2, $3, $4, $5, $6, $7)
             on conflict (corrida_id, red, campo) do nothing`,
            [
              id,
              red.red ?? "",
              p.campo,
              p.aplica !== false,
              p.visible !== false,
              Boolean(p.pasa),
              p.actual ?? "",
            ],
          );
        }
      }
    }
    return id;
  } catch (e) {
    // Que no se pueda guardar no puede tirar abajo una corrida ya pagada.
    console.error("historial:", e instanceof Error ? e.message : e);
    return null;
  }
}

/**
 * La última corrida de una función, con lo que se usó para producirla.
 *
 * Es lo que hace que al volver a entrar esté todo como se dejó. Un diagnóstico
 * que se borra al cerrar la pestaña no es un diagnóstico: es una demo.
 */
export async function ultimaCorrida(
  negocioId: string,
  funcion: 1 | 2 | 3,
): Promise<{ id: string; creado: string; resultado: unknown; entrada: unknown } | null> {
  return una(
    `select id, creado, resultado, entrada from corrida
      where negocio_id = $1 and funcion = $2
      order by creado desc limit 1`,
    [negocioId, funcion],
  );
}

export type Movimiento = {
  red: string;
  campo: string;
  /** "arreglado" pasó de no-pasa a pasa; "cambiado" es texto distinto. */
  clase: "arreglado" | "cambiado";
};

export type Comparacion = {
  desde: string;
  arreglados: Movimiento[];
  cambiados: Movimiento[];
};

/**
 * Qué se movió entre las dos últimas corridas del diagnóstico.
 *
 * Es una función pura sobre dos filas guardadas: no llama al modelo, así que no
 * hay nada que pueda inventar. Devuelve null cuando no hay con qué comparar.
 */
export async function compararUltimas(negocioId: string): Promise<Comparacion | null> {
  const corridas = await consultar<{ id: string; creado: string }>(
    `select id, creado from corrida
      where negocio_id = $1 and funcion = 1
      order by creado desc limit 2`,
    [negocioId],
  );
  if (corridas.length < 2) return null;

  const [nueva, vieja] = corridas;
  const puntos = await consultar<{
    corrida_id: string;
    red: string;
    campo: string;
    pasa: boolean;
    visible: boolean;
    actual: string;
  }>(
    `select corrida_id, red, campo, pasa, visible, actual
       from punto where corrida_id = any($1)`,
    [[nueva.id, vieja.id]],
  );

  const clave = (p: { red: string; campo: string }) => `${p.red}\u0000${p.campo}`;
  const antes = new Map(puntos.filter((p) => p.corrida_id === vieja.id).map((p) => [clave(p), p]));

  const arreglados: Movimiento[] = [];
  const cambiados: Movimiento[] = [];

  for (const ahora of puntos.filter((p) => p.corrida_id === nueva.id)) {
    const previo = antes.get(clave(ahora));
    if (!previo) continue;

    // Solo cuenta lo que se pudo leer las dos veces: un campo que no se veía
    // antes y hoy sí no es una mejora, es un dato nuevo.
    if (!previo.visible || !ahora.visible) continue;

    if (!previo.pasa && ahora.pasa) {
      arreglados.push({ red: ahora.red, campo: ahora.campo, clase: "arreglado" });
    } else if (previo.actual.trim() !== ahora.actual.trim()) {
      cambiados.push({ red: ahora.red, campo: ahora.campo, clase: "cambiado" });
    }
  }

  return { desde: vieja.creado, arreglados, cambiados };
}

/**
 * El estado anterior, para que el diagnóstico no vuelva a proponer una
 * corrección que el dueño ya aplicó. No es para re-evaluar el pasado.
 */
export async function estadoAnterior(negocioId: string): Promise<string> {
  const ultima = await una<{ id: string; creado: string }>(
    `select id, creado from corrida
      where negocio_id = $1 and funcion = 1
      order by creado desc limit 1`,
    [negocioId],
  );
  if (!ultima) return "";

  const puntos = await consultar<{ red: string; campo: string; pasa: boolean; actual: string }>(
    `select red, campo, pasa, actual from punto where corrida_id = $1`,
    [ultima.id],
  );
  if (!puntos.length) return "";

  const fecha = new Date(ultima.creado).toISOString().slice(0, 10);
  const lineas = puntos.map(
    (p) => `- ${p.red} · ${p.campo}: ${p.pasa ? "pasaba" : "no pasaba"} — decía «${p.actual}»`,
  );
  return `## Estado de la corrida anterior (${fecha})\n${lineas.join("\n")}`;
}
