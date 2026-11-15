// Pruebas del overlay de debug (lógica pura). Correr con: npm test (dentro de web/).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createFpsMeter, ratePerSecond, formatCount } from './debug-core.js';

test('fps meter da ~60 para cuadros de 16,67 ms', () => {
  const meter = createFpsMeter(500);
  let out = { fps: 0, frameMs: 0 };
  for (let i = 0; i <= 60; i += 1) out = meter.tick(i * (1000 / 60));
  assert.ok(Math.abs(out.fps - 60) < 1, `fps ${out.fps}`);
  assert.ok(Math.abs(out.frameMs - 1000 / 60) < 1e-9);
});

test('fps meter queda en 0 hasta cumplir la ventana', () => {
  const meter = createFpsMeter(500);
  assert.equal(meter.tick(0).fps, 0);
  assert.equal(meter.tick(100).fps, 0);
});

test('ratePerSecond calcula eventos por segundo y evita dt nulo', () => {
  assert.equal(ratePerSecond(10, 40, 0, 1000), 30);
  assert.equal(ratePerSecond(10, 40, 500, 500), 0);
});

test('formatCount separa miles', () => {
  assert.equal(formatCount(1234567).replace(/\s/g, ''), '1.234.567');
  assert.equal(formatCount(12.4), '12');
});
