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
| 2 | Banco de la semana | Piezas con día asignado y guion de respuesta al mensaje |
| 3 | Guion | Golpes con dirección actoral, cierre y cómo grabarlo |
| 4 | Pieza publicable | 9:16, subtítulos, silencios cortados |

Las cuatro leen un único **Perfil de Negocio** de seis campos, que el usuario
llena una vez. Ninguna función pide dos veces el mismo dato.

## Dos públicos, una máquina

- **Cliente del servicio** — el perfil llega precargado; entra por el banco semanal
- **Quien llega de internet** — llena seis campos, sube una captura de su perfil,
  y recibe el diagnóstico con las correcciones escritas

Después del primer minuto usan exactamente el mismo sistema.

## Estructura

```
docs/       teardown, planos, reglamento y material propio clasificado
prompts/    las instrucciones de cada función
perfiles/   perfiles de prueba
evidencia/  capturas del teardown
```

## Correr el proyecto

```bash
npm install
cp .env.example .env.local   # y pega tu clave
npm run dev
```

Abre http://localhost:3000, pega tu perfil y dale a Diagnosticar.

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
| Función 2 — banco semanal | prompt pendiente |
| Función 3 — guion | prompt pendiente |
| Función 4 — pieza publicable | espera el criterio de publicable |

## Cómo está armado

- `prompts/*.md` — cada función es un archivo de texto, editable sin tocar código
- `perfiles/*.json` — los datos de cada negocio; el sistema no los lleva dentro
- `lib/modelo.ts` — la única capa que habla con un proveedor de IA
- `lib/perfil.ts` — carga perfil y prompt en tiempo de ejecución
- `app/api/*/route.ts` — una ruta por función

Cambiar cómo diagnostica es editar un `.md`, no recompilar nada.
Cambiar de proveedor de IA es cambiar una variable de entorno.

## Nombre

*Cadencia* — el dolor del cliente es improvisar; la cura es publicar con ritmo.
El nombre apunta al resultado, no a la herramienta.
