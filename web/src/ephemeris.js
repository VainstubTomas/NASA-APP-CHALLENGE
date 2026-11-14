// Lógica pura sobre ephemeris.json (contrato v1.0, docs/03-DATA-CONTRACT.md).
// Sin DOM, para poder probarla con `npm test`.

/**
 * Devuelve la muestra más cercana al instante pedido, o null si cae fuera de los datos.
 * La muestra i está en start_utc + i * step_s (contrato).
 * @param {object} ephemeris contenido de ephemeris.json
 * @param {number} utcMs instante en milisegundos UTC (Date.parse / Date.getTime)
 */
export function sampleAt(ephemeris, utcMs) {
  const { start_utc, step_s, count } = ephemeris.time;
  const index = Math.round((utcMs - Date.parse(start_utc)) / (step_s * 1000));
  if (!Number.isFinite(index) || index < 0 || index >= count) return null;
  const pick = (body) => ({
    azimuth_deg: ephemeris[body].azimuth_deg[index],
    elevation_deg: ephemeris[body].elevation_deg[index],
  });
  return {
    index,
    utcMs: Date.parse(start_utc) + index * step_s * 1000,
    sun: pick('sun'),
    earth: pick('earth'),
  };
}

/**
 * Regla de visibilidad del contrato (ADR-002): el borde superior del disco
 * está sobre el horizonte. Con la Luna lisa (ADR-011) el horizonte es 0°.
 */
export function isAboveHorizon(elevationDeg, angularRadiusDeg, horizonDeg = 0) {
  return elevationDeg + angularRadiusDeg > horizonDeg;
}

/**
 * Estado para mostrar: 'up' si el disco entero está sobre el horizonte
 * ("totalmente visible" del contrato), 'partial' si solo asoma el borde, 'down' si no se ve.
 */
export function horizonStatus(elevationDeg, angularRadiusDeg, horizonDeg = 0) {
  if (elevationDeg - angularRadiusDeg > horizonDeg) return 'up';
  return isAboveHorizon(elevationDeg, angularRadiusDeg, horizonDeg) ? 'partial' : 'down';
}

/**
 * Altura para mostrar: valor sin signo (1 decimal) y de qué lado del horizonte está.
 * Así el texto acompaña al número ("42,6° bajo el horizonte") en vez de contradecirlo.
 * Si redondeado da 0,0 se considera "sobre" (no mostrar "0,0° bajo el horizonte").
 */
export function elevationDisplay(elevationDeg) {
  const rounded = Number(elevationDeg.toFixed(1));
  return { value: Math.abs(rounded), side: rounded < 0 ? 'below' : 'above' };
}

const POINTS =['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];

/**
 * Azimut (0° = norte, sentido horario) al punto cardinal más cercano de 8.
 * Devuelve una clave neutra ('W' = oeste); el texto sale de compass.<clave> en i18n (#58).
 */
export function compassLabel(azimuthDeg) {
  const a = ((azimuthDeg % 360) + 360) % 360;
  return POINTS[Math.round(a / 45) % 8];
}

/**
 * Cuenta regresiva (C3-04): próximo cambio de visibilidad de un cuerpo desde utcMs.
 * Usa la regla del contrato (borde superior sobre el horizonte). Resolución = paso de los datos.
 * Si el cuerpo está visible busca la próxima puesta ('sets'); si no, la próxima salida ('rises').
 * Devuelve event: null si no hay cambio dentro de los datos, o null si utcMs está fuera de ellos.
 * @param {string} body 'sun' | 'earth'
 * @param {number|function} horizonDeg horizonte en grados, o función azimut -> grados
 */
export function nextVisibilityChange(ephemeris, utcMs, body, horizonDeg = 0) {
  const start = sampleAt(ephemeris, utcMs);
  if (!start) return null;
  const { count, step_s } = ephemeris.time;
  const radius = ephemeris.angular_radius_deg[body];
  const { azimuth_deg, elevation_deg } = ephemeris[body];
  const horizonAt = typeof horizonDeg === 'function' ? horizonDeg : () => horizonDeg;
  const visibleAt = (i) => isAboveHorizon(elevation_deg[i], radius, horizonAt(azimuth_deg[i]));
  // Margen sobre el horizonte del borde superior del disco; cambia de signo en la puesta/salida.
  const marginAt = (i) => elevation_deg[i] + radius - horizonAt(azimuth_deg[i]);

  const visible = visibleAt(start.index);
  for (let i = start.index + 1; i < count; i += 1) {
    if (visibleAt(i) !== visible) {
      const atMs = start.utcMs + (i - start.index) * step_s * 1000;
      // crossMs: cruce estimado por interpolación lineal entre la muestra anterior y esta.
      // atMs es la primera muestra ya cambiada (cota superior); crossMs es la mejor estimación.
      const m0 = marginAt(i - 1);
      const m1 = marginAt(i);
      const frac = m0 === m1 ? 1 : Math.min(1, Math.max(0, m0 / (m0 - m1)));
      const crossMs = atMs - (1 - frac) * step_s * 1000;
      return { visible, event: visible ? 'sets' : 'rises', atMs, inHours: (atMs - utcMs) / 3600000, crossMs };
    }
  }
  return { visible, event: null, atMs: null, inHours: null, crossMs: null };
}
