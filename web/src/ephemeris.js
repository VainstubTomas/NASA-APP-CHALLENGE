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
 * Regla de visibilidad provisional del contrato: el borde superior del disco
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

const POINTS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];

/**
 * Azimut (0° = norte, sentido horario) al punto cardinal más cercano de 8.
 * Devuelve una clave neutra ('W' = oeste); el texto sale de compass.<clave> en i18n (#58).
 */
export function compassLabel(azimuthDeg) {
  const a = ((azimuthDeg % 360) + 360) % 360;
  return POINTS[Math.round(a / 45) % 8];
}
