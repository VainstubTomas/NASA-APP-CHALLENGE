// Pruebas del núcleo de comparación (C4-01a, #91). Correr con: npm test (dentro de web/).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { summarizeScenario, pickBest, groupScenarios } from './compare-core.js';
import { HOUR_MS } from './state.js';

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

// ---- Agrupar escenarios duplicados (#107) ----
// Un item es lo que devuelve summarizeAll: { id, n, site, t, name, summary } (summary null = sin datos).
const item = (n, site, t, summary = { sunHours: 10, earthHours: 5 }) => ({ id: `s${n}`, n, site, t, name: site, summary });
const H = Date.parse('2026-11-20T00:00:00Z');

test('agrupar: tres escenarios iguales forman un solo grupo', () => {
  const groups = groupScenarios([item(1, 'apollo-11', H), item(2, 'apollo-11', H), item(3, 'apollo-11', H)]);
  assert.equal(groups.length, 1);
  assert.deepEqual(groups[0].ns, [1, 2, 3]);
  assert.equal(groups[0].id, 's1'); // el grupo toma los datos del primero
});

test('agrupar: dos de tres iguales dan el grupo y el distinto, en el orden de la lista', () => {
  const groups = groupScenarios([item(1, 'apollo-11', H), item(2, 'slim', H), item(3, 'apollo-11', H)]);
  assert.deepEqual(groups.map((g) => g.ns), [[1, 3], [2]]);
  assert.deepEqual(groups.map((g) => g.id), ['s1', 's2']);
});

test('agrupar: mismo sitio con otra hora, o misma hora con otro sitio, no es duplicado', () => {
  assert.equal(groupScenarios([item(1, 'apollo-11', H), item(2, 'apollo-11', H + HOUR_MS)]).length, 2);
  assert.equal(groupScenarios([item(1, 'apollo-11', H), item(2, 'slim', H)]).length, 2);
});

test('agrupar: la hora se compara por hora entera (Math.floor(t / HOUR_MS))', () => {
  assert.equal(groupScenarios([item(1, 'slim', H), item(2, 'slim', H + 30 * 60 * 1000)]).length, 1);
});

test('agrupar: un escenario sin datos no entra a ningún grupo y queda como está', () => {
  const groups = groupScenarios([item(1, 'apollo-11', H), item(2, 'apollo-11', H, null), item(3, 'apollo-11', H)]);
  assert.deepEqual(groups.map((g) => g.ns), [[1, 3], [2]]);
  assert.equal(groups[1].summary, null);
});

test('agrupar: dos escenarios sin datos iguales tampoco se juntan', () => {
  const groups = groupScenarios([item(1, 'slim', H, null), item(2, 'slim', H, null)]);
  assert.deepEqual(groups.map((g) => g.ns), [[1], [2]]);
});

test('agrupar: no modifica los items de entrada', () => {
  const input = [item(1, 'slim', H), item(2, 'slim', H)];
  groupScenarios(input);
  assert.equal(input[0].ns, undefined);
  assert.equal(input.length, 2);
});
