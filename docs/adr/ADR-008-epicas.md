# ADR-008: Una épica por capa del MVP, con sus issues como sub-issues

- **Estado**: Propuesto
- **Fecha**: 2026-11-13
- **Decidieron**: pendiente de confirmar por el equipo

## Contexto
Los issues del roadmap están organizados por capa (fase) del MVP, pero en el tablero de GitHub se ven como una lista plana: la capa solo aparece en una etiqueta y en el prefijo del título. Es difícil ver de un vistazo cuánto falta para cerrar una capa, que es lo que importa con la regla "recortar, no estirar".

## Decisión
- Cada capa (0 a 5) y la entrega tienen una **épica**: un issue padre cuyo título empieza con `[EPICA]` y que lleva las etiquetas `tipo:epica` y la de su capa.
- Los issues de la capa cuelgan de su épica como **sub-issues** de GitHub.
- La épica representa la demo completa de esa capa. No se trabaja directamente (sin asignado, rama ni PR) y se cierra cuando sus sub-issues están cerrados o descartados.
- Las épicas se definen en `scripts/issues.json` (`epics`) y las crea `scripts/create_issues.py`.

## Alternativas descartadas
- Milestones de GitHub por capa: atados a fechas, y las capas no siempre coinciden con un hito del cronograma.
- Solo etiquetas `capa:N`: ya existen, pero no muestran el avance de la capa.
- Tasklists en el cuerpo del issue: GitHub las reemplazó por sub-issues.

## Consecuencias
- El tablero muestra el avance por capa y cada issue indica a qué épica pertenece.
- Un issue nuevo debe colgarse de la épica de su capa (a mano en GitHub o agregándolo a `issues.json` y corriendo el script).
- Hay 7 issues más en el tablero que nadie debe tomar: por eso el prefijo `[EPICA]` en el título.
