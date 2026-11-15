// Mapa 2D de los polos (panel de búsqueda): de dónde sale cada coordenada, sin DOM para poder probarlo con `npm test`.
//
// Las imágenes pole-south.png y pole-north.png son mosaicos polares en proyección ESTEREOGRÁFICA POLAR
// (r = k · tan(colatitud / 2)) que llegan hasta 55° de latitud. Se calibraron midiendo la propia imagen:
//  - los anillos de la retícula (80°, 70° y 60°) están a 93, 188 y 285 px (sur) y 96, 193 y 293 px (norte):
//    la proporción 1 : 2,02 : 3,06 es la de tan(5°) : tan(10°) : tan(15°), o sea estereográfica (la
//    equidistante daría 1 : 2 : 3);
//  - el centro y el radio del disco salen del canal alfa de cada PNG;
//  - la orientación se comprobó con cráteres de coordenadas conocidas: en el sur, 0° de longitud arriba y
//    el este a la derecha (Schrödinger 75°S 132,4°E abajo a la derecha, Zeeman 75,2°S 133,6°O abajo a la
//    izquierda); en el norte, 0° abajo y el este a la derecha (Plaskett 82,1°N 174,3°O arriba, Mare
//    Humboldtianum 56,8°N 81,5°E a la derecha).
// Convenciones del proyecto: latitud planetocéntrica y longitud este-positiva, en grados, [-180, 180].

const DEG = Math.PI / 180;

/** Latitud del borde del disco de ambos mapas (grados, en valor absoluto). */
export const MAP_EDGE_LAT_DEG = 55;

/**
 * Calibración de cada mapa, en píxeles del PNG original (no del tamaño en pantalla).
 * cx, cy: centro (el polo); k: píxeles por unidad de tan(colatitud / 2); lat0: signo del hemisferio;
 * rot: hacia dónde queda la longitud 0° (el eje y de la imagen crece hacia abajo).
 */
export const POLES = {
  south: { width: 720, height: 702, cx: 364, cy: 351.5, k: 1064, radius: 336, hemisphere: -1, lon0Dir: 'up' },
  north: { width: 720, height: 719, cx: 352.5, cy: 360.5, k: 1095, radius: 346, hemisphere: 1, lon0Dir: 'down' },
};

/** Normaliza una longitud a [-180, 180]. */
export function wrapLon(lon) {
  const w = ((((lon + 180) % 360) + 360) % 360) - 180;
  return w === -180 && lon > 0 ? 180 : w;
}

/**
 * Latitud y longitud de un punto del mapa.
 * @param {'south'|'north'} pole
 * @param {number} x píxel horizontal del PNG original (0 = borde izquierdo)
 * @param {number} y píxel vertical del PNG original (0 = borde de arriba)
 * @returns {{lat:number, lon:number}|null} null si cae fuera del disco del mapa
 */
export function pixelToLatLon(pole, x, y) {
  const p = POLES[pole];
  const dx = x - p.cx;
  const dy = y - p.cy;
  const r = Math.hypot(dx, dy);
  if (r > p.radius) return null;
  const colat = 2 * Math.atan(r / p.k) / DEG;
  const lat = p.hemisphere * (90 - colat);
  if (r === 0) return { lat, lon: 0 };
  // Azimut desde la dirección de la longitud 0° hacia el este (a la derecha en ambos mapas).
  const lon = p.lon0Dir === 'up' ? Math.atan2(dx, -dy) / DEG : Math.atan2(dx, dy) / DEG;
  return { lat, lon: wrapLon(lon) };
}

/**
 * Píxel del PNG donde cae una latitud y longitud (inversa de pixelToLatLon), para dibujar el puntero.
 * @returns {{x:number, y:number}|null} null si es del otro hemisferio o está más allá del borde (55°)
 */
export function latLonToPixel(pole, lat, lon) {
  const p = POLES[pole];
  if (lat * p.hemisphere < 0) return null; // del otro hemisferio
  const colat = 90 - Math.abs(lat);
  const r = p.k * Math.tan((colat * DEG) / 2);
  if (r > p.radius + 1e-6) return null;
  const a = lon * DEG;
  return p.lon0Dir === 'up'
    ? { x: p.cx + r * Math.sin(a), y: p.cy - r * Math.cos(a) }
    : { x: p.cx + r * Math.sin(a), y: p.cy + r * Math.cos(a) };
}

/** Redondeo a 2 decimales (~300 m): el píxel del mapa ya vale unos 3 km, no tiene sentido mostrar más. */
export const roundCoord = (v) => Math.round(v * 100) / 100;
