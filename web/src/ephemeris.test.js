// Pruebas de la lógica del panel (C1-03). Correr con: npm test (dentro de web/).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { sampleAt, isAboveHorizon, horizonStatus, compassLabel, elevationDisplay, nextVisibilityChange } from './ephemeris.js';

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

test('altura para mostrar: sin signo menos y con "sobre" o "bajo" el horizonte', () => {
  // Antes se veía "−42,6° de altura sobre el horizonte": el texto contradecía al número.
  assert.deepEqual(elevationDisplay(8.4), { value: 8.4, side: 'above' });
  assert.deepEqual(elevationDisplay(-42.6), { value: 42.6, side: 'below' });
  assert.deepEqual(elevationDisplay(0), { value: 0, side: 'above' });
  // Redondeado a 1 decimal da 0,0: no mostrar "0,0° bajo el horizonte".
  assert.deepEqual(elevationDisplay(-0.03), { value: 0, side: 'above' });
  assert.deepEqual(elevationDisplay(-0.06), { value: 0.1, side: 'below' });
});

test('azimut a punto cardinal: 0° = norte, sentido horario', () => {
  // Devuelve la clave neutra (en inglés); cada idioma la traduce con compass.<clave> (#58).
  assert.equal(compassLabel(0), 'N');
  assert.equal(compassLabel(90), 'E');
  assert.equal(compassLabel(180), 'S');
  assert.equal(compassLabel(270), 'W');
  assert.equal(compassLabel(225), 'SW');
  assert.equal(compassLabel(315), 'NW');
  assert.equal(compassLabel(45), 'NE');
  assert.equal(compassLabel(359), 'N');
  assert.equal(compassLabel(100), 'E'); // más cerca de 90° (E) que de 135° (SE)
  assert.equal(compassLabel(120), 'SE');
});

// Efeméride mínima hecha a mano: 1 muestra por hora desde 2026-11-01T00:00Z.
// Sol (radio 0,25°): visible en las muestras 0..3, bajo el horizonte de la 4 en adelante.
const mini = {
  time: { start_utc: '2026-11-01T00:00:00Z', step_s: 3600, count: 8 },
  angular_radius_deg: { sun: 0.25, earth: 1.0 },
  sun: { azimuth_deg: Array(8).fill(10), elevation_deg: [2, 1, 0.5, 0.1, -0.25, -1, -2, 0.3] },
  earth: { azimuth_deg: Array(8).fill(90), elevation_deg: [-5, -4, -3, -2, -1, 0, 3, 3] },
};
const T0 = Date.parse('2026-11-01T00:00:00Z');
const H = 3600 * 1000;

test('cuenta regresiva: el Sol visible se oculta en la primera muestra no visible', () => {
  const r = nextVisibilityChange(mini, T0, 'sun');
  assert.deepEqual({ ...r, crossMs: undefined }, { visible: true, event: 'sets', atMs: T0 + 4 * H, inHours: 4, crossMs: undefined });
});

test('cuenta regresiva: se mide desde el instante pedido, no desde el inicio', () => {
  const r = nextVisibilityChange(mini, T0 + 2 * H, 'sun');
  assert.equal(r.inHours, 2);
});

test('cuenta regresiva: con el cuerpo oculto avisa cuándo sale', () => {
  // Tierra (radio 1°): elevación 0 en la muestra 5 -> 0 + 1 > 0, ya asoma.
  const r = nextVisibilityChange(mini, T0, 'earth');
  assert.deepEqual({ ...r, crossMs: undefined }, { visible: false, event: 'rises', atMs: T0 + 5 * H, inHours: 5, crossMs: undefined });
});

test('cuenta regresiva: sin cambio dentro de los datos devuelve event null', () => {
  const r = nextVisibilityChange(mini, T0 + 5 * H, 'earth');
  assert.deepEqual(r, { visible: true, event: null, atMs: null, inHours: null, crossMs: null });
});

test('cuenta regresiva: respeta el horizonte pasado por parámetro', () => {
  // Con horizonte a 1°, el Sol (centro 1° + 0,25 > 1 en muestra 1) se oculta en la muestra 2.
  assert.equal(nextVisibilityChange(mini, T0, 'sun', 1).inHours, 2);
});

test('cuenta regresiva: fuera del rango de datos devuelve null', () => {
  assert.equal(nextVisibilityChange(mini, T0 - 10 * H, 'sun'), null);
});

test('cuenta regresiva: crossMs interpola el cruce entre muestras horarias', () => {
  // Horizonte 0,5°. Margen del Sol = elevación + 0,25 - 0,5: muestra 2 = 0,25; muestra 3 = -0,15.
  // Cruza a 0,25 / 0,40 = 0,625 de la hora entre ambas muestras.
  const r = nextVisibilityChange(mini, T0, 'sun', 0.5);
  assert.equal(r.atMs, T0 + 3 * H);
  assert.ok(Math.abs(r.crossMs - (T0 + 2.625 * H)) < 1);
});

test('cuenta regresiva: sin evento no hay crossMs', () => {
  assert.equal(nextVisibilityChange(mini, T0 + 5 * H, 'earth').crossMs, null);
});
