# ADR-007: Formato de commits, hooks de Git y `develop` sin protección

- **Estado**: Aceptado
- **Fecha**: 2026-11-13
- **Decidieron**: equipo completo
- **Reemplaza en parte a**: ADR-003 (reglas de commits y protección de `develop`)

## Contexto
La rama `chore/git-hooks` agregó hooks (`.githooks/`) más estrictos que lo documentado en el ADR-003, `CLAUDE.md` y `docs/04-GIT-WORKFLOW.md`: scope obligatorio, mensajes en inglés, mínimo de 10 palabras y bloqueo de commits solo en `main`. La documentación decía otra cosa y `develop` figuraba como protegida sin que el hook la cubriera.

## Decisión
- **Formato**: `tipo(scope): descripción`, con tipos `feat`, `fix`, `docs`, `test`, `chore`.
- **Idioma**: los mensajes de commit van en inglés; el resto de la documentación sigue en español.
- **Largo**: mínimo 10 palabras en la primera línea, incluso para commits chicos.
- **Scopes sugeridos**: `web`, `ephemeris`, `terrain`, `data`, `tests`, `docs`, `scripts`. El hook acepta cualquiera en minúsculas, números, `_` o `-`.
- **Hooks**: se activan una vez por clon con `git config core.hooksPath .githooks`; `--no-verify` los saltea (solo emergencias).
- **Squash merge**: GitHub no ejecuta `commit-msg`, así que el título del PR debe seguir el mismo formato.
- **`develop` sin protección**: solo `main` queda protegida (hook y regla de GitHub). `develop` es el arenero del equipo; igual todo entra por PR por convención.

## Alternativas descartadas
- Proteger también `develop` con el hook: fricción sin beneficio, porque el flujo ya obliga a trabajar en ramas y entrar por PR.
- Mensajes en español: se prefirió inglés por ser el estándar de la herramienta y del historial.
- Mínimo de palabras menor: 10 es razonable y obliga a explicar qué y por qué.

## Consecuencias
- Hay que activar los hooks en cada clon nuevo; está en el checklist de `docs/04-GIT-WORKFLOW.md`.
- Un commit directo en `develop` no se bloquea: depende de respetar la convención.
- Los títulos de PR se revisan a mano, porque ningún hook los valida.
