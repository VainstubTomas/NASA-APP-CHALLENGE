// Pruebas del núcleo de comparación (C4-01a, #91). Correr con: npm test (dentro de web/).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { summarizeScenario, pickBest } from './compare-core.js';

// Efeméride hecha a mano, 1 muestra por hora desde 2026-11-01T00:00Z (ver ephemeris.test.js).
// Sol (radio 0,25°), horizonte plano 0°: visible en 0,1,2,3 y 7 -> 5 horas.
// Tierra (radio 1°), horizonte plano 0°: visible en 5,6,7 -> 3 horas.
const mini = {
  site_id: 'mini',
  time: { start_utc: '2026-11-01T00:00:00Z', step_s: 3600, count: 8 },
  angular_radius_deg: { sun: 0.25, earth: 1.0 },
  sun: { azimuth_deg: Array(8).fill(10), elevation_deg: [2, 1, 0.5, 0.1, -0.25, -1, -2, 0.3] },
  earth: { azimuth_deg: Array(8).fill(90), elevation_deg: [-5, -4, -3, -2, -1, 0, 3, 3] },
};
const flat = { site_id: 'mini', azimuth_start_deg: 0, azimuth_step_deg: 1, elevation_deg: Array(360).fill(0) };
const T0 = Date.parse('2026-11-01T00:00:00Z');

test('resumen de escenario: caso conocido con horizonte plano', () => {
  const s = summarizeScenario(mini, flat, T0, 7);
  assert.equal(s.sunHours, 5);
  assert.equal(s.earthHours, 3);
  assert.equal(s.next.sun.event, 'sets');
  assert.equal(s.next.earth.event, 'rises');
});

test('resumen de escenario: fuera de los datos devuelve null', () => {
  assert.equal(summarizeScenario(mini, flat, T0 - 3600 * 1000, 7), null);
});

test('elegir: gana más horas de Sol', () => {
  const a = { id: 'a', summary: { sunHours: 5, earthHours: 1 } };
  const b = { id: 'b', summary: { sunHours: 7, earthHours: 0 } };
  assert.deepEqual(pickBest([a, b]), { id: 'b', tie: false });
});

test('elegir: en empate de Sol gana más horas de Tierra visible', () => {
  const a = { id: 'a', summary: { sunHours: 5, earthHours: 2 } };
  const b = { id: 'b', summary: { sunHours: 5, earthHours: 4 } };
  assert.deepEqual(pickBest([a, b]), { id: 'b', tie: false });
});

test('elegir: empate total se marca como tie', () => {
  const a = { id: 'a', summary: { sunHours: 5, earthHours: 2 } };
  const b = { id: 'b', summary: { sunHours: 5, earthHours: 2 } };
  assert.equal(pickBest([a, b]).tie, true);
});

test('elegir: ignora escenarios sin datos y devuelve null si no queda ninguno', () => {
  assert.equal(pickBest([{ id: 'a', summary: null }]), null);
  const b = { id: 'b', summary: { sunHours: 1, earthHours: 0 } };
  assert.deepEqual(pickBest([{ id: 'a', summary: null }, b]), { id: 'b', tie: false });
});
