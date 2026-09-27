-- Migración 5 — el tope de transcripción.
--
-- Los subtítulos NO gastan una corrida, y eso es una decisión, no un olvido.
-- Una corrida es el sistema escribiendo algo: un diagnóstico, una semana, una
-- pieza. Transcribir no escribe nada — copia lo que el dueño ya dijo — y cuesta
-- dos órdenes de magnitud menos. Cobrarlo como una corrida se comería de un
-- golpe la única que trae el plan de prueba, y dejaría a quien llega por
-- internet sin poder ver la función completa antes de pagar.
--
-- Pero gratis e ilimitado es una factura abierta. El tope va por SEGUNDOS DE
-- AUDIO AL DÍA y por negocio, que es lo que se corresponde con el cargo real.
create table if not exists uso_voz (
  negocio_id uuid not null references negocio(id) on delete cascade,
  dia        date not null,
  segundos   integer not null default 0,
  primary key (negocio_id, dia)
);
