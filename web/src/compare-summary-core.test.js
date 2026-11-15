// Pruebas del resumen de la comparación (#94, decisión del equipo: ADR-017). Correr con: npm test (dentro de web/).
// La herramienta no elige un escenario "mejor": por cada métrica (horas de Sol, horas de Tierra visible)
// marca cuál tiene más horas y deja que la persona decida según lo que necesite su misión.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { compareMetrics } from './compare-summary-core.js';

const sc = (id, sunHours, earthHours) => ({ id, summary: sunHours === null ? null : { sunHours, earthHours } });
const grp = (id, ns, sunHours, earthHours) => ({ ...sc(id, sunHours, earthHours), ns });

test('dos escenarios: marca quién tiene más Sol y quién más Tierra, por separado', () => {
  const r = compareMetrics([sc('s1', 166, 40), sc('s2', 57, 168)]);
  assert.deepEqual(r, {
    kind: 'metrics',
    sun: { kind: 'more', ids: ['s1'], hours: 166, otherHours: 57 },
    earth: { kind: 'more', ids: ['s2'], hours: 168, otherHours: 40 },
  });
});

test('un mismo escenario puede ganar las dos métricas: no se combinan en un veredicto', () => {
  const r = compareMetrics([sc('s1', 100, 100), sc('s2', 10, 20)]);
  assert.deepEqual(r.sun.ids, ['s1']);
  assert.deepEqual(r.earth.ids, ['s1']);
});

test('una diferencia mínima también se marca (la regla es matemática, sin umbral)', () => {
  const r = compareMetrics([sc('s1', 80, 40), sc('s2', 79, 40)]);
  assert.deepEqual(r.sun, { kind: 'more', ids: ['s1'], hours: 80, otherHours: 79 });
  assert.deepEqual(r.earth, { kind: 'equal', hours: 40 });
});

test('igualdad en una métrica: lo dice y no marca a nadie', () => {
  const r = compareMetrics([sc('s1', 80, 10), sc('s2', 80, 40)]);
  assert.deepEqual(r.sun, { kind: 'equal', hours: 80 });
  assert.deepEqual(r.earth, { kind: 'more', ids: ['s2'], hours: 40, otherHours: 10 });
});

test('tres escenarios: gana el que supera a los otros dos y se compara contra el siguiente', () => {
  const r = compareMetrics([sc('s1', 22, 168), sc('s2', 166, 168), sc('s3', 57, 0)]);
  assert.deepEqual(r.sun, { kind: 'more', ids: ['s2'], hours: 166, otherHours: 57 });
  assert.deepEqual(r.earth, { kind: 'more', ids: ['s1', 's2'], hours: 168, otherHours: 0 });
});

test('tres escenarios con dos al tope empatados: los dos se marcan, en el orden de la lista', () => {
  const r = compareMetrics([sc('s1', 10, 0), sc('s2', 80, 40), sc('s3', 80, 5)]);
  assert.deepEqual(r.sun, { kind: 'more', ids: ['s2', 's3'], hours: 80, otherHours: 10 });
  assert.deepEqual(r.earth, { kind: 'more', ids: ['s2'], hours: 40, otherHours: 5 });
});

test('tres escenarios iguales en una métrica: igual', () => {
  assert.deepEqual(compareMetrics([sc('s1', 5, 1), sc('s2', 5, 2), sc('s3', 5, 3)]).sun, { kind: 'equal', hours: 5 });
});

test('el orden de la lista no cambia quién tiene más horas', () => {
  const a = compareMetrics([sc('s1', 5, 9), sc('s2', 7, 0)]);
  const b = compareMetrics([sc('s2', 7, 0), sc('s1', 5, 9)]);
  assert.deepEqual(a.sun.ids, ['s2']);
  assert.deepEqual(b.sun.ids, ['s2']);
  assert.deepEqual(a.earth.ids, ['s1']);
});

test('un escenario sin datos no entra en la comparación', () => {
  const r = compareMetrics([sc('s1', null), sc('s2', 30, 2), sc('s3', 10, 8)]);
  assert.deepEqual(r.sun, { kind: 'more', ids: ['s2'], hours: 30, otherHours: 10 });
  assert.deepEqual(r.earth, { kind: 'more', ids: ['s3'], hours: 8, otherHours: 2 });
});

test('con un solo escenario con datos no hay comparación', () => {
  assert.deepEqual(compareMetrics([sc('s1', null), sc('s2', 30, 2)]), { kind: 'only', id: 's2' });
});

test('sin datos en ningún escenario devuelve none', () => {
  assert.deepEqual(compareMetrics([sc('s1', null), sc('s2', null)]), { kind: 'none' });
  assert.deepEqual(compareMetrics([]), { kind: 'none' });
});

// ---- Grupos de escenarios repetidos (#107): cada item es un grupo con `ns` (números de escenario) ----
test('un solo grupo con varios escenarios: misma fecha y lugar, nada que comparar', () => {
  assert.deepEqual(compareMetrics([grp('s1', [1, 2, 3], 80, 40)]), { kind: 'same', id: 's1', ns: [1, 2, 3] });
});

test('un grupo de dos y otro escenario sin datos: sigue siendo el mismo caso repetido', () => {
  assert.deepEqual(compareMetrics([grp('s1', [1, 3], 80, 40), grp('s2', [2], null)]), { kind: 'same', id: 's1', ns: [1, 3] });
});

test('un grupo de uno solo con datos sigue siendo only', () => {
  assert.deepEqual(compareMetrics([grp('s1', [1], null), grp('s2', [2], 30, 2)]), { kind: 'only', id: 's2' });
});

test('dos grupos distintos se comparan como cualquier par de escenarios', () => {
  const r = compareMetrics([grp('s1', [1, 3], 20, 5), grp('s2', [2], 90, 5)]);
  assert.deepEqual(r.sun, { kind: 'more', ids: ['s2'], hours: 90, otherHours: 20 });
  assert.deepEqual(r.earth, { kind: 'equal', hours: 5 });
});

test('no hay ningún veredicto global: el resultado no tiene ganador ni empate', () => {
  const r = compareMetrics([sc('s1', 100, 0), sc('s2', 0, 100)]);
  assert.deepEqual(Object.keys(r).sort(), ['earth', 'kind', 'sun']);
});
