// Card de cuenta regresiva (C3-04): tiempo hasta que el Sol y la Tierra se oculten (o salgan).
// El contador corre en vivo: parte del instante elegido (utcMs) y avanza con el reloj real, 1 s por segundo.
// Los datos son horarios; el cruce se estima por interpolación lineal (ver nextVisibilityChange).
import './countdown.css';
import { nextVisibilityChange } from './ephemeris.js';
import { horizonAt } from './horizon.js';
import { t, locale } from './i18n.js';

const BODIES = [
  { key: 'sun', label: 'panel.sun', icon: '☀️' },
  { key: 'earth', label: 'panel.earth', icon: '🌍' },
];

let timer = null;

/** Detiene el contador en marcha (llamar al limpiar el panel). */
export function stopCountdown() {
  if (timer !== null) {
    clearInterval(timer);
    timer = null;
  }
}

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

const pad = (n) => String(n).padStart(2, '0');

/** Milisegundos a { d, h, m, s } (redondeando hacia abajo, nunca negativo). */
export function splitDuration(ms) {
  const total = Math.max(0, Math.floor(ms / 1000));
  return { d: Math.floor(total / 86400), h: Math.floor((total % 86400) / 3600), m: Math.floor((total % 3600) / 60), s: total % 60 };
}

const fmtUtcShort = (ms) =>
  `${new Date(ms).toLocaleString(locale, { timeZone: 'UTC', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })} UTC`;

function unit(value, caption) {
  const box = el('div', 'countdown-unit');
  const number = el('span', 'countdown-unit__value', value);
  box.append(number, el('span', 'countdown-unit__caption', caption));
  return { box, number };
}

// Una card por cuerpo: con el cuerpo visible cuenta lo que le queda; si no, cuánto falta para que salga.
function bodyCountdown(body, change) {
  const label = t(body.label);
  const card = el('section', `countdown countdown--${body.key}`);
  card.setAttribute('aria-label', t('countdown.aria', { body: label }));
  const hasEvent = change && change.event;
  const title = hasEvent
    ? change.event === 'sets'
      ? t(`countdown.${body.key}.visible`)
      : t(`countdown.${body.key}.hidden`)
    : label;
  const heading = el('h3', 'countdown__title', `${body.icon} ${title}`);
  card.append(heading);

  if (!hasEvent) {
    card.append(el('p', 'countdown__none', t(`countdown.${body.key}.${change?.visible ? 'noSet' : 'noRise'}`)));
    return { card, tick: null };
  }

  const units = {
    d: unit('0', t('countdown.days')),
    h: unit('00', t('countdown.hours')),
    m: unit('00', t('countdown.minutes')),
    s: unit('00', t('countdown.seconds')),
  };
  const digits = el('div', 'countdown-digits');
  digits.append(units.d.box, units.h.box, units.m.box, units.s.box);
  const totalHours = el('p', 'countdown__total');
  const eventName = change.event === 'sets' ? t('countdown.sets') : t('countdown.rises');
  const when = el('p', 'countdown__when', t('countdown.estimated', { event: eventName, time: fmtUtcShort(change.crossMs) }));
  card.append(digits, totalHours, when);

  const tick = (simNowMs) => {
    const left = change.crossMs - simNowMs;
    const { d, h, m, s } = splitDuration(left);
    units.d.number.textContent = String(d);
    units.h.number.textContent = pad(h);
    units.m.number.textContent = pad(m);
    units.s.number.textContent = pad(s);
    units.d.box.hidden = d === 0;
    const hours = (Math.max(0, left) / 3600000).toLocaleString(locale, { maximumFractionDigits: 1 });
    totalHours.textContent = t('countdown.totalHours', { hours });
    const done = left <= 0;
    card.classList.toggle('countdown--done', done);
    if (done) heading.textContent = `${body.icon} ${t(`countdown.${body.key}.${change.event === 'sets' ? 'setsNow' : 'risesNow'}`)}`;
    return !done;
  };
  return { card, tick };
}

/** Agrega las dos cards (Sol y Tierra) al contenedor y arranca los contadores. Reemplaza a los anteriores. */
export function renderCountdown(container, { ephemeris, horizon, utcMs }) {
  stopCountdown();
  // Con horizon.json se compara contra el horizonte real en la dirección del cuerpo (#32); sin él, 0°.
  const horizonDeg = horizon ? (az) => horizonAt(horizon, az) : 0;
  const grid = el('div', 'countdown-grid');
  const ticks = [];
  for (const body of BODIES) {
    const { card, tick } = bodyCountdown(body, nextVisibilityChange(ephemeris, utcMs, body.key, horizonDeg));
    grid.append(card);
    if (tick) ticks.push(tick);
  }
  container.append(grid, el('p', 'countdown__note', t('countdown.note')));

  const startedAt = Date.now();
  const update = () => {
    const simNow = utcMs + (Date.now() - startedAt);
    const running = ticks.map((tk) => tk(simNow)).some(Boolean);
    if (!running) stopCountdown();
  };
  update();
  if (ticks.length) timer = setInterval(update, 1000);
}
