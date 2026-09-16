# Reglamento de las funciones

La arquitectura dice qué entra y qué sale. Esto dice **cómo decide**: umbrales
exactos, orden de prioridad, qué hacer sin datos, y las reglas que no se rompen.

Las marcadas 🐞 salen de defectos observados en el producto de referencia: no son
teoría, son errores que ya vimos romper la confianza en algo real.

Los umbrales son valores de arranque, no verdad revelada. Lo que no se ajusta es
el **orden** en que se muestran: eso es una decisión de producto.

> Cinco reglas de este documento fueron corregidas por el material propio. Ver
> [`apuntes.md`](apuntes.md) — las correcciones mandan sobre lo que dice aquí.

---

## Función 1 — Diagnóstico

### Modo perfil

Entra el perfil más el Perfil de Negocio. Cinco puntos, en orden de impacto en
conversión, no de aparición en pantalla.

| | Punto | Pasa si |
|---|---|---|
| 1 | **Nombre** | Lleva una palabra que alguien buscaría. El campo se indexa; un nombre propio solo no aparece en ninguna búsqueda. |
| 2 | **Primera línea** | Nombra al cliente *o* su problema. Si abre hablando de él y no de quien lee, no pasa. |
| 3 | **Promesa** | Dice el resultado, no la actividad. |
| 4 | **CTA** | Dice qué pasa después de tocar. |
| 5 | **Link** | El texto que lo acompaña le da una razón al clic. |

Pasa o no pasa, sin medias tintas: un "parcial" no se puede corregir.

> **No hay puntaje.** El 0-100 se quitó: un número generado a juicio no es
> comparable entre dos corridas. Lo comparable es cuántos puntos pasan.

### Modo pieza *(pendiente — necesita las métricas)*

| | Ratio | Cálculo | Por qué ahí |
|---|---|---|---|
| 1 | **Conversión** | seguidores_nuevos ÷ alcance | El único que dice si alguien se acercó al negocio |
| 2 | Retención | tiempo_medio ÷ duración | Dice si el mensaje llegó completo |
| 3 | Guardados | guardados ÷ reproducciones | Intención de volver: utilidad real |
| 4 | Compartidos | compartidos ÷ reproducciones | Recomendación activa |
| 5 | Me gusta | me_gusta ÷ reproducciones | El más barato de dar. Va último a propósito. |

Los umbrales son **relativos al propio histórico** desde la tercera pieza medida
(corrección 2 de los apuntes), y absolutos solo mientras no haya historial.

**Dónde se cayó — se calcula, no se narra:**

```
r = tiempo_medio ÷ duración

r < 0,25      → la caída fue el GANCHO       (primeros 3 segundos)
0,25 – 0,60   → la caída fue el DESARROLLO   (el medio)
r > 0,60      → llegaron al final: el problema es el CIERRE

Se nombra UNA zona. Nunca dos.
```

### Reglas duras

| | |
|---|---|
| **1·1** 🐞 | Un ratio por encima de su umbral se muestra en verde. Siempre. *ViralADN marcó en rojo el único que había pasado y tres líneas abajo escribió "el gancho fue efectivo". Un semáforo que se contradice tira abajo las otras cuatro filas.* |
| **1·2** 🐞 | La zona de caída sale de la fórmula y se nombra una sola. *ViralADN escribió "el desarrollo · a los 3 segundos" sobre un video de 25s. El segundo 3 es el gancho.* |
| **1·3** 🐞 | La salida no contiene verbos de consejo — *mejorar, asegurarse, incluir, optimizar*. Devuelve el texto ya corregido. Si no puede producir la corrección, oculta el punto. |
| **1·4** | Sin estadísticas corre solo el modo perfil, y lo dice. |
| **1·5** | Con menos capturas de las pedidas usa lo que hay y nombra qué no pudo calcular. Nunca estima un número que no vio. |
| **1·6** | Pieza con menos de 72 horas: avisa que los números todavía se mueven. |
| **1·7** | Lo ya publicado es **línea base, no examen**. No se evalúa, no se corrige, no se sugiere borrar. |
| **1·8** | Un campo que no se pudo leer va como no visible y **no cuenta como fallo**. Un campo que no existe en esa plataforma va como no aplica. |

---

## Función 2 — Banco de piezas de la semana

Entra el Perfil de Negocio más las señales de qué le escriben. Sale la semana.

> **El eje son los cinco niveles de conciencia**, no un reparto de ángulos.
> Ver corrección 1 en [`apuntes.md`](apuntes.md).

Los ángulos, con su peso de mercado observado:

| Ángulo | Nivel | Peso | Sirve para |
|---|---|---|---|
| Enseñanza directa | N1 | 35% | Alcance |
| Contra la corriente | N0 | 30% | Alcance |
| Lista numerada | N1 | 20% | Guardados |
| La pregunta que duele | N0 | 11% | **Conversación** |
| Proceso | N2 | poco usado | Conversación |
| El error caro | N2 | poco usado | **Conversación** |
| Historia personal | N3 | 1% | **Conversación** |
| Prueba social | N3 | — | Conversación |
| Invitación a aplicar | N4 | — | Conversación |

