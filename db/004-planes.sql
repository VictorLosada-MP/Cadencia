-- Migración 4 — planes, cuota y cortesías.
--
-- Se limita por CORRIDAS AL MES: una sola unidad, la que se entiende sin que se
-- la expliquen, y que corresponde una a una con un cargo de API. "Afinar con mis
-- respuestas" cuenta como una, porque cuesta lo mismo que la primera.
--
-- Lo que NO se limita, y conviene que quede escrito antes de que alguien lo
-- proponga:
--   · el número de redes — el tope de dos es criterio de producto, no tarifa
--   · la profundidad de la lectura — mutilar el producto para vender el arreglo
--   · leer lo ya entregado — las correcciones escritas son producto entregado;
--     ponerlas detrás del muro convierte una herramienta en un secuestro
--
-- El contador no es una columna: se cuenta la tabla `corrida`, que solo recibe
-- fila cuando una corrida termina bien. Así la regla "no se cobra un error
-- propio" se cumple por construcción y no hay dos números que puedan
-- desincronizarse.

create table if not exists plan (
  id              text primary key,
  nombre          text not null,
  precio_mes      numeric(8,2) not null default 0,
  -- Límite mensual. null cuando el plan se mide de por vida.
  corridas_mes    integer,
  -- Límite de por vida, para el plan de prueba. null cuando es mensual.
  corridas_total  integer,
  negocios        integer not null default 1,
  -- Meses de historial visibles. null es sin límite.
  historial_meses integer,
  orden           smallint not null default 0
);

insert into plan (id, nombre, precio_mes, corridas_mes, corridas_total, negocios, historial_meses, orden)
values
  ('prueba',   'Prueba',    0, null,    1, 1, 0,    0),
  ('cadencia', 'Cadencia', 19,   20, null, 1, 12,   1),
  ('marca',    'Marca',    49,   60, null, 3, null, 2)
on conflict (id) do nothing;

create table if not exists suscripcion (
  usuario_id      text primary key references "user"(id) on delete cascade,
  plan_id         text not null references plan(id),

  -- La cortesía no es un plan aparte: son cuatro columnas que apuntan a un plan
  -- REAL. Así los límites del regalo se mueven solos cuando se mueve el plan de
  -- pago, retirarla deja la cuenta en su plan sin borrar nada, el consumo se
  -- sigue contando —se puede ver el dólar exacto que cuesta la generosidad— y
  -- no es ilimitada.
  cortesia_plan   text references plan(id),
  cortesia_hasta  timestamptz,
  cortesia_motivo text not null default '',
  cortesia_por    text references "user"(id),

  creado          timestamptz not null default now()
);
