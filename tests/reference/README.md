# Referencia de Horizons (C0-05)

Valores de azimut y elevación del Sol y la Tierra desde tres sitios de alunizaje, obtenidos de la API de JPL Horizons (ADR-005, ADR-006). Los tests (`tests/test_ephemeris_horizons.py`) los usan sin red.

- `raw/`: respuestas crudas de Horizons. Cada archivo tiene la consulta exacta (`query`), la URL y la fecha de descarga.
- `horizons_reference.csv`: filas derivadas de `raw/` (sitio, cuerpo, tiempo UTC, azimut, elevación).

Sitios (coordenadas de la lista verificada de issue 17, fuente NASA NSSDCA / LRO, Wagner et al. 2017): Apolo 12, Apolo 15, Apolo 16. Fechas: 2026-11-14, 2027-03-20 y 2027-06-21, 24 muestras de 1 h en UTC cada una.

Regenerar (requiere red): `.venv\Scripts\python.exe scripts\make_horizons_reference.py`. Si Horizons cambia sus valores, el test del parser falla y hay que revisar antes de actualizar.
