-- Migración 14 — quién es el negocio, y la prueba como una pasada entera.
--
-- Dos cosas que venían mal y que resultaron ser la misma: el sistema no sabía
-- a quién estaba mirando.
--
-- ── 1. Empresa o persona ────────────────────────────────────────────────────
--
-- `negocio.nombre` existía desde la migración 1 y no se pedía en ninguna
-- pantalla: estaba en blanco en todas las cuentas. El diagnóstico, que juzga
-- el nombre del perfil como su primer punto, lo hacía entonces a ciegas — y
-- juzgar a ciegas aquí no es un detalle, porque la corrección cambia por
-- completo según el caso:
--
--   · Una EMPRESA ya tiene nombre registrado. Proponerle otro no es una
--     corrección, es pedirle que cambie su razón social, su dominio y su
--     facturación por un punto de un diagnóstico. Lo que se corrige es lo que
--     va al lado del nombre, nunca el nombre.
--   · Una MARCA PERSONAL se llama como se llama su dueño, y ahí sí la
--     corrección real es añadir la palabra por la que lo buscarían.
--
-- Sin esta columna las dos salían con la misma reprimenda.
--
-- No se parte en dos columnas (`nombre_empresa` y `nombre_persona`) porque un
-- negocio tiene UN nombre con el que se le encuentra; lo que cambia es de qué
-- clase es. Dos columnas obligarían a decidir cuál mostrar en cada pantalla y
-- dejarían la otra muerta en el 100% de las filas.

alter table negocio add column if not exists tipo text not null default '';

-- Vacío a propósito: es «todavía no lo dijo», que no es lo mismo que empresa.
-- El prompt lo distingue y, cuando está vacío, no juzga el nombre.
alter table negocio drop constraint if exists negocio_tipo_valido;
alter table negocio add constraint negocio_tipo_valido
  check (tipo in ('', 'empresa', 'persona'));

-- ── 2. La prueba: una pasada, no una corrida ────────────────────────────────
--
-- La prueba traía `corridas_total = 1`: UNA corrida en toda la vida de la
-- cuenta, contra la tabla entera sin mirar de qué función venía. El efecto
-- real, medido: el diagnóstico se la gastaba y la cuenta no llegaba nunca a la
-- semana, a la pieza ni al montaje. Es decir, la prueba no probaba el producto;
-- probaba la primera pantalla.
--
-- Lo correcto es una pasada completa y que se cierre: una corrida de CADA
-- función. Por eso la columna es por función y no un total — con un total de
-- tres, nada impide gastar las tres en diagnósticos y volver a quedarse sin
-- ver el resto.
--
-- `corridas_total` se queda en la tabla: sigue siendo la forma de expresar un
-- plan de por vida, y quitarla para volver a añadirla el día que haga falta no
-- es simplificar.

alter table plan add column if not exists corridas_funcion integer;

comment on column plan.corridas_funcion is
  'Límite por función (1 diagnóstico, 2 semana, 3 pieza). Es la prueba: una pasada entera y se cierra. null cuando el plan se mide al mes o de por vida.';

update plan
   set corridas_funcion = 1,
       corridas_total   = null
 where id = 'prueba';
