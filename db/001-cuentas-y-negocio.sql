-- Migración 1 — cuentas y Perfil de Negocio.
--
-- Es la que hace existir al público B: hasta aquí, quien llegara de internet no
-- tenía dónde guardar su negocio, porque en producción el disco es de solo
-- lectura y los perfiles vivían en archivos del repositorio.
--
-- Se corre una vez contra la base:
--   psql "$DATABASE_URL" -f db/001-cuentas-y-negocio.sql

-- Better Auth crea y mantiene sus propias tablas ("user", "session",
-- "account", "verification"). No se declaran aquí para no pelear con sus
-- migraciones: se generan con `npx @better-auth/cli migrate` antes que esto.

create table if not exists negocio (
  id            uuid primary key default gen_random_uuid(),
  usuario_id    text not null references "user"(id) on delete cascade,

  -- Los tres campos que se piden en la puerta. Sin ellos no hay diagnóstico:
  -- las correcciones se escribirían sobre un negocio que no es el suyo.
  oferta        text not null,
  cliente       text not null,
  despues       text not null,

  -- Los tres que se pueden pedir después, por las preguntas del diagnóstico.
  freno         text not null default '',
  accion        text not null default '',
  -- Muestras de cómo habla, en crudo. Sin esto las correcciones salen en
  -- español llano — y el prompt lo declara en sus límites, no lo disimula.
  voz           text not null default '',

  nombre        text not null default '',
  creado        timestamptz not null default now(),
  actualizado   timestamptz not null default now()
);

create index if not exists negocio_usuario on negocio (usuario_id);

-- Un negocio por cuenta en esta migración. Cuando entren los planes, el de
-- arriba levanta este límite y esto pasa a ser un índice parcial.
create unique index if not exists negocio_uno_por_usuario on negocio (usuario_id);

create or replace function tocar_actualizado() returns trigger as $$
begin
  new.actualizado = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists negocio_actualizado on negocio;
create trigger negocio_actualizado
  before update on negocio
  for each row execute function tocar_actualizado();
