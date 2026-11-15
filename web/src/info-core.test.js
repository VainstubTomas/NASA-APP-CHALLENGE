// Pruebas de los cálculos del cajón "Más información" (#99). Correr con: npm test (dentro de web/).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { windowHours, periodSummary, longestRun } from './info-core.js';

const T = true;
const F = false;
// 10 muestras horarias de ejemplo
const vis = {
  sun: [T, T, T, F, F, F, F, T, T, T],
  earth: [T, F, T, T, T, T, F, F, T, T],
};

test('longestRun: el tramo más largo seguido con el valor pedido', () => {
  assert.equal(longestRun(vis.sun, false), 4);
  assert.equal(longestRun(vis.earth, false), 2);
  assert.equal(longestRun(vis.sun, true), 3);
  assert.equal(longestRun([], false), 0);
});

test('windowHours: horas con Sol, con Tierra y con los dos desde una muestra', () => {
  assert.deepEqual(windowHours(vis, 0, 4), { sun: 3, earth: 3, both: 2, hours: 4 });
  assert.deepEqual(windowHours(vis, 6, 24), { sun: 3, earth: 2, both: 2, hours: 4 }); // se recorta al final
  assert.deepEqual(windowHours(vis, 20, 24), { sun: 0, earth: 0, both: 0, hours: 0 });
});

test('periodSummary: totales del período, horas sin nada y peores tramos', () => {
  assert.deepEqual(periodSummary(vis), {
    samples: 10,
    sun: 6,
    earth: 7,
    both: 4,
    none: 1,
    longestNoSun: 4,
    longestNoEarth: 2,
    longestNoBoth: 5, // ambos = [V F V F F F F F V V]: de la 3 a la 7
  });
});
