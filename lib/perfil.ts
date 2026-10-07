import fs from "node:fs/promises";
import path from "node:path";

const RAIZ = process.cwd();

export type Perfil = {
  id: string;
  nombre: string;
  /**
   * De qué clase es el negocio: `"empresa"`, `"persona"` o vacío si no lo dijo.
   *
   * Va al prompt porque el primer punto del diagnóstico es el nombre del
   * perfil, y sin esto se corrige a ciegas: a una empresa con razón social se
   * le acababa proponiendo que se llamara de otra forma.
   */
  tipo: string;
  nucleo: {
    oferta: string;
    cliente: string;
    freno: string;
    despues: string;
    voz: { fuente: string; estado: string } | null;
    accion: { texto: string; antesala?: string } | null;
  };
  enriquecimiento?: Record<string, unknown>;
  marca?: { tono?: string; palabras?: string[]; no_representa?: string[] };
  integridad?: { sin_prueba_social?: boolean; nota?: string };
};


/**
 * Un Perfil de Negocio armado con lo que el dueño escribió en la app, sin
 * archivo de por medio. Es la misma forma que consume el prompt: lo que
 * cambia es de dónde salió, no qué es.
 */
export function perfilDesdeNegocio(n: {
  tipo?: string;
  nombre?: string;
  oferta: string;
  cliente: string;
  despues: string;
  freno?: string;
  accion?: string;
}): Perfil {
  return {
    id: "en-linea",
    nombre: n.nombre?.trim() ?? "",
    tipo: n.tipo?.trim() ?? "",
    nucleo: {
      oferta: n.oferta.trim(),
      cliente: n.cliente.trim(),
      freno: n.freno?.trim() ?? "",
      despues: n.despues.trim(),
      voz: null,
      accion: n.accion?.trim() ? { texto: n.accion.trim() } : null,
    },
    integridad: {
      sin_prueba_social: true,
      nota:
        "Perfil llenado en la app. No trae prueba social: ninguna corrección puede insinuar que la hay.",
    },
  };
}

export function cargarPrompt(archivo: string) {
  return fs.readFile(path.join(RAIZ, "prompts", archivo), "utf8");
}
