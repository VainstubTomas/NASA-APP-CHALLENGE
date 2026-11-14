import { initSelector } from './selector.js';
import { renderPanel } from './panel.js';
import { loadSite } from './data.js';

const base = import.meta.env.BASE_URL;
const panel = document.getElementById('panel');

async function getJson(path) {
  const res = await fetch(`${base}${path}`);
  if (!res.ok) throw new Error(`${path}: HTTP ${res.status}`);
  return res.json();
}

let sitesByIdPromise;

async function getSiteName(siteId) {
  if (!sitesByIdPromise) {
    sitesByIdPromise = getJson('sites.json').then(({ sites }) => new Map(sites.map((site) => [site.id, site.name])));
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
    try {
      const { ephemeris, horizon } = await loadSite(site);
      renderPanel(panel, { ephemeris, horizon, utcMs: t, siteName: await getSiteName(site) });
    } catch (error) {
      panel.replaceChildren();
      const notice = document.getElementById('notice');
      notice.hidden = false;
      notice.textContent = error.message;
    }
  },
}).catch((err) => {
  const notice = document.getElementById('notice');
  notice.hidden = false;
  notice.textContent = `No se pudo cargar la lista de sitios: ${err.message}`;
});
