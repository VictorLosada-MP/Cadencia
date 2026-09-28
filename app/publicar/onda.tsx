"use client";

import { useEffect, useRef } from "react";
import { VENTANA_MS, type Tramo } from "@/lib/silencios";

/**
 * La onda, con lo que se va marcado encima.
 *
 * Es la única forma de que alguien entienda de un vistazo qué está a punto de
 * quitarle el sistema. Un número —"17 cortes"— no dice si se está comiendo las
 * pausas dramáticas o solo el ruido de antes de empezar a hablar.
 */
export function Onda({
  env,
  tramos,
  duracion,
  umbral,
  cabeza,
  alIrA,
}: {
  env: Float32Array;
  tramos: Tramo[];
  duracion: number;
  umbral: number;
  /** Dónde va la reproducción, en segundos del original. */
  cabeza: number | null;
  alIrA: (s: number) => void;
}) {
  const lienzo = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const c = lienzo.current;
    if (!c) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;

    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const ancho = c.clientWidth;
    const alto = c.clientHeight;
    c.width = Math.round(ancho * dpr);
    c.height = Math.round(alto * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, ancho, alto);

    const oscuro = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const ventana = VENTANA_MS / 1000;
    const aX = (s: number) => (s / Math.max(0.001, duracion)) * ancho;

    // Primero lo que se va, de fondo: es el negativo de lo que se queda.
    ctx.fillStyle = oscuro ? "#2a1a1a" : "#fdeaea";
    ctx.fillRect(0, 0, ancho, alto);
    ctx.fillStyle = oscuro ? "#0f1f1d" : "#eefaf7";
    for (const t of tramos) ctx.fillRect(aX(t.desde), 0, aX(t.hasta) - aX(t.desde), alto);

    // La onda: cada píxel resume las ventanas que le tocan.
    //
    // Por proporción y no a zancadas fijas: un video corto tiene menos
    // ventanas que píxeles —seis segundos son 300 ventanas y el lienzo mide
    // casi mil— y avanzar de una en una dejaba la onda dibujada solo en el
    // primer tercio, con el resto en blanco como si no hubiera audio.
    const medio = alto / 2;
    for (let x = 0; x < ancho; x++) {
      const desde = Math.floor((x / ancho) * env.length);
      const hasta = Math.max(desde + 1, Math.ceil(((x + 1) / ancho) * env.length));
      let pico = -100;
      for (let i = desde; i < Math.min(hasta, env.length); i++) {
        if (env[i] > pico) pico = env[i];
      }
      // De -60 dB a 0 dB, que es donde vive una voz grabada con un teléfono.
      const h = Math.max(1, ((Math.max(-60, pico) + 60) / 60) * (alto * 0.86));
      const dentro = pico >= umbral;
      ctx.fillStyle = dentro
        ? oscuro ? "#2dd4bf" : "#0f766e"
        : oscuro ? "#4b5563" : "#c8c8c8";
      ctx.fillRect(x, medio - h / 2, 1, h);
    }

    // La línea del umbral, para que el deslizador tenga un referente visible.
    const yUmbral = medio - (((Math.max(-60, umbral) + 60) / 60) * (alto * 0.86)) / 2;
    ctx.strokeStyle = oscuro ? "#f59e0b88" : "#d9770688";
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.moveTo(0, yUmbral);
    ctx.lineTo(ancho, yUmbral);
    ctx.stroke();
    ctx.setLineDash([]);

    if (cabeza !== null) {
      ctx.strokeStyle = oscuro ? "#fafafa" : "#171717";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(aX(cabeza), 0);
      ctx.lineTo(aX(cabeza), alto);
      ctx.stroke();
    }

    void ventana;
  }, [env, tramos, duracion, umbral, cabeza]);

  return (
    <canvas
      ref={lienzo}
      onClick={(e) => {
        const caja = e.currentTarget.getBoundingClientRect();
        alIrA(((e.clientX - caja.left) / caja.width) * duracion);
      }}
      className="h-24 w-full cursor-pointer rounded-lg border border-neutral-200 dark:border-neutral-800"
      aria-label="La onda del audio. Lo verde se queda, lo rojo se va."
    />
  );
}
