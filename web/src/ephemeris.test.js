// Pruebas de la lógica del panel (C1-03). Correr con: npm test (dentro de web/).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { sampleAt, isAboveHorizon, horizonStatus, compassLabel } from './ephemeris.js';

const demo = JSON.parse(
  readFileSync(new URL('../../data/public/sites/demo-sintetico/ephemeris.json', import.meta.url), 'utf8'),
);

test('el primer instante devuelve la muestra 0 (caso conocido del sitio de prueba)', () => {
  const s = sampleAt(demo, Date.parse('2026-11-01T00:00:00Z'));
  assert.equal(s.index, 0);
  assert.deepEqual(s.sun, { azimuth_deg: 20.0, elevation_deg: 0.5 });
  assert.deepEqual(s.earth, { azimuth_deg: 100.0, elevation_deg: 5.024 });
});

test('un día después (step de 1 h) devuelve la muestra 24', () => {
  const s = sampleAt(demo, Date.parse('2026-11-02T00:00:00Z'));
  assert.equal(s.index, 24);
  assert.equal(s.sun.azimuth_deg, 32.191);
  assert.equal(s.sun.elevation_deg, 0.69);
});

test('un instante entre muestras usa la más cercana', () => {
  assert.equal(sampleAt(demo, Date.parse('2026-11-01T00:29:00Z')).index, 0);
  assert.equal(sampleAt(demo, Date.parse('2026-11-01T00:31:00Z')).index, 1);
});

test('fuera del rango de datos devuelve null', () => {
  assert.equal(sampleAt(demo, Date.parse('2026-10-31T00:00:00Z')), null);
  // 2880 muestras de 1 h = 120 días: el último dato es 2027-02-28T23:00Z.
  assert.notEqual(sampleAt(demo, Date.parse('2027-02-28T23:00:00Z')), null);
  assert.equal(sampleAt(demo, Date.parse('2027-03-02T00:00:00Z')), null);
});

test('regla de visibilidad del contrato: elevación + radio > horizonte', () => {
  // Sol (radio 0,25°) con el centro apenas bajo el horizonte: el borde superior asoma.
  assert.equal(isAboveHorizon(-0.2, 0.25), true);
  // Sol con el borde superior justo en el horizonte: no se ve (la regla es ">").
  assert.equal(isAboveHorizon(-0.25, 0.25), false);
  assert.equal(isAboveHorizon(-1.5, 1.0), false);
  // Horizonte ideal por defecto = 0° (Luna lisa, ADR-011); con relieve se pasa el valor.
  assert.equal(isAboveHorizon(2.0, 0.25, 3.0), false);
});

test('estado para el panel: sobre, asomando o bajo el horizonte', () => {
  // Totalmente visible (contrato): elevación - radio > horizonte.
  assert.equal(horizonStatus(1.0, 0.25), 'up');
  // Tierra (radio 1°) con el centro apenas bajo 0°: solo asoma parte del disco.
  assert.equal(horizonStatus(-0.03, 1.0), 'partial');
  assert.equal(horizonStatus(0.5, 1.0), 'partial');
  assert.equal(horizonStatus(-1.0, 1.0), 'down');
});

test('azimut a punto cardinal: 0° = norte, sentido horario', () => {
  assert.equal(compassLabel(0), 'N');
  assert.equal(compassLabel(90), 'E');
  assert.equal(compassLabel(180), 'S');
  assert.equal(compassLabel(270), 'O');
  assert.equal(compassLabel(45), 'NE');
  assert.equal(compassLabel(359), 'N');
  assert.equal(compassLabel(100), 'E'); // más cerca de 90° (E) que de 135° (SE)
  assert.equal(compassLabel(120), 'SE');
});
