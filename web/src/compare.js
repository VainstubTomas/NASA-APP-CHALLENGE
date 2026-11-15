// Comparación de escenarios (capa 4). C4-01b (#92): selector de 2 o 3 escenarios (sitio + fecha UTC).
// C4-01c (#93): debajo del selector, una tarjeta por escenario (compare-cards.js).
// La lógica de límites está en scenarios-core.js (probada con `npm test`); acá solo se dibuja.
// C4-04 (#97): la lista vive también en la URL (parámetro `c`), así se comparte y sobrevive a recargar.
import './compare.css';
import {
  initialScenarios, canAdd, canRemove, addScenario, removeScenario, updateScenario,
  scenariosToParam, mergeSearch, SCENARIOS_PARAM,
} from './scenarios-core.js';
import { toInputValue, fromInputValue } from './state.js';
import { t, siteName } from './i18n.js';
import { summarizeAll, renderCompareCards } from './compare-cards.js';

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

let fieldSeq = 0;

function siteSelect(sites, value) {
  const select = el('select');
  for (const site of sites) {
    const opt = el('option', null, site.synthetic ? `${siteName(site)} ${t('selector.syntheticTag')}` : siteName(site));
    opt.value = site.id;
    select.append(opt);
  }
  select.value = value;
  return select;
}

function field(labelKey, control) {
  const wrap = el('div', 'field');
  control.id = `compare-field-${(fieldSeq += 1)}`;
  const label = el('label', null, t(labelKey));
  label.htmlFor = control.id;
  wrap.append(label, control);
  return wrap;
}

/**
 * Dibuja el selector de escenarios en `container`.
 * @param {HTMLElement} container
 * @param {{sites: object[], range: {minMs: number, maxMs: number}, current: {site: string, t: number},
 *          onChange?: (scenarios: {id: string, site: string, t: number}[]) => void}} options
 *   `current` es la selección principal (primer escenario). `initial` (opcional) es la lista leída de la URL. `onChange` recibe la lista cada vez que cambia.
 */
export function initCompare(container, { sites, range, current, initial, onChange }) {
  let scenarios = initial ?? initialScenarios(current, range);

  const list = el('div', 'compare-list');
  const addBtn = el('button', 'compare-btn compare-btn--add', `+ ${t('compare.add')}`);
  addBtn.type = 'button';
  const results = el('div', 'compare-results');

  container.replaceChildren(
    el('h2', 'compare__title', t('compare.title')),
    el('p', 'compare__intro', t('compare.intro')),
    list,
    addBtn,
    el('p', 'compare__limits', t('compare.limits')),
    results,
  );

  function set(next) {
    if (next === scenarios) return;
    scenarios = next;
    render();
  }

  function row(scenario, n) {
    const box = el('fieldset', 'compare-scenario');
    box.append(el('legend', 'compare-scenario__name', t('compare.scenario', { n })));

    const select = siteSelect(sites, scenario.site);
    select.addEventListener('change', () => set(updateScenario(scenarios, scenario.id, { site: select.value }, range)));

    const time = el('input');
    time.type = 'datetime-local';
    time.min = toInputValue(range.minMs);
    time.max = toInputValue(range.maxMs);
    time.step = 3600;
    time.value = toInputValue(scenario.t);
    time.addEventListener('change', () => {
      const ms = fromInputValue(time.value);
      if (ms === null) {
        time.value = toInputValue(scenario.t); // vacío o inválido: vuelve al valor anterior
        return;
      }
      set(updateScenario(scenarios, scenario.id, { t: ms }, range));
    });

    const remove = el('button', 'compare-btn compare-btn--remove', t('compare.remove'));
    remove.type = 'button';
    remove.disabled = !canRemove(scenarios);
    remove.setAttribute('aria-label', t('compare.removeAria', { n }));
    remove.addEventListener('click', () => set(removeScenario(scenarios, scenario.id)));

    box.append(field('selector.site', select), field('selector.time', time), remove);
    return box;
  }

  // Cada cambio vuelve a calcular las tarjetas; si llega una respuesta vieja (cambio rápido), se descarta.
  let request = 0;
  async function showResults() {
    const mine = (request += 1);
    results.replaceChildren(el('p', 'compare__loading', t('compare.loading')));
    let items;
    try {
      items = await summarizeAll(scenarios);
    } catch (err) {
      if (mine === request) results.replaceChildren(el('p', 'compare__loading', t('app.siteError', { error: err.message })));
      return;
    }
    if (mine !== request) return;
    results.replaceChildren();
    renderCompareCards(results, items);
  }

  function render() {
    list.replaceChildren(...scenarios.map((s, i) => row(s, i + 1)));
    addBtn.disabled = !canAdd(scenarios);
    history.replaceState(null, '', mergeSearch(window.location.search, { [SCENARIOS_PARAM]: scenariosToParam(scenarios) }));
    showResults();
    onChange?.(scenarios);
  }

  addBtn.addEventListener('click', () => set(addScenario(scenarios, range)));
  render();

  return { getScenarios: () => scenarios };
}
