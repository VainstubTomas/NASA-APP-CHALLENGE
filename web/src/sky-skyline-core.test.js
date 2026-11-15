// Pruebas de la silueta del relieve en la vista del cielo (C5-08, #52). Correr con: npm test (dentro de web/).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { skylinePoints, chartProfile, skylineLight, skylineEdge, lightColor } from './sky-skyline-core.js';

// Cresta de 10° entre 80° y 100° de azimut; llano de 0° en el resto.
const ridge = {
  azimuth_start_deg: 0,
  azimuth_step_deg: 1,
  elevation_deg: Array.from({ length: 360 }, (_, i) => (i >= 80 && i <= 100 ? 10 : 0)),
};
const flat = { azimuth_start_deg: 0, azimuth_step_deg: 1, elevation_deg: Array(360).fill(0) };
const view = { heading: 90, width: 600, k: 10, hy: 400, stepPx: 10 }; // 10 px por grado: la vista abarca 60°

test('silueta: cubre todo el ancho de la pantalla de izquierda a derecha', () => {
  const pts = skylinePoints(ridge, view);
  assert.equal(pts[0].x, 0);
  assert.equal(pts[pts.length - 1].x, 600);
  for (let i = 1; i < pts.length; i += 1) assert.ok(pts[i].x > pts[i - 1].x);
});

test('silueta: el centro de la pantalla es el rumbo y la altura sale de horizonAt', () => {
  const pts = skylinePoints(ridge, view);
  const center = pts.find((p) => p.x === 300);
  assert.equal(center.y, 400 - 10 * 10); // 10° sobre el horizonte a 10 px por grado
  const left = pts.find((p) => p.x === 0); // azimut 90 - 30 = 60°, llano
  assert.equal(left.y, 400);
});

test('silueta: cruza el norte sin saltos (rumbo 0°)', () => {
  const north = { azimuth_start_deg: 0, azimuth_step_deg: 1, elevation_deg: Array.from({ length: 360 }, (_, i) => (i >= 355 || i <= 5 ? 4 : 0)) };
  const pts = skylinePoints(north, { ...view, heading: 0 });
  assert.equal(pts.find((p) => p.x === 300).y, 400 - 4 * 10);
  assert.equal(pts.find((p) => p.x === 100).y, 400); // 20° al oeste = azimut 340°: llano
  assert.equal(pts.find((p) => p.x === 350).y, 400 - 4 * 10); // 5° al este = azimut 5°: dentro de la cresta
});

test('silueta: el terreno bajo 0° no se dibuja por debajo del horizonte plano', () => {
  const pit = { azimuth_start_deg: 0, azimuth_step_deg: 1, elevation_deg: Array(360).fill(-2) };
  for (const p of skylinePoints(pit, view)) assert.equal(p.y, 400);
});

test('silueta: el relieve plano de 0° da una línea recta en el horizonte', () => {
  for (const p of skylinePoints(flat, view)) assert.equal(p.y, 400);
});

test('silueta: sube con la inclinación de la mirada (hy más bajo en pantalla = más abajo la línea)', () => {
  const a = skylinePoints(ridge, view).find((p) => p.x === 300).y;
  const b = skylinePoints(ridge, { ...view, hy: 450 }).find((p) => p.x === 300).y;
  assert.equal(b - a, 50);
});

test('silueta: cuanto más zoom (más px por grado), más alta se ve la misma montaña', () => {
  const near = skylinePoints(ridge, { ...view, k: 20 }).find((p) => p.x === 300).y;
  assert.equal(near, 400 - 10 * 20);
});

test('perfil del gráfico: 361 puntos, de 0° a 360°, con la altura del horizonte en cada azimut', () => {
  const prof = chartProfile(ridge);
  assert.equal(prof.length, 361);
  assert.deepEqual(prof[0], { az: 0, elevation: 0 });
  assert.deepEqual(prof[90], { az: 90, elevation: 10 });
  assert.equal(prof[360].elevation, prof[0].elevation); // cierra el círculo
});

