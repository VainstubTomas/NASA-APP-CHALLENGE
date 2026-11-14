# ADR-010: Automatización de cierre de issues y seguimiento entre proyectos

- **Estado**: Propuesto
- **Fecha**: 2026-11-13
- **Decidieron**: pendiente de confirmar por el equipo

## Contexto
Los PRs van a `dev`, no a `main`. GitHub solo cierra una issue con `Closes #n` cuando el PR se mergea en la rama por defecto, así que con nuestro flujo las issues quedaban abiertas y el tablero "Hackaton" no reflejaba lo hecho. Además queremos seguir qué issues cerradas en `dev` faltan llegar a `main`, sin duplicar issues.

## Decisión
- Una GitHub Action (`.github/workflows/post-merge.yml`) corre al mergear un PR: busca las issues linkeadas (GraphQL `closingIssuesReferences`) y el número del nombre de la rama (`feature/<n>-...`, `fix/<n>-...`), les pone la etiqueta `ready:to:main` y las cierra.
- Los workflows de GitHub Projects hacen el resto: en "Hackaton 🪐" (A) la issue pasa a `Done`; en "Main migrate 🚀" (B) entra por *Auto-add to project* y queda en `From dev`.
- La misma issue vive en los dos proyectos; no se duplica.
- Detalle operativo en `docs/04-GIT-WORKFLOW.md`, sección "Automatizaciones".

## Alternativas descartadas
- Depender de `Closes #n`: no cierra issues con PRs a `dev`.
- Duplicar las issues en el proyecto B: doble mantenimiento y se desincronizan.
- Cerrar las issues a mano: se olvida, sobre todo de noche en el hackatón.

## Consecuencias
- El tablero se actualiza solo al mergear, sin pasos extra para quien abre el PR.
- El formato de rama `feature/<n>-<slug>` pasa a ser importante: es el respaldo si el PR no tiene la issue linkeada.
- Costo aceptado: si una rama lleva el número de una issue que el PR no resuelve del todo, la issue se cierra igual (se reabre a mano). Lo mitiga la regla "un PR por issue".
- Los workflows de los proyectos solo se configuran desde la web y no se pueden verificar por API.
- La Action tiene que existir en la rama base del PR (`dev`, y en `main` después del próximo hito).
