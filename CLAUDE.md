# Lunar Landing Site Navigator: contexto para Claude

> Léelo completo antes de tocar código. Última actualización: 2026-11-13. Si algo de acá cambia, se cambia con un ADR (ver `docs/adr/`).

## Qué estamos construyendo
Una web que responde una pregunta: **si aterrizo en este lugar de la Luna en esta fecha, ¿voy a tener Sol y voy a poder comunicarme con la Tierra?**
El usuario elige un sitio (polo sur lunar) y una fecha; la web dibuja el horizonte real del lugar con el Sol y la Tierra encima y muestra horas de luz, horas con Tierra visible y cuenta regresiva hasta que se oculten.
Proyecto del NASA Space Apps Challenge 2026 (evento presencial, 14 y 15 de noviembre). Entregables: proyecto en GitHub + presentación.

## Arquitectura en 3 piezas (detalle en `docs/02-ARCHITECTURE.md`)
1. **Efemérides** (Python, offline): azimut y elevación del Sol y la Tierra por sitio y por hora, consultados a la **API de JPL Horizons** (recurso oficial; ADR-006). Carpeta `precompute/ephemeris/`.
2. **Terreno** (Python, offline): perfil de horizonte de 360 valores por sitio desde un mapa de elevación LOLA (fuente según ADR-006: Moon Trek/Quickmap o, como plan B, PDS). Carpeta `precompute/terrain/`.
3. **Web** (JS): lee los JSON precalculados y compara elevación del cuerpo contra horizonte. Carpeta `web/`.
Python y la web **solo se hablan por los JSON** de `data/public/`. El contrato está en `docs/03-DATA-CONTRACT.md` y los esquemas en `data/schema/`.

## Recursos oficiales del desafío (liberados el 13/11; ver ADR-006)
- **JPL Horizons**: posiciones del Sol y la Tierra vistas desde cualquier punto de la Luna. Es nuestra fuente de efemérides.
- **Quickmap** (Arizona State University, datos LRO) y **Moon Trek** (NASA): exploración del terreno y de los sitios; fuente de coordenadas y, si permiten exportarlo, del mapa de elevación.
- **Portal de Exploración lunar de la CSA** (Agencia Espacial Canadiense): contexto para el pitch.
- **No** se entregaron kernels SPICE ni archivos de mapas. No suponer que existen.

## Convenciones obligatorias (si dudás, preguntá antes de asumir)
- **Azimut**: grados, 0° = norte, sentido horario (90° = este). Rango [0, 360).
- **Elevación**: grados sobre el horizonte local. 0° = horizonte, 90° = cenit. Puede ser negativa.
- **Unidades**: ángulos en grados, distancias en **metros** en el código y kilómetros solo si el nombre del campo lo dice (`_km`). Tiempo en **UTC**, ISO 8601 (`2026-11-14T00:00:00Z`).
- **Coordenadas de sitios**: latitud planetocéntrica y longitud este-positiva, en grados, rango [-180, 180]. Cada sitio lleva su fuente.
- **Marco**: topocéntrico (desde la superficie en el punto del sitio, no desde el centro de la Luna).
- El Sol y la Tierra son **discos**, no puntos (radios angulares en el contrato).
- Los números **salen de JPL Horizons** y se verifican contra respuestas guardadas y contra su interfaz web (ADR-006). Un resultado que parece razonable pero no coincide es el peor error posible.

## Estructura del repo
```
CLAUDE.md            este archivo
docs/                contexto, PRD, arquitectura, contrato, workflow, roadmap, pitch, adr/
precompute/          Python offline (ephemeris/, terrain/), requirements.txt
tests/               pytest: contrato y validación contra Horizons
web/                 frontend (Vite)
data/raw/            datos pesados (mapa de elevación, caché de Horizons). NO se commitea
data/public/         JSON que consume la web. Se commitea
data/schema/         JSON Schema del contrato
scripts/             utilidades (labels, issues, datos sintéticos)
```

## Flujo de Git: MiniGitFlow (detalle en `docs/04-GIT-WORKFLOW.md`)
- `main` (demoable, protegida: el hook `pre-commit` bloquea commits directos) y `develop` (integración, es el arenero del equipo: sin protección técnica). **Nunca** se commitea directo en ninguna de las dos: todo entra por PR.
- Un issue, una rama: `feature/<n>-<slug>` o `fix/<n>-<slug>`, creada desde `develop`.
- PR hacia `develop`, 1 aprobación de otra persona, merge por squash. Las ramas mergeadas no se borran (nos sirven de historial durante el hackatón).
- Commits (los valida el hook `commit-msg`): `tipo(scope): descripción` **en inglés, de 10 palabras o más**. Tipos: `feat`, `fix`, `docs`, `test`, `chore`. Scope obligatorio y en minúsculas (`web`, `ephemeris`, `terrain`, `data`, `tests`, `docs`, `scripts`). Ejemplo: `feat(web): add site and date selector to the main map screen of the app`.
- El título del PR sigue el mismo formato (el squash merge de GitHub no pasa por el hook y ese título se vuelve el commit).
- Activar los hooks una vez por clon: `git config core.hooksPath .githooks`. `--no-verify` los saltea; no usarlo salvo emergencia.
- Si necesitás algo de otra rama, traelo desde `develop` o avisá en el PR.
- No commitear: mapa de elevación (`*.tif`), caché de Horizons (`data/raw/`), `.venv`, `node_modules`, notebooks. Scripts `.py`, no `.ipynb`.

## Cómo trabajar con Claude en este repo
1. Trabajá siempre sobre una rama de feature. Antes de empezar, confirmá en qué rama estás (`git branch --show-current`).
2. Pedí **primero el test con un caso conocido** y después la función.
3. Respetá el contrato de datos. Si hay que cambiarlo, se escribe un ADR y se avisa al equipo; no se cambia por la libre.
4. **No agregues funciones fuera del issue ni de la capa vigente** (ver "Fuera de alcance" en `docs/01-PRD.md`).
5. Claude no sabe si un ángulo está bien: los números se verifican contra Horizons con `tests/`.
6. Si algo es ambiguo, preguntá antes de inventar. No inventes coordenadas, fuentes ni valores de referencia.
7. Cambios chicos y PRs chicos. Si un issue pasa de ~4 horas, partirlo.

## Capas del MVP (cada una es una demo completa)
0. Base: repo, contrato, datos de prueba, deploy, tests contra Horizons. 1. Elegir sitio y fecha; ver az/el del Sol y la Tierra. 2. Horizonte real con Sol y Tierra encima. 3. Línea de tiempo y cuenta regresiva. 4. Comparación de escenarios. 5. Extras.
Objetivo realista: capas 1 a 3. **Recortar, no estirar.** Features congeladas el domingo 15 a las 12:30.

## Equipo
Equipo multirubro: no hay roles fijos. Todos trabajan en cualquier área (Python, web, producto y demo) y toman los issues que sigan en el tablero.

## Más contexto
`docs/00-CONTEXT.md` · `docs/01-PRD.md` · `docs/02-ARCHITECTURE.md` · `docs/03-DATA-CONTRACT.md` · `docs/04-GIT-WORKFLOW.md` · `docs/05-ROADMAP.md` · `docs/06-PITCH-DEMO.md` · `docs/07-DESAFIO-OFICIAL.md` (texto oficial) · `docs/adr/`
