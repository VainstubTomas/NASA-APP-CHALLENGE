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
- `main` (demoable, protegida) y `develop` (integración, protegida). **Nunca** commitear directo en ninguna de las dos.
- Un issue, una rama: `feature/<n>-<slug>` o `fix/<n>-<slug>`, creada desde `develop`.
- PR hacia `develop`, 1 aprobación de otra persona, merge por squash, borrar la rama.
- Commits: `feat:`, `fix:`, `docs:`, `test:`, `chore:` + descripción corta.
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

## Equipo y foco inicial (no es exclusivo)
Backend, datos y lógica: Toto y Panchi. Frontend: Fer y Facu. Producto, contenido y demo: todos.

## Más contexto
`docs/00-CONTEXT.md` · `docs/01-PRD.md` · `docs/02-ARCHITECTURE.md` · `docs/03-DATA-CONTRACT.md` · `docs/04-GIT-WORKFLOW.md` · `docs/05-ROADMAP.md` · `docs/06-PITCH-DEMO.md` · `docs/adr/`
