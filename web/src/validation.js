// Panel de validación (C3-06, #39, ADR-013): compara los números de la web con los
// valores de referencia de JPL Horizons (data/public/validation.json). Sin DOM, para `npm test`.
import { sampleAt } from './ephemeris.js';
import { visibilitySeries } from './visibility.js';

/** Diferencia angular más corta entre dos azimutes, en grados [0, 180]. */
export function angleDiff(a, b) {
  return Math.abs(((a - b + 540) % 360) - 180);
}

/**
 * Compara cada fila de referencia con la web.
 * status: 'within' (dentro de tolerancia), 'outside' (fuera), 'outOfRange' (la web no tiene
 * ese instante: no cuenta como error), 'noData' (no hay ephemeris.json del sitio).
 * @param {Array} rows filas de validation.json
 * @param {{tolerance: number, ephemerisBySite: Object}} opts
 */
export function compareRows(rows, { tolerance, ephemerisBySite }) {
  return rows.map((row) => {
    const base = { site_id: row.site_id, body: row.body, time_utc: row.time_utc, ref: { azimuth_deg: row.azimuth_deg, elevation_deg: row.elevation_deg } };
    const ephemeris = ephemerisBySite[row.site_id];
    if (!ephemeris) return { ...base, web: null, diff: null, status: 'noData' };
    const sample = sampleAt(ephemeris, Date.parse(row.time_utc));
    if (!sample) return { ...base, web: null, diff: null, status: 'outOfRange' };
    const web = sample[row.body];
    const diff = {
      azimuth_deg: angleDiff(web.azimuth_deg, row.azimuth_deg),
      elevation_deg: Math.abs(web.elevation_deg - row.elevation_deg),
    };
    const within = diff.azimuth_deg <= tolerance && diff.elevation_deg <= tolerance;
    return { ...base, web, diff, status: within ? 'within' : 'outside' };
  });
}

// Mismas horas diarias que metrics.json (C3-01): mismo cálculo que web/src/metrics.test.js.
function dailyHours(flags, perDay, stepS) {
  const out = [];
  for (let i = 0; i < flags.length; i += perDay) {
    out.push(flags.slice(i, i + perDay).filter(Boolean).length * (stepS / 3600));
  }
  return out;
}

/**
 * Cruce de las horas diarias de la web con metrics.json del sitio.
 * Devuelve null si no hay metrics.json (pendiente C3-01); [] si coinciden; si no, una lista de
 * { field, index, web, metrics } con cada día que difiere.
 */
export function compareDailyHours(ephemeris, horizon, metrics) {
  if (!metrics) return null;
  const series = visibilitySeries(ephemeris, horizon);
  const perDay = 86400 / ephemeris.time.step_s;
  const both = series.sun.visible.map((s, i) => s && series.earth.visible[i]);
  const webDaily = {
    sun_hours: dailyHours(series.sun.visible, perDay, ephemeris.time.step_s),
    earth_hours: dailyHours(series.earth.visible, perDay, ephemeris.time.step_s),
    both_hours: dailyHours(both, perDay, ephemeris.time.step_s),
  };
  const diffs = [];
  for (const field of ['sun_hours', 'earth_hours', 'both_hours']) {
    const n = Math.max(webDaily[field].length, metrics.daily[field].length);
    for (let index = 0; index < n; index++) {
      const w = webDaily[field][index];
      const m = metrics.daily[field][index];
      if (w !== m) diffs.push({ field, index, web: w ?? null, metrics: m ?? null });
    }
  }
  return diffs;
}
