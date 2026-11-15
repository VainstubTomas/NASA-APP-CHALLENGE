// Lógica del reproductor de tiempo (C3-02), sin DOM para poder probarla con `npm test`.
// El tiempo es un instante UTC en milisegundos; los datos son horarios (docs/03-DATA-CONTRACT.md).
import { HOUR_MS, clampTime } from './state.js';

export const DAY_MS = 24 * HOUR_MS;

/** Cuánto avanza el play en cada segundo: 1 hora o 1 día. */
export const SPEEDS = { hour: HOUR_MS, day: DAY_MS };

/** Mueve el instante `deltaMs`, redondeado a la hora y limitado al rango [minMs, maxMs]. */
export function stepTime(t, deltaMs, minMs, maxMs) {
  return clampTime(t + deltaMs, minMs, maxMs);
}

/** Siguiente instante del play. `done` es true cuando llegó al final y hay que detenerse. */
export function nextPlayTime(t, speedMs, maxMs) {
  const next = stepTime(t, speedMs, -Infinity, maxMs);
  return { t: next, done: next >= maxMs };
}

export const canStepBack = (t, minMs) => t > minMs;
export const canStepForward = (t, maxMs) => t < maxMs;

/** Posición del deslizador: horas desde el inicio del rango. */
export const timeToSlider = (t, minMs) => Math.round((t - minMs) / HOUR_MS);

/** Instante para una posición del deslizador (acepta texto, como entrega <input type="range">). */
export function sliderToTime(value, minMs, maxMs) {
  return stepTime(minMs, Number(value) * HOUR_MS, minMs, maxMs);
}
