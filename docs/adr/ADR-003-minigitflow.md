# ADR-003: MiniGitFlow como flujo de ramas

- **Estado**: Aceptado (en parte reemplazado por el ADR-007: formato de commits y protección de `develop`)
- **Fecha**: 2026-11-12
- **Decidieron**: equipo completo

## Contexto
Cuatro personas editando el mismo repo durante dos jornadas intensas, con experiencia dispar en Git. Dos de nosotros usamos GitFlow en el trabajo. Queremos que nadie bloquee ni rompa el trabajo de otro y que `main` esté siempre listo para mostrar.

## Decisión
**MiniGitFlow**: `main` (demoable) y `develop` (integración), ambas protegidas; ramas `feature/<n>-<slug>` y `fix/<n>-<slug>` desde `develop`, una por issue, de vida corta; PR hacia `develop` con 1 aprobación y merge por squash. `develop` pasa a `main` solo en los hitos del cronograma. Sin `release/*` ni `hotfix/*`. Detalle en `docs/04-GIT-WORKFLOW.md`.

## Alternativas descartadas
- GitFlow completo: ceremonia que no aporta en dos jornadas.
- Trabajar todos sobre `main`: se rompen entre sí.
- Trunk-based sin PRs: sin revisión, errores silenciosos en los números.

## Consecuencias
- Cada tarea es un issue con criterio de aceptación y tamaño máximo de ~4 horas.
- Carpeta principal por área para minimizar conflictos; datos pesados y notebooks fuera de git.
- Las primeras PRs de quienes están empezando se hacen en pareja.
