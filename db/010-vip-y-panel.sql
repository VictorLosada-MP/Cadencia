-- Migración 10 — el plan VIP y el panel.
--
-- ── El VIP es un plan aparte, no el plan Marca ──
--
-- Podría haberse regalado Marca, que ya va sin límite de corridas. Pero Marca
-- es un plan que se VENDE: lleva un precio y puede cambiar mañana por razones
-- comerciales. El día que se le ponga un tope a Marca, los clientes de la marca
-- personal —que no pagan y a los que se les prometió ilimitado— lo perderían
-- sin que nadie lo decidiera.
--
-- Por eso VIP es suyo: precio cero, nada contado, y no se toca cuando se mueven
-- los precios.
alter table plan add column if not exists publico boolean not null default true;

insert into plan (id, nombre, precio_mes, corridas_mes, corridas_total, negocios, historial_meses, orden, publico)
values ('vip', 'VIP', 0, null, null, 3, null, 9, false)
on conflict (id) do update
   set nombre = excluded.nombre,
       precio_mes = excluded.precio_mes,
       corridas_mes = excluded.corridas_mes,
       corridas_total = excluded.corridas_total,
       negocios = excluded.negocios,
       historial_meses = excluded.historial_meses,
       publico = excluded.publico;

-- `publico` en falso lo saca de la página de precios. Un plan de cero euros con
-- todo ilimitado en la lista pública no sería una oferta: sería la puerta de
-- atrás, anunciada.
update plan set publico = false where id = 'vip';

-- ── Los tokens caducados se borran ──
--
-- `verification` guarda los tokens de "olvidé mi contraseña". No puede tener
-- clave foránea a `user` —un token existe antes de saber de quién es, y tiene
-- que morir solo al caducar— así que nada los limpiaba y se acumulaban para
-- siempre. Con el índice, borrarlos cuesta lo mismo con diez filas que con cien
-- mil.
create index if not exists verification_caducidad on verification ("expiresAt");
