// Revisión en la web del formato de los JSON que genera Python (#32, "primera unión").
// Es lo mínimo que la web necesita para no dibujar números raros; el esquema completo se valida
// en Python con tests/test_contract.py. Cada función devuelve una lista de problemas (vacía = OK).

const ISO_UTC = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/;
const isNum = (x) => typeof x === 'number' && Number.isFinite(x);

function checkSeries(problems, name, values, count, min, max, maxExclusive = false) {
  if (!Array.isArray(values)) {
    problems.push(`${name} no es una lista`);
    return;
  }
  if (values.length !== count) problems.push(`${name} tiene ${values.length} valores y time.count es ${count}`);
  const bad = values.findIndex((v) => !isNum(v) || v < min || (maxExclusive ? v >= max : v > max));
  if (bad !== -1) problems.push(`${name}[${bad}] = ${values[bad]} está fuera de [${min}, ${max}${maxExclusive ? ')' : ']'}`);
}

/** Problemas de un ephemeris.json respecto de lo que espera la web. */
export function checkEphemeris(eph, siteId) {
  const problems = [];
  if (eph?.schema_version !== '1.0') problems.push(`schema_version es ${eph?.schema_version}, se espera 1.0`);
  if (eph?.site_id !== siteId) problems.push(`site_id es ${eph?.site_id}, se espera ${siteId}`);
  const time = eph?.time ?? {};
  if (!ISO_UTC.test(time.start_utc ?? '')) problems.push(`time.start_utc (${time.start_utc}) no es UTC ISO 8601`);
  if (!Number.isInteger(time.step_s) || time.step_s < 1) problems.push(`time.step_s (${time.step_s}) no es un entero positivo`);
  if (!Number.isInteger(time.count) || time.count < 1) problems.push(`time.count (${time.count}) no es un entero positivo`);
  for (const body of ['sun', 'earth']) {
    checkSeries(problems, `${body}.azimuth_deg`, eph?.[body]?.azimuth_deg, time.count, 0, 360, true);
    checkSeries(problems, `${body}.elevation_deg`, eph?.[body]?.elevation_deg, time.count, -90, 90);
    const r = eph?.angular_radius_deg?.[body];
    if (!isNum(r) || r <= 0) problems.push(`angular_radius_deg.${body} (${r}) no es un número positivo`);
  }
  return problems;
}

/** Problemas de un horizon.json respecto de lo que espera la web. */
export function checkHorizon(hor, siteId) {
  const problems = [];
  if (hor?.schema_version !== '1.0') problems.push(`schema_version es ${hor?.schema_version}, se espera 1.0`);
  if (hor?.site_id !== siteId) problems.push(`site_id es ${hor?.site_id}, se espera ${siteId}`);
  const step = hor?.azimuth_step_deg;
  if (!isNum(hor?.azimuth_start_deg)) problems.push(`azimuth_start_deg (${hor?.azimuth_start_deg}) no es un número`);
  if (!isNum(step) || step <= 0) problems.push(`azimuth_step_deg (${step}) no es un número positivo`);
  const values = hor?.elevation_deg;
  if (!Array.isArray(values)) {
    problems.push('elevation_deg no es una lista');
  } else {
    if (isNum(step) && Math.abs(values.length * step - 360) > 1e-9) {
      problems.push(`elevation_deg tiene ${values.length} valores con paso ${step}°: no cubre 360°`);
    }
    const bad = values.findIndex((v) => !isNum(v) || v < -90 || v > 90);
    if (bad !== -1) problems.push(`elevation_deg[${bad}] = ${values[bad]} no es una elevación válida`);
  }
  return problems;
}
