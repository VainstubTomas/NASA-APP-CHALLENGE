# 04. Flujo de trabajo en Git: MiniGitFlow

Última actualización: 2026-11-13 · Estado: aceptado por el equipo

Un GitFlow reducido a lo útil para un hackatón de dos jornadas. Objetivo: que cada uno trabaje en su rama sin bloquear ni romper al resto. Es un equipo multirubro: todos tocan cualquier área y las reglas valen para todos por igual.

## Ramas
| Rama | Para qué | Reglas |
|---|---|---|
| `main` | Lo que se muestra y se entrega. Siempre demoable | Protegida (hook y regla de GitHub). Solo recibe merges desde `dev` en los hitos |
| `dev` | Integración del trabajo de todos. Es el arenero del equipo | Sin protección técnica (ni hook ni regla de GitHub). Por convención, todo entra por PR |
| `feature/<n>-<slug>` | Un issue, una rama (ej. `feature/12-horizon-profile`) | Nace de `dev`. Vida corta (menos de ~4 h). No se borra al mergear |
| `fix/<n>-<slug>` | Corrección de un bug | Igual que `feature` |

No usamos `release/*` ni `hotfix/*`: el "release" es mergear `dev` a `main` en un hito, y si `main` se rompe se revierte el merge y se arregla en un `fix/*`.

## Épicas
Una **épica** es un issue padre que agrupa todos los issues de una **capa** (fase) del MVP: hay una por cada capa (0 a 5) y una para la entrega. Representa una demo completa: la épica de la capa 2, por ejemplo, está cumplida cuando se ve el horizonte real con el Sol y la Tierra encima.
- **Cómo se reconoce**: el título empieza con `[EPICA]` (ej. `[EPICA] Capa 2: horizonte real con el Sol y la Tierra encima`) y lleva la etiqueta `tipo:epica` más la de su capa.
- **Qué contiene**: los issues de su capa cuelgan como **sub-issues** (función nativa de GitHub). En la épica se ve el avance (cuántos sub-issues están cerrados) y en cada issue, a qué épica pertenece.
- **Cómo se usa**: una épica **no se toma ni se trabaja directamente**: no lleva asignado, rama ni PR. Se trabaja en sus sub-issues y la épica se cierra cuando están todos cerrados (o descartados al recortar) y la demo de la capa funciona.
- **De dónde sale**: se define en `scripts/issues.json` (`epics`) y la crea `scripts/create_issues.py` junto con sus sub-issues. Un issue nuevo de una capa se cuelga de la épica de esa capa.
- Ver ADR-008.

