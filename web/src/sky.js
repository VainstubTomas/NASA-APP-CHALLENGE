// Vista del cielo (rediseño #99, Figma "frame1"): la pantalla principal de la web.
// Una cámara parada en el sitio mira hacia un rumbo; el Sol y la Tierra se dibujan en su azimut
// y elevación reales (JPL Horizons) y con su tamaño angular real. La línea blanca es el horizonte
// y funciona como brújula: al girar se mueve. Todo se maneja con el mouse: arrastrar gira y sube
// la mirada, la rueda hace zoom y las flechas del centro apuntan al Sol y a la Tierra.
// Arriba a la izquierda, el deslizador de fecha; arriba a la derecha, la cuenta regresiva;
// abajo a la izquierda, el horizonte completo de 360°. Al pasar el mouse por un cuerpo aparece
// su brillo, la línea punteada al horizonte y los grados sobre el horizonte.
// La lógica (proyección, brújula, rangos) está en sky-core.js, probada con `npm test`.
import './sky.css';
import sunImg from './assets/sky/sun.png';
import earthImg from './assets/sky/earth.png';
import groundImg from './assets/sky/ground.png';
import { makeGroundPanorama, PANO_DEP_MIN_DEG, PANO_DEP_MAX_DEG } from './ground-texture.js';
import { createDebugOverlay } from './debug-overlay.js';

// ?debug en la URL activa el overlay de FPS y estadísticas (F3 lo oculta)
const DEBUG_OVERLAY = typeof location !== 'undefined' && new URLSearchParams(location.search).has('debug');
import logoImg from './assets/sky/logo-vizcachas.svg';
import searchIcon from './assets/sky/search.svg';
import { t, locale } from './i18n.js';
import { sampleAt, nextVisibilityChange, elevationDisplay, compassLabel } from './ephemeris.js';
import { horizonAt, hasRelief, visibilityState } from './horizon.js';
import { skylinePoints, chartProfile, skylineLight, skylineEdge, lightColor } from './sky-skyline-core.js';
import { timeToSlider, sliderToTime } from './player-core.js';
import { initSkyPanel } from './sky-panel.js';
import {
  FOV_DEG, FOV_MIN_DEG, ROTATE_STEP_DEG,
  normAz, relAz, rotate, tiltMax, tiltMin, tiltUp, tiltDown, clampTilt, pxPerDeg, project, discRadiusPx,
  compassTicks, shortDuration, chartRange, chartXToAz, initialHeading, zoomFov, makeCelestialStars, starAzEl, groundLight, pointerAngle, nearCenter, tiltToCenter,
  tweenPose, countdownAction,
} from './sky-core.js';

/** Duración del movimiento de Sol, Tierra y suelo al cambiar la fecha o la hora. */
const MOVE_MS = 600;
const DAY_MS = 86400000;

// Márgenes horizontales del gráfico de 360° (en unidades del viewBox).
const CHART_X0 = 44;
const CHART_X1 = 704;
const SVG_NS = 'http://www.w3.org/2000/svg';
// Altura del horizonte en la pantalla (fracción del alto), como en el Figma: 1082 / 1346.
const HORIZON_FRACTION = 0.8;
// Qué parte del recorte de cada imagen ocupa el disco (medido sobre el Figma).
const SUN_DISC_FRACTION = 0.75;
const EARTH_DISC_FRACTION = 0.89;
// Un arrastre menor a esto es un clic (fija o suelta el detalle del cuerpo).
const CLICK_SLOP_PX = 4;
// Al hacer clic en un cuerpo se centra y la vista se acerca hasta este campo de visión (°).
const ZOOM_ON_BODY_FOV = 45;
// Estrellas decorativas (sky-core.js): fijas en el cielo del sitio, giran con la vista.
const STARS = makeCelestialStars(2800, 2026);
// Flechas del centro: a qué distancia del centro se dibuja cada una. Radios distintos para que
// no se pisen cuando el Sol y la Tierra quedan para el mismo lado.
const POINTER_RADIUS_PX = { sun: 58, earth: 96 };

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
 * @param {() => void} [opts.onMissionExit] la persona pide salir del modo misión (ADR-019)
 * @param {() => boolean} [opts.isLive] hay una posición libre (API): el deslizador pide recién al soltarse
 * @param {() => void} [opts.onUserInput] la persona tocó la fecha (pausar el reproductor)
 * @param {HTMLElement} [opts.drawer] cajón "Más información" (Figma frame 2)
 * @param {boolean} [opts.liveEnabled] hay API en vivo (ubicación específica)
 */
