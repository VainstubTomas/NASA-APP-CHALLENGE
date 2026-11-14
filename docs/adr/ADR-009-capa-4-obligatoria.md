# ADR-009: La comparación de escenarios (capa 4) pasa a obligatoria

- **Estado**: Propuesto
- **Fecha**: 2026-11-13
- **Decidieron**: pendiente de confirmar por el equipo

## Contexto
El ADR-001 fijó como objetivo las capas 1 a 3, con la capa 4 (comparar 2 o 3 escenarios lado a lado) como "meta probable". El texto oficial del desafío, publicado el 13/11, pone la comparación en el centro: "su interfaz podría priorizar la comparación rápida de escenarios" (`docs/07-DESAFIO-OFICIAL.md`). La revisión de `docs/00-CONTEXT.md` dejó pendiente subirle la prioridad.

## Decisión
- La capa 4 pasa de **deseable** a **obligatoria**. El objetivo del MVP es capas 1 a 4.
- El orden no cambia: la capa 4 se construye sobre la 3, porque compara escenarios con los mismos números y gráficos.
- La regla "recortar, no estirar" sigue vigente: si hay atraso, se muestra la última capa que funcione.

## Alternativas descartadas
- Dejarla como deseable: el jurado evalúa contra el texto oficial, y la comparación es lo que más pide.
- Hacerla antes que la capa 3: sin línea de tiempo ni métricas no hay mucho para comparar.

## Consecuencias
- La sesión del sábado a la noche apunta a cerrar las capas 3 y 4.
- La comparación entra en el guion de la demo como paso fijo y sale de "Qué sigue" en el pitch.
- La capa 5 sigue siendo solo si sobra tiempo.
