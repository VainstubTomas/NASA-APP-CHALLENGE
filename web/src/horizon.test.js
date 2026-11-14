// Pruebas de visibilidad (C2-03). Leen los mismos casos que tests/test_visibility.py.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { horizonAt, isVisible, isFullyVisible, visibilitySeries, seriesSummary } from './horizon.js';

const read = (rel) => JSON.parse(readFileSync(new URL(rel, import.meta.url), 'utf8'));
const CASES = read('../../tests/fixtures/visibility_cases.json');

for (const c of CASES.horizon_at) {
  test(`horizonAt az ${c.azimuth_deg}`, () => {
    const got = horizonAt(CASES.horizons[c.horizon], c.azimuth_deg);
    assert.ok(Math.abs(got - c.expected) < 1e-9, `${got} != ${c.expected}`);
  });
}

for (const c of CASES.visibility) {
  test(`visibilidad: ${c.name}`, () => {
    const h = horizonAt(CASES.horizons[c.horizon], c.azimuth_deg);
    assert.equal(isVisible(c.elevation_deg, c.radius_deg, h), c.visible);
    assert.equal(isFullyVisible(c.elevation_deg, c.radius_deg, h), c.fully_visible);
  });
}

test('la serie del sitio de prueba coincide con la que calcula Python (golden compartido)', () => {
  const dir = '../../data/public/sites/demo-sintetico/';
  const series = visibilitySeries(read(`${dir}ephemeris.json`), read(`${dir}horizon.json`));
  assert.deepEqual(seriesSummary(series), CASES.series_golden['demo-sintetico']);
});

test('rechaza efemérides y horizonte de sitios distintos', () => {
  const eph = { site_id: 'a', sun: {}, earth: {}, angular_radius_deg: {} };
  assert.throws(() => visibilitySeries(eph, { site_id: 'b' }), /no coincide/);
});
