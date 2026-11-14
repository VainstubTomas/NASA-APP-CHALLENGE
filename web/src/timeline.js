// Linea de tiempo (C3-03): barras "hay Sol" y "hay Tierra" para varios dias
// desde la fecha elegida. Usa la misma regla de visibilidad que el horizonte.
import { visibilitySeries } from './visibility.js';

const DAY_S = 86400;
const SVG_NS = 'http://www.w3.org/2000/svg';

const el = (name, attrs = {}, text) => {
  const node = document.createElementNS(SVG_NS, name);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, String(v));
  if (text !== undefined) node.textContent = text;
  return node;
};

// Tramos continuos de muestras visibles: [{ from, to }) en indices.
function runs(visible) {
  const out = [];
  let start = -1;
  visible.forEach((v, i) => {
    if (v && start < 0) start = i;
    if (!v && start >= 0) {
      out.push([start, i]);
      start = -1;
    }
  });
  if (start >= 0) out.push([start, visible.length]);
  return out;
}

// Renderiza la linea de tiempo en `container`.
// eph, horizon: JSON de data/public. startUtc: fecha elegida (ISO 8601 UTC).
export function renderTimeline(container, eph, horizon, startUtc, days = 7) {
  const step = eph.time.step_s;
  const count = eph.time.count;
  const origin = Date.parse(eph.time.start_utc);
  const chosen = Date.parse(startUtc);

  // Indice de la primera muestra del dia elegido, limitado al rango disponible.
  let first = Math.floor((chosen - origin) / 1000 / step);
  first = Math.max(0, Math.min(first, count - 1));
  const last = Math.min(count, first + Math.round((days * DAY_S) / step));

  const series = visibilitySeries(eph, horizon);
  const rows = [
    { label: 'Sol', visible: series.sun.visible.slice(first, last) },
    { label: 'Tierra', visible: series.earth.visible.slice(first, last) },
  ];

  const width = 720;
  const labelW = 90;
  const rowH = 36;
  const plotW = width - labelW - 10;
  const height = rows.length * rowH + 30;
  const n = last - first;

  const svg = el('svg', {
    viewBox: `0 0 ${width} ${height}`,
    width: '100%',
    role: 'img',
    'aria-label': `Linea de tiempo de Sol y Tierra, ${days} dias desde ${startUtc}`,
  });

  rows.forEach((row, r) => {
    const y = r * rowH;
    svg.appendChild(el('text', { x: 0, y: y + rowH / 2 + 5, 'font-size': 14 }, row.label));
    svg.appendChild(el('rect', {
      x: labelW, y: y + 6, width: plotW, height: rowH - 12, fill: '#eef1f5',
    }));
    for (const [a, b] of runs(row.visible)) {
      svg.appendChild(el('rect', {
        x: labelW + (a / n) * plotW,
        y: y + 6,
        width: ((b - a) / n) * plotW,
        height: rowH - 12,
        fill: row.label === 'Sol' ? '#f2b705' : '#2f7fc1',
      }));
    }
  });

  // Marcas de dia UTC.
  const axisY = rows.length * rowH + 4;
  for (let i = first; i < last; i++) {
    const t = origin + i * step * 1000;
    const isMidnight = t % (DAY_S * 1000) === 0 || i === first;
    if (!isMidnight) continue;
    const x = labelW + ((i - first) / n) * plotW;
    const date = new Date(t).toISOString().slice(5, 10); // MM-DD
    svg.appendChild(el('line', { x1: x, x2: x, y1: 0, y2: axisY, stroke: '#c5ccd6' }));
    svg.appendChild(el('text', { x, y: axisY + 16, 'font-size': 12 }, date));
  }

  container.replaceChildren(svg);

  const note = document.createElement('p');
  note.textContent = horizon.dem
    ? ''
    : 'Horizonte ideal, sin relieve.';
  container.appendChild(note);
}
