// Regresión (#105): horas de Sol y de Tierra de un escenario contra valores de JPL Horizons (ADR-006).
// Los números esperados salen de Horizons, no de este código. Si cambian, o cambió el cálculo o
// los datos: hay que revisar contra Horizons antes de tocar el valor esperado.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { summarizeScenario } from './compare-core.js';

const SITES = new URL('../../data/public/sites/', import.meta.url);
const read = (siteId, file) => JSON.parse(readFileSync(new URL(`${siteId}/${file}`, SITES), 'utf8'));
const scenario = (siteId, startUtc, days = 7) =>
  summarizeScenario(read(siteId, 'ephemeris.json'), read(siteId, 'horizon.json'), Date.parse(startUtc), days);

// Tolerancia de un minuto: la web muestra el cruce del horizonte al minuto, Horizons lo da por hora.
const MINUTE_MS = 60_000;

test('Horizons: Apollo 11, 15/11/2026 00:00 UTC, 7 días: 166 h de Sol, 168 h de Tierra, sale 01:25 UTC', () => {
  const s = scenario('apollo-11', '2026-11-15T00:00:00Z');
  assert.equal(s.sunHours, 166);
  assert.equal(s.earthHours, 168);
  assert.equal(s.next.sun.event, 'rises');
  assert.ok(Math.abs(s.next.sun.crossMs - Date.parse('2026-11-15T01:25:00Z')) < MINUTE_MS);
});

test('Horizons: Apollo 11, 29/11/2026 00:00 UTC, 7 días: 22 h de Sol, 168 h de Tierra, se oculta 21:58 UTC', () => {
  const s = scenario('apollo-11', '2026-11-29T00:00:00Z');
  assert.equal(s.sunHours, 22);
  assert.equal(s.earthHours, 168);
  assert.equal(s.next.sun.event, 'sets');
  assert.ok(Math.abs(s.next.sun.crossMs - Date.parse('2026-11-29T21:58:00Z')) < MINUTE_MS);
});

test('Horizons: Apollo 14 (Fra Mauro), 29/11/2026 00:00 UTC, 7 días: 103 h de Sol, se oculta 3/12 07:00 UTC', () => {
  const s = scenario('apollo-14', '2026-11-29T00:00:00Z');
  assert.equal(s.sunHours, 103);
  assert.equal(s.next.sun.event, 'sets');
  assert.ok(Math.abs(s.next.sun.crossMs - Date.parse('2026-12-03T07:00:00Z')) < MINUTE_MS);
});

test('Horizons: Chang\'e 4 (cara oculta), 15/11/2026 00:00 UTC, 7 días: 57 h de Sol, 0 h de Tierra', () => {
  // Valores comprobados con precompute/ephemeris/horizons_client.py (Sol y Tierra, 15/11 a 21/11, 1 h).
  const s = scenario('change-4', '2026-11-15T00:00:00Z');
  assert.equal(s.sunHours, 57);
  assert.equal(s.earthHours, 0);
});
