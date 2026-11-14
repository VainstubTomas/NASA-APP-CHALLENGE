// Pruebas de la revisión de formato en la web (#32): lo que la web espera de los JSON de Python.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { checkEphemeris, checkHorizon } from './contract.js';

const SITES = new URL('../../data/public/sites/', import.meta.url);
const read = (siteId, file) => JSON.parse(readFileSync(new URL(`${siteId}/${file}`, SITES), 'utf8'));
const siteIds = readdirSync(SITES, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name);
const clone = (obj) => structuredClone(obj);

test('los ephemeris.json y horizon.json de todos los sitios pasan la revisión', () => {
  assert.ok(siteIds.length >= 15, `se esperaban 15 sitios, hay ${siteIds.length}`);
  for (const id of siteIds) {
    assert.deepEqual(checkEphemeris(read(id, 'ephemeris.json'), id), [], `${id}/ephemeris.json`);
    assert.deepEqual(checkHorizon(read(id, 'horizon.json'), id), [], `${id}/horizon.json`);
  }
});

test('ephemeris: detecta series de largo distinto a count', () => {
  const eph = clone(read('apollo-11', 'ephemeris.json'));
  eph.sun.elevation_deg.pop();
  assert.match(checkEphemeris(eph, 'apollo-11').join(' '), /sun\.elevation_deg/);
});

test('ephemeris: detecta site_id, versión y ángulos fuera de rango', () => {
  const eph = clone(read('apollo-11', 'ephemeris.json'));
  eph.schema_version = '2.0';
  eph.earth.azimuth_deg[0] = 360;
  eph.sun.elevation_deg[5] = -91;
  const problems = checkEphemeris(eph, 'otro-sitio').join(' ');
  assert.match(problems, /site_id/);
  assert.match(problems, /schema_version/);
  assert.match(problems, /earth\.azimuth_deg/);
  assert.match(problems, /sun\.elevation_deg/);
});

test('ephemeris: detecta tiempo que no es UTC ISO 8601 y radios faltantes', () => {
  const eph = clone(read('apollo-11', 'ephemeris.json'));
  eph.time.start_utc = '2026-11-01 00:00';
  delete eph.angular_radius_deg.earth;
  const problems = checkEphemeris(eph, 'apollo-11').join(' ');
  assert.match(problems, /start_utc/);
  assert.match(problems, /angular_radius_deg/);
});

test('horizon: detecta un perfil que no cubre 360°', () => {
  const hor = clone(read('apollo-11', 'horizon.json'));
  hor.elevation_deg = hor.elevation_deg.slice(0, 359);
  assert.match(checkHorizon(hor, 'apollo-11').join(' '), /360/);
});

test('horizon: detecta valores que no son números', () => {
  const hor = clone(read('apollo-11', 'horizon.json'));
  hor.elevation_deg[10] = null;
  assert.match(checkHorizon(hor, 'apollo-11').join(' '), /elevation_deg/);
});

test('horizon: azimuth_start_deg tiene que estar en [0, 360) como pide el esquema', () => {
  for (const bad of [360, -1, 400]) {
    const hor = clone(read('apollo-11', 'horizon.json'));
    hor.azimuth_start_deg = bad;
    assert.match(checkHorizon(hor, 'apollo-11').join(' '), /azimuth_start_deg/, `no detectó ${bad}`);
  }
  const ok = clone(read('apollo-11', 'horizon.json'));
  ok.azimuth_start_deg = 359.5;
  assert.deepEqual(checkHorizon(ok, 'apollo-11'), []);
});
