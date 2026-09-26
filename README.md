# Cadencia

Sistema de contenido para dueños de negocio que ya venden.

Cuatro estaciones que se pasan una pieza: se diagnostica, se arma la semana,
se escribe el guion, se entrega la pieza publicable. Lo que se publica vuelve
al diagnóstico y alimenta la semana siguiente.

No es un menú de herramientas. La salida de cada función es la entrada de la
siguiente — esa es la diferencia entre un sistema y una colección de utilidades.

## Las cuatro funciones

| | Función | Devuelve |
|---|---|---|
| 1 | Diagnóstico | La brecha nombrada, con su umbral y la corrección ya escrita |
| | | Hasta dos redes, y qué cambia entre una y otra |
| 2 | Banco de la semana | Cinco piezas que suben a tu audiencia un escalón, con el guion de respuesta |
| 3 | La pieza | Guion de video o carrusel — lo que toque ese día |
| 4 | Lista para subir | Las láminas del carrusel dibujadas y listas. El editor de video, en curso |

Las cuatro leen un único **Perfil de Negocio** de seis campos, que el usuario
llena una vez. Ninguna función pide dos veces el mismo dato.

## Dos públicos, una máquina

- **Cliente del servicio** — el perfil llega precargado; entra por el banco semanal
- **Quien llega de internet** — llena seis campos, sube una captura de su perfil,
  y recibe el diagnóstico con las correcciones escritas

Después del primer minuto usan exactamente el mismo sistema.

## Estructura

```
docs/       los apuntes propios y el reglamento que sale de ellos
prompts/    las instrucciones de cada función
perfiles/   perfiles de prueba
evidencia/  capturas del teardown
```

## Correr el proyecto

```bash
npm install
cp .env.example .env.local        # rellénalo: el propio archivo explica cada valor
npm run secreto                   # genera BETTER_AUTH_SECRET y lo imprime
npm run comprobar                 # dice qué falta, sin imprimir ninguna clave
npm run migrar                    # crea las tablas
npm run comprobar                 # ahora tiene que salir todo en ok
npm run dev
```

`npm run comprobar` es el atajo cuando algo no arranca: comprueba la forma de
cada valor, se conecta a la base y te dice si faltan tablas.

`npm run migrar` aplica lo que haya en `db/` y lleva la cuenta de lo aplicado,
así que se puede correr las veces que haga falta. No necesita `psql` instalado.

Abre http://localhost:3000, crea tu cuenta, llena tu negocio una vez, sube una
captura de tu perfil o escribe las casillas, y dale a Diagnosticar.

### La base de datos

Postgres a secas — sirve Supabase, Neon o uno propio. El código habla SQL plano
con el driver `pg`: sin cliente del proveedor y sin extensiones propietarias,
mudarse es cambiar `DATABASE_URL` y nada más.

En Supabase está en el botón **Connect**, arriba del proyecto → pestaña
**Connection string** → **Transaction pooler**. Empieza por `postgresql://` y
lleva `[YOUR-PASSWORD]`, que hay que cambiar por la contraseña de la base.

No confundir con `https://xxxx.supabase.co`: esa es la dirección de la API y no
sirve para conectarse a Postgres.

### Fotos de archivo

Opcional. Con una clave de **Pexels** —gratis, sin tarjeta, en pexels.com/api—
el carrusel busca fotos con la descripción que escribió el propio sistema. Sin
ella, se ponen fotos propias o las láminas van solo con texto.

No genera imágenes: busca entre las que ya existen. Generar es otro proveedor y
cuesta por lámina.

### Planes y cortesías

```bash
npm run cortesia                            # quién tiene qué plan y cuánto gastó
npm run cortesia -- cliente@x.com cadencia  # se lo regalas
npm run cortesia -- cliente@x.com quitar    # lo dejas en su plan, sin borrar nada
```

