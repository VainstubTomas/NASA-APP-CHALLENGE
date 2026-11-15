// Panel de números (C1-03): elevación y azimut del Sol y la Tierra en un instante.
// Uso: renderPanel(contenedor, { ephemeris, horizon, utcMs, siteName }).
// Con `horizon` (horizon.json) los estados se calculan contra el horizonte real (#32).
// El selector de sitio y fecha (C1-02) solo tiene que volver a llamar a renderPanel.
import './panel.css';
import { sampleAt, compassLabel, elevationDisplay } from './ephemeris.js';
import { statusAgainstHorizon } from './horizon.js';
import { t, locale } from './i18n.js';
import { sunIcon, earthIcon } from './icons.js';
import { compassChart, elevationRuler } from './dials.js';
import { renderCountdown, stopCountdown } from './countdown.js';

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

function bodyCard({ body, icon, position, radiusDeg, horizon, featured }) {
  const state = statusAgainstHorizon(position, radiusDeg, horizon);
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

// Un solo visor 3D para toda la sesión (un solo contexto WebGL); null si no se pudo crear.
let viewer = null;
let viewerPromise = null;
function loadViewer() {
  viewerPromise ??= import('./scene3d.js')
    .then((m) => {
      viewer = m.createViewer();
      return viewer;
    })
    .catch((error) => {
      console.warn('Vista 3D no disponible, se usa la brújula y la regla en 2D:', error);
      return null;
    });
  return viewerPromise;
}

/** Limpia el panel y detiene el contador (cuando no hay datos que mostrar). */
export function clearPanel(container) {
  stopCountdown();
  container.replaceChildren();
}

export function renderPanel(container, { ephemeris, horizon, utcMs, siteName }) {
  stopCountdown();
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
  const dials = el('div', 'panel-dials');
  const figure = (chart, caption) => {
    const fig = el('figure', 'panel-dial');
    fig.append(chart, el('figcaption', 'panel-dial__caption', caption));
    return fig;
  };
  dials.append(
    figure(compassChart({ sample, radius, horizon }), t('dial.compassSub')),
    figure(elevationRuler({ sample, radius, horizon }), t('dial.rulerSub')),
  );
  const hint = el('p', 'panel-hint', t('dial.hint'));

  // Vista 3D (three.js, carga diferida). Mientras carga, o si el navegador no tiene WebGL,
  // queda la brújula + regla en 2D.
  const data = { sample, radius, horizon };
  if (viewer) {
    dials.replaceChildren(viewer.element);
    hint.textContent = t('view3d.hint');
    viewer.update(data);
  } else {
    loadViewer().then((v) => {
      if (v && dials.isConnected) {
        dials.replaceChildren(v.element);
        hint.textContent = t('view3d.hint');
        v.update(data);
      }
    });
  }

  const cards = el('div', 'panel-cards');
  cards.append(
    bodyCard({ body: 'sun', icon: sunIcon(), position: sample.sun, radiusDeg: radius.sun, horizon, featured: true }),
    bodyCard({ body: 'earth', icon: earthIcon(), position: sample.earth, radiusDeg: radius.earth, horizon }),
  );

  const note = el('p', 'panel-note', t('panel.note'));

  container.append(header, dials, hint, cards);
  renderCountdown(container, { ephemeris, horizon, utcMs: sample.utcMs });
  container.append(note);
}
