import { initSelector } from './selector.js';
import { renderPanel } from './panel.js';
import { t, siteName, applyStaticTexts, initLangSelect } from './i18n.js';

applyStaticTexts();
initLangSelect(document.getElementById('lang'));

const base = import.meta.env.BASE_URL;
const panel = document.getElementById('panel');

async function getJson(path) {
  const res = await fetch(`${base}${path}`);
  if (!res.ok) throw new Error(`${path}: HTTP ${res.status}`);
  return res.json();
}

const ephemerisBySite = new Map();
let sitesByIdPromise;

async function loadEphemeris(siteId) {
  if (!ephemerisBySite.has(siteId)) {
    ephemerisBySite.set(siteId, await getJson(`sites/${siteId}/ephemeris.json`));
  }
  return ephemerisBySite.get(siteId);
}

async function getSiteName(siteId) {
  if (!sitesByIdPromise) {
    sitesByIdPromise = getJson('sites.json').then(({ sites }) => new Map(sites.map((site) => [site.id, siteName(site)])));
  }
  const sitesById = await sitesByIdPromise;
  return sitesById.get(siteId) ?? siteId;
}

initSelector({
  onChange: async ({ site, t, hasData }) => {
    if (!hasData) {
      panel.replaceChildren();
      return;
    }
    const ephemeris = await loadEphemeris(site);
    renderPanel(panel, { ephemeris, utcMs: t, siteName: await getSiteName(site) });
  },
}).catch((err) => {
  const notice = document.getElementById('notice');
  notice.hidden = false;
  notice.textContent = t('app.loadError', { error: err.message });
});
