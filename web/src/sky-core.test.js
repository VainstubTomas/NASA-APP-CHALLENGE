// Pruebas de la vista del cielo (rediseño #99). Correr con: npm test (dentro de web/).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  FOV_DEG, ROTATE_STEP_DEG, TILT_STEP_DEG,
  normAz, relAz, rotate, tiltMax, tiltMin, tiltUp, tiltDown, clampTilt, pxPerDeg, project, discRadiusPx,
  compassTicks, shortDuration, chartRange, initialHeading, applyPlan,
  FOV_MIN_DEG, FOV_MAX_DEG, chartXToAz, zoomFov, makeStars, pointerAngle, nearCenter, tiltToCenter, countdownAction,
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

test('tiltMax: se puede subir la mirada hasta que el borde de arriba muestre el cenit (90°)', () => {
  // Horizonte a 720 px del borde superior y 24 px por grado: sin inclinar se ven 30° de cielo.
  assert.equal(tiltMax(720, 24), 60);
  // Muy alejado (zoom), ya se ve el cenit sin inclinar.
  assert.equal(tiltMax(720, 6), 0);
});

test('la flecha de arriba sube la mirada de a 10° hasta el máximo; la de abajo vuelve', () => {
  assert.equal(TILT_STEP_DEG, 10);
  assert.equal(tiltUp(0, 60), 10);
  assert.equal(tiltUp(55, 60), 60);
  assert.equal(tiltUp(60, 60), 60);
  assert.equal(tiltDown(10), 0);
  assert.equal(tiltDown(0), 0);
});

test('clampTilt: al arrastrar, la mirada queda entre el horizonte y el máximo', () => {
  assert.equal(clampTilt(-4, 60), 0);
  assert.equal(clampTilt(12.5, 60), 12.5);
  assert.equal(clampTilt(80, 60), 60);
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
  assert.deepEqual(applyPlan({ mode: 'map', current, chosen: { ...current } }), [{ type: 'live' }]);
  assert.deepEqual(applyPlan({ mode: null, current, chosen: { ...current } }), []);
});

test('zoomFov: la rueda acerca (campo más chico) y aleja, entre 20° y 100°', () => {
  assert.equal(FOV_MIN_DEG, 20);
  assert.equal(FOV_MAX_DEG, 100);
  assert.ok(zoomFov(60, -100) < 60); // rueda hacia arriba: acerca
  assert.ok(zoomFov(60, 100) > 60); // rueda hacia abajo: aleja
  assert.equal(zoomFov(60, 0), 60);
  assert.equal(zoomFov(21, -100000), 20);
  assert.equal(zoomFov(99, 100000), 100);
  // Ida y vuelta: el mismo giro de rueda en los dos sentidos vuelve al campo inicial.
  assert.ok(Math.abs(zoomFov(zoomFov(60, -120), 120) - 60) < 1e-9);
});

