# 00. Contexto del evento y del desafío

Última actualización: 2026-11-14

## El evento
NASA Space Apps Challenge 2026, hackatón global de dos días (sábado 14 y domingo 15 de noviembre). Nuestra sede es presencial.

**Entregables**: el proyecto subido a GitHub y una presentación (defensa ante jurado). Confirmar con los organizadores si piden algo más (video, resumen escrito).

### Cronograma en el lugar
| Momento | Qué pasa |
|---|---|
| Vie 13 | Se liberan los recursos del desafío (hora sin confirmar) |
| Sáb 14, 08:30 | Acreditación, desayuno, apertura 09:15, manos a la obra 09:30 |
| Sáb 11:30 | Charla presencial |
| Sáb 12:30 a 13:30 | Viandas y pausa |
| Sáb 14:30 a 16:30 | Mentoreo por mesas (mentores e invitación a jurados) |
| Sáb 16:30 / 17:00 | Merienda; se retoma |
| Sáb 18:30 | Recorrida por las instalaciones |
| Sáb 19:00 | Fin de la jornada. **Seguimos trabajando en equipo en una casa hasta la primera hora del domingo** |
| Dom 15, 09:00 | Segunda jornada. Observaciones 10:30, mentoría por grupos 11:30 |
| Dom 12:30 | Charla sobre GitHub. Almuerzo 13:00 a 14:00 |
| Dom 14:30 | Últimos ajustes y subida del proyecto a GitHub |
| Dom 16:30 | Defensa ante el jurado |
| Dom 18:00 | Cierre. El jurado evalúa en forma privada; la decisión llega en unos 7 días |

Tiempo efectivo de trabajo: unas 15 horas (estimación: ~10 en el lugar y ~5 en la sesión del sábado a la noche).

## El desafío elegido
**Lunar Landing Site Navigator**: una herramienta que, dado un sitio de la Luna y una fecha, muestra dónde están el Sol y la Tierra respecto del terreno, y por lo tanto cuánta energía solar y cuánta comunicación directa con la Tierra habrá.

> Texto oficial completo (traducido) en [`docs/07-DESAFIO-OFICIAL.md`](07-DESAFIO-OFICIAL.md). Recursos liberados el 13/11 (ver "Recursos" abajo y ADR-006). **La página del desafío no publica criterios de evaluación**, pero Space Apps sí publica sus 10 premios globales (ver "Premios" abajo; apuntamos a Best Use of Data, ADR-012). La rúbrica del jurado sigue a confirmar con los organizadores (C0-11). La página avisa que se pueden sumar recursos antes del hackatón: revisar la pestaña Recursos el sábado a la mañana.

### Qué pide el desafío, traducido
| Pedido | En la práctica |
|---|---|
| Selección de sitios | Lista de lugares conocidos (Apolo, misiones CLPS, polo sur, otros países) y coordenadas propias |
| Fecha y hora | Selector de fecha y reproductor para avanzar en el tiempo |
| Posición del Sol y la Tierra | Dibujo del horizonte con el Sol y la Tierra encima |
| Energía y comunicación | Altura del Sol, horas de luz, horas con la Tierra visible |
| Tiempo hasta que se oculten | Cuenta regresiva |
| Comparación | Dos o tres escenarios lado a lado |
| Accesible | Que lo entienda un ingeniero y un estudiante de secundaria |

No hace falta hacer todo: lo importante es que lo que hagamos funcione bien y se vea claro.

### Texto oficial contra nuestro alcance (revisión del 13/11)
| El texto oficial dice | Estado en nuestro plan | Qué hacer |
|---|---|---|
| Efemérides con Horizons o datos precalculados | Cubierto (ADR-006) | Nada |
| Topografía LOLA para el horizonte; sin atmósfera, el horizonte es el terreno más el borde de la esfera lunar | Primero Luna lisa (horizonte 0°, capas 1 a 4); el relieve LOLA va al final, en la capa 5 (ADR-011) | Que C5-06 incluya la curvatura y no use refracción; avisar "sin relieve" en la web mientras tanto |
| Elevación del Sol como métrica clave, "de forma destacada" | Cubierto (C1-03) | Que sea el número más visible de la pantalla (C3-05) |
| Tiempo hasta la puesta del Sol **y de la Tierra** | Cubierto (C3-04) | Nada |
| Libración y variaciones orbitales | Cubierto: Horizons ya las incluye | Mencionarlo en el pitch |
| **Comparación rápida de escenarios** ("su interfaz podría priorizar…") | Capa 4, obligatoria (ADR-009) | Decidido: sube de prioridad |
| Sitios Apolo, CLPS, comerciales y de otros países, más coordenadas propias | Lista de C0-07 (decisión pendiente en ese issue); coordenadas propias abiertas (C5-04) | Resuelto por el ADR-011: con la Luna lisa entran todos los sitios, también los Apolo (lejos del polo). Cuando llegue el relieve, solo los del polo sur (80°S a 90°S) lo tendrán y los demás seguirán con horizonte liso |
| Animaciones o línea de tiempo de un día lunar | Cubierto (C3-02, C3-03) | Nada |
| Por qué pequeños cambios de lugar o fecha cambian todo | Capa 5 (C5-01) | Puede ir en los textos y en la demo sin código extra |
| Útil para planificadores, educadores y el público | Cubierto (PRD, C3-05) | Nada |

