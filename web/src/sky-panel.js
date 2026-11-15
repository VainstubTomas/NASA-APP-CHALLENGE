// Panel de búsqueda (rediseño #99, Figma frames 3 y 4).
// Primero se elige cómo buscar: histórico (sitios de sites.json), ubicación específica
// (latitud y longitud, API en vivo, ADR-015) o mapa lunar (próximamente).
// Nada se aplica hasta tocar "Aplicar": recién ahí se cambian los controles reales del selector
// (#site, #time) o se envía el formulario en vivo. Al hacer clic afuera o con Escape se cierra sin aplicar.
// Qué pasos se ejecutan lo decide applyPlan (sky-core.js, con tests).
import { applyPlan } from './sky-core.js';
import { validateCoords } from './live-core.js';
import { pixelToLatLon, latLonToPixel, roundCoord, POLES } from './map-core.js';
import { t } from './i18n.js';

/**
 * @param {HTMLElement} panel  #sky-panel
 * @param {object} opts
 * @param {HTMLElement} opts.trigger  botón de búsqueda que abre el panel
 * @param {boolean} opts.liveEnabled  hay API en vivo configurada (VITE_API_URL)
 * @returns {{ open(): void, close(): void, toggle(): void, isOpen(): boolean }}
 */
export function initSkyPanel(panel, { trigger, liveEnabled }) {
  const realSite = document.getElementById('site');
  const realTime = document.getElementById('time');
  const site = panel.querySelector('#sky-site');
  const time = panel.querySelector('#sky-time');
  const modes = [...panel.querySelectorAll('[data-mode]')];
  const panes = [...panel.querySelectorAll('[data-pane]')];
  const apply = panel.querySelector('[data-sky-apply]');
  const noApis = [...panel.querySelectorAll('[data-no-api]')];
  let mode = null;
  let applying = false;

  // Mapa lunar: polo sur (el del proyecto) y, con "Rotar", polo norte.
  const map = panel.querySelector('[data-pane="map"]');
  const poleLabel = map?.querySelector('[data-pole-label]');
  const stage = map?.querySelector('[data-map-stage]');
  const marker = map?.querySelector('[data-map-marker]');
  const coordsText = map?.querySelector('[data-map-coords]');
  let picked = null; // { pole, lat, lon }: el lugar elegido con un clic

  const fmtCoords = (key, ll) => t(key, { lat: ll.lat.toFixed(2), lon: ll.lon.toFixed(2) });
  function showPicked() {
    if (coordsText) coordsText.textContent = picked ? fmtCoords('sky.panel.mapPicked', picked) : t('sky.panel.mapHint');
  }
  function placeMarker() {
    if (!marker) return;
    const px = picked ? latLonToPixel(picked.pole, picked.lat, picked.lon) : null;
    marker.hidden = !px;
    if (!px) return;
    const p = POLES[picked.pole];
    marker.style.left = `${(px.x / p.width) * 100}%`;
    marker.style.top = `${(px.y / p.height) * 100}%`;
  }
  // Del evento del mouse o del toque a latitud y longitud: píxel en pantalla → píxel del PNG original
  // → proyección inversa (map-core.js). Fuera del disco del mapa devuelve null.
  function eventToLatLon(event) {
    const img = map.querySelector('[data-pole-image]:not([hidden])');
    const rect = img.getBoundingClientRect();
    if (!rect.width || !rect.height) return null;
    const p = POLES[map.dataset.pole];
    const x = ((event.clientX - rect.left) / rect.width) * p.width;
    const y = ((event.clientY - rect.top) / rect.height) * p.height;
    const ll = pixelToLatLon(map.dataset.pole, x, y);
    return ll && { lat: roundCoord(ll.lat), lon: roundCoord(ll.lon) };
  }
  stage?.addEventListener('pointermove', (event) => {
    const ll = eventToLatLon(event);
    if (ll) coordsText.textContent = fmtCoords('sky.panel.mapCoords', ll);
    else showPicked();
  });
  stage?.addEventListener('pointerleave', showPicked);
  stage?.addEventListener('click', (event) => {
    const ll = eventToLatLon(event);
    if (!ll) return;
    picked = { pole: map.dataset.pole, ...ll };
    console.log('[mapa] lugar elegido', picked);
    placeMarker();
    showPicked();
    updateApply();
  });

  function setPole(pole) {
    if (!map) return;
    picked = null; // el lugar elegido pertenece a un polo: al rotar se descarta
    placeMarker();
    showPicked();
    updateApply();
    map.dataset.pole = pole;
    for (const img of map.querySelectorAll('[data-pole-image]')) img.hidden = img.dataset.poleImage !== pole;
    poleLabel.textContent = t(pole === 'south' ? 'sky.panel.poleSouth' : 'sky.panel.poleNorth');
  }
  map?.querySelector('[data-pole-rotate]')?.addEventListener('click', () => {
    setPole(map.dataset.pole === 'south' ? 'north' : 'south');
  });
  // Textos accesibles: alt en las imágenes, aria-label en el resto.
  panel.querySelectorAll('[data-i18n-label]').forEach((n) => {
    if (n.tagName === 'IMG') n.alt = t(n.dataset.i18nLabel);
    else n.setAttribute('aria-label', t(n.dataset.i18nLabel));
  });

  const liveForm = () => panel.querySelector('#live form');

  function setMode(next) {
    mode = next;
    for (const b of modes) b.setAttribute('aria-pressed', String(b.dataset.mode === mode));
    for (const p of panes) {
      const name = p.dataset.pane;
      // La fecha acompaña a los tres modos.
      p.hidden = !mode || (name !== 'date' && name !== mode);
    }
    for (const n of noApis) n.hidden = liveEnabled;
    // "Aplicar" está en los tres modos. Ubicación específica y mapa necesitan la API en vivo (y el mapa,
    // además, un lugar elegido): si falta algo queda deshabilitado.
    apply.hidden = !mode;
    updateApply();
  }

  // Coordenadas cargadas y dentro de rango (mismas reglas que la API: live-core.js).
  function coordsValid() {
    const inputs = liveForm()?.querySelectorAll('input');
    return inputs?.length >= 2 && validateCoords(inputs[0].value, inputs[1].value).ok;
  }

  // "Aplicar": histórico siempre; el mapa cuando hay API y un lugar elegido; ubicación específica cuando hay API (si las coordenadas no son válidas,
  // runApply muestra el error de cada campo en vez de dejar el botón apagado sin explicación);
  // el mapa todavía no permite elegir un lugar.
  function updateApply() {
    const canApply = mode === 'historical' || (mode === 'location' && liveEnabled) || (mode === 'map' && liveEnabled && Boolean(picked));
    apply.disabled = !canApply;
  }

  function open() {
    // Copia las opciones y los valores actuales del selector real; empieza eligiendo el modo.
    site.replaceChildren(...[...realSite.options].map((o) => new Option(o.textContent, o.value)));
    site.value = realSite.value;
    time.min = realTime.min;
    time.max = realTime.max;
    time.step = realTime.step;
    time.value = realTime.value;
    setMode(null);
    setPole('south');
    panel.hidden = false;
    trigger.setAttribute('aria-expanded', 'true');
    modes[0]?.focus();
  }

  function close({ focusTrigger = true } = {}) {
    if (panel.hidden) return;
    panel.hidden = true;
    trigger.setAttribute('aria-expanded', 'false');
    if (focusTrigger) trigger.focus();
  }

  function fire(control, value) {
    control.value = value;
    control.dispatchEvent(new Event('change', { bubbles: true }));
  }

  // Pasa el lugar elegido en el mapa a los campos de latitud y longitud del formulario en vivo.
  function fillLiveFromMap() {
    const inputs = liveForm()?.querySelectorAll('input');
    if (!picked || !inputs || inputs.length < 2) return false;
    inputs[0].value = String(picked.lat);
    inputs[1].value = String(picked.lon);
    for (const input of inputs) input.dispatchEvent(new Event('input', { bubbles: true }));
    return true;
  }

  function runApply() {
    const form = liveForm();
    let effectiveMode = mode;
    if (mode === 'map') {
      if (!liveEnabled || !fillLiveFromMap()) return;
      effectiveMode = 'location';
    }
    if (effectiveMode === 'location' && !coordsValid()) {
      // Coordenadas inválidas (por ejemplo, Enter con un campo vacío): el formulario muestra
      // los errores de cada campo y el panel no se cierra. live.js no consulta si no son válidas.
      applying = true;
      form?.requestSubmit();
      applying = false;
      return;
    }
    if (apply.disabled || apply.hidden) return;
    const steps = applyPlan({
      mode: effectiveMode,
      current: { site: realSite.value, time: realTime.value },
      chosen: { site: site.value, time: time.value },
    });
    for (const step of steps) {
      if (step.type === 'site') fire(realSite, step.value);
      else if (step.type === 'time') fire(realTime, step.value);
      else if (step.type === 'live') {
        applying = true;
        form?.requestSubmit();
        applying = false;
      }
    }
    close();
  }

  for (const b of modes) b.addEventListener('click', () => setMode(b.dataset.mode));
  panel.querySelector('[data-pane="location"]')?.addEventListener('input', updateApply);
  apply.addEventListener('click', runApply);
  panel.querySelectorAll('[data-sky-close]').forEach((b) => b.addEventListener('click', () => close()));

  // Enter en latitud o longitud no consulta solo: equivale a "Aplicar" (con la fecha elegida).
  panel.addEventListener('submit', (event) => {
    if (applying) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    runApply();
  }, true);

  panel.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') close();
  });

  // Clic afuera: se cierra sin aplicar.
  document.addEventListener('pointerdown', (event) => {
    if (panel.hidden) return;
    if (panel.contains(event.target) || trigger.contains(event.target)) return;
    close({ focusTrigger: false });
  });

  return {
    open,
    close,
    toggle: () => (panel.hidden ? open() : close()),
    isOpen: () => !panel.hidden,
  };
}
