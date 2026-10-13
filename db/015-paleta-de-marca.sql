-- Migración 15 — los colores de su marca.
--
-- La carátula del video y las láminas del carrusel salían con la misma paleta
-- para todo el mundo: blanco con amarillo fijo. Así la pieza no se parecía a lo
-- que esa cuenta ya publica, que es justo lo que tiene que hacer una portada.
--
-- Y los colores que esa cuenta ya usa están a la vista en su cuadrícula. Se
-- leen de los píxeles en el navegador —contar colores es aritmética, no una
-- opinión— y lo único que llega aquí son tres cadenas de siete caracteres.
--
-- LA CAPTURA NO SE GUARDA, ni aquí ni en ningún sitio. Es la misma regla que
-- ya tenía el diagnóstico: de una captura del teléfono se saca el dato y se
-- suelta la imagen. Tres columnas de texto, no una de bytes, y por eso esta
-- tabla no crece con el uso.
--
-- Tres columnas y no un jsonb: son tres valores con nombre y forma fija, el
-- `check` los puede vigilar, y se leen en un `select` sin desenvolver nada.

alter table negocio add column if not exists paleta_fondo  text not null default '';
alter table negocio add column if not exists paleta_tinta  text not null default '';
alter table negocio add column if not exists paleta_acento text not null default '';

-- Vacío o un color de verdad, nada entre medias. Sin esto, media paleta
-- guardada pintaría una lámina con un color y el resto con los de por
-- defecto, que es peor que no tener paleta propia.
alter table negocio drop constraint if exists negocio_paleta_valida;
alter table negocio add constraint negocio_paleta_valida check (
  (paleta_fondo = '' and paleta_tinta = '' and paleta_acento = '')
  or (paleta_fondo  ~ '^#[0-9A-Fa-f]{6}$'
  and paleta_tinta  ~ '^#[0-9A-Fa-f]{6}$'
  and paleta_acento ~ '^#[0-9A-Fa-f]{6}$')
);

comment on column negocio.paleta_fondo is
  'Los tres colores de su marca, leídos de su cuadrícula en el navegador. Vacíos = usa las paletas de por defecto. La captura de la que salieron no se guarda.';
