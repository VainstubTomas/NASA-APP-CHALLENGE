"""Perfil de horizonte con relieve de un sitio: 360 elevaciones a partir de un mapa de alturas (C5-06, #16).

Para cada azimut (0° = norte, sentido horario) se recorre el terreno desde el sitio hacia afuera,
sobre un círculo máximo de la esfera lunar, y se guarda el mayor ángulo de elevación que forma el
terreno visto desde el observador. Ese ángulo es la altura del horizonte en esa dirección.

Física (ver el criterio de #16 y docs/00-CONTEXT.md):
- **Curvatura**: la Luna es una esfera de radio MOON_RADIUS_M; el terreno lejano "cae" d²/2R por
  debajo del plano horizontal del observador (unos 2,9 km a 100 km). Se calcula de forma exacta,
  no con la aproximación.
- **Sin refracción**: la Luna no tiene atmósfera; el horizonte es solo terreno más curvatura.
- Las alturas del mapa son relativas a la esfera de referencia (LOLA usa R = 1737,4 km).

Unidades: distancias y alturas en **metros** en todo el módulo. Si el mapa viene en kilómetros se
detecta y se convierte (ver DemTerrain.height_unit_m); verificarlo igual en la etiqueta del PDS.

Proyección: la posición del sitio en el mapa se calcula con pyproj usando el CRS que trae el
archivo; nunca se convierte a mano (CLAUDE.md). Para moverse desde el sitio se usa la fórmula del
destino sobre la esfera (geodésica exacta en una esfera), y luego pyproj pasa cada punto al mapa.

Este módulo calcula el perfil y dibuja la silueta. Escribir horizon.json es C5-07 (#51).

Uso (cuando esté el mapa en data/raw/lola/, que no se sube a git):
    python -m precompute.terrain.horizon_profile --dem data/raw/lola/LDEM_80S_80MPP_ADJ.TIF \\
        --site intuitive-machines-2 --plot horizonte-im2.png
"""
from __future__ import annotations

import argparse
import json
import math
from dataclasses import dataclass, field
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[2]
SITES_PATH = ROOT / "data" / "public" / "sites.json"

# Radio de referencia de la Luna que usan los productos LDEM de LOLA (las alturas del mapa son
# relativas a esta esfera). Fuente: etiquetas PDS de LRO LOLA, Gridded Data Records (LDEM),
# "A_AXIS_RADIUS = 1737.4 <km>". Mismo valor que la IAU para la esfera lunar media.
MOON_RADIUS_M = 1_737_400.0

# CRS en formato PROJ para la Luna como esfera. El LDEM_80S usa estereográfica polar sur con
# centro en el polo; el CRS real se lee siempre del archivo, estos dos solo sirven para tests.
MOON_GEOGRAPHIC = f"+proj=longlat +R={MOON_RADIUS_M:.0f} +no_defs"
MOON_SOUTH_POLAR_STEREO = (
    f"+proj=stere +lat_0=-90 +lon_0=0 +k=1 +x_0=0 +y_0=0 +R={MOON_RADIUS_M:.0f} +units=m +no_defs"
)

DEFAULT_MAX_DISTANCE_M = 150_000.0  # mismo valor que el ejemplo de max_distance_km del contrato
N_AZIMUTHS = 360


# --- Geometría ------------------------------------------------------------------------------

def _destination(lat_deg, lon_deg, bearing_deg, distance_m, radius_m=MOON_RADIUS_M):
    """Punto a `distance_m` del origen siguiendo un círculo máximo con rumbo inicial `bearing_deg`.

    Rumbo: 0° = norte, sentido horario. Longitud este-positiva. Acepta `distance_m` como arreglo.
    Devuelve (lat_deg, lon_deg), con la longitud en [-180, 180).
    """
    phi1 = math.radians(lat_deg)
    lam1 = math.radians(lon_deg)
    brg = math.radians(bearing_deg)
    delta = np.asarray(distance_m, dtype=float) / radius_m
    sin_phi2 = math.sin(phi1) * np.cos(delta) + math.cos(phi1) * np.sin(delta) * math.cos(brg)
    phi2 = np.arcsin(np.clip(sin_phi2, -1.0, 1.0))
    lam2 = lam1 + np.arctan2(
        math.sin(brg) * np.sin(delta) * math.cos(phi1),
        np.cos(delta) - math.sin(phi1) * np.sin(phi2),
    )
    lon2 = (np.degrees(lam2) + 180.0) % 360.0 - 180.0
    return np.degrees(phi2), lon2


