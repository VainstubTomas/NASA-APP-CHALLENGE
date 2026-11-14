# 06. Pitch, demo y entrega

Última actualización: 2026-11-14 · Estado: borrador. El guion definitivo se cierra el sábado a la noche.

## Premio objetivo (ADR-012)
Apuntamos a **Best Use of Data** ("el proyecto que mejor hace accesibles los datos espaciales") y, en segundo lugar, a **Best Use of Science** ("el uso más válido de la ciencia"). Storytelling y Mission Concept son ángulos, no metas. Los 10 premios están en `docs/00-CONTEXT.md`, sección "Premios". Regla del pitch: cada número que se muestra dice de qué dato de NASA sale.

## Mensaje central
> Los datos de NASA para saber si un sitio lunar tiene Sol y línea de vista con la Tierra ya existen, pero están en herramientas complejas. Nosotros los hicimos accesibles: una pantalla, una pregunta, y números verificados contra JPL Horizons.

## Estructura de la presentación (3 a 5 minutos, ajustar al tiempo que den)
Entre corchetes, el premio al que le habla cada bloque.
1. **El problema** (30 s) [Mission Concept]: polo sur lunar, Sol y Tierra pegados al horizonte, cualquier montaña los tapa; Artemis exige iluminación y comunicación directa. Analogía del campamento: sol para el panel y señal para el celular.
2. **Por qué es difícil hoy** (30 s) [Data]: los datos existen en Quickmap, Moon Trek y Horizons, pero son potentes y confusos. Mostrar 2 o 3 capturas y lo que resulta confuso (lista completa abajo, en "Por qué es difícil hoy: lo que encontramos").
3. **Nuestra solución** (30 s) [Data]: los mismos datos de NASA (Horizons, LRO), en una pantalla y una pregunta.
4. **Demo en vivo** (90 s) [Storytelling]: ver guion.
5. **Cómo sabemos que está bien** (30 s) [Science]: los datos salen de JPL Horizons, la herramienta oficial de NASA, y verificamos contra su interfaz que los mostramos bien en tres sitios y tres fechas. Decir también el límite: horizonte ideal mientras no haya relieve (ADR-011).
6. **Qué sigue** (15 s): el relieve real del terreno con LOLA (si no llegó), coordenadas propias, más misiones, mejores ventanas de aterrizaje.

