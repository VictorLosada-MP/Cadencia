-- Migración 2 — lo que le escriben.
--
-- La Función 2 necesita saber en qué escalón de conciencia está la audiencia, y
-- la señal más fiable es lo que la gente le pregunta: nadie pregunta desde un
-- escalón que no es el suyo.
--
-- Va en el negocio y no en la pantalla de la semana porque no cambia cada
-- semana, y porque escribirlo dos veces es justo lo que hace que un formulario
-- se sienta de piedra.

alter table negocio add column if not exists senales text not null default '';
