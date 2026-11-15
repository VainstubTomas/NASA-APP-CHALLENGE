// Estado de la pantalla (sitio + instante UTC), sin DOM. Vive en la URL: ?site=<id>&t=<ISO UTC>.
// Convenciones del contrato (docs/03-DATA-CONTRACT.md): tiempo en UTC, una muestra por hora.

export const HOUR_MS = 3600 * 1000;
// Fin del rango descargado de Horizons (C0-13): 2027-02-28T23:00:00Z.
export const DATA_END_MS = Date.UTC(2027, 1, 28, 23, 0, 0);

// Inicio del dia UTC de `nowMs`: no se puede elegir una fecha pasada.
export function startOfUtcDay(nowMs) {
  const d = new Date(nowMs);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

export function getRange(nowMs) {
  return { minMs: startOfUtcDay(nowMs), maxMs: DATA_END_MS };
}

// Redondea a la hora y limita al rango.
export function clampTime(ms, minMs, maxMs) {
  const rounded = Math.round(ms / HOUR_MS) * HOUR_MS;
  return Math.min(Math.max(rounded, minMs), maxMs);
}

const pad = (n) => String(n).padStart(2, '0');

// 2026-11-14T00:00Z
export function formatT(ms) {
  const d = new Date(ms);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}T${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}Z`;
}

// Acepta 2026-11-14T00:00Z y 2026-11-14T00:00:00Z. Devuelve null si no es valido.
export function parseT(str) {
  if (typeof str !== 'string') return null;
  const m = /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2})(:\d{2})?Z$/.exec(str);
  if (!m) return null;
  const ms = Date.parse(`${m[1]}${m[2] ?? ':00'}Z`);
  return Number.isNaN(ms) ? null : ms;
}

// Valor para <input type="datetime-local">, siempre en UTC (sin zona local).
export function toInputValue(ms) {
  return formatT(ms).slice(0, 16);
}

export function fromInputValue(value) {
  return parseT(`${value}Z`);
}

// Sitio por defecto: el primer sitio real (no sintetico); si no hay, el primero.
export function defaultSite(sites) {
  return (sites.find((s) => !s.synthetic) ?? sites[0]).id;
}

// Lee la URL con tolerancia: lo invalido cae al valor por defecto, sin romper.
export function resolveState(search, sites, nowMs) {
  const params = new URLSearchParams(search);
  const { minMs, maxMs } = getRange(nowMs);
  const siteParam = params.get('site');
  const site = sites.some((s) => s.id === siteParam) ? siteParam : defaultSite(sites);
  const parsed = parseT(params.get('t'));
  const t = parsed === null ? minMs : clampTime(parsed, minMs, maxMs);
  return { site, t };
}

export function buildSearch({ site, t }) {
  const params = new URLSearchParams();
  params.set('site', site);
  params.set('t', formatT(t));
  return `?${params.toString()}`;
}

/** Aplica `patch` (clave -> valor, null borra) sobre una query string sin tocar los demás parámetros. */
export function mergeSearch(search, patch) {
  const params = new URLSearchParams(search);
  for (const [key, value] of Object.entries(patch)) {
    if (value === null) params.delete(key);
    else params.set(key, value);
  }
  const out = params.toString();
  return out ? `?${out}` : '';
}
