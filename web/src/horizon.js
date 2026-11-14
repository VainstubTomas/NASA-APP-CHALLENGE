// Horizonte interpolado y visibilidad hora por hora (issue C2-03, ADR-002).
// Misma regla que precompute/ephemeris/visibility.py; casos compartidos en
// tests/fixtures/visibility_cases.json.
import { isAboveHorizon } from './ephemeris.js';

/**
 * Elevación del horizonte (grados) en un azimut cualquiera: interpolación lineal
 * entre muestras y cierre del círculo (el azimut 359 conecta con el 0).
 */
export function horizonAt(horizon, azimuthDeg) {
  const values = horizon.elevation_deg;
  const n = values.length;
  const raw = (azimuthDeg - horizon.azimuth_start_deg) / horizon.azimuth_step_deg;
  const pos = ((raw % n) + n) % n; // módulo positivo también para azimuts negativos
  const i = Math.floor(pos);
  const frac = pos - i;
  return values[i] * (1 - frac) + values[(i + 1) % n] * frac;
}

/** Visible: el borde superior del disco está sobre el horizonte (desigualdad estricta). */
export const isVisible = isAboveHorizon;

/** Totalmente visible: el disco entero está sobre el horizonte. */
export function isFullyVisible(elevationDeg, angularRadiusDeg, horizonDeg = 0) {
  return elevationDeg - angularRadiusDeg > horizonDeg;
}

/** Visibilidad de cada cuerpo en cada muestra: { sun: {visible, fully_visible}, earth: {...} }. */
export function visibilitySeries(ephemeris, horizon) {
  if (ephemeris.site_id !== horizon.site_id) {
    throw new Error(`El sitio no coincide: ${ephemeris.site_id} (efemérides) vs ${horizon.site_id} (horizonte)`);
  }
  const out = {};
  for (const body of ['sun', 'earth']) {
    const { azimuth_deg: az, elevation_deg: el } = ephemeris[body];
    const radius = ephemeris.angular_radius_deg[body];
    const horizons = az.map((a) => horizonAt(horizon, a));
    out[body] = {
      visible: el.map((e, i) => isVisible(e, radius, horizons[i])),
      fully_visible: el.map((e, i) => isFullyVisible(e, radius, horizons[i])),
    };
  }
  return out;
}

/** Resumen comparable con series_summary() de Python. */
export function seriesSummary(series) {
  const count = (a) => a.filter(Boolean).length;
  return {
    samples: series.sun.visible.length,
    sun_visible_hours: count(series.sun.visible),
    sun_fully_visible_hours: count(series.sun.fully_visible),
    earth_visible_hours: count(series.earth.visible),
    earth_fully_visible_hours: count(series.earth.fully_visible),
    sun_first_48h: series.sun.visible.slice(0, 48).map((v) => (v ? '1' : '0')).join(''),
  };
}
