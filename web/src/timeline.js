// Línea de tiempo (C3-03, #36): barras "hay Sol" y "hay Tierra" para varios días desde la fecha
// elegida. Usa la misma regla de visibilidad que el panel (visibility.js). Los textos salen de
// i18n y los colores de theme.css (ver timeline.css).
import './timeline.css';
import { visibilitySeries } from './visibility.js';
import { timelineWindow, runs, dayMarks } from './timeline-core.js';
import { t, locale } from './i18n.js';

const el = (tag, className, text) => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
};

const pct = (fraction) => `${(fraction * 100).toFixed(3)}%`;

function track(body, visible, n, nowFraction) {
  const node = el('div', `timeline__track timeline__track--${body}`);
  for (const [from, to] of runs(visible)) {
    const bar = el('span', 'timeline__bar');
    bar.style.left = pct(from / n);
    bar.style.width = pct((to - from) / n);
    node.append(bar);
  }
  const now = el('span', 'timeline__now');
  now.style.left = pct(nowFraction);
  node.append(now);
  return node;
}

/**
 * Dibuja la línea de tiempo en `container`.
 * @param {HTMLElement} container
 * @param {object} eph contenido de ephemeris.json
 * @param {object} horizon contenido de horizon.json
 * @param {number} chosenMs instante elegido, en milisegundos UTC
 * @param {number} days cantidad de días a mostrar (por defecto 7)
 */
export function renderTimeline(container, eph, horizon, chosenMs, days = 7) {
  const win = timelineWindow(eph.time, chosenMs, days);
  if (!win) {
    container.replaceChildren(el('h2', 'timeline__title', t('timeline.title')), el('p', 'timeline__note', t('timeline.noData')));
    return;
  }
  const { first, last, nowFraction } = win;
  const n = last - first;
  const series = visibilitySeries(eph, horizon);

  const dateFmt = new Intl.DateTimeFormat(locale, { month: '2-digit', day: '2-digit', timeZone: 'UTC' });
  const startLabel = dateFmt.format(new Date(Date.parse(eph.time.start_utc) + first * eph.time.step_s * 1000));
  const chart = el('div', 'timeline');
  chart.setAttribute('role', 'group');
  chart.setAttribute('aria-label', t('timeline.aria', { days: Math.round(win.days), start: startLabel }));

  for (const body of ['sun', 'earth']) {
    const row = el('div', 'timeline__row');
    row.append(el('span', `timeline__label timeline__label--${body}`, t(`panel.${body}`)), track(body, series[body].visible.slice(first, last), n, nowFraction));
    chart.append(row);
  }

  const axis = el('div', 'timeline__axis');
  for (const { offset, ms } of dayMarks(eph.time, first, last)) {
    const tick = el('span', 'timeline__tick', dateFmt.format(new Date(ms)));
    tick.style.left = pct(offset / n);
    axis.append(tick);
  }
  const axisRow = el('div', 'timeline__row');
  axisRow.append(el('span', 'timeline__label'), axis);
  chart.append(axisRow);

  const legend = el('p', 'timeline__note', t('timeline.legend'));
  const notes = [el('h2', 'timeline__title', t('timeline.title')), chart, legend];
  if (win.days < days) notes.push(el('p', 'timeline__note', t('timeline.partial', { days: Number(win.days.toFixed(1)) })));
  container.replaceChildren(...notes);
}
