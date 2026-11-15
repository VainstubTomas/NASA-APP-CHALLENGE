> 🇬🇧 [Read in English](../en/adr/ADR-017-comparison-without-verdict.md)

# ADR-017: La comparación de escenarios no elige un "mejor": marca más Sol y más Tierra

- **Estado**: Propuesto
- **Fecha**: 2026-11-15
- **Decidieron**: el equipo, el domingo 15 (pendiente de registrar quiénes confirman). Trabajo en #94.
- **Reemplaza a**: [ADR-014](ADR-014-criterio-comparacion-escenarios.md) en la comparación de la web (#94, #95)

## Contexto
El ADR-014 definía una regla de "cuál conviene": más horas de Sol; en empate, más horas de Tierra visible. Al revisarla con la comparación en pantalla se vio que:
- **Ninguna fuente oficial define esa regla.** El texto del desafío (`docs/07-DESAFIO-OFICIAL.md`) no trae criterios de evaluación ni pesos entre Sol y Tierra: pide evaluar "el potencial de generación de energía y las ventanas de comunicación directa con la Tierra", las dos cosas a la vez. La restricción de aterrizaje de Artemis (NASA NTRS 20250009323) también las presenta como requisitos distintos. La prioridad del Sol era una decisión nuestra.
- **La regla declaraba un ganador con diferencias mínimas** (una hora en 168) y la Tierra solo desempataba, aunque para una misión pesan lo mismo según el caso.
- **La decisión depende de la misión**, no de la herramienta: un rover con paneles necesita energía; una misión con operación en vivo necesita contacto.

## Decisión
La web **no dice cuál escenario es mejor**. Para cada métrica, por separado, compara los escenarios entre sí y marca cuál tiene más horas (el número mayor se resalta en negrita):
1. **Horas de Sol visible** (energía).
2. **Horas de Tierra visible** (comunicación directa).

Reglas (implementadas en `compareMetrics`, `web/src/compare-summary-core.js`):
- Un escenario "tiene más" en una métrica si supera a cada uno de los otros. Con 3 escenarios se compara contra el siguiente. Si dos están empatados al tope, se marcan los dos.
- Si todos tienen las mismas horas, se dice "iguales" y no se marca a nadie.
- Es una regla matemática: no hay umbral ni puntaje combinado. Una diferencia chica también se marca, y los números están a la vista para que se juzgue si importa.
- Un escenario puede ganar una métrica y perder la otra. No se suman ni se ponderan.
- La persona (planificador, astronauta, estudiante) decide cuál le sirve según sus requisitos. La web lo dice en el resumen y en el README.
- Los escenarios repetidos (mismo sitio y hora) se siguen agrupando (#107); si todos son el mismo caso se dice "misma fecha y lugar" y no se compara.
- Las horas son las de `visibilitySeries` (regla del contrato, borde superior sobre el horizonte), con la resolución de una hora de los datos, en la ventana de 7 días desde el día UTC elegido.

## Alternativas descartadas
- **Mantener el ADR-014:** la prioridad del Sol no sale de ninguna fuente y presenta como conclusión algo que es una preferencia.
- **Puntaje ponderado de Sol y Tierra:** los pesos serían arbitrarios y no se pueden defender ante el jurado.
- **Umbral de "casi igual":** agrega un número inventado. Se prefiere mostrar las horas y dejar que la persona juzgue.
- **Sumar la elevación máxima del Sol a la comparación:** el desafío pide destacar la elevación solar, pero hoy solo se muestra en el panel principal. Queda como mejora (capa 5), sin entrar en esta decisión.

## Consecuencias
- Se saca de la web el "Conviene", la etiqueta verde y la columna ganadora. Textos nuevos en `compare.summary.*` en los 4 idiomas.
- `pickBest` y `explainBest` desaparecen; las reemplaza `compareMetrics`.
- El **buscador de ventanas** (C5-03, `precompute/ephemeris/windows.py`) sigue ordenando con la regla del ADR-014. Es un orden de ventanas, no un veredicto sobre un escenario de la web. Si el equipo también quiere cambiarlo, es otro issue.
- El guion de la demo y la presentación (#113) dejan de decir "cuál conviene": dicen cuál tiene más Sol y cuál más Tierra, y que la decisión depende de la misión.
- El README aclara que la herramienta no recomienda un sitio.
- El horizonte sigue siendo ideal, sin relieve, hasta la capa 5 (ADR-011): las horas comparadas no incluyen sombra del terreno.
