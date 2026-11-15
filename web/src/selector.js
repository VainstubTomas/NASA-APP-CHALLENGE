// Selector de sitio y de fecha/hora UTC. Escribe el estado en la URL.
import {
  getRange, clampTime, toInputValue, fromInputValue, resolveState, formatT,
} from './state.js';
import { t, siteName } from './i18n.js';
import { mergeSearch } from './scenarios-core.js';

const base = import.meta.env.BASE_URL;

async function getJson(path) {
  const res = await fetch(`${base}${path}`);
  if (!res.ok) throw new Error(`${path}: HTTP ${res.status}`);
  return res.json(); // si el servidor devuelve HTML (archivo inexistente) esto lanza
}

// true si el sitio ya tiene efemerides generadas (C1-01). Se pregunta una sola vez por sitio:
// con el reproductor (C3-02) el instante cambia cada segundo y no hay que volver a descargar.
const dataBySite = new Map();
function hasData(siteId) {
  if (!dataBySite.has(siteId)) {
    dataBySite.set(
      siteId,
      getJson(`sites/${siteId}/ephemeris.json`).then(() => true, () => false),
    );
  }
  return dataBySite.get(siteId);
}

/**
 * Devuelve { range, getState, setTime }: el reproductor (C3-02) mueve el instante con setTime.
 * onUserInput se llama cuando la persona cambia sitio o fecha a mano (el reproductor se pausa).
 */
export async function initSelector({ onChange, onUserInput } = {}) {
  const siteSelect = document.getElementById('site');
  const timeInput = document.getElementById('time');
  const notice = document.getElementById('notice');

  const { sites } = await getJson('sites.json');
  for (const site of sites) {
    const opt = document.createElement('option');
    opt.value = site.id;
    opt.textContent = site.synthetic ? `${siteName(site)} ${t('selector.syntheticTag')}` : siteName(site);
    siteSelect.appendChild(opt);
  }

  const nowMs = Date.now();
  const { minMs, maxMs } = getRange(nowMs);
  timeInput.min = toInputValue(minMs);
  timeInput.max = toInputValue(maxMs);
  timeInput.step = 3600; // una muestra por hora

  let state = resolveState(window.location.search, sites, nowMs);

  async function render() {
    siteSelect.value = state.site;
    timeInput.value = toInputValue(state.t);
    // Conserva los demás parámetros de la URL (por ejemplo `c`, los escenarios de la comparación, C4-04).
    history.replaceState(null, '', mergeSearch(window.location.search, { site: state.site, t: formatT(state.t) }));
    const ok = await hasData(state.site);
    notice.hidden = ok;
    notice.textContent = ok ? '' : t('selector.noData');
    onChange?.({ ...state, hasData: ok });
  }

  siteSelect.addEventListener('change', () => {
    onUserInput?.();
    state = { ...state, site: siteSelect.value };
    render();
  });

  timeInput.addEventListener('change', () => {
    onUserInput?.();
    const ms = fromInputValue(timeInput.value);
    // Vacio o invalido: se vuelve al valor anterior.
    state = { ...state, t: ms === null ? state.t : clampTime(ms, minMs, maxMs) };
    render();
  });

  await render();

  return {
    range: { minMs, maxMs },
    getState: () => state,
    setTime(ms) {
      state = { ...state, t: clampTime(ms, minMs, maxMs) };
      return render();
    },
  };
}
