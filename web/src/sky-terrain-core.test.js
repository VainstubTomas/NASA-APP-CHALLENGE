// Pruebas del suelo ilustrativo de la vista del cielo (#99). Correr con: npm test (dentro de web/).
// El suelo es decorativo: lo que importa probar es que nunca contradiga a los datos
// (ningún punto puede asomar por encima del horizonte de 0°, ADR-011).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  MOON_RADIUS_M, EYE_M, MAX_HEIGHT_M, curvatureDrop, horizonDistance,
  makeCraters, createTerrain, groundCamera, elevationOfPoint,
} from './sky-terrain-core.js';

const close = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg ?? ''} ${a} ≠ ${b}`);

test('radio lunar medio y altura de los ojos', () => {
  assert.equal(MOON_RADIUS_M, 1737400);
  assert.equal(EYE_M, 1.7);
});

test('curvatura: el horizonte de un astronauta está a unos 2,4 km', () => {
  close(horizonDistance(EYE_M), 2430.4, 0.5);
  // A esa distancia el suelo ya bajó lo mismo que la altura de los ojos.
  close(curvatureDrop(horizonDistance(EYE_M)), EYE_M, 1e-9);
  assert.equal(curvatureDrop(0), 0);
});

test('makeCraters: siempre los mismos para la misma semilla, ninguno bajo los pies', () => {
  const a = makeCraters(11);
  assert.deepEqual(makeCraters(11), a);
  assert.notDeepEqual(makeCraters(12), a);
  assert.ok(a.length > 300, `cantidad ${a.length}`);
  for (const c of a) {
    assert.ok(c.d >= 1 && c.d <= 300, `diámetro ${c.d}`);
    assert.ok(Math.hypot(c.x, c.z) > c.d / 2 + 3, 'cráter debajo del observador');
  }
  // Muchos chicos y pocos grandes, como en la superficie real.
  const small = a.filter((c) => c.d < 10).length;
  const big = a.filter((c) => c.d > 60).length;
  assert.ok(small > big * 5, `chicos ${small}, grandes ${big}`);
});

test('el terreno es determinista y el observador está parado en suelo casi plano', () => {
  const t1 = createTerrain(11);
  const t2 = createTerrain(11);
  for (const [x, z] of [[0, 0], [5, -3], [120, 40], [-900, 1500]]) {
    assert.equal(t1.height(x, z), t2.height(x, z));
    assert.ok(Number.isFinite(t1.height(x, z)));
  }
  for (let a = 0; a < 360; a += 30) {
    const r = 2;
    const h = t1.height(r * Math.cos(a), r * Math.sin(a));
    assert.ok(Math.abs(h) < 0.35, `a 2 m del observador: ${h}`);
  }
});

test('ningún punto del terreno asoma sobre el horizonte de 0° (no contradice los datos)', () => {
  const terrain = createTerrain(11);
  let maxEl = -Infinity;
  for (let i = 0; i < 20000; i += 1) {
    // Barrido en espiral desde 3 m hasta 4 km
    const d = 3 * (4000 / 3) ** (i / 20000);
    const ang = i * 2.399963; // ángulo áureo: cubre todas las direcciones
    const x = d * Math.sin(ang);
    const z = d * Math.cos(ang);
    const h = terrain.height(x, z);
    assert.ok(h <= MAX_HEIGHT_M + 1e-9, `altura ${h} en (${x}, ${z})`);
    maxEl = Math.max(maxEl, elevationOfPoint(d, h));
  }
  assert.ok(MAX_HEIGHT_M < EYE_M);
  assert.ok(maxEl < 0, `elevación máxima ${maxEl}°`);
});

test('groundCamera: la escala cerca del horizonte coincide con la del cielo (px por grado)', () => {
  const cam = groundCamera({ width: 1440, groundHeight: 180, pxPerDeg: 24 });
  close(cam.focalPx, (24 * 180) / Math.PI, 1e-9);
  // Media vista vertical: el borde de abajo del suelo está a ~7,5° bajo el horizonte.
  close(cam.vFovDeg / 2, (Math.atan(180 / cam.focalPx) * 180) / Math.PI, 1e-9);
  close(cam.vFovDeg / 2, 7.5, 0.1);
  assert.equal(cam.fullHeight, 360);
  assert.equal(cam.offsetY, 180);
  close(cam.aspect, 1440 / 360, 1e-12);
});
