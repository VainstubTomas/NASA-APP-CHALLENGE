// Panel de números (C1-03): elevación y azimut del Sol y la Tierra en un instante.
// Uso: renderPanel(contenedor, { ephemeris, utcMs, siteName }).
// El selector de sitio y fecha (C1-02) solo tiene que volver a llamar a renderPanel.
import './panel.css';
import { sampleAt, horizonStatus, compassLabel, elevationDisplay } from './ephemeris.js';
import { t, locale } from './i18n.js';
import { sunIcon, earthIcon } from './icons.js';

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

function bodyCard({ body, icon, position, radiusDeg, featured }) {
  const state = horizonStatus(position.elevation_deg, radiusDeg);
  const card = el('article', `panel-card panel-card--${body}${featured ? ' panel-card--featured' : ''}`);

  const title = el('h3', 'panel-card__title');
  const status = el('span', `panel-status panel-status--${state}`, t(`panel.status.${state}`));
  title.append(icon, t(`panel.${body}`), status);
  // Para qué sirve este cuerpo: el Sol da energía, la Tierra comunicación (#38).
  const why = el('p', 'panel-card__why', t(`panel.${body}.why`));

  // Sin signo menos: el texto dice de qué lado del horizonte está ("42,6° bajo el horizonte").
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

  card.append(title, why, elevation, elevationLabel, azimuth);
  return card;
}

export function renderPanel(container, { ephemeris, utcMs, siteName }) {
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
  const cards = el('div', 'panel-cards');
  cards.append(
    bodyCard({ body: 'sun', icon: sunIcon(), position: sample.sun, radiusDeg: radius.sun, featured: true }),
    bodyCard({ body: 'earth', icon: earthIcon(), position: sample.earth, radiusDeg: radius.earth }),
  );

  const note = el('p', 'panel-note', t('panel.note'));

  container.append(header, cards, note);
}
