-- Migración 16 — la foto, el arroba y la cuadrícula, guardados.
--
-- Hasta aquí ninguna captura se guardaba: de la del perfil se sacaban las
-- casillas y se soltaba, y de la cuadrícula se sacaban los tres colores y se
-- soltaba. Para los colores eso bastaba —la paleta es el producto de la
-- captura y sí se guarda, así que entrar desde otro teléfono no perdía nada—,
-- pero deja de bastar en cuanto la lámina lleva su cara encima.
--
-- Un carrusel con marca de agua necesita su FOTO DE PERFIL y su ARROBA en cada
-- lámina. Eso no se puede derivar de nada ni volver a pedir en cada sesión: o
-- se guarda, o el mismo cliente genera láminas firmadas en su computador y sin
-- firmar en su teléfono.
--
-- Qué se guarda y qué no, que no es lo mismo:
--
--   · La foto de perfil y el arroba — SÍ. Son su marca, los pone él a
--     propósito y van impresos en lo que publica.
--   · La cuadrícula — SÍ, reducida. Son sus propias publicaciones, que ya son
--     públicas, y tenerla permite enseñarle de qué captura salieron sus
--     colores y releerla desde otro aparato.
--   · La captura del PERFIL del diagnóstico — NO, y sigue sin guardarse. En
--     esa salen mensajes y datos de terceros; de ahí se sacan las casillas,
--     que es texto que él revisa, y la imagen se suelta. La diferencia no es
--     el formato: es de quién es lo que sale dentro.
--
-- Se guardan en base64 y con tope, como `entregado.portada`. El tope no es
-- decoración: sin él esta columna es un disco duro con otro nombre.

alter table negocio add column if not exists handle     text not null default '';
alter table negocio add column if not exists avatar     text not null default '';
alter table negocio add column if not exists cuadricula text not null default '';

-- 100 caracteres de arroba. El más largo de Instagram son 30.
alter table negocio drop constraint if exists negocio_handle_corto;
alter table negocio add constraint negocio_handle_corto check (length(handle) <= 100);

-- La foto va a 320 píxeles de lado y la cuadrícula a 480 de ancho: con eso una
-- ronda los 30.000 caracteres y la otra los 100.000. Los topes dejan sitio de
-- sobra y a la vez impiden que alguien suba aquí un archivo de diez megas.
alter table negocio drop constraint if exists negocio_avatar_cabe;
alter table negocio add constraint negocio_avatar_cabe check (length(avatar) <= 60000);

alter table negocio drop constraint if exists negocio_cuadricula_cabe;
alter table negocio add constraint negocio_cuadricula_cabe check (length(cuadricula) <= 200000);

comment on column negocio.avatar is
  'Su foto de perfil en base64, reducida en el navegador. Va impresa en las láminas del carrusel.';
comment on column negocio.cuadricula is
  'La captura de su cuadrícula, reducida. De ella salieron paleta_*; se guarda para poder enseñarla y releerla desde otro aparato.';
