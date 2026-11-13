---
description: Crea la rama de trabajo para un issue (MiniGitFlow). Uso: /start-issue <número>
---

Preparar el trabajo para el issue #$ARGUMENTS siguiendo `docs/04-GIT-WORKFLOW.md`:

1. Leer el issue con `gh issue view $ARGUMENTS` (si `gh` no está logueado, pedir título y criterio de aceptación).
2. Verificar que no hay cambios sin commitear (`git status`). Si los hay, parar y avisar.
3. `git switch develop && git pull origin develop`.
4. Crear la rama `feature/$ARGUMENTS-<slug-corto-del-titulo>` desde `develop` (usar `fix/` si es un bug).
5. Resumir en 3 líneas qué hay que hacer y cuál es el criterio de aceptación. Proponer primero el test.

No commitear nada en `main` ni en `develop`.
