import './theme.css';
import { initSelector } from './selector.js';
import { renderPanel, clearPanel } from './panel.js';
import { initPlayer } from './player.js';
import { t as i18nT, siteName, applyStaticTexts, initLangSelect } from './i18n.js';
import { loadSite, loadSites, loadValidation, loadMetrics } from './data.js';
import { renderTimeline } from './timeline.js';
import { renderValidation } from './validation-panel.js';
import { initCompare } from './compare.js';
import { initLive } from './live.js';
import { createLiveLoader } from './live-core.js';
import { initSky } from './sky.js';
import { getRange } from './state.js';

applyStaticTexts();
initLangSelect(document.getElementById('lang'));

const panel = document.getElementById('panel');
const timeline = document.getElementById('timeline');
const validationBody = document.getElementById('validation-body');
const notice = document.getElementById('notice');

// Nombres de los sitios en el idioma actual (sites.json se descarga una sola vez, en data.js).
async function getSiteName(siteId) {
  const site = (await loadSites()).find((s) => s.id === siteId);
  return site ? siteName(site) : siteId;
}

let player; // se crea después del primer render del selector
let selectorApi; // lo que devuelve initSelector (para que el deslizador del cielo mueva la fecha)


// Consulta en vivo de un sitio libre (#104, ADR-015): solo si hay una API configurada (VITE_API_URL).
// Sin API la web funciona como siempre, con los sitios precalculados.
const apiBase = import.meta.env.VITE_API_URL;
const liveLoader = apiBase ? createLiveLoader({ apiBase, fetchImpl: (url) => fetch(url) }) : null;
let live = null; // formulario de latitud y longitud
let liveSite = null; // { lat, lon } mientras se muestra una posición libre
let liveSeq = 0; // descarta respuestas viejas si el usuario cambia algo mientras se consulta

// Vista del cielo (rediseño #99): pantalla principal. Se crea antes del selector porque el
// primer render del selector ya le manda datos.
const closeLabel = document.querySelector('[data-i18n-label]');
if (closeLabel) closeLabel.setAttribute('aria-label', i18nT(closeLabel.dataset.i18nLabel));
const sky = initSky(document.getElementById('sky'), {
  range: getRange(Date.now()),
  onTime: (ms) => selectorApi?.setTime(ms),
  onUserInput: () => player?.pause(),
  drawer: document.getElementById('details'),
  liveEnabled: Boolean(liveLoader),
});

async function showLive(utcMs) {
  const { lat, lon } = liveSite;
  const seq = ++liveSeq;
  notice.hidden = true;
  live.setBusy(true);
  live.setStatus(i18nT('live.loading'));
  try {
    const { ephemeris, horizon } = await liveLoader.load(lat, lon, utcMs);
    if (seq !== liveSeq || !liveSite) return;
    console.log('[live] consulta OK', { lat, lon, utc: new Date(utcMs).toISOString(), site_id: ephemeris.site_id, muestras: ephemeris.time.count });
    const liveName = i18nT('live.siteName', { lat, lon });
    renderPanel(panel, { ephemeris, horizon, utcMs, siteName: liveName });
    sky.update({ ephemeris, horizon, utcMs, siteName: liveName, key: `live:${lat},${lon}` });
    renderTimeline(timeline, ephemeris, horizon, utcMs, 7);
    validationBody.replaceChildren(); // no hay valores de referencia de Horizons para un punto libre
    live.setStatus(i18nT('live.active'));
  } catch (err) {
    if (seq !== liveSeq || !liveSite) return;
    console.log('[live] consulta con error', { lat, lon, utc: new Date(utcMs).toISOString(), error: err.message });
    clearPanel(panel);
    timeline.replaceChildren();
    sky.clear({ utcMs });
    live.setStatus(i18nT('live.apiError', { error: err.message }), true);
  } finally {
    if (seq === liveSeq) live.setBusy(false);
  }
}

// Elegir un sitio de la lista sale del modo en vivo. Se registra antes que el selector para correr primero.
document.getElementById('site').addEventListener('change', () => {
  liveSite = null;
  liveSeq += 1;
  live?.setStatus('');
  live?.setBusy(false);
});

initSelector({
  onUserInput: () => player?.pause(),
  onChange: async ({ site, t, hasData }) => {
    player?.sync(t);
    if (liveSite) {
      await showLive(t);
      return;
    }
    if (!hasData) {
      sky.clear({ siteName: await getSiteName(site), utcMs: t });
      clearPanel(panel);
      timeline.replaceChildren();
      validationBody.replaceChildren();
      return;
    }
    try {
      // Primera unión (#32): ephemeris.json y horizon.json reales, revisados contra el contrato.
      // El panel compara contra el horizonte real en la dirección de cada cuerpo (hoy 0°: Luna lisa).
      const { ephemeris, horizon } = await loadSite(site);
      const name = await getSiteName(site);
      sky.update({ ephemeris, horizon, utcMs: t, siteName: name, key: site });
      renderPanel(panel, { ephemeris, horizon, utcMs: t, siteName: name });
      // C3-03: barras de Sol y Tierra para 7 días desde la fecha elegida.
      renderTimeline(timeline, ephemeris, horizon, t, 7);
    } catch (err) {
      console.error(err);
      sky.clear({ utcMs: t });
      clearPanel(panel);
      timeline.replaceChildren();
      notice.hidden = false;
      notice.textContent = i18nT('app.siteError', { error: err.message });
      return;
    }
    // Panel de validación (#39): separado del panel principal, un fallo no lo tumba.
    try {
      const [validation, metrics, { ephemeris, horizon }] = await Promise.all([
        loadValidation(),
        loadMetrics(site),
        loadSite(site),
      ]);
      renderValidation(validationBody, { validation, siteId: site, ephemeris, horizon, metrics });
    } catch (err) {
      validationBody.textContent = i18nT('validation.loadError', { error: err.message });
    }
  },
}).then(async (selector) => {
  selectorApi = selector;
  player = initPlayer(document.getElementById('player'), selector);
  if (liveLoader) {
    const liveSection = document.getElementById('live');
    liveSection.hidden = false;
    live = initLive(liveSection, {
      onQuery: ({ lat, lon }) => {
        player?.pause();
        liveSite = { lat, lon };
        showLive(selector.getState().t);
      },
    });
  }
  // Capa 4 (#92): comparación de escenarios. Arranca con la selección actual como primer escenario.
  initCompare(document.getElementById('compare'), {
    sites: await loadSites(),
    range: selector.range,
    current: selector.getState(),
  });
}).catch((err) => {
  notice.hidden = false;
  notice.textContent = i18nT('app.loadError', { error: err.message });
});
