// Hoja de datos del cajón "Más información" (rediseño #99; antes panel de números C1-03).
// Uso: renderPanel(contenedor, { ephemeris, horizon, utcMs, siteName, coords }).
// Todo en tablas, sin gráficos ni emojis: posición ahora (Sol y Tierra lado a lado), horas con
// visibilidad desde la fecha elegida y resumen del período completo. Los estados se calculan
// contra horizon.json (#32) con la regla del contrato; las horas, con visibilitySeries.
import './panel.css';
import { sampleAt, compassLabel, nextVisibilityChange } from './ephemeris.js';
import { horizonAt, statusAgainstHorizon } from './horizon.js';
import { visibilitySeries } from './visibility.js';
import { windowHours, periodSummary } from './info-core.js';
import { t, locale } from './i18n.js';

const BODIES = ['sun', 'earth'];
let timer = null;

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

const num = (value, decimals) => {
  const rounded = Number(value.toFixed(decimals));
  return (rounded === 0 ? 0 : rounded).toLocaleString(locale, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
};
const signedDeg = (v, d = 2) => `${v > 0 && Number(v.toFixed(d)) !== 0 ? '+' : ''}${num(v, d)}°`;
const pct = (part, total) => `${num(total ? (100 * part) / total : 0, 1)} %`;
const fmtUtc = (ms) => `${new Date(ms).toISOString().slice(0, 16).replace('T', ' ')} UTC`;
const pad = (n) => String(n).padStart(2, '0');

function duration(hours) {
  const d = Math.floor(hours / 24);
  const h = Math.round(hours % 24);
  return d > 0 ? t('info.dh', { d, h }) : t('info.h', { h });
}

function clock(ms) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const d = Math.floor(total / 86400);
  const rest = `${pad(Math.floor((total % 86400) / 3600))}:${pad(Math.floor((total % 3600) / 60))}:${pad(total % 60)}`;
  return d > 0 ? `${d} d ${rest}` : rest;
}

/** Tabla con encabezado; `rows` = [[th, ...celdas]], cada celda texto o { text, className }. */
function table(caption, head, rows, className = '') {
  const tbl = el('table', `info-table ${className}`.trim());
  tbl.append(el('caption', 'info-table__caption', caption));
  const thead = el('thead');
  const hr = el('tr');
  head.forEach((h, i) => {
    const th = el('th', i === 0 ? 'info-table__key' : '', h);
    th.scope = 'col';
    hr.append(th);
  });
  thead.append(hr);
  const tbody = el('tbody');
  for (const [key, ...cells] of rows) {
    const tr = el('tr');
    const th = el('th', 'info-table__key', key);
    th.scope = 'row';
    tr.append(th);
    for (const c of cells) {
      const td = el('td', c?.className ?? '', typeof c === 'object' && c !== null ? c.text : c);
      tr.append(td);
    }
    tbody.append(tr);
  }
  tbl.append(thead, tbody);
  return tbl;
}

/** Detiene la cuenta regresiva en marcha. */
function stopTimer() {
  if (timer !== null) clearInterval(timer);
  timer = null;
}

/** Limpia la hoja (cuando no hay datos que mostrar). */
export function clearPanel(container) {
  stopTimer();
  container.replaceChildren();
}

