#!/usr/bin/env node
/**
 * Copia el núcleo de ffmpeg.wasm a `public/ffmpeg/`.
 *
 * Se sirve desde aquí y no desde un CDN a propósito: cargarlo de unpkg ataría
 * el producto a que un tercero siga publicándolo, y esa es exactamente la
 * dependencia que el producto promete no tener. Son 32 MB, así que no entran
 * al repositorio: se copian de node_modules en cada instalación.
 */
import fs from "node:fs";
import path from "node:path";

const RAIZ = process.cwd();
const ORIGEN = path.join(RAIZ, "node_modules", "@ffmpeg", "core", "dist", "umd");
const DESTINO = path.join(RAIZ, "public", "ffmpeg");
const ARCHIVOS = ["ffmpeg-core.js", "ffmpeg-core.wasm"];

if (!fs.existsSync(ORIGEN)) {
  console.error("\n  Falta @ffmpeg/core. Corre `npm install` y vuelve a intentarlo.\n");
  process.exit(1);
}

fs.mkdirSync(DESTINO, { recursive: true });
let copiados = 0;
for (const f of ARCHIVOS) {
  const de = path.join(ORIGEN, f);
  const a = path.join(DESTINO, f);
  // Si ya está y pesa lo mismo, no se vuelve a escribir: son 32 MB.
  if (fs.existsSync(a) && fs.statSync(a).size === fs.statSync(de).size) continue;
  fs.copyFileSync(de, a);
  copiados++;
}

console.log(
  copiados ? `  ffmpeg.wasm listo en public/ffmpeg (${copiados} archivos)` : "  ffmpeg.wasm ya estaba",
);
