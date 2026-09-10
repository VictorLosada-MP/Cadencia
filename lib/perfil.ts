import fs from "node:fs/promises";
import path from "node:path";

const RAIZ = process.cwd();

export type Perfil = {
  id: string;
  nombre: string;
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
 * El id llega del cuerpo de la petición, así que se valida antes de tocar el
 * disco. Un id con "../" no debería llegar nunca a path.join.
 */
const ID_VALIDO = /^[a-z0-9][a-z0-9-]{0,63}$/;

/** Perfil + la muestra de voz resuelta desde su archivo. */
export async function cargarPerfil(id: string) {
  if (!ID_VALIDO.test(id)) throw new Error("Perfil no encontrado.");

  const perfil: Perfil = JSON.parse(
    await fs.readFile(path.join(RAIZ, "perfiles", `${id}.json`), "utf8"),
  );

  let voz = "";
  if (perfil.nucleo.voz?.fuente) {
    voz = await fs
      .readFile(path.join(RAIZ, perfil.nucleo.voz.fuente), "utf8")
      .catch(() => "");
  }
  return { perfil, voz };
}

/**
 * Un Perfil de Negocio armado con lo que el dueño escribió en la app, sin
 * archivo de por medio. Es la misma forma que consume el prompt: lo que
 * cambia es de dónde salió, no qué es.
 */
export function perfilDesdeNegocio(n: {
  oferta: string;
  cliente: string;
  despues: string;
  freno?: string;
  accion?: string;
}): Perfil {
  return {
    id: "en-linea",
    nombre: "",
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

export async function listarPerfiles() {
  const files = await fs.readdir(path.join(RAIZ, "perfiles"));
  return files.filter((f) => f.endsWith(".json")).map((f) => f.replace(/\.json$/, ""));
}
