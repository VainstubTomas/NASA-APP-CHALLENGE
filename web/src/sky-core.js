// Lógica de la vista del cielo (rediseño #99), sin DOM para poder probarla con `npm test`.
// La vista es una cámara parada en el sitio: mira hacia un rumbo (azimut, 0° = norte, horario)
// y puede subir la mirada (tilt). Proyección equirectangular: grados → píxeles con la misma
// escala en horizontal y vertical, así el Sol y la Tierra se dibujan con su tamaño angular real.
import { compassLabel, isAboveHorizon } from './ephemeris.js';

/** Campo de visión horizontal de la vista, en grados. */
export const FOV_DEG = 60;
/** Zoom con la rueda del mouse: límites del campo de visión. */
export const FOV_MIN_DEG = 20;
export const FOV_MAX_DEG = 100;
/** Cuánto cambia el campo por unidad de rueda (escala logarítmica: acercar y alejar son simétricos). */
const ZOOM_RATE = 0.0015;
/** Cuánto gira cada flecha lateral. */
export const ROTATE_STEP_DEG = 45;
/** Cuánto sube la mirada la flecha de arriba (el máximo lo da tiltMax: hasta el cenit). */
export const TILT_STEP_DEG = 10;
/** Radio mínimo de un disco en pantalla, para que el Sol no desaparezca en pantallas chicas. */
export const MIN_DISC_PX = 4;

export const normAz = (a) => ((a % 360) + 360) % 360;

/** Diferencia azimut − rumbo en (−180, 180]: negativo = a la izquierda. */
export function relAz(az, heading) {
  const d = normAz(az - heading);
  return d > 180 ? d - 360 : d;
}

export const rotate = (heading, delta) => normAz(heading + delta);
/**
 * Inclinación máxima: la que deja el cenit (90°) justo en el borde de arriba de la pantalla.
 * @param {number} horizonY distancia en píxeles del borde superior al horizonte sin inclinar
 * @param {number} k píxeles por grado
 */
export const tiltMax = (horizonY, k) => Math.max(0, 90 - horizonY / k);
export const tiltUp = (tilt, max) => Math.min(max, tilt + TILT_STEP_DEG);
/** Inclinación mínima (negativa = mirar hacia abajo): deja el horizonte a `margin` px del borde de arriba. */
export const tiltMin = (horizonY, k, margin = 150) => Math.min(0, -(horizonY - margin) / k) || 0;
export const tiltDown = (tilt, min = 0) => Math.max(min, tilt - TILT_STEP_DEG);
/** Inclinación al arrastrar el cielo: entre `min` (por defecto el horizonte, 0°) y el máximo. */
export const clampTilt = (tilt, max, min = 0) => Math.min(max, Math.max(min, tilt));

export const pxPerDeg = (width, fov = FOV_DEG) => width / fov;

/**
 * Inclinación que deja un cuerpo de elevación `elevation` a media altura de la pantalla
 * (inversa de la `y` de project). Sin redondear: con zoom fuerte, un paso de más lo saca de la vista.
 */
export const tiltToCenter = (elevation, horizonY, height, k) => elevation - (horizonY - height / 2) / k;

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
 * mode: 'historical' (sitio de sites.json), 'location' (latitud y longitud, API en vivo) o 'map' (clic en el mapa).
 * current / chosen: { site, time } con time en el formato de <input type="datetime-local"> (UTC).
 * Devuelve los pasos en orden: { type: 'site' | 'time', value } y { type: 'live' } (consultar la API).
 */
export function applyPlan({ mode, current, chosen }) {
  const steps = [];
  const timeChanged = Boolean(chosen.time) && chosen.time !== current.time;
  if (mode === 'historical') {
    if (chosen.site && chosen.site !== current.site) steps.push({ type: 'site', value: chosen.site });
    if (timeChanged) steps.push({ type: 'time', value: chosen.time });
  } else if (mode === 'location' || mode === 'map') {
    // El mapa completa latitud y longitud y, de ahí en adelante, es igual que la ubicación específica.
    if (timeChanged) steps.push({ type: 'time', value: chosen.time });
    steps.push({ type: 'live' });
  }
  return steps;
}

