// Brújula + regla de elevación (#30): dónde mirar (rumbo) y a qué altura (elevación).
// Los ángulos vienen de sampleAt (Horizons); aquí solo se dibujan, no se recalculan.
import { compassLabel } from './ephemeris.js';
import { horizonAt, statusAgainstHorizon } from './horizon.js';
import { t } from './i18n.js';
import { sunIcon, earthIcon, moonIcon } from './icons.js';
import { COMPASS, RULER, compassPoint, rulerY, rulerRadius } from './dials-core.js';

const NS = 'http://www.w3.org/2000/svg';

function node(tag, attrs = {}, className, text) {
  const n = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
  if (className) n.setAttribute('class', className);
  if (text !== undefined) n.textContent = text;
  return n;
}

function root(width, height, title) {
  const svg = node('svg', { viewBox: `0 0 ${width} ${height}`, role: 'img', 'aria-label': title }, 'dial');
  svg.append(node('title', {}, undefined, title));
  return svg;
}

// Posiciones fijas (fracciones del cielo / de la superficie) para que el fondo no cambie entre dibujos.
const STARS = [[0.08, 0.1], [0.22, 0.45], [0.35, 0.08], [0.5, 0.3], [0.63, 0.12], [0.74, 0.5], [0.88, 0.2], [0.95, 0.62], [0.15, 0.78], [0.45, 0.7], [0.8, 0.85], [0.58, 0.9]];
const CRATERS = [[0.14, 0.45, 15], [0.42, 0.7, 9], [0.62, 0.35, 12], [0.86, 0.6, 17]];

const BODIES = [
  { body: 'sun', icon: sunIcon },
  { body: 'earth', icon: earthIcon },
];

export function compassChart({ sample, radius, horizon }) {
  const { size, cx, cy, radius: r } = COMPASS;
  const svg = root(size, size, t('dial.compassTitle'));
  svg.append(node('circle', { cx, cy, r }, 'dial__ring'));

  for (let az = 0; az < 360; az += 30) {
    const major = az % 90 === 0;
    const [x1, y1] = compassPoint(az, r);
    const [x2, y2] = compassPoint(az, r - (major ? 9 : 5));
    svg.append(node('line', { x1, y1, x2, y2 }, major ? 'dial__tick dial__tick--major' : 'dial__tick'));
  }
  for (const [label, az] of [['N', 0], ['E', 90], ['S', 180], ['W', 270]]) {
    const [x, y] = compassPoint(az, r + 27);
    svg.append(node('text', { x, y }, `dial__cardinal${az === 0 ? ' dial__cardinal--north' : ''}`, t(`compass.${label}`)));
  }

  // El centro de la brújula es el sitio de aterrizaje, sobre la Luna.
  const moon = moonIcon(20);
  moon.setAttribute('x', cx - 10);
  moon.setAttribute('y', cy - 10);
  svg.append(moon);
  svg.append(node('text', { x: cx, y: cy + 20 }, 'dial__you', t('dial.you')));

  for (const { body, icon } of BODIES) {
    const position = sample[body];
    const state = statusAgainstHorizon(position, radius[body], horizon);
    const group = node('g', {}, `dial__body dial__body--${body} dial__body--${state}`);
    const [x, y] = compassPoint(position.azimuth_deg, r);
    group.append(node('line', { x1: cx, y1: cy, x2: x, y2: y }, 'dial__needle'));
    group.append(node('circle', { cx: x, cy: y, r: 13 }, 'dial__badge'));
    const glyph = icon(18);
    glyph.setAttribute('x', x - 9);
    glyph.setAttribute('y', y - 9);
    group.append(glyph);
    // Nombre y rumbo dentro del dial, del lado del centro, para que no se salgan del dibujo.
    const [lx, ly] = compassPoint(position.azimuth_deg, r - 42);
    const bearing = `${t(`panel.${body}`)} ${t(`compass.${compassLabel(position.azimuth_deg)}`)}`;
    group.append(node('text', { x: lx, y: ly }, 'dial__bearing', bearing));
    svg.append(group);
  }
  return svg;
}

