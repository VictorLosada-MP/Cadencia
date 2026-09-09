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

/** Perfil + la muestra de voz resuelta desde su archivo. */
export async function cargarPerfil(id: string) {
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

export function cargarPrompt(archivo: string) {
  return fs.readFile(path.join(RAIZ, "prompts", archivo), "utf8");
}

export async function listarPerfiles() {
  const files = await fs.readdir(path.join(RAIZ, "perfiles"));
  return files.filter((f) => f.endsWith(".json")).map((f) => f.replace(/\.json$/, ""));
}
