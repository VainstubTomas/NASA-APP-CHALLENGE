// Pruebas de la lógica del reproductor de tiempo (C3-02). Correr con: npm test (dentro de web/).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { HOUR_MS } from './state.js';
import {
  DAY_MS, SPEEDS, stepTime, nextPlayTime, canStepBack, canStepForward, timeToSlider, sliderToTime,
} from './player-core.js';

const MIN = Date.UTC(2026, 10, 14); // 2026-11-14T00:00Z
const MAX = Date.UTC(2027, 1, 28, 23); // 2027-02-28T23:00Z

test('+1 hora y +1 día desde un instante conocido', () => {
  assert.equal(stepTime(MIN, HOUR_MS, MIN, MAX), Date.UTC(2026, 10, 14, 1));
  assert.equal(stepTime(MIN, DAY_MS, MIN, MAX), Date.UTC(2026, 10, 15));
  assert.equal(stepTime(Date.UTC(2026, 10, 14, 23), HOUR_MS, MIN, MAX), Date.UTC(2026, 10, 15, 0));
});

test('retroceder funciona, pero nunca antes del inicio (no hay pasado)', () => {
  assert.equal(stepTime(Date.UTC(2026, 10, 16), -DAY_MS, MIN, MAX), Date.UTC(2026, 10, 15));
  assert.equal(stepTime(MIN, -HOUR_MS, MIN, MAX), MIN);
  assert.equal(stepTime(Date.UTC(2026, 10, 14, 5), -DAY_MS, MIN, MAX), MIN);
});

test('avanzar nunca pasa del final de los datos', () => {
  assert.equal(stepTime(MAX, HOUR_MS, MIN, MAX), MAX);
  assert.equal(stepTime(MAX - HOUR_MS, DAY_MS, MIN, MAX), MAX);
});

test('los botones se deshabilitan en los bordes', () => {
  assert.equal(canStepBack(MIN, MIN), false);
  assert.equal(canStepBack(MIN + HOUR_MS, MIN), true);
  assert.equal(canStepForward(MAX, MAX), false);
  assert.equal(canStepForward(MAX - HOUR_MS, MAX), true);
});

test('play avanza según la velocidad y avisa cuando llega al final', () => {
  assert.deepEqual(nextPlayTime(MIN, SPEEDS.hour, MAX), { t: MIN + HOUR_MS, done: false });
  assert.deepEqual(nextPlayTime(MIN, SPEEDS.day, MAX), { t: MIN + DAY_MS, done: false });
  // Último tramo: se queda en el final y se detiene.
  assert.deepEqual(nextPlayTime(MAX - HOUR_MS, SPEEDS.hour, MAX), { t: MAX, done: true });
  assert.deepEqual(nextPlayTime(MAX - HOUR_MS, SPEEDS.day, MAX), { t: MAX, done: true });
  assert.deepEqual(nextPlayTime(MAX, SPEEDS.hour, MAX), { t: MAX, done: true });
});

test('las dos velocidades son 1 hora y 1 día por segundo', () => {
  assert.equal(SPEEDS.hour, HOUR_MS);
  assert.equal(SPEEDS.day, 24 * HOUR_MS);
});

test('el deslizador cuenta horas desde el inicio y es reversible', () => {
  assert.equal(timeToSlider(MIN, MIN), 0);
  assert.equal(timeToSlider(MIN + 25 * HOUR_MS, MIN), 25);
  assert.equal(sliderToTime(25, MIN, MAX), MIN + 25 * HOUR_MS);
  assert.equal(sliderToTime(0, MIN, MAX), MIN);
  // Valores fuera de rango o como texto (así los entrega un <input type="range">).
  assert.equal(sliderToTime('7', MIN, MAX), MIN + 7 * HOUR_MS);
  assert.equal(sliderToTime(-5, MIN, MAX), MIN);
  assert.equal(sliderToTime(10 ** 9, MIN, MAX), MAX);
  assert.equal(timeToSlider(MAX, MIN), (MAX - MIN) / HOUR_MS);
});