export function elevationRuler({ sample, radius, horizon }) {
  const { width, height, y0 } = RULER;
  const svg = root(width, height, t('dial.rulerTitle'));
  const xAxis = 44;
  const span = width - xAxis;

  // Cielo negro con estrellas y, abajo, la superficie de la Luna con cráteres.
  const defs = node('defs');
  const sky = node('linearGradient', { id: 'dial-sky', x1: 0, y1: 0, x2: 0, y2: 1 });
  sky.append(node('stop', { offset: '0', 'stop-color': '#04060d' }), node('stop', { offset: '1', 'stop-color': '#1b2549' }));
  const ground = node('linearGradient', { id: 'dial-ground', x1: 0, y1: 0, x2: 0, y2: 1 });
  ground.append(node('stop', { offset: '0', 'stop-color': '#a3a6ad' }), node('stop', { offset: '1', 'stop-color': '#5d6068' }));
  defs.append(sky, ground);
  svg.append(defs);
  svg.append(node('rect', { x: xAxis, y: 0, width: span, height: y0 }, 'dial__sky'));
  for (const [fx, fy] of STARS) {
    svg.append(node('circle', { cx: xAxis + fx * span, cy: RULER.yTop + fy * (y0 - RULER.yTop), r: 0.9 }, 'dial__star'));
  }
  svg.append(node('rect', { x: xAxis, y: y0, width: span, height: height - y0 }, 'dial__surface'));
  for (const [fx, fy, rx] of CRATERS) {
    const cx = xAxis + fx * span;
    const cy = y0 + fy * (height - y0);
    svg.append(node('ellipse', { cx, cy, rx, ry: rx * 0.35 }, 'dial__crater'));
    svg.append(node('ellipse', { cx, cy: cy - 1, rx: rx * 0.8, ry: rx * 0.25 }, 'dial__crater-rim'));
  }

  for (let el = 0; el <= 90; el += 15) {
    const y = rulerY(el);
    svg.append(node('line', { x1: xAxis - 6, y1: y, x2: width, y2: y }, el === 0 ? 'dial__tick dial__tick--major' : 'dial__grid'));
    svg.append(node('text', { x: xAxis - 10, y }, 'dial__scale', `${el}°`));
  }
  svg.append(node('line', { x1: xAxis, y1: RULER.yTop, x2: xAxis, y2: y0 }, 'dial__tick dial__tick--major'));
  svg.append(node('text', { x: width - 4, y: rulerY(90) + 12 }, 'dial__edge-label', t('dial.zenith')));
  svg.append(node('text', { x: width - 4, y: y0 - 6 }, 'dial__edge-label', t('dial.horizon')));
  svg.append(node('text', { x: width - 4, y: height - 8 }, 'dial__edge-label', t('dial.surface')));

  BODIES.forEach(({ body, icon }, i) => {
    const position = sample[body];
    const state = statusAgainstHorizon(position, radius[body], horizon);
    const x = xAxis + 44 + i * 64;
    const y = rulerY(position.elevation_deg);
    const group = node('g', {}, `dial__body dial__body--${body} dial__body--${state}`);
    // Horizonte en la dirección de este cuerpo: con Luna lisa coincide con 0°.
    const hy = rulerY(horizon ? horizonAt(horizon, position.azimuth_deg) : 0);
    group.append(node('line', { x1: x - 26, y1: hy, x2: x + 26, y2: hy }, 'dial__skyline'));
    group.append(node('line', { x1: x, y1: y0, x2: x, y2: y }, 'dial__needle'));
    const r = rulerRadius(radius[body]) + 6;
    group.append(node('circle', { cx: x, cy: y, r }, 'dial__badge'));
    const glyph = icon(20);
    glyph.setAttribute('x', x - 10);
    glyph.setAttribute('y', y - 10);
    group.append(glyph);
    group.append(node('text', { x: x + r + 4, y }, 'dial__name', t(`panel.${body}`)));
    svg.append(group);
  });
  return svg;
}
