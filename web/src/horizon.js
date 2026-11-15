// Altura del horizonte en una dirección (#32), según docs/03-DATA-CONTRACT.md:
// elevation_deg[i] es el horizonte en el azimut azimuth_start_deg + i * azimuth_step_deg;
// entre muestras se interpola linealmente y el perfil cierra el círculo (359° conecta con 0°).
// Sin DOM, para poder probarlo con `npm test`.
import { horizonStatus } from './ephemeris.js';

/**
 * Elevación del horizonte (grados) en `azimuthDeg` (0° = norte, sentido horario).
 * @param {object} horizon contenido de horizon.json
 * @param {number} azimuthDeg cualquier número finito; se lleva a [0, 360)
 */
export function horizonAt(horizon, azimuthDeg) {
  if (!Number.isFinite(azimuthDeg)) {
    throw new TypeError(`horizonAt: azimut inválido (${azimuthDeg}); se espera un número en grados`);
  }
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

/**
 * Estado de un cuerpo para el panel ('up' | 'partial' | 'down') comparando contra el horizonte
 * real en la dirección donde está (parte 2 de #32). Sin horizonte, compara contra 0° (Luna lisa).
 * @param {{azimuth_deg: number, elevation_deg: number}} position posición del Sol o la Tierra
 * @param {number} angularRadiusDeg radio angular del disco (angular_radius_deg del contrato)
 * @param {object} [horizon] contenido de horizon.json
 */
export function statusAgainstHorizon(position, angularRadiusDeg, horizon) {
  const horizonDeg = horizon ? horizonAt(horizon, position.azimuth_deg) : 0;
  return horizonStatus(position.elevation_deg, angularRadiusDeg, horizonDeg);
}

/** True si el horizon.json trae relieve real (campo `dem`); si no, es la Luna lisa (ADR-011). */
export function hasRelief(horizon) {
  return Boolean(horizon && horizon.dem);
}
