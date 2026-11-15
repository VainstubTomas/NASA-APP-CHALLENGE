> 🇬🇧 [Read in English](en/09-API.md)

# 09. API de efemérides en vivo

Última actualización: 2026-11-15 · Decisión: [ADR-015](adr/ADR-015-api-horizons-en-vivo.md) · Código: [`data/api/`](../data/api/) · Issue: #104

## Para qué sirve
Los sitios de `data/public/sites.json` tienen sus efemérides precalculadas. Para un punto **cualquiera** de la Luna (latitud y longitud que elige la persona) no hay datos guardados, así que la web se los pide a esta API. La API consulta **JPL Horizons** y responde con el mismo formato que `ephemeris.json` ([contrato](03-DATA-CONTRACT.md)).

La web no llama a Horizons directamente: Horizons no permite pedidos desde el navegador (CORS). Por eso hace falta este intermediario. Los sitios precalculados siguen funcionando sin la API y sin conexión.

## Probarla en 1 minuto
Desde la raíz del repo:
```bash
pip install -r data/api/requirements.txt
python -m uvicorn data.api.main:app --reload --port 8000
```
- **Swagger UI**: <http://localhost:8000/docs>. Abrir `GET /ephemeris` → *Try it out* → *Execute*. Los parámetros ya traen ejemplos.
- **curl**:
  ```bash
  curl "http://localhost:8000/ephemeris?lat=0&lon=30&start=2026-11-30T06:00:00Z&days=1"
  ```
- Esquema OpenAPI: <http://localhost:8000/openapi.json>.

## El endpoint
`GET /ephemeris?lat=<°>&lon=<°>&start=<UTC>&days=<n>`

| Parámetro | Qué es | Rango |
|---|---|---|
| `lat` | Latitud planetocéntrica, grados | -90 a 90 |
| `lon` | Longitud este-positiva, grados | -180 a 180 |
| `start` | Inicio, UTC ISO 8601 (`2026-11-30T06:00:00Z`) | 2026-11-01 a 2027-02-28 |
| `days` | Días de la ventana, una muestra por hora. Por defecto 7 | 1 a 14. Si pasa del 2027-02-28 se recorta |

Convenciones: azimut en grados con 0° = norte y sentido horario; elevación en grados sobre el horizonte; tiempo en UTC; marco topocéntrico (desde el punto elegido). Son las mismas del resto del proyecto.

### Ejemplo de respuesta
Para `lat=0&lon=30&start=2026-11-30T06:00:00Z&days=1` (se muestran solo las primeras 3 de las 24 muestras; valores de ejemplo con el formato real, no verificados contra Horizons):
```json
{
  "schema_version": "1.0",
  "site_id": "live-n0p0-e30p0",
  "time": { "start_utc": "2026-11-30T06:00:00Z", "step_s": 3600, "count": 24 },
  "sun":   { "azimuth_deg": [268.498, 268.496, 268.493], "elevation_deg": [-10.816, -11.322, -11.829] },
  "earth": { "azimuth_deg": [270.41, 270.577, 270.743],  "elevation_deg": [66.164, 66.191, 66.217] },
  "angular_radius_deg": { "sun": 0.25, "earth": 1.0 },
  "source": "JPL Horizons API (...), centro coord@301 en lat 0, lon 30 (este-positiva), consulta en vivo; descargado ..."
}
```
- `site_id` codifica la posición: `live-` + latitud (`n` norte, `s` sur) + longitud (`e` este, `w` oeste), con `p` en lugar del punto decimal. Ejemplo: `live-s89p5-e0p0` es 89,5° S y 0° E.
- Cada arreglo tiene exactamente `time.count` valores, y el azimut queda en [0, 360).

### Errores
| Código | Cuándo | Qué hacer |
|---|---|---|
| 422 | Latitud, longitud, fecha o `days` fuera de rango o con formato inválido. No se consulta a Horizons. | Corregir el parámetro; el cuerpo dice cuál |
| 502 | Horizons devolvió un error, no hubo conexión, o respondió algo que no coincide con lo pedido | Reintentar; si sigue, mirar el estado de Horizons |
| 504 | Horizons no respondió a tiempo | Reintentar en un rato |

**La API nunca devuelve datos inventados**: si Horizons falla, responde el error y no hay datos.

## Cómo la usa la web
- Si hay una URL de API configurada (`VITE_API_URL`), la web muestra la sección "Posición libre en la Luna": dos inputs (latitud y longitud) que usan la fecha del selector.
- La web valida los rangos antes de llamar a la API y muestra el error si falla. Cada consulta pide los 7 días desde el inicio del día UTC elegido y se guarda mientras se siga en ese día.
- El horizonte de una posición libre es **ideal** (Luna lisa, 360 ceros, ADR-011): la web avisa "horizonte ideal, sin relieve". Las horas de Sol y de Tierra son las de una Luna sin montañas, no las reales.
- Sin `VITE_API_URL` la sección no aparece y la web funciona solo con los sitios precalculados.
- Código: `web/src/live-core.js` (lógica, probada con `npm test`) y `web/src/live.js` (formulario).

## Detalles técnicos
- La consulta a Horizons es la validada en el [ADR-006](adr/ADR-006-recursos-oficiales.md): `CENTER='coord@301'`, `COORD_TYPE='GEODETIC'`, `QUANTITIES='4'`, `APPARENT='AIRLESS'`, paso de 1 hora. La arma `precompute/ephemeris/horizons_client.py`, el mismo cliente del precálculo.
- Cada consulta se guarda en `data/raw/horizons/` (no versionado): repetirla no vuelve a llamar a Horizons.
- Dos consultas a Horizons por pedido (Sol y Tierra); pueden tardar unos segundos.
- CORS permite `localhost:5173`, `localhost:4173`, GitHub Pages y el dominio de Vercel. Para otros orígenes, variable de entorno `CORS_ORIGINS` (separados por comas).

## Tests
```bash
python -m pytest tests/test_api_ephemeris.py     # API
cd web && npm test                               # lógica de la web (live-core.test.js)
```
Los tests de la API corren sin red con un Horizons falso (valores sintéticos que solo prueban formato, validaciones, errores y caché). El caso conocido (lat 0, lon 30 E, 2026-11-30T06:00:00Z) se compara contra la respuesta guardada de Horizons (`docs/adr/evidencia/ADR-006-horizons-web/`) y lleva el marcador `network`.

## Más información
- Cómo levantarla, deploy y variables: [`data/api/README.md`](../data/api/README.md).
- Decisión y alternativas descartadas: [ADR-015](adr/ADR-015-api-horizons-en-vivo.md).
- Formato de la respuesta: [contrato de datos](03-DATA-CONTRACT.md), sección `ephemeris.json`.
