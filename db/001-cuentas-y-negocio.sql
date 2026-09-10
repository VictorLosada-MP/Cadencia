-- Migración 1 — cuentas y Perfil de Negocio.
--
-- Es la que hace existir al público B: hasta aquí, quien llegara de internet no
-- tenía dónde guardar su negocio, porque en producción el disco es de solo
-- lectura y los perfiles vivían en archivos del repositorio.
--
-- Se corre con:  npm run migrar
--
-- Las cuatro primeras tablas son las que Better Auth espera. Están aquí y no
-- generadas por su CLI a propósito: así el esquema entero vive en el
-- repositorio, se lee, se versiona y no depende de que una herramienta encuentre
-- un archivo de configuración. Los nombres salen de la propia librería
-- (getAuthTables), no de memoria, y por eso van entre comillas: son camelCase y
-- Postgres los bajaría a minúsculas sin ellas.

-- ── Cuentas de Cadencia ──────────────────────────────────────────────────────
-- Aquí no hay ni habrá una sola credencial de red social. La contraseña que se
-- guarda es la de Cadencia, cifrada por la librería, y vive en "account".

create table if not exists "user" (
  id              text primary key,
  name            text not null,
  email           text not null unique,
  "emailVerified" boolean not null default false,
  image           text,
  "createdAt"     timestamptz not null default now(),
  "updatedAt"     timestamptz not null default now(),
  -- Del complemento de administración: es lo que permite dar de alta a un
  -- cliente de la marca y regalarle la cuenta sin tocar la base a mano.
  role            text,
  banned          boolean default false,
  "banReason"     text,
  "banExpires"    timestamptz
);

create table if not exists session (
  id               text primary key,
  "expiresAt"      timestamptz not null,
  token            text not null unique,
  "createdAt"      timestamptz not null default now(),
  "updatedAt"      timestamptz not null default now(),
  "ipAddress"      text,
  "userAgent"      text,
  "userId"         text not null references "user"(id) on delete cascade,
  "impersonatedBy" text
);

create index if not exists session_usuario on session ("userId");

create table if not exists account (
  id                      text primary key,
  "accountId"             text not null,
  "providerId"            text not null,
  "userId"                text not null references "user"(id) on delete cascade,
  "accessToken"           text,
  "refreshToken"          text,
  "idToken"               text,
  "accessTokenExpiresAt"  timestamptz,
  "refreshTokenExpiresAt" timestamptz,
  scope                   text,
  password                text,
  "createdAt"             timestamptz not null default now(),
  "updatedAt"             timestamptz not null default now()
);

create index if not exists account_usuario on account ("userId");

create table if not exists verification (
  id           text primary key,
  identifier   text not null,
  value        text not null,
  "expiresAt"  timestamptz not null,
  "createdAt"  timestamptz not null default now(),
  "updatedAt"  timestamptz not null default now()
);

create index if not exists verification_identificador on verification (identifier);

-- ── El Perfil de Negocio ─────────────────────────────────────────────────────

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

-- Un negocio por cuenta en esta migración. Cuando entren los planes, el de
-- arriba levanta el límite y esto pasa a ser un índice parcial.
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