def elevation_angle_deg(ground_distance_m, target_height_m, observer_h_m, radius_m=MOON_RADIUS_M):
    """Ángulo de elevación (grados) de puntos del terreno vistos desde el observador, con curvatura.

    `ground_distance_m`: distancia sobre la esfera de referencia. `target_height_m` y `observer_h_m`:
    alturas sobre esa esfera, en metros. Plano que contiene centro, observador y punto: el observador
    está en (0, R + h_o) y el punto, a un ángulo central θ = d/R, en ((R + h_t) sen θ, (R + h_t) cos θ).
    """
    theta = np.asarray(ground_distance_m, dtype=float) / radius_m
    r_target = radius_m + np.asarray(target_height_m, dtype=float)
    horizontal = r_target * np.sin(theta)
    vertical = r_target * np.cos(theta) - (radius_m + observer_h_m)
    return np.degrees(np.arctan2(vertical, horizontal))


def ray_horizon(ground_distance_m, target_height_m, observer_h_m, radius_m=MOON_RADIUS_M):
    """Horizonte de un rayo: (máxima elevación en grados, mayor distancia con dato en metros).

    Los puntos sin dato (NaN: fuera del mapa o sin valor) se ignoran. Sin ningún dato: (nan, 0.0).
    """
    d = np.asarray(ground_distance_m, dtype=float)
    h = np.asarray(target_height_m, dtype=float)
    ok = np.isfinite(h)
    if not ok.any():
        return float("nan"), 0.0
    ang = elevation_angle_deg(d[ok], h[ok], observer_h_m, radius_m)
    return float(ang.max()), float(d[ok].max())


# --- Perfil -----------------------------------------------------------------------------------

@dataclass
class HorizonProfile:
    """Resultado de horizon_profile. `elevation_deg[i]` es el horizonte en el azimut i (grados)."""

    elevation_deg: list[float]
    covered_m: list[float]  # hasta qué distancia hubo datos en cada azimut
    max_distance_m: float
    step_m: float
    observer_height_m: float
    site_height_m: float
    partial_azimuths: list[int] = field(default_factory=list)

    @property
    def partial(self) -> bool:
        """True si algún rayo se quedó sin datos antes de max_distance_m (por ejemplo, borde del mapa)."""
        return bool(self.partial_azimuths)


def horizon_profile(terrain, max_distance_m=DEFAULT_MAX_DISTANCE_M, step_m=None,
                    observer_height_m=0.0, n_azimuths=N_AZIMUTHS, radius_m=MOON_RADIUS_M) -> HorizonProfile:
    """Calcula el horizonte en `n_azimuths` direcciones (por defecto, una por grado desde el norte).

    `terrain` es cualquier objeto con:
      - `heights_along(azimuth_deg, distances_m) -> (alturas_m, distancias_sobre_la_esfera_m)`
      - `site_height_m() -> float`
      - opcional `pixel_m`: paso por defecto del muestreo (un píxel del mapa).
    `observer_height_m` es la altura de los ojos o de la antena sobre el suelo del sitio.
    """
    if step_m is None:
        step_m = float(getattr(terrain, "pixel_m", 80.0))
    distances = np.arange(step_m, max_distance_m + step_m / 2, step_m)
    site_h = float(terrain.site_height_m())
    observer_abs = site_h + observer_height_m
    elevations, covered, partial = [], [], []
    for i in range(n_azimuths):
        azimuth = i * 360.0 / n_azimuths
        heights, ground = terrain.heights_along(azimuth, distances)
        elev, cov = ray_horizon(ground, heights, observer_abs, radius_m)
        elevations.append(elev)
        covered.append(cov)
        if cov < max_distance_m - step_m:
            partial.append(i)
    return HorizonProfile(elevations, covered, float(max_distance_m), float(step_m),
                          float(observer_height_m), site_h, partial)


# --- Mapa de alturas real (GeoTIFF) -----------------------------------------------------------

