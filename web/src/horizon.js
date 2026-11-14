// Altura del horizonte en una dirección (#32), según docs/03-DATA-CONTRACT.md:
// elevation_deg[i] es el horizonte en el azimut azimuth_start_deg + i * azimuth_step_deg;
// entre muestras se interpola linealmente y el perfil cierra el círculo (359° conecta con 0°).
// Sin DOM, para poder probarlo con `npm test`.

/**
 * Elevación del horizonte (grados) en `azimuthDeg` (0° = norte, sentido horario).
 * @param {object} horizon contenido de horizon.json
 * @param {number} azimuthDeg cualquier valor; se lleva a [0, 360)
 */
export function horizonAt(horizon, azimuthDeg) {
  const { azimuth_start_deg: start, azimuth_step_deg: step, elevation_deg: values } = horizon;
  const n = values.length;
  // Posición en "muestras" desde la primera, dentro de [0, n).
  const pos = ((((azimuthDeg - start) / step) % n) + n) % n;
  const i = Math.floor(pos);
  const frac = pos - i;
  const a = values[i];
  const b = values[(i + 1) % n]; // la última muestra conecta con la primera
  return frac === 0 ? a : a + (b - a) * frac;
}
