// Núcleo sin DOM de la consulta en vivo de un sitio libre (#104, ADR-015). Se prueba con `npm test`.
// La web nunca llama a Horizons: pide las efemérides a nuestra API (data/api/), que responde con el
// mismo formato que ephemeris.json. El relieve llega aparte (ADR-018): GET /horizon, formato horizon.json.
import { checkEphemeris, checkHorizon } from './contract.js';

export const LAT_MAX = 90;
export const LON_MAX = 180;
export const LIVE_DAYS = 14; // máximo de la API: la cuenta regresiva busca cruces dentro de estos datos (la línea de tiempo usa 7)
const DAY_MS = 24 * 3600 * 1000;

/** Número desde el texto de un input (acepta coma decimal), o NaN si está vacío o no es un número. */
export function parseCoord(text) {
  const clean = String(text ?? '').trim().replace(',', '.');
  return clean === '' ? Number.NaN : Number(clean);
}

/**
 * Valida latitud y longitud antes de llamar a la API.
 * @returns {{ok: boolean, lat?: number, lon?: number, errors: ('lat'|'lon')[]}} errors dice qué campo falla
 */
export function validateCoords(latText, lonText) {
  const lat = parseCoord(latText);
  const lon = parseCoord(lonText);
  const errors = [];
  if (!Number.isFinite(lat) || Math.abs(lat) > LAT_MAX) errors.push('lat');
  if (!Number.isFinite(lon) || Math.abs(lon) > LON_MAX) errors.push('lon');
  return errors.length ? { ok: false, errors } : { ok: true, lat, lon, errors };
}

/** Inicio del día UTC de `ms`: la ventana de 7 días empieza ahí, como en la línea de tiempo. */
export function dayStartMs(ms) {
  return Math.floor(ms / DAY_MS) * DAY_MS;
}

const isoUtc = (ms) => `${new Date(ms).toISOString().slice(0, 19)}Z`;

export function buildLiveUrl(apiBase, lat, lon, startMs, days = LIVE_DAYS) {
  const base = apiBase.replace(/\/+$/, '');
  const q = new URLSearchParams({ lat: String(lat), lon: String(lon), start: isoUtc(startMs), days: String(days) });
  return `${base}/ephemeris?${q}`;
}

export function buildHorizonUrl(apiBase, lat, lon) {
  const base = apiBase.replace(/\/+$/, '');
  const q = new URLSearchParams({ lat: String(lat), lon: String(lon) });
  return `${base}/horizon?${q}`;
}

/** Horizonte ideal (Luna lisa, ADR-011): 360 ceros, en el formato de horizon.json. */
export function flatHorizon(siteId) {
  return {
    schema_version: '1.0',
    site_id: siteId,
    azimuth_start_deg: 0,
    azimuth_step_deg: 1,
    elevation_deg: Array(360).fill(0),
  };
}

/** Texto del error de la API (`detail` puede ser un texto o la lista de FastAPI para el error 422). */
export function apiErrorMessage(body, status) {
  const d = body?.detail;
  if (typeof d === 'string') return d;
  if (Array.isArray(d) && d.length) return d.map((e) => e.msg ?? String(e)).join('; ');
  return `HTTP ${status}`;
}

/**
 * Cargador de efemérides en vivo con caché por (lat, lon, día UTC): con el reproductor el instante
 * cambia cada segundo y no hay que volver a consultar mientras se siga en el mismo día.
 * load() resuelve { ephemeris, horizon } (horizonte liso) o rechaza con un Error de mensaje claro (nunca datos inventados).
 */
export function createLiveLoader({ apiBase, fetchImpl }) {
  const cache = new Map();

  async function getJson(url) {
    let res;
    try {
      res = await fetchImpl(url);
    } catch (err) {
      throw new Error(`no se pudo conectar con la API (${err.message})`);
    }
    let body = null;
    try {
      body = await res.json();
    } catch {
      /* respuesta que no es JSON: se informa por el estado HTTP */
    }
    if (!res.ok) throw new Error(apiErrorMessage(body, res.status));
    return body;
  }

  async function fetchLive(lat, lon, startMs) {
    const body = await getJson(buildLiveUrl(apiBase, lat, lon, startMs));
    const problems = checkEphemeris(body, body?.site_id);
    if (problems.length) throw new Error(`la API devolvió un formato inesperado: ${problems.join('; ')}`);
    return { ephemeris: body, horizon: flatHorizon(body.site_id) };
  }

  async function fetchHorizon(lat, lon) {
    const body = await getJson(buildHorizonUrl(apiBase, lat, lon));
    const problems = checkHorizon(body, body?.site_id);
    if (problems.length) throw new Error(`la API devolvió un formato inesperado: ${problems.join('; ')}`);
    return body;
  }

  // Relieve por punto (no depende de la fecha): se pide una vez y queda guardado.
  const horizons = new Map();
  const readyHorizons = new Map();

  return {
    /**
     * Relieve del punto (horizon.json con `dem`, o la Luna lisa si no hay mapa para esa latitud).
     * La primera vez puede tardar: el cielo se muestra antes con el horizonte liso de load().
     * Si falla, rechaza y el próximo pedido reintenta.
     */
    loadHorizon(lat, lon) {
      const key = `${lat}|${lon}`;
      if (!horizons.has(key)) {
        const promise = fetchHorizon(lat, lon);
        promise.then((h) => readyHorizons.set(key, h), () => horizons.delete(key));
        horizons.set(key, promise);
      }
      return horizons.get(key);
    },
    /** El relieve del punto si ya llegó; si no, null (sin esperar). */
    readyHorizon(lat, lon) {
      return readyHorizons.get(`${lat}|${lon}`) ?? null;
    },
    load(lat, lon, utcMs) {
      const startMs = dayStartMs(utcMs);
      const key = `${lat}|${lon}|${startMs}`;
      if (!cache.has(key)) {
        const promise = fetchLive(lat, lon, startMs);
        promise.catch(() => cache.delete(key)); // si falla, el próximo pedido reintenta
        cache.set(key, promise);
      }
      return cache.get(key);
    },
  };
}
