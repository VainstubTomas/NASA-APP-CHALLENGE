# 04. Flujo de trabajo en Git: MiniGitFlow

Última actualización: 2026-11-13 · Estado: aceptado por el equipo

Un GitFlow reducido a lo útil para un hackatón de dos jornadas. Objetivo: que cada uno trabaje en su rama sin bloquear ni romper al resto. Es un equipo multirubro: todos tocan cualquier área y las reglas valen para todos por igual.

## Ramas
| Rama | Para qué | Reglas |
|---|---|---|
| `main` | Lo que se muestra y se entrega. Siempre demoable | Protegida (hook y regla de GitHub). Solo recibe merges desde `develop` en los hitos |
| `develop` | Integración del trabajo de todos. Es el arenero del equipo | Sin protección técnica (ni hook ni regla de GitHub). Por convención, todo entra por PR |
| `feature/<n>-<slug>` | Un issue, una rama (ej. `feature/12-horizon-profile`) | Nace de `develop`. Vida corta (menos de ~4 h). No se borra al mergear |
| `fix/<n>-<slug>` | Corrección de un bug | Igual que `feature` |

No usamos `release/*` ni `hotfix/*`: el "release" es mergear `develop` a `main` en un hito, y si `main` se rompe se revierte el merge y se arregla en un `fix/*`.

## Ciclo de trabajo
1. Tomar un issue del tablero y asignártelo.
2. Crear la rama desde `develop`.
3. Trabajar con commits chicos.
4. Traer los últimos cambios de `develop` antes de abrir el PR.
5. Abrir el PR hacia `develop` con `Closes #n`.
6. Otra persona revisa (5 minutos): ¿corre?, ¿cumple el issue?, ¿rompe algo?
7. Merge por **squash** (recomendado: deja un commit por issue; GitHub permite también merge commit y rebase, no los bloqueamos). La rama se conserva: durante el hackatón es útil poder volver a ella.

## Reglas de PR
- Un PR por issue, descripción corta (la plantilla ayuda).
- El título del PR sigue la regla de commits (ver abajo, 10 palabras o más): si se mergea por squash, se usa ese título como mensaje del commit y no pasa por el hook `commit-msg`.
- 1 aprobación de cualquier otro integrante.
- Si tocás una carpeta que otra persona está modificando, avisalo en el PR.
- `develop` roto es prioridad de todos.

## Commits
La única regla que valida el hook es el **largo**; el resto es convención del equipo. Así se pueden usar los mensajes que genera el IDE con IA.
- **Largo (obligatorio)**: la primera línea tiene 10 palabras o más. Contá qué cambia y por qué, para que el equipo lo entienda sin abrir el código.
- **Idioma (convención)**: inglés, aunque la documentación esté en español. El hook no lo verifica.
- **Formato sugerido (no obligatorio)**: `tipo(scope): descripción`, con tipos `feat`, `fix`, `docs`, `test` o `chore` y scopes como `web`, `ephemeris`, `terrain`, `data`, `tests`, `docs`, `scripts`. Si el IDE genera otro estilo, se acepta mientras cumpla el largo.
- Los merges y reverts automáticos de Git pasan sin validar.

Ejemplo sugerido: `feat(web): add site and date selector to the main map screen of the app`.
Ejemplo que el hook rechaza: `feat: perfil de horizonte` (menos de 10 palabras).

### Hooks
Viven en `.githooks/` y se activan **una vez por clon**:
```bash
git config core.hooksPath .githooks
```
- `commit-msg`: valida que la primera línea tenga 10 palabras o más.
- `pre-commit`: bloquea commits directos en `main`. `develop` no se bloquea a propósito: es el arenero del equipo, y como todo entra por PR no hace falta.
- `git commit --no-verify` los saltea. Usalo solo en una emergencia.
- Los hooks no ven los squash merges de GitHub: por eso el **título del PR** también debe ser descriptivo, de 10 palabras o más.

## Qué NO va a git
Mapa de elevación (`*.tif`), caché de Horizons (`data/raw/`), `.venv`, `node_modules`, notebooks. Scripts `.py` en lugar de `.ipynb`. Los datos pesados se comparten por la nube. Los JSON de `data/public/` sí se versionan y los genera un script.

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
En GitHub, `Settings > Branches > Add branch ruleset` para `main` (`develop` queda sin protección a propósito, ver ADR-007):
- Require a pull request before merging, con 1 aprobación.
- Block force pushes.
- En el ruleset, dejar los tres métodos de merge permitidos (sin limitantes). Squash es lo recomendado, pero no se fuerza.
- Dejar desactivado "Automatically delete head branches": las ramas mergeadas se conservan a propósito.
Luego correr `scripts/create_labels.sh` y `scripts/create_issues.py` (necesitan `gh auth login`).

### Por cada clon (cada integrante)
- `git config core.hooksPath .githooks` para activar los hooks de commits.

## Chuleta de comandos
```bash
git clone https://github.com/VainstubTomas/NASA-APP-CHALLENGE.git
git switch develop && git pull origin develop
git switch -c feature/12-horizon-profile        # crear rama desde develop
git add <archivos> && git commit -m "feat(terrain): add horizon profile computation for a single site and date"
git fetch origin && git merge origin/develop     # traer lo último de develop
git push -u origin feature/12-horizon-profile
gh pr create --base develop                      # o desde la web de GitHub
```
Si algo sale mal, no borres nada: pedí ayuda a alguien que ya use Git. Con Claude CLI disponés de `/start-issue <n>` y `/ready-for-pr`.

## Ayuda para quien nunca lo usó
Dos de nosotros usamos GitFlow en el trabajo. Los primeros PRs de quienes están empezando se hacen en pareja con uno de ellos (15 minutos el jueves con un ejemplo real).