Contexto internacional (opcional, issue C0-12): el portal de Exploración lunar de la CSA, recurso oficial del desafío, cuenta el aporte de Canadá a Artemis. Datos con fuente:
- Canadá aporta **Canadarm3**, un sistema robótico para la estación lunar Gateway, que puede ayudar a mantener, reparar e inspeccionar la estación. Fuente: [Canada's role in Moon exploration, CSA](https://www.asc-csa.gc.ca/eng/astronomy/moon-exploration/canada-role.asp) (última modificación de la página: 2025-06-05).
- El astronauta canadiense **Jeremy Hansen** forma parte de la tripulación de Artemis II, la primera misión tripulada a la Luna desde 1972. Fuente: [Canada's role in Moon exploration, CSA](https://www.asc-csa.gc.ca/eng/astronomy/moon-exploration/canada-role.asp) (última modificación de la página: 2025-06-05).

## Por qué es difícil hoy: lo que encontramos (C0-10)
Prueba hecha el 14/11/2026 por alguien del equipo usando las herramientas por primera vez, con una sola pregunta: **"¿el polo sur de la Luna (cráter Shackleton) tiene Sol en noviembre?"**. En Quickmap y Moon Trek se buscó Shackleton; en Horizons se usó un punto cercano al polo (lat -89,5, lon 0°), no el cráter exacto, que según Quickmap está en lat -89,67, lon 129,78. Capturas en [`docs/img/c0-10/`](img/c0-10/).

**Para el pitch (top 3):**
1. En Horizons, buscar "moon" como lugar de observación devuelve observatorios de la Tierra con "Moon" en el nombre, no la Luna (captura 02).
2. Con las opciones por defecto, la respuesta de Horizons a "¿hay Sol?" es un asterisco `*` al lado de la fecha, explicado unas 70 líneas más abajo; y aparece una `i` ("cuerpo que interfiere"; hay que mirar el encabezado para saber que es la Tierra: `Vis. interferer: EARTH`) (captura 07). Horizons sí da azimut y elevación si se marca esa opción: lo confuso es que hay que saber cuál marcar.
3. En Moon Trek, al buscar Shackleton, el polo sur se ve como franjas estiradas e irreconocibles (captura 12).

### JPL Horizons
| # | Captura | Qué intentamos | Qué confunde |
|---|---|---|---|
| 1 | [01](img/c0-10/01-horizons-inicio.png) | Abrir la herramienta | Arranca configurada en Marte visto desde el centro de la Tierra (`Geocentric [code: 500]`). Cinco pasos con jerga: *Ephemeris Type*, *Observer Table*, *Time Specification* |
| 2 | [02](img/c0-10/02-horizons-buscar-luna.png) | Ponernos en la Luna | Buscar "moon" lista 6 observatorios terrestres ("Desert Moon Observatory", etc.). Para elegir la Luna hay que saber códigos como `@301` |
| 3 | [03](img/c0-10/03-horizons-table-settings.png) | Pedir qué datos mostrar | 49 opciones técnicas ("Astrometric RA & DEC", "Delta-T (TDB - UT)") y unos 20 ajustes más. La que importa, "Apparent AZ & EL" (altura del Sol sobre el horizonte), no viene marcada por defecto |
| 4 | [04](img/c0-10/04-horizons-target-body.png) | Elegir el Sol | Buscador vacío, sin sugerencias: hay que saber de antemano el nombre o código del cuerpo |
| 5 | [05](img/c0-10/05-horizons-resultado-inicio.png) | Ver el resultado | Lo primero que muestra es la ficha física del Sol (masa, temperatura, ciclo de manchas solares), que no responde la pregunta |
| 6 | [06](img/c0-10/06-horizons-resultado-encabezado.png) | Encontrar el dato | Casi 60 líneas de encabezado técnico (`DE441`, `EOP file`, `Center cylindric`…) antes del primer dato |
| 7 | [07](img/c0-10/07-horizons-resultado-tabla.png) ([texto completo](img/c0-10/07-horizons-resultado-completo.txt)) | Saber si hay Sol | Tabla de 15 columnas con unidades mezcladas (horas, grados, UA). La respuesta es un `*` cuyo significado está al final del documento; además aparece una `i` ("interfering body"); solo el encabezado revela que es la Tierra (`Vis. interferer: EARTH`) |

### Quickmap (ASU / LROC)
| # | Captura | Qué intentamos | Qué confunde |
|---|---|---|---|
| 8 | [08](img/c0-10/08-quickmap-inicio.png) | Abrir la herramienta | Íconos sin nombre en la barra lateral; el buscador pide `lat,lon(,height)` |
| 9 | [09](img/c0-10/09-quickmap-shackleton.png) | Ver si Shackleton tiene luz | Encuentra el cráter y muestra quién fue Shackleton, el diámetro y un código, pero nada sobre luz. La altura (`-2788.33`) no tiene unidad y la vista no queda centrada en el cráter |
| 10 | [10](img/c0-10/10-quickmap-reloj.png) | Cambiar la fecha | Hay línea de tiempo, pero al cambiar la fecha la Luna se ve igual, iluminada entera. No encontramos cómo ver si un lugar tiene Sol en una fecha |

### Moon Trek (NASA)
| # | Captura | Qué intentamos | Qué confunde |
|---|---|---|---|
| 11 | [11](img/c0-10/11-moontrek-inicio.png) | Abrir la herramienta | Mapa plano sin indicaciones; el buscador está escondido abajo a la derecha |
| 12 | [12](img/c0-10/12-moontrek-shackleton.png) | Ir a Shackleton | Encuentra el cráter, pero el polo sur se ve como franjas estiradas: no se distingue el relieve, menos dónde hay luz o sombra |

**Conclusión para el pitch**: los datos existen (Horizons sabe exactamente dónde está el Sol), pero ninguna de las tres herramientas responde la pregunta directo. Nosotros respondemos con una pantalla: el horizonte del lugar, el Sol y la Tierra encima, y "hay Sol / hay contacto" en lenguaje simple.

## Guion de la demo (historia)
"Una misión iba a aterrizar el día X en este sitio. Se atrasó. ¿Qué cambia?"
1. Elegir un sitio de la lista y la fecha original: se ve el horizonte, el Sol y la Tierra, y los números. Mientras no esté el relieve (capa 5), decir que el horizonte es ideal y que la montaña es el siguiente paso; no afirmar que la herramienta muestra montañas tapando el Sol (ADR-011).
2. Avanzar el reproductor de tiempo: el Sol se acerca al horizonte (a una montaña cuando esté el relieve). Aparece la cuenta regresiva: "el Sol se oculta en N horas".
3. Cambiar la fecha (retraso): mirar la línea de tiempo de luz y de contacto con la Tierra.
4. Comparar los dos escenarios lado a lado y concluir cuál conviene (capa 4).
5. Mostrar el panel de validación contra Horizons (C3-06): para casos conocidos, nuestros números al lado de los de Horizons, con la diferencia.

Elegir un sitio y fechas donde la diferencia sea visible y dramática; probarlas el sábado.

## Plan B de la demo
- La web está desplegada, pero tener también una copia local corriendo y un video corto grabado por si falla internet o el proyector.
- Si una capa no llegó, se demuestra la anterior sin disculpas y se cuenta como futuro.

## Ensayo
- Correr la demo completa al menos dos veces antes de la defensa (dom 15, entre 14:30 y 16:30).
- Probar con alguien de afuera (un mentor o compañero de otro equipo) y anotar dónde se confunde.

## Checklist de entrega (confirmar qué pide la organización)
- [ ] Repo en GitHub público y actualizado, con README claro
- [ ] `main` contiene la versión final y arranca siguiendo el README
- [ ] Datos sintéticos de desarrollo eliminados (`synthetic: true` fuera de `sites.json`)
- [ ] Web desplegada con link en el README
- [ ] Créditos y fuentes de datos citados (JPL Horizons, Quickmap de ASU, NASA Moon Trek, datos LRO/LOLA; CSA si se usa)
- [ ] Presentación lista
- [ ] Subido con margen antes de las 14:30 del domingo 15
- [ ] Video corto de respaldo (si lo piden o por seguridad)