/** Campo de visión después de mover la rueda `deltaY` (negativo = acercar). */
export function zoomFov(fov, deltaY) {
  return Math.min(FOV_MAX_DEG, Math.max(FOV_MIN_DEG, fov * Math.exp(deltaY * ZOOM_RATE)));
}

// Generador pseudoaleatorio con semilla (mulberry32): las estrellas no cambian entre cargas.
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Colores según la temperatura de la estrella: de azuladas a rojizas, casi todas blancas.
const STAR_COLORS = ['#9bb0ff', '#aabfff', '#cad7ff', '#f8f7ff', '#ffffff', '#fff4ea', '#ffd2a1', '#ffcc6f'];
const STAR_COLOR_WEIGHTS = [0.03, 0.07, 0.15, 0.3, 0.2, 0.14, 0.07, 0.04];

/**
 * Campo de estrellas decorativo (no es un catálogo): posiciones al azar repartidas parejo en la
 * semiesfera del cielo, brillo con muchas débiles y pocas brillantes (como el cielo real) y color
 * según temperatura. Sin atmósfera en la Luna no titilan.
 * @returns {{az:number, el:number, alpha:number, size:number, color:string}[]}
 */
export function makeStars(count, seed = 1) {
  const rand = rng(seed);
  const stars = [];
  for (let i = 0; i < count; i += 1) {
    const az = rand() * 360;
    const el = (Math.asin(rand()) * 180) / Math.PI; // uniforme sobre la semiesfera
    const m = rand() ** 3; // la mayoría débiles
    let pick = rand();
    let c = 0;
    while (c < STAR_COLORS.length - 1 && pick > STAR_COLOR_WEIGHTS[c]) {
      pick -= STAR_COLOR_WEIGHTS[c];
      c += 1;
    }
    stars.push({
      az: Math.min(az, 359.999999),
      el,
      alpha: 0.15 + 0.85 * m,
      size: 0.5 + 1.5 * m,
      color: STAR_COLORS[c],
    });
  }
  return stars;
}

/**
 * Ángulo de la flecha que va del punto (x0, y0) al (x1, y1) en pantalla: 0° = arriba,
 * sentido horario, en [0, 360). Sirve también para cuerpos fuera de la vista (project los deja
 * fuera del ancho de la pantalla, del lado hacia el que hay que girar).
 */
export function pointerAngle(x0, y0, x1, y1) {
  return normAz((Math.atan2(x1 - x0, y0 - y1) * 180) / Math.PI);
}

/**
 * true si el punto (x, y) cae en la zona central de la pantalla: el `fraction` del medio en ancho
 * y en alto (por defecto, la mitad). Ahí el cuerpo ya está a la vista y la flecha sobra.
 */
export function nearCenter(x, y, width, height, fraction = 0.5) {
  return Math.abs(x - width / 2) <= (width * fraction) / 2 && Math.abs(y - height / 2) <= (height * fraction) / 2;
}

/**
 * Azimut (0° a 360°) que corresponde a una posición horizontal del gráfico de 360°.
 * x0 y x1 son los bordes del gráfico en las mismas unidades que x; fuera de ellos se recorta al borde.
 */
export function chartXToAz(x, x0, x1) {
  const f = Math.max(0, Math.min(1, (x - x0) / (x1 - x0)));
  return normAz(f * 360);
}

/**
 * Qué hace el clic en un indicador de la cuenta regresiva (Sol o Tierra).
 * Con un cruce del horizonte en los datos salta a ese momento (`atMs`): la primera hora con el cuerpo
 * visible si está oculto (sale), o la primera hora con el cuerpo ya oculto si está visible (se pone).
 * Sin cruce en los datos: solo gira la vista hacia el cuerpo.
 * @param {{visible:boolean, event:string|null, atMs:number|null}|null} change resultado de nextVisibilityChange
 * @returns {{type:'jump', ms:number} | {type:'look'}}
 */
export function countdownAction(change) {
  if (change?.event && change.atMs != null) return { type: 'jump', ms: change.atMs };
  return { type: 'look' };
}
