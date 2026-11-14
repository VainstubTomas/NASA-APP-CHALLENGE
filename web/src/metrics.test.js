// C3-01 (#34): el metrics.json que genera Python coincide con el cálculo de la web.
// Para cada sitio, la web calcula la visibilidad hora por hora con visibility.js (misma regla que Python)
// y suma las horas por día UTC; tiene que dar exactamente lo mismo que metrics.json.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { visibilitySeries } from './visibility.js';

const SITES = new URL('../../data/public/sites/', import.meta.url);
const read = (siteId, file) => JSON.parse(readFileSync(new URL(`${siteId}/${file}`, SITES), 'utf8'));
const siteIds = readdirSync(SITES, { withFileTypes: true })
  .filter((d) => d.isDirectory() && existsSync(new URL(`${d.name}/metrics.json`, SITES)))
  .map((d) => d.name);

function dailyHours(flags, perDay, stepS) {
  const out = [];
  for (let i = 0; i < flags.length; i += perDay) {
    out.push(flags.slice(i, i + perDay).filter(Boolean).length * (stepS / 3600));
  }
  return out;
}

test('hay metrics.json para los 14 sitios reales y el de prueba', () => {
  assert.ok(siteIds.length >= 15, `se esperaban 15 sitios con metrics.json, hay ${siteIds.length}`);
});

for (const siteId of siteIds) {
  test(`${siteId}: las horas de metrics.json coinciden con el cálculo de la web`, () => {
    const eph = read(siteId, 'ephemeris.json');
    const metrics = read(siteId, 'metrics.json');
    const series = visibilitySeries(eph, read(siteId, 'horizon.json'));
    const perDay = 86400 / eph.time.step_s;
    const both = series.sun.visible.map((s, i) => s && series.earth.visible[i]);

    assert.equal(metrics.time.start_utc, eph.time.start_utc);
    assert.equal(metrics.time.step_s, 86400);
    assert.equal(metrics.time.count, eph.time.count / perDay);
    assert.deepEqual(metrics.daily.sun_hours, dailyHours(series.sun.visible, perDay, eph.time.step_s));
    assert.deepEqual(metrics.daily.earth_hours, dailyHours(series.earth.visible, perDay, eph.time.step_s));
    assert.deepEqual(metrics.daily.both_hours, dailyHours(both, perDay, eph.time.step_s));
  });
}
