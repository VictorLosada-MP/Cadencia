-- Migración 17 — lo que vende, en detalle. Y fuera los textos pegados.
--
-- ── 1. El detalle de la oferta ──────────────────────────────────────────────
--
-- `oferta` es una frase: «café de finca tostado para tiendas». Con eso basta
-- para un diagnóstico de perfil, y no basta para escribir una pieza. Medido con
-- un caso real: al elegir un gancho, el sistema devolvía
--
--     «El perfil no especifica las características de cada variedad tostada»
--     «No se conoce qué formatos o cantidades de compra ofrece la empresa»
--
-- y tenía razón las dos veces. El problema no era el prompt: era que NO HABÍA
-- DÓNDE ponerlo. Pedir un dato que no tiene casilla deja al dueño mirando una
-- pantalla sin saber qué hacer, que es justo lo que ya prohíbe la regla de los
-- límites del diagnóstico.
--
-- Esta es esa casilla. Es un texto libre a propósito: las variedades de un
-- café, los tamaños de un taller y los planes de un servicio no caben en el
-- mismo formulario, y un formulario que los fuerce acaba sin llenarse.

alter table negocio add column if not exists detalle text not null default '';

comment on column negocio.detalle is
  'Lo que vende, en detalle: variedades, formatos, cantidades, planes, precios. Texto libre. Es lo que impedía escribir una pieza concreta cuando solo había una frase de oferta.';

-- ── 2. Fuera los textos de «lo que ya publicaste» ───────────────────────────
--
-- Nunca hubo columna para ellos —viajaban en la corrida y nada más— pero sí
-- quedaron dentro de `corrida.entrada`, y ahí es donde hay que quitarlos: era
-- la mitad que el dueño no entendía para qué servía, duplicaba «Cómo hablas»
-- del perfil, y el botón de «usar esto como cómo hablas» pisaba un campo que
-- él ya había llenado a mano.
--
-- Se queda la CUADRÍCULA, que es la que da ritmo, formato y temas, y de la que
-- salen además los colores de su marca.
--
-- Se reescribe el jsonb en vez de borrar la corrida: el diagnóstico de ese día
-- sigue siendo válido, lo que sobra es el dato de entrada.

update corrida
   set entrada = entrada #- '{publicado,textos}'
 where entrada -> 'publicado' ? 'textos';
