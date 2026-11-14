// Pruebas de horizonAt (#32). Correr con: npm test (dentro de web/).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { horizonAt, statusAgainstHorizon } from './horizon.js';

// Perfil de prueba: la elevación del horizonte en el azimut i vale i/10 (0,0° en N ... 35,9° en 359°).
const ramp = {
  azimuth_start_deg: 0,
  azimuth_step_deg: 1,
  elevation_deg: Array.from({ length: 360 }, (_, i) => i / 10),
};

test('en un azimut de la grilla devuelve ese valor', () => {
  assert.equal(horizonAt(ramp, 0), 0);
  assert.equal(horizonAt(ramp, 90), 9);
  assert.equal(horizonAt(ramp, 359), 35.9);
});

test('entre dos muestras interpola linealmente (contrato)', () => {
  assert.ok(Math.abs(horizonAt(ramp, 90.5) - 9.05) < 1e-9);
  assert.ok(Math.abs(horizonAt(ramp, 10.25) - 1.025) < 1e-9);
});

test('cierra el círculo: entre 359° y 360° interpola hacia el valor de 0°', () => {
  // A mitad de camino entre 35,9° (azimut 359) y 0,0° (azimut 0 = 360).
  assert.ok(Math.abs(horizonAt(ramp, 359.5) - 17.95) < 1e-9);
});

test('acepta azimuts fuera de [0, 360) y los lleva al rango', () => {
  assert.equal(horizonAt(ramp, 360), 0);
  assert.equal(horizonAt(ramp, 450), 9);
  assert.equal(horizonAt(ramp, -270), 9);
});

test('respeta azimuth_start_deg y azimuth_step_deg distintos de 0 y 1', () => {
  // Paso de 90°: N=1, E=2, S=3, O=4, empezando en 0°.
  const coarse = { azimuth_start_deg: 0, azimuth_step_deg: 90, elevation_deg: [1, 2, 3, 4] };
  assert.equal(horizonAt(coarse, 45), 1.5);
  assert.equal(horizonAt(coarse, 315), 2.5); // entre O (4) y N (1)
  // Grilla corrida: la primera muestra está en 45°.
  const shifted = { azimuth_start_deg: 45, azimuth_step_deg: 90, elevation_deg: [1, 2, 3, 4] };
  assert.equal(horizonAt(shifted, 45), 1);
  assert.equal(horizonAt(shifted, 0), 2.5); // entre 315° (4) y 45° (1)
});

test('con el horizon.json real (Luna lisa) es 0° en cualquier dirección', () => {
  const real = JSON.parse(
    readFileSync(new URL('../../data/public/sites/apollo-11/horizon.json', import.meta.url), 'utf8'),
  );
  for (const az of [0, 47.3, 180, 359.9]) assert.equal(horizonAt(real, az), 0);
});

test('un azimut que no es un número da un error claro (no NaN silencioso)', () => {
  assert.throws(() => horizonAt(ramp, NaN), /azimut inválido/);
  assert.throws(() => horizonAt(ramp, undefined), /azimut inválido/);
  assert.throws(() => horizonAt(ramp, Infinity), /azimut inválido/);
});

test('estado del panel contra el horizonte real en la dirección del cuerpo (parte 2 de #32)', () => {
  // Sol (radio 0,25°) a 5° de altura mirando al azimut 100°, donde la rampa tiene horizonte de 10°: tapado.
  assert.equal(statusAgainstHorizon({ azimuth_deg: 100, elevation_deg: 5 }, 0.25, ramp), 'down');
  // Mismo Sol mirando al azimut 20° (horizonte de 2°): se ve entero.
  assert.equal(statusAgainstHorizon({ azimuth_deg: 20, elevation_deg: 5 }, 0.25, ramp), 'up');
  // Tierra (radio 1°) a 10,5° hacia el azimut 100° (horizonte 10°): asoma solo una parte.
  assert.equal(statusAgainstHorizon({ azimuth_deg: 100, elevation_deg: 10.5 }, 1, ramp), 'partial');
});

test('sin horizonte (o con la Luna lisa) da lo mismo que comparar contra 0°', () => {
  const flat = JSON.parse(
    readFileSync(new URL('../../data/public/sites/apollo-11/horizon.json', import.meta.url), 'utf8'),
  );
  for (const [el, r, expected] of [[1, 0.25, 'up'], [-0.03, 1, 'partial'], [-2, 1, 'down']]) {
    assert.equal(statusAgainstHorizon({ azimuth_deg: 123, elevation_deg: el }, r, flat), expected);
    assert.equal(statusAgainstHorizon({ azimuth_deg: 123, elevation_deg: el }, r, undefined), expected);
  }
});
