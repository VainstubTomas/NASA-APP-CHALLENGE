// Vista del cielo (rediseño #99, Figma "frame1"): la pantalla principal de la web.
// Una cámara parada en el sitio mira hacia un rumbo; el Sol y la Tierra se dibujan en su azimut
// y elevación reales (JPL Horizons) y con su tamaño angular real. La línea magenta es el horizonte
// y funciona como brújula: al girar se mueve. Arriba a la izquierda, el deslizador de fecha;
// arriba a la derecha, la cuenta regresiva y los botones "Ver Sol" / "Ver Tierra"; abajo a la
// izquierda, el horizonte completo de 360°. Al pasar el mouse por un cuerpo aparece su brillo,
// la línea punteada al horizonte y los grados sobre el horizonte.
// La lógica (proyección, brújula, rangos) está en sky-core.js, probada con `npm test`.
import './sky.css';
import sunImg from './assets/sky/sun.png';
import earthImg from './assets/sky/earth.png';
import groundImg from './assets/sky/ground.png';
import logoImg from './assets/sky/logo.svg';
import searchIcon from './assets/sky/search.svg';
import chevronIcon from './assets/sky/chevron-left.svg';
import { t, locale } from './i18n.js';
import { sampleAt, nextVisibilityChange, elevationDisplay, compassLabel } from './ephemeris.js';
import { horizonAt } from './horizon.js';
import { timeToSlider, sliderToTime } from './player-core.js';
import { initSkyPanel } from './sky-panel.js';
import {
  FOV_DEG, ROTATE_STEP_DEG, TILT_STEP_DEG, TILT_MAX_DEG,
  normAz, relAz, rotate, tiltUp, tiltDown, clampTilt, pxPerDeg, project, discRadiusPx,
  compassTicks, shortDuration, chartRange, initialHeading,
} from './sky-core.js';

const SVG_NS = 'http://www.w3.org/2000/svg';
// Altura del horizonte en la pantalla (fracción del alto), como en el Figma: 1082 / 1346.
const HORIZON_FRACTION = 0.8;
// Qué parte del recorte de cada imagen ocupa el disco (medido sobre el Figma).
const SUN_DISC_FRACTION = 0.75;
const EARTH_DISC_FRACTION = 0.89;
// Un arrastre menor a esto es un clic (fija o suelta el detalle del cuerpo).
const CLICK_SLOP_PX = 4;

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function svg(tag, attrs = {}, parent) {
  const node = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
  parent?.appendChild(node);
  return node;
}

function iconButton(className, icon, label) {
  const b = el('button', `sky-btn ${className}`);
  b.type = 'button';
  b.setAttribute('aria-label', label);
  b.title = label;
  const img = el('img');
  img.src = icon;
  img.alt = '';
  b.append(img);
  return b;
}