class DemTerrain:
    """Mapa de alturas en GeoTIFF (por ejemplo LDEM_80S_80MPP_ADJ) alrededor de un sitio.

    Lee la banda 1 completa en memoria (el LDEM de 80 m pesa unos 230 MB como float32). Los valores
    `nodata` pasan a NaN. Las alturas se interpolan en forma bilineal entre centros de píxel.
    """

    def __init__(self, path, lat_deg, lon_deg, height_unit_m=None):
        import rasterio
        from pyproj import CRS, Transformer

        self.path = Path(path)
        self.lat_deg, self.lon_deg = float(lat_deg), float(lon_deg)
        with rasterio.open(self.path) as src:
            data = src.read(1).astype("float64")
            if src.nodata is not None:
                data[data == src.nodata] = np.nan
            self.transform = src.transform
            self.inverse = ~src.transform
            self.pixel_m = float(abs(src.res[0]))
            crs = CRS.from_wkt(src.crs.to_wkt())
            units = tuple(u.lower() for u in (src.units or ()) if u)
        self.height_unit_m = height_unit_m if height_unit_m is not None else self._guess_unit(data, units)
        self.data = data * self.height_unit_m
        self.to_map = Transformer.from_crs(crs.geodetic_crs, crs, always_xy=True)
        if not np.isfinite(self._sample(np.array([self.lon_deg]), np.array([self.lat_deg])))[0]:
            raise ValueError(
                f"El sitio ({self.lat_deg}, {self.lon_deg}) está fuera del mapa {self.path.name} "
                "o cae en un píxel sin dato"
            )

    @staticmethod
    def _guess_unit(data, units) -> float:
        """Metros por unidad del mapa. Usa la unidad del archivo si la trae; si no, adivina.

        El relieve lunar va de unos -9 a +11 km: si todo el mapa está entre -50 y 50, son kilómetros.
        Es una salvaguarda: la unidad hay que confirmarla en la etiqueta del producto en el PDS.
        """
        if any("km" in u or "kilomet" in u for u in units):
            return 1000.0
        if any(u in ("m", "meter", "meters", "metre", "metres") for u in units):
            return 1.0
        finite = data[np.isfinite(data)]
        if finite.size and np.abs(finite).max() > 0 and np.abs(finite).max() < 50:
            return 1000.0
        return 1.0

    def _sample(self, lon, lat):
        """Altura (m) por interpolación bilineal en lon/lat; NaN fuera del mapa o sin dato."""
        x, y = self.to_map.transform(lon, lat)
        x, y = np.asarray(x, dtype=float), np.asarray(y, dtype=float)
        inv = self.inverse
        col = inv.a * x + inv.b * y + inv.c
        row = inv.d * x + inv.e * y + inv.f
        fc, fr = col - 0.5, row - 0.5  # centros de píxel
        c0, r0 = np.floor(fc).astype(int), np.floor(fr).astype(int)
        nrows, ncols = self.data.shape
        inside = (c0 >= 0) & (r0 >= 0) & (c0 + 1 < ncols) & (r0 + 1 < nrows)
        out = np.full(fc.shape, np.nan)
        if inside.any():
            c, r = c0[inside], r0[inside]
            tc, tr = fc[inside] - c, fr[inside] - r
            z00, z01 = self.data[r, c], self.data[r, c + 1]
            z10, z11 = self.data[r + 1, c], self.data[r + 1, c + 1]
            out[inside] = (z00 * (1 - tc) * (1 - tr) + z01 * tc * (1 - tr)
                           + z10 * (1 - tc) * tr + z11 * tc * tr)
        return out

    def site_height_m(self) -> float:
        return float(self._sample(np.array([self.lon_deg]), np.array([self.lat_deg]))[0])

    def heights_along(self, azimuth_deg, distances_m):
        lat, lon = _destination(self.lat_deg, self.lon_deg, azimuth_deg, distances_m)
        return self._sample(np.asarray(lon), np.asarray(lat)), np.asarray(distances_m, dtype=float)


# --- Gráfico ----------------------------------------------------------------------------------

