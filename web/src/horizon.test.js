// Pruebas de horizonAt (#32). Correr con: npm test (dentro de web/).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { horizonAt, statusAgainstHorizon, visibilityState } from './horizon.js';

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

test('con el horizon.json real de Apollo 11 (LOLA) hay 360 valores con relieve y el DEM declarado', () => {
  const real = JSON.parse(
    readFileSync(new URL('../../data/public/sites/apollo-11/horizon.json', import.meta.url), 'utf8'),
  );
  assert.equal(real.elevation_deg.length, 360);
  assert.ok(real.dem?.name);
  assert.ok(real.elevation_deg.some((v) => v !== 0));
  for (const az of [0, 47.3, 180, 359.9]) assert.ok(Math.abs(horizonAt(real, az)) < 10);
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

// ---- Estado con relieve (C5-08, #52): visible / asomando / tapado por el relieve / bajo el horizonte ----
// Cresta de 10° hacia el este (azimut 90°) y llano de 0° en el resto; el cuerpo mide 0,25° de radio.
const ridge = {
  azimuth_start_deg: 0,
  azimuth_step_deg: 1,
  elevation_deg: Array.from({ length: 360 }, (_, i) => (i >= 80 && i <= 100 ? 10 : 0)),
};
const at = (azimuth_deg, elevation_deg) => ({ azimuth_deg, elevation_deg });

test('estado: sobre el horizonte con relieve es visible (up) y el borde que asoma, partial', () => {
  assert.equal(visibilityState(at(90, 20), 0.25, ridge), 'up');
  assert.equal(visibilityState(at(90, 10.1), 0.25, ridge), 'partial'); // el borde superior pasa los 10°
});

test('estado: sobre 0° pero detrás de la cresta es tapado por el relieve (blocked)', () => {
  assert.equal(visibilityState(at(90, 5), 0.25, ridge), 'blocked');
  assert.equal(visibilityState(at(90, 0.5), 0.25, ridge), 'blocked');
});

test('estado: el mismo cuerpo, en un azimut sin cresta, no está tapado', () => {
  assert.equal(visibilityState(at(200, 5), 0.25, ridge), 'up');
});

test('estado: bajo 0° está bajo el horizonte (down), haya o no cresta', () => {
  assert.equal(visibilityState(at(90, -5), 0.25, ridge), 'down');
  assert.equal(visibilityState(at(200, -5), 0.25, ridge), 'down');
});

test('estado: el límite exacto sigue la regla del contrato (el borde superior debe pasar el horizonte)', () => {
  // elevation + radio == horizonte: no es visible. Con cresta de 10°: 9,75 + 0,25 = 10 -> tapado, no asoma.
  assert.equal(visibilityState(at(90, 9.75), 0.25, ridge), 'blocked');
  // Sin relieve ese caso no existe: en 0° el borde justo en el horizonte está bajo el horizonte.
  assert.equal(visibilityState(at(90, -0.25), 0.25, undefined), 'down');
});

test('estado: con un horizonte negativo (terreno bajo 0°) un cuerpo apenas bajo 0° sigue siendo visible', () => {
  const pit = { azimuth_start_deg: 0, azimuth_step_deg: 1, elevation_deg: Array(360).fill(-2) };
  assert.equal(visibilityState(at(10, -1), 0.25, pit), 'up');
  assert.equal(visibilityState(at(10, -3), 0.25, pit), 'down'); // bajo 0° y bajo el terreno: no es "tapado"
});

test('estado: sin horizonte o con Luna lisa nunca da tapado y coincide con statusAgainstHorizon', () => {
  const flat = { azimuth_start_deg: 0, azimuth_step_deg: 1, elevation_deg: Array(360).fill(0) };
  for (const el of [-10, -0.3, 0, 0.2, 0.3, 5]) {
    for (const hz of [undefined, flat]) {
      const state = visibilityState(at(77, el), 0.25, hz);
      assert.notEqual(state, 'blocked');
      assert.equal(state, statusAgainstHorizon(at(77, el), 0.25, hz));
    }
  }
});

test('estado: nunca contradice a statusAgainstHorizon salvo para separar down en blocked y down', () => {
  for (const az of [0, 85, 90, 120, 300]) {
    for (const el of [-5, -0.1, 0.1, 3, 9.9, 10.2, 12, 40]) {
      const finer = visibilityState(at(az, el), 0.25, ridge);
      const coarse = statusAgainstHorizon(at(az, el), 0.25, ridge);
      assert.equal(finer === 'blocked' ? 'down' : finer, coarse);
    }
  }
});
