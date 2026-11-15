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
  // Margen sobre el horizonte del borde superior del disco; cambia de signo en la puesta/salida.
  const marginAt = (i) => elevation_deg[i] + radius - horizonAt(azimuth_deg[i]);

  // El estado se evalúa en el instante pedido (interpolando entre las dos muestras que lo rodean) y
  // no en la muestra más cercana: con datos horarios esa muestra puede estar hasta 30 min antes o
  // después, y el cruce podía quedar del lado equivocado (por ejemplo, "se pone en 0 m" con el cuerpo ya oculto).
  const stepMs = step_s * 1000;
  const t0 = Date.parse(ephemeris.time.start_utc);
  const pos = (utcMs - t0) / stepMs;
  const i0 = Math.min(count - 1, Math.max(0, Math.floor(pos)));
  const frac0 = i0 + 1 < count ? pos - i0 : 0;
  const marginNow = i0 + 1 < count ? marginAt(i0) + (marginAt(i0 + 1) - marginAt(i0)) * frac0 : marginAt(i0);
  const visible = marginNow > 0;
  for (let i = i0; i + 1 < count; i += 1) {
    const m0 = marginAt(i);
    const m1 = marginAt(i + 1);
    if (m0 > 0 === m1 > 0) continue;
    // crossMs: cruce estimado por interpolación lineal entre las dos muestras. atMs es la primera
    // muestra ya cambiada (cota superior); crossMs es la mejor estimación.
    const frac = Math.min(1, Math.max(0, m0 / (m0 - m1)));
    const crossMs = t0 + (i + frac) * stepMs;
    if (crossMs <= utcMs) continue; // ese cruce ya pasó: el estado de ahora ya lo incluye
    const atMs = t0 + (i + 1) * stepMs;
    return { visible, event: visible ? 'sets' : 'rises', atMs, inHours: (atMs - utcMs) / 3600000, crossMs };
  }
  return { visible, event: null, atMs: null, inHours: null, crossMs: null };
}
