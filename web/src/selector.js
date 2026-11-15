// Selector de sitio y de fecha/hora UTC. Escribe el estado en la URL.
import {
  getRange, rangeFor, clampTime, toInputValue, fromInputValue, resolveState, formatT, mergeSearch,
} from './state.js';
import { t, siteName } from './i18n.js';
import { LANGS } from './i18n-core.js';

const base = import.meta.env.BASE_URL;

async function getJson(path) {
  const res = await fetch(`${base}${path}`);
  if (!res.ok) throw new Error(`${path}: HTTP ${res.status}`);
  return res.json(); // si el servidor devuelve HTML (archivo inexistente) esto lanza
}

// true si el sitio ya tiene efemerides generadas (C1-01), o su ventana de misión (ADR-019) en modo misión.
// Se pregunta una sola vez por sitio y archivo: con el reproductor (C3-02) el instante cambia cada
// segundo y no hay que volver a descargar.
const dataBySite = new Map();
function hasData(siteId, mission = false) {
  const file = mission ? 'mission.json' : 'ephemeris.json';
  const key = `${siteId}/${file}`;
  if (!dataBySite.has(key)) {
    dataBySite.set(key, getJson(`sites/${siteId}/${file}`).then(() => true, () => false));
  }
  return dataBySite.get(key);
}

/**
 * Devuelve { range, getRange, getState, setTime }: el reproductor (C3-02) mueve el instante con setTime.
 * `range` es el rango normal (de hoy al fin de los datos); `getRange()` el que rige ahora, que en modo
 * misión (ADR-019) es la ventana de la misión del sitio.
 * onUserInput se llama cuando la persona cambia sitio o fecha a mano (el reproductor se pausa).
 * onRange({ minMs, maxMs, mission }) se llama cuando cambia el rango que rige.
 */
export async function initSelector({ onChange, onUserInput, onRange } = {}) {
  const siteSelect = document.getElementById('site');
  const timeInput = document.getElementById('time');
  const notice = document.getElementById('notice');

  const { sites } = await getJson('sites.json');
  for (const site of sites) {
    const opt = document.createElement('option');
    opt.value = site.id;
    opt.textContent = site.synthetic ? `${siteName(site)} ${t('selector.syntheticTag')}` : siteName(site);
    if (site.landing_utc) opt.dataset.landing = site.landing_utc; // el panel ofrece "Ir al día de la misión"
    siteSelect.appendChild(opt);
  }

  const nowMs = Date.now();
  const { minMs, maxMs } = getRange(nowMs);
  timeInput.step = 3600; // una muestra por hora

  const siteById = (id) => sites.find((s) => s.id === id);
  let state = resolveState(window.location.search, sites, nowMs);
  let active = { minMs, maxMs, mission: false }; // rango que rige ahora (se calcula en render)

  async function render() {
    const next = rangeFor(siteById(state.site), state.t, nowMs);
    const changed = next.minMs !== active.minMs || next.maxMs !== active.maxMs || next.mission !== active.mission;
    active = next;
    timeInput.min = toInputValue(active.minMs);
    timeInput.max = toInputValue(active.maxMs);
    if (changed) onRange?.(active);
    siteSelect.value = state.site;
    timeInput.value = toInputValue(state.t);
    // Conserva los demás parámetros de la URL (c, escenarios, etc.)
    // y también el idioma seleccionado (?lang=).
    const search = new URLSearchParams(
      mergeSearch(window.location.search, {
        site: state.site,
        t: formatT(state.t),
      })
    );

    const lang = new URLSearchParams(window.location.search).get('lang');
    if (LANGS.includes(lang)) {
      search.set('lang', lang);
    }

    history.replaceState(null, '', `?${search}`);
    const ok = await hasData(state.site, active.mission);
    notice.hidden = ok;
    notice.textContent = ok ? '' : t('selector.noData');
    onChange?.({ ...state, hasData: ok, mission: active.mission });
  }

  siteSelect.addEventListener('change', () => {
    onUserInput?.();
    // Al cambiar de sitio se sale de la misión del anterior: la fecha se ajusta al rango del sitio nuevo.
    const r = rangeFor(siteById(siteSelect.value), state.t, nowMs);
    state = { site: siteSelect.value, t: clampTime(state.t, r.minMs, r.maxMs) };
    render();
  });

  timeInput.addEventListener('change', () => {
    onUserInput?.();
    const ms = fromInputValue(timeInput.value);
    // Vacio o invalido: se vuelve al valor anterior. Una fecha dentro de la ventana de misión del sitio
    // activa el modo misión; fuera de ella rige el rango normal.
    const r = rangeFor(siteById(state.site), ms ?? state.t, nowMs);
    state = { ...state, t: ms === null ? state.t : clampTime(ms, r.minMs, r.maxMs) };
    render();
  });

  await render();

  return {
    range: { minMs, maxMs },
    getRange: () => active,
    getState: () => state,
    setTime(ms) {
      const r = rangeFor(siteById(state.site), ms, nowMs);
      state = { ...state, t: clampTime(ms, r.minMs, r.maxMs) };
      return render();
    },
  };
}
