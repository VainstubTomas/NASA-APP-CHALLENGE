const isObject = (value) => value !== null && typeof value === 'object';
const isFiniteNumber = (value) => typeof value === 'number' && Number.isFinite(value);

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function checkAngles(values, name, min, max, inclusiveMax = true) {
  assert(Array.isArray(values), `${name} debe ser un arreglo`);
  values.forEach((value, index) => {
    assert(isFiniteNumber(value), `${name}[${index}] no es un número`);
    assert(value >= min && (inclusiveMax ? value <= max : value < max), `${name}[${index}] está fuera de rango`);
  });
}

export function checkEphemeris(value, expectedSiteId) {
  assert(isObject(value), 'ephemeris.json debe ser un objeto');
  assert(value.schema_version === '1.0', 'ephemeris.json: schema_version debe ser 1.0');
  assert(value.site_id === expectedSiteId, `ephemeris.json: site_id debe ser ${expectedSiteId}`);
  assert(isObject(value.time), 'ephemeris.json: falta time');
  const { start_utc, step_s, count } = value.time;
  assert(typeof start_utc === 'string' && start_utc.endsWith('Z') && !Number.isNaN(Date.parse(start_utc)),
    'ephemeris.json: start_utc debe ser una fecha UTC válida');
  assert(isFiniteNumber(step_s) && step_s > 0, 'ephemeris.json: step_s debe ser positivo');
  assert(Number.isInteger(count) && count > 0, 'ephemeris.json: count debe ser entero positivo');
  for (const body of ['sun', 'earth']) {
    assert(isObject(value[body]), `ephemeris.json: falta ${body}`);
    checkAngles(value[body].azimuth_deg, `${body}.azimuth_deg`, 0, 360, false);
    checkAngles(value[body].elevation_deg, `${body}.elevation_deg`, -90, 90);
    assert(value[body].azimuth_deg.length === count && value[body].elevation_deg.length === count,
      `ephemeris.json: las series de ${body} deben tener count valores`);
  }
  assert(isObject(value.angular_radius_deg), 'ephemeris.json: falta angular_radius_deg');
  for (const body of ['sun', 'earth']) {
    assert(isFiniteNumber(value.angular_radius_deg[body]) && value.angular_radius_deg[body] >= 0,
      `ephemeris.json: radio de ${body} inválido`);
  }
  return value;
}

export function checkHorizon(value, expectedSiteId) {
  assert(isObject(value), 'horizon.json debe ser un objeto');
  assert(value.schema_version === '1.0', 'horizon.json: schema_version debe ser 1.0');
  assert(value.site_id === expectedSiteId, `horizon.json: site_id debe ser ${expectedSiteId}`);
  assert(isFiniteNumber(value.azimuth_start_deg), 'horizon.json: falta azimuth_start_deg');
  assert(isFiniteNumber(value.azimuth_step_deg) && value.azimuth_step_deg > 0, 'horizon.json: azimuth_step_deg inválido');
  checkAngles(value.elevation_deg, 'elevation_deg', -90, 90);
  assert(value.elevation_deg.length > 1, 'horizon.json: el perfil debe tener al menos dos valores');
  assert(value.elevation_deg.length * value.azimuth_step_deg >= 360,
    'horizon.json: el perfil debe cubrir 360 grados');
  return value;
}
