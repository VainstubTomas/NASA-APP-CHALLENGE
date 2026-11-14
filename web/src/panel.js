// Panel de números (C1-03): elevación y azimut del Sol y la Tierra en un instante.
// Uso: renderPanel(contenedor, { ephemeris, horizon, utcMs, siteName }).
// El selector de sitio y fecha (C1-02) solo tiene que volver a llamar a renderPanel.
import './panel.css';
import { sampleAt, horizonStatus, compassLabel, elevationDisplay } from './ephemeris.js';
import { horizonAt } from './horizon.js';
import { t, locale } from './i18n.js';

const fmtDeg = (value, decimals) => {
  // Evita mostrar "-0,0°": si redondeado da cero, se muestra como cero.
  const rounded = Number(value.toFixed(decimals));
  const shown = rounded === 0 ? 0 : rounded;
  return `${shown.toLocaleString(locale, { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}°`;
};

const fmtUtc = (utcMs) =>
  `${new Date(utcMs).toLocaleString(locale, {
    timeZone: 'UTC',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })} UTC`;

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function bodyCard({ label, icon, position, radiusDeg, horizonDeg, featured }) {
  const state = horizonStatus(position.elevation_deg, radiusDeg, horizonDeg);
  const card = el('article', `panel-card${featured ? ' panel-card--featured' : ''}`);

  const title = el('h3', 'panel-card__title', `${icon} ${label}`);
  const status = el('span', `panel-status panel-status--${state}`, t(`panel.status.${state}`));
  title.append(' ', status);

  const shown = elevationDisplay(position.elevation_deg);
  const elevation = el('p', 'panel-card__elevation', fmtDeg(shown.value, 1));
  const elevationLabel = el('p', 'panel-card__caption', t(`panel.elevation.${shown.side}`));
  const azimuth = el(
    'p',
    'panel-card__azimuth',
    t('panel.azimuth', {
      direction: t(`compass.${compassLabel(position.azimuth_deg)}`),
      azimuth: fmtDeg(position.azimuth_deg, 0),
    }),
  );

  card.append(title, elevation, elevationLabel, azimuth);
  return card;
}

function horizonChart({ horizon, sample, radius }) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.classList.add('horizon-chart');
  svg.setAttribute('viewBox', '0 0 360 320');
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', 'Horizonte del sitio con el Sol y la Tierra');
  const cx = 180;
  const cy = 160;
  const horizonRadius = 76;
  const scale = 0.8;
  const point = (azimuth, elevation) => {
    const r = horizonRadius + elevation * scale;
    const angle = (azimuth - 90) * Math.PI / 180;
    return [cx + r * Math.cos(angle), cy + r * Math.sin(angle)];
  };
  const path = horizon.elevation_deg.map((elevation, index) => {
    const [x, y] = point(horizon.azimuth_start_deg + index * horizon.azimuth_step_deg, elevation);
    return `${index === 0 ? 'M' : 'L'}${x.toFixed(2)} ${y.toFixed(2)}`;
  }).join(' ') + ' Z';
  const horizonPath = document.createElementNS(svg.namespaceURI, 'path');
  horizonPath.setAttribute('d', path);
  horizonPath.classList.add('horizon-chart__line');
  svg.append(horizonPath);
  const horizonLabel = document.createElementNS(svg.namespaceURI, 'text');
  horizonLabel.setAttribute('x', cx);
  horizonLabel.setAttribute('y', cy + horizonRadius + 18);
  horizonLabel.classList.add('horizon-chart__label');
  horizonLabel.textContent = 'Horizonte 0°';
  svg.append(horizonLabel);

  for (const [label, azimuth] of [['N', 0], ['E', 90], ['S', 180], ['O', 270]]) {
    const [x, y] = point(azimuth, 0);
    const text = document.createElementNS(svg.namespaceURI, 'text');
    text.setAttribute('x', x);
    text.setAttribute('y', y);
    text.classList.add('horizon-chart__direction');
    text.textContent = label;
    svg.append(text);
  }

  for (const [body, label, className] of [['sun', 'Sol', 'sun'], ['earth', 'Tierra', 'earth']]) {
    const position = sample[body];
    const bodyHorizon = horizonAt(horizon, position.azimuth_deg);
    const [x, y] = point(position.azimuth_deg, position.elevation_deg);
    const circle = document.createElementNS(svg.namespaceURI, 'circle');
    circle.setAttribute('cx', x);
    circle.setAttribute('cy', y);
    circle.setAttribute('r', Math.max(3, radius[body] * 8));
    circle.classList.add(`horizon-chart__body--${className}`);
    circle.setAttribute('aria-label', `${label}: ${position.elevation_deg}°, horizonte ${bodyHorizon}°`);
    svg.append(circle);
    const bodyLabel = document.createElementNS(svg.namespaceURI, 'text');
    bodyLabel.setAttribute('x', x + 8);
    bodyLabel.setAttribute('y', y - 8);
    bodyLabel.classList.add(`horizon-chart__body-label--${className}`);
    bodyLabel.textContent = label;
    svg.append(bodyLabel);
  }
  return svg;
}

export function renderPanel(container, { ephemeris, horizon, utcMs, siteName }) {
  container.replaceChildren();
  container.classList.add('panel');

  const sample = sampleAt(ephemeris, utcMs);
  if (!sample) {
    container.append(el('p', 'panel-empty', t('panel.noData')));
    return;
  }

  const header = el('header', 'panel-header');
  header.append(el('h2', 'panel-header__site', siteName), el('p', 'panel-header__time', fmtUtc(sample.utcMs)));

  const radius = ephemeris.angular_radius_deg;
  const sunHorizon = horizonAt(horizon, sample.sun.azimuth_deg);
  const earthHorizon = horizonAt(horizon, sample.earth.azimuth_deg);
  container.append(header, horizonChart({ horizon, sample, radius }));
  const cards = el('div', 'panel-cards');
  cards.append(
    bodyCard({ label: t('panel.sun'), icon: '☀️', position: sample.sun, radiusDeg: radius.sun, horizonDeg: sunHorizon, featured: true }),
    bodyCard({ label: t('panel.earth'), icon: '🌍', position: sample.earth, radiusDeg: radius.earth, horizonDeg: earthHorizon }),
  );

  const note = el(
    'p',
    'panel-note',
    horizon.dem ? 'Perfil de horizonte del sitio. La visibilidad usa el borde superior de cada disco.' : t('panel.note'),
  );

  container.append(cards, note);
}
