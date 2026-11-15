// Pruebas del núcleo de la consulta en vivo (#104). Correr con: npm test (dentro de web/).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseCoord, validateCoords, dayStartMs, buildLiveUrl, flatHorizon, apiErrorMessage, createLiveLoader,
} from './live-core.js';
import { checkHorizon } from './contract.js';

const T = Date.parse('2026-11-30T06:00:00Z');

test('parseCoord: acepta coma decimal y devuelve NaN si está vacío o no es número', () => {
  assert.equal(parseCoord('-89,5'), -89.5);
  assert.equal(parseCoord(' 30 '), 30);
  assert.ok(Number.isNaN(parseCoord('')));
  assert.ok(Number.isNaN(parseCoord('abc')));
});

test('validateCoords: caso válido y límites', () => {
  assert.deepEqual(validateCoords('0', '30'), { ok: true, lat: 0, lon: 30, errors: [] });
  assert.equal(validateCoords('-90', '-180').ok, true);
  assert.equal(validateCoords('90', '180').ok, true);
});

test('validateCoords: rechaza fuera de rango, vacío y no numérico, diciendo qué campo falla', () => {
  assert.deepEqual(validateCoords('91', '0').errors, ['lat']);
  assert.deepEqual(validateCoords('-90.1', '0').errors, ['lat']);
  assert.deepEqual(validateCoords('0', '181').errors, ['lon']);
  assert.deepEqual(validateCoords('0', '-180.5').errors, ['lon']);
  assert.deepEqual(validateCoords('', 'x').errors, ['lat', 'lon']);
  assert.deepEqual(validateCoords('Infinity', '0').errors, ['lat']);
});

test('dayStartMs: inicio del día UTC', () => {
  assert.equal(dayStartMs(T), Date.parse('2026-11-30T00:00:00Z'));
});

test('buildLiveUrl: arma la consulta a la API con fecha UTC sin milisegundos', () => {
  assert.equal(
    buildLiveUrl('http://localhost:8000/', 0, 30, dayStartMs(T)),
    'http://localhost:8000/ephemeris?lat=0&lon=30&start=2026-11-30T00%3A00%3A00Z&days=14',
  );
});

test('flatHorizon: 360 ceros que cumplen el contrato de horizon.json', () => {
  const h = flatHorizon('live-n0p0-e30p0');
  assert.equal(h.elevation_deg.length, 360);
  assert.ok(h.elevation_deg.every((v) => v === 0));
  assert.deepEqual(checkHorizon(h, 'live-n0p0-e30p0'), []);
});

test('apiErrorMessage: texto, lista de FastAPI o estado HTTP', () => {
  assert.equal(apiErrorMessage({ detail: 'Horizons falló' }, 502), 'Horizons falló');
  assert.equal(apiErrorMessage({ detail: [{ msg: 'a' }, { msg: 'b' }] }, 422), 'a; b');
  assert.equal(apiErrorMessage(null, 500), 'HTTP 500');
});

function ephemeris(siteId = 'live-n0p0-e30p0', count = 3) {
  return {
    schema_version: '1.0',
    site_id: siteId,
    time: { start_utc: '2026-11-30T00:00:00Z', step_s: 3600, count },
    sun: { azimuth_deg: Array(count).fill(10), elevation_deg: Array(count).fill(1) },
    earth: { azimuth_deg: Array(count).fill(90), elevation_deg: Array(count).fill(3) },
    angular_radius_deg: { sun: 0.25, earth: 1 },
  };
}
const okFetch = (body, calls) => async (url) => {
  calls.push(url);
  return { ok: true, status: 200, json: async () => body };
};

test('loader: devuelve efemérides con horizonte liso y no repite el pedido del mismo día', async () => {
  const calls = [];
  const loader = createLiveLoader({ apiBase: 'http://api', fetchImpl: okFetch(ephemeris(), calls) });
  const a = await loader.load(0, 30, T);
  await loader.load(0, 30, T + 3 * 3600 * 1000); // mismo día UTC
  assert.equal(calls.length, 1);
  assert.equal(a.horizon.site_id, a.ephemeris.site_id);
  await loader.load(0, 30, T + 24 * 3600 * 1000); // otro día
  assert.equal(calls.length, 2);
});

test('loader: error de la API se informa con su mensaje y el próximo pedido reintenta', async () => {
  const calls = [];
  const fetchImpl = async (url) => {
    calls.push(url);
    return { ok: false, status: 502, json: async () => ({ detail: 'JPL Horizons devolvió un error' }) };
  };
  const loader = createLiveLoader({ apiBase: 'http://api', fetchImpl });
  await assert.rejects(loader.load(0, 30, T), /JPL Horizons devolvió un error/);
  await assert.rejects(loader.load(0, 30, T), /JPL Horizons/);
  assert.equal(calls.length, 2);
});

test('loader: sin conexión o formato inesperado rechaza, no inventa datos', async () => {
  const down = createLiveLoader({ apiBase: 'http://api', fetchImpl: async () => { throw new TypeError('Failed to fetch'); } });
  await assert.rejects(down.load(0, 30, T), /no se pudo conectar con la API/);
  const bad = createLiveLoader({ apiBase: 'http://api', fetchImpl: okFetch({ ...ephemeris(), schema_version: '9' }, []) });
  await assert.rejects(bad.load(0, 30, T), /formato inesperado/);
});