## Premios (awards)
Fuente: https://www.spaceappschallenge.org/awards/ (copiado el 2026-11-14). Son los 10 premios globales de Space Apps. **Apuntamos a Best Use of Data y, en segundo lugar, a Best Use of Science** (ADR-012). No cambia el alcance: cambia cómo lo contamos.

| Premio | Definición oficial (traducida) | Encaje con el proyecto |
|---|---|---|
| **Best Use of Data** | El proyecto que mejor hace accesibles los datos espaciales o los aprovecha en una aplicación única | **Principal.** Es nuestra propuesta de valor: datos de Horizons y del LRO, hoy en herramientas complejas, respondidos en una pantalla |
| **Best Use of Science** | El proyecto que hace el mejor y más válido uso de la ciencia o del método científico | **Secundario.** Validación contra Horizons (C0-05, C3-06) y límites declarados ("horizonte ideal, sin relieve", ADR-011) |
| Best Use of Storytelling | El proyecto que comunica de forma más creativa el potencial de los datos abiertos a través del arte de contar historias | Ángulo del pitch: la historia "la misión se atrasó" |
| Best Mission Concept | El proyecto con el concepto y el diseño más plausibles | Ángulo del pitch: planificación de aterrizajes de Artemis. No somos un concepto de misión |
| Galactic Impact | El proyecto con más potencial de mejorar la vida en la Tierra o en el universo | Bajo: impacto indirecto |
| Best Use of Technology | El proyecto que ejemplifica el uso más innovador de la tecnología | Bajo: web simple sobre JSON precalculados, a propósito |
| Most Inspirational | El proyecto que nos gana el corazón | Bajo |
| Global Connection | El proyecto que mejor conecta a personas de todo el mundo a través de la tecnología | Bajo |
| Art & Technology | El proyecto que mejor combina habilidades técnicas y creativas | Bajo |
| Local Impact | El proyecto con mayor potencial de impacto local | Bajo |

## Por qué importa (para el pitch)
- Las futuras misiones apuntan al polo sur lunar por el hielo de agua. Ahí el Sol y la Tierra quedan pegados al horizonte y cualquier relieve los tapa.
- NASA publicó restricciones de aterrizaje para Artemis que incluyen pendiente máxima, comunicación directa con la Tierra e iluminación. Fuente: [Artemis Human Landing System Overview, NASA NTRS 20250009323](https://ntrs.nasa.gov/api/citations/20250009323/downloads/ArtemisOverview2025IntSPAPPSChallenge.pdf).
- Hoy esa información existe en herramientas de NASA (Quickmap, Moon Trek, Horizons), pero son complejas. Nuestro valor es hacerla simple, visual y comparable.

## Recursos
- Sitio del evento: https://www.spaceappschallenge.org/
- Página del desafío (pestaña Resources): https://www.spaceappschallenge.org/2026/challenges/lunar-landing-site-navigator/?tab=resources

### Recursos oficiales del desafío (liberados el 13/11)
| Recurso | Qué es | Cómo lo usamos |
|---|---|---|
| **JPL Horizons** (NASA/JPL), https://ssd.jpl.nasa.gov/horizons/ | Efemérides: posición del Sol y la Tierra vista desde cualquier punto de la Luna | **Fuente** de azimut y elevación (pieza 1), vía su API. Ver ADR-006 |
| **Quickmap** (Arizona State University, datos del LRO de NASA) | Mapa interactivo con imágenes de alta resolución y topografía | Explorar y verificar sitios y coordenadas; ver si exporta el mapa de elevación o capas de iluminación |
| **Moon Trek** (NASA) | Visualización 3D de la superficie y su topografía | Igual que Quickmap; candidato a fuente del mapa de elevación (pieza 2) |
| **Exploración lunar de la CSA** (Agencia Espacial Canadiense) | Portal sobre misiones y el aporte de Canadá a Artemis | Contexto para el pitch (issue C0-12) |

**Importante**: el repo se armó suponiendo kernels SPICE y el mapa `LDEM_80S_80MPP_ADJ.TIF` en la pestaña Recursos. **No se entregaron.** El ajuste está en el ADR-006.

### Otros recursos (no oficiales del desafío)
- Mapa de elevación LOLA del polo sur en el archivo PDS (`LDEM_80S_80MPP_ADJ.TIF`, ~180 MB): plan B para el terreno si Moon Trek y Quickmap no permiten exportar; usarlo solo con el OK de los organizadores (C0-11).
- Documentos previos del equipo: guía técnica y plan de trabajo de Fer (referencia, ya integrados en estos docs).

## Pendientes de confirmar con los organizadores
1. ¿Se puede llegar con repo, datos y cálculos preparados de antemano, o el código debe escribirse durante el evento? ¿Se pueden usar datos públicos de NASA que no están en la lista de recursos (por ejemplo, el mapa LOLA del PDS)?
2. Rúbrica del jurado (local y global) y entregables exactos. Los premios ya están publicados (ver "Premios").
3. Si la presentación es en vivo, cuánto dura y si hay proyector y conexión (C0-11).
