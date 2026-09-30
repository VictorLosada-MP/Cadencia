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
| `/hecho` | Lo que ya se descargó | Con cuenta |
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

## Qué cuenta como "hecho"

Hecho es **el archivo en la mano**, no la pieza escrita. La fila de `entregado`
se escribe al DESCARGAR, no al generar: una pieza escrita y nunca bajada se
quedó en la pantalla, y contarla convertiría `/hecho` en un inventario de
buenas intenciones.

Tampoco hay columna de "publicado en": el sistema no se conecta a ninguna red y
no puede saberlo. Una casilla de "ya lo subí" que el dueño marca a mano es
pedirle trabajo para alimentar una estadística que no le ayuda a vender.

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

### El paso 3 pregunta QUÉ grabas, no cómo se edita

Había cuatro formatos y dos —"sencillo" y "con producción"— no describían la
grabación sino la EDICIÓN: hablaban de subtítulos, transiciones y "media hora
de edición". Eso le decía al dueño que tenía que grabar distinto según la
opción, cuando se graba igual, y encima duplicaba una elección que ya vive en
el paso 4.

Quedan tres, y solo cambian lo que hace falta de él: **a cámara** (graba
video), **voz en off** (graba solo audio) y **carrusel** (no graba nada). Los
ids viejos siguen resolviendo, porque hay guiones guardados con ellos.

### Voz en off arma el video, no lo pide

Era un fallo de bulto: el formato dice "no sales tú, solo tu voz sobre
imágenes" y el paso 4 le pedía un video — justo lo que ese formato promete que
no va a grabar.

Ahora `filtrosVoz` construye el video **con las imágenes**: cada una ocupa su
tramo con un zoom lento, se encadenan y la voz va entera encima. Si una imagen
falta, se estira la anterior: un video con negro en medio parece roto.

### Lo que se tomó de video-use

[browser-use/video-use](https://github.com/browser-use/video-use) es MIT y hace
lo mismo desde otro sitio: un agente con terminal, ffmpeg de sistema y Python.
No sirve como pieza de aquí —el dueño de un negocio no va a instalar nada— pero
valida el enfoque ("el modelo no ve el video, lo lee") y trae dos cosas
concretas que aquí faltaban:

- **Fundido de 25 ms a cada lado de cada corte.** Sin él la onda salta de golpe
  y se oye un clic en cada empalme. Es el detalle que separa un corte que no se
  nota de uno que suena a tijera.
- **Quitar las muletillas.** El detector de silencios no las quita porque
  SUENAN: un "eh" tiene energía de sobra para pasar cualquier umbral. Se quitan
  por lo que son, y para eso hace falta la transcripción. Solo las que van
  sueltas entre pausas: un "entonces" en mitad de una frase es una conjunción,
  y quitarlo rompe la oración.

### El ritmo sale de medir, no de opinar

Tres reels de referencia (`evidencia/referencias/` en `main`) medidos con
ffmpeg, no mirados por encima:

| | ref1 | ref2 | ref3 | **Cadencia** |
|---|---|---|---|---|
| Un corte cada | 5,1s | 2,9s | 2,0s | **3,0s** |
| Plano mediano | 3,1s | 3,4s | 1,9s | **2,3s** |
| Planos < 3s | 47% | 43% | 83% | **75%** |
| Subtítulo, centro | 63% | 64% | 62% | **63%** |
| Subtítulo, letra | 2,3% | 2,1% | 2,0% | **2,2%** |

El hallazgo que lo cambió todo: **la mayoría de esos cortes no son cortes.**
Son acercamientos sobre la misma toma — la misma grabación, más cerca. Por eso
se pueden hacer con el único video que el dueño sube, y por eso `lib/ritmo.ts`
existe: cambia el encuadre cada 2,6 segundos, siempre en el hueco entre dos
palabras, nunca en mitad de una.

Los tamaños de subtítulo que había antes se eligieron a ojo dos veces seguidas
—primero pequeños, luego el doble de grandes— y las dos veces estaban mal. Los
de ahora salen de medir píxeles en las referencias.

### El sistema edita, no lista tareas

Hubo una temporada en que el editor hacía cortes, 9:16 y subtítulos, y para el
apoyo te daba **una lista de deberes**. Eso convertía "a cámara con producción"
en un formato que costaba más trabajo y entregaba lo mismo que el sencillo.

Ahora el sistema coloca el apoyo solo: `lib/apoyos.ts` casa cada frase del
guion con el segundo en que se dice —usando los tiempos por palabra— y el
editor busca la imagen en el banco y la mete ahí con un zoom lento.

**Solo se le pide material cuando no hay otra.** Cada apoyo del guion lleva
`apoyo_tuyo`, y por defecto es falso. Va en verdadero solo cuando la imagen no
existe en ningún banco porque es suya: una foto con ese cliente, una captura de
sus propios números. Pedirle una foto que podía salir de un banco es trabajo
que se le pasa por no pensarlo nosotros.

### Los dos niveles de edición

Se eligen en el paso 4, **no en el 3**: cómo te grabaste no debería decidir
cuánto se edita. El guion de video siempre trae el apoyo; el editor decide qué
hace con él.

| | Base | Completa |
|---|---|---|
| Cortes, 9:16, subtítulos, apoyo | ✓ | ✓ |
| Transiciones con sonido entre bloques | — | ✓ |

**Las transiciones van entre BLOQUES del guion, no en cada corte de silencio.**
Un corte de silencio tiene que ser invisible: señalarlo con un efecto delata
cada respiración que se quitó, y en un reel de treinta segundos serían quince.
Los bloques son tres o cuatro.

El efecto de sonido se **sintetiza** en `lib/sonido.ts` — un whoosh es ruido
filtrado con una envolvente, y son treinta líneas. No es por gusto: un banco de
efectos mete la licencia de un tercero dentro de los videos del dueño, y si
mañana cambia sus términos el problema es de él, que ya publicó.

Sobre el destello: se hace con `drawbox` y `enable`, no con `fade`. `fade=in`
deja en blanco **todo lo anterior** a su arranque, así que un destello a mitad
del video lo blanqueaba entero. Se descubrió mirando los fotogramas.

### Los subtítulos: se corrigen y se mueven

Tres modos, y no son tres decoraciones: son tres formas distintas de sostener
la mirada. *Palabra a palabra* (la línea entera se ve y cada palabra se
enciende cuando se dice), *una sola palabra* (grande y centrada, la que más
engancha y la que más cansa) y *línea de golpe*.

Se hace con etiquetas dentro de la propia línea del ASS —un evento por
palabra— y no con karaoke `\k`: `\k` depende de que el reproductor lo
entienda, y aquí el reproductor es libass quemando píxeles.

**Cada línea se puede corregir a mano**, porque la transcripción se come
palabras. Si el número de palabras no cambia se conservan sus tiempos; si
cambia, el tiempo de la línea se reparte según lo que ocupa cada palabra. Las
correcciones se guardan por el SITIO de la palabra en la transcripción, no por
su tiempo: así mover los deslizadores de silencio no las borra.

### Ningún corte parte una palabra

Era la causa de "se come palabras". El detector mira la onda y no sabe qué es
una palabra: el arranque de una ese suave queda por debajo del umbral, el corte
entra ahí, y en el video se oye media palabra que además pierde su subtítulo
porque su tiempo cayó dentro del trozo quitado.

Con la transcripción hecha ya se sabe dónde empieza y acaba cada palabra, y
`protegerPalabras` estira los tramos hasta el borde de la palabra antes de
cortar. Por eso conviene transcribir **antes** de montar.

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
