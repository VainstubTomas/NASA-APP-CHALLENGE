# ADR-006: Recursos oficiales: Horizons como fuente de efemérides y mapa de elevación por confirmar

- **Estado**: Aceptado (el uso de la API de Horizons como fuente fue indicado por el organizador del evento; los puntos "a verificar" y la fuente del mapa de elevación se cierran en C0-04 y, para el mapa de elevación, en C5-05, antes C0-03: ADR-011 lo movió al final de la capa 5)
- **Fecha**: 2026-11-13
- **Decidieron**: el organizador del evento (uso de Horizons) y el equipo

## Contexto
El repo se armó antes de que se liberaran los recursos y supuso que la pestaña Recursos traería kernels SPICE y el mapa de elevación LOLA `LDEM_80S_80MPP_ADJ.TIF`. Los recursos reales, publicados el 13/11, son otros:

| Recurso | Qué ofrece |
|---|---|
| **JPL Horizons** (NASA/JPL) | Posiciones del Sol y la Tierra vistas desde cualquier punto de la Luna |
| **Quickmap** (Arizona State University, datos del LRO) | Mapa interactivo con imágenes de alta resolución y topografía |
| **Moon Trek** (NASA) | Visualización 3D de la superficie y su topografía |
| **Exploración lunar de la CSA** (Agencia Espacial Canadiense) | Portal sobre misiones y el aporte de Canadá a Artemis |

No se entregaron archivos de datos: ni kernels ni mapas.

## Decisión
1. **Efemérides: la API de JPL Horizons es la fuente** (antes era solo la referencia de validación). Se descarta SPICE.
   - Consulta por sitio y por cuerpo: tabla de observador, Sol (`10`) y Tierra (`399`), observador en la superficie lunar (`CENTER='coord@301'`), azimut y elevación (`QUANTITIES=4`) en grados, paso de 1 h, sin refracción, en UTC. Los nombres exactos de los parámetros se confirman contra la documentación de la API en C0-04.
   - Las respuestas crudas se guardan en `data/raw/horizons/` (no versionado, con copia en la nube) para no depender de Horizons durante el evento.
   - **A verificar con un caso conocido antes de generar todos los sitios** (se anota el resultado acá):
     - [ ] El azimut de Horizons es 0° = norte y crece en sentido horario.
     - [ ] La longitud de `SITE_COORD` es este-positiva.
     - [ ] La latitud de la consulta coincide con nuestra latitud planetocéntrica.
     - [ ] La escala de tiempo de la salida es UTC.
     - [ ] El límite de filas por consulta y cómo partir el rango.
2. **Terreno: el mapa de elevación sale de Moon Trek o de Quickmap, si permiten exportarlo** (C5-05, antes C0-03; ADR-011, timebox de 1 h). El cálculo del horizonte (pieza 2) no cambia.
   - Plan B: `LDEM_80S_80MPP_ADJ.TIF` del archivo PDS de LOLA (dato público de NASA, fuera de la lista de recursos), solo con el OK de los organizadores (C0-11).
   - Plan C: si no hay mapa a tiempo, se recorta a la capa 1 (sin horizonte real), según la regla "recortar, no estirar".
   - Fuente elegida (completar en C5-05): producto, resolución y proyección.
3. **Validación** (reemplaza en parte al ADR-005): como Horizons es la fuente, se verifica que **lo leemos bien**.
   - Tests contra respuestas de Horizons guardadas en `tests/reference/`, con la consulta exacta que las generó.
   - Comparación manual con la interfaz web de Horizons en 3 sitios y 3 fechas.
   - El terreno se compara a grandes rasgos contra mapas de iluminación (por ejemplo, de Quickmap, si los ofrece).
4. **Contrato de datos: sin cambios de esquema** (`schema_version` sigue en 1.0). Solo cambian los valores de `ephemeris.source` y `horizon.dem`, que son texto libre.
5. **Sitios**: las coordenadas se verifican en Quickmap o Moon Trek y se citan con su enlace en `source_url`.
6. **Pitch**: Quickmap, Moon Trek y Horizons son "las herramientas potentes pero complejas de hoy"; el portal de la CSA aporta contexto internacional (C0-12).

## Alternativas descartadas
- Seguir con SPICE: no es un recurso del desafío, suma kernels pesados y un cálculo propio que igual habría que validar contra Horizons.
- Pedirle a Horizons el horizonte o el relieve: Horizons no modela el terreno local; para eso sigue haciendo falta el mapa de elevación.

## Consecuencias
- `precompute/requirements.txt`: sale `spiceypy` y entra `requests`.
- Se reescriben los issues C0-02, C0-03, C0-04, C0-05, C0-06, C0-11, C1-01 y C2-01, y se agrega C0-12.
- Horizons pasa a ser una dependencia externa: hay que descargar todo antes del sábado y trabajar desde el caché.
- El texto oficial del desafío ya está en `docs/07-DESAFIO-OFICIAL.md`. Queda pendiente confirmar los criterios de evaluación con los organizadores (C0-11): la página del desafío no los publica.
