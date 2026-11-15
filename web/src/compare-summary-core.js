// Resumen "cuál conviene" (C4-01d, #94), sin DOM. Aplica el criterio de ADR-014 con pickBest (compare-core.js):
// 1) más horas de Sol; 2) en empate, más horas de Tierra visible; 3) si también empatan, no elige.
// Devuelve los datos para armar la frase; los textos están en i18n (compare.best.*).
import { pickBest } from './compare-core.js';

/**
 * @param {{id: string, summary: {sunHours: number, earthHours: number}|null}[]} scenarios
 * @returns {{kind: 'sun', id: string, hours: number, otherHours: number}
 *         | {kind: 'earth', id: string, sunHours: number, hours: number, otherHours: number}
 *         | {kind: 'tie', ids: string[], sunHours: number, earthHours: number}
 *         | {kind: 'only', id: string}
 *         | {kind: 'none'}}
 */
export function explainBest(scenarios) {
  const valid = scenarios.filter((s) => s.summary !== null);
  if (valid.length === 0) return { kind: 'none' };
  const best = pickBest(valid);
  if (valid.length === 1) return { kind: 'only', id: best.id };

  const top = valid.find((s) => s.id === best.id).summary;
  const sameSun = (s) => s.summary.sunHours === top.sunHours;
  const sameEarth = (s) => sameSun(s) && s.summary.earthHours === top.earthHours;
  const others = valid.filter((s) => s.id !== best.id);

  if (best.tie) {
    // En el orden de la lista (escenario 1, 2, 3), no en el del ranking.
    return { kind: 'tie', ids: valid.filter(sameEarth).map((s) => s.id), sunHours: top.sunHours, earthHours: top.earthHours };
  }
  const sunTied = others.filter(sameSun);
  if (sunTied.length > 0) {
    const otherHours = Math.max(...sunTied.map((s) => s.summary.earthHours));
    return { kind: 'earth', id: best.id, sunHours: top.sunHours, hours: top.earthHours, otherHours };
  }
  const otherHours = Math.max(...others.map((s) => s.summary.sunHours));
  return { kind: 'sun', id: best.id, hours: top.sunHours, otherHours };
}
