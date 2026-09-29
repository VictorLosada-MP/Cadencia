"use client";

import { useCallback, useMemo, useState } from "react";
import { apoyosDe, acotar, type Apoyo } from "@/lib/apoyos";
import { reubicar, type Tramo } from "@/lib/silencios";
import type { Palabra } from "@/lib/subtitulos";
/**
 * Lo mínimo que hace falta de un golpe para resolver su apoyo.
 *
 * Deliberadamente más suelto que el `Golpe` de types/guion: aquí no se usa la
 * dirección de rodaje, y exigirla ataría esta pieza a la forma exacta que
 * tenga el guion hoy.
 */
type GolpeConApoyo = { texto: string; apoyo?: string; apoyo_tuyo?: boolean };
import type { Inserto } from "@/lib/video";

/** Un apoyo con la imagen ya decidida. */
export type Resuelto = Apoyo & {
  /** La imagen, ya traída. null mientras se busca o si no se encontró. */
  imagen: Blob | null;
  /** Para verla en la ficha. */
  vista: string | null;
  /** De dónde salió: del banco, o suya. */
  origen: "banco" | "tuya" | null;
  buscando: boolean;
  usar: boolean;
};

/**
 * Resuelve los apoyos del guion.
 *
 * Lo que el guion marcó como `apoyo_tuyo` se le pide a él y nada más — es una
 * foto con su cliente y no existe en ningún banco. Todo lo demás lo busca el
 * sistema y lo coloca sin molestarle: pedirle una foto que podía salir de un
 * banco es trabajo que se le pasa por no pensarlo nosotros.
 */
export function useApoyos(golpes: GolpeConApoyo[] | undefined, palabras: Palabra[] | null) {
  /**
   * Lo que sale del guion y de la transcripción se calcula, no se guarda: es
   * una función pura de las dos cosas. Lo único que es estado de verdad es lo
   * que el dueño decidió encima — qué imagen, y si la usa.
   */
  const base = useMemo(
    () => (golpes?.length && palabras?.length ? apoyosDe(golpes, palabras) : []),
    [golpes, palabras],
  );

  type Encima = {
    imagen: Blob | null;
    vista: string | null;
    origen: "banco" | "tuya" | null;
    buscando: boolean;
    usar?: boolean;
  };
  const VACIO: Encima = { imagen: null, vista: null, origen: null, buscando: false };
  const [encima, setEncima] = useState<Record<number, Encima>>({});

  const lista: Resuelto[] = useMemo(
    () =>
      base.map((a) => {
        const e = encima[a.golpe];
        return {
          ...a,
          imagen: e?.imagen ?? null,
          vista: e?.vista ?? null,
          origen: e?.origen ?? null,
          buscando: e?.buscando ?? false,
          usar: e?.usar ?? a.momento !== null,
        };
      }),
    [base, encima],
  );

  const tocar = useCallback((golpe: number, cambio: Partial<Encima>) => {
    setEncima((e) => ({
      ...e,
      [golpe]: { ...VACIO, ...e[golpe], ...cambio },
    }));
  }, []);

  /** Busca en el banco lo que no es suyo. Lo suyo no se busca: se pide. */
  const buscar = useCallback(
    async (golpe: number, consulta: string) => {
      tocar(golpe, { buscando: true });
      try {
        const r = await fetch(`/api/fotos?q=${encodeURIComponent(consulta)}&o=portrait`);
        const d = await r.json();
        const foto = d?.fotos?.[0];
        if (!foto?.url) throw new Error(d?.error ?? "sin resultados");
        const img = await fetch(`/api/fotos?traer=${encodeURIComponent(foto.url)}`);
        if (!img.ok) throw new Error("no se pudo traer");
        const blob = await img.blob();
        tocar(golpe, {
          imagen: blob,
          vista: URL.createObjectURL(blob),
          origen: "banco",
          buscando: false,
        });
      } catch {
        tocar(golpe, { buscando: false });
      }
    },
    [tocar],
  );

  const poner = useCallback(
    (golpe: number, archivo: File) =>
      tocar(golpe, {
        imagen: archivo,
        vista: URL.createObjectURL(archivo),
        origen: "tuya",
        buscando: false,
      }),
    [tocar],
  );

  const alternar = useCallback(
    (golpe: number, ahora: boolean) => tocar(golpe, { usar: !ahora }),
    [tocar],
  );

  return { lista, buscar, poner, alternar };
}

/**
 * Pasa los apoyos a insertos, ya en tiempos del video cortado.
 *
 * Un apoyo cuyo momento cayó dentro de un silencio quitado se descarta: poner
 * la imagen a ojo encima de la frase equivocada es peor que no ponerla.
 */
export function insertosDe(lista: Resuelto[], tramos: Tramo[], duracion: number): Inserto[] {
  const salida: Inserto[] = [];
  for (const a of lista) {
    if (!a.usar || !a.imagen || !a.momento) continue;
    const { desde, hasta } = acotar(a.momento, duracion);
    const d = reubicar(desde, tramos);
    const h = reubicar(hasta, tramos);
    if (d === null || h === null || h <= d) continue;
    salida.push({ imagen: a.imagen, desde: d, hasta: h });
  }
  return salida.sort((a, b) => a.desde - b.desde);
}
