// Pruebas del resumen "cuál conviene" (C4-01d, #94). Criterio de ADR-014. Correr con: npm test (dentro de web/).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { explainBest } from './compare-summary-core.js';

const sc = (id, sunHours, earthHours) => ({ id, summary: sunHours === null ? null : { sunHours, earthHours } });

test('gana por más horas de Sol y compara contra el segundo', () => {
  const r = explainBest([sc('s1', 22, 168), sc('s2', 166, 168), sc('s3', 57, 0)]);
  assert.deepEqual(r, { kind: 'sun', id: 's2', hours: 166, otherHours: 57 });
});

test('en empate de Sol gana por más horas de Tierra visible', () => {
  const r = explainBest([sc('s1', 80, 10), sc('s2', 80, 40)]);
  assert.deepEqual(r, { kind: 'earth', id: 's2', sunHours: 80, hours: 40, otherHours: 10 });
});

test('empate total: lo dice y lista los empatados', () => {
  const r = explainBest([sc('s1', 80, 40), sc('s2', 80, 40)]);
  assert.deepEqual(r, { kind: 'tie', ids: ['s1', 's2'], sunHours: 80, earthHours: 40 });
});

test('empate total entre los dos mejores de tres deja afuera al tercero', () => {
  const r = explainBest([sc('s1', 10, 0), sc('s2', 80, 40), sc('s3', 80, 40)]);
  assert.deepEqual(r, { kind: 'tie', ids: ['s2', 's3'], sunHours: 80, earthHours: 40 });
});

test('mismo resultado que pickBest: el orden de la lista no cambia el ganador', () => {
  const a = explainBest([sc('s1', 5, 9), sc('s2', 7, 0)]);
  const b = explainBest([sc('s2', 7, 0), sc('s1', 5, 9)]);
  assert.equal(a.id, 's2');
  assert.deepEqual(a, b);
});

test('con un solo escenario con datos no hay comparación', () => {
  assert.deepEqual(explainBest([sc('s1', null), sc('s2', 30, 2)]), { kind: 'only', id: 's2' });
});

test('sin datos en ningún escenario devuelve none', () => {
  assert.deepEqual(explainBest([sc('s1', null), sc('s2', null)]), { kind: 'none' });
});
