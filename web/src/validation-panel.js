// Panel de validación (C3-06, #39, ADR-013): números de la web contra JPL Horizons, por sitio.
// Uso: renderValidation(contenedor, { validation, siteId, ephemeris, horizon, metrics }).
import './validation-panel.css';
import { t, locale } from './i18n.js';
import { compareRows, compareDailyHours } from './validation.js';
import { formatT, DATA_END_MS } from './state.js';

const DATA_END = formatT(DATA_END_MS).slice(0, 10);

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

// Tres decimales: la web guarda 3 decimales y Horizons trae 6.
const fmt3 = (value) => {
  const rounded = Number(value.toFixed(3));
  const shown = rounded === 0 ? 0 : rounded;
  return shown.toLocaleString(locale, { minimumFractionDigits: 3, maximumFractionDigits: 3 });
};

const fmtPair = (p) => `${fmt3(p.azimuth_deg)} / ${fmt3(p.elevation_deg)}`;

export function renderValidation(container, { validation, siteId, ephemeris, horizon, metrics }) {
  container.replaceChildren();
  const rows = validation.rows.filter((r) => r.site_id === siteId);
  const results = compareRows(rows, {
    tolerance: validation.tolerance_deg,
    ephemerisBySite: ephemeris ? { [siteId]: ephemeris } : {},
  });

  container.append(
    el('p', 'validation__intro', t('validation.intro')),
    el('p', 'validation__tolerance', t('validation.tolerance', { value: fmt3(validation.tolerance_deg) })),
    el('p', 'validation__source', t('validation.source', { source: validation.source })),
  );

  const table = el('table', 'validation__table');
  const thead = el('thead');
  const head = el('tr');
  for (const key of ['body', 'time', 'web', 'horizons', 'diff', 'status']) {
    head.append(el('th', null, t(`validation.col.${key}`)));
  }
  thead.append(head);
  const tbody = el('tbody');
  for (const r of results) {
    const tr = el('tr');
    tr.append(
      el('td', null, t(`panel.${r.body}`)),
      el('td', null, r.time_utc.slice(0, 16).replace('T', ' ')),
      el('td', null, r.web ? fmtPair(r.web) : '—'),
      el('td', null, fmtPair(r.ref)),
      el('td', null, r.diff ? `${fmt3(r.diff.azimuth_deg)} / ${fmt3(r.diff.elevation_deg)}` : '—'),
      el('td', `validation-status validation-status--${r.status}`, t(`validation.status.${r.status}`)),
    );
    tbody.append(tr);
  }
  table.append(thead, tbody);
  container.append(table);

  if (results.some((r) => r.status === 'outOfRange')) {
    container.append(el('p', 'validation__note', t('validation.outOfRangeNote', { end: DATA_END })));
  }

  const section = el('div', 'validation__metrics');
  section.append(el('h4', null, t('validation.metrics.title')));
  let text;
  if (!metrics || !ephemeris || !horizon) {
    text = t('validation.metrics.pending');
  } else {
    const diffs = compareDailyHours(ephemeris, horizon, metrics);
    text = diffs.length === 0 ? t('validation.metrics.match') : t('validation.metrics.diff', { count: diffs.length });
  }
  section.append(el('p', 'validation__metrics-result', text));
  container.append(section);
}
