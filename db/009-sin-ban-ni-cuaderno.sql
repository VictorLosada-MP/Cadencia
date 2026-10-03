-- Migración 9 — fuera el bloqueo de usuarios y el cuaderno de migraciones.
--
-- ── Las tres columnas de bloqueo ──
--
-- Venían del complemento `admin()` de Better Auth, que se retira aquí. Y la
-- pregunta que las tumba es la correcta: ¿a quién se bloquea? El que deja de
-- pagar no se bloquea, se queda sin cuota — y eso ya lo hace `revisarCuota`,
-- que cierra la puerta de CREAR y deja abierta la de LEER lo que ya pagó.
-- Bloquear la cuenta entera le quitaría también lo que ya es suyo.
--
-- `role` se queda, pero cambia de dueño: ya no la escribe la librería, es
-- nuestra, para el panel de administración que viene. Better Auth la ignora.
--
-- Lo que se pierde con el complemento, dicho sin adornos: sus rutas de
-- administración ya hechas (listar cuentas, cambiar el rol, bloquear) y la
-- suplantación para dar soporte. Ninguna estaba en uso, y el panel propio no
-- las necesita: es un `select` por `role`.
alter table "user"
  drop column if exists banned,
  drop column if exists "banReason",
  drop column if exists "banExpires";

alter table session drop column if exists "impersonatedBy";

-- ── El cuaderno de migraciones ──
--
-- `migracion` guardaba una línea por archivo ya aplicado, para no repetirlos.
-- Se retira: las consultas viven en el código y los archivos de db/ se pueden
-- correr enteros cada vez.
--
-- El trato que eso impone, y queda escrito aquí porque es lo único que lo
-- sostiene: **cada archivo de db/ tiene que poder correrse dos veces seguidas
-- sin cambiar el resultado.** `create table if not exists`, `add column if not
-- exists`, `create or replace`, `on conflict do nothing`. Una orden que no
-- aguante repetirse —un `insert` sin conflicto, un `update` que suma en vez de
-- fijar— corrompería los datos en el siguiente despliegue, en silencio.
drop table if exists migracion;
