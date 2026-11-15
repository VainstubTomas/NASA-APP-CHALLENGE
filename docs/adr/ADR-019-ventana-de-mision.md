> 🇬🇧 [Read in English](../en/adr/ADR-019-mission-day-window.md)

# ADR-019: Ir al día de una misión histórica con una ventana de efemérides precalculada

- **Estado**: Propuesto
- **Fecha**: 2026-11-15
- **Decidieron**: el equipo (pendiente de registrar quiénes confirman). La opción A se eligió entre cuatro en la conversación de diseño del 2026-11-15.

## Contexto
Los sitios de `sites.json` incluyen misiones históricas (Apolo 11 a 17, Chang'e 3, 4 y 6, Chandrayaan-3, SLIM, Blue Ghost 1, IM-1 e IM-2), pero la web solo deja elegir fechas desde hoy hasta 2027-12-31: es el rango de los `ephemeris.json` y de la API en vivo. La persona no puede ver el cielo del día en que alunizó una misión.

Se midió el 2026-11-15 que Horizons responde para 1969: con las coordenadas de `sites.json`, el Sol y la Tierra de las seis misiones Apolo coinciden con la tabla de Scotti del Apollo Lunar Surface Journal (NASA) dentro de 0,05° para el Sol y 0,4° para la Tierra (la tabla usa otras coordenadas y el Nautical Almanac).

## Decisión
1. **Cada sitio con misión lleva `landing_utc`** (UTC, ISO 8601), `landing_source` y `landing_source_url` en `sites.json`. Son opcionales y `additionalProperties` del esquema los admite. No se inventan: para Apolo vienen de Orloff vía ALSJ (segundos); para el resto son fuentes publicadas, a precisión de minuto. Las dos con fuente secundaria (Chandrayaan-3 e IM-2) lo dicen en `landing_source`.
2. **`data/public/sites/<id>/mission.json`**: efemérides del sitio con **el mismo formato y esquema que `ephemeris.json`** (contrato v1.0, sin cambios), una muestra por hora, desde 3 días antes hasta 3 días después de la hora del alunizaje (hora redondeada hacia abajo; 145 muestras). Las genera `precompute/ephemeris/build_mission.py` con Horizons.
3. **Modo misión en la web**, sin interruptor aparte: si la fecha cae dentro de la ventana de la misión del sitio, las efemérides salen de `mission.json` y el deslizador recorre esa ventana. Fuera de ella rige el rango de siempre (hoy a 2027-12-31). La regla vive en `web/src/state.js` (`missionWindow`, `rangeFor`) y es la misma que `mission_window` de Python; un test comprueba que coinciden para las 14 misiones.
4. **Cómo se entra y se sale**: en el panel de búsqueda, "Ir al día de la misión" (solo si el sitio tiene misión) pone la fecha en la hora del alunizaje; también sirve una URL `?site=apollo-11&t=1969-07-20T20:00Z`. En modo misión, un aviso bajo la fecha indica la hora del alunizaje y ofrece "Volver a las fechas actuales". Cambiar de sitio también sale de la misión.
5. **Alcance**: el panel de validación (valores de referencia de Horizons de las fechas actuales) se oculta en modo misión, y la comparación de escenarios sigue con el rango normal. El relieve (`horizon.json`) no depende de la fecha y se reutiliza.

## Alternativas descartadas
- **B. API en vivo para fechas históricas**: no agrega archivos, pero depende de que la API esté despierta (Render gratis tarda) y ensancha la excepción del ADR-015.
- **C. Precalcular desde 1969 hasta 2027**: a paso horario son ~500 000 muestras por sitio y cuerpo; con paso diario se pierde el sentido de "horas de luz".
- **D. Híbrido (A más B de respaldo)**: más trabajo que el valor que suma para la demo; se puede agregar después sobre A.

## Consecuencias
- Un archivo nuevo por misión (~8 KB cada uno, ~112 KB los 14) y tres campos opcionales en `sites.json`.
- La validación contra datos publicados cubre las 6 misiones Apolo (`tests/test_mission_window.py`). Para las otras 8 la validación es solo contra Horizons: no se encontró una tabla independiente de Sol y Tierra.
- La hora de alunizaje de Apolo 16 es 1972-04-21 02:23:35 UTC; el NSSDC lista el 20/04 porque usa la fecha local de Houston. Siempre se guarda UTC.
- Quedan pendientes de confirmar con fuente primaria las horas de Chandrayaan-3 (ISRO) e IM-2 (Intuitive Machines o NASA). Un error de un minuto no cambia la ventana de ±3 días.
