// Lógica pura de la línea de tiempo (C3-03, #36), sin DOM, para probarla con `npm test`.

export const DAY_MS = 86400 * 1000;

/**
 * Ventana de muestras a dibujar: `days` días corridos desde el inicio (00:00 UTC) del día elegido.
 * Si ese inicio cae antes de los datos, arranca en la primera muestra; si los datos terminan antes,
 * la ventana es más corta (`days` devuelve cuántos días se dibujan de verdad).
 * Devuelve null si el instante elegido está fuera del rango de datos.
 * @param {{start_utc: string, step_s: number, count: number}} time `time` de ephemeris.json
 * @param {number} chosenMs instante elegido, en milisegundos UTC
 * @returns {{first: number, last: number, days: number, nowFraction: number} | null}
 *   muestras [first, last) y posición del instante elegido dentro de la ventana, en [0, 1]
 */
export function timelineWindow(time, chosenMs, days = 7) {
  const origin = Date.parse(time.start_utc);
  const stepMs = time.step_s * 1000;
  if (!Number.isFinite(chosenMs) || chosenMs < origin || chosenMs >= origin + time.count * stepMs) return null;

  const dayStart = Math.floor(chosenMs / DAY_MS) * DAY_MS;
  const first = Math.max(0, Math.ceil((dayStart - origin) / stepMs));
  const last = Math.min(time.count, first + Math.round((days * DAY_MS) / stepMs));
  const spanMs = (last - first) * stepMs;
  const nowFraction = (chosenMs - (origin + first * stepMs)) / spanMs;
  return { first, last, days: spanMs / DAY_MS, nowFraction: Math.min(1, Math.max(0, nowFraction)) };
}

/**
 * Tramos continuos de muestras visibles, como [desde, hasta) en índices del arreglo recibido.
 * @param {boolean[]} visible
 */
export function runs(visible) {
  const out = [];
  let start = -1;
  visible.forEach((v, i) => {
    if (v && start < 0) start = i;
    if (!v && start >= 0) {
      out.push([start, i]);
      start = -1;
    }
  });
  if (start >= 0) out.push([start, visible.length]);
  return out;
}

/**
 * Marcas del eje: la primera muestra de la ventana y cada medianoche UTC dentro de ella.
 * @returns {{offset: number, ms: number}[]} offset = posición dentro de la ventana, en muestras
 */
export function dayMarks(time, first, last) {
  const origin = Date.parse(time.start_utc);
  const stepMs = time.step_s * 1000;
  const marks = [];
  for (let i = first; i < last; i++) {
    const ms = origin + i * stepMs;
    if (i === first || ms % DAY_MS === 0) marks.push({ offset: i - first, ms });
  }
  return marks;
}
