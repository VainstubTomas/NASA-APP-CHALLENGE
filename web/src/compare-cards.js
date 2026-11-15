// Resultado de la comparación de escenarios (C4-01c, #93): una tabla con un escenario por columna,
// con las mismas filas para compararlos a simple vista (rediseño #99: antes eran tarjetas con íconos).
// Los números salen de summarizeScenario (compare-core.js, #91).
// C4-01d (#94, ADR-017): arriba, un resumen dice en qué escenario hay más horas de Sol y en cuál más horas de Tierra
// visible. La herramienta NO elige un "mejor": lo decide la persona según los requisitos de su misión.
// #107: los escenarios repetidos (mismo sitio y hora) se juntan en una sola columna (groupScenarios).
import { summarizeScenario, groupScenarios } from './compare-core.js';
import { compareMetrics } from './compare-summary-core.js';
import { loadSite, loadSites } from './data.js';
import { hasRelief } from './horizon.js';
import { t, locale, siteName } from './i18n.js';

const WINDOW_DAYS = 7; // misma ventana que la línea de tiempo (C3-03)

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
const fmtList = (parts) => new Intl.ListFormat(locale, { type: 'conjunction' }).format(parts.map(String));
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
      return { ...base, relief: hasRelief(horizon), summary: summarizeScenario(ephemeris, horizon, scenario.t, WINDOW_DAYS) };
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

/**
 * Tabla de escenarios: filas = datos, columnas = escenarios. En las filas de horas de Sol y de Tierra se pone en
 * negrita el número del escenario que tiene más horas en esa métrica.
 * @param {object[]} items
 * @param {{sun: string[], earth: string[]}} leaders ids de los escenarios con más horas en cada métrica
 */
function scenarioTable(items, leaders) {
  const tbl = el('table', 'info-table compare-table');
  const head = el('tr');
  const corner = el('th', 'info-table__key');
  corner.scope = 'col';
  head.append(corner);
  items.forEach((item) => {
    const th = el('th');
    th.scope = 'col';
    th.append(el('span', '', scenarioLabel(item)));
    head.append(th);
  });
  const thead = el('thead');
  thead.append(head);

  const value = (item, fn) => (item.summary ? fn(item.summary) : '—');
  const rows = [
    ['compare.row.site', (item) => item.name, false, null],
    ['compare.row.date', (item) => fmtUtc(item.t), false, null],
    ['compare.row.sunHours', (item) => value(item, (s) => t('compare.hours', { hours: fmtNum(s.sunHours) })), true, 'sun'],
    ['compare.row.earthHours', (item) => value(item, (s) => t('compare.hours', { hours: fmtNum(s.earthHours) })), true, 'earth'],
    ['compare.row.sunNext', (item) => value(item, (s) => nextChange(s.next.sun)), false, null],
    ['compare.row.earthNext', (item) => value(item, (s) => nextChange(s.next.earth)), false, null],
  ];
  const tbody = el('tbody');
  for (const [key, fn, numeric, metric] of rows) {
    const tr = el('tr');
    const th = el('th', 'info-table__key', t(key, { days: WINDOW_DAYS }));
    th.scope = 'row';
    tr.append(th);
    for (const item of items) {
      const more = metric !== null && leaders[metric].includes(item.id);
      // Horas con Sol en amarillo y con la Tierra en celeste, como en el cielo y el panel.
      const td = el('td', [numeric ? 'info-num' : '', metric ? `compare-table__${metric}` : ''].filter(Boolean).join(' '));
      // El valor mayor va en negrita (<strong>), sin texto extra.
      td.append(more ? el('strong', 'compare-table__more', fn(item)) : document.createTextNode(fn(item)));
      tr.append(td);
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

/** Frases del resumen en lenguaje simple (claves compare.summary.*): una por métrica, sin elegir un ganador global. */
export function summaryLines(result, items) {
  const byId = (id) => items.find((i) => i.id === id);
  const label = (id) => {
    const item = byId(id);
    return numbers(item).length > 1
      ? t('compare.summary.labelGroup', { list: fmtList(numbers(item)), site: item.name })
      : t('compare.summary.label', { n: item.n, site: item.name });
  };
  switch (result.kind) {
    case 'metrics': {
      const line = (metric, key) => {
        const m = result[metric];
        return m.kind === 'equal'
          ? t(`compare.summary.${key}Equal`, { hours: fmtNum(m.hours) })
          : t(`compare.summary.${key}`, { scenario: fmtList(m.ids.map(label)), hours: fmtNum(m.hours), other: fmtNum(m.otherHours) });
      };
      return [line('sun', 'sun'), line('earth', 'earth')];
    }
    case 'same':
      return [t('compare.summary.same', { list: fmtList(result.ns) })];
    case 'only':
      return [t('compare.summary.only', { scenario: label(result.id) })];
    default:
      return [t('compare.summary.none')];
  }
}

function summaryBox(result, items) {
  const box = el('section', `compare-summary compare-summary--${result.kind}`);
  const lines = el('ul', 'compare-summary__lines');
  lines.append(...summaryLines(result, items).map((line) => el('li', 'compare-summary__text', line)));
  box.append(el('h3', 'compare-summary__title', t('compare.summary.title')), lines);
  // La aclaración solo tiene sentido cuando de verdad se comparan escenarios.
  if (result.kind === 'metrics') box.append(el('p', 'compare-summary__rule', t('compare.summary.note')));
  return box;
}

/**
 * Dibuja el resumen y la tabla de escenarios en `container`.
 * @param {HTMLElement} container
 * @param {object[]} items resultado de summarizeAll
 */
export function renderCompareCards(container, items) {
  const groups = groupScenarios(items); // una columna por escenario distinto (#107)
  const result = compareMetrics(groups);
  const leaders = {
    sun: result.kind === 'metrics' && result.sun.kind === 'more' ? result.sun.ids : [],
    earth: result.kind === 'metrics' && result.earth.kind === 'more' ? result.earth.ids : [],
  };
  container.append(
    summaryBox(result, groups),
    scenarioTable(groups, leaders),
    ...tableNotes(groups),
    el('p', 'compare__window', t('compare.window', { days: WINDOW_DAYS })),
    ...(items.some((i) => i.summary && !i.relief) ? [el('p', 'compare__flat', t('compare.flatNote'))] : []),
  );
}
