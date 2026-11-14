import { checkEphemeris, checkHorizon } from './contract.js';

const base = import.meta.env.BASE_URL;
const siteCache = new Map();

async function getJson(path) {
  const response = await fetch(`${base}${path}`);
  if (!response.ok) throw new Error(`${path}: HTTP ${response.status}`);
  try {
    return await response.json();
  } catch (error) {
    throw new Error(`${path}: respuesta JSON inválida (${error.message})`);
  }
}

export function loadSite(siteId) {
  if (!siteCache.has(siteId)) {
    const promise = Promise.all([
      getJson(`sites/${siteId}/ephemeris.json`),
      getJson(`sites/${siteId}/horizon.json`),
    ]).then(([ephemeris, horizon]) => ({
      ephemeris: checkEphemeris(ephemeris, siteId),
      horizon: checkHorizon(horizon, siteId),
    })).catch((error) => {
      siteCache.delete(siteId);
      throw new Error(`No se pudieron cargar los datos de ${siteId}: ${error.message}`);
    });
    siteCache.set(siteId, promise);
  }
  return siteCache.get(siteId);
}
