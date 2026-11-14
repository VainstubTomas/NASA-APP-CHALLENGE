// Carga de los datos de un sitio (#32, "primera unión": la web lee datos reales).
// Uso:
//   import { loadSite } from './data.js';
//   import { horizonAt } from './horizon.js';
//   const { ephemeris, horizon } = await loadSite('apollo-11');
//   horizonAt(horizon, 47.3)   // altura del horizonte en grados hacia el azimut 47,3°
// Cada sitio se descarga una sola vez. Si un archivo no cumple el formato que espera la web,
// loadSite rechaza con un error que lista los problemas (en vez de mostrar números raros).
import { checkEphemeris, checkHorizon } from './contract.js';

const base = import.meta.env.BASE_URL;
const cache = new Map();

async function getJson(path) {
  const res = await fetch(`${base}${path}`);
  if (!res.ok) throw new Error(`${path}: HTTP ${res.status}`);
  try {
    return await res.json();
  } catch {
    // El servidor de desarrollo devuelve index.html (200) para archivos que no existen.
    throw new Error(`${path}: no existe o no es JSON`);
  }
}

async function fetchSite(siteId) {
  const [ephemeris, horizon] = await Promise.all([
    getJson(`sites/${siteId}/ephemeris.json`),
    getJson(`sites/${siteId}/horizon.json`),
  ]);
  const problems = [
    ...checkEphemeris(ephemeris, siteId).map((p) => `ephemeris.json: ${p}`),
    ...checkHorizon(horizon, siteId).map((p) => `horizon.json: ${p}`),
  ];
  if (problems.length) {
    console.error(`Datos de ${siteId} con formato inesperado:`, problems);
    throw new Error(`Datos de ${siteId} con formato inesperado: ${problems.join('; ')}`);
  }
  return { ephemeris, horizon };
}

/** Devuelve { ephemeris, horizon } del sitio, revisados contra el contrato. */
export function loadSite(siteId) {
  if (!cache.has(siteId)) {
    const promise = fetchSite(siteId);
    promise.catch(() => cache.delete(siteId)); // si falla, el próximo intento vuelve a descargar
    cache.set(siteId, promise);
  }
  return cache.get(siteId);
}
