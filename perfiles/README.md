# Perfil de Negocio

El objeto raíz del sistema. Se llena una vez y lo leen las cuatro funciones,
sin excepción. Ninguna vuelve a pedir un dato que ya está aquí.

## Núcleo — seis campos, obligatorios

Es lo único que el usuario tiene que llenar para empezar. Diez minutos.

| Campo | Pregunta | Por qué está |
|---|---|---|
| `oferta` | ¿Qué vendes? | Sin esto todo sale genérico |
| `cliente` | ¿A quién le sirve? | Decide a quién le habla cada pieza |
| `freno` | ¿Qué lo detiene hoy? | Es la materia prima de los ganchos |
| `despues` | ¿Cómo queda después de trabajar contigo? | Es el cierre de toda pieza |
| `voz` | Pega 3–4 líneas **que hayas escrito tú** | Muestra, no etiqueta — ver abajo |
| `accion` | ¿Qué quieres que hagan? | El CTA que cierra cada pieza |

## `voz` es una muestra, no una lista de tonos

Describir el tono con adjetivos produce seis sabores del mismo texto de
infoproducto. Una muestra real produce la voz de una persona.

Sirve cualquier cosa escrita por el dueño en registro natural: un audio
transcrito, un mensaje que le mandó a un cliente, cómo se lo explicaría a un
amigo. Sin editar para que suene bien — justamente sin editar.

**La Función 3 no genera guion con este campo vacío.** Es a propósito: con el
mejor input posible pero sin voz propia, la salida es competente y de nadie.

## Enriquecimiento — opcional

El sistema funciona con los seis campos. Funciona mejor con esto:

| Campo | Qué aporta |
|---|---|
| `objeciones` | Las frases literales del cliente antes de comprar |
| `preguntas_frecuentes` | Lo que preguntan siempre |
| `miedo_no_dicho` | El que no dicen en voz alta — materia prima de ganchos |
| `frustraciones_diarias` | El dolor concreto, día a día |
| `intentos_fallidos` | Qué ya probaron y no funcionó |
| `mitos_industria` | Alimenta el ángulo “contra la corriente” |
| `diferenciador` | Por qué él y no otro |

Pedirlos todos de entrada rompe el onboarding de diez minutos. Por eso son
opcionales, y por eso el sistema mejora a medida que el usuario da más.

## `no_representa` — el espacio negativo

Lo que la marca **no** es resulta tan definitorio como lo que sí. Es lo que
más rápido separa una pieza propia de un texto genérico, y casi nadie lo
escribe.

## Perfiles en esta carpeta

- `victor.json` — perfil de prueba, construido desde el dossier de negocio.
  Sirve además como caso del público B: no tiene contenido publicado, así que
  valida la puerta de entrada por diagnóstico de perfil.
