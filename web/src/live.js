// Consulta en vivo de un sitio libre (#104, ADR-015): inputs de latitud y longitud junto al selector de fecha.
// La lógica (validación, URL, caché) está en live-core.js, probada con `npm test`; acá solo se dibuja.
import './live.css';
import { validateCoords } from './live-core.js';
import { t } from './i18n.js';

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function field(id, labelKey, placeholder) {
  const wrap = el('div', 'field');
  const label = el('label', null, t(labelKey));
  label.htmlFor = id;
  const input = el('input');
  input.id = id;
  input.type = 'text';
  input.inputMode = 'decimal';
  input.autocomplete = 'off';
  input.placeholder = placeholder;
  const error = el('p', 'live-error');
  error.id = `${id}-error`;
  error.hidden = true;
  input.setAttribute('aria-describedby', error.id);
  wrap.append(label, input, error);
  return { wrap, input, error };
}

/**
 * Dibuja el formulario en `container`. `onQuery({ lat, lon })` se llama con valores ya validados.
 * Devuelve { setStatus(text, isError), setBusy(bool) }.
 */
export function initLive(container, { onQuery }) {
  container.replaceChildren();
  const form = el('form', 'live-form');
  form.noValidate = true; // los rangos se validan acá y se muestran en español, no con el aviso del navegador
  // Rangos del contrato: latitud planetocéntrica [-90, 90] y longitud este-positiva [-180, 180].
  const lat = field('live-lat', 'live.lat', t('live.latPlaceholder'));
  const lon = field('live-lon', 'live.lon', t('live.lonPlaceholder'));
  const button = el('button', 'live-submit');
  button.type = 'submit';
  button.innerHTML = '<svg class="live-submit__icon" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">'
    + '<circle cx="10.5" cy="10.5" r="6.5" fill="none" stroke="currentColor" stroke-width="2.4"/>'
    + '<path d="M15.5 15.5 21 21" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg>';
  button.append(el('span', 'live-submit__label', t('live.query')));
  const fields = el('div', 'live-fields');
  fields.append(lat.wrap, lon.wrap, button);
  const status = el('p', 'live-status');
  status.setAttribute('role', 'status');
  form.append(fields);
  container.append(el('h2', 'live-title', t('live.title')), el('p', 'live-intro', t('live.intro')), form,
    el('p', 'field-hint', t('live.hint')), status);

  function show(control, message) {
    control.error.hidden = !message;
    control.error.textContent = message ?? '';
    control.input.setAttribute('aria-invalid', message ? 'true' : 'false');
  }

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const result = validateCoords(lat.input.value, lon.input.value);
    show(lat, result.errors.includes('lat') ? t('live.errLat') : null);
    show(lon, result.errors.includes('lon') ? t('live.errLon') : null);
    if (!result.ok) {
      console.log('[live] coordenadas inválidas', { lat: lat.input.value, lon: lon.input.value, campos: result.errors });
      return;
    }
    onQuery({ lat: result.lat, lon: result.lon });
  });

  return {
    setStatus(text, isError = false) {
      status.textContent = text ?? '';
      status.classList.toggle('live-status--error', Boolean(isError));
    },
    setBusy(busy) {
      button.disabled = busy;
      button.classList.toggle('is-busy', busy);
      button.setAttribute('aria-busy', String(busy));
    },
  };
}
