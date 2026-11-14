import './theme.css';
import { initSelector } from './selector.js';
import { renderPanel } from './panel.js';
import { t as i18nT, siteName, applyStaticTexts, initLangSelect } from './i18n.js';
import { loadSite, loadSites } from './data.js';
import { renderTimeline } from './timeline.js';

applyStaticTexts();
initLangSelect(document.getElementById('lang'));

const panel = document.getElementById('panel');
const timeline = document.getElementById('timeline');
const notice = document.getElementById('notice');

// Nombres de los sitios en el idioma actual (sites.json se descarga una sola vez, en data.js).
async function getSiteName(siteId) {
  const site = (await loadSites()).find((s) => s.id === siteId);
  return site ? siteName(site) : siteId;
}

initSelector({
  onChange: async ({ site, t, hasData }) => {
    if (!hasData) {
      panel.replaceChildren();
      timeline.replaceChildren();
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
      panel.replaceChildren();
      timeline.replaceChildren();
      notice.hidden = false;
      notice.textContent = i18nT('app.siteError', { error: err.message });
    }
  },
}).catch((err) => {
  notice.hidden = false;
  notice.textContent = i18nT('app.loadError', { error: err.message });
});
