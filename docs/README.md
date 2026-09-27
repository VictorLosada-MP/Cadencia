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

## Pendientes

- El teardown del producto de referencia y los planos siguen fuera del
  repositorio. Se traen cuando se toquen.
- La Función 4 espera el criterio de publicable, que no sale de ningún análisis:
  sale de grabar y editar un video y anotar qué se revisó.
- El cobro automático no está conectado. La portada lo dice tal cual en vez de
  poner un botón de pago que no cobra.
- El editor de video de la Función 4 —9:16, cortar silencios, quemar
  subtítulos— es lo siguiente.
