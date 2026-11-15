import test from 'node:test';
import assert from 'node:assert/strict';
import { POLES, MAP_EDGE_LAT_DEG, pixelToLatLon, latLonToPixel, wrapLon, roundCoord } from './map-core.js';

const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg ?? ''} ${a} vs ${b}`);

test('el centro del mapa es el polo y el borde está a 55° de latitud', () => {
  for (const pole of ['south', 'north']) {
    const p = POLES[pole];
    near(pixelToLatLon(pole, p.cx, p.cy).lat, p.hemisphere * 90, 1e-9);
    const edge = pixelToLatLon(pole, p.cx + p.radius - 0.01, p.cy);
    near(Math.abs(edge.lat), MAP_EDGE_LAT_DEG, 0.1, `borde ${pole}`);
    assert.equal(pixelToLatLon(pole, p.cx + p.radius + 2, p.cy), null);
  }
});

test('anillos de la retícula medidos: 80°, 70° y 60° caen a 93, 188 y 285 px (sur)', () => {
  const p = POLES.south;
  for (const [px, lat] of [[93, -80], [188, -70], [285, -60]]) {
    near(pixelToLatLon('south', p.cx + px, p.cy).lat, lat, 0.2, `anillo ${lat}`);
  }
  const n = POLES.north;
  for (const [px, lat] of [[96, 80], [193, 70], [293, 60]]) {
    near(pixelToLatLon('north', n.cx + px, n.cy).lat, lat, 0.2, `anillo ${lat}`);
  }
});

test('orientación del sur: 0° arriba, este a la derecha, 180° abajo', () => {
  const p = POLES.south;
  near(pixelToLatLon('south', p.cx, p.cy - 100).lon, 0, 1e-9);
  near(pixelToLatLon('south', p.cx + 100, p.cy).lon, 90, 1e-9);
  near(Math.abs(pixelToLatLon('south', p.cx, p.cy + 100).lon), 180, 1e-9);
  near(pixelToLatLon('south', p.cx - 100, p.cy).lon, -90, 1e-9);
});

test('orientación del norte: 0° abajo, este a la derecha, 180° arriba', () => {
  const p = POLES.north;
  near(pixelToLatLon('north', p.cx, p.cy + 100).lon, 0, 1e-9);
  near(pixelToLatLon('north', p.cx + 100, p.cy).lon, 90, 1e-9);
  near(Math.abs(pixelToLatLon('north', p.cx, p.cy - 100).lon), 180, 1e-9);
});

test('cráteres de coordenadas conocidas caen donde se ven en la imagen (±8 px)', () => {
  // Posiciones aproximadas leídas a ojo sobre los PNG (control de orientación y escala, no una medición fina).
  const cases = [
    ['south', -75.0, 132.4, 468, 443],
    ['south', -75.2, -133.6, 265, 449],
    ['north', 56.8, 81.5, 674, 408],
  ];
  for (const [pole, lat, lon, ex, ey] of cases) {
    const px = latLonToPixel(pole, lat, lon);
    near(px.x, ex, 8, `x ${lat},${lon}`);
    near(px.y, ey, 8, `y ${lat},${lon}`);
  }
});

test('ida y vuelta: latLonToPixel y pixelToLatLon son inversas', () => {
  for (const [pole, lat, lon] of [['south', -89.5, 0], ['south', -85.3, 31.7], ['south', -60, -179.5], ['north', 88, 120], ['north', 70.1, -45.5]]) {
    const px = latLonToPixel(pole, lat, lon);
    const back = pixelToLatLon(pole, px.x, px.y);
    near(back.lat, lat, 1e-9);
    near(Math.abs(wrapLon(back.lon - lon)), 0, 1e-7);
  }
});

test('latLonToPixel: nada fuera del mapa (otro hemisferio o más allá de 55°)', () => {
  assert.equal(latLonToPixel('south', 10, 0), null);
  assert.equal(latLonToPixel('south', -50, 0), null);
  assert.equal(latLonToPixel('north', -80, 0), null);
});

test('wrapLon y roundCoord', () => {
  assert.equal(wrapLon(190), -170);
  assert.equal(wrapLon(-190), 170);
  assert.equal(wrapLon(180), 180);
  assert.equal(roundCoord(-75.01234), -75.01);
});
