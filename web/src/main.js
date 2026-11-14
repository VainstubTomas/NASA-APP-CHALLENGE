import { initSelector } from './selector.js';
import { renderPanel } from './panel.js';
import { t as i18nT, siteName, applyStaticTexts, initLangSelect } from './i18n.js';
import { loadSite, loadSites } from './data.js';

applyStaticTexts();
initLangSelect(document.getElementById('lang'));

const panel = document.getElementById('panel');
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
      return;
    }
    try {
      // Primera unión (#32): ephemeris.json y horizon.json reales, revisados contra el contrato.
      // El panel empieza a usar el horizonte en la parte 2 (hoy es 0° en todo el círculo).
      const { ephemeris, horizon } = await loadSite(site);
      renderPanel(panel, { ephemeris, horizon, utcMs: t, siteName: await getSiteName(site) });
    } catch (err) {
      console.error(err);
      panel.replaceChildren();
      notice.hidden = false;
      notice.textContent = i18nT('app.siteError', { error: err.message });
    }
  },
}).catch((err) => {
  notice.hidden = false;
  notice.textContent = i18nT('app.loadError', { error: err.message });
});
