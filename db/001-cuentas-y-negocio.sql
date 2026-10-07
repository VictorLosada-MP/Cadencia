-- Migración 1 — cuentas y Perfil de Negocio.
--
-- Es la que hace existir al público B: hasta aquí, quien llegara de internet no
-- tenía dónde guardar su negocio, porque en producción el disco es de solo
-- lectura y los perfiles vivían en archivos del repositorio.
--
-- Se corre con:  npm run migrar
--
-- Todos los archivos de db/ se corren ENTEROS en cada `npm run migrar`: no hay
-- tabla que lleve la cuenta de cuáles ya pasaron. Por eso cada orden de aquí
-- tiene que poder repetirse sin romper nada — `if not exists`, `or replace`,
-- `on conflict do nothing`. Es la regla que sostiene todo el sistema.
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
  -- La trae el esquema de Better Auth. Aquí entra siempre en null —no hay de
  -- dónde sacar una foto, se entra con correo y contraseña— pero no se puede
  -- quitar: comprobado, sin ella el alta y la entrada devuelven 500 con
  -- «missing-column». Es el mismo caso que los tokens de `account`.
  image           text,
  "createdAt"     timestamptz not null default now(),
  "updatedAt"     timestamptz not null default now(),
  -- Nuestra, no de la librería: es para el panel de administración de más
  -- adelante. Vacía en todo el mundo menos en quien administre.
  --
  -- Aquí vivían también `banned`, `banReason` y `banExpires`, que venían del
  -- complemento `admin()` de Better Auth. Se quitaron en la migración 009: no
  -- hay a quién bloquear. Quien deja de pagar no se bloquea, se queda sin
  -- cuota — el portero de `revisarCuota` cierra la puerta de crear y deja
  -- abierta la de leer lo que ya pagó, que es lo correcto.
  role            text
);

create table if not exists session (
  id               text primary key,
  "expiresAt"      timestamptz not null,
  token            text not null unique,
  "createdAt"      timestamptz not null default now(),
  "updatedAt"      timestamptz not null default now(),
  "ipAddress"      text,
  "userAgent"      text,
  "userId"         text not null references "user"(id) on delete cascade
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
