import { initSelector } from './selector.js';
import { renderPanel } from './panel.js';
import { t as i18nT, siteName, applyStaticTexts, initLangSelect } from './i18n.js';
import { loadSite, loadSites } from './data.js';

applyStaticTexts();
initLangSelect(document.getElementById('lang'));

const panel = document.getElementById('panel');
const notice = document.getElementById('notice');

async function getSiteName(siteId) {
  const site = (await loadSites()).find((item) => item.id === siteId);
  return site ? siteName(site) : siteId;
}

initSelector({
  onChange: async ({ site, t, hasData }) => {
    if (!hasData) {
      panel.replaceChildren();
      return;
    }
    try {
      const { ephemeris, horizon } = await loadSite(site);
      renderPanel(panel, { ephemeris, horizon, utcMs: t, siteName: await getSiteName(site) });
    } catch (error) {
      console.error(error);
      panel.replaceChildren();
      notice.hidden = false;
      notice.textContent = i18nT('app.siteError', { error: error.message });
    }
  },
}).catch((err) => {
  notice.hidden = false;
  notice.textContent = i18nT('app.loadError', { error: err.message });
});
