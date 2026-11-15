import { test } from 'node:test';
import assert from 'node:assert/strict';
import { azDelta, tweenPose, needsMaskBake } from './sky-core.js';

test('azDelta toma el camino corto cruzando el norte', () => {
  assert.equal(azDelta(350, 10), 20);
  assert.equal(azDelta(10, 350), -20);
  assert.equal(azDelta(90, 270), -180);
});

test('tweenPose arranca en from, termina en to y no da la vuelta al cruzar el norte', () => {
  const from = { azimuth_deg: 355, elevation_deg: 5 };
  const to = { azimuth_deg: 5, elevation_deg: 15 };
  const a = tweenPose(from, to, 0);
  const b = tweenPose(from, to, 1);
  assert.equal(a.azimuth_deg, 355);
  assert.equal(a.elevation_deg, 5);
  assert.ok(Math.abs(b.azimuth_deg - 5) < 1e-9);
  assert.ok(Math.abs(b.elevation_deg - 15) < 1e-9);
  const mid = tweenPose(from, to, 0.5).azimuth_deg;
  assert.ok(mid > 355 || mid < 5, `punto medio fuera del arco corto: ${mid}`);
});

test('tweenPose sujeta t fuera de [0, 1]', () => {
  const p = tweenPose({ azimuth_deg: 0, elevation_deg: 0 }, { azimuth_deg: 40, elevation_deg: 10 }, 3);
  assert.equal(p.azimuth_deg, 40);
  assert.equal(p.elevation_deg, 10);
});

test('needsMaskBake: sin previo o con cambio mayor que eps, sí; igual, no', () => {
  assert.equal(needsMaskBake(null, [0, 0, 1]), true);
  assert.equal(needsMaskBake([0, 0, 1], [0, 0, 1]), false);
  assert.equal(needsMaskBake([0, 0, 1], [0.01, 0, 1]), true);
  assert.equal(needsMaskBake([0, 0, 1], [0.00001, 0, 1]), false);
});
