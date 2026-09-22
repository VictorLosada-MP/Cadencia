-- Migración 3 — el historial.
--
-- Es la razón para volver el mes siguiente. El propio prompt del diagnóstico lo
-- promete —"un punto que antes no pasaba y ahora pasa es una mejora
-- verificable"— y hasta aquí esa frase era decorativa, porque no había con qué
-- comparar.
--
-- Regla de diseño: la comparación se CALCULA, no se narra. Un párrafo generado
-- comparando dos fechas tiene el mismo defecto que el puntaje 0-100 que ya se
-- quitó — sube o baja por razones que no son la mejora. Lo comparable es qué
-- punto pasó de no-pasa a pasa y qué texto cambió: eso sale de comparar dos
-- cadenas guardadas, sin pedirle nada al modelo y sin nada que inventar.
--
-- Y aquí NO va ninguna columna de puntaje, calificación ni sugerencia sobre lo
-- publicado. Ahí muere la regla de "línea base, no examen". Quien lo intente,
-- que lea esto primero.

create table if not exists corrida (
  id          uuid primary key default gen_random_uuid(),
  negocio_id  uuid not null references negocio(id) on delete cascade,
  -- Qué función la produjo: 1 diagnóstico, 2 semana, 3 guion.
  funcion     smallint not null check (funcion in (1, 2, 3)),
  creado      timestamptz not null default now(),
  -- La salida entera, tal como la devolvió el modelo. Se guarda completa
  -- porque la pantalla de mañana puede querer un campo que hoy no se lee.
  resultado   jsonb not null,
  -- Con qué se produjo, para saber si una diferencia es del perfil o del motor.
  modelo      text not null default '',
  entrada     jsonb not null default '{}'::jsonb
);

create index if not exists corrida_negocio on corrida (negocio_id, funcion, creado desc);

-- Los cinco puntos de cada red, en filas. Es a la vez el detalle del
-- diagnóstico y la instantánea fechada del perfil: `actual` ES lo que decía esa
-- casilla ese día. No hace falta una segunda tabla para lo mismo.
create table if not exists punto (
  corrida_id  uuid not null references corrida(id) on delete cascade,
  red         text not null,
  campo       text not null,
  aplica      boolean not null default true,
  visible     boolean not null default true,
  pasa        boolean not null default false,
  actual      text not null default '',
  primary key (corrida_id, red, campo)
);