## Tablero y dependencias
Tablero "Hackaton" (GitHub Projects #3). Columnas: `Backlog` → `Todo` → `In progress` → `Code review` → `Done`, más `Blocked`.
- Las épicas arrancan en `Todo` y los issues en `Backlog`. Cuando se arranca una capa, sus issues pasan a `Todo`.
- **Dependencias**: solo las reales de datos (por ejemplo, no hay efemérides sin la descarga de Horizons) se cargan como relación "blocked by" de GitHub, desde `blocked_by` en `scripts/issues.json`. Cada issue muestra qué lo frena, sin congelar a nadie: la mayor parte de la web avanza con datos sintéticos.
- **Columna `Blocked`**: solo para un issue que ya empezaste y en el que estás trabado (falta algo de otra persona, un dato, una respuesta). Avisá en el issue qué esperás. No se usa para marcar fases futuras.

## Ciclo de trabajo
1. Tomar un issue del tablero (nunca una épica) y asignártelo.
2. Crear la rama desde `dev`.
3. Trabajar con commits chicos.
4. Traer los últimos cambios de `dev` antes de abrir el PR.
5. Abrir el PR hacia `dev` con `Closes #n`.
6. Otra persona revisa (5 minutos): ¿corre?, ¿cumple el issue?, ¿rompe algo?
7. Merge por **squash** (recomendado: deja un commit por issue; GitHub permite también merge commit y rebase, no los bloqueamos). La rama se conserva: durante el hackatón es útil poder volver a ella.

## Reglas de PR
- Un PR por issue, descripción corta (la plantilla ayuda).
- El título del PR sigue la regla de commits (ver abajo, 10 palabras o más): si se mergea por squash, se usa ese título como mensaje del commit y no pasa por el hook `commit-msg`.
- 1 aprobación de cualquier otro integrante.
- Si tocás una carpeta que otra persona está modificando, avisalo en el PR.
- `dev` roto es prioridad de todos.

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
- `pre-commit`: bloquea commits directos en `main`. `dev` no se bloquea a propósito: es el arenero del equipo, y como todo entra por PR no hace falta.
- `git commit --no-verify` los saltea. Usalo solo en una emergencia.
- Los hooks no ven los squash merges de GitHub: por eso el **título del PR** también debe ser descriptivo, de 10 palabras o más.

## Qué NO va a git
Mapa de elevación (`*.tif`), caché de Horizons (`data/raw/`), `.venv`, `node_modules`, notebooks. Scripts `.py` en lugar de `.ipynb`. Los datos pesados se comparten por la nube. Los JSON de `data/public/` sí se versionan y los genera un script.

## Hitos: merges de `dev` a `main`
| Cuándo | Qué debe estar en `main` |
|---|---|
| Vie 13 (noche) | Capa 0: repo, contrato, deploy de prueba, Sol validado contra Horizons |
| Sáb 14, antes de las 14:30 | Demo mínima (capas 1 y 2 si se puede) |
| Sáb 14 / dom 15, ~01:00 | Lo que funcione tras la sesión larga |
| Dom 15, 12:30 | Congelamiento de features. Después solo `fix/*` |
| Dom 15, 14:30 | Versión final y subida a GitHub |

Antes de cada merge a `main`: prueba rápida de la web desplegada. En la sesión de la noche, con cansancio, lo que se rompe se rompe en `dev`, nunca en `main`.

## Automatizaciones
Qué hace GitHub solo cuando se mergea un PR, y qué queda configurado a mano. Ver ADR-010.

### Capas de protección
| Dónde | Qué | Cómo |
|---|---|---|
| Local (cada clon) | Hooks `commit-msg` y `pre-commit` | `.githooks/` (ver "Hooks" arriba) |
| Servidor (GitHub) | Ruleset `main-protector` sobre la rama por defecto (`main`) | PR con 1 aprobación, bloquea force push, borrado y creación; los tres métodos de merge permitidos |
| Servidor (GitHub) | Action `post-merge` | Cierra y etiqueta las issues del PR mergeado (ver abajo) |
| GitHub Projects | Workflows de los tableros | Mueven la issue entre columnas y entre proyectos |

Los hooks y el ruleset se complementan: los hooks frenan antes del push en tu máquina; el ruleset frena en GitHub aunque alguien no haya activado los hooks o use `--no-verify`. `dev` queda fuera del ruleset a propósito (ADR-007).

### Action `post-merge` (`.github/workflows/post-merge.yml`)
**Para qué**: cuando un PR se mergea, cerrar la issue que resuelve y ponerle la etiqueta `ready:to:main`, sin depender de que el PR diga `Closes #n`. Hace falta porque `Closes #n` solo cierra la issue automáticamente si el PR va a la rama por defecto (`main`), y nuestros PRs van a `dev`.

- **Disparador**: `pull_request` de tipo `closed`, solo si `merged == true` (un PR cerrado sin mergear no hace nada).
- **Permisos**: `issues: write` y `pull-requests: read`, con el `GITHUB_TOKEN` del propio workflow.
- **Cómo encuentra las issues** (une ambas vías y quita duplicados):
  1. Las issues linkeadas al PR, vía GraphQL `closingIssuesReferences` (cubre `Closes #n` en la descripción y el link manual del panel *Development*).
  2. El número del nombre de la rama: `feature/<n>-...` o `fix/<n>-...`.
- **Qué hace con cada una**: crea la etiqueta `ready:to:main` si no existe, se la agrega y cierra la issue como *completed*.
- **Efecto en cadena**: al cerrarse la issue, los workflows de los tableros la pasan a `Done` en "Hackaton" y la agregan a "Main migrate" (ver abajo).
- **Dónde tiene que estar**: GitHub ejecuta el workflow que está en la rama **base** del PR. Hoy está en `dev`; todavía no en `main`.

Cuidados:
- Si la rama lleva el número de una issue que el PR no termina de resolver, la issue se cierra igual. Lo aceptamos por la regla "un PR por issue"; si pasa, se reabre a mano.
- Sin verificar: si `closingIssuesReferences` devuelve datos cuando el PR no va a la rama por defecto. Por eso existe el respaldo por nombre de rama: **respetá el formato `feature/<n>-<slug>`**.

### Tableros de GitHub Projects y su relación
Una misma issue puede estar en varios proyectos a la vez: no se duplica, se agrega al otro proyecto.

| Proyecto | Para qué | Columnas (`Status`) | Otros campos |
|---|---|---|---|
| **A: "Hackaton 🪐"** (Project #3) | Trabajo del hackatón | `Backlog`, `Todo`, `In progress`, `Blocked`, `Code review`, `Done` | `Priority` (P0 a P2), `Size` (XS a XL) |
| **B: "Main migrate 🚀"** (Project #4) | Seguimiento de issues cerradas en `dev` que tienen que llegar a `main` | `From dev`, `Agrupation`, `Migrated` | |

Flujo esperado:
1. El PR se mergea en `dev` → la Action cierra la issue y le pone `ready:to:main`.
2. En A, los workflows "Item closed" / "Auto-close issue" la dejan en `Done`.
3. En B, "Auto-add to project" la agrega (filtro del tipo `is:issue is:closed label:ready:to:main`; sin etiqueta en el filtro entra toda issue cerrada).
4. En B, "Item added to project" la deja en `From dev`.
5. Al mergear `dev` a `main` en un hito, se mueven a mano a `Agrupation` / `Migrated`.

Workflows activos (confirmado por API): en ambos proyectos, *Auto-add sub-issues*, *Auto-add to project*, *Auto-close issue*, *Item added to project*, *Item closed* y *Pull request merged*. *Pull request linked to issue* está activo en A y desactivado en B.

Problema conocido: algunas issues cayeron directo en `Migrated` en B (el último estado). Causa probable: "Item added to project" o "Item closed" de B configurado con `Status: Migrated`. Corrección:
- En B, `Workflows > Item added to project > Set Status: From dev`.
- En B, desactivar "Item closed" o cambiarle el estado.
- Las issues que ya cayeron en `Migrated` se mueven a mano a `From dev`.

Límites:
- Los workflows de los tableros solo se editan desde la web de GitHub (no se pueden leer ni cambiar por API).
- El plan gratuito limita la cantidad de workflows de *auto-add*.
- El filtro de *Auto-add to project* de B tiene que usar la misma etiqueta que pone la Action (`ready:to:main`).

### Checklist de configuración
| Tarea | Estado |
|---|---|
| Ruleset `main-protector` para `main` | Hecho (verificado por API) |
| Rama `dev` en GitHub | Hecho |
| `post-merge.yml` en `dev` | Hecho |
| `post-merge.yml` en `main` | Pendiente: llega con el próximo merge de `dev` a `main` |
| B: "Item added to project" → `From dev` | Indicado a mano; sin verificar (no es legible por API) |
| B: desactivar o corregir "Item closed" | Pendiente |
| B: filtro de "Auto-add to project" con `label:ready:to:main` | A confirmar en la web |
| "Automatically delete head branches" desactivado | A confirmar en `Settings > General` |

## Configuración inicial del repo (una sola vez)
En GitHub, `Settings > Branches > Add branch ruleset` para `main` (`dev` queda sin protección a propósito, ver ADR-007):
- Require a pull request before merging, con 1 aprobación.
- Block force pushes.
- En el ruleset, dejar los tres métodos de merge permitidos (sin limitantes). Squash es lo recomendado, pero no se fuerza.
- Dejar desactivado "Automatically delete head branches": las ramas mergeadas se conservan a propósito.
Luego correr `scripts/create_labels.sh` y `scripts/create_issues.py` (necesitan `gh auth login` con el scope `project`: `gh auth refresh -s project`). El script crea las épicas, los issues como sub-issues de su épica y los agrega al tablero "Hackaton" (Project #3): las épicas en la columna `Todo` y los issues en `Backlog`.

### Por cada clon (cada integrante)
- `git config core.hooksPath .githooks` para activar los hooks de commits.

## Chuleta de comandos
```bash
git clone https://github.com/VainstubTomas/NASA-APP-CHALLENGE.git
git switch dev && git pull origin dev
git switch -c feature/12-horizon-profile        # crear rama desde dev
git add <archivos> && git commit -m "feat(terrain): add horizon profile computation for a single site and date"
git fetch origin && git merge origin/dev     # traer lo último de dev
git push -u origin feature/12-horizon-profile
gh pr create --base dev                      # o desde la web de GitHub
```
Si algo sale mal, no borres nada: pedí ayuda a alguien que ya use Git. Con Claude CLI disponés de `/start-issue <n>` y `/ready-for-pr`.

## Ayuda para quien nunca lo usó
Dos de nosotros usamos GitFlow en el trabajo. Los primeros PRs de quienes están empezando se hacen en pareja con uno de ellos (15 minutos el jueves con un ejemplo real).
