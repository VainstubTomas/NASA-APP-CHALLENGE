import test from 'node:test';
import assert from 'node:assert/strict';
import { horizonAt } from './horizon.js';

const horizon = {
  azimuth_start_deg: 0,
  azimuth_step_deg: 1,
  elevation_deg: [0, 10, 20, 30],
};

test('horizonAt interpola entre muestras', () => {
  assert.equal(horizonAt(horizon, 1.5), 15);
});

test('horizonAt cierra el círculo entre 359 y 0', () => {
  assert.equal(horizonAt({ ...horizon, elevation_deg: [10, 20, 30, 40] }, 3.5), 25);
  assert.equal(horizonAt({ ...horizon, elevation_deg: [10, 20, 30, 40] }, -0.5), 25);
});
