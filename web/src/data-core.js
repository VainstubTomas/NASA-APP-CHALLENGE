// Lógica de carga de datos (#32), sin import.meta.env ni fetch global, para poder probarla
// con `npm test` inyectando un fetch falso. La web la usa a través de data.js.
import { checkEphemeris, checkHorizon } from './contract.js';

/**
 * Devuelve fetchJson(path): descarga `${base}${path}` y lo lee como JSON, con errores claros.
 * @param {string} base prefijo de las rutas (import.meta.env.BASE_URL en la web)
 * @param {Function} fetchImpl fetch del navegador, o uno falso en las pruebas
 */
export function createFetchJson(base, fetchImpl) {
  return async (path) => {
    const res = await fetchImpl(`${base}${path}`);
    if (!res.ok) throw new Error(`${path}: HTTP ${res.status}`);
    try {
      return await res.json();
    } catch {
      // El servidor de desarrollo devuelve index.html (200) para archivos que no existen.
      throw new Error(`${path}: no existe o no es JSON`);
    }
  };
}

/** Guarda la promesa por clave; si falla, la borra para que el próximo pedido reintente. */
function memo(cache, key, load) {
  if (!cache.has(key)) {
    const promise = load();
    promise.catch(() => cache.delete(key));
    cache.set(key, promise);
  }
  return cache.get(key);
}

/**
 * Cargador de datos con caché: { loadSites, loadSite }.
 * - loadSites(): la lista de sitios de sites.json.
 * - loadSite(siteId, { mission }): { ephemeris, horizon } del sitio, revisados contra lo que espera la web
 *   (contract.js); si un archivo no cumple, rechaza con un error que lista los problemas.
 *   Con { mission: true } las efemérides salen de mission.json (ventana alrededor del alunizaje,
 *   ADR-019, mismo formato que ephemeris.json); el horizonte es el mismo.
 */
export function createSiteLoader(fetchJson) {
  const cache = new Map();

  async function fetchSite(siteId, mission) {
    const file = mission ? 'mission.json' : 'ephemeris.json';
    const [ephemeris, horizon] = await Promise.all([
      fetchJson(`sites/${siteId}/${file}`),
      fetchJson(`sites/${siteId}/horizon.json`),
    ]);
    const problems = [
      ...checkEphemeris(ephemeris, siteId).map((p) => `${file}: ${p}`),
      ...checkHorizon(horizon, siteId).map((p) => `horizon.json: ${p}`),
    ];
    if (problems.length) {
      throw new Error(`Datos de ${siteId} con formato inesperado: ${problems.join('; ')}`);
    }
    return { ephemeris, horizon };
  }

  return {
    loadSites: () => memo(cache, 'sites.json', async () => (await fetchJson('sites.json')).sites),
    loadSite: (siteId, { mission = false } = {}) => memo(
      cache,
      `${mission ? 'mission' : 'site'}:${siteId}`,
      () => fetchSite(siteId, mission),
    ),
  };
}