const fmt1 = (x) => x.toLocaleString(locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const fmtUtc = (ms) => `${new Date(ms).toISOString().slice(0, 16).replace('T', ' ')} UTC`;
const bodyName = (key) => t(key === 'sun' ? 'panel.sun' : 'panel.earth');

// Un cuerpo: brillo (al pasar el mouse) y disco recortado como en el Figma; nombre arriba;
// contorno si está bajo el horizonte; línea al horizonte y grados (al pasar el mouse).
function createBody(key) {
  const disc = el('div', `sky-body sky-body--${key}`);
  const glow = el('div', 'sky-body__glow');
  const crop = el('div', 'sky-body__crop');
  const img = el('img', 'sky-body__img');
  img.src = key === 'sun' ? sunImg : earthImg;
  img.alt = '';
  crop.append(img);
  disc.append(glow, crop);
  const ghost = el('div', `sky-ghost sky-ghost--${key}`);
  const name = el('p', `sky-name sky-name--${key}`, bodyName(key));
  const stem = el('div', `sky-stem sky-stem--${key}`);
  const label = el('p', `sky-label sky-label--${key}`);
  return { key, disc, ghost, name, stem, label };
}

/**
 * Arma la vista dentro de `root` (la sección #sky de index.html, que ya trae el panel de búsqueda).
 * @param {object} opts
 * @param {{minMs:number, maxMs:number}} opts.range rango de fechas del selector
 * @param {(ms:number) => void} opts.onTime el deslizador pide un instante nuevo
 * @param {() => void} [opts.onUserInput] la persona tocó la fecha (pausar el reproductor)
 * @param {HTMLElement} [opts.drawer] cajón "Más información" (Figma frame 2)
 * @param {boolean} [opts.liveEnabled] hay API en vivo (ubicación específica)
 */
export function initSky(root, { range, onTime, onUserInput, drawer, liveEnabled = false }) {
  const panelEl = root.querySelector('#sky-panel');

  // --- Escenario: cielo, suelo, horizonte ---
  const stage = el('div', 'sky-stage');
  const air = el('div', 'sky-air'); // recorta los discos en el horizonte
  const ground = el('div', 'sky-ground');
  ground.style.backgroundImage = `url("${groundImg}")`;
  const horizon = el('div', 'sky-horizon');
  const ticks = el('div', 'sky-ticks');
  const overlay = el('div', 'sky-overlay');
  const headingLabel = el('p', 'sky-heading');
  const headingName = el('span', 'sky-heading__name');
  const headingDeg = el('span', 'sky-heading__deg');
  headingLabel.append(headingName, headingDeg);
  const smooth = el('p', 'sky-smooth', `⚠ ${t('sky.smooth')}`);
  const scaleNote = el('p', 'sky-scale', t('sky.scale', { fov: FOV_DEG }));
  const sun = createBody('sun');
  const earth = createBody('earth');
  const bodies = [earth, sun];
  air.append(earth.disc, sun.disc);
  overlay.append(earth.ghost, sun.ghost, earth.stem, sun.stem, earth.name, sun.name, earth.label, sun.label);

  const left = iconButton('sky-btn--left', chevronIcon, t('sky.left'));
  const right = iconButton('sky-btn--right', chevronIcon, t('sky.right'));
  const up = iconButton('sky-btn--up', chevronIcon, t('sky.up', { step: TILT_STEP_DEG }));
  const down = iconButton('sky-btn--down', chevronIcon, t('sky.down', { step: TILT_STEP_DEG }));

  stage.append(air, ground, horizon, ticks, headingLabel, smooth, scaleNote, overlay, left, right, up, down);

  // --- Arriba a la izquierda: logo, búsqueda y fecha ---
  const topLeft = el('div', 'sky-topleft');
  const logo = el('img', 'sky-logo');
  logo.src = logoImg;
  logo.alt = t('sky.logo');
  const search = el('button', 'sky-search');
  search.type = 'button';
  search.setAttribute('aria-expanded', 'false');
  search.setAttribute('aria-controls', 'sky-panel');
  const searchImg = el('img');
  searchImg.src = searchIcon;
  searchImg.alt = '';
  search.append(searchImg, el('span', 'sky-search__text', t('sky.search')));
  const brandRow = el('div', 'sky-brand');
  brandRow.append(logo, search);

  const time = el('div', 'sky-time');
  const timeLabel = el('label', 'sky-time__label');
  timeLabel.htmlFor = 'sky-slider';
  const slider = el('input', 'sky-time__slider');
  slider.id = 'sky-slider';
  slider.type = 'range';
  slider.min = '0';
  slider.max = String(timeToSlider(range.maxMs, range.minMs));
  slider.step = '1';
  const when = el('p', 'sky-time__when');
  time.append(timeLabel, slider, when);
  topLeft.append(brandRow, time);

  // --- Arriba a la derecha: cuenta regresiva y botones fijos para mirar al Sol o a la Tierra ---
  const topRight = el('div', 'sky-topright');
  const countdown = el('div', 'sky-countdown');
  countdown.setAttribute('role', 'status');
  const seeRow = el('div', 'sky-see');
  const seeButtons = {};
  for (const key of ['sun', 'earth']) {
    const b = el('button', `sky-see__btn sky-see__btn--${key}`);
    b.type = 'button';
    b.append(el('span', 'sky-see__dot'), el('span', 'sky-see__text', t('sky.see', { body: bodyName(key) })));
    seeButtons[key] = b;
    seeRow.append(b);
  }
  topRight.append(countdown, seeRow);

  // --- Abajo a la izquierda: horizonte de 360° ---
  const chartBox = el('figure', 'sky-chart');
  const chart = svg('svg', { viewBox: '0 0 720 200', role: 'img', 'aria-label': t('sky.chart.aria') });
  chartBox.append(chart);

  // --- Pestaña lateral "Más información" ---
  const more = el('button', 'sky-more', t('sky.moreInfo'));
  more.type = 'button';
  more.setAttribute('aria-expanded', 'false');
  if (drawer?.id) more.setAttribute('aria-controls', drawer.id);

  root.append(stage, topLeft, topRight, chartBox, more);
  if (panelEl) root.append(panelEl); // el panel queda arriba de todo
  const panel = panelEl ? initSkyPanel(panelEl, { trigger: search, liveEnabled }) : null;

  // --- Estado ---
  let heading = 0;
  let tilt = 0;
  let data = null; // { ephemeris, horizon, utcMs, siteName, sample }
  let siteKey = null;
  let anim = null;
  let cdTimer = null;
  const pinned = new Set(); // cuerpos con el detalle fijo (clic o toque)

  const horizonFn = () => (data?.horizon ? (az) => horizonAt(data.horizon, az) : 0);
  const horizonDegAt = (az) => (data?.horizon ? horizonAt(data.horizon, az) : 0);

  function view() {
    const width = stage.clientWidth || window.innerWidth;
    const height = stage.clientHeight || window.innerHeight;
    return { heading, tilt, width, height, horizonY: height * HORIZON_FRACTION };
  }

  // --- Dibujo de la vista ---
  function drawStage() {
    const v = view();
    const k = pxPerDeg(v.width);
    const hy = v.horizonY + tilt * k; // horizonte en pantalla (baja al mirar hacia arriba)
    air.style.height = `${Math.max(0, hy)}px`;
    for (const node of [ground, horizon, ticks, headingLabel, smooth]) node.style.top = `${hy}px`;
    const tileW = 30 * k; // la textura se repite cada 30°: gira sin saltos al cruzar el norte
    ground.style.backgroundSize = `${tileW}px auto`;
    ground.style.backgroundPositionX = `${v.width / 2 - heading * k}px`;
    root.classList.toggle('is-tilted', tilt > 0);
    root.classList.toggle('is-ground-hidden', hy > v.height - 8);

    // Brújula sobre la línea
    ticks.replaceChildren();
    for (const tk of compassTicks(heading)) {
      const mark = el('span', `sky-tick${tk.point ? ' sky-tick--major' : ''}`);
      mark.style.left = `${v.width / 2 + tk.rel * k}px`;
      if (tk.point && Math.abs(tk.rel) > 5) mark.dataset.label = t(`compass.${tk.point}`);
      ticks.append(mark);
    }
    headingName.textContent = t(`sky.heading.${compassLabel(heading)}`);
    headingDeg.textContent = `${Math.round(normAz(heading))}°`;

    up.disabled = tilt >= TILT_MAX_DEG;
    down.hidden = tilt === 0;

    if (!data?.sample) {
      for (const b of bodies) for (const n of [b.disc, b.ghost, b.name, b.stem, b.label]) n.hidden = true;
      for (const b of Object.values(seeButtons)) b.disabled = true;
      return;
    }
    const radii = data.ephemeris.angular_radius_deg;
    for (const b of bodies) drawBody(b, data.sample[b.key], radii[b.key], v, k, hy);
  }

  function drawBody(b, pos, radiusDeg, v, k, hy) {
    const p = project(pos, v);
    const r = discRadiusPx(radiusDeg, k);
    const box = (2 * r) / (b.key === 'sun' ? SUN_DISC_FRACTION : EARTH_DISC_FRACTION);
    const fullyBelow = pos.elevation_deg + radiusDeg <= horizonDegAt(pos.azimuth_deg);
    const above = p.y + r < hy;

    b.disc.hidden = !p.onScreen;
    b.ghost.hidden = !p.onScreen || !fullyBelow;
    b.name.hidden = !p.onScreen;
    b.stem.hidden = !p.onScreen;
    b.label.hidden = !p.onScreen;

    const see = seeButtons[b.key];
    see.disabled = false;
    see.dataset.az = String(pos.azimuth_deg);
    see.title = t('sky.goTo', { body: bodyName(b.key), az: Math.round(pos.azimuth_deg) });
    if (!p.onScreen) return;

    Object.assign(b.disc.style, { left: `${p.x}px`, top: `${p.y}px`, width: `${box}px`, height: `${box}px` });
    Object.assign(b.ghost.style, { left: `${p.x}px`, top: `${p.y}px`, width: `${2 * r}px`, height: `${2 * r}px` });
    // Nombre arriba del disco (si está bajo el horizonte, arriba del contorno sobre el suelo)
    Object.assign(b.name.style, { left: `${p.x}px`, top: `${p.y - Math.max(box / 2, r + 6) - 4}px` });
    // Línea punteada entre el borde del disco y el horizonte
    const stemTop = above ? p.y + r : hy;
    const stemHeight = above ? hy - (p.y + r) : Math.max(0, p.y - r - hy);
    Object.assign(b.stem.style, { left: `${p.x}px`, top: `${stemTop}px`, height: `${stemHeight}px` });
    const { value, side } = elevationDisplay(pos.elevation_deg);
    b.label.textContent = t(side === 'below' ? 'sky.below' : 'sky.above', { value: fmt1(value) });
    Object.assign(b.label.style, { left: `${p.x + Math.max(box / 2, 14) + 14}px`, top: `${p.y}px` });
  }

  // --- Gráfico de 360° (como "Cómo leer los números" del artifact) ---
  function drawChart() {
    chart.replaceChildren();
    const X0 = 44;
    const X1 = 704;
    const Y0 = 14;
    const Y1 = 160;
    const sample = data?.sample;
    const { min, max } = chartRange(sample ? [sample.sun.elevation_deg, sample.earth.elevation_deg] : [0]);
    const ax = (a) => X0 + (normAz(a) / 360) * (X1 - X0);
    const ay = (e) => Y0 + ((max - Math.max(min, Math.min(max, e))) / (max - min)) * (Y1 - Y0);
    const step = max <= 15 ? 5 : max <= 45 ? 10 : 15;
    for (let v = min; v <= max; v += step) {
      if (v === 0) continue;
      svg('line', { x1: X0, x2: X1, y1: ay(v), y2: ay(v), class: 'sky-chart__grid' }, chart);
      svg('text', { x: X0 - 6, y: ay(v) + 4, 'text-anchor': 'end' }, chart).textContent = `${v}°`;
    }
    svg('rect', { x: X0, y: ay(0), width: X1 - X0, height: Y1 - ay(0), class: 'sky-chart__ground' }, chart);
    svg('line', { x1: X0, x2: X1, y1: ay(0), y2: ay(0), class: 'sky-chart__horizon' }, chart);
    svg('text', { x: X0 - 6, y: ay(0) + 4, 'text-anchor': 'end' }, chart).textContent = '0°';
    for (let i = 0; i <= 8; i += 1) {
      const a = i * 45;
      const x = X0 + (a / 360) * (X1 - X0);
      svg('line', { x1: x, x2: x, y1: ay(0), y2: ay(0) + 5, class: 'sky-chart__tick' }, chart);
      const lbl = `${t(`compass.${compassLabel(a)}`)} ${a}°`;
      svg('text', { x, y: 190, 'text-anchor': i === 0 ? 'start' : i === 8 ? 'end' : 'middle' }, chart).textContent = lbl;
    }
    svg('text', { x: X1 - 6, y: ay(0) + 16, 'text-anchor': 'end' }, chart).textContent = t('sky.chart.ground');

    // Recuadro de lo que muestra la vista (puede cruzar el norte: dos rectángulos)
    const from = normAz(heading - FOV_DEG / 2);
    const to = from + FOV_DEG;
    const win = (a0, a1) => svg('rect', {
      x: X0 + (a0 / 360) * (X1 - X0), y: Y0, width: ((a1 - a0) / 360) * (X1 - X0), height: Y1 - Y0,
      class: 'sky-chart__view',
    }, chart);
    if (to <= 360) win(from, to);
    else { win(from, 360); win(0, to - 360); }

    if (!sample) return;
    for (const key of ['earth', 'sun']) {
      const pos = sample[key];
      const x = ax(pos.azimuth_deg);
      const y = ay(pos.elevation_deg);
      svg('circle', { cx: x, cy: y, r: key === 'earth' ? 6 : 5, class: `sky-chart__body sky-chart__body--${key}` }, chart);
      svg('text', { x, y: y - 11, 'text-anchor': 'middle', class: `sky-chart__name--${key}` }, chart)
        .textContent = bodyName(key);
    }
  }

  // --- Cuenta regresiva (arriba a la derecha) ---
  function drawCountdown() {
    if (cdTimer !== null) clearInterval(cdTimer);
    cdTimer = null;
    countdown.replaceChildren();
    if (!data?.sample) return;
    const rows = ['sun', 'earth'].map((key) => {
      const change = nextVisibilityChange(data.ephemeris, data.utcMs, key, horizonFn());
      const row = el('p', `sky-cd sky-cd--${key}`);
      const text = el('span', 'sky-cd__text');
      const value = el('span', 'sky-cd__value');
      row.append(el('span', 'sky-cd__dot'), text, value);
      countdown.append(row);
      if (!change?.event) {
        text.textContent = t(`sky.cd.${key}None`);
        return null;
      }
      text.textContent = t(`sky.cd.${key}${change.event === 'sets' ? 'Sets' : 'Rises'}`);
      row.classList.toggle('is-visible', change.visible);
      return { value, crossMs: change.crossMs };
    }).filter(Boolean);
    const startedAt = Date.now();
    const { utcMs } = data;
    const tick = () => {
      const now = utcMs + (Date.now() - startedAt);
      for (const r of rows) r.value.textContent = shortDuration(r.crossMs - now);
    };
    tick();
    if (rows.length) cdTimer = setInterval(tick, 1000);
  }

  function drawTime() {
    timeLabel.textContent = t('sky.slider', { site: data?.siteName ?? '' });
    if (data?.utcMs != null) {
      slider.value = String(timeToSlider(data.utcMs, range.minMs));
      when.textContent = fmtUtc(data.utcMs);
      slider.setAttribute('aria-valuetext', when.textContent);
    }
  }

  function draw() {
    drawStage();
    drawChart();
  }

  // --- Interacción ---
  function animateTo(target) {
    if (anim) cancelAnimationFrame(anim);
    const start = heading;
    const delta = relAz(target, start);
    const t0 = performance.now();
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const dur = reduce ? 0 : 350;
    const step = (now) => {
      const f = dur ? Math.min(1, (now - t0) / dur) : 1;
      heading = normAz(start + delta * (1 - (1 - f) ** 3));
      draw();
      anim = f < 1 ? requestAnimationFrame(step) : null;
    };
    anim = requestAnimationFrame(step);
  }
  const turn = (delta) => animateTo(rotate(heading, delta));
  const setTilt = (value) => { tilt = value; draw(); };

  left.addEventListener('click', () => turn(-ROTATE_STEP_DEG));
  right.addEventListener('click', () => turn(ROTATE_STEP_DEG));
  up.addEventListener('click', () => setTilt(tiltUp(tilt)));
  down.addEventListener('click', () => setTilt(tiltDown(tilt)));
  for (const [key, b] of Object.entries(seeButtons)) {
    b.addEventListener('click', () => {
      if (!data?.sample) return;
      const pos = data.sample[key];
      // Si el cuerpo está alto (sitios del ecuador), también sube la mirada para que entre.
      const v = view();
      const visibleDeg = (v.horizonY - 60) / pxPerDeg(v.width);
      if (pos.elevation_deg > visibleDeg + tilt || pos.elevation_deg < tilt) {
        tilt = clampTilt(Math.ceil((pos.elevation_deg - visibleDeg / 2) / TILT_STEP_DEG) * TILT_STEP_DEG);
      }
      animateTo(normAz(pos.azimuth_deg));
    });
  }

  // Detalle de un cuerpo (brillo, línea al horizonte y grados): al pasar el mouse o fijado con un clic.
  function setDetail(key, on) {
    root.classList.toggle(`is-detail-${key}`, on || pinned.has(key));
  }
  for (const b of bodies) {
    for (const target of [b.disc, b.ghost]) {
      target.addEventListener('pointerenter', () => setDetail(b.key, true));
      target.addEventListener('pointerleave', () => setDetail(b.key, false));
    }
  }

  // Arrastrar el cielo: a los costados gira, arriba y abajo inclina la mirada.
  let drag = null;
  stage.addEventListener('pointerdown', (e) => {
    if (e.target.closest('button')) return;
    drag = { x: e.clientX, y: e.clientY, heading, tilt, moved: false, body: e.target.closest('.sky-body, .sky-ghost') };
    stage.setPointerCapture(e.pointerId);
  });
  stage.addEventListener('pointermove', (e) => {
    if (!drag) return;
    const dx = e.clientX - drag.x;
    const dy = e.clientY - drag.y;
    if (!drag.moved && Math.hypot(dx, dy) < CLICK_SLOP_PX) return;
    drag.moved = true;
    stage.classList.add('is-dragging');
    if (anim) cancelAnimationFrame(anim);
    const k = pxPerDeg(stage.clientWidth);
    heading = normAz(drag.heading - dx / k);
    tilt = clampTilt(drag.tilt + dy / k);
    draw();
  });
  const endDrag = () => {
    if (drag && !drag.moved && drag.body) {
      // Clic sobre un cuerpo: fija o suelta su detalle (sirve también en pantallas táctiles).
      const key = drag.body.classList.contains('sky-body--sun') || drag.body.classList.contains('sky-ghost--sun') ? 'sun' : 'earth';
      if (pinned.has(key)) pinned.delete(key); else pinned.add(key);
      setDetail(key, pinned.has(key));
    }
    drag = null;
    stage.classList.remove('is-dragging');
  };
  stage.addEventListener('pointerup', endDrag);
  stage.addEventListener('pointercancel', endDrag);

  // Teclado: flechas giran y suben la mirada (salvo dentro de un control o del cajón)
  root.addEventListener('keydown', (e) => {
    if (e.target.closest('input, select, textarea, .sky-panel')) return;
    if (e.key === 'ArrowLeft') turn(-ROTATE_STEP_DEG);
    else if (e.key === 'ArrowRight') turn(ROTATE_STEP_DEG);
    else if (e.key === 'ArrowUp') setTilt(tiltUp(tilt));
    else if (e.key === 'ArrowDown') setTilt(tiltDown(tilt));
    else return;
    e.preventDefault();
  });
  stage.tabIndex = 0;
  stage.setAttribute('aria-label', t('sky.aria'));

  slider.addEventListener('input', () => {
    onUserInput?.();
    onTime(sliderToTime(slider.value, range.minMs, range.maxMs));
  });

  search.addEventListener('click', () => panel?.toggle());

  // Cajón "Más información": se abre al costado (la pestaña se mueve con él)
  function setDrawer(open) {
    if (!drawer) return;
    document.body.classList.toggle('is-drawer-open', open);
    drawer.toggleAttribute('inert', !open);
    drawer.setAttribute('aria-hidden', String(!open));
    more.setAttribute('aria-expanded', String(open));
  }
  more.addEventListener('click', () => setDrawer(!document.body.classList.contains('is-drawer-open')));
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && document.body.classList.contains('is-drawer-open') && !panel?.isOpen()) setDrawer(false);
  });

  new ResizeObserver(() => draw()).observe(stage);
  draw();

  return {
    /**
     * Muestra un sitio en un instante. `key` identifica el sitio (o la posición libre):
     * al cambiar, la vista vuelve a mirar hacia el Sol (o la Tierra).
     */
    update({ ephemeris, horizon: hz, utcMs, siteName, key }) {
      const sample = sampleAt(ephemeris, utcMs);
      data = { ephemeris, horizon: hz, utcMs, siteName, sample };
      if (key !== siteKey && sample) {
        siteKey = key;
        const radii = ephemeris.angular_radius_deg;
        heading = normAz(initialHeading(sample.sun, sample.earth, radii.sun, radii.earth));
        tilt = 0;
      }
      drawTime();
      drawCountdown();
      draw();
    },
    /** Sin datos para mostrar: el cielo queda vacío (se conserva el sitio y la fecha). */
    clear({ siteName = data?.siteName ?? '', utcMs = data?.utcMs ?? null } = {}) {
      data = { siteName, utcMs, sample: null };
      drawTime();
      drawCountdown();
      draw();
    },
  };
}
