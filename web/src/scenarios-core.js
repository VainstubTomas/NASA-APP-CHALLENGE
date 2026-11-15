// Lista de escenarios a comparar (C4-01b, #92), sin DOM. Un escenario es { id, site, t } (t en ms UTC).
// Reglas: mínimo 2 y máximo 3 escenarios; el primero arranca con la selección actual.
// Las funciones no modifican la lista: devuelven una nueva (o la misma si la acción no se puede hacer).
import { HOUR_MS, clampTime, formatT, parseT } from './state.js';

export const MIN_SCENARIOS = 2;
export const MAX_SCENARIOS = 3;
// Escenario nuevo por defecto: mismo sitio, 14 días después (~medio día lunar: si hay Sol, suele ser de noche).
export const DEFAULT_OFFSET_MS = 14 * 24 * HOUR_MS;

const nextId = (list) => `s${Math.max(0, ...list.map((s) => Number(s.id.slice(1)))) + 1}`;

function shifted(list, from, range) {
  return { id: nextId(list), site: from.site, t: clampTime(from.t + DEFAULT_OFFSET_MS, range.minMs, range.maxMs) };
}

/** Dos escenarios: la selección actual { site, t } y el mismo sitio 14 días después. */
export function initialScenarios(current, range) {
  const first = { id: 's1', site: current.site, t: clampTime(current.t, range.minMs, range.maxMs) };
  return [first, shifted([first], first, range)];
}

export const canAdd = (list) => list.length < MAX_SCENARIOS;
export const canRemove = (list) => list.length > MIN_SCENARIOS;

/** Agrega un escenario copiando el último, 14 días después. Con 3 devuelve la misma lista. */
export function addScenario(list, range) {
  if (!canAdd(list)) return list;
  return [...list, shifted(list, list[list.length - 1], range)];
}

/** Quita el escenario `id`. Con 2 devuelve la misma lista. */
export function removeScenario(list, id) {
  if (!canRemove(list)) return list;
  return list.filter((s) => s.id !== id);
}

/** Cambia sitio y/o fecha del escenario `id`; la fecha se redondea a la hora y se limita al rango. */
export function updateScenario(list, id, patch, range) {
  return list.map((s) => {
    if (s.id !== id) return s;
    const next = { ...s, ...patch };
    return { ...next, t: clampTime(next.t, range.minMs, range.maxMs) };
  });
}

// ---- Estado en la URL (C4-04, #97) ----
// Parámetro `c`: "<sitio>@<ISO UTC>,<sitio>@<ISO UTC>[,...]". Convive con ?site=&t= (escenario principal).
export const SCENARIOS_PARAM = 'c';

/** Lista de escenarios -> valor del parámetro `c` (sin los ids: se regeneran al leer). */
export function scenariosToParam(list) {
  return list.map((s) => `${s.site}@${formatT(s.t)}`).join(',');
}

/**
 * Valor del parámetro `c` -> lista de escenarios, con tolerancia: descarta entradas inválidas (sitio que no
 * existe, fecha mala), lleva la fecha al rango y la redondea a la hora, y recorta a MAX_SCENARIOS.
 * Devuelve null si quedan menos de MIN_SCENARIOS válidos (el que llama usa los valores por defecto).
 */
export function parseScenarios(param, sites, range) {
  if (typeof param !== 'string' || param === '') return null;
  const valid = [];
  for (const part of param.split(',')) {
    const at = part.indexOf('@');
    if (at < 1) continue;
    const site = part.slice(0, at);
    const t = parseT(part.slice(at + 1));
    if (t === null || !sites.some((s) => s.id === site)) continue;
    valid.push({ site, t: clampTime(t, range.minMs, range.maxMs) });
  }
  if (valid.length < MIN_SCENARIOS) return null;
  return valid.slice(0, MAX_SCENARIOS).map((s, i) => ({ id: `s${i + 1}`, ...s }));
}
