> 🇬🇧 [Read in English](../en/adr/ADR-014-scenario-comparison-criterion.md)

# ADR-014: Criterio de "cuál conviene" en la comparación de escenarios

- **Estado**: Propuesto
- **Fecha**: 2026-11-14
- **Decidieron**: pendiente de confirmar por el equipo (ver #95)

## Contexto
La capa 4 compara 2 o 3 escenarios lado a lado y tiene que indicar cuál conviene (#94, C4-01d). Sin una regla escrita, el resumen puede contradecir a los números o cambiar según quién lo mire. La regla tiene que salir de datos ya calculados (`summarizeScenario` en `web/src/compare-core.js`, #91) y ser igual en la web, la demo y el guion (#96).

## Decisión
Sobre la ventana de 7 días desde el día UTC elegido (la misma de la línea de tiempo, C3-03):
1. Conviene el escenario con **más horas de Sol visible**.
2. En empate de Sol, conviene el de **más horas de Tierra visible**.
3. Si también empatan en Tierra, el resumen dice que **no hay diferencia** y no elige.

Las horas son las de `visibilitySeries` (regla del contrato, borde superior sobre el horizonte), con la resolución de una hora de los datos.

## Alternativas descartadas
- **Puntaje ponderado (Sol y Tierra con pesos):** los pesos serían arbitrarios y no se pueden defender ante el jurado.
- **Tierra primero:** la comunicación importa, pero sin Sol no hay energía para los paneles y el sitio no sirve aunque tenga contacto.
- **Duración de la noche (tiempo hasta la próxima puesta):** es la métrica de la cuenta regresiva (C3-04), no de la comparación, y no dice cuánto tiempo útil hay en la ventana.

## Consecuencias
- `pickBest` en `compare-core.js` implementa esta regla. Si el equipo la cambia, hay que actualizar este ADR y el código en el mismo PR.
- El resumen de C4-01d usa las mismas palabras: "más horas de Sol" y "empate".
- El criterio no mide calidad del sitio (pendiente, terreno, latitud). Ese alcance va en la presentación, no en la regla.
- Costo: la regla solo compara horas de luz y de contacto. Un escenario con un Sol muy bajo sobre el horizonte cuenta igual que uno con Sol alto.
