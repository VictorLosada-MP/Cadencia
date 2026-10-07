-- Migración 11 — pagos por Wompi.
--
-- ── El precio en pesos ──
--
-- Wompi cobra en COP y en CENTAVOS. `precio_mes` queda como estaba —es lo que
-- se anuncia— y el cobro sale de esta columna, que es la única que toca el
-- dinero de verdad.
--
-- Entra en null a propósito: **nadie va a inventarse el precio de Cadencia en
-- un archivo de migración.** Mientras esté vacía el plan no se puede comprar y
-- la pantalla lo dice. Se pone así, una vez:
--
--   update plan set precio_cop = 79000 where id = 'cadencia';
--   update plan set precio_cop = 199000 where id = 'marca';
alter table plan add column if not exists precio_cop integer;

-- ── Hasta cuándo vale lo pagado ──
--
-- El checkout de Wompi cobra UNA vez, no suscribe. Así que un pago compra un
-- mes y hace falta saber cuándo se acaba; sin esta columna, quien pagó una vez
-- se quedaba con el plan para siempre.
--
-- En null significa sin caducidad, que es lo que tienen las cuentas de hoy y
-- lo que sigue teniendo una cortesía: así nada de lo que ya existe cambia de
-- comportamiento al correr esto.
alter table suscripcion add column if not exists plan_hasta timestamptz;

-- ── Los pagos ──
--
-- Una fila por intento, no solo por pago bueno. El que se cae a mitad también
-- deja rastro, y sin ese rastro no se puede responder «pagué y no me entró».
--
-- `referencia` es única y es la que une las tres piezas: lo que se le manda al
-- checkout, lo que vuelve en el evento y la fila de aquí. Por eso el evento
-- puede llegar dos veces sin cobrar dos veces.
create table if not exists pago (
  id             uuid primary key default gen_random_uuid(),
  usuario_id     text not null references "user"(id) on delete cascade,
  plan_id        text not null references plan(id),
  referencia     text not null unique,
  -- En centavos y bigint: en pesos colombianos, un plan anual se sale de int4.
  monto_centavos bigint not null,
  -- PENDIENTE hasta que llegue el evento. Después, lo que diga Wompi:
  -- APPROVED, DECLINED, VOIDED o ERROR.
  estado         text not null default 'PENDIENTE',
  -- El id de Wompi, para poder buscar el cobro en su panel sin adivinar.
  transaccion_id text,
  creado         timestamptz not null default now(),
  actualizado    timestamptz not null default now()
);

create index if not exists pago_usuario on pago (usuario_id, creado desc);
