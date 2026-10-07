/**
 * Lo que se recuerda en el navegador, con dueño.
 *
 * Existe por un fallo de los feos: los borradores se guardaban con una clave
 * fija —"cadencia", "cadencia:negocio"— sin decir de quién eran. En el mismo
 * navegador, la segunda cuenta que entraba se encontraba el negocio de la
 * primera ya escrito en sus campos, y el diagnóstico con lo que había
 * publicado otro. No era un fallo de dispositivo: era que nadie preguntaba de
 * quién era eso.
 *
 * Ahora la clave lleva el id de la cuenta dentro, así que no hay forma de leer
 * lo de otro: no es que se compruebe el dueño, es que la llave ni abre. Y al
 * salir se borra todo lo de Cadencia, que es lo que hay que hacer en un
 * computador compartido.
 */

const RAIZ = "cadencia";

const llave = (que: string, usuarioId: string) => `${RAIZ}:${usuarioId}:${que}`;

export function leer<T>(que: string, usuarioId: string | undefined): T | null {
  if (!usuarioId) return null;
  try {
    const crudo = localStorage.getItem(llave(que, usuarioId));
    return crudo ? (JSON.parse(crudo) as T) : null;
  } catch {
    // Un guardado ilegible no puede impedir usar la aplicación.
    return null;
  }
}

export function guardar(que: string, usuarioId: string | undefined, valor: unknown): void {
  if (!usuarioId) return;
  try {
    localStorage.setItem(llave(que, usuarioId), JSON.stringify(valor));
  } catch {
    // Sin espacio o en incógnito: se sigue trabajando, solo no se recuerda.
  }
}

export function borrar(que: string, usuarioId: string | undefined): void {
  if (!usuarioId) return;
  try {
    localStorage.removeItem(llave(que, usuarioId));
  } catch {
    // Si no se puede borrar, el siguiente guardado lo pisa igual.
  }
}

/**
 * Todo lo de Cadencia, fuera. Se llama al salir de la cuenta.
 *
 * Incluye las claves viejas sin dueño, que son las que causaron el problema:
 * si no se barren, el borrador de antes sigue ahí esperando a quien entre.
 */
export function olvidarTodo(): void {
  try {
    const fuera: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && (k === RAIZ || k.startsWith(`${RAIZ}:`))) fuera.push(k);
    }
    for (const k of fuera) localStorage.removeItem(k);
    sessionStorage.removeItem("cadencia:pieza");
  } catch {
    // En incógnito puede no haber nada que borrar.
  }
}
