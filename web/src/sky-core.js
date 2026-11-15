// Lógica de la vista del cielo (rediseño #99), sin DOM para poder probarla con `npm test`.
// La vista es una cámara parada en el sitio: mira hacia un rumbo (azimut, 0° = norte, horario)
// y puede subir la mirada (tilt). Proyección equirectangular: grados → píxeles con la misma
// escala en horizontal y vertical, así el Sol y la Tierra se dibujan con su tamaño angular real.
import { compassLabel, isAboveHorizon } from './ephemeris.js';

/** Campo de visión horizontal de la vista, en grados. */
export const FOV_DEG = 60;
/** Cuánto gira cada flecha lateral. */
export const ROTATE_STEP_DEG = 45;
/** Cuánto sube la mirada la flecha de arriba, y hasta dónde. */
export const TILT_STEP_DEG = 10;
export const TILT_MAX_DEG = 30;
/** Radio mínimo de un disco en pantalla, para que el Sol no desaparezca en pantallas chicas. */
export const MIN_DISC_PX = 4;

export const normAz = (a) => ((a % 360) + 360) % 360;

/** Diferencia azimut − rumbo en (−180, 180]: negativo = a la izquierda. */
export function relAz(az, heading) {
  const d = normAz(az - heading);
  return d > 180 ? d - 360 : d;
}

export const rotate = (heading, delta) => normAz(heading + delta);
export const tiltUp = (tilt) => Math.min(TILT_MAX_DEG, tilt + TILT_STEP_DEG);
export const tiltDown = (tilt) => Math.max(0, tilt - TILT_STEP_DEG);
/** Inclinación al arrastrar el cielo: entre el horizonte (0°) y el máximo. */
export const clampTilt = (tilt) => Math.min(TILT_MAX_DEG, Math.max(0, tilt));

export const pxPerDeg = (width, fov = FOV_DEG) => width / fov;

/**
 * Posición en pantalla de un cuerpo.
 * @param {{azimuth_deg:number, elevation_deg:number}} pos
 * @param {{heading:number, tilt:number, width:number, horizonY:number, fov?:number}} view
 *   horizonY: altura en píxeles del horizonte (0°) cuando la mirada no está inclinada.
 */
export function project(pos, view) {
  const k = pxPerDeg(view.width, view.fov);
  const rel = relAz(pos.azimuth_deg, view.heading);
  const x = view.width / 2 + rel * k;
  const y = view.horizonY + view.tilt * k - pos.elevation_deg * k;
  const half = (view.fov ?? FOV_DEG) / 2;
  return { x, y, rel, onScreen: Math.abs(rel) <= half };
}

export const discRadiusPx = (radiusDeg, k) => Math.max(MIN_DISC_PX, radiusDeg * k);

/** Marcas de la brújula visibles: cada 5°, con el punto cardinal en los múltiplos de 45°. */
export function compassTicks(heading, fov = FOV_DEG, step = 5) {
  const half = fov / 2;
  const first = Math.ceil((heading - half) / step) * step;
  const ticks = [];
  for (let a = first; a <= heading + half + 1e-9; a += step) {
    const az = normAz(a);
    ticks.push({ az, rel: a - heading, point: az % 45 === 0 ? compassLabel(az) : null });
  }
  return ticks;
}

const pad = (n) => String(n).padStart(2, '0');

/** "16 d 13 h 05 m", "5 h 07 m" o "42 m" (nunca negativo). */
export function shortDuration(ms) {
  const totalMin = Math.max(0, Math.floor(ms / 60000));
  const d = Math.floor(totalMin / 1440);
  const h = Math.floor((totalMin % 1440) / 60);
  const m = totalMin % 60;
  if (d > 0) return `${d} d ${h} h ${pad(m)} m`;
  if (h > 0) return `${h} h ${pad(m)} m`;
  return `${m} m`;
}

/** Rango vertical del gráfico chico: −5° a 15°, y más alto (de a 5°) si un cuerpo lo supera. */
export function chartRange(elevations) {
  const top = Math.max(...elevations);
  const max = top <= 13 ? 15 : Math.min(90, Math.ceil((top + 5) / 5) * 5);
  return { min: -5, max };
}

/** Rumbo con el que arranca la vista: el Sol si asoma, si no la Tierra, si no el norte. */
export function initialHeading(sun, earth, sunRadius, earthRadius) {
  if (isAboveHorizon(sun.elevation_deg, sunRadius)) return sun.azimuth_deg;
  if (isAboveHorizon(earth.elevation_deg, earthRadius)) return earth.azimuth_deg;
  return 0;
}

/**
 * Qué hacer al tocar "Aplicar" en el panel de búsqueda (nada se aplica antes).
 * mode: 'historical' (sitio de sites.json), 'location' (latitud y longitud, API en vivo) o 'map'.
 * current / chosen: { site, time } con time en el formato de <input type="datetime-local"> (UTC).
 * Devuelve los pasos en orden: { type: 'site' | 'time', value } y { type: 'live' } (consultar la API).
 */
export function applyPlan({ mode, current, chosen }) {
  const steps = [];
  const timeChanged = Boolean(chosen.time) && chosen.time !== current.time;
  if (mode === 'historical') {
    if (chosen.site && chosen.site !== current.site) steps.push({ type: 'site', value: chosen.site });
    if (timeChanged) steps.push({ type: 'time', value: chosen.time });
  } else if (mode === 'location') {
    if (timeChanged) steps.push({ type: 'time', value: chosen.time });
    steps.push({ type: 'live' });
  }
  return steps;
}