### Reglas duras

| | |
|---|---|
| **2·1** | Cinco ángulos **distintos**. *Cinco variaciones del mismo ángulo son un solo contenido repetido cinco veces.* |
| **2·2** | El peso de la semana va donde está la brecha detectada, no repartido en partes iguales. |
| **2·3** | El peso de mercado se muestra al usuario, incluido el hueco. *Un ángulo al 1% no es malo: es espacio vacío. En la prueba real, esa etiqueta fue lo que decidió la elección.* |
| **2·4** | Cada pieza sale con su guion de respuesta, construido con el campo `accion` — no una plantilla genérica. |
| **2·5** | Cinco piezas por semana. No siete. *Un dueño que ya vende no produce a diario, y una semana incompleta se siente como fracaso propio.* |
| **2·6** | El guion nunca abre con la oferta. Las tres preguntas que califican son el guion, literal. |
| **2·7** | El gancho describe, no acusa. Deja a quien lee reconocerse solo. |
| **2·8** | El ángulo de prueba social no existe si el Perfil viene marcado sin prueba social. |

---

## Función 3 — Guion listo para grabar

```
1 · formato → 2 · ángulo → 3 · idea con filo → 4 · tres ganchos → guion
```

El orden no es negociable: preguntar el formato antes que el tema es lo que
separa un plan de rodaje de un párrafo.

### Tres formatos, no seis

| Formato | Qué graba | Golpes |
|---|---|---|
| **A cámara** | Él hablando al teléfono. Nada más. | 3–4 |
| **Lista con números** | Él hablando + un número grande por punto | N + 2 |
| **Voz en off + texto** | Sin salir en cámara: imágenes, su voz, texto | 4–5 |

> **Por qué se caen VS y POV.** Exigen desempeño actoral. El cliente es un dueño
> de negocio, no un actor. Un formato que no va a grabar es una opción que solo
> sirve para que dude.

### Qué devuelve

```
gancho        los primeros 3 segundos, literales
golpes[]      { texto hablado, dirección }
cierre        construido con el campo `accion` del Perfil
como_grabar   luz · fondo · encuadre · intención de voz
duracion_s    palabras ÷ 2,5
```

> **De dónde sale el 2,5.** ViralADN devolvió `145 palabras · ~58s hablado`. Eso
> da 2,5 palabras por segundo — 150 por minuto, el ritmo de habla normal.
> Verificado contra su propia salida, no inventado.

### Reglas duras

| | |
|---|---|
| **3·1** | Nunca abre con presentación. Arranca por lo que le sirve a quien mira. |
| **3·2** | La dirección de cada golpe describe una **acción o expresión física** — nunca una emoción abstracta. *Una emoción hay que interpretarla; una expresión se ejecuta.* |
| **3·3** | Se generan tres ganchos y el guion se escribe **después**, alrededor del elegido. *Elegir sobre tres líneas es barato; rechazar 800 palabras por una apertura mala es caro.* |
| **3·4** | Si el campo `voz` está vacío, la función lo pide y no genera. |
| **3·5** | El contraejemplo *así no / así sí* se escribe con el nicho del usuario, no con plantilla. |
| **3·6** | El cierre vende la transformación, no el producto: qué va a lograr, de qué va a ser capaz, de qué se va a olvidar. Caso lógico **y** emocional. |

---

## Función 4 — Pieza publicable · *en espera*

Esta función no se puede reglamentar todavía, y la razón importa.

Las funciones 1, 2 y 3 tienen reglas porque hubo dónde observarlas: once módulos
recorridos, salidas reales, aciertos y defectos medibles. La 4 no tiene esa base.

Pero el vacío no es de evidencia ajena: es del **criterio de publicable**. No se
pueden escribir las reglas de una función cuyo estándar de terminado no existe. Y
ese estándar sale de grabar un video, editarlo, y anotar qué se revisó antes de
decir "esto ya se publica".

Casi todo ese criterio son verificaciones mecánicas: subtítulos sincronizados
contra el transcript, inicio de audio en el primer segundo, cortes que no parten
palabras, relación de aspecto, tamaño de texto legible en un teléfono. Se miden
en código, no se opinan — así que esta función **no depende de escribir prompts**.

---

## Reglas que valen para las cuatro

| | |
|---|---|
| **Anti-invención** | Ni cifras, ni años, ni clientes, ni testimonios, ni resultados. Si el Perfil no lo trae, no existe. |
| **Con su material** | Al menos una salida por corrida usa una imagen o un giro de sus propias muestras de voz. Y solo de las suyas. |
| **Moldes prohibidos** | Nada de *"ayudo a X a lograr Y sin Z"*, *"al siguiente nivel"*, *"desbloquea"*, *"alcanza tus sueños"*, ni el emoji-flecha como CTA. |
| **La prueba del rubro** | Cambia el negocio por una panadería. Si la frase sigue funcionando, es genérica y se reescribe. |
| **Datos personales** | Un teléfono, un correo o un mensaje que aparezca en una captura no se repite en ninguna salida. |
| **Nombrar el campo, no a la persona** | *"tu perfil está mal"* no; qué le falta al campo, sí. |
