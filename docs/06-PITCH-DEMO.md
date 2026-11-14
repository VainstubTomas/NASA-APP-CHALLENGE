# 06. Pitch, demo y entrega

Última actualización: 2026-11-14 · Estado: borrador. El guion definitivo se cierra el sábado a la noche.

## Mensaje central
> Hoy saber si un sitio lunar tiene Sol y línea de vista con la Tierra requiere herramientas de NASA complejas. Nosotros lo hicimos simple, visual y verificable.

## Estructura de la presentación (3 a 5 minutos, ajustar al tiempo que den)
1. **El problema** (30 s): polo sur lunar, Sol y Tierra pegados al horizonte, cualquier montaña los tapa. Analogía del campamento: sol para el panel y señal para el celular.
2. **Por qué es difícil hoy** (30 s): las herramientas actuales (Quickmap, Moon Trek, Horizons) son potentes pero confusas. Mostrar 2 o 3 capturas y lo que resulta confuso (lista completa abajo, en "Por qué es difícil hoy: lo que encontramos").
3. **Nuestra solución** (30 s): una pantalla, una pregunta.
4. **Demo en vivo** (90 s): ver guion.
5. **Cómo sabemos que está bien** (30 s): los datos salen de JPL Horizons, la herramienta oficial de NASA, y verificamos contra su interfaz que los mostramos bien en tres sitios y tres fechas.
6. **Qué sigue** (15 s): coordenadas propias, más misiones, mejores ventanas de aterrizaje.

Contexto internacional (opcional): el portal de Exploración lunar de la CSA, recurso oficial del desafío, cuenta el aporte de Canadá a Artemis. Usar 1 o 2 datos con fuente si suman (issue C0-12).

## Por qué es difícil hoy: lo que encontramos (C0-10)
Prueba hecha el 14/11/2026 por alguien del equipo usando las herramientas por primera vez, con una sola pregunta: **"¿el polo sur de la Luna (cráter Shackleton) tiene Sol en noviembre?"**. Capturas en [`docs/img/c0-10/`](img/c0-10/).

**Para el pitch (top 3):**
1. En Horizons, buscar "moon" como lugar de observación devuelve observatorios de la Tierra con "Moon" en el nombre, no la Luna (captura 02).
2. La respuesta de Horizons a "¿hay Sol?" es un asterisco `*` al lado de la fecha, explicado unas 70 líneas más abajo; y la Tierra aparece como `i`, "cuerpo que interfiere" (captura 07).
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
| 7 | [07](img/c0-10/07-horizons-resultado-tabla.png) ([texto completo](img/c0-10/07-horizons-resultado-completo.txt)) | Saber si hay Sol | Tabla de 15 columnas con unidades mezcladas (horas, grados, UA). La respuesta es un `*` cuyo significado está al final del documento; la Tierra figura como `i`, "interfering body" |

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
1. Elegir un sitio de la lista y la fecha original: se ve el horizonte, el Sol y la Tierra, y los números.
2. Avanzar el reproductor de tiempo: el Sol se acerca a una montaña. Aparece la cuenta regresiva: "el Sol se oculta en N horas".
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
