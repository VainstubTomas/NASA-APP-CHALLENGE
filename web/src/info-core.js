// Cálculos del cajón "Más información" (#99), sin DOM para probarlos con `npm test`.
// Trabajan sobre la visibilidad hora por hora de visibilitySeries (visibility.js): una muestra = 1 h.

/** Largo del tramo seguido más largo de `arr` con el valor `value`. */
export function longestRun(arr, value) {
  let best = 0;
  let cur = 0;
  for (const v of arr) {
    cur = v === value ? cur + 1 : 0;
    if (cur > best) best = cur;
  }
  return best;
}

/**
 * Horas con Sol, con Tierra y con los dos en [start, start + hours), recortado al final de los datos.
 * @param {{sun: boolean[], earth: boolean[]}} vis visibilidad por muestra
 */
export function windowHours(vis, start, hours) {
  const end = Math.min(vis.sun.length, start + hours);
  let sun = 0;
  let earth = 0;
  let both = 0;
  for (let i = Math.max(0, start); i < end; i += 1) {
    if (vis.sun[i]) sun += 1;
    if (vis.earth[i]) earth += 1;
    if (vis.sun[i] && vis.earth[i]) both += 1;
  }
  return { sun, earth, both, hours: Math.max(0, end - Math.max(0, start)) };
}

/** Resumen de todo el período de datos: horas con cada cuerpo, sin ninguno y peores tramos. */
export function periodSummary(vis) {
  const both = vis.sun.map((s, i) => s && vis.earth[i]);
  const totals = windowHours(vis, 0, vis.sun.length);
  return {
    samples: vis.sun.length,
    sun: totals.sun,
    earth: totals.earth,
    both: totals.both,
    none: vis.sun.filter((s, i) => !s && !vis.earth[i]).length,
    longestNoSun: longestRun(vis.sun, false),
    longestNoEarth: longestRun(vis.earth, false),
    longestNoBoth: longestRun(both, false),
  };
}
