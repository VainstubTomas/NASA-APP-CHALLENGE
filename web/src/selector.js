// Selector de sitio y de fecha/hora UTC. Escribe el estado en la URL.
import {
  getRange, clampTime, toInputValue, fromInputValue, resolveState, buildSearch,
} from './state.js';

const base = import.meta.env.BASE_URL;

async function getJson(path) {
  const res = await fetch(`${base}${path}`);
  if (!res.ok) throw new Error(`${path}: HTTP ${res.status}`);
  return res.json(); // si el servidor devuelve HTML (archivo inexistente) esto lanza
}

export async function initSelector({ onChange } = {}) {
  const siteSelect = document.getElementById('site');
  const timeInput = document.getElementById('time');
  const notice = document.getElementById('notice');

  const { sites } = await getJson('sites.json');
  for (const site of sites) {
    const opt = document.createElement('option');
    opt.value = site.id;
    opt.textContent = site.synthetic ? `${site.name} [datos de prueba]` : site.name;
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
    history.replaceState(null, '', buildSearch(state));
    notice.hidden = true;
    notice.textContent = '';
    onChange?.({ ...state, hasData: true });
  }

  siteSelect.addEventListener('change', () => {
    state = { ...state, site: siteSelect.value };
    render();
  });

  timeInput.addEventListener('change', () => {
    const ms = fromInputValue(timeInput.value);
    // Vacio o invalido: se vuelve al valor anterior.
    state = { ...state, t: ms === null ? state.t : clampTime(ms, minMs, maxMs) };
    render();
  });

  await render();
}
