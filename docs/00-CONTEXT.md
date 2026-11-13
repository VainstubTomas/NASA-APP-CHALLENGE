# 00. Contexto del evento y del desafío

Última actualización: 2026-11-12

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

> Pendiente: copiar acá el nombre oficial y el texto del desafío desde la pestaña del evento cuando se liberen los recursos (viernes 13), y pegar los criterios de evaluación.

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

## Por qué importa (para el pitch)
- Las futuras misiones apuntan al polo sur lunar por el hielo de agua. Ahí el Sol y la Tierra quedan pegados al horizonte y cualquier relieve los tapa.
- NASA publicó restricciones de aterrizaje para Artemis que incluyen pendiente máxima, comunicación directa con la Tierra e iluminación. Fuente: [Artemis Human Landing System Overview, NASA NTRS 20250009323](https://ntrs.nasa.gov/api/citations/20250009323/downloads/ArtemisOverview2025IntSPAPPSChallenge.pdf).
- Hoy esa información existe en herramientas de NASA (Quickmap, Moon Trek, Horizons), pero son complejas. Nuestro valor es hacerla simple, visual y comparable.

## Recursos
- Sitio del evento: https://www.spaceappschallenge.org/
- JPL Horizons (validación): https://ssd.jpl.nasa.gov/horizons/
- Mapa de elevación LOLA del polo sur: `LDEM_80S_80MPP_ADJ.TIF` (~180 MB). Descargar desde la pestaña Recursos o desde el archivo PDS de LOLA.
- Kernels SPICE (NAIF): efemérides, orientación de la Luna y segundos intercalares.
- Documentos previos del equipo: guía técnica y plan de trabajo de Fer (referencia, ya integrados en estos docs).

## Pendientes de confirmar con los organizadores
1. ¿Se puede llegar con repo, datos y cálculos preparados de antemano, o el código debe escribirse durante el evento?
2. Criterios de evaluación y entregables exactos.
3. Si la presentación es en vivo, cuánto dura y si hay proyector y conexión.
