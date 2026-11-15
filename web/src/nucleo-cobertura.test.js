// Pruebas de ramas que faltaban en el núcleo web (#106). Correr con: npm test (dentro de web/).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { checkEphemeris, checkHorizon } from './contract.js';
import { rulerRadius, RULER } from './dials-core.js';
import { compareRows, compareDailyHours } from './validation.js';
import { seriesSummary } from './visibility.js';
import { createTranslator } from './i18n-core.js';
import { parseCoord, apiErrorMessage, createLiveLoader } from './live-core.js';

const SITES = new URL('../../data/public/sites/', import.meta.url);
const read = (siteId, file) => JSON.parse(readFileSync(new URL(`${siteId}/${file}`, SITES), 'utf8'));
const clone = (obj) => structuredClone(obj);

test('contract: ephemeris rechaza start_utc que no es UTC, step_s y count inválidos', () => {
  const base = read('apollo-11', 'ephemeris.json');
  const bad = clone(base);
  bad.time.start_utc = '2026-11-15 00:00';
  assert.match(checkEphemeris(bad, 'apollo-11').join(' '), /time\.start_utc/);
  const step = clone(base);
  step.time.step_s = 0;
  assert.match(checkEphemeris(step, 'apollo-11').join(' '), /time\.step_s/);
  const count = clone(base);
  count.time.count = 1.5;
  assert.match(checkEphemeris(count, 'apollo-11').join(' '), /time\.count/);
});

test('contract: horizon rechaza schema_version, site_id y azimuth_step_deg no positivo', () => {
  const base = read('apollo-11', 'horizon.json');
  const version = clone(base);
  version.schema_version = '2.0';
  assert.match(checkHorizon(version, 'apollo-11').join(' '), /schema_version/);
  assert.match(checkHorizon(clone(base), 'apollo-12').join(' '), /site_id/);
  const step = clone(base);
  step.azimuth_step_deg = -1;
  assert.match(checkHorizon(step, 'apollo-11').join(' '), /azimuth_step_deg/);
});

test('dials: rulerRadius respeta el mínimo en px y crece con el radio angular', () => {
  const pxPerDeg = (RULER.y0 - RULER.yTop) / 90;
  assert.equal(rulerRadius(0), 7);
  assert.equal(rulerRadius(0.1), 7);
  assert.ok(Math.abs(rulerRadius(10) - 10 * pxPerDeg) < 1e-9);
  assert.equal(rulerRadius(10, 2), 10 * pxPerDeg);
});

test('validation: compareRows marca noData si falta el sitio y outOfRange fuera de las efemérides', () => {
  const ephemeris = read('apollo-11', 'ephemeris.json');
  const row = (site_id, time_utc) => ({ site_id, body: 'sun', time_utc, azimuth_deg: 0, elevation_deg: 0 });
  const [noData] = compareRows([row('sin-datos', '2026-11-15T00:00:00Z')], { tolerance: 1, ephemerisBySite: {} });
  assert.equal(noData.status, 'noData');
  const [outside] = compareRows([row('apollo-11', '2030-01-01T00:00:00Z')], { tolerance: 1, ephemerisBySite: { 'apollo-11': ephemeris } });
  assert.equal(outside.status, 'outOfRange');
});

test('validation: compareDailyHours informa días que sobran o faltan en metrics.json', () => {
  const ephemeris = read('apollo-11', 'ephemeris.json');
  const horizon = read('apollo-11', 'horizon.json');
  const metrics = clone(read('apollo-11', 'metrics.json'));
  metrics.daily.sun_hours.push(5);
  const extra = compareDailyHours(ephemeris, horizon, metrics).find((d) => d.index === metrics.daily.sun_hours.length - 1);
  assert.deepEqual(extra, { field: 'sun_hours', index: metrics.daily.sun_hours.length - 1, web: null, metrics: 5 });
  const short = clone(read('apollo-11', 'metrics.json'));
  short.daily.earth_hours.length = 1;
  const missing = compareDailyHours(ephemeris, horizon, short).find((d) => d.field === 'earth_hours' && d.index === 1);
  assert.equal(missing.metrics, null);
  assert.notEqual(missing.web, null);
});

test('visibility: seriesSummary cuenta horas y arma la cadena de las primeras 48 muestras', () => {
  const series = {
    sun: { visible: [false, true, true], fully_visible: [false, false, true] },
    earth: { visible: [], fully_visible: [] },
  };
  assert.deepEqual(seriesSummary(series), {
    samples: 3,
    sun_visible_hours: 2,
    sun_fully_visible_hours: 1,
    earth_visible_hours: 0,
    earth_fully_visible_hours: 0,
    sun_first_48h: '011',
  });
});

test('i18n: un {variable} sin valor se deja tal cual', () => {
  const t = createTranslator({ es: { k: 'Hola {nombre} {otro}' } }, 'es');
  assert.equal(t('k', { nombre: 'Ana' }), 'Hola Ana {otro}');
});

test('live: parseCoord sin valor da NaN; apiErrorMessage usa strings de la lista y cae al estado HTTP', () => {
  assert.ok(Number.isNaN(parseCoord(undefined)));
  assert.equal(apiErrorMessage({ detail: ['texto suelto'] }, 500), 'texto suelto');
  assert.equal(apiErrorMessage({ detail: [] }, 500), 'HTTP 500');
});

test('live: error HTTP con cuerpo que no es JSON informa el estado', async () => {
  const fetchImpl = async () => ({ ok: false, status: 500, json: async () => { throw new SyntaxError('no es JSON'); } });
  const loader = createLiveLoader({ apiBase: 'http://api', fetchImpl });
  await assert.rejects(loader.load(0, 30, Date.parse('2026-11-30T06:00:00Z')), /HTTP 500/);
});
