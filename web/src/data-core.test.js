// Pruebas de la carga de datos (#32): caché, reintento después de un error y mensajes claros.
// Se prueba data-core.js con un fetch falso, sin servidor ni import.meta.env.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createFetchJson, createSiteLoader } from './data-core.js';

const real = (siteId, file) =>
  JSON.parse(readFileSync(new URL(`../../data/public/sites/${siteId}/${file}`, import.meta.url), 'utf8'));

/** fetchJson falso: sirve los archivos de `files` y cuenta las descargas por ruta. */
function fakeFetchJson(files) {
  const calls = {};
  const fetchJson = async (path) => {
    calls[path] = (calls[path] ?? 0) + 1;
    if (!(path in files)) throw new Error(`${path}: HTTP 404`);
    const value = files[path];
    if (value instanceof Error) throw value;
    return structuredClone(value);
  };
  return { fetchJson, calls };
}

const APOLLO = {
  'sites.json': real('..', 'sites.json'),
  'sites/apollo-11/ephemeris.json': real('apollo-11', 'ephemeris.json'),
  'sites/apollo-11/horizon.json': real('apollo-11', 'horizon.json'),
};

test('loadSite devuelve ephemeris y horizon del sitio', async () => {
  const { loadSite } = createSiteLoader(fakeFetchJson(APOLLO).fetchJson);
  const { ephemeris, horizon } = await loadSite('apollo-11');
  assert.equal(ephemeris.site_id, 'apollo-11');
  assert.equal(horizon.elevation_deg.length, 360);
});

test('cada sitio se descarga una sola vez (caché), aunque se pida varias veces a la vez', async () => {
  const fake = fakeFetchJson(APOLLO);
  const { loadSite } = createSiteLoader(fake.fetchJson);
  const [a, b] = await Promise.all([loadSite('apollo-11'), loadSite('apollo-11')]);
  const c = await loadSite('apollo-11');
  assert.equal(a, b);
  assert.equal(a, c);
  assert.equal(fake.calls['sites/apollo-11/ephemeris.json'], 1);
  assert.equal(fake.calls['sites/apollo-11/horizon.json'], 1);
});

test('si una descarga falla, el siguiente pedido lo vuelve a intentar', async () => {
  const files = { ...APOLLO, 'sites/apollo-11/horizon.json': new Error('sites/apollo-11/horizon.json: HTTP 503') };
  const fake = fakeFetchJson(files);
  const { loadSite } = createSiteLoader(fake.fetchJson);
  await assert.rejects(loadSite('apollo-11'), /HTTP 503/);
  files['sites/apollo-11/horizon.json'] = APOLLO['sites/apollo-11/horizon.json']; // el servidor se recupera
  const { horizon } = await loadSite('apollo-11');
  assert.equal(horizon.site_id, 'apollo-11');
  assert.equal(fake.calls['sites/apollo-11/horizon.json'], 2);
});

test('un archivo con formato inesperado da un error que dice qué archivo y qué problema', async () => {
  const roto = structuredClone(APOLLO['sites/apollo-11/horizon.json']);
  roto.elevation_deg.pop();
  const { loadSite } = createSiteLoader(fakeFetchJson({ ...APOLLO, 'sites/apollo-11/horizon.json': roto }).fetchJson);
  await assert.rejects(loadSite('apollo-11'), /apollo-11.*horizon\.json: .*no cubre 360/);
});

test('loadSites devuelve la lista de sitios y también la guarda', async () => {
  const fake = fakeFetchJson(APOLLO);
  const { loadSites } = createSiteLoader(fake.fetchJson);
  const sites = await loadSites();
  await loadSites();
  assert.ok(sites.some((s) => s.id === 'apollo-11'));
  assert.equal(fake.calls['sites.json'], 1);
});

test('fetchJson: error claro si el archivo no existe o no es JSON', async () => {
  const fakeFetch = async (url) => {
    if (url === '/base/no-existe.json') {
      // El servidor de desarrollo devuelve index.html con 200 para archivos que no existen.
      return { ok: true, status: 200, json: async () => { throw new SyntaxError("Unexpected token '<'"); } };
    }
    if (url === '/base/caido.json') return { ok: false, status: 500, json: async () => ({}) };
    return { ok: true, status: 200, json: async () => ({ ok: 1 }) };
  };
  const fetchJson = createFetchJson('/base/', fakeFetch);
  assert.deepEqual(await fetchJson('bien.json'), { ok: 1 });
  await assert.rejects(fetchJson('no-existe.json'), /no-existe\.json: no existe o no es JSON/);
  await assert.rejects(fetchJson('caido.json'), /caido\.json: HTTP 500/);
});
