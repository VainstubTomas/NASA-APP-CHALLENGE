# 03. Contrato de datos (v1.0, propuesta)

Última actualización: 2026-11-12 · Estado: **propuesto**, a validar entre backend y frontend en el issue C0-08. Los esquemas ejecutables están en `data/schema/`.

Es el acuerdo entre Python y la web. Cambiarlo requiere un ADR y avisar al equipo. Todos los archivos llevan `schema_version`.

## Convenciones
| Tema | Regla |
|---|---|
| Azimut | Grados, 0° = norte, sentido horario, rango [0, 360) |
| Elevación | Grados sobre el horizonte local, rango [-90, 90] |
| Tiempo | UTC. Se guarda `start_utc` (ISO 8601), `step_s` (segundos) y `count`; la muestra `i` está en `start_utc + i * step_s` |
| Series | En columnas (arreglos paralelos), no una lista de objetos, para que pesen poco |
| Precisión | Ángulos con 3 decimales como máximo |
| Coordenadas | Latitud planetocéntrica y longitud este-positiva, grados, [-180, 180] |
| Marco | Topocéntrico, desde la superficie en el punto del sitio |

## Estructura de archivos
```
data/public/sites.json
data/public/sites/<site_id>/horizon.json
data/public/sites/<site_id>/ephemeris.json
data/public/sites/<site_id>/metrics.json        (capa 3)
```
`<site_id>` es un slug en minúsculas con guiones (`shackleton-rim`).

## `sites.json`
```json
{
  "schema_version": "1.0",
  "sites": [
    {
      "id": "demo-sintetico",
      "name": "Sitio de demostración (datos sintéticos)",
      "lat_deg": -89.5,
      "lon_deg": 0.0,
      "source": "Dato inventado para desarrollo",
      "source_url": "",
      "synthetic": true
    }
  ]
}
```
Campos opcionales: `mission`, `country`, `notes`. Todo sitio real lleva `source` y `source_url` verificados. `synthetic: true` marca datos de prueba y **debe eliminarse antes de la entrega**.

## `horizon.json`
```json
{
  "schema_version": "1.0",
  "site_id": "demo-sintetico",
  "azimuth_start_deg": 0,
  "azimuth_step_deg": 1,
  "elevation_deg": [0.8, 0.9, "... 360 valores ..."],
  "max_distance_km": 150,
  "observer_height_m": 0,
  "dem": { "name": "LDEM_80S_80MPP_ADJ", "pixel_m": 80 }
}
```
- `elevation_deg[i]` es la elevación del horizonte en el azimut `azimuth_start_deg + i * azimuth_step_deg`.
- La web interpola linealmente entre muestras y cierra el círculo (el azimut 359 conecta con el 0).

## `ephemeris.json`
```json
{
  "schema_version": "1.0",
  "site_id": "demo-sintetico",
  "time": { "start_utc": "2026-11-01T00:00:00Z", "step_s": 3600, "count": 2880 },
  "sun":   { "azimuth_deg": [], "elevation_deg": [] },
  "earth": { "azimuth_deg": [], "elevation_deg": [] },
  "angular_radius_deg": { "sun": 0.25, "earth": 1.0 },
  "source": "spiceypy + kernels (lista y versión)"
}
```
- Cada arreglo tiene exactamente `count` valores.
- `angular_radius_deg` son valores nominales de v1 (Sol ~0,5° de diámetro, Tierra ~2°). Una v1.1 puede reemplazarlos por un radio variable por muestra.

## `metrics.json` (capa 3)
```json
{
  "schema_version": "1.0",
  "site_id": "demo-sintetico",
  "time": { "start_utc": "2026-11-01T00:00:00Z", "step_s": 86400, "count": 120 },
  "daily": {
    "sun_hours": [],
    "earth_hours": [],
    "both_hours": []
  }
}
```
Horas por día UTC con el Sol visible, la Tierra visible y ambos a la vez, calculadas con la regla de visibilidad de abajo. Sirven para cruzar contra lo que calcula la web.

## Regla de visibilidad (provisional, v1)
Un cuerpo es **visible** en la muestra `i` si el borde superior de su disco está sobre el horizonte en su azimut:

```
visible(i) = elevation_deg[i] + angular_radius_deg > horizon(azimuth_deg[i])
```
y **totalmente visible** si `elevation_deg[i] - angular_radius_deg > horizon(azimuth_deg[i])`.

Es provisional: el equipo debe confirmar si la métrica oficial usa el centro, el borde superior o el disco completo, y dejarlo fijado en el ADR-002. Backend y web deben implementar **la misma regla**.

## Validación
- `python -m pytest tests/test_contract.py` valida todo JSON de `data/public/` contra `data/schema/`.
- Regenerar datos sintéticos de desarrollo: `python scripts/make_synthetic_data.py`.

## Cómo cambiar el contrato
1. Abrir un issue y describir el cambio.
2. Escribir un ADR (`docs/adr/`) con el motivo.
3. Subir `schema_version` si el cambio rompe a la web, y actualizar esquemas, datos de prueba y este documento en el mismo PR.
