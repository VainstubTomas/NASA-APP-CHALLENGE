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
   - **A verificar con un caso conocido antes de generar todos los sitios** (se anota el resultado acá; verificado en C0-04 el 2026-11-14 con `precompute/ephemeris/horizons_client.py` y `tests/test_horizons_client.py`):
     - [x] El azimut de Horizons es 0° = norte y crece en sentido horario. La respuesta lo declara ("Azimuth is measured clockwise from north: North(0) -> East(90) -> South(180) -> West(270)"), y lo confirman dos casos conocidos: en el ecuador lunar el Sol sale con azimut de unos 90° y se pone con unos 270°, y desde 0°N 30°E la Tierra queda al oeste (azimut de unos 278°).
     - [x] La longitud de `SITE_COORD` es este-positiva. El encabezado dice `Center geodetic : 30.0, 0.0, 0.0 {E-lon(deg),Lat(deg),Alt(km)}` y `Center pole/equ : MEAN_ME {East-longitude positive}`. El parser falla si Horizons devuelve otra unidad o un sitio distinto del pedido.
     - [x] La latitud de la consulta coincide con nuestra latitud planetocéntrica. Con `COORD_TYPE=GEODETIC`, Horizons modela la Luna como una esfera (`Center radii : 1737.4, 1737.4, 1737.4 km`), y sobre una esfera la latitud geodética y la planetocéntrica son la misma.
     - [x] La escala de tiempo de la salida es UTC. La columna es `Date__(UT)__HR:MN` y la respuesta aclara que "Times AFTER 1962 are in UTC". Para fechas futuras Horizons usa el último segundo intercalar conocido, lo que no afecta a un paso de 1 h.
     - [x] El límite de filas por consulta y cómo partir el rango: **90 000 instantes**. Con más, Horizons devuelve error ("Output length exceeded, 90648 times requested, max. is 90000") en vez de truncar. El cliente parte el rango en tramos de 90 000 (`split_range`); con paso de 1 h, eso son unos 10 años por consulta.
   - **Consulta confirmada contra la API** (`https://ssd.jpl.nasa.gov/api/horizons.api`): `format=json`, `COMMAND='10'|'399'`, `OBJ_DATA='NO'`, `MAKE_EPHEM='YES'`, `EPHEM_TYPE='OBSERVER'`, `CENTER='coord@301'`, `COORD_TYPE='GEODETIC'`, `SITE_COORD='<E-lon>,<lat>,0'`, `START_TIME`/`STOP_TIME` en UTC (`'YYYY-MM-DD HH:MM'`, inclusivos), `STEP_SIZE='60 m'`, `QUANTITIES='4'`, `ANG_FORMAT='DEG'`, `APPARENT='AIRLESS'`, `CSV_FORMAT='YES'`, `TIME_TYPE='UT'`. Las columnas que se leen son `Azi_(a-app)` y `Elev_(a-app)`: azimut y elevación aparentes sin atmósfera, del **centro** del disco y topocéntricos.
   - **Comparación manual con la interfaz web de Horizons** (C0-04). Valores del cliente; falta que una persona los cargue en <https://ssd.jpl.nasa.gov/horizons/app.html> con los mismos parámetros (Observer Table, observador `coord@301` en las coordenadas de la tabla, cantidad 4, sin refracción, salida en grados) y complete la columna "Web". Los puntos son geométricos y no sitios de aterrizaje: la lista real de sitios es C0-07. La tolerancia es la del ADR-005 (0,1°).

     | Lat, E-lon (°) | UTC | Cuerpo | Az cliente (°) | El cliente (°) | Web: az / el | ¿Coincide? |
     |---|---|---|---|---|---|---|
     | 0, 0 | 2026-11-14T00:00:00Z | Sol | 91.939942 | -36.602284 | | |
     | 0, 0 | 2026-11-21T12:00:00Z | Sol | 92.657444 | 54.591315 | | |
     | 0, 0 | 2026-11-30T06:00:00Z | Sol | 268.437933 | 19.173705 | | |
     | 0, 0 | 2026-11-14T00:00:00Z | Tierra | 344.456450 | 85.409203 | | |
     | 0, 0 | 2026-11-21T12:00:00Z | Tierra | 232.654574 | 81.449201 | | |
     | 0, 0 | 2026-11-30T06:00:00Z | Tierra | 88.488658 | 83.696534 | | |
     | 0, 30 | 2026-11-14T00:00:00Z | Sol | 91.567718 | -6.615682 | | |
     | 0, 30 | 2026-11-21T12:00:00Z | Sol | 105.995387 | 84.405446 | | |
     | 0, 30 | 2026-11-30T06:00:00Z | Sol | 268.497923 | -10.816083 | | |
     | 0, 30 | 2026-11-14T00:00:00Z | Tierra | 278.449072 | 58.366038 | | |
     | 0, 30 | 2026-11-21T12:00:00Z | Tierra | 261.438845 | 52.746055 | | |
     | 0, 30 | 2026-11-30T06:00:00Z | Tierra | 270.410409 | 66.163503 | | |
     | -89.5, 0 | 2026-11-14T00:00:00Z | Sol | 126.627333 | 1.258335 | | |
     | -89.5, 0 | 2026-11-21T12:00:00Z | Sol | 35.387998 | 1.946330 | | |
     | -89.5, 0 | 2026-11-30T06:00:00Z | Sol | 289.168108 | 1.638940 | | |
     | -89.5, 0 | 2026-11-14T00:00:00Z | Tierra | 358.773423 | -4.148545 | | |
     | -89.5, 0 | 2026-11-21T12:00:00Z | Tierra | 353.209670 | 5.383071 | | |
     | -89.5, 0 | 2026-11-30T06:00:00Z | Tierra | 6.272055 | 0.064782 | | |

     Para repetir una fila: `python -m precompute.ephemeris.horizons_client --lat <lat> --lon <lon> --body sun|earth --start <UTC> --stop <UTC>`.
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
