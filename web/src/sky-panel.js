// Panel de búsqueda (rediseño #99, Figma frames 3 y 4).
// Primero se elige cómo buscar: histórico (sitios de sites.json), ubicación específica
// (latitud y longitud, API en vivo, ADR-015) o mapa lunar (próximamente).
// Nada se aplica hasta tocar "Aplicar": recién ahí se cambian los controles reales del selector
// (#site, #time) o se envía el formulario en vivo. Al hacer clic afuera o con Escape se cierra sin aplicar.
// Qué pasos se ejecutan lo decide applyPlan (sky-core.js, con tests).
import { applyPlan } from './sky-core.js';
import { validateCoords } from './live-core.js';

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
  const noApi = panel.querySelector('[data-no-api]');
  let mode = null;
  let applying = false;

  const liveForm = () => panel.querySelector('#live form');

  function setMode(next) {
    mode = next;
    for (const b of modes) b.setAttribute('aria-pressed', String(b.dataset.mode === mode));
    for (const p of panes) {
      const name = p.dataset.pane;
      p.hidden = !mode || (name === 'date' ? mode === 'map' : name !== mode);
    }
    if (noApi) noApi.hidden = liveEnabled;
    const canApply = mode === 'historical' || (mode === 'location' && liveEnabled);
    apply.hidden = !mode || mode === 'map';
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

  function runApply() {
    const form = liveForm();
    if (mode === 'location') {
      // Coordenadas inválidas: se envía igual para que el formulario muestre los errores, y no se cierra.
      const inputs = form?.querySelectorAll('input');
      const check = inputs?.length >= 2 ? validateCoords(inputs[0].value, inputs[1].value) : { ok: false };
      if (!check.ok) {
        applying = true;
        form?.requestSubmit();
        applying = false;
        return;
      }
    }
    const steps = applyPlan({
      mode,
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
