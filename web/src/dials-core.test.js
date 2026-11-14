// Pruebas de la geometría de la brújula y la regla de elevación. Correr con: npm test (dentro de web/).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { compassPoint, rulerY, RULER, COMPASS } from './dials-core.js';

const near = (actual, expected, msg) => assert.ok(Math.abs(actual - expected) < 1e-9, `${msg}: ${actual} != ${expected}`);

test('brújula: norte arriba, este a la derecha, sur abajo, oeste a la izquierda', () => {
  const { cx, cy } = COMPASS;
  const [nx, ny] = compassPoint(0, 50);
  near(nx, cx, 'N x'); near(ny, cy - 50, 'N y');
  const [ex, ey] = compassPoint(90, 50);
  near(ex, cx + 50, 'E x'); near(ey, cy, 'E y');
  const [sx, sy] = compassPoint(180, 50);
  near(sx, cx, 'S x'); near(sy, cy + 50, 'S y');
  const [wx, wy] = compassPoint(270, 50);
  near(wx, cx - 50, 'O x'); near(wy, cy, 'O y');
});

test('brújula: 360° es lo mismo que 0° y el sentido es horario (45° = noreste)', () => {
  const [x0, y0] = compassPoint(0, 40);
  const [x1, y1] = compassPoint(360, 40);
  near(x1, x0, 'x'); near(y1, y0, 'y');
  const [x, y] = compassPoint(45, 40);
  assert.ok(x > COMPASS.cx && y < COMPASS.cy);
});

test('regla: 0° está en la línea del horizonte y 90° en el cenit (arriba)', () => {
  assert.equal(rulerY(0), RULER.y0);
  assert.equal(rulerY(90), RULER.yTop);
  assert.ok(rulerY(45) < rulerY(10), 'más alto en el cielo = y más chica');
});

test('regla: bajo el horizonte queda debajo de la línea y no se sale del dibujo', () => {
  assert.ok(rulerY(-10) > RULER.y0);
  assert.equal(rulerY(-500), rulerY(-RULER.belowDeg));
  assert.ok(rulerY(-500) <= RULER.height);
  assert.equal(rulerY(500), RULER.yTop);
});

import { directionFromAzEl } from './dials-core.js';

test('3D: norte = -z, este = +x, cenit = +y (azimut 0° al norte, horario)', () => {
  const close = (v, [x, y, z]) => ['x', 'y', 'z'].forEach((k, i) => near(v[k], [x, y, z][i], k));
  close(directionFromAzEl(0, 0), [0, 0, -1]);
  close(directionFromAzEl(90, 0), [1, 0, 0]);
  close(directionFromAzEl(180, 0), [0, 0, 1]);
  close(directionFromAzEl(270, 0), [-1, 0, 0]);
  close(directionFromAzEl(123, 90), [0, 1, 0]);
  close(directionFromAzEl(0, -90), [0, -1, 0]);
});
