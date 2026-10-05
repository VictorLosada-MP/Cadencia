import { notFound, redirect } from "next/navigation";
import { usuarioActual } from "@/lib/negocio";
import { adminActual, cuentas, llaveCorrecta, resumen } from "@/lib/panel";
import { Panel } from "./panel";

export const dynamic = "force-dynamic";

/** Que no acabe en ningún buscador ni en ninguna vista previa. */
export const metadata = {
  robots: { index: false, follow: false, nocache: true },
  title: "Panel",
};

/**
 * El panel, detrás de dos cerrojos.
 *
 * Aquí no hay una entrada aparte: se entra por la misma pantalla que todo el
 * mundo, con el mismo correo y la misma contraseña. Lo que decide si este
 * panel se abre no es cómo entraste, es qué dice `role` en la base.
 *
 * Los tres caminos, y la diferencia entre ellos importa:
 *
 * - **Llave mala** → 404, el mismo que una dirección inventada. Un 401 le
 *   confirmaría a quien está probando direcciones que ahí detrás hay algo.
 * - **Llave buena y sin sesión** → a la pantalla de entrar, y vuelve aquí al
 *   terminar. Esto no filtra nada: quien ya tiene la llave en la mano sabe de
 *   sobra que la dirección existe, y mandarle un 404 solo le dejaría mirando
 *   una pared sin saber que le faltaba iniciar sesión.
 * - **Llave buena, con sesión y sin el rol** → 404 otra vez. A alguien que ya
 *   está dentro del sistema no se le cuenta que existe un panel.
 */
export default async function PaginaPanel({
  params,
}: {
  params: Promise<{ llave: string }>;
}) {
  const { llave } = await params;
  if (!llaveCorrecta(llave)) notFound();

  const quien = await usuarioActual();
  if (!quien) redirect(`/entrar?volver=${encodeURIComponent(`/panel/${llave}`)}`);

  const admin = await adminActual();
  if (!admin) notFound();

  const [primera, cifras] = await Promise.all([cuentas(), resumen()]);
  return (
    <Panel
      llave={llave}
      inicial={primera}
      resumen={cifras}
      quien={admin.email}
    />
  );
}
