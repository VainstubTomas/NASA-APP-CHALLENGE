// Resumen de la comparación (#94, sin DOM). Decisión del equipo (ADR-017): la herramienta NO dice cuál escenario
// "conviene". Por cada métrica (horas de Sol y horas de Tierra visible) marca cuál tiene más horas, en forma
// independiente, y deja que la persona decida según los requisitos de su misión (energía, comunicación o equilibrio).
// Regla matemática: un escenario "tiene más" si supera en esa métrica a cada uno de los otros; si hay varios al tope
// empatados, se marcan todos; si todos tienen lo mismo, es igual. No hay umbral ni puntaje combinado.
// Devuelve los datos para armar la frase; los textos están en i18n (compare.summary.*).

/**
 * Compara una métrica entre los escenarios con datos.
 * @returns {{kind: 'more', ids: string[], hours: number, otherHours: number} | {kind: 'equal', hours: number}}
 *   `ids` son los escenarios con más horas (en el orden de la lista), `hours` las suyas y `otherHours` las del
 *   siguiente (el mejor de los demás).
 */
function compareMetric(valid, metric) {
  const top = Math.max(...valid.map((s) => s.summary[metric]));
  const leaders = valid.filter((s) => s.summary[metric] === top);
  if (leaders.length === valid.length) return { kind: 'equal', hours: top };
  const rest = valid.filter((s) => s.summary[metric] !== top);
  return {
    kind: 'more',
    ids: leaders.map((s) => s.id),
    hours: top,
    otherHours: Math.max(...rest.map((s) => s.summary[metric])),
  };
}

/**
 * Si recibe grupos de escenarios repetidos (groupScenarios, #107), cada grupo cuenta una vez; si todos los
 * escenarios con datos son el mismo caso, no hay nada que comparar: kind 'same'.
 * @param {{id: string, ns?: number[], summary: {sunHours: number, earthHours: number}|null}[]} scenarios
 * @returns {{kind: 'metrics', sun: object, earth: object}
 *         | {kind: 'same', id: string, ns: number[]}
 *         | {kind: 'only', id: string}
 *         | {kind: 'none'}}
 */
export function compareMetrics(scenarios) {
  const valid = scenarios.filter((s) => s.summary !== null);
  if (valid.length === 0) return { kind: 'none' };
  if (valid.length === 1) {
    const ns = valid[0].ns ?? [];
    return ns.length > 1 ? { kind: 'same', id: valid[0].id, ns } : { kind: 'only', id: valid[0].id };
  }
  return { kind: 'metrics', sun: compareMetric(valid, 'sunHours'), earth: compareMetric(valid, 'earthHours') };
}