test('perfil del gráfico: sin horizonte es una línea en 0°', () => {
  assert.ok(chartProfile(undefined).every((p) => p.elevation === 0));
});

// ---- Luz sobre la silueta (reacciona al Sol y a la Tierra, como el suelo 3D) ----
const radii = { sun: 0.27, earth: 1.0 };
const pos = (azimuth_deg, elevation_deg) => ({ azimuth_deg, elevation_deg });
const night = { sun: pos(0, -30), earth: pos(0, -30) };

test('luz: de noche (Sol y Tierra bajo el horizonte) queda solo la luz de fondo, oscura y pareja', () => {
  const a = skylineLight(0, night, radii);
  const b = skylineLight(200, night, radii);
  assert.ok(a > 0 && a < 0.1);
  assert.equal(a, b);
});

test('luz: una ladera que mira al observador se ilumina más si el Sol está a su espalda que detrás de la cresta', () => {
  // Cresta hacia el este (azimut 90). Sol por detrás de la cresta (azimut 90) vs. por detrás del observador (270).
  const behindRidge = { sun: pos(90, 20), earth: night.earth };
  const behindMe = { sun: pos(270, 20), earth: night.earth };
  assert.ok(skylineLight(90, behindMe, radii) > skylineLight(90, behindRidge, radii));
});

test('luz: con el Sol bajo el horizonte no ilumina, con el Sol arriba sí', () => {
  const up = skylineLight(90, { sun: pos(270, 30), earth: night.earth }, radii);
  const down = skylineLight(90, { sun: pos(270, -30), earth: night.earth }, radii);
  assert.ok(up > down);
});

test('luz: cuando el Sol asoma de a poco (disco medio sobre el horizonte) ilumina menos que con el Sol entero', () => {
  const half = skylineLight(90, { sun: pos(270, 0), earth: night.earth }, radii); // mitad del disco arriba
  const full = skylineLight(90, { sun: pos(270, 5), earth: night.earth }, radii);
  assert.ok(full > half);
});

test('luz: la Tierra ilumina muy poco comparada con el Sol (earthshine)', () => {
  const earthOnly = skylineLight(90, { sun: pos(0, -30), earth: pos(270, 30) }, radii);
  const sunOnly = skylineLight(90, { sun: pos(270, 30), earth: pos(0, -30) }, radii);
  assert.ok(earthOnly > skylineLight(90, night, radii));
  assert.ok(earthOnly < sunOnly / 4);
});

test('luz: siempre queda entre 0 y 1 y sin muestra devuelve la luz de fondo', () => {
  for (const az of [0, 45, 90, 180, 270, 359]) {
    for (const el of [-30, -1, 0, 5, 30, 89]) {
      const v = skylineLight(az, { sun: pos(az + 180, el), earth: pos(az + 180, el) }, radii);
      assert.ok(v >= 0 && v <= 1, `${az}/${el}: ${v}`);
    }
  }
  assert.equal(skylineLight(10, null, radii), skylineLight(10, night, radii));
});

test('borde: se aviva donde está el Sol detrás de la cresta y se apaga si el Sol está lejos o bajo el horizonte', () => {
  const sun = { sun: pos(90, 2), earth: night.earth };
  const near = skylineEdge(90, sun, radii);
  const far = skylineEdge(200, sun, radii);
  assert.ok(near > far);
  assert.ok(skylineEdge(90, { sun: pos(90, -30), earth: night.earth }, radii) <= far + 1e-9);
  for (const a of [0, 90, 180]) assert.ok(skylineEdge(a, sun, radii) >= 0 && skylineEdge(a, sun, radii) <= 1);
});

test('color: va del gris oscuro de la noche al gris claro del terreno iluminado', () => {
  const dark = lightColor(0);
  const bright = lightColor(1);
  assert.match(dark, /^rgb\(\d+, \d+, \d+\)$/);
  const lum = (c) => c.match(/\d+/g).map(Number).reduce((a, b) => a + b, 0);
  assert.ok(lum(bright) > lum(dark));
  assert.equal(lightColor(-5), dark); // se limita a [0, 1]
  assert.equal(lightColor(9), bright);
});