def plot_profile(profile: HorizonProfile, path, title="Perfil de horizonte"):
    """Dibuja la silueta (azimut contra elevación) y la guarda en `path` (PNG). Devuelve el Path."""
    import matplotlib

    matplotlib.use("Agg")
    import matplotlib.pyplot as plt

    az = np.arange(len(profile.elevation_deg)) * 360.0 / len(profile.elevation_deg)
    elev = np.asarray(profile.elevation_deg, dtype=float)
    fig, ax = plt.subplots(figsize=(10, 3.2), dpi=120)
    floor = min(np.nanmin(elev) if np.isfinite(elev).any() else 0.0, 0.0) - 1.0
    ax.fill_between(az, floor, elev, color="#8a8f99", step="mid", label="Terreno")
    ax.axhline(0, color="#ffc54d", lw=1, ls="--", label="Horizonte ideal (0°)")
    for i in profile.partial_azimuths:
        ax.axvspan(i - 0.5, i + 0.5, color="#ff6b6b", alpha=0.25, lw=0)
    ax.set_xlim(0, 360)
    ax.set_ylim(floor, max(np.nanmax(elev) if np.isfinite(elev).any() else 1.0, 1.0) + 1.0)
    ax.set_xticks(range(0, 361, 45), ["N", "NE", "E", "SE", "S", "SO", "O", "NO", "N"])
    ax.set_xlabel("Azimut (0° = norte, sentido horario)")
    ax.set_ylabel("Elevación del horizonte (°)")
    note = f"Observador a {profile.observer_height_m:g} m del suelo · hasta {profile.max_distance_m / 1000:g} km"
    if profile.partial:
        note += f" · rojo: {len(profile.partial_azimuths)} rumbos sin datos hasta el final (borde del mapa)"
    ax.set_title(f"{title}\n{note}", fontsize=9)
    ax.legend(loc="upper right", fontsize=8)
    fig.tight_layout()
    out = Path(path)
    fig.savefig(out)
    plt.close(fig)
    return out


# --- Línea de comandos ------------------------------------------------------------------------

def _site_coords(site_id, sites_path=SITES_PATH):
    for site in json.loads(Path(sites_path).read_text(encoding="utf-8"))["sites"]:
        if site["id"] == site_id:
            return float(site["lat_deg"]), float(site["lon_deg"])
    raise SystemExit(f"No existe el sitio {site_id!r} en {sites_path}")


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description="Perfil de horizonte con relieve de un sitio (360 valores)")
    ap.add_argument("--dem", type=Path, required=True, help="GeoTIFF del mapa de alturas (data/raw/lola/...)")
    group = ap.add_mutually_exclusive_group(required=True)
    group.add_argument("--site", help="id del sitio en data/public/sites.json")
    group.add_argument("--latlon", nargs=2, type=float, metavar=("LAT", "LON"))
    ap.add_argument("--max-km", type=float, default=DEFAULT_MAX_DISTANCE_M / 1000)
    ap.add_argument("--observer-m", type=float, default=0.0, help="altura del observador sobre el suelo")
    ap.add_argument("--plot", type=Path, help="PNG de salida con la silueta")
    a = ap.parse_args(argv)

    lat, lon = _site_coords(a.site) if a.site else a.latlon
    terrain = DemTerrain(a.dem, lat, lon)
    prof = horizon_profile(terrain, max_distance_m=a.max_km * 1000, observer_height_m=a.observer_m)
    elev = np.asarray(prof.elevation_deg)
    print(f"Sitio {a.site or (lat, lon)}: altura del suelo {prof.site_height_m:.1f} m "
          f"(unidad del mapa: {terrain.height_unit_m:g} m)")
    print(f"Horizonte: máximo {np.nanmax(elev):.3f}° en {int(np.nanargmax(elev))}°, "
          f"mínimo {np.nanmin(elev):.3f}° en {int(np.nanargmin(elev))}°")
    if prof.partial:
        print(f"ATENCIÓN: {len(prof.partial_azimuths)} rumbos sin datos hasta {a.max_km:g} km "
              f"(borde del mapa): {prof.partial_azimuths[:10]}{'...' if len(prof.partial_azimuths) > 10 else ''}")
    if a.plot:
        print(f"Silueta: {plot_profile(prof, a.plot, title=f'Horizonte de {a.site or (lat, lon)}')}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
