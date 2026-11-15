> 🇬🇧 [Read in English](../en/adr/ADR-018-live-relief.md)

# ADR-018: Relieve real para una posición libre: `GET /horizon` en la API y carga en dos etapas en la web

- **Estado**: Propuesto
- **Fecha**: 2026-11-15
- **Decidieron**: el equipo (pendiente de registrar quiénes confirman).
- **Reemplaza a**: el punto 4 del [ADR-015](ADR-015-api-horizons-en-vivo.md) (horizonte liso para el sitio libre)

## Contexto
Los sitios de `sites.json` ya tienen relieve real: su `horizon.json` se calcula offline con el mapa LOLA (`precompute/terrain/lola_horizon.py`, #13 y #16). En cambio, en "Ubicación específica" y "Mapa lunar" la API solo devolvía efemérides y la web armaba la Luna lisa (ADR-015, punto 4). Visto desde la web, parecía un error: el mismo punto tenía montañas en el histórico y no en la consulta libre.

Se midió el costo el 2026-11-15, con la API real de NASA Moon Trek:

| Punto | Mapa | Primera consulta | Repetida (caché) |
|---|---|---|---|
| 10,5° N, 20,25° E | global 128 ppd (~260 KB) | 2,4 s | 0,1 s |
| 86,3° S, 45,1° E | polar 30 m (~9 MB) | 28,6 s | 0,1 s |

## Decisión
1. **Nuevo endpoint `GET /horizon?lat&lon`** en `data/api/`, con la misma estructura que `/ephemeris`: modelo de respuesta en `main.py`, lógica en `service.py` (sin FastAPI) y errores 422/502/504. Responde con el formato de `horizon.json`, con el mismo `site_id` `live-...` que las efemérides.
2. **Mismo cálculo que los sitios guardados**: `service.build_live_horizon` llama a `lola_horizon.site_horizon` (mapa polar de 30 m al sur de -75,7°; global de 128 ppd en el resto; 20 km de rayo). No hay un segundo algoritmo.
3. **Cobertura**: al norte de 85° el recorte del mapa global se vuelve demasiado ancho; ahí responde la Luna lisa **sin `dem`** (la web ya muestra "horizonte ideal, sin relieve").
4. **Caché**: el recorte queda en `data/raw/` (`dem_<site_id>.tif` o `dem30_<site_id>.tif`, no versionado). Un recorte ilegible se borra para que el próximo pedido reintente. Un candado por punto evita bajar el mismo recorte dos veces a la vez.
5. **Web en dos etapas**: el relieve se pide en paralelo con las efemérides y **no bloquea el loader**. El cielo aparece con el horizonte liso, como antes; cuando llega el relieve, se vuelven a dibujar el cielo, el panel y la línea de tiempo sin mover la vista. El relieve se guarda por punto (no depende de la fecha). Si falla, queda el horizonte liso y se informa en el estado de la consulta.

## Alternativas descartadas
- **Esperar el relieve antes de mostrar el cielo**: en el polo sur sumaría ~30 s al loader.
- **Calcular el relieve en el navegador**: habría que bajar el mapa desde la web (Moon Trek y CORS) y portar el cálculo a JavaScript, duplicando lo ya validado en Python.
- **Mapa global para todo el planeta**: el archivo pesa 2,2 GB; se sigue pidiendo solo el recorte de cada punto.

## Consecuencias
- Las horas de Sol y de Tierra de una posición libre pasan a tener en cuenta el relieve, como los sitios guardados.
- La API necesita `rasterio` y `pyproj` (agregados a `data/api/requirements.txt`) y depende también de Moon Trek.
- En Render gratis el disco no es persistente: la caché de recortes se pierde cuando el servicio se duerme, y el cálculo puede ser más lento por la CPU limitada.
- Costo: la primera consulta de un punto del polo sur tarda ~30 s en mostrar el relieve (el cielo se ve antes).
