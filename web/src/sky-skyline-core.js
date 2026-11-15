// Silueta del relieve en la vista del cielo (C5-08, #52), sin DOM para poder probarla con `npm test`.
// Convierte el perfil de horizon.json (360 valores) en puntos de pantalla con la misma proyección que los discos
// del Sol y la Tierra (sky-core.js `project`): x = centro + (azimut - rumbo) * k; y = horizonte - elevación * k.
import { horizonAt } from './horizon.js';

/**
 * Puntos de la silueta de izquierda a derecha de la pantalla.
 * El terreno bajo 0° no se dibuja: el suelo plano de la vista ya tapa todo lo que está bajo el horizonte, así
 * que la silueta solo suma las montañas y los bordes de cráter que se levantan sobre él.
 * @param {object} horizon contenido de horizon.json
 * @param {{heading: number, width: number, k: number, hy: number, stepPx?: number}} view
 *   heading: rumbo del centro (grados); width: ancho en px; k: px por grado; hy: y del horizonte plano en px.
 * @returns {{x: number, y: number}[]}
 */
export function skylinePoints(horizon, { heading, width, k, hy, stepPx = 4 }) {
  const points = [];
  const at = (x) => {
    // horizonAt lleva cualquier azimut a [0, 360): no hace falta normalizar al cruzar el norte.
    const az = heading + (x - width / 2) / k;
    return { x, y: hy - Math.max(0, horizonAt(horizon, az)) * k };
  };
  for (let x = 0; x < width; x += stepPx) points.push(at(x));
  points.push(at(width));
  return points;
}

/**
 * Perfil para el gráfico de 360°: un punto por grado de 0° a 360° (el último cierra el círculo).
 * Sin horizonte devuelve una línea en 0° (Luna lisa).
 * @returns {{az: number, elevation: number}[]}
 */
export function chartProfile(horizon) {
  return Array.from({ length: 361 }, (_, az) => ({ az, elevation: horizon ? horizonAt(horizon, az) : 0 }));
}

// ---- Luz sobre la silueta ----
// La silueta reacciona al Sol y a la Tierra como el suelo 3D (sky-ground.js): se ilumina según de dónde llega la
// luz de Horizons, y de noche queda solo la luz de la Tierra. Es un modelo simple y barato, no un trazado de rayos:
// cada tramo se trata como una ladera inclinada que mira hacia el observador.
const RAD = Math.PI / 180;
/** Inclinación supuesta de las laderas que se ven (grados): de la vertical a plano. */
const FACE_TILT_DEG = 30;
const AMBIENT = 0.05; // luz de fondo: la silueta nunca queda negra del todo
const SUN_STRENGTH = 0.85; // igual que el suelo 3D
const EARTH_STRENGTH = 0.08; // la Tierra ilumina muy poco; se realza un poco para que la noche se distinga
const EDGE_BASE = 0.4; // brillo del borde sin luz especial
const EDGE_GLOW = 0.6; // lo que suma el borde cuando el Sol está justo detrás de la cresta

const clamp01 = (x) => Math.min(1, Math.max(0, x));
/** Fracción visible del disco sobre el horizonte plano: 0 = bajo el horizonte, 1 = entero arriba. */
const discFraction = (elevationDeg, radiusDeg) => clamp01((elevationDeg + radiusDeg) / (2 * radiusDeg));

/** Cuánto le pega la luz de `body` a una ladera de la silueta que mira hacia el observador (0 a 1). */
function lambert(azimuthDeg, body) {
  const tilt = FACE_TILT_DEG * RAD;
  const el = body.elevation_deg * RAD;
  // La ladera que se ve mira hacia el observador: su horizontal apunta al azimut contrario al del punto.
  const dot = Math.cos(tilt) * Math.cos(el) * Math.cos((body.azimuth_deg - azimuthDeg - 180) * RAD)
    + Math.sin(tilt) * Math.sin(el);
  return Math.max(0, dot);
}

/**
 * Brillo (0 a 1) de la silueta en un azimut. Depende de dónde están el Sol y la Tierra y de cuánto de su disco
 * asoma sobre el horizonte; sin muestra (sin datos) queda solo la luz de fondo.
 * @param {number} azimuthDeg azimut del tramo de silueta
 * @param {{sun: {azimuth_deg: number, elevation_deg: number}, earth: {azimuth_deg: number, elevation_deg: number}}|null} light
 * @param {{sun: number, earth: number}} radii angular_radius_deg del contrato
 */
export function skylineLight(azimuthDeg, light, radii) {
  if (!light) return AMBIENT;
  const sun = SUN_STRENGTH * discFraction(light.sun.elevation_deg, radii.sun) * lambert(azimuthDeg, light.sun);
  const earth = EARTH_STRENGTH * discFraction(light.earth.elevation_deg, radii.earth) * lambert(azimuthDeg, light.earth);
  return clamp01(AMBIENT + sun + earth);
}

/**
 * Brillo (0 a 1) del borde de la silueta en un azimut: se aviva donde el Sol está justo detrás de la cresta
 * (cerca del horizonte y cerca de ese azimut), como el resplandor de un Sol que está por asomar o por ocultarse.
 */
export function skylineEdge(azimuthDeg, light, radii) {
  if (!light) return EDGE_BASE;
  const d = Math.abs(((azimuthDeg - light.sun.azimuth_deg + 540) % 360) - 180);
  const near = Math.exp(-((d / 6) ** 2));
  const low = Math.exp(-((Math.max(0, light.sun.elevation_deg) / 12) ** 2));
  return clamp01(EDGE_BASE + EDGE_GLOW * near * low * discFraction(light.sun.elevation_deg, radii.sun));
}

const DARK = [29, 31, 36];
const LIT = [172, 175, 182];
/** Color de relleno para un brillo entre 0 (noche) y 1 (iluminado), como `rgb(r, g, b)`. */
export function lightColor(brightness) {
  const b = clamp01(brightness);
  const [r, g, bl] = DARK.map((from, i) => Math.round(from + (LIT[i] - from) * b));
  return `rgb(${r}, ${g}, ${bl})`;
}
