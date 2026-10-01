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
  /** Qué salió mal al buscar, si salió mal. */
  fallo?: string;
  /** Las que devolvió el banco y por cuál va, para poder pasar a la siguiente. */
  candidatas?: string[];
  cual?: number;
};

/**
 * Resuelve los apoyos del guion.
 *
 * Lo que el guion marcó como `apoyo_tuyo` se le pide a él y nada más — es una
 * foto con su cliente y no existe en ningún banco. Todo lo demás lo busca el
 * sistema y lo coloca sin molestarle: pedirle una foto que podía salir de un
 * banco es trabajo que se le pasa por no pensarlo nosotros.
 */
const VACIO = { imagen: null, vista: null, origen: null, buscando: false } as const;

/** Trae la imagen por el proxy del servidor, que es el único origen permitido. */
async function traer(url: string): Promise<Blob | null> {
  try {
    const r = await fetch(`/api/fotos?traer=${encodeURIComponent(url)}`);
    return r.ok ? await r.blob() : null;
  } catch {
    return null;
  }
}

/** Un apoyo que el dueño añadió él, con su momento elegido a mano. */
export type Mio = { golpe: number; desde: number };

export function useApoyos(
  golpes: GolpeConApoyo[] | undefined,
  palabras: Palabra[] | null,
  duracion = 0,
) {
  /**
   * Lo que sale del guion y de la transcripción se calcula, no se guarda: es
   * una función pura de las dos cosas. Lo único que es estado de verdad es lo
   * que el dueño decidió encima — qué imagen, y si la usa.
   */
  /**
   * Los míos: los que el dueño añade a mano.
   *
   * Existen porque el guion puede no pedir ninguna imagen —o pedir pocas— y
   * antes eso dejaba la pantalla sin ninguna forma de meter una. El índice va
   * en negativo para no chocar nunca con el de un golpe del guion.
   */
  const [mios, setMios] = useState<Mio[]>([]);

  const base = useMemo(() => {
    const delGuion =
      golpes?.length && palabras?.length ? apoyosDe(golpes, palabras) : [];
    const aMano: Apoyo[] = mios.map((m) => ({
      golpe: m.golpe,
      pide: "la que tú elijas",
      texto: "",
      momento: { desde: m.desde, hasta: m.desde + 2.5, confianza: 1 },
      exacto: true,
    }));
    return [...delGuion, ...aMano].sort(
      (a, b) => (a.momento?.desde ?? 0) - (b.momento?.desde ?? 0),
    );
  }, [golpes, palabras, mios]);

  /** Añade uno al hueco más grande que quede, que es donde más falta hace. */
  const agregar = useCallback(() => {
    setMios((m) => {
      const ocupados = [...base.map((a) => a.momento?.desde ?? 0)].sort((x, y) => x - y);
      const bordes = [0, ...ocupados, Math.max(4, duracion)];
      let mejor = Math.max(1, duracion / 2);
      let hueco = 0;
      for (let i = 0; i + 1 < bordes.length; i++) {
        const d = bordes[i + 1] - bordes[i];
        if (d > hueco) { hueco = d; mejor = bordes[i] + d / 2; }
      }
      const id = -(m.length + 1);
      return [...m, { golpe: id, desde: Number(mejor.toFixed(2)) }];
    });
  }, [base, duracion]);

  const quitar = useCallback((golpe: number) => {
    setMios((m) => m.filter((x) => x.golpe !== golpe));
  }, []);

  const mover = useCallback((golpe: number, desde: number) => {
    setMios((m) => m.map((x) => (x.golpe === golpe ? { ...x, desde } : x)));
  }, []);

  type Encima = {
    imagen: Blob | null;
    vista: string | null;
    origen: "banco" | "tuya" | null;
    buscando: boolean;
    usar?: boolean;
    /** Las ocho que devolvió el banco, para poder pasar a la siguiente. */
    candidatas?: string[];
    /** Por cuál va. "Buscar otra" avanza este número, no repite la consulta. */
    cual?: number;
    /** Qué salió mal, para poder decirlo en vez de no hacer nada. */
    fallo?: string;
  };

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
          fallo: e?.fallo,
          candidatas: e?.candidatas,
          cual: e?.cual,
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

  /**
   * Busca en el banco lo que no es suyo. Lo suyo no se busca: se pide.
   *
   * Las candidatas se guardan enteras y "buscar otra" solo avanza el índice.
   * Antes se quedaba siempre con la primera de las ocho, así que pulsar
   * "buscar otra" repetía exactamente la misma foto y parecía que la pantalla
   * no hacía nada.
   */
  const buscar = useCallback(
    async (golpe: number, consulta: string, ya?: { candidatas?: string[]; cual?: number }) => {
      // Si ya hay candidatas, pasar a la siguiente no toca la red.
      if (ya?.candidatas?.length) {
        const cual = ((ya.cual ?? 0) + 1) % ya.candidatas.length;
        tocar(golpe, { buscando: true, cual, fallo: undefined });
        const blob = await traer(ya.candidatas[cual]);
        tocar(
          golpe,
          blob
            ? { imagen: blob, vista: URL.createObjectURL(blob), origen: "banco", buscando: false }
            : { buscando: false, fallo: "No se pudo traer esa foto." },
        );
        return;
      }

      tocar(golpe, { buscando: true, fallo: undefined });
      try {
        const r = await fetch(`/api/fotos?q=${encodeURIComponent(consulta)}&o=portrait`);
        const d = await r.json();
        const urls: string[] = (d?.fotos ?? []).map((f: { url: string }) => f.url).filter(Boolean);
        if (!urls.length) {
          // Decirlo. Antes se tragaba el error y la pantalla se quedaba igual.
          throw new Error(d?.error ?? `El banco no tiene nada para «${consulta}».`);
        }
        const blob = await traer(urls[0]);
        if (!blob) throw new Error("No se pudo traer la foto.");
        tocar(golpe, {
          imagen: blob,
          vista: URL.createObjectURL(blob),
          origen: "banco",
          buscando: false,
          candidatas: urls,
          cual: 0,
        });
      } catch (e) {
        tocar(golpe, {
          buscando: false,
          fallo: e instanceof Error ? e.message : "No se pudo buscar.",
        });
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

  return { lista, buscar, poner, alternar, agregar, quitar, mover };
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
