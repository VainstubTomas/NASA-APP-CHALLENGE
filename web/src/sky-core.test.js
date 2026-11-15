// Pruebas de la vista del cielo (rediseño #99). Correr con: npm test (dentro de web/).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  FOV_DEG, ROTATE_STEP_DEG, TILT_STEP_DEG, TILT_MAX_DEG,
  normAz, relAz, rotate, tiltUp, tiltDown, clampTilt, pxPerDeg, project, discRadiusPx,
  compassTicks, shortDuration, chartRange, initialHeading, applyPlan,
} from './sky-core.js';

test('normAz lleva cualquier ángulo a [0, 360)', () => {
  assert.equal(normAz(0), 0);
  assert.equal(normAz(360), 0);
  assert.equal(normAz(-90), 270);
  assert.equal(normAz(725), 5);
});

test('relAz: diferencia con el rumbo, en (-180, 180]', () => {
  assert.equal(relAz(10, 350), 20); // cruza el norte
  assert.equal(relAz(350, 10), -20);
  assert.equal(relAz(180, 0), 180);
  assert.ok(Math.abs(relAz(91.464, 90) - 1.464) < 1e-9);
});

test('rotate gira el rumbo y lo normaliza (las flechas giran 45°: de un rumbo al siguiente)', () => {
  assert.equal(ROTATE_STEP_DEG, 45);
  assert.equal(rotate(0, -45), 315);
  assert.equal(rotate(315, 45), 0);
  assert.equal(rotate(90, 45), 135);
});

test('la flecha de arriba sube la mirada de a 10° hasta 30°, la de abajo vuelve', () => {
  assert.equal(TILT_STEP_DEG, 10);
  assert.equal(TILT_MAX_DEG, 30);
  assert.equal(tiltUp(0), 10);
  assert.equal(tiltUp(30), 30);
  assert.equal(tiltUp(25), 30);
  assert.equal(tiltDown(10), 0);
  assert.equal(tiltDown(0), 0);
});

test('clampTilt: al arrastrar, la mirada queda entre el horizonte y 30°', () => {
  assert.equal(clampTilt(-4), 0);
  assert.equal(clampTilt(12.5), 12.5);
  assert.equal(clampTilt(80), 30);
});

test('escala: el campo de visión horizontal (60°) ocupa todo el ancho', () => {
  assert.equal(FOV_DEG, 60);
  assert.equal(pxPerDeg(1440), 24);
});

test('project: un cuerpo en el rumbo queda centrado; la elevación sube desde el horizonte', () => {
  const view = { heading: 90, tilt: 0, width: 1440, horizonY: 700 };
  // Fila de ejemplo IM-2 2026-11-14T12:00Z: Sol az 91,464° el 1,430°.
  const p = project({ azimuth_deg: 91.464, elevation_deg: 1.43 }, view);
  assert.ok(Math.abs(p.x - (720 + 1.464 * 24)) < 1e-9);
  assert.ok(Math.abs(p.y - (700 - 1.43 * 24)) < 1e-9);
  assert.equal(p.onScreen, true);
  // Tierra az 328,959°: 121° a la izquierda, fuera de la vista.
  const e = project({ azimuth_deg: 328.959, elevation_deg: 0.34 }, view);
  assert.equal(e.onScreen, false);
  assert.ok(e.rel < 0);
});

test('project: mirar hacia arriba baja el horizonte en pantalla', () => {
  const view = { heading: 0, tilt: 20, width: 1440, horizonY: 700 };
  const p = project({ azimuth_deg: 0, elevation_deg: 0 }, view);
  assert.equal(p.y, 700 + 20 * 24);
});

test('discRadiusPx: radio angular real, con un mínimo para que se vea', () => {
  assert.equal(discRadiusPx(1, 24), 24); // Tierra: 1° de radio
  assert.equal(discRadiusPx(0.25, 24), 6); // Sol: 0,25°
  assert.equal(discRadiusPx(0.25, 10), 4); // pantalla chica: mínimo 4 px
});

test('compassTicks: marcas cada 5° dentro de la vista, con los 8 rumbos marcados', () => {
  const ticks = compassTicks(0, 40);
  assert.deepEqual(ticks.map((t) => t.az), [340, 345, 350, 355, 0, 5, 10, 15, 20]);
  assert.deepEqual(ticks.map((t) => t.rel), [-20, -15, -10, -5, 0, 5, 10, 15, 20]);
  assert.equal(ticks.find((t) => t.az === 0).point, 'N');
  assert.equal(ticks.find((t) => t.az === 10).point, null);
  const east = compassTicks(45, 40).find((t) => t.az === 45);
  assert.equal(east.point, 'NE');
});

test('shortDuration: días, horas y minutos para la cuenta regresiva', () => {
  const H = 3600000;
  assert.equal(shortDuration(397 * H), '16 d 13 h 00 m');
  assert.equal(shortDuration(5 * H + 7 * 60000), '5 h 07 m');
  assert.equal(shortDuration(42 * 60000), '42 m');
  assert.equal(shortDuration(-5), '0 m');
});

test('chartRange: de −5° a 15° en los polos; crece si un cuerpo está más alto', () => {
  assert.deepEqual(chartRange([1.43, 0.34]), { min: -5, max: 15 });
  assert.deepEqual(chartRange([42.1, -10]), { min: -5, max: 50 });
  assert.deepEqual(chartRange([89, 3]), { min: -5, max: 90 });
});

test('initialHeading: mira al Sol si está arriba; si no, a la Tierra; si no, al norte', () => {
  const sun = { azimuth_deg: 91.464, elevation_deg: 1.43 };
  const earth = { azimuth_deg: 328.959, elevation_deg: 0.34 };
  assert.equal(initialHeading(sun, earth, 0.25, 1), 91.464);
  assert.equal(initialHeading({ ...sun, elevation_deg: -3 }, earth, 0.25, 1), 328.959);
  assert.equal(initialHeading({ ...sun, elevation_deg: -3 }, { ...earth, elevation_deg: -2 }, 0.25, 1), 0);
});

test('applyPlan: histórico cambia sitio y fecha solo si cambiaron, en ese orden', () => {
  const current = { site: 'apollo-11', time: '2026-11-14T12:00' };
  assert.deepEqual(applyPlan({ mode: 'historical', current, chosen: { site: 'slim', time: '2026-11-20T00:00' } }), [
    { type: 'site', value: 'slim' },
    { type: 'time', value: '2026-11-20T00:00' },
  ]);
  assert.deepEqual(applyPlan({ mode: 'historical', current, chosen: { ...current } }), []);
  assert.deepEqual(applyPlan({ mode: 'historical', current, chosen: { site: 'apollo-11', time: '' } }), []);
});

test('applyPlan: ubicación específica fija la fecha y después consulta la API', () => {
  const current = { site: 'apollo-11', time: '2026-11-14T12:00' };
  assert.deepEqual(applyPlan({ mode: 'location', current, chosen: { site: 'slim', time: '2026-11-15T00:00' } }), [
    { type: 'time', value: '2026-11-15T00:00' },
    { type: 'live' },
  ]);
  assert.deepEqual(applyPlan({ mode: 'location', current, chosen: { ...current } }), [{ type: 'live' }]);
  assert.deepEqual(applyPlan({ mode: 'map', current, chosen: { ...current } }), []);
  assert.deepEqual(applyPlan({ mode: null, current, chosen: { ...current } }), []);
});