Se limita por **corridas al mes**. El contador no es una columna: se cuenta la
tabla de corridas, que solo recibe fila cuando una corrida termina bien — así un
error del sistema no gasta cuota, por construcción.

La cortesía apunta a un plan real, no es un plan aparte: si cambias lo que
incluye Cadencia, las cortesías con Cadencia cambian solas.

### Si no puedes entrar

```bash
npm run clave                      # lista las cuentas de tu base
npm run clave -- tu@correo.com     # le pone una contraseña nueva
```

Es la llave maestra del dueño de la base. Dentro de la app hay recuperación por
correo: pide el enlace en *olvidé mi contraseña*. **Sin proveedor de correo
configurado el enlace se imprime en la terminal** donde corre `npm run dev` — en
local es suficiente; para abrir al público hace falta un proveedor.

### Las cuentas

Son cuentas de Cadencia, con su correo y su contraseña. **Aquí no se pide ni se
guarda ninguna credencial de Instagram, TikTok ni de ninguna red**, y no se va a
pedir nunca — ni el sistema entra a ninguna red por su cuenta. Las capturas las
toma el dueño desde su propio teléfono, donde ya tiene su sesión abierta.

**Sirve la clave de OpenAI o la de Anthropic** — la que tengas. El sistema usa
la que encuentre; si están las dos, gana Anthropic, o fuerzas una con
`PROVEEDOR=openai`.

### ¿Qué modelo pongo?

```bash
npm run modelos
```

Lista los modelos que tu clave puede usar. Copia uno a `MODELO_OPENAI` (o
`MODELO_ANTHROPIC`) en `.env.local`. No adivines: pregúntale a tu propia clave.

### Sobre las claves

Van solo en `.env.local`, que git ignora. Nunca en un mensaje, un chat o un
commit — una clave que se ve una vez ya está comprometida y hay que anularla
desde el panel del proveedor.

## Estado

| | |
|---|---|
| Mapa del producto de referencia | cerrado — 11 módulos, 17 capturas |
| Arquitectura y datos mínimos | definidos |
| Perfil de prueba | completo |
| **Función 1 — diagnóstico** | **funcionando** |
| Cuentas y Perfil de Negocio en base de datos | migración 1, hecha |
| Historial y comparación entre fechas | hecho |
| Planes, cuota y cortesías | hecho |

| **Función 2 — banco semanal** | **funcionando** |
| **Función 3 — guion** | **funcionando** |
| **Función 4 — carrusel** | **funcionando** |
| Función 4 — editor de video | en curso |

## Cómo está armado

- `prompts/*.md` — cada función es un archivo de texto, editable sin tocar código
- `prompts/2-banco.md` — la semana, sobre los cinco niveles de conciencia
- `prompts/3-ganchos.md` y `prompts/3-guion.md` — la idea afilada y tres ganchos
  primero; el guion después, alrededor del elegido
- `prompts/0-transcripcion.md` — el paso que convierte una captura en casillas,
  separado a propósito: el diagnóstico corre sobre lo que el dueño confirma,
  nunca sobre una imagen
- `perfiles/*.json` — los datos de cada negocio; el sistema no los lleva dentro
- `lib/modelo.ts` — la única capa que habla con un proveedor de IA
- `lib/db.ts` — la única capa que sabe dónde viven los datos
- `lib/pieza.ts` — los chequeos mecánicos, funciones puras sin red ni servidor
- `lib/auth.ts` — cuentas de Cadencia, en el mismo Postgres
- `lib/perfil.ts` — carga los prompts y arma el perfil que lee el modelo
- `app/api/*/route.ts` — una ruta por función

Cambiar cómo diagnostica es editar un `.md`, no recompilar nada.
Cambiar de proveedor de IA es cambiar una variable de entorno.

## Nombre

*Cadencia* — el dolor del cliente es improvisar; la cura es publicar con ritmo.
El nombre apunta al resultado, no a la herramienta.
