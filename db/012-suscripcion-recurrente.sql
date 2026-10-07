-- Migración 12 — cobro recurrente con tarjeta guardada.
--
-- El checkout de Wompi no sabe guardar el medio de pago: cobra una vez y se
-- acabó. Para que se cobre solo cada mes hace falta una FUENTE DE PAGO, que es
-- una tarjeta tokenizada por Wompi y guardada del lado de ellos.
--
-- Lo que se guarda aquí es el identificador que devuelve Wompi y dos datos para
-- que el dueño reconozca su tarjeta en pantalla. **El número de la tarjeta no
-- está en esta base y no va a estarlo**: lo tokeniza el navegador contra Wompi
-- directamente, así que ni siquiera pasa por el servidor de Cadencia.
alter table suscripcion
  add column if not exists fuente_pago_id  text,
  add column if not exists fuente_marca    text,
  add column if not exists fuente_ultimos4 text;

-- Si sigue renovándose. Lo apaga el dueño desde su pantalla de plan, y eso no
-- es un extra: un cobro que se repite y no se puede parar desde dentro del
-- producto está mal hecho, aunque sea legal.
alter table suscripcion add column if not exists renovar boolean not null default true;

-- Cuántos cobros seguidos han fallado. A la tercera se deja de intentar: una
-- tarjeta vencida no se arregla insistiendo, y seguir cobrando a quien ya dijo
-- que no puede es lo que hace que la gente llame al banco en vez de a ti.
alter table suscripcion add column if not exists fallos smallint not null default 0;

-- Cuándo se intentó cobrar por última vez, para no repetir el intento el mismo
-- día si la tarea se dispara dos veces.
alter table suscripcion add column if not exists ultimo_intento timestamptz;

-- De dónde salió cada pago: del checkout a mano o del cobro automático. Sin
-- esto, «¿por qué me cobraron?» no tiene respuesta en la base.
alter table pago add column if not exists origen text not null default 'checkout';

create index if not exists suscripcion_renovacion
  on suscripcion (plan_hasta)
  where renovar and fuente_pago_id is not null;
