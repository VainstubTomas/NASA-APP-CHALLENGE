import test from 'node:test';
import assert from 'node:assert/strict';
import { groundHeightField, shadeField, buildMips, groundPanorama } from './ground-texture.js';

const N = 128;

test('groundHeightField: determinista, finito y distinto con otra semilla', () => {
  const a = groundHeightField(N, 5);
  assert.deepEqual(groundHeightField(N, 5), a);
  assert.ok(a.every(Number.isFinite));
  assert.notDeepEqual(groundHeightField(N, 6), a);
});

test('groundHeightField: se repite sin cortes en x e y', () => {
  const f = groundHeightField(N, 5);
  let seamX = 0;
  let seamY = 0;
  let inner = 0;
  for (let i = 0; i < N; i += 1) {
    seamX += Math.abs(f[i * N] - f[i * N + N - 1]);
    seamY += Math.abs(f[i] - f[(N - 1) * N + i]);
    for (let j = 1; j < N; j += 1) inner += Math.abs(f[i * N + j] - f[i * N + j - 1]) / (N - 1);
  }
  const typical = inner / N;
  assert.ok(seamX / N < typical * 3 + 1e-9, `costura x ${seamX / N} vs ${typical}`);
  assert.ok(seamY / N < typical * 3 + 1e-9, `costura y ${seamY / N} vs ${typical}`);
});

test('shadeField y buildMips: hay luces y sombras; la pirámide baja hasta 1 × 1 y conserva el brillo medio', () => {
  const base = shadeField(groundHeightField(N, 5), N, 5);
  assert.ok(Math.max(...base) - Math.min(...base) > 40);
  const mips = buildMips(base, N);
  assert.equal(mips.length, Math.log2(N) + 1);
  assert.equal(mips.at(-1).n, 1);
  const mean = base.reduce((s, v) => s + v, 0) / base.length;
  assert.ok(Math.abs(mips.at(-1).data[0] - mean) < 4);
});

test('groundPanorama: RGBA opaco, sin corte en la costura de 360° y más detalle cerca que lejos', () => {
  const w = 256;
  const h = 64;
  const { px } = groundPanorama({ w, h, n: N, seed: 5 });
  assert.equal(px.length, w * h * 4);
  assert.ok(px.every((v, i) => i % 4 !== 3 || v === 255));
  let seam = 0;
  let inner = 0;
  for (let r = h / 2; r < h; r += 1) {
    seam += Math.abs(px[r * w * 4] - px[(r * w + w - 1) * 4]);
    for (let c = 1; c < w; c += 1) inner += Math.abs(px[(r * w + c) * 4] - px[(r * w + c - 1) * 4]) / (w - 1);
  }
  assert.ok(seam < inner * 4 + 10 * (h / 2), `costura ${seam} vs vecinas ${inner}`);
  const detail = (r0, r1) => {
    let s = 0;
    for (let r = r0; r < r1; r += 1) for (let c = 1; c < w; c += 1) s += Math.abs(px[(r * w + c) * 4] - px[(r * w + c - 1) * 4]);
    return s;
  };
  assert.ok(detail(h - 16, h) > detail(0, 16), 'cerca más detalle que lejos');
});
