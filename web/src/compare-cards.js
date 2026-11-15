// Tarjetas de la comparación de escenarios (C4-01c, #93): una por escenario, lado a lado y con la misma
// estructura para compararlas a simple vista. Los números salen de summarizeScenario (compare-core.js, #91).
// C4-01d (#94): arriba de las tarjetas, un resumen dice cuál conviene (criterio de ADR-014) y se destaca su tarjeta.
import { summarizeScenario } from './compare-core.js';
import { explainBest } from './compare-summary-core.js';
import { loadSite, loadSites } from './data.js';
import { t, locale, siteName } from './i18n.js';
import { sunIcon, earthIcon } from './icons.js';

const WINDOW_DAYS = 7; // misma ventana que la línea de tiempo (C3-03) y que ADR-014

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

const fmtUtc = (ms) =>
  `${new Date(ms).toLocaleString(locale, {
    timeZone: 'UTC', day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })} UTC`;
const fmtNum = (n) => n.toLocaleString(locale, { maximumFractionDigits: 1 });

/** Carga los datos de cada escenario y calcula su resumen. Un escenario sin datos queda con summary null. */
export async function summarizeAll(scenarios) {
  const sites = await loadSites();
  return Promise.all(scenarios.map(async (scenario, i) => {
    const site = sites.find((s) => s.id === scenario.site);
    const base = { ...scenario, n: i + 1, name: site ? siteName(site) : scenario.site };
    try {
      const { ephemeris, horizon } = await loadSite(scenario.site);
      return { ...base, summary: summarizeScenario(ephemeris, horizon, scenario.t, WINDOW_DAYS) };
    } catch (err) {
      console.warn(`Comparación: sin datos para ${scenario.site}`, err);
      return { ...base, summary: null };
    }
  }));
}

function nextChange(change) {
  if (!change || !change.event) return t('compare.next.none');
  return t(`compare.next.${change.event}`, { time: fmtUtc(change.crossMs) });
}

function bodyBlock(body, icon, hours, change) {
  const box = el('div', `compare-card__body compare-card__body--${body}`);
  const title = el('p', 'compare-card__label');
  title.append(icon, t(`panel.${body}`));
  box.append(
    title,
    el('p', 'compare-card__hours', t('compare.hours', { hours: fmtNum(hours) })),
    el('p', 'panel-card__caption', t(`compare.${body}Hours`)),
    el('p', 'compare-card__next', nextChange(change)),
  );
  return box;
}

function card(item, bestId) {
  const node = el('article', 'panel-card compare-card');
  if (item.id === bestId) {
    node.classList.add('compare-card--best');
    node.append(el('p', 'compare-card__badge', t('compare.best.badge')));
  }
  node.append(
    el('p', 'compare-card__name', t('compare.scenario', { n: item.n })),
    el('h3', 'panel-card__title', item.name),
    el('p', 'panel-card__caption', fmtUtc(item.t)),
  );
  const s = item.summary;
  if (!s) {
    node.append(el('p', 'compare-card__empty', t('compare.noData')));
    return node;
  }
  node.append(
    bodyBlock('sun', sunIcon(), s.sunHours, s.next.sun),
    bodyBlock('earth', earthIcon(), s.earthHours, s.next.earth),
  );
  if (s.windowDays < WINDOW_DAYS) {
    node.append(el('p', 'compare-card__partial', t('compare.partial', { days: fmtNum(s.windowDays) })));
  }
  return node;
}

/** Frase del resumen en lenguaje simple (claves compare.best.*). */
export function summaryText(result, items) {
  const byId = (id) => items.find((i) => i.id === id);
  const label = (id) => t('compare.best.label', { n: byId(id).n, site: byId(id).name });
  switch (result.kind) {
    case 'sun':
      return t('compare.best.sun', { scenario: label(result.id), hours: fmtNum(result.hours), other: fmtNum(result.otherHours) });
    case 'earth':
      return t('compare.best.earth', {
        scenario: label(result.id), sun: fmtNum(result.sunHours), hours: fmtNum(result.hours), other: fmtNum(result.otherHours),
      });
    case 'tie': {
      const list = new Intl.ListFormat(locale, { type: 'conjunction' }).format(result.ids.map((id) => String(byId(id).n)));
      return t('compare.best.tie', { list, sun: fmtNum(result.sunHours), earth: fmtNum(result.earthHours) });
    }
    case 'only':
      return t('compare.best.only', { scenario: label(result.id) });
    default:
      return t('compare.best.none');
  }
}

function summaryBox(result, items) {
  const box = el('section', `compare-summary compare-summary--${result.kind}`);
  box.append(
    el('h3', 'compare-summary__title', t('compare.best.title')),
    el('p', 'compare-summary__text', summaryText(result, items)),
    el('p', 'compare-summary__rule', t('compare.best.rule')),
  );
  return box;
}

/**
 * Dibuja el resumen y las tarjetas en `container`.
 * @param {HTMLElement} container
 * @param {object[]} items resultado de summarizeAll
 */
export function renderCompareCards(container, items) {
  const result = explainBest(items);
  const bestId = result.kind === 'sun' || result.kind === 'earth' ? result.id : null;
  const grid = el('div', 'compare-cards');
  grid.style.setProperty('--compare-cols', String(items.length));
  grid.append(...items.map((item) => card(item, bestId)));
  container.append(
    summaryBox(result, items),
    grid,
    el('p', 'compare__window', t('compare.window', { days: WINDOW_DAYS })),
    el('p', 'compare__flat', t('compare.flatNote')),
  );
}
