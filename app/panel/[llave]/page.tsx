import { notFound } from "next/navigation";
import { adminActual, cuentas, llaveCorrecta } from "@/lib/panel";
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
 * Los dos fallan con el MISMO 404 que una dirección inventada. Un 401 o un
 * "no autorizado" le confirmaría a quien esté probando direcciones que ahí
 * detrás hay algo; un 404 no le dice nada.
 */
export default async function PaginaPanel({
  params,
}: {
  params: Promise<{ llave: string }>;
}) {
  const { llave } = await params;
  if (!llaveCorrecta(llave)) notFound();

  const admin = await adminActual();
  if (!admin) notFound();

  return <Panel llave={llave} lista={await cuentas()} quien={admin.email} />;
}
