// Lógica pura del overlay de debug (sin DOM, para testear con node --test).

export const FPS_WINDOW_MS = 500;

/**
 * Medidor de cuadros. `tick(now)` recibe el timestamp de cada cuadro (ms) y devuelve
 * { fps, frameMs }: fps se actualiza cada `windowMs`; frameMs es la duración del último cuadro.
 */
export function createFpsMeter(windowMs = FPS_WINDOW_MS) {
  let windowStart = null;
  let count = 0;
  let fps = 0;
  let lastNow = null;
  let frameMs = 0;
  return {
    tick(now) {
      if (lastNow !== null) frameMs = now - lastNow;
      lastNow = now;
      if (windowStart === null) windowStart = now;
      count += 1;
      const elapsed = now - windowStart;
      if (elapsed >= windowMs) {
        fps = (count * 1000) / elapsed;
        windowStart = now;
        count = 0;
      }
      return { fps, frameMs };
    },
  };
}

/** Tasa de eventos por segundo entre dos lecturas de un contador acumulado. */
export function ratePerSecond(prevCount, count, prevMs, nowMs) {
  const dt = nowMs - prevMs;
  if (!(dt > 0)) return 0;
  return ((count - prevCount) * 1000) / dt;
}

/** Entero con separador de miles (es-AR: 1.234.567). */
export function formatCount(n) {
  return Math.round(n).toLocaleString('es-AR');
}
