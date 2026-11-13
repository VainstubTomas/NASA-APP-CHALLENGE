# 04. Flujo de trabajo en Git: MiniGitFlow

Última actualización: 2026-11-12 · Estado: aceptado por el equipo

Un GitFlow reducido a lo útil para un hackatón de dos jornadas. Objetivo: que cada uno trabaje en su rama sin bloquear ni romper al resto.

## Ramas
| Rama | Para qué | Reglas |
|---|---|---|
| `main` | Lo que se muestra y se entrega. Siempre demoable | Protegida. Solo recibe merges desde `develop` en los hitos |
| `develop` | Integración del trabajo de todos | Protegida. Solo entra código por PR |
| `feature/<n>-<slug>` | Un issue, una rama (ej. `feature/12-horizon-profile`) | Nace de `develop`. Vida corta (menos de ~4 h). Se borra al mergear |
| `fix/<n>-<slug>` | Corrección de un bug | Igual que `feature` |

No usamos `release/*` ni `hotfix/*`: el "release" es mergear `develop` a `main` en un hito, y si `main` se rompe se revierte el merge y se arregla en un `fix/*`.

## Ciclo de trabajo
1. Tomar un issue del tablero y asignártelo.
2. Crear la rama desde `develop`.
3. Trabajar con commits chicos.
4. Traer los últimos cambios de `develop` antes de abrir el PR.
5. Abrir el PR hacia `develop` con `Closes #n`.
6. Otra persona revisa (5 minutos): ¿corre?, ¿cumple el issue?, ¿rompe algo?
7. Merge por **squash** y borrar la rama.

## Reglas de PR
- Un PR por issue, descripción corta (la plantilla ayuda).
- 1 aprobación de cualquier otro integrante.
- Si tocás la carpeta principal de otra área, avisalo en el PR.
- `develop` roto es prioridad de todos.

## Commits
Prefijo + descripción corta: `feat:`, `fix:`, `docs:`, `test:`, `chore:`. Ejemplo: `feat: perfil de horizonte para un sitio`.

## Qué NO va a git
Mapa LOLA (`*.tif`), kernels SPICE, `.venv`, `node_modules`, notebooks. Scripts `.py` en lugar de `.ipynb`. Los datos pesados se comparten por la nube. Los JSON de `data/public/` sí se versionan y los genera un script.

## Hitos: merges de `develop` a `main`
| Cuándo | Qué debe estar en `main` |
|---|---|
| Vie 13 (noche) | Capa 0: repo, contrato, deploy de prueba, Sol validado contra Horizons |
| Sáb 14, antes de las 14:30 | Demo mínima (capas 1 y 2 si se puede) |
| Sáb 14 / dom 15, ~01:00 | Lo que funcione tras la sesión larga |
| Dom 15, 12:30 | Congelamiento de features. Después solo `fix/*` |
| Dom 15, 14:30 | Versión final y subida a GitHub |

Antes de cada merge a `main`: prueba rápida de la web desplegada. En la sesión de la noche, con cansancio, lo que se rompe se rompe en `develop`, nunca en `main`.

## Configuración inicial del repo (una sola vez)
En GitHub, `Settings > Branches > Add branch ruleset` para `main` y `develop`:
- Require a pull request before merging, con 1 aprobación.
- Block force pushes.
- Permitir solo "Squash and merge" en `Settings > General > Pull Requests`.
- Activar "Automatically delete head branches".
Luego correr `scripts/create_labels.sh` y `scripts/create_issues.py` (necesitan `gh auth login`).

## Chuleta de comandos
```bash
git clone https://github.com/VainstubTomas/NASA-APP-CHALLENGE.git
git switch develop && git pull origin develop
git switch -c feature/12-horizon-profile        # crear rama desde develop
git add <archivos> && git commit -m "feat: perfil de horizonte"
git fetch origin && git merge origin/develop     # traer lo último de develop
git push -u origin feature/12-horizon-profile
gh pr create --base develop                      # o desde la web de GitHub
```
Si algo sale mal, no borres nada: pedí ayuda a alguien que ya use Git. Con Claude CLI disponés de `/start-issue <n>` y `/ready-for-pr`.

## Ayuda para quien nunca lo usó
Dos de nosotros usamos GitFlow en el trabajo. Los primeros PRs de quienes están empezando se hacen en pareja con uno de ellos (15 minutos el jueves con un ejemplo real).
