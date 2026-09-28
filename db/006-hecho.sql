-- Migración 6 — lo que ya está hecho.
--
-- "Hecho" no es "generado". Una pieza escrita y nunca descargada no se publicó:
-- se quedó en la pantalla. Lo que cuenta como hecho es el archivo en la mano —
-- el MP4 montado o las láminas del carrusel— porque es lo único que ya puede
-- estar arriba.
--
-- Por eso la fila se escribe cuando se DESCARGA, no cuando se genera. Y por eso
-- no hay ninguna columna de "publicado en": el sistema no se conecta a ninguna
-- red y no puede saberlo. Inventar una casilla de "ya lo subí" que el dueño
-- tiene que marcar a mano es pedirle trabajo para alimentar una estadística
-- que no le sirve para vender.
create table if not exists entregado (
  id          uuid primary key default gen_random_uuid(),
  negocio_id  uuid not null references negocio(id) on delete cascade,
  -- De qué corrida salió, para poder volver a abrir el guion o las láminas.
  -- Se pone a null si esa corrida se borra: la pieza siguió existiendo.
  corrida_id  uuid references corrida(id) on delete set null,
  tipo        text not null check (tipo in ('video', 'carrusel')),
  -- El gancho o el titular de la primera lámina. Es como lo reconoce el dueño.
  titulo      text not null default '',
  -- Cuántas láminas, o cuántos segundos de video. Para la ficha, no para medir.
  detalle     text not null default '',
  creado      timestamptz not null default now()
);

create index if not exists entregado_negocio on entregado (negocio_id, creado desc);
