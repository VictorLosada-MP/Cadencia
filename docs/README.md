# Documentos

El material de diseño, en el repositorio y no en páginas sueltas: aquí se lee,
se versiona y se corrige.

| | Documento | Qué responde |
|---|---|---|
| 01 | [`apuntes.md`](apuntes.md) | Qué material propio alimenta cada función |
| 02 | [`reglamento.md`](reglamento.md) | Cómo decide cada función |

## Orden de lectura

`apuntes` → `reglamento`. Los apuntes son la fuente; el reglamento es lo que se
programó a partir de ellos. **Cuando se contradigan, mandan los apuntes** — son
material de vender, no de analizar.

## De dónde salen los prompts

| Prompt | Se apoya en |
|---|---|
| `prompts/0-transcripcion.md` | Reglas transversales: solo existe lo que se ve, datos personales |
| `prompts/1-diagnostico.md` | Reglamento · Función 1, más las reglas transversales |
| `prompts/2-banco.md` | Apuntes · correcciones 1, 3, 4 y 5 · Reglamento · Función 2 |
| `prompts/3-ganchos.md` | Reglamento · reglas 3·1, 3·3 y 3·5 |
| `prompts/3-guion.md` | Reglamento · Función 3 · Apuntes · guía de grabación y fórmula del valor |
| `prompts/3-carrusel.md` | Apuntes · fórmula del valor · reglas transversales |

Cambiar cómo decide una función es editar su `.md`. Este documento dice **por
qué** decide así, que es lo que no cabe dentro del prompt.

## El mapa de pantallas

Las cuatro funciones son estaciones de una cadena, y las rutas lo dicen en el
mismo orden en que se usan. El negocio no es una estación: es contra lo que
corren las cuatro, así que tiene pantalla propia y no vive dentro de ninguna.

| Ruta | Qué es | Quién entra |
|---|---|---|
| `/` | Portada: qué es, para quién, las cuatro funciones, los planes | Cualquiera |
| `/planes` | El plan en vigor y a qué se puede pasar | Cualquiera; con cuenta marca el suyo |
| `/entrar` | Entrar, crear cuenta, pedir clave nueva | Cualquiera |
| `/negocio` | El Perfil de Negocio: oferta, cliente, después, voz | Con cuenta |
| `/diagnostico` | Función 1 | Con cuenta |
| `/semana` | Función 2 | Con cuenta |
| `/pieza` | Función 3 | Con cuenta |
| `/publicar` | Función 4 | Con cuenta |

Los precios y los límites de `/` y `/planes` se leen de la tabla `plan`, no de
una copia escrita en la página: si se cambia un precio por SQL y aquí hubiera
una copia a mano, la página de precios empezaría a mentir ese mismo día.

Lo que se anuncia en esos planes es **solo lo que el código cobra**, que hoy son
las corridas. `plan.negocios` y `plan.historial_meses` existen como columnas y
todavía no los hace cumplir nadie: hasta que los haga cumplir alguien, no se
ponen en una página de precios.

## El editor de video

Vive en `/publicar` cuando lo último que se escribió es un guion. Corta los
silencios, recorta a 9:16 y quema los subtítulos, y devuelve un MP4 H.264 +
AAC, que es lo que aceptan Reels y TikTok sin volver a comprimir.

**Todo corre en el navegador menos una cosa**, y esa cosa está señalada en la
pantalla donde se decide, no en la letra pequeña: los subtítulos mandan el
audio —solo el audio, ya bajado a mono y a 16 kHz, nunca el video— a
transcribir. El montaje entero funciona sin pasar por ahí.

| Pieza | Dónde | Qué hace |
|---|---|---|
| `lib/audio.ts` | navegador | Decodifica una vez: de ahí salen la onda y el WAV |
| `lib/silencios.ts` | navegador | RMS por ventana de 20 ms, umbral, tramos |
| `lib/subtitulos.ts` | navegador | Palabras → líneas → ASS |
| `lib/video.ts` | navegador | ffmpeg.wasm: medir, sacar audio, montar |
| `app/api/voz` | servidor | Whisper con tiempos por palabra |

### Por qué ffmpeg.wasm y no WebCodecs

WebCodecs codifica con el hardware y sería mucho más rápido. Pero en este
entorno **no se puede comprobar**: el Chromium que se usa para probar no trae
H.264 ni AAC, así que un camino de WebCodecs se habría subido sin una sola
ejecución real detrás. ffmpeg.wasm corre igual en todas partes y se probó de
punta a punta. Cuando haya con qué comprobarlo, WebCodecs es la vía rápida y
ffmpeg.wasm se queda de respaldo.

Es la versión de **un solo hilo** a propósito: la de varios necesita
SharedArrayBuffer, que obliga a poner cabeceras COOP/COEP en todo el sitio —
y esas cabeceras romperían las fotos de Pexels del carrusel, que vienen de
otro dominio.

El núcleo son 32 MB y **no está en el repositorio**: `scripts/ffmpeg.mjs` lo
copia de `node_modules` a `public/ffmpeg/` al instalar y al construir. Se
sirve desde ahí y no desde un CDN porque cargarlo de unpkg ataría el producto
a que un tercero siga publicándolo.

### Los dos caminos de iPhone

Los iPhone graban en HEVC cuando están en "Alta eficiencia", y Chrome en
escritorio no siempre sabe decodificar eso. Sin arreglo, un video de iPhone
perdía **las dos cosas que valen de este editor**: ni se medía ni se le sacaba
el audio, así que ni cortes ni subtítulos.

Por eso hay dos respaldos, los dos comprobados con un MOV/HEVC de verdad:
`medirConMotor` saca ancho, alto y duración de lo que ffmpeg escribe por
consola, y `extraerAudio` saca el audio a WAV, que sí abre cualquier navegador.
Lo único que se pierde es la vista previa, y la pantalla lo dice.

### Los subtítulos no gastan una corrida

Es una decisión, no un olvido. Una corrida es el sistema **escribiendo** algo;
transcribir copia lo que el dueño ya dijo y cuesta dos órdenes de magnitud
menos. Cobrarlo como corrida se comería de un golpe la única que trae el plan
de prueba. El tope va aparte, en `uso_voz`: veinte minutos de audio al día por
negocio, que es lo que se corresponde con el cargo real.

## El movimiento

Está todo en `app/globals.css` y son cinco clases: `entra` / `entra-lado` /
`entra-caja` (animación CSS pura, entra al cargar), `revela` (espera a que la
mires, la enciende `app/revela.tsx` con un IntersectionObserver), `empuja` y
`tarjeta` (responden al ratón), `deriva` y `late` (el fondo).

Sin librería de scroll: son unas líneas de JavaScript, no añaden un kilo a una
portada y no atan el producto a que alguien siga manteniendo su paquete.

Nada dura más de un segundo ni se mueve más de 24px. Y hay tres salidas para
que el texto no dependa nunca de que la animación corra:

- `prefers-reduced-motion` apaga todo **dejando el contenido visible**
- sin `IntersectionObserver`, `revela` enciende todo de golpe
- sin JavaScript, un `<noscript>` en el layout hace lo mismo

## Pendientes

- El teardown del producto de referencia y los planos siguen fuera del
  repositorio. Se traen cuando se toquen.
- La Función 4 espera el criterio de publicable, que no sale de ningún análisis:
  sale de grabar y editar un video y anotar qué se revisó.
- El cobro automático no está conectado. La portada lo dice tal cual en vez de
  poner un botón de pago que no cobra.
- El editor de video de la Función 4 —9:16, cortar silencios, quemar
  subtítulos— es lo siguiente.
