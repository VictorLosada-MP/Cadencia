#!/usr/bin/env node
// La dirección secreta del panel. La genera esta máquina y no sale de aquí.
//
// Va en una variable y no escrita en el código a propósito: una ruta fija en
// el repositorio la sabe cualquiera que lea el repositorio, y el repositorio
// se puede leer. Aun así, por sí sola no autoriza nada — hace falta además
// `npm run rol -- tu@correo.com admin`.
import { randomBytes } from "node:crypto";

const llave = randomBytes(24).toString("base64url");
console.log(`\nPANEL_LLAVE=${llave}\n`);
console.log(`El panel queda en:  /panel/${llave}\n`);
console.log("Cópialo a .env.local y a las variables del despliegue.");
console.log("Si lo cambias, la dirección anterior deja de existir.\n");
console.log("Con esto sola no entra nadie. Crea tu cuenta en /entrar como");
console.log("cualquiera y márcala como administradora en la base:\n");
console.log("  npm run rol -- tu@correo.com admin\n");
