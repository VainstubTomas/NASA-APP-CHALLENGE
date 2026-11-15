// C3-06 (#39): comparación de la web contra los valores de referencia de Horizons (ADR-013).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { compareRows, angleDiff, compareDailyHours } from './validation.js';
import { visibilitySeries } from './visibility.js';

const PUBLIC = new URL('../../data/public/', import.meta.url);
const read = (path) => JSON.parse(readFileSync(new URL(path, PUBLIC), 'utf8'));
const validation = read('validation.json');

test('angleDiff toma el camino corto alrededor de 0/360', () => {
  assert.ok(Math.abs(angleDiff(359.9, 0.1) - 0.2) < 1e-9);
  assert.ok(Math.abs(angleDiff(0.1, 359.9) - 0.2) < 1e-9);
  assert.equal(angleDiff(90, 100), 10);
});

test('caso conocido: apollo-12 Sol 2026-11-14T00:00Z coincide con Horizons dentro de tolerancia', () => {
  const ephemeris = read('sites/apollo-12/ephemeris.json');
  const [res] = compareRows(
    validation.rows.filter((r) => r.site_id === 'apollo-12' && r.body === 'sun' && r.time_utc === '2026-11-14T00:00:00Z'),
    { tolerance: validation.tolerance_deg, ephemerisBySite: { 'apollo-12': ephemeris } },
  );
  assert.equal(res.status, 'within');
  // La web guarda 3 decimales (redondeo de efemerides); Horizons trae 6.
  assert.equal(res.web.azimuth_deg, 98.281);
  assert.equal(res.web.elevation_deg, -59.703);
});

test('fecha fuera del rango de la web: status outOfRange y no es error', () => {
  const ephemeris = read('sites/apollo-12/ephemeris.json');
  // Una fila con una fecha posterior al fin de los datos (2027-12-31T23:00Z).
  const [row] = validation.rows.filter((r) => r.site_id === 'apollo-12' && r.body === 'sun' && r.time_utc === '2027-06-21T00:00:00Z');
  const [res] = compareRows(
    [{ ...row, time_utc: '2028-01-01T00:00:00Z' }],
    { tolerance: validation.tolerance_deg, ephemerisBySite: { 'apollo-12': ephemeris } },
  );
  assert.equal(res.status, 'outOfRange');
  assert.equal(res.web, null);
});

test('las referencias de 2027-06-21 (rango ampliado hasta 2027-12-31) coinciden con Horizons dentro de tolerancia', () => {
  const rows = validation.rows.filter((r) => r.time_utc.startsWith('2027-06-21'));
  assert.ok(rows.length > 0);
  const ephemerisBySite = Object.fromEntries(
    [...new Set(rows.map((r) => r.site_id))].map((id) => [id, read(`sites/${id}/ephemeris.json`)]),
  );
  for (const res of compareRows(rows, { tolerance: validation.tolerance_deg, ephemerisBySite })) {
    assert.equal(res.status, 'within', `${res.site_id} ${res.body} ${res.time_utc}`);
  }
});

test('diferencia mayor que la tolerancia: status outside', () => {
  const ephemeris = read('sites/apollo-12/ephemeris.json');
  const [row] = validation.rows.filter((r) => r.site_id === 'apollo-12' && r.body === 'sun' && r.time_utc === '2026-11-14T00:00:00Z');
  const shifted = { ...row, elevation_deg: row.elevation_deg + 0.5 };
  const [res] = compareRows([shifted], { tolerance: 0.1, ephemerisBySite: { 'apollo-12': ephemeris } });
  assert.equal(res.status, 'outside');
  assert.ok(Math.abs(res.diff.elevation_deg - 0.5) < 0.001); // redondeo de la web a 3 decimales
});

test('todas las filas de referencia de los sitios con datos caen dentro de tolerancia o fuera de rango, nunca fuera de tolerancia', () => {
  const sites = [...new Set(validation.rows.map((r) => r.site_id))];
  const ephemerisBySite = Object.fromEntries(sites.map((id) => [id, read(`sites/${id}/ephemeris.json`)]));
  const results = compareRows(validation.rows, { tolerance: validation.tolerance_deg, ephemerisBySite });
  const outside = results.filter((r) => r.status === 'outside');
  assert.deepEqual(outside.map((r) => `${r.site_id} ${r.body} ${r.time_utc}`), []);
  assert.ok(results.some((r) => r.status === 'within'));
});

test('cruce con metrics.json: sin diferencias para apollo-12', () => {
  const eph = read('sites/apollo-12/ephemeris.json');
  const horizon = read('sites/apollo-12/horizon.json');
  const metrics = read('sites/apollo-12/metrics.json');
  assert.deepEqual(compareDailyHours(eph, horizon, metrics), []);
});

test('cruce: si metrics.json no existe, devuelve null (pendiente C3-01)', () => {
  assert.equal(compareDailyHours(read('sites/apollo-12/ephemeris.json'), read('sites/apollo-12/horizon.json'), null), null);
});

test('cruce: una hora cambiada aparece como diferencia', () => {
  const eph = read('sites/apollo-12/ephemeris.json');
  const horizon = read('sites/apollo-12/horizon.json');
  const metrics = read('sites/apollo-12/metrics.json');
  const broken = structuredClone(metrics);
  broken.daily.sun_hours[0] += 1;
  const diffs = compareDailyHours(eph, horizon, broken);
  assert.deepEqual(diffs.map((d) => `${d.field}[${d.index}]`), ['sun_hours[0]']);
});
