import './theme.css';
import { initSelector } from './selector.js';
import { renderPanel, clearPanel } from './panel.js';
import { initPlayer } from './player.js';
import { t as i18nT, siteName, applyStaticTexts, initLangSelect } from './i18n.js';
import { loadSite, loadSites, loadValidation, loadMetrics } from './data.js';
import { renderTimeline } from './timeline.js';
import { renderValidation } from './validation-panel.js';
import { initCompare } from './compare.js';
import { parseScenarios, SCENARIOS_PARAM } from './scenarios-core.js';

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

initSelector({
  onUserInput: () => player?.pause(),
  onChange: async ({ site, t, hasData }) => {
    player?.sync(t);
    if (!hasData) {
      clearPanel(panel);
      timeline.replaceChildren();
      validationBody.replaceChildren();
      return;
    }
    try {
      // Primera unión (#32): ephemeris.json y horizon.json reales, revisados contra el contrato.
      // El panel compara contra el horizonte real en la dirección de cada cuerpo (hoy 0°: Luna lisa).
      const { ephemeris, horizon } = await loadSite(site);
      renderPanel(panel, { ephemeris, horizon, utcMs: t, siteName: await getSiteName(site) });
      // C3-03: barras de Sol y Tierra para 7 días desde la fecha elegida.
      renderTimeline(timeline, ephemeris, horizon, t, 7);
    } catch (err) {
      console.error(err);
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
  player = initPlayer(document.getElementById('player'), selector);
  // Capa 4 (#92): comparación de escenarios. Arranca con la selección actual como primer escenario.
  const sites = await loadSites();
  initCompare(document.getElementById('compare'), {
    sites,
    range: selector.range,
    current: selector.getState(),
    // C4-04 (#97): escenarios guardados en la URL (?c=...); si faltan o son inválidos, los de por defecto.
    initial: parseScenarios(new URLSearchParams(window.location.search).get(SCENARIOS_PARAM), sites, selector.range),
  });
}).catch((err) => {
  notice.hidden = false;
  notice.textContent = i18nT('app.loadError', { error: err.message });
});
