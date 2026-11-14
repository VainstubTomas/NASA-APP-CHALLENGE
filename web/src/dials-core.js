// Geometría de la brújula y la regla de elevación (#30). Sin DOM, para probarla con `npm test`.
// Brújula: 0° = norte arriba, sentido horario (convención del repo). Regla: 0° = horizonte, 90° = cenit.

export const COMPASS = { size: 240, cx: 120, cy: 120, radius: 70 };

/** Punto (x, y) del SVG a distancia `r` del centro de la brújula en el azimut dado. */
export function compassPoint(azimuthDeg, r = COMPASS.radius) {
  const a = (azimuthDeg * Math.PI) / 180;
  return [COMPASS.cx + r * Math.sin(a), COMPASS.cy - r * Math.cos(a)];
}

// Regla vertical: yTop = 90°, y0 = 0° (horizonte); debajo hay una banda de `belowDeg` grados "bajo el horizonte".
export const RULER = { width: 240, height: 230, yTop: 14, y0: 180, belowDeg: 20 };
const PX_PER_DEG = (RULER.y0 - RULER.yTop) / 90;

/** Posición vertical (y del SVG) de una elevación en grados; se recorta a [-belowDeg, 90]. */
export function rulerY(elevationDeg) {
  const el = Math.min(90, Math.max(-RULER.belowDeg, elevationDeg));
  return RULER.y0 - el * PX_PER_DEG;
}

/** Radio en px de un disco de radio angular `radiusDeg`, con un mínimo para que se vea. */
export function rulerRadius(radiusDeg, minPx = 7) {
  return Math.max(minPx, radiusDeg * PX_PER_DEG);
}
