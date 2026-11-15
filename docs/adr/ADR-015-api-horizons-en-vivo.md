> 🇬🇧 [Read in English](../en/adr/ADR-015-live-horizons-api.md)

# ADR-015: API propia en `data/api/` para consultar Horizons en vivo con un sitio elegido por el usuario

- **Estado**: Propuesto
- **Fecha**: 2026-11-14
- **Decidieron**: pendiente de confirmar por el equipo (propuesta del issue #104)

## Contexto
Hoy la web solo muestra los sitios de `data/public/sites.json`, con efemérides precalculadas offline. Un punto arbitrario de la Luna no tiene datos guardados. El issue #104 pide que el usuario ingrese latitud, longitud y fecha y que la web obtenga el azimut y la elevación del Sol y la Tierra desde JPL Horizons.

Esto cambia dos cosas que hoy están escritas: Python y la web "solo se hablan por los JSON de `data/public/`" (ADR-002) y el despliegue es estático, sin servidor (ADR-004, GitHub Pages desde `main`).

Se verificó el 2026-11-14 con `curl` que la API de Horizons (`ssd.jpl.nasa.gov/api/horizons.api`) **no devuelve el encabezado `Access-Control-Allow-Origin`**, aun enviando un `Origin`. Un navegador no puede consultarla directamente desde nuestra web: hace falta un intermediario.

## Decisión
1. **La API es un servicio chico en Python en `data/api/`**, que reusa `precompute/ephemeris/horizons_client.py` (consulta ya validada en el ADR-006: `CENTER='coord@301'`, `COORD_TYPE='GEODETIC'`, `QUANTITIES='4'`, `APPARENT='AIRLESS'`, UTC). No se reescribe la consulta ni su parser.
2. **Stack propuesto: FastAPI + uvicorn.** Valida los parámetros y los rangos, y el equipo ya usa Python. Se agregan a `precompute/requirements.txt` (o a un `data/api/requirements.txt`).
3. **Un solo endpoint**: `GET /ephemeris?lat=<°>&lon=<°>&start=<UTC>&days=<n>`. Responde con **el mismo formato que `ephemeris.json`** (`schema_version: 1.0`, paso de 1 h, `source` con la consulta). No se cambia el contrato ni su esquema.
   - `lat` en [-90, 90] (planetocéntrica), `lon` en [-180, 180] (este-positiva), `start` ISO 8601 en UTC, `days` de 1 a 14 (por defecto 7, la ventana de la línea de tiempo).
   - Entradas inválidas: error 422 con el motivo. Si Horizons falla o no responde: error 502 con mensaje claro. **Nunca se devuelven datos inventados ni de otro sitio.**
   - Dos consultas a Horizons por pedido (Sol y Tierra), con el caché de `data/raw/horizons/` que ya usa el cliente.
4. **Horizonte del sitio libre: Luna lisa** (360 ceros, ADR-011). La web arma ese horizonte en el cliente y muestra "horizonte ideal, sin relieve". *Reemplazado por el [ADR-018](ADR-018-relieve-en-vivo.md): la API calcula el relieve con `GET /horizon`.*
5. **La web decide por sitio**: los de `sites.json` siguen leyendo los JSON precalculados, sin API. El input de latitud y longitud solo aparece si hay una URL de API configurada (`VITE_API_URL`). Sin ella, la web funciona como hoy, sin conexión.
6. **CORS en nuestra API**: permite solo el origen de la web desplegada y el de desarrollo local.
7. **Documentación y pruebas manuales: Swagger.** FastAPI publica la documentación interactiva en `/docs` (Swagger UI), con descripciones y ejemplos de cada parámetro, para probar la API sin pasar por la web.
8. **Dónde corre**: en local con `uvicorn` (documentado en `data/api/README.md`) y, para la demo en línea, **en Render** como servicio web desde el repo (comando de inicio `uvicorn data.api.main:app --host 0.0.0.0 --port $PORT`). Su URL va en `VITE_API_URL` y la API permite por CORS el origen de GitHub Pages. Pendiente de confirmar por el equipo: quién lo configura, y que el plan gratuito duerme el servicio tras un rato sin tráfico (el primer pedido tarda cerca de un minuto), por lo que hay que despertarlo antes de la demo. **Plan B**: la API en una notebook.

## Alternativas descartadas
- **Llamar a Horizons desde el navegador**: no es posible por CORS (ver Contexto).
- **Precalcular una grilla de sitios**: no cubre un punto elegido por el usuario y suma datos pesados al repo.
- **Función serverless en GitHub Pages o Vercel**: Pages no ejecuta código del servidor; Vercel obligaría a mover el despliegue y la API a la raíz del repo (`api/`), no a `data/api/` como pide el issue.
- **Servidor con solo la librería estándar (`http.server`)**: evita una dependencia, pero hay que escribir a mano la validación, los errores y CORS.

## Consecuencias
- Hay una pieza nueva que mantener y desplegar. El requisito "funciona sin conexión durante la demo" (`docs/02-ARCHITECTURE.md`) vale solo para los sitios precalculados; la consulta en vivo necesita red y la API levantada.
- Horizons es una dependencia externa en vivo, con cada consulta de unos segundos. La web debe mostrar un estado de carga y el error si falla.
- `docs/02-ARCHITECTURE.md` y `docs/03-DATA-CONTRACT.md` se actualizan para decir que, además de los JSON, la web puede leer la API con el mismo formato.
- Si se acepta, el issue #104 se parte en sub-issues: API con tests, input en la web e integración.
- Costo: un sitio libre no tiene relieve; las horas de Sol y de Tierra son las de una Luna lisa, no las reales.
