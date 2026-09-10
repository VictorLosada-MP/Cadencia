#!/usr/bin/env node
// Un secreto al azar para BETTER_AUTH_SECRET. No sale de ningún proveedor:
// lo genera esta máquina y solo sirve para firmar las sesiones de Cadencia.
import { randomBytes } from "node:crypto";

console.log(`\nBETTER_AUTH_SECRET=${randomBytes(32).toString("base64url")}\n`);
console.log("Cópialo tal cual a .env.local. Si lo cambias, se cierran las sesiones abiertas.\n");
