import { ultimaCorrida } from "@/lib/historial";
import { negocioDe } from "@/lib/negocio";
import { perfilDesdeNegocio } from "@/lib/perfil";

/**
 * El contexto que leen todas las funciones: el Perfil de Negocio y las muestras
 * de voz, ya armados para el modelo.
 *
 * Vive en un solo sitio porque las cuatro funciones lo necesitan igual, y
 * porque el bloque `estable` es el que lleva marca de caché: si cada ruta lo
 * construyera a su manera, dejarían de compartir prefijo y el caché no serviría.
 */
export type Contexto = {
  /** El bloque caro que no cambia entre corridas. Va con marca de caché. */
  estable: string;
  voz: string;
  senales: string;
  accion: string;
  /** null cuando se corrió con un perfil semilla del repositorio. */
  negocioId: string | null;
};

/**
 * La frase de quién es, para el prompt.
 *
 * Es una frase y no un campo porque lo que hay que impedir es una corrección
 * concreta —«llámate de otra forma» a quien tiene razón social— y eso se
 * prohíbe diciéndolo, no dejando un dato suelto a ver si lo lee.
 */
function quienEs(tipo: string | undefined, nombre: string | undefined): string {
  const n = nombre?.trim() ?? "";
  if (!n) return "";

  if (tipo === "empresa") {
    return [
      "## Quién es",
      "",
      `Una EMPRESA, y se llama «${n}».`,
      "",
      "Ese nombre es el de la empresa: puede estar registrado, en su dominio y",
      "en sus facturas. No propongas cambiarlo ni sustituirlo. Si el punto del",
      "nombre no pasa, lo que se corrige es lo que va AL LADO del nombre —el",
      "descriptor con la palabra por la que lo buscarían—, dejando el nombre",
      "intacto y tal cual está escrito.",
      "",
    ].join("\n");
  }

  if (tipo === "persona") {
    return [
      "## Quién es",
      "",
      `Una MARCA PERSONAL. Se llama «${n}», que es el nombre de su dueño.`,
      "",
      "Aquí sí: si el punto del nombre no pasa, la corrección es el nombre",
      "propio más la palabra por la que lo buscarían. El nombre propio no se",
      "quita ni se reescribe.",
      "",
    ].join("\n");
  }

  return [
    "## Quién es",
    "",
    `Se llama «${n}». No ha dicho si es una empresa o una marca personal.`,
    "",
    "Mientras no lo diga, el punto del nombre va con `aplica: false`: no se",
    "puede corregir un nombre sin saber si es la razón social de una empresa",
    "o el nombre de una persona, porque la corrección no es la misma.",
    "",
  ].join("\n");
}

export class FaltaNegocio extends Error {
  constructor() {
    super("Llena primero tu negocio: qué vendes, a quién le sirve y cómo queda después.");
  }
}

/**
 * El contexto de ESTA cuenta. No hay otra fuente.
 *
 * Existió un «perfil semilla» que leía un negocio de ejemplo del repositorio,
 * para probar el sistema sin llenar nada. Se quitó entero: en un producto
 * desplegado, eso le ofrecía a un desconocido diagnosticarse contra el negocio
 * de otro. No era una comodidad de desarrollo con un interruptor, era una
 * puerta — y una puerta que existe se acaba abriendo.
 */
export async function cargarContexto(usuarioId: string): Promise<Contexto> {
  const guardado = await negocioDe(usuarioId);
  if (!guardado) throw new FaltaNegocio();
  const perfil = perfilDesdeNegocio(guardado);
  const voz = guardado.voz?.trim() ?? "";
  const senales = guardado.senales?.trim() ?? "";
  const negocioId: string | null = guardado.id;

  // Quién es, dicho en una frase y no escondido en un campo del JSON.
  //
  // El primer punto del diagnóstico juzga el nombre del perfil. Sin esto lo
  // juzgaba a ciegas: a «Bellavista Coffee Farm» —una empresa, con su nombre
  // registrado— le salía la misma corrección que a una persona que firma con
  // su nombre y apellido, y la corrección correcta no es la misma.
  const identidad = quienEs(guardado.tipo, guardado.nombre);

  // La voz va aparte y en crudo; dentro del JSON solo estorbaría su ruta.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { voz: _fuente, ...nucleo } = perfil.nucleo;

  // Si no declaró un CTA en su negocio, se usa el que ya se leyó de su propio
  // perfil en el último diagnóstico. El sistema ya tenía el dato: pedírselo
  // otra vez es hacerle escribir dos veces lo mismo.
  let accion = perfil.nucleo.accion?.texto?.trim() ?? "";
  let accionLeida = false;
  if (!accion && negocioId) {
    const ultima = await ultimaCorrida(negocioId, 1);
    const redes = (ultima?.entrada as { redes?: { casillas?: { cta?: string } }[] })?.redes ?? [];
    const visto = redes.map((r) => r.casillas?.cta?.trim()).find(Boolean);
    if (visto) {
      accion = visto;
      accionLeida = true;
    }
  }

  return {
    estable: [
      identidad,
      "## Perfil de Negocio",
      JSON.stringify({ ...perfil, nucleo }, null, 2),
      voz ? `\n## Muestras de voz\n\n${voz}` : "\n## Muestras de voz\n\n(ninguna)",
      accion
        ? `\n## Su llamada a la acción\n\n«${accion}»${
            accionLeida ? " — leída de su propio perfil, no declarada por él" : ""
          }`
        : "",
    ].join("\n"),
    voz,
    senales,
    accion,
    negocioId,
  };
}
