import Link from "next/link";
import { cuotaDe } from "@/lib/cuota";
import { negocioDe, usuarioActual } from "@/lib/negocio";
import { pagosDe } from "@/lib/pagos";
import { Barra } from "../barra";

export const dynamic = "force-dynamic";

/**
 * Donde cae el dueño al volver de Wompi.
 *
 * Esta pantalla NO activa nada: solo mira qué dice la base. Quien activa el
 * plan es el evento firmado, porque esta dirección la puede abrir cualquiera
 * escribiéndola a mano sin haber pagado un peso.
 *
 * De ahí el mensaje intermedio: puede que el dueño llegue aquí antes que el
 * evento. No es un fallo, son unos segundos, y decirlo es mejor que enseñarle
 * un «no pagaste» que sería mentira.
 */
export default async function PaginaPago() {
  const usuario = await usuarioActual().catch(() => null);
  if (!usuario) {
    return (
      <Marco titulo="Entra a tu cuenta">
        <p className="mt-4 text-neutral-600 dark:text-neutral-400">
          Si acabas de pagar, entra con el mismo correo y lo verás.
        </p>
        <Boton href="/entrar">Entrar</Boton>
      </Marco>
    );
  }

  const [pagos, negocio] = await Promise.all([
    pagosDe(usuario.id).catch(() => []),
    negocioDe(usuario.id).catch(() => null),
  ]);
  const cuota = await cuotaDe(usuario.id, negocio?.id ?? null).catch(() => null);
  const ultimo = pagos[0];

  const aprobado = ultimo?.estado === "APPROVED";
  const esperando = !ultimo || ultimo.estado === "PENDIENTE";

  return (
    <main className="mx-auto max-w-2xl px-6 py-14">
      <Barra />
      <header className="entra border-b-2 border-neutral-900 pb-7 dark:border-neutral-100">
        <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-teal-700 dark:text-teal-400">
          El pago
        </p>
        <h1 className="mt-4 text-4xl font-bold leading-none tracking-tight">
          {aprobado ? "Listo, ya está" : esperando ? "Confirmando el pago…" : "El pago no entró"}
        </h1>
      </header>

      <div className="revela mt-7 rounded-lg border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900">
        {aprobado ? (
          <p className="leading-relaxed">
            Tu plan es <strong>{cuota?.plan.nombre ?? ultimo.plan_id}</strong>
            {cuota?.limite === null
              ? ", sin límite de corridas."
              : cuota
                ? `, con ${cuota.limite} corridas al mes.`
                : "."}
          </p>
        ) : esperando ? (
          <p className="leading-relaxed">
            El banco nos lo confirma en unos segundos. Puedes recargar esta
            página — y si ya te cobraron, el plan entra solo aunque cierres.
          </p>
        ) : (
          <p className="leading-relaxed">
            Wompi lo marcó como <strong>{ultimo.estado}</strong>. No se te cobró
            nada. Puedes intentarlo otra vez con otro medio de pago.
          </p>
        )}

        {ultimo && (
          <p className="mt-3 font-mono text-[11px] text-neutral-500">
            referencia {ultimo.referencia}
          </p>
        )}
      </div>

      <Boton href={aprobado ? "/semana" : "/planes"}>
        {aprobado ? "Escribir la semana" : "Volver a los planes"}
      </Boton>
    </main>
  );
}

function Marco({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <main className="mx-auto max-w-2xl px-6 py-20">
      <h1 className="text-4xl font-bold tracking-tight">{titulo}</h1>
      {children}
    </main>
  );
}

function Boton({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="empuja mt-6 inline-block rounded-full bg-teal-700 px-5 py-2.5 font-semibold text-white dark:bg-teal-600"
    >
      {children}
    </Link>
  );
}
