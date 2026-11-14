# ADRs (Architecture Decision Records)

Una decisión importante por archivo, de una página como máximo. Se escriben en 2 minutos y evitan discutir lo mismo a las 4 am.

Plantilla: copiar `ADR-000-template.md`, numerar el siguiente (`ADR-011-...`) y completarlo. Si una decisión cambia, no se borra el ADR: se marca "Reemplazado por ADR-N" y se escribe uno nuevo.

| ADR | Decisión | Estado |
|---|---|---|
| [001](ADR-001-desafio-y-alcance.md) | Desafío y alcance del MVP por capas | Aceptado (prioridad de la capa 4 reemplazada por 009) |
| [002](ADR-002-contrato-de-datos.md) | Contrato de datos Python a web | Propuesto |
| [003](ADR-003-minigitflow.md) | MiniGitFlow | Aceptado (en parte reemplazado por 007) |
| [004](ADR-004-stack.md) | Stack tecnológico | Propuesto (efemérides reemplazadas por 006) |
| [005](ADR-005-validacion-horizons.md) | Validación contra JPL Horizons | Reemplazado en parte por 006 |
| [006](ADR-006-recursos-oficiales.md) | Recursos oficiales: Horizons como fuente y mapa de elevación por confirmar | Aceptado |
| [007](ADR-007-commits-y-hooks.md) | Formato de commits, hooks de Git y `dev` sin protección | Aceptado |
| [008](ADR-008-epicas.md) | Una épica `[EPICA]` por capa, con sus issues como sub-issues | Propuesto |
| [009](ADR-009-capa-4-obligatoria.md) | La comparación de escenarios (capa 4) pasa a obligatoria | Propuesto |
| [010](ADR-010-automatizacion-cierre-issues.md) | Action post-merge que cierra issues y seguimiento entre los proyectos "Hackaton" y "Main migrate" | Propuesto |

| [011](ADR-011-luna-lisa-fecha-relieve-al-final.md) | Luna lisa primero, fecha desde el inicio y relieve al final (capa 5) | Propuesto |

Estados: Propuesto, Aceptado, Reemplazado.
