// Reproductor de tiempo (C3-02): botones, play y deslizador que mueven el instante `t`
// del selector. Toda la lógica de pasos y límites está en player-core.js (con tests).
import './player.css';
import { t } from './i18n.js';
import { HOUR_MS, formatT } from './state.js';
import {
  DAY_MS, SPEEDS, stepTime, nextPlayTime, canStepBack, canStepForward, timeToSlider, sliderToTime,
} from './player-core.js';

const TICK_MS = 1000; // el play avanza una vez por segundo

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

/**
 * @param container   elemento donde se dibuja el reproductor
 * @param selector    lo que devuelve initSelector: { range, getState, setTime }
 * @returns {{ sync(tMs: number): void, pause(): void }} sync se llama cada vez que cambia el instante
 */
export function initPlayer(container, { range, getState, setTime }) {
  const { minMs, maxMs } = range;
  let timer = null;
  let speed = 'hour';

  const button = (labelKey, deltaMs) => {
    const b = el('button', 'player__btn', t(labelKey));
    b.type = 'button';
    b.addEventListener('click', () => {
      pause();
      setTime(stepTime(getState().t, deltaMs, minMs, maxMs));
    });
    return b;
  };

  const back1d = button('player.back1d', -DAY_MS);
  const back1h = button('player.back1h', -HOUR_MS);
  const fwd1h = button('player.fwd1h', HOUR_MS);
  const fwd1d = button('player.fwd1d', DAY_MS);

  const play = el('button', 'player__btn player__btn--play');
  play.type = 'button';

  const slider = el('input', 'player__slider');
  slider.type = 'range';
  slider.min = '0';
  slider.max = String(timeToSlider(maxMs, minMs));
  slider.step = '1';
  slider.setAttribute('aria-label', t('player.slider'));

  const speedSelect = el('select', 'player__speed');
  speedSelect.setAttribute('aria-label', t('player.speed'));
  for (const key of Object.keys(SPEEDS)) {
    const opt = el('option', '', t(`player.speed.${key}`));
    opt.value = key;
    speedSelect.appendChild(opt);
  }

  const status = el('p', 'player__status');
  status.setAttribute('role', 'status');

  const buttons = el('div', 'player__buttons');
  buttons.append(back1d, back1h, play, fwd1h, fwd1d);
  const speedRow = el('label', 'player__speed-row');
  speedRow.append(el('span', '', t('player.speed')), speedSelect);

  container.replaceChildren(el('h2', 'player__title', t('player.title')), buttons, slider, speedRow, status);

  function renderPlayButton() {
    const playing = timer !== null;
    play.textContent = t(playing ? 'player.pause' : 'player.play');
    play.setAttribute('aria-pressed', String(playing));
  }

  function pause() {
    if (timer !== null) clearInterval(timer);
    timer = null;
    renderPlayButton();
  }

  function start() {
    status.textContent = '';
    if (getState().t >= maxMs) {
      status.textContent = t('player.end');
      return;
    }
    timer = setInterval(() => {
      const next = nextPlayTime(getState().t, SPEEDS[speed], maxMs);
      setTime(next.t);
      if (next.done) {
        pause();
        status.textContent = t('player.end');
      }
    }, TICK_MS);
    renderPlayButton();
  }

  play.addEventListener('click', () => (timer === null ? start() : pause()));
  speedSelect.addEventListener('change', () => {
    speed = speedSelect.value;
  });
  slider.addEventListener('input', () => {
    pause();
    status.textContent = '';
    setTime(sliderToTime(slider.value, minMs, maxMs));
  });
  // Una pestaña oculta no debe seguir avanzando sola.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) pause();
  });

  function sync(tMs) {
    slider.value = String(timeToSlider(tMs, minMs));
    slider.setAttribute('aria-valuetext', formatT(tMs));
    back1d.disabled = back1h.disabled = !canStepBack(tMs, minMs);
    fwd1h.disabled = fwd1d.disabled = !canStepForward(tMs, maxMs);
  }

  renderPlayButton();
  sync(getState().t);
  return { sync, pause };
}
