// Pruebas de la ventana, los tramos y las marcas de la línea de tiempo (C3-03). Correr con: npm test.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { timelineWindow, runs, dayMarks, DAY_MS } from './timeline-core.js';

// 10 días con una muestra por hora, desde la medianoche del 1/11/2026 (como los ephemeris.json reales).
const time = { start_utc: '2026-11-01T00:00:00Z', step_s: 3600, count: 240 };
const at = (iso) => Date.parse(iso);

test('la ventana arranca a las 00:00 UTC del día elegido y dura 7 días', () => {
  const w = timelineWindow(time, at('2026-11-03T15:00:00Z'), 7);
  assert.equal(w.first, 48); // 2 días x 24 h
  assert.equal(w.last, 48 + 7 * 24); // 216 < 240: entran los 7 días
  assert.equal(w.days, 7);
});

test('la marca de "ahora" cae en la hora elegida dentro de la ventana', () => {
  const w = timelineWindow(time, at('2026-11-03T12:00:00Z'), 4);
  assert.equal(w.first, 48);
  assert.equal(w.last, 48 + 96);
  assert.ok(Math.abs(w.nowFraction - 12 / 96) < 1e-12);
});

test('si los datos terminan antes, la ventana es más corta y lo dice en days', () => {
  const w = timelineWindow(time, at('2026-11-09T06:00:00Z'), 7);
  assert.equal(w.first, 8 * 24);
  assert.equal(w.last, 240);
  assert.equal(w.days, 2);
});

test('el primer día de los datos arranca en la primera muestra', () => {
  const w = timelineWindow(time, at('2026-11-01T00:00:00Z'), 7);
  assert.equal(w.first, 0);
  assert.equal(w.nowFraction, 0);
});

test('con datos que no empiezan a medianoche, la ventana arranca en la primera muestra', () => {
  const shifted = { start_utc: '2026-11-01T06:00:00Z', step_s: 3600, count: 100 };
  const w = timelineWindow(shifted, at('2026-11-01T10:00:00Z'), 2);
  assert.equal(w.first, 0);
  assert.equal(w.last, 48);
});

test('fuera del rango de datos devuelve null (antes, después y valores inválidos)', () => {
  assert.equal(timelineWindow(time, at('2026-10-31T23:00:00Z')), null);
  assert.equal(timelineWindow(time, at('2026-11-11T00:00:00Z')), null); // el rango termina en 11/11 00:00 (excluido)
  assert.equal(timelineWindow(time, at('2026-11-10T23:00:00Z')).first, 9 * 24);
  assert.equal(timelineWindow(time, NaN), null);
});

test('runs: tramos continuos, incluidos los que tocan los bordes', () => {
  assert.deepEqual(runs([]), []);
  assert.deepEqual(runs([false, false]), []);
  assert.deepEqual(runs([true, true, false, true, false, false, true]), [[0, 2], [3, 4], [6, 7]]);
  assert.deepEqual(runs([true, true, true]), [[0, 3]]);
});

test('dayMarks: la primera muestra y cada medianoche UTC', () => {
  const marks = dayMarks(time, 30, 80); // 02/11 06:00 .. 04/11 08:00
  assert.deepEqual(marks.map((m) => m.offset), [0, 18, 42]);
  assert.equal(new Date(marks[1].ms).toISOString(), '2026-11-03T00:00:00.000Z');
  assert.equal(marks[2].ms % DAY_MS, 0);
});