export function renderPanel(container, { ephemeris, horizon, utcMs, siteName, coords }) {
  stopTimer();
  container.replaceChildren();
  container.classList.add('info');

  const sample = sampleAt(ephemeris, utcMs);
  if (!sample) {
    container.append(el('p', 'info-empty', t('panel.noData')));
    return;
  }
  const radius = ephemeris.angular_radius_deg;
  const horizonFn = (az) => horizonAt(horizon, az);

  // Encabezado: sitio, coordenadas e instante
  const header = el('header', 'info-head');
  const meta = [];
  if (coords) {
    meta.push(t('info.coords', { lat: num(coords.lat, 4), lon: num(coords.lon, 4) }));
  }
  meta.push(fmtUtc(sample.utcMs));
  header.append(el('h2', 'info-head__site', siteName), el('p', 'info-head__meta', meta.join(' · ')));

  // 1) Posición ahora
  const changes = Object.fromEntries(BODIES.map((b) => [b, nextVisibilityChange(ephemeris, sample.utcMs, b, horizonFn)]));
  const row = (key, fn) => [t(key), ...BODIES.map(fn)];
  const position = table(t('info.now'), ['', t('panel.sun'), t('panel.earth')], [
    row('info.azimuth', (b) => `${num(sample[b].azimuth_deg, 2)}° ${t(`compass.${compassLabel(sample[b].azimuth_deg)}`)}`),
    row('info.elevation', (b) => signedDeg(sample[b].elevation_deg)),
    row('info.state', (b) => {
      const s = statusAgainstHorizon(sample[b], radius[b], horizon);
      return { text: t(`panel.status.${s}`), className: `info-state info-state--${s}` };
    }),
    row('info.next', (b) => {
      const c = changes[b];
      if (!c?.event) return t('info.noChange');
      return `${t(c.event === 'sets' ? 'info.sets' : 'info.rises')} · ${fmtUtc(c.crossMs)}`;
    }),
    row('info.countdown', (b) => ({ text: changes[b]?.event ? '' : '—', className: 'info-num info-countdown' })),
    row('info.radius', (b) => `${num(radius[b], 2)}°`),
  ], 'info-table--bodies');

  // 2) Horas con visibilidad desde la fecha elegida
  const series = visibilitySeries(ephemeris, horizon);
  const vis = { sun: series.sun.visible, earth: series.earth.visible };
  const windows = [[24, 'info.next24h'], [24 * 7, 'info.next7d'], [24 * 30, 'info.next30d']].map(([hours, key]) => {
    const w = windowHours(vis, sample.index, hours);
    const cell = (n) => ({ text: `${n} h`, className: 'info-num' });
    return [t(key), cell(w.sun), cell(w.earth), cell(w.both)];
  });
  const windowsTable = table(t('info.windows'), ['', t('panel.sun'), t('panel.earth'), t('info.both')], windows);

  // 3) Resumen del período completo de datos
  const sum = periodSummary(vis);
  const first = Date.parse(ephemeris.time.start_utc);
  const last = first + (ephemeris.time.count - 1) * ephemeris.time.step_s * 1000;
  const hp = (n) => ({ text: `${n} h · ${pct(n, sum.samples)}`, className: 'info-num' });
  const summary = table(
    t('info.period', { from: fmtUtc(first).slice(0, 10), to: fmtUtc(last).slice(0, 10), hours: sum.samples }),
    ['', t('info.value')],
    [
      [t('info.sunVisible'), hp(sum.sun)],
      [t('info.earthVisible'), hp(sum.earth)],
      [t('info.bothVisible'), hp(sum.both)],
      [t('info.noneVisible'), hp(sum.none)],
      [t('info.longestNoSun'), { text: duration(sum.longestNoSun), className: 'info-num' }],
      [t('info.longestNoEarth'), { text: duration(sum.longestNoEarth), className: 'info-num' }],
      [t('info.longestNoBoth'), { text: duration(sum.longestNoBoth), className: 'info-num' }],
    ],
  );

  const note = el('p', 'info-note', t('info.note'));
  container.append(header, position, windowsTable, summary, note);

  // Cuenta regresiva en vivo (fila 5 de la primera tabla): parte del instante elegido y avanza
  // con el reloj real.
  const countdownRow = position.tBodies[0].rows[4];
  const cells = BODIES.map((b, i) => (changes[b]?.event ? { td: countdownRow.cells[i + 1], crossMs: changes[b].crossMs } : null))
    .filter(Boolean);
  const startedAt = Date.now();
  const tick = () => {
    const now = sample.utcMs + (Date.now() - startedAt);
    for (const c of cells) c.td.textContent = clock(c.crossMs - now);
  };
  tick();
  if (cells.length) timer = setInterval(tick, 1000);
}
