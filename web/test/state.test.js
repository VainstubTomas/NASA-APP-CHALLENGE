import test from 'node:test';
import assert from 'node:assert/strict';
import {
  HOUR_MS, DATA_END_MS, startOfUtcDay, getRange, clampTime, formatT, parseT,
  toInputValue, fromInputValue, defaultSite, resolveState, buildSearch,
} from '../src/state.js';

const SITES = [
  { id: 'demo-sintetico', synthetic: true },
  { id: 'apollo-11' },
  { id: 'slim' },
];
const NOW = Date.UTC(2026, 10, 14, 15, 42); // 2026-11-14T15:42Z

test('el rango empieza al inicio del dia UTC actual y termina con los datos', () => {
  assert.equal(startOfUtcDay(NOW), Date.UTC(2026, 10, 14));
  assert.deepEqual(getRange(NOW), { minMs: Date.UTC(2026, 10, 14), maxMs: DATA_END_MS });
  assert.equal(formatT(DATA_END_MS), '2027-02-28T23:00Z');
});

test('formatT y parseT son inversos y aceptan segundos', () => {
  const ms = Date.UTC(2026, 10, 14, 5, 0);
  assert.equal(formatT(ms), '2026-11-14T05:00Z');
  assert.equal(parseT('2026-11-14T05:00Z'), ms);
  assert.equal(parseT('2026-11-14T05:00:00Z'), ms);
});

test('parseT rechaza entradas invalidas', () => {
  for (const bad of [null, undefined, '', 'hoy', '2026-11-14', '2026-13-40T00:00Z', '2026-11-14T05:00+03:00']) {
    assert.equal(parseT(bad), null, String(bad));
  }
});

test('clampTime redondea a la hora y respeta los limites', () => {
  const { minMs, maxMs } = getRange(NOW);
  assert.equal(clampTime(minMs + 29 * 60000, minMs, maxMs), minMs);
  assert.equal(clampTime(minMs + 31 * 60000, minMs, maxMs), minMs + HOUR_MS);
  assert.equal(clampTime(minMs - 5 * 24 * HOUR_MS, minMs, maxMs), minMs); // no hay pasado
  assert.equal(clampTime(maxMs + 99 * HOUR_MS, minMs, maxMs), maxMs);
});

test('el valor del input se maneja en UTC', () => {
  const ms = Date.UTC(2026, 10, 14, 7, 0);
  assert.equal(toInputValue(ms), '2026-11-14T07:00');
  assert.equal(fromInputValue('2026-11-14T07:00'), ms);
});

test('sitio por defecto: el primero real', () => {
  assert.equal(defaultSite(SITES), 'apollo-11');
  assert.equal(defaultSite([{ id: 'demo-sintetico', synthetic: true }]), 'demo-sintetico');
});

test('resolveState: URL valida se respeta', () => {
  const s = resolveState('?site=slim&t=2026-12-01T10:00Z', SITES, NOW);
  assert.deepEqual(s, { site: 'slim', t: Date.UTC(2026, 11, 1, 10) });
});

test('resolveState: sitio inexistente y fecha mala caen a los valores por defecto', () => {
  const s = resolveState('?site=marte&t=ayer', SITES, NOW);
  assert.deepEqual(s, { site: 'apollo-11', t: Date.UTC(2026, 10, 14) });
  assert.deepEqual(resolveState('', SITES, NOW), s);
});

test('resolveState: una fecha pasada se lleva al dia actual', () => {
  const s = resolveState('?site=slim&t=2026-11-02T00:00Z', SITES, NOW);
  assert.equal(s.t, Date.UTC(2026, 10, 14));
});

test('buildSearch y resolveState hacen ida y vuelta', () => {
  const state = { site: 'slim', t: Date.UTC(2027, 0, 3, 22) };
  assert.equal(buildSearch(state), '?site=slim&t=2027-01-03T22%3A00Z');
  assert.deepEqual(resolveState(buildSearch(state), SITES, NOW), state);
});