test('makeStars: siempre las mismas para la misma semilla, sobre el horizonte y casi todas débiles', () => {
  const a = makeStars(500, 42);
  const b = makeStars(500, 42);
  assert.equal(a.length, 500);
  assert.deepEqual(a, b);
  assert.notDeepEqual(makeStars(500, 7), a);
  for (const s of a) {
    assert.ok(s.az >= 0 && s.az < 360);
    assert.ok(s.el >= 0 && s.el <= 90);
    assert.ok(s.alpha > 0 && s.alpha <= 1);
    assert.ok(s.size > 0 && s.size <= 2);
    assert.match(s.color, /^#[0-9a-f]{6}$/);
  }
  const faint = a.filter((s) => s.alpha < 0.5).length;
  assert.ok(faint > a.length * 0.6, `débiles: ${faint}`);
});

test('pointerAngle: hacia dónde apunta la flecha del centro (0° = arriba, sentido horario)', () => {
  assert.equal(pointerAngle(500, 400, 500, 100), 0); // arriba
  assert.equal(pointerAngle(500, 400, 900, 400), 90); // derecha
  assert.equal(pointerAngle(500, 400, 500, 700), 180); // abajo
  assert.equal(pointerAngle(500, 400, 100, 400), 270); // izquierda
  assert.equal(pointerAngle(500, 400, 600, 300), 45);
  // Cuerpo fuera de la vista: la proyección lo deja lejos a un costado y la flecha apunta hacia ese lado.
  const view = { heading: 0, tilt: 0, width: 1440, horizonY: 700 };
  const earth = project({ azimuth_deg: 120, elevation_deg: 2 }, view);
  const a = pointerAngle(720, 450, earth.x, earth.y);
  assert.ok(a > 90 && a < 135, `ángulo ${a}`);
});

test('nearCenter: el cuerpo está en la zona central de la pantalla (la flecha ya no hace falta)', () => {
  // Pantalla 1440 × 900: zona central de 720 × 450 alrededor de (720, 450).
  assert.equal(nearCenter(720, 450, 1440, 900), true);
  assert.equal(nearCenter(1000, 600, 1440, 900), true);
  assert.equal(nearCenter(1100, 450, 1440, 900), false); // muy a la derecha
  assert.equal(nearCenter(720, 100, 1440, 900), false); // muy arriba
  assert.equal(nearCenter(-300, 450, 1440, 900), false); // fuera de la vista
});

test('tiltMin y clampTilt: se puede bajar la mirada para ver el piso, con un límite', () => {
  assert.equal(tiltMin(800, 20, 200), -30);
  assert.equal(tiltMin(100, 20), 0);
  assert.equal(clampTilt(-50, 60, -30), -30);
  assert.equal(clampTilt(-4, 60), 0);
  assert.equal(tiltDown(0, -30), -10);
  assert.equal(tiltDown(-25, -30), -30);
});

test('tiltToCenter deja el cuerpo a media pantalla, también con el zoom máximo', () => {
  // Zoom máximo (FOV_MIN_DEG) en una pantalla de 1400 × 800, horizonte al 80 % de la altura.
  const width = 1400;
  const height = 800;
  const horizonY = height * 0.8;
  const k = pxPerDeg(width, FOV_MIN_DEG);
  for (const elevation of [0.5, 5, 13, 15, 27, 45, 63]) {
    const tilt = tiltToCenter(elevation, horizonY, height, k);
    const p = project({ azimuth_deg: 90, elevation_deg: elevation }, { heading: 90, tilt, width, horizonY, fov: FOV_MIN_DEG });
    assert.ok(Math.abs(p.y - height / 2) < 1e-9, `elevación ${elevation}°: y=${p.y}`);
  }
});

test('chartXToAz traduce la posición en el gráfico a azimut y recorta en los bordes', () => {
  assert.equal(chartXToAz(44, 44, 704), 0);
  assert.equal(chartXToAz(374, 44, 704), 180);
  assert.equal(chartXToAz(539, 44, 704), 270);
  assert.equal(chartXToAz(0, 44, 704), 0); // a la izquierda del gráfico
  assert.equal(chartXToAz(900, 44, 704), 0); // 360° es el mismo norte: normAz lo deja en 0
});

test('countdownAction: clic en un cuerpo oculto que sale salta a su salida', () => {
  const change = { visible: false, event: 'rises', atMs: 1_700_000_000_000, crossMs: 1_699_999_000_000 };
  assert.deepEqual(countdownAction(change), { type: 'jump', ms: 1_700_000_000_000 });
});

test('countdownAction: cuerpo visible solo gira la vista (no cambia la fecha)', () => {
  const change = { visible: true, event: 'sets', atMs: 1_700_000_000_000, crossMs: 1_700_000_000_000 };
  assert.deepEqual(countdownAction(change), { type: 'look' });
});

test('countdownAction: sin cruce en los datos solo gira la vista', () => {
  assert.deepEqual(countdownAction({ visible: false, event: null, atMs: null, crossMs: null }), { type: 'look' });
  assert.deepEqual(countdownAction(null), { type: 'look' });
});