export function initSky(root, { range, onTime, onMissionExit, onUserInput, drawer, liveEnabled = false, isLive = () => false }) {
  const panelEl = root.querySelector('#sky-panel');

  // --- Escenario: cielo, suelo, horizonte ---
  const stage = el('div', 'sky-stage');
  const air = el('div', 'sky-air'); // recorta los discos en el horizonte
  const ground = el('div', 'sky-ground');
  let groundPano = false; // true cuando el fallback usa el panorama generado (sin WebGL)
  // Sin imagen al arrancar: evita ver la foto en mosaico mientras carga el suelo 3D
  ground.style.backgroundColor = '#000';
  const horizon = el('div', 'sky-horizon');
  const ticks = el('div', 'sky-ticks');
  const overlay = el('div', 'sky-overlay');
  const headingLabel = el('p', 'sky-heading');
  const headingName = el('span', 'sky-heading__name');
  const headingDeg = el('span', 'sky-heading__deg');
  headingLabel.append(headingName, headingDeg);
  const smooth = el('p', 'sky-smooth', `⚠ ${t('sky.smooth')}`);
  const scaleNote = el('p', 'sky-scale');
  const sun = createBody('sun');
  const earth = createBody('earth');
  const bodies = [earth, sun];
  const stars = el('canvas', 'sky-stars');
  stars.setAttribute('aria-hidden', 'true');
  // Silueta del relieve real (C5-08): se dibuja encima de los discos, así lo que el terreno tapa no se ve.
  const skyline = el('canvas', 'sky-skyline');
  skyline.setAttribute('aria-hidden', 'true');
  air.append(stars, earth.disc, sun.disc, skyline);
  overlay.append(earth.ghost, sun.ghost, earth.stem, sun.stem, earth.name, sun.name, earth.label, sun.label);


  // Flechas en el centro de la pantalla que apuntan hacia el Sol y la Tierra (clic: girar hacia él).
  const pointers = el('div', 'sky-pointers');
  const pointerFor = {};
  for (const key of ['sun', 'earth']) {
    const b = el('button', `sky-pointer sky-pointer--${key}`);
    b.type = 'button';
    b.innerHTML = '<svg viewBox="0 0 24 24" width="28" height="28" aria-hidden="true">'
      + '<path d="M12 3 L20 15 L12 11.5 L4 15 Z" fill="currentColor"/></svg>';
    pointerFor[key] = b;
    pointers.append(b);
  }

  // Cargando (consulta a la API): círculo blanco en el centro; el overlay bloquea la interacción.
  const loading = el('div', 'sky-loading');
  loading.hidden = true;
  loading.setAttribute('role', 'status');
  loading.setAttribute('aria-label', t('live.loading'));
  const loadingBox = el('div', 'sky-loading__box');
  loadingBox.append(el('div', 'sky-loading__ring'), el('p', 'sky-loading__text', t('live.loadingCloud')));
  loading.append(loadingBox);
  root.append(loading);

  // Indicador de bloqueo: aparece bajo las flechas mientras la vista sigue a un cuerpo. Clic = soltar.
  const lockBtn = el('button', 'sky-lock');
  lockBtn.type = 'button';
  lockBtn.hidden = true;
  lockBtn.addEventListener('click', () => stopFollow());
  stage.append(air, ground, horizon, ticks, headingLabel, smooth, scaleNote, overlay, pointers, lockBtn);

  // --- Arriba a la izquierda: logo, búsqueda y fecha ---
  const topLeft = el('div', 'sky-topleft');
  // Logo del equipo: el SVG es negro sobre transparente, va dentro de un círculo blanco.
  const logo = el('div', 'sky-logo');
  const logoPic = el('img', 'sky-logo__img');
  logoPic.src = logoImg;
  logoPic.alt = t('sky.logo');
  logo.append(logoPic);
  const search = el('button', 'sky-search');
  search.type = 'button';
  search.setAttribute('aria-expanded', 'false');
  search.setAttribute('aria-controls', 'sky-panel');
  const searchImg = el('img');
  searchImg.src = searchIcon;
  searchImg.alt = '';
  search.append(searchImg, el('span', 'sky-search__text', t('sky.search')));
  // Pantalla completa (Fullscreen API). Si el navegador no la permite, el botón no aparece.
  const full = el('button', 'sky-full');
  full.type = 'button';
  const brandRow = el('div', 'sky-brand');
  brandRow.append(logo, search, full);

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
  // Modo misión (ADR-019): aviso con la hora del alunizaje y botón para volver a las fechas actuales.
  const missionBar = el('div', 'sky-time__mission');
  const missionText = el('span', 'sky-time__mission-text');
  const missionExit = el('button', 'sky-time__mission-exit');
  missionExit.type = 'button';
  missionBar.append(missionText, missionExit);
  missionBar.hidden = true;
  time.append(timeLabel, slider, when, missionBar);
  topLeft.append(brandRow, time);

  // --- Arriba a la derecha: cuenta regresiva ---
  const topRight = el('div', 'sky-topright');
  const countdown = el('div', 'sky-countdown');
  topRight.append(countdown);

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
  let fov = FOV_DEG; // cambia con la rueda del mouse (zoom)
  let data = null; // { ephemeris, horizon, utcMs, siteName, sample }
  let move = null; // { from, to, t0 }: transición en curso de la pose de Sol y Tierra
  let follow = null; // null | 'sun' | 'earth': la vista acompaña a ese cuerpo
  let pose = null; // pose mostrada este cuadro (interpolada durante la transición)
  let moveQueued = false;
  let siteKey = null;
  let anim = null;
  let cdTimer = null;
  const pinned = new Set(); // cuerpos con el detalle fijo (clic o toque)

  const horizonFn = () => (data?.horizon ? (az) => horizonAt(data.horizon, az) : 0);
  const horizonDegAt = (az) => (data?.horizon ? horizonAt(data.horizon, az) : 0);

  function view() {
    const width = stage.clientWidth || window.innerWidth;
    const height = stage.clientHeight || window.innerHeight;
    return { heading, tilt, fov, width, height, horizonY: height * HORIZON_FRACTION };
  }

  // Hasta dónde se puede subir la mirada: hasta ver el cenit en el borde de arriba.
  function maxTilt() {
    const v = view();
    return tiltMax(v.horizonY, pxPerDeg(v.width, fov));
  }

  // Hasta dónde se puede bajar la mirada (negativo): se ve el piso y el recorrido bajo el horizonte.
  function minTilt() {
    const v = view();
    return nadirTilt(v, pxPerDeg(v.width, fov));
  }
  // Se puede bajar hasta ver el nadir (−90°) en el borde de abajo: todo el recorrido bajo el horizonte.
  const nadirTilt = (v, k) => tiltMin(v.horizonY, k, v.height - 90 * k);

  // --- Dibujo de la vista ---
  function drawStage() {
    const v = view();
    const k = pxPerDeg(v.width, fov);
    const hy = v.horizonY + tilt * k; // horizonte en pantalla (baja al mirar hacia arriba)
    air.style.height = `${Math.max(0, hy)}px`;
    drawStars(v, k, hy);
    drawSkyline(v, k, hy);
    scaleNote.textContent = t('sky.scale', { fov: Math.round(fov) });
    for (const node of [ground, horizon, ticks, headingLabel, smooth]) node.style.top = `${hy}px`;
    if (groundPano) {
      // Panorama de 360° ya en perspectiva: columna = azimut, fila = grados bajo el horizonte
      ground.style.backgroundSize = `${360 * k}px ${(PANO_DEP_MAX_DEG - PANO_DEP_MIN_DEG) * k}px`;
      ground.style.backgroundPositionX = `${v.width / 2 - heading * k}px`;
      ground.style.backgroundPositionY = `${PANO_DEP_MIN_DEG * k}px`;
      ground.style.backgroundRepeat = 'repeat-x';
    } else {
      const tileW = 30 * k; // la textura se repite cada 30°: gira sin saltos al cruzar el norte
      ground.style.backgroundSize = `${tileW}px auto`;
      ground.style.backgroundPositionX = `${v.width / 2 - heading * k}px`;
    }
    ground.style.setProperty('--ground-light', groundLight(pose?.sun?.elevation_deg).toFixed(3));
    drawGround(v, k, hy);
    root.classList.toggle('is-tilted', tilt !== 0);
    root.classList.toggle('is-ground-hidden', hy > v.height - 8);

    // Brújula sobre la línea
    ticks.replaceChildren();
    for (const tk of compassTicks(heading, fov)) {
      const mark = el('span', `sky-tick${tk.point ? ' sky-tick--major' : ''}`);
      mark.style.left = `${v.width / 2 + tk.rel * k}px`;
      // Sin etiqueta cerca del centro: ahí ya está el rumbo actual en grande.
      // y tampoco si es el mismo punto cardinal que el rumbo central (dos "E" juntas confunden).
      if (tk.point && Math.abs(tk.rel) * k > 70 && tk.point !== compassLabel(heading)) {
        mark.dataset.label = t(`compass.${tk.point}`);
      }
      ticks.append(mark);
    }
    headingName.textContent = t(`compass.${compassLabel(heading)}`);
    headingDeg.textContent = `${Math.round(normAz(heading))}°`;


    if (!data?.sample) {
      for (const b of bodies) for (const n of [b.disc, b.ghost, b.name, b.stem, b.label]) n.hidden = true;
      for (const b of Object.values(pointerFor)) b.hidden = true;
      return;
    }
    const radii = data.ephemeris.angular_radius_deg;
    discs = [];
    for (const b of bodies) drawBody(b, pose[b.key], radii[b.key], v, k, hy);
    hidePointersOverDiscs(v);
  }

  // Suelo 3D ilustrativo (sky-ground.js, three.js): se carga después del primer dibujo. Hasta
  // entonces, o si el navegador no tiene WebGL2, queda la textura plana del Figma.
  let ground3d = null;
  function drawGround(v, k, hy) {
    if (!ground3d) return;
    ground3d.render({
      width: Math.round(v.width),
      groundHeight: Math.max(0, Math.round(v.height - hy)),
      pxPerDeg: k,
      heading,
      sun: pose?.sun ?? null,
      earth: pose?.earth ?? null,
      radii: data?.ephemeris?.angular_radius_deg,
    });
  }
  setTimeout(() => {
    import('./sky-ground.js')
      .then(({ createGround }) => {
        ground3d = createGround(ground);
        root.classList.add('has-ground-3d');
        if (DEBUG_OVERLAY) {
          createDebugOverlay(root, {
            getStats: () => ground3d?.stats() ?? null,
            onWireframe: (on) => ground3d?.setWireframe(on),
          });
        }
        draw();
      })
      .catch((err) => {
        console.warn('[sky] suelo 3D no disponible, se usa el suelo generado:', err.message);
        // Panorama con perspectiva en lugar de la foto cenital en mosaico (tarda ~1 s, una vez)
        setTimeout(() => {
          try {
            const { canvas, edgeColor } = makeGroundPanorama();
            groundPano = true;
            ground.style.backgroundImage = `url("${canvas.toDataURL('image/jpeg', 0.9)}")`;
            ground.style.backgroundColor = edgeColor;
            draw();
          } catch (e) {
            console.warn('[sky] no se pudo generar el suelo, se usa la foto:', e.message);
            ground.style.backgroundImage = `url("${groundImg}")`;
          }
        }, 0);
      });
  }, 0);

  // Posición de cada estrella en el cielo del sitio. El cielo gira con la fecha (una vuelta por mes
  // sidéreo), así que se recalcula solo cuando cambian la fecha o la latitud, no en cada cuadro.
  // Días (con fracción) que muestran las estrellas. Durante una transición usan el mismo easing que
  // Sol y Tierra: el cielo se desliza en vez de saltar.
  function starDays(now = performance.now()) {
    if (move?.days) {
      const t = Math.min(1, (now - move.t0) / MOVE_MS);
      const e = 1 - (1 - t) ** 3;
      return move.days[0] + (move.days[1] - move.days[0]) * e;
    }
    return (data?.utcMs ?? 0) / DAY_MS;
  }
  let starCache = { key: '', pos: STARS.map(() => ({ az: 0, el: 0 })) };
  function starPositions() {
    const lat = data?.lat ?? 0;
    const days = starDays();
    const key = `${lat}|${days}`;
    if (starCache.key !== key) {
      starCache = { key, pos: STARS.map((st) => starAzEl(st, lat, days)) };
    }
    return starCache.pos;
  }

  // Estrellas: un canvas del tamaño del cielo; solo se dibujan las que caen en la vista.
  function drawStars(v, k, hy) {
    const dpr = window.devicePixelRatio || 1;
    const h = Math.max(0, Math.round(hy));
    const w = Math.round(v.width);
    if (stars.width !== w * dpr || stars.height !== h * dpr) {
      stars.width = w * dpr;
      stars.height = h * dpr;
      stars.style.width = `${w}px`;
      stars.style.height = `${h}px`;
    }
    const ctx = stars.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    const half = fov / 2 + 1;
    // Al acercar, las estrellas crecen un poco (como en una foto con más aumento).
    const grow = Math.min(1.6, Math.max(0.8, Math.sqrt(FOV_DEG / fov)));
    const sky = starPositions();
    for (let i = 0; i < STARS.length; i += 1) {
      const st = STARS[i];
      const pos = sky[i];
      if (pos.el < -1) continue; // bajo el horizonte
      const rel = relAz(pos.az, heading);
      if (Math.abs(rel) > half) continue;
      const x = w / 2 + rel * k;
      const y = hy - pos.el * k;
      if (y < -2 || y > h) continue;
      ctx.globalAlpha = st.alpha;
      ctx.fillStyle = st.color;
      ctx.beginPath();
      ctx.arc(x, y, st.size * grow * 0.5 + 0.25, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  // Silueta del relieve (C5-08, #52): las montañas y bordes de cráter del horizon.json sobre el suelo plano.
  // Solo con relieve real (campo `dem`); con Luna lisa el canvas queda vacío. Reacciona a la luz como el suelo:
  // cada tramo se ilumina según dónde están el Sol y la Tierra ahora (skylineLight) y el borde se aviva donde el Sol
  // está justo detrás de la cresta (skylineEdge). Se redibuja con cada cambio de hora, rumbo, zoom o inclinación.
  function drawSkyline(v, k, hy) {
    const dpr = window.devicePixelRatio || 1;
    const h = Math.max(0, Math.round(hy));
    const w = Math.round(v.width);
    if (skyline.width !== w * dpr || skyline.height !== h * dpr) {
      skyline.width = w * dpr;
      skyline.height = h * dpr;
      skyline.style.width = `${w}px`;
      skyline.style.height = `${h}px`;
    }
    const ctx = skyline.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    if (!hasRelief(data?.horizon) || h === 0) return;
    const pts = skylinePoints(data.horizon, { heading, width: v.width, k, hy });
    const light = pose ? { sun: pose.sun, earth: pose.earth } : null;
    const radii = data.ephemeris.angular_radius_deg;
    const azAt = (x) => heading + (x - v.width / 2) / k;
    ctx.lineWidth = 1.5;
    for (let i = 0; i < pts.length - 1; i += 1) {
      const a = pts[i];
      const b = pts[i + 1];
      const az = azAt((a.x + b.x) / 2);
      // Relleno del tramo hasta el horizonte plano (0,5 px de más para que no queden costuras entre tramos).
      ctx.beginPath();
      ctx.moveTo(a.x, hy);
      ctx.lineTo(a.x, a.y);
      ctx.lineTo(b.x + 0.5, b.y);
      ctx.lineTo(b.x + 0.5, hy);
      ctx.closePath();
      ctx.fillStyle = lightColor(skylineLight(az, light, radii));
      ctx.fill();
      // Borde del tramo: más brillante donde el Sol está detrás de la cresta.
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.strokeStyle = `rgba(255, 255, 255, ${(0.7 * skylineEdge(az, light, radii)).toFixed(3)})`;
      ctx.stroke();
    }
  }

  // Flecha del centro hacia un cuerpo. Se atenúa si el cuerpo ya se ve en pantalla y se
  // desvanece si además está bastante centrado (ya no hace falta), o pegado al centro.
  // Discos en pantalla de este dibujo, para que una flecha no quede encima de un cuerpo.
  let discs = [];
  function hidePointersOverDiscs(v) {
    for (const [key, b] of Object.entries(pointerFor)) {
      if (b.hidden || !b.dataset.angle) continue;
      const a = (Number(b.dataset.angle) * Math.PI) / 180;
      const radius = POINTER_RADIUS_PX[key];
      const px = v.width / 2 + Math.sin(a) * radius;
      const py = v.height / 2 - Math.cos(a) * radius;
      const over = discs.some((d) => Math.hypot(px - d.x, py - d.y) < d.r + 18);
      b.classList.toggle('is-over-body', over);
    }
  }

  function drawPointer(key, p, r, v, hy) {
    if (p.onScreen) discs.push({ x: p.x, y: p.y, r });
    const b = pointerFor[key];
    const cx = v.width / 2;
    const cy = v.height / 2;
    const dist = Math.hypot(p.x - cx, p.y - cy);
    const radius = POINTER_RADIUS_PX[key];
    b.hidden = dist < radius + r + 14;
    if (b.hidden) return;
    const angle = pointerAngle(cx, cy, p.x, p.y);
    b.style.transform = `rotate(${angle}deg) translateY(-${radius}px)`;
    b.dataset.angle = String(angle);
    const inView = p.onScreen && p.y > 0 && p.y < Math.min(hy, v.height);
    b.classList.toggle('is-in-view', inView);
    b.classList.toggle('is-centered', inView && nearCenter(p.x, p.y, v.width, v.height));
    const name = bodyName(key);
    const az = Math.round((pose ?? data.sample)[key].azimuth_deg);
    b.setAttribute('aria-label', t('sky.goTo', { body: name, az }));
    b.title = name;
  }

  function drawBody(b, pos, radiusDeg, v, k, hy) {
    const p = project(pos, v);
    const r = discRadiusPx(radiusDeg, k);
    const box = (2 * r) / (b.key === 'sun' ? SUN_DISC_FRACTION : EARTH_DISC_FRACTION);
    const fullyBelow = pos.elevation_deg + radiusDeg <= horizonDegAt(pos.azimuth_deg);
    const above = p.y + r < hy;
    drawPointer(b.key, p, r, v, hy);

    b.disc.hidden = !p.onScreen;
    b.ghost.hidden = !p.onScreen || !fullyBelow;
    b.name.hidden = !p.onScreen;
    b.stem.hidden = !p.onScreen;
    b.label.hidden = !p.onScreen;

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
    // Con relieve, un cuerpo sobre 0° puede estar tapado por el terreno: la etiqueta lo dice (C5-08).
    const blocked = visibilityState(pos, radiusDeg, data.horizon) === 'blocked';
    b.label.textContent = t(side === 'below' ? 'sky.below' : blocked ? 'sky.blocked' : 'sky.above', { value: fmt1(value) });
    b.label.classList.toggle('is-blocked', blocked);
    Object.assign(b.label.style, { left: `${p.x + Math.max(box / 2, 14) + 14}px`, top: `${p.y}px` });
  }

  // --- Gráfico de 360° (como "Cómo leer los números" del artifact) ---
  function drawChart() {
    chart.replaceChildren();
    const X0 = CHART_X0;
    const X1 = CHART_X1;
    const Y0 = 14;
    const Y1 = 160;
    const sample = pose;
    const relief = hasRelief(data?.horizon);
    const profile = relief ? chartProfile(data.horizon) : null;
    // Con relieve el rango también tiene que abarcar la cresta más alta del horizonte.
    const { min, max } = chartRange([
      ...(sample ? [sample.sun.elevation_deg, sample.earth.elevation_deg] : [0]),
      ...(profile ? profile.map((p) => p.elevation) : []),
    ]);
    const ax = (a) => X0 + (normAz(a) / 360) * (X1 - X0);
    const ay = (e) => Y0 + ((max - Math.max(min, Math.min(max, e))) / (max - min)) * (Y1 - Y0);
    const step = max <= 15 ? 5 : max <= 45 ? 10 : 15;
    // Marcas en múltiplos del paso (con escala grande, −5° no lleva etiqueta: se pisaba con 0°)
    for (let v = Math.ceil(min / step) * step; v <= max; v += step) {
      if (v === 0) continue;
      svg('line', { x1: X0, x2: X1, y1: ay(v), y2: ay(v), class: 'sky-chart__grid' }, chart);
      svg('text', { x: X0 - 6, y: ay(v) + 4, 'text-anchor': 'end' }, chart).textContent = `${v}°`;
    }
    if (profile) {
      // Silueta real del sitio (LOLA): el suelo sigue el perfil de 360° y el 0° queda como referencia.
      const line = profile.map((p) => `${ax(p.az === 360 ? 360 : p.az)},${ay(p.elevation)}`);
      svg('polygon', { points: `${X0},${Y1} ${line.join(' ')} ${X1},${Y1}`, class: 'sky-chart__ground' }, chart);
      svg('line', { x1: X0, x2: X1, y1: ay(0), y2: ay(0), class: 'sky-chart__grid' }, chart);
      svg('polyline', { points: line.join(' '), class: 'sky-chart__horizon sky-chart__profile' }, chart);
    } else {
      svg('rect', { x: X0, y: ay(0), width: X1 - X0, height: Y1 - ay(0), class: 'sky-chart__ground' }, chart);
      svg('line', { x1: X0, x2: X1, y1: ay(0), y2: ay(0), class: 'sky-chart__horizon' }, chart);
    }
    svg('text', { x: X0 - 6, y: ay(0) + 4, 'text-anchor': 'end' }, chart).textContent = '0°';
    for (let i = 0; i <= 8; i += 1) {
      const a = i * 45;
      const x = X0 + (a / 360) * (X1 - X0);
      svg('line', { x1: x, x2: x, y1: ay(0), y2: ay(0) + 5, class: 'sky-chart__tick' }, chart);
      const lbl = `${t(`compass.${compassLabel(a)}`)} ${a}°`;
      svg('text', { x, y: 190, 'text-anchor': i === 0 ? 'start' : i === 8 ? 'end' : 'middle' }, chart).textContent = lbl;
    }
    if (!relief) svg('text', { x: X1 - 6, y: ay(0) + 16, 'text-anchor': 'end' }, chart).textContent = t('sky.chart.ground');

    // Recuadro de lo que muestra la vista (puede cruzar el norte: dos rectángulos)
    const from = normAz(heading - fov / 2);
    const to = from + fov;
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
      // Si el relieve lo tapa o está bajo el horizonte, el punto se dibuja hueco (no se ve desde el sitio).
      const state = visibilityState(pos, data.ephemeris.angular_radius_deg[key], data.horizon);
      const hidden = state === 'blocked' || state === 'down' ? ' is-hidden' : '';
      svg('circle', { cx: x, cy: y, r: key === 'earth' ? 6 : 5, class: `sky-chart__body sky-chart__body--${key}${hidden}` }, chart);
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
      // Cada fila es un botón: salta a la salida o a la puesta del cuerpo, o gira la vista hacia él si no hay cruce.
      const row = el('button', `sky-cd sky-cd--${key}`);
      row.type = 'button';
      const text = el('span', 'sky-cd__text');
      const value = el('span', 'sky-cd__value');
      row.append(el('span', 'sky-cd__dot'), text, value);
      row.addEventListener('click', () => activateCountdown(key, change));
      row.addEventListener('pointerenter', () => root.classList.add(`is-pointing-${key}`));
      row.addEventListener('pointerleave', () => root.classList.remove(`is-pointing-${key}`));
      countdown.append(row);
      if (!change?.event) {
        // Sin cruce del horizonte en los datos: queda siempre visible o nunca, según el estado de ahora.
        text.textContent = t(`sky.cd.${key}${change?.visible ? 'Always' : 'Never'}`);
        row.classList.toggle('is-visible', Boolean(change?.visible));
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

  function drawMission(landingMs) {
    missionBar.hidden = landingMs == null;
    if (landingMs == null) return;
    missionText.textContent = t('sky.mission.badge', { landing: fmtUtc(landingMs) });
    missionExit.textContent = t('sky.mission.back');
  }
  missionExit.addEventListener('click', () => {
    onUserInput?.();
    onMissionExit?.();
  });

  // Clic en la cuenta regresiva: salto animado a la salida del cuerpo, o solo girar si ya está visible.
  let timeAnim = null;
  const cancelTimeAnim = () => {
    if (timeAnim) cancelAnimationFrame(timeAnim);
    timeAnim = null;
  };
  // Mueve la fecha en pantalla sin pedirla todavía: cada cuadro recalcula la posición de los cuerpos.
  function previewTime(ms) {
    data = { ...data, utcMs: ms, sample: sampleAt(data.ephemeris, ms) };
    drawTime();
    draw();
  }
  function animateTime(targetMs, key) {
    cancelTimeAnim();
    const startMs = data.utcMs;
    const delta = targetMs - startMs;
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const dur = reduce ? 0 : 900;
    const t0 = performance.now();
    const step = (now) => {
      const f = dur ? Math.min(1, (now - t0) / dur) : 1;
      if (f < 1) {
        const e = 1 - (1 - f) ** 3;
        previewTime(Math.round(startMs + delta * e));
        timeAnim = requestAnimationFrame(step);
        return;
      }
      timeAnim = null;
      previewTime(targetMs);
      onTime(targetMs);
      lookAt(key, true);
    };
    timeAnim = requestAnimationFrame(step);
  }
  function activateCountdown(key, change) {
    if (!data?.sample) return;
    const action = countdownAction(change);
    if (action.type === 'jump') animateTime(action.ms, key);
    else lookAt(key, true);
  }

  function drawTime() {
    timeLabel.textContent = t('sky.slider', { site: data?.siteName ?? '' });
    if (data?.utcMs != null) {
      slider.value = String(timeToSlider(data.utcMs, range.minMs));
      when.textContent = fmtUtc(data.utcMs);
      slider.setAttribute('aria-valuetext', when.textContent);
    }
  }

  // Pose de Sol y Tierra de este cuadro: la muestra actual, o la interpolación si hay transición.
  function currentPose(now = performance.now()) {
    if (!move) return data?.sample ?? null;
    const t = (now - move.t0) / MOVE_MS;
    if (t >= 1) {
      move = null;
      return data?.sample ?? null;
    }
    return {
      sun: tweenPose(move.from.sun, move.to.sun, t),
      earth: tweenPose(move.from.earth, move.to.earth, t),
    };
  }

  function draw() {
    pose = currentPose();
    // Seguir: la mirada sigue al cuerpo en cada cuadro (incluidas las transiciones y la vista previa
    // del deslizador). Durante un giro animado (anim) manda la animación; al terminar, vuelve a seguir.
    if (follow && pose && !anim) heading = normAz(pose[follow].azimuth_deg);
    drawStage();
    drawChart();
    if (move && !moveQueued) {
      moveQueued = true;
      requestAnimationFrame(() => {
        moveQueued = false;
        draw();
      });
    }
  }

  // Al arrastrar llegan muchos pointermove por cuadro (un mouse de 1000 Hz manda ~16). Se junta todo en
  // un solo draw() por cuadro: el estado (heading, tilt) ya está actualizado cuando se dibuja.
  let drawQueued = false;
  function drawSoon() {
    if (drawQueued) return;
    drawQueued = true;
    requestAnimationFrame(() => {
      drawQueued = false;
      draw();
    });
  }

  // --- Interacción ---
  // Seguir: la vista acompaña al Sol o a la Tierra al cambiar fecha, sitio o misión. Girar, arrastrar o
  // mirar otro cuerpo lo corta. Solo rota (heading): la altura de la mirada no cambia.
  // Solo cambia el estado y el indicador: el giro hacia el cuerpo lo hace lookAt (flecha) antes.
  function setFollow(next) {
    follow = next;
    if (next) lockBtn.textContent = t('sky.lock.' + next);
    lockBtn.hidden = next === null;
  }
  function stopFollow() {
    if (follow) setFollow(null);
  }
  // Gira hasta `target`; opcionalmente también acerca (fovTo) y mueve la mirada vertical (tiltTo).
  function animateTo(target, { fovTo = fov, tiltTo = tilt } = {}) {
    if (anim) cancelAnimationFrame(anim);
    const start = heading;
    const fov0 = fov;
    const tilt0 = tilt;
    const delta = relAz(target, start);
    const t0 = performance.now();
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const dur = reduce ? 0 : 350;
    const step = (now) => {
      const f = dur ? Math.min(1, (now - t0) / dur) : 1;
      const e = 1 - (1 - f) ** 3;
      heading = normAz(start + delta * e);
      fov = fov0 + (fovTo - fov0) * e;
      tilt = clampTilt(tilt0 + (tiltTo - tilt0) * e, maxTilt(), minTilt());
      draw();
      anim = f < 1 ? requestAnimationFrame(step) : null;
      if (f >= 1) refreshHover();
    };
    anim = requestAnimationFrame(step);
  }
  const turn = (delta) => {
    stopFollow();
    animateTo(rotate(heading, delta));
  };
  // Las flechas verticales animan igual que las laterales. Se encadenan desde el destino anterior,
  // no desde la posición a mitad de camino, para que varias pulsaciones seguidas sumen sus pasos.
  let tiltGoal = null;
  const stepTilt = (stepFn, limit) => {
    stopFollow();
    const from = anim && tiltGoal !== null ? tiltGoal : tilt;
    tiltGoal = clampTilt(stepFn(from, limit), maxTilt(), minTilt());
    animateTo(heading, { tiltTo: tiltGoal });
  };

  // Girar la vista hacia un cuerpo (clic en su flecha del centro). Si está alto (sitios del
  // ecuador), también sube la mirada para que entre.
  // `zoom`: además acerca un poco (clic en el cuerpo); nunca más cerca que ZOOM_ON_BODY_FOV.
  // Al terminar de moverse la vista, el cuerpo o la flecha pueden haber salido de debajo del cursor sin
  // que el navegador avise: el resaltado solo queda si el cursor realmente está encima.
  function refreshHover() {
    for (const b of bodies) setDetail(b.key, b.disc.matches(':hover') || b.ghost.matches(':hover'));
    for (const [key, btn] of Object.entries(pointerFor)) {
      if (!btn.matches(':hover')) root.classList.remove(`is-pointing-${key}`);
    }
  }

  function lookAt(key, zoom = false) {
    if (!data?.sample) return;
    if (follow && follow !== key) stopFollow();
    const pos = data.sample[key];
    const v = view();
    const fovTo = zoom ? Math.max(FOV_MIN_DEG, Math.min(fov, ZOOM_ON_BODY_FOV)) : fov;
    const k = pxPerDeg(v.width, fovTo);
    const maxT = tiltMax(v.horizonY, k);
    const minT = nadirTilt(v, k);
    const visibleDeg = (v.horizonY - 60) / k;
    const centered = tiltToCenter(pos.elevation_deg, v.horizonY, v.height, k);
    let tiltTo = tilt;
    if (pos.elevation_deg < 0) {
      // Bajo el horizonte: baja la mirada para verlo sobre el piso, a media pantalla.
      tiltTo = clampTilt(centered, maxT, minT);
    } else if (zoom || pos.elevation_deg > visibleDeg + tilt || pos.elevation_deg < tilt) {
      // Sobre el horizonte: lo deja a media pantalla (sin redondear a pasos de TILT_STEP_DEG: con
      // zoom fuerte, redondear hacia arriba lo mandaba debajo del borde inferior y no se veía).
      tiltTo = clampTilt(centered, maxT, 0);
    }
    animateTo(normAz(pos.azimuth_deg), { fovTo, tiltTo });
  }

  for (const [key, b] of Object.entries(pointerFor)) {
    b.addEventListener('click', () => {
      root.classList.remove(`is-pointing-${key}`);
      lookAt(key, true);
      setFollow(key); // clic en la flecha: mira al cuerpo y queda bloqueado
    });
    // El hover de la flecha también enciende el detalle del cuerpo (mismo color)
    b.addEventListener('pointerenter', () => root.classList.add(`is-pointing-${key}`));
    b.addEventListener('pointerleave', () => root.classList.remove(`is-pointing-${key}`));
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
    drag = { x: e.clientX, y: e.clientY, heading, tilt, moved: false, touch: e.pointerType !== 'mouse', body: e.target.closest('.sky-body, .sky-ghost') };
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
    const k = pxPerDeg(stage.clientWidth, fov);
    stopFollow();
    heading = normAz(drag.heading - dx / k);
    tilt = clampTilt(drag.tilt + dy / k, maxTilt(), minTilt());
    drawSoon();
  });
  const endDrag = () => {
    if (drag && !drag.moved && drag.body) {
      // Clic sobre un cuerpo: fija o suelta su detalle (sirve también en pantallas táctiles).
      const key = drag.body.classList.contains('sky-body--sun') || drag.body.classList.contains('sky-ghost--sun') ? 'sun' : 'earth';
      // El detalle se fija solo con toque (no hay hover); con mouse queda el hover normal, sin clavarse.
      if (drag.touch) {
        if (pinned.has(key)) pinned.delete(key); else pinned.add(key);
        setDetail(key, pinned.has(key));
      }
      lookAt(key, true);
    }
    drag = null;
    stage.classList.remove('is-dragging');
  };
  stage.addEventListener('pointerup', endDrag);
  stage.addEventListener('pointercancel', endDrag);

  // Gráfico de 360°: clic o arrastre centra la cámara en ese azimut (mismo efecto que arrastrar el cielo).
  let chartDrag = false;
  const chartPointToAz = (e) => {
    const m = chart.getScreenCTM();
    if (!m) return null;
    const x = (e.clientX - m.e) / m.a; // px de pantalla → unidades del viewBox
    return chartXToAz(x, CHART_X0, CHART_X1);
  };
  const aimFromChart = (e) => {
    const az = chartPointToAz(e);
    if (az == null) return;
    if (anim) cancelAnimationFrame(anim);
    heading = az;
    draw();
  };
  chart.addEventListener('pointerdown', (e) => {
    chartDrag = true;
    chart.setPointerCapture(e.pointerId);
    chartBox.classList.add('is-dragging');
    aimFromChart(e);
  });
  chart.addEventListener('pointermove', (e) => { if (chartDrag) aimFromChart(e); });
  const endChartDrag = () => { chartDrag = false; chartBox.classList.remove('is-dragging'); };
  chart.addEventListener('pointerup', endChartDrag);
  chart.addEventListener('pointercancel', endChartDrag);

  // Zoom con la rueda del mouse (o el gesto de pellizcar del touchpad)
  stage.addEventListener('wheel', (e) => {
    e.preventDefault();
    const lines = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 400 : 1;
    const next = zoomFov(fov, e.deltaY * lines * (e.ctrlKey ? 4 : 1));
    if (next === fov) return;
    // Zoom hacia el cursor: el azimut y la elevación que están bajo el mouse no se mueven.
    const v = view();
    const rect = stage.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const k0 = pxPerDeg(v.width, fov);
    const azCursor = heading + (mx - v.width / 2) / k0;
    const elCursor = tilt + (v.horizonY - my) / k0;
    fov = next;
    const k1 = pxPerDeg(v.width, fov);
    if (anim) cancelAnimationFrame(anim);
    heading = normAz(azCursor - (mx - v.width / 2) / k1);
    tilt = clampTilt(elCursor - (v.horizonY - my) / k1, maxTilt(), minTilt());
    draw();
  }, { passive: false });

  // Teclado: flechas giran y suben la mirada (salvo dentro de un control o del cajón)
  root.addEventListener('keydown', (e) => {
    if (e.target.closest('input, select, textarea, .sky-panel')) return;
    if (e.key === 'ArrowLeft') turn(-ROTATE_STEP_DEG);
    else if (e.key === 'ArrowRight') turn(ROTATE_STEP_DEG);
    else if (e.key === 'ArrowUp') stepTilt(tiltUp, maxTilt());
    else if (e.key === 'ArrowDown') stepTilt(tiltDown, minTilt());
    else if ((e.key === 'f' || e.key === 'F') && canFullscreen && !e.metaKey && !e.ctrlKey) toggleFullscreen();
    else return;
    e.preventDefault();
  });
  stage.tabIndex = 0;
  stage.setAttribute('aria-label', t('sky.aria'));

  // Con una posición libre (API en vivo) cada instante nuevo es una consulta: mientras se arrastra
  // solo se actualiza la fecha en pantalla y se pide una vez, al soltar.
  slider.addEventListener('input', () => {
    cancelTimeAnim();
    onUserInput?.();
    const ms = sliderToTime(slider.value, range.minMs, range.maxMs);
    if (isLive()) {
      when.textContent = fmtUtc(ms);
      return;
    }
    onTime(ms);
  });
  slider.addEventListener('change', () => {
    if (isLive()) onTime(sliderToTime(slider.value, range.minMs, range.maxMs));
  });

  search.addEventListener('click', () => panel?.toggle());

  const ICON_ENTER = '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  const ICON_EXIT = '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  const docEl = document.documentElement;
  const fsElement = () => document.fullscreenElement ?? document.webkitFullscreenElement ?? null;
  const canFullscreen = Boolean(docEl.requestFullscreen || docEl.webkitRequestFullscreen);
  function renderFull() {
    const on = Boolean(fsElement());
    full.innerHTML = on ? ICON_EXIT : ICON_ENTER;
    const label = t(on ? 'sky.fullscreen.exit' : 'sky.fullscreen.enter');
    full.setAttribute('aria-label', label);
    full.setAttribute('aria-pressed', String(on));
    full.title = `${label} (F)`;
  }
  function toggleFullscreen() {
    if (fsElement()) (document.exitFullscreen ?? document.webkitExitFullscreen)?.call(document);
    else (docEl.requestFullscreen ?? docEl.webkitRequestFullscreen)?.call(docEl)?.catch?.(() => {});
  }
  full.hidden = !canFullscreen;
  full.addEventListener('click', toggleFullscreen);
  document.addEventListener('fullscreenchange', renderFull);
  document.addEventListener('webkitfullscreenchange', renderFull);
  renderFull();

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
    update({ ephemeris, horizon: hz, utcMs, siteName, key, lat }) {
      const sample = sampleAt(ephemeris, utcMs);
      // Misma sitio: los cuerpos se deslizan desde donde están hasta la nueva muestra. Sitio nuevo: salto.
      const sameSite = key === siteKey;
      // Al interrumpir una transición, el nuevo movimiento arranca desde la pose y los días que se ven ahora.
      const fromDays = starDays();
      const from = sameSite && data?.sample && sample ? currentPose() : null;
      data = { ephemeris, horizon: hz, utcMs, siteName, sample, lat };
      move = from ? { from, to: sample, t0: performance.now(), days: [fromDays, utcMs / DAY_MS] } : null;
      // El aviso "horizonte ideal, sin relieve" solo aparece en los sitios sin `dem` (C5-08).
      smooth.style.display = hasRelief(hz) ? 'none' : '';
      const newSite = key !== siteKey;
      if (newSite && sample) {
        siteKey = key;
        const radii = ephemeris.angular_radius_deg;
        heading = normAz(initialHeading(sample.sun, sample.earth, radii.sun, radii.earth));
        tilt = 0;
        fov = FOV_DEG;
      }
      drawTime();
      drawCountdown();
      draw();
    },
    /**
     * Cambia el rango del deslizador (ADR-019): en modo misión es la ventana alrededor del alunizaje
     * (`landingMs`); fuera de él, el rango normal. El instante se redibuja con el próximo `update`.
     */
    setRange({ minMs, maxMs, mission = false, landingMs = null }) {
      range = { minMs, maxMs };
      slider.max = String(timeToSlider(maxMs, minMs));
      drawMission(mission ? landingMs : null);
    },
    /** Loader central mientras se consulta la API: bloquea la vista y el deslizador. */
    setLoading(on) {
      loading.hidden = !on;
      slider.disabled = on;
      root.classList.toggle('is-loading', on);
    },
    /** Sin datos para mostrar: el cielo queda vacío (se conserva el sitio y la fecha). */
    clear({ siteName = data?.siteName ?? '', utcMs = data?.utcMs ?? null } = {}) {
      data = { siteName, utcMs, sample: null };
      move = null;
      drawTime();
      drawCountdown();
      draw();
    },
  };
}
