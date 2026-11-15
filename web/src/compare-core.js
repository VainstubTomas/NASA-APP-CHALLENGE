// Núcleo sin DOM de la comparación de escenarios (C4-01a, #91). Reusa timelineWindow, visibilitySeries y nextVisibilityChange.
// Criterio de "conviene" (ADR-014, C4-02): más horas de Sol en la ventana; en empate, más horas de Tierra visible.
import { timelineWindow } from './timeline-core.js';
import { visibilitySeries } from './visibility.js';
import { nextVisibilityChange } from './ephemeris.js';
import { horizonAt } from './horizon.js';

/**
 * Resumen de un escenario: horas de Sol y de Tierra visible en `days` días desde utcMs,
 * y el próximo cambio de cada cuerpo. Devuelve null si utcMs está fuera de los datos.
 * @returns {{sunHours: number, earthHours: number, windowDays: number,
 *            next: {sun: object|null, earth: object|null}} | null}
 */
export function summarizeScenario(ephemeris, horizon, utcMs, days = 7) {
  const win = timelineWindow(ephemeris.time, utcMs, days);
  if (!win) return null;
  const series = visibilitySeries(ephemeris, horizon);
  const stepHours = ephemeris.time.step_s / 3600;
  const hoursIn = (visible) => visible.slice(win.first, win.last).filter(Boolean).length * stepHours;
  const horizonDeg = (az) => horizonAt(horizon, az);
  return {
    sunHours: hoursIn(series.sun.visible),
    earthHours: hoursIn(series.earth.visible),
    windowDays: win.days,
    next: {
      sun: nextVisibilityChange(ephemeris, utcMs, 'sun', horizonDeg),
      earth: nextVisibilityChange(ephemeris, utcMs, 'earth', horizonDeg),
    },
  };
}

/**
 * Elige el escenario que conviene. Ignora los null (fuera de datos).
 * @param {{id: string, summary: object|null}[]} scenarios
 * @returns {{id: string, tie: boolean} | null} tie = otro escenario empata en Sol y en Tierra
 */
export function pickBest(scenarios) {
  const valid = scenarios.filter((s) => s.summary !== null);
  if (valid.length === 0) return null;
  const score = (s) => [s.summary.sunHours, s.summary.earthHours];
  const cmp = (a, b) => score(b)[0] - score(a)[0] || score(b)[1] - score(a)[1];
  const sorted = [...valid].sort(cmp);
  const [best, second] = sorted;
  const tie = second !== undefined && cmp(best, second) === 0;
  return { id: best.id, tie };
}
