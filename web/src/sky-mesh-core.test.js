// Pruebas de la malla adaptativa del suelo. Correr con: npm test (dentro de web/).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FINE_N, pickRingCount, stitchRings, ringToleranceM } from './sky-mesh-core.js';

test('ringToleranceM crece con la distancia y tiene límites', () => {
  assert.equal(ringToleranceM(0.6), 0.02);
  assert.ok(Math.abs(ringToleranceM(100) - 0.3) < 1e-9);
  assert.equal(ringToleranceM(4200), 1);
});

test('pickRingCount elige la malla más gruesa en un anillo plano', () => {
  const flat = new Float32Array(FINE_N).fill(-1.2);
  assert.equal(pickRingCount(flat), 135);
});

test('pickRingCount exige la malla fina si la altura cambia en cada muestra', () => {
  // Pseudo-aleatorio determinista: sin patrón que se alinee con los pasos de la malla gruesa
  const noisy = new Float32Array(FINE_N).map((_, k) => (Math.imul(k, 2654435761) >>> 0) / 4294967296 - 0.5);
  assert.equal(pickRingCount(noisy), FINE_N);
});

test('pickRingCount respeta la tolerancia', () => {
  // Una onda suave: error de interpolar ~ amplitud * (dθ)² / 8. Con tolerancia grande alcanza 135;
  // con una tolerancia de 0,1 mm ya no alcanza y sube de malla.
  const wave = new Float32Array(FINE_N).map((_, k) => 0.2 * Math.sin((2 * Math.PI * k * 3) / FINE_N));
  assert.equal(pickRingCount(wave, FINE_N, 0.5), 135);
  assert.ok(pickRingCount(wave, FINE_N, 0.0001) > 135);
});

test('stitchRings: anillos iguales dan dos triángulos por cuadro, sin vértices repetidos en un triángulo', () => {
  const a = { base: 0, n: 4, step: 270 };
  const b = { base: 4, n: 4, step: 270 };
  const tris = stitchRings(a, b, []);
  assert.equal(tris.length / 3, 8);
  for (let t = 0; t < tris.length; t += 3) {
    assert.notEqual(tris[t], tris[t + 1]);
    assert.notEqual(tris[t + 1], tris[t + 2]);
    assert.notEqual(tris[t], tris[t + 2]);
  }
});

test('stitchRings: anillos de distinta cantidad usan todos los vértices de ambos y cierran el anillo', () => {
  const a = { base: 0, n: 135, step: 8 };   // interior, menos vértices
  const b = { base: 135, n: 540, step: 2 }; // exterior, más vértices
  const tris = stitchRings(a, b, []);
  assert.equal(tris.length / 3, 135 + 540);
  const used = new Set(tris);
  for (let v = 0; v < 135 + 540; v += 1) assert.ok(used.has(v), `vértice ${v} sin usar`);
  for (let t = 0; t < tris.length; t += 3) {
    assert.notEqual(tris[t], tris[t + 1]);
    assert.notEqual(tris[t + 1], tris[t + 2]);
    assert.notEqual(tris[t], tris[t + 2]);
  }
});
