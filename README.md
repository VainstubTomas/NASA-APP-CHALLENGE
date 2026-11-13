# Lunar Landing Site Navigator

> NASA Space Apps Challenge 2026. Proyecto en desarrollo.

**¿Si aterrizo en este lugar de la Luna en esta fecha, voy a tener Sol y voy a poder hablar con la Tierra?**

Cerca del polo sur lunar el Sol y la Tierra apenas asoman sobre el horizonte, y cualquier montaña los tapa. Esta herramienta toma un sitio y una fecha, calcula dónde están el Sol y la Tierra, dibuja el horizonte real del lugar y muestra cuándo hay energía y cuándo hay comunicación.

## Cómo funciona
1. **Efemérides** (Python + SPICE): azimut y elevación del Sol y la Tierra por sitio y por hora.
2. **Terreno** (Python + mapa de elevación LOLA): perfil de horizonte de 360 direcciones por sitio.
3. **Web**: lee esos datos precalculados y compara cada cuerpo contra el horizonte.

Los cálculos se validan contra [JPL Horizons](https://ssd.jpl.nasa.gov/horizons/).

## Estructura
| Carpeta | Contenido |
|---|---|
| `docs/` | Contexto, PRD, arquitectura, contrato de datos, flujo de trabajo, roadmap, ADRs |
| `precompute/` | Scripts Python que generan los datos (`ephemeris/`, `terrain/`) |
| `web/` | Frontend |
| `data/public/` | JSON precalculados que consume la web |
| `data/schema/` | Esquemas JSON del contrato de datos |
| `tests/` | Pruebas del contrato y validación contra Horizons |

## Cómo correrlo
Estado: la estructura está lista; el código se está construyendo. Los comandos definitivos se completan a medida que existen.

```bash
# Hooks de Git (una vez después de clonar)
git config core.hooksPath .githooks
# Commits (in English): type(scope): description of 10+ words. No commits on main.

# Python (precálculo y tests)
python -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate
pip install -r precompute/requirements.txt
python -m pytest tests/

# Web (cuando exista web/package.json)
cd web && npm install && npm run dev
```

Los datos pesados (kernels SPICE y el mapa LOLA) no están en el repo. Ver `docs/02-ARCHITECTURE.md` para saber dónde descargarlos.

## Documentación
Empezar por [`docs/00-CONTEXT.md`](docs/00-CONTEXT.md). Para trabajar con Claude, ver [`CLAUDE.md`](CLAUDE.md).
