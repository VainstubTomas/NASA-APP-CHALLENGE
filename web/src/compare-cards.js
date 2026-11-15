// Resultado de la comparación de escenarios (C4-01c, #93): una tabla con un escenario por columna,
// con las mismas filas para compararlos a simple vista (rediseño #99: antes eran tarjetas con íconos).
// Los números salen de summarizeScenario (compare-core.js, #91).
// C4-01d (#94): arriba, un resumen dice cuál conviene (criterio de ADR-014) y se destaca su columna.
// #107: los escenarios repetidos (mismo sitio y hora) se juntan en una sola columna (groupScenarios).
import { summarizeScenario, groupScenarios } from './compare-core.js';
import { explainBest } from './compare-summary-core.js';
import { loadSite, loadSites } from './data.js';
import { t, locale, siteName } from './i18n.js';

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
// "1 y 3", "1, 2 y 3" según el idioma.
const fmtList = (ns) => new Intl.ListFormat(locale, { type: 'conjunction' }).format(ns.map(String));
// Los items sin `ns` (no agrupados) cuentan como un grupo de un solo escenario.
const numbers = (item) => item.ns ?? [item.n];
// "Escenario 2" o, si es un grupo, "Escenarios 1 y 3: mismo sitio y fecha".
const scenarioLabel = (item) => (numbers(item).length > 1
  ? t('compare.group.header', { list: fmtList(numbers(item)) })
  : t('compare.scenario', { n: item.n }));

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

/** Tabla de escenarios: filas = datos, columnas = escenarios; la columna del mejor, resaltada. */
function scenarioTable(items, bestId) {
  const tbl = el('table', 'info-table compare-table');
  const head = el('tr');
  const corner = el('th', 'info-table__key');
  corner.scope = 'col';
  head.append(corner);
  items.forEach((item) => {
    const th = el('th', item.id === bestId ? 'compare-table__best' : '');
    th.scope = 'col';
    th.append(el('span', '', scenarioLabel(item)));
    if (item.id === bestId) th.append(el('span', 'compare-table__badge', t('compare.best.badge')));
    head.append(th);
  });
  const thead = el('thead');
  thead.append(head);

  const value = (item, fn) => (item.summary ? fn(item.summary) : '—');
  const rows = [
    ['compare.row.site', (item) => item.name, false],
    ['compare.row.date', (item) => fmtUtc(item.t), false],
    ['compare.row.sunHours', (item) => value(item, (s) => t('compare.hours', { hours: fmtNum(s.sunHours) })), true],
    ['compare.row.earthHours', (item) => value(item, (s) => t('compare.hours', { hours: fmtNum(s.earthHours) })), true],
    ['compare.row.sunNext', (item) => value(item, (s) => nextChange(s.next.sun)), false],
    ['compare.row.earthNext', (item) => value(item, (s) => nextChange(s.next.earth)), false],
  ];
  const tbody = el('tbody');
  for (const [key, fn, numeric] of rows) {
    const tr = el('tr');
    const th = el('th', 'info-table__key', t(key, { days: WINDOW_DAYS }));
    th.scope = 'row';
    tr.append(th);
    for (const item of items) {
      const cls = [numeric ? 'info-num' : '', item.id === bestId ? 'compare-table__best' : ''].join(' ').trim();
      tr.append(el('td', cls, fn(item)));
    }
    tbody.append(tr);
  }
  tbl.append(thead, tbody);
  return tbl;
}

/** Avisos debajo de la tabla: escenarios sin datos o con menos días que el resto. */
function tableNotes(items) {
  const notes = [];
  for (const item of items) {
    if (!item.summary) notes.push(`${scenarioLabel(item)}: ${t('compare.noData')}`);
    else if (item.summary.windowDays < WINDOW_DAYS) {
      notes.push(`${scenarioLabel(item)}: ${t('compare.partial', { days: fmtNum(item.summary.windowDays) })}`);
    }
  }
  return notes.map((n) => el('p', 'compare__partial', n));
}

/** Frase del resumen en lenguaje simple (claves compare.best.*). */
export function summaryText(result, items) {
  const byId = (id) => items.find((i) => i.id === id);
  const label = (id) => {
    const item = byId(id);
    return numbers(item).length > 1
      ? t('compare.best.labelGroup', { list: fmtList(numbers(item)), site: item.name })
      : t('compare.best.label', { n: item.n, site: item.name });
  };
  switch (result.kind) {
    case 'sun':
      return t('compare.best.sun', { scenario: label(result.id), hours: fmtNum(result.hours), other: fmtNum(result.otherHours) });
    case 'earth':
      return t('compare.best.earth', {
        scenario: label(result.id), sun: fmtNum(result.sunHours), hours: fmtNum(result.hours), other: fmtNum(result.otherHours),
      });
    case 'tie': {
      // Números de todos los escenarios de los grupos empatados, en el orden de la lista.
      const list = fmtList(result.ids.flatMap((id) => numbers(byId(id))).sort((a, b) => a - b));
      return t('compare.best.tie', { list, sun: fmtNum(result.sunHours), earth: fmtNum(result.earthHours) });
    }
    case 'same':
      return t('compare.best.same', { list: fmtList(result.ns) });
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
 * Dibuja el resumen y la tabla de escenarios en `container`.
 * @param {HTMLElement} container
 * @param {object[]} items resultado de summarizeAll
 */
export function renderCompareCards(container, items) {
  const groups = groupScenarios(items); // una columna por escenario distinto (#107)
  const result = explainBest(groups);
  const bestId = result.kind === 'sun' || result.kind === 'earth' ? result.id : null;
  container.append(
    summaryBox(result, groups),
    scenarioTable(groups, bestId),
    ...tableNotes(groups),
    el('p', 'compare__window', t('compare.window', { days: WINDOW_DAYS })),
    el('p', 'compare__flat', t('compare.flatNote')),
  );
}
