// Pruebas de la lista de escenarios a comparar (C4-01b, #92). Correr con: npm test (dentro de web/).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  MIN_SCENARIOS, MAX_SCENARIOS, DEFAULT_OFFSET_MS,
  initialScenarios, canAdd, canRemove, addScenario, removeScenario, updateScenario,
} from './scenarios-core.js';
import { HOUR_MS } from './state.js';

const DAY_MS = 24 * HOUR_MS;
const T0 = Date.parse('2026-11-15T00:00:00Z');
const range = { minMs: T0, maxMs: Date.parse('2027-02-28T23:00:00Z') };
const current = { site: 'apollo-11', t: T0 };

test('límites: mínimo 2 y máximo 3 escenarios', () => {
  assert.equal(MIN_SCENARIOS, 2);
  assert.equal(MAX_SCENARIOS, 3);
});

test('arranca con 2 escenarios: el primero es la selección actual', () => {
  const list = initialScenarios(current, range);
  assert.equal(list.length, 2);
  assert.deepEqual({ site: list[0].site, t: list[0].t }, current);
  // El segundo es el mismo sitio, medio día lunar después (contraste día / noche).
  assert.equal(list[1].site, 'apollo-11');
  assert.equal(list[1].t, T0 + DEFAULT_OFFSET_MS);
  assert.notEqual(list[0].id, list[1].id);
});

test('el escenario por defecto no se sale del rango de datos', () => {
  const late = { site: 'apollo-11', t: range.maxMs };
  const list = initialScenarios(late, range);
  assert.equal(list[1].t, range.maxMs);
});

test('se puede agregar hasta 3 y no más', () => {
  let list = initialScenarios(current, range);
  assert.equal(canAdd(list), true);
  list = addScenario(list, range);
  assert.equal(list.length, 3);
  assert.equal(canAdd(list), false);
  assert.equal(addScenario(list, range), list, 'con 3 no cambia la lista');
  assert.equal(new Set(list.map((s) => s.id)).size, 3, 'ids distintos');
});

test('quitar: nunca menos de 2', () => {
  let list = addScenario(initialScenarios(current, range), range);
  assert.equal(canRemove(list), true);
  list = removeScenario(list, list[1].id);
  assert.equal(list.length, 2);
  assert.equal(canRemove(list), false);
  assert.equal(removeScenario(list, list[0].id), list, 'con 2 no cambia la lista');
});

test('quitar uno y agregar otro no repite ids', () => {
  let list = addScenario(initialScenarios(current, range), range);
  const removed = list[2].id;
  list = addScenario(removeScenario(list, removed), range);
  const ids = list.map((s) => s.id);
  assert.equal(new Set(ids).size, 3);
});

test('actualizar cambia solo el escenario pedido y redondea la fecha al rango', () => {
  const list = initialScenarios(current, range);
  const next = updateScenario(list, list[1].id, { site: 'chang-e-6', t: T0 + 2 * DAY_MS + 20 * 60 * 1000 }, range);
  assert.deepEqual(next[0], list[0]);
  assert.equal(next[1].site, 'chang-e-6');
  assert.equal(next[1].t, T0 + 2 * DAY_MS, 'redondea a la hora');
  const early = updateScenario(list, list[0].id, { t: T0 - 5 * DAY_MS }, range);
  assert.equal(early[0].t, range.minMs, 'no deja elegir antes del rango');
});
