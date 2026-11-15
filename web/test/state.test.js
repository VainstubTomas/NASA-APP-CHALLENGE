import test from 'node:test';
import assert from 'node:assert/strict';
import {
  HOUR_MS, DATA_END_MS, startOfUtcDay, getRange, clampTime, formatT, parseT,
  toInputValue, fromInputValue, defaultSite, resolveState, buildSearch, mergeSearch,
} from '../src/state.js';
import { scenariosToParam, parseScenarios } from '../src/scenarios-core.js';

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

const DAY_MS = 24 * HOUR_MS;
const T0 = Date.parse('2026-11-15T00:00:00Z');
const range = { minMs: T0, maxMs: Date.parse('2027-02-28T23:00:00Z') };
const sites = [{ id: 'apollo-11' }, { id: 'shackleton' }];
// ---- C4-04 (#97): escenarios en la URL ----

const T1 = T0 + DAY_MS;

test('URL: ida y vuelta con 2 y con 3 escenarios', () => {
  const two = [{ id: 's1', site: 'apollo-11', t: T0 }, { id: 's2', site: 'shackleton', t: T1 }];
  assert.equal(scenariosToParam(two), 'apollo-11@2026-11-15T00:00Z,shackleton@2026-11-16T00:00Z');
  const back2 = parseScenarios(scenariosToParam(two), sites, range);
  assert.deepEqual(back2.map(({ site, t }) => ({ site, t })), two.map(({ site, t }) => ({ site, t })));
  const three = [...two, { id: 's3', site: 'apollo-11', t: T1 + HOUR_MS }];
  assert.equal(parseScenarios(scenariosToParam(three), sites, range).length, 3);
});

test('URL: los ids se regeneran únicos', () => {
  const list = parseScenarios('apollo-11@2026-11-15T00:00Z,apollo-11@2026-11-15T00:00Z', sites, range);
  assert.equal(new Set(list.map((s) => s.id)).size, 2);
});

test('URL: sin parámetro o con basura devuelve null (se usan los valores por defecto)', () => {
  assert.equal(parseScenarios(null, sites, range), null);
  assert.equal(parseScenarios('', sites, range), null);
  assert.equal(parseScenarios('basura', sites, range), null);
});

test('URL: se descartan las entradas inválidas y, con menos de 2 válidas, devuelve null', () => {
  const ok = 'apollo-11@2026-11-15T00:00Z';
  assert.equal(parseScenarios(`${ok},nadie@2026-11-16T00:00Z`, sites, range), null); // sitio inexistente
  assert.equal(parseScenarios(`${ok},shackleton@fecha-mala`, sites, range), null);
  assert.equal(parseScenarios(`${ok},shackleton@2026-11-16T00:00Z,nadie@x`, sites, range).length, 2);
});

test('URL: más de 3 escenarios se recortan a 3', () => {
  const e = (d) => `apollo-11@2026-11-${15 + d}T00:00Z`;
  assert.equal(parseScenarios([e(0), e(1), e(2), e(3)].join(','), sites, range).length, 3);
});

test('URL: la fecha fuera de rango se lleva al rango y se redondea a la hora', () => {
  const list = parseScenarios('apollo-11@2020-01-01T00:00Z,shackleton@2030-01-01T00:00Z', sites, range);
  assert.equal(list[0].t, range.minMs);
  assert.equal(list[1].t, range.maxMs);
});

test('mergeSearch: cambia lo pedido y conserva el resto de los parámetros', () => {
  const out = new URLSearchParams(mergeSearch('?site=apollo-11&t=2026-11-15T00:00Z&c=x', { c: 'y' }));
  assert.equal(out.get('site'), 'apollo-11');
  assert.equal(out.get('t'), '2026-11-15T00:00Z');
  assert.equal(out.get('c'), 'y');
  assert.equal(new URLSearchParams(mergeSearch('?c=x', { c: null })).has('c'), false);
});
