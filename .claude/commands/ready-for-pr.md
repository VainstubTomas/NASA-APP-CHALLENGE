---
description: Deja la rama lista y abre el PR hacia dev. Uso: /ready-for-pr
---

Preparar el PR de la rama actual siguiendo `docs/04-GIT-WORKFLOW.md`:

1. Confirmar que la rama NO es `main` ni `dev` (`git branch --show-current`). Si lo es, parar.
2. Correr los tests que apliquen (`python -m pytest tests/` para Python; `npm run build` dentro de `web/` si se tocó la web).
3. Traer los últimos cambios: `git fetch origin && git merge origin/dev`. Si hay conflictos, resolverlos con la persona y no perder cambios de otros.
4. Verificar que no se agregan archivos pesados ni notebooks (`git status`, `git diff --stat`).
5. Commit con primera línea de 10 palabras o más, en inglés y con el formato sugerido `tipo(scope): descripción` (ver `docs/04-GIT-WORKFLOW.md`), `git push -u origin <rama>`.
6. `gh pr create --base dev` usando la plantilla de `.github/PULL_REQUEST_TEMPLATE.md` y `Closes #<n>`.
