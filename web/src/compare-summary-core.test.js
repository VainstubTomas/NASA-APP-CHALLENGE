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

// ---- Grupos de escenarios duplicados (#107): cada item es un grupo con `ns` (números de escenario) ----
const grp = (id, ns, sunHours, earthHours) => ({ ...sc(id, sunHours, earthHours), ns });

test('un solo grupo con varios escenarios: misma fecha y lugar, sin ganador', () => {
  assert.deepEqual(explainBest([grp('s1', [1, 2, 3], 80, 40)]), { kind: 'same', id: 's1', ns: [1, 2, 3] });
});

test('un grupo de dos y otro escenario sin datos: sigue siendo el mismo caso repetido', () => {
  const r = explainBest([grp('s1', [1, 3], 80, 40), grp('s2', [2], null)]);
  assert.deepEqual(r, { kind: 'same', id: 's1', ns: [1, 3] });
});

test('un grupo de uno solo con datos sigue siendo only', () => {
  assert.deepEqual(explainBest([grp('s1', [1], null), grp('s2', [2], 30, 2)]), { kind: 'only', id: 's2' });
});

test('dos grupos: gana el de más horas de Sol y el resumen apunta al grupo', () => {
  const r = explainBest([grp('s1', [1, 3], 20, 5), grp('s2', [2], 90, 5)]);
  assert.deepEqual(r, { kind: 'sun', id: 's2', hours: 90, otherHours: 20 });
});

test('dos grupos con el mismo Sol: gana el de más horas de Tierra', () => {
  const r = explainBest([grp('s1', [1, 3], 80, 10), grp('s2', [2], 80, 40)]);
  assert.deepEqual(r, { kind: 'earth', id: 's2', sunHours: 80, hours: 40, otherHours: 10 });
});

test('dos grupos que empatan en todo: tie con los ids de los grupos', () => {
  const r = explainBest([grp('s1', [1, 3], 80, 40), grp('s2', [2], 80, 40)]);
  assert.deepEqual(r, { kind: 'tie', ids: ['s1', 's2'], sunHours: 80, earthHours: 40 });
});

test('items sin ns (como antes del #107) se comportan igual que siempre', () => {
  assert.deepEqual(explainBest([sc('s1', 80, 40), sc('s2', 80, 40)]), { kind: 'tie', ids: ['s1', 's2'], sunHours: 80, earthHours: 40 });
});
