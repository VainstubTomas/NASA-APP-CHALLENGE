// Suelo ilustrativo de la vista del cielo (rediseño #99), sin DOM para poder probarlo con `npm test`.
// NO es topografía real: es un terreno generado (cráteres y ondulaciones) para que el suelo se vea
// lunar. Por eso está acotado para no contradecir a los datos: ningún punto sube por encima de
// los ojos del observador, así que nunca asoma sobre el horizonte de 0° (Luna lisa, ADR-011).
// El relieve real (LOLA) es la capa 5 y llega por horizon.json.

/** Radio medio de la Luna, en metros. */
export const MOON_RADIUS_M = 1737400;
/** Altura de los ojos del observador sobre el suelo, en metros. */
export const EYE_M = 1.7;
/** Altura máxima del terreno: siempre por debajo de los ojos (el suelo no tapa el horizonte). */
export const MAX_HEIGHT_M = 1.4;

/** Cuánto baja el suelo por la curvatura a `d` metros (aproximación d² / 2R). */
export const curvatureDrop = (d) => (d * d) / (2 * MOON_RADIUS_M);
/** Distancia al horizonte geométrico para unos ojos a `eye` metros. */
export const horizonDistance = (eye) => Math.sqrt(2 * MOON_RADIUS_M * eye);

/** Elevación (grados) con la que se ve un punto del suelo a `d` metros y `h` de altura. */
export function elevationOfPoint(d, h) {
  return (Math.atan2(h - curvatureDrop(d) - EYE_M, d) * 180) / Math.PI;
}

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

// Poblaciones de cráteres: muchos chicos cerca, menos medianos más lejos, pocos grandes.
// Diámetros con distribución de potencia (como la superficie real: N(>D) ∝ D^-2).
const POPULATIONS = [
  { count: 420, dMin: 1, dMax: 8, rMax: 160 },
  { count: 170, dMin: 8, dMax: 60, rMax: 1100 },
  { count: 18, dMin: 60, dMax: 300, rMax: 3200 },
];

/** Lista de cráteres { x, z, d, depth, rim, fresh } (metros). Ninguno queda bajo los pies. */
export function makeCraters(seed = 11) {
  const rand = rng(seed);
  const craters = [];
  for (const pop of POPULATIONS) {
    let made = 0;
    while (made < pop.count) {
      // Potencia: D = dMin * (1 - u * (1 - (dMin/dMax)^2))^(-1/2)
      const u = rand();
      const d = pop.dMin / Math.sqrt(1 - u * (1 - (pop.dMin / pop.dMax) ** 2));
      const r = Math.sqrt(rand()) * pop.rMax; // parejo en área
      const a = rand() * Math.PI * 2;
      const x = r * Math.sin(a);
      const z = r * Math.cos(a);
      const fresh = rand();
      if (Math.hypot(x, z) <= d / 2 + 3) continue; // nada debajo del observador
      craters.push({
        x, z, d,
        depth: d * (0.12 + 0.08 * fresh), // los frescos son más profundos
        rim: d * (0.02 + 0.025 * fresh),
        fresh,
      });
      made += 1;
    }
  }
  return craters;
}

// Ruido de valor 2D suave (para ondulaciones), determinista.
function valueNoise(seed) {
  const perm = new Uint16Array(512);
  const rand = rng(seed);
  const p = [...Array(256).keys()];
  for (let i = 255; i > 0; i -= 1) {
    const j = Math.floor(rand() * (i + 1));
    [p[i], p[j]] = [p[j], p[i]];
  }
  for (let i = 0; i < 512; i += 1) perm[i] = p[i & 255];
  const vals = new Float32Array(256).map(() => rand() * 2 - 1);
  const fade = (t) => t * t * (3 - 2 * t);
  return (x, y) => {
    const xi = Math.floor(x);
    const yi = Math.floor(y);
    const xf = x - xi;
    const yf = y - yi;
    const h = (i, j) => vals[perm[(perm[(xi + i) & 255] + yi + j) & 255]];
    const u = fade(xf);
    const v = fade(yf);
    const a = h(0, 0) + (h(1, 0) - h(0, 0)) * u;
    const b = h(0, 1) + (h(1, 1) - h(0, 1)) * u;
    return a + (b - a) * v;
  };
}

/**
 * Terreno: { height(x, z) } en metros, sin curvatura (la curvatura la aplica quien dibuja).
 * Ondulaciones suaves + cráteres con borde levantado, todo acotado a MAX_HEIGHT_M.
 */
export function createTerrain(seed = 11) {
  const craters = makeCraters(seed);
  const noise = valueNoise(seed + 1);
  // Grilla para buscar solo los cráteres cercanos a cada punto.
  const CELL = 40;
  const grid = new Map();
  for (const c of craters) {
    const reach = c.d * 0.95; // radio + zona del borde
    const x0 = Math.floor((c.x - reach) / CELL);
    const x1 = Math.floor((c.x + reach) / CELL);
    const z0 = Math.floor((c.z - reach) / CELL);
    const z1 = Math.floor((c.z + reach) / CELL);
    for (let i = x0; i <= x1; i += 1) {
      for (let j = z0; j <= z1; j += 1) {
        const key = `${i},${j}`;
        if (!grid.has(key)) grid.set(key, []);
        grid.get(key).push(c);
      }
    }
  }

  function height(x, z) {
    const dist = Math.hypot(x, z);
    // Ondulaciones (fBm): más suaves cerca del observador, para que esté parado en plano.
    let h = 0;
    let amp = 0.9;
    let freq = 1 / 220;
    for (let o = 0; o < 4; o += 1) {
      h += amp * noise(x * freq, z * freq);
      amp *= 0.45;
      freq *= 2.2;
    }
    h *= Math.min(1, dist / 25);
    // Cráteres: cuenco parabólico y borde levantado que cae hacia afuera.
    const cell = grid.get(`${Math.floor(x / CELL)},${Math.floor(z / CELL)}`);
    if (cell) {
      for (const c of cell) {
        const r = Math.hypot(x - c.x, z - c.z) / (c.d / 2);
        if (r < 1) h += c.depth * (r * r - 1) + c.rim;
        else if (r < 1.9) h += c.rim * Math.exp(-(((r - 1) / 0.35) ** 2));
      }
    }
    // Tope suave: nunca por encima de MAX_HEIGHT_M (debajo de los ojos).
    if (h > MAX_HEIGHT_M - 0.4) h = MAX_HEIGHT_M - 0.4 * Math.exp(-(h - (MAX_HEIGHT_M - 0.4)) / 0.4);
    return h;
  }

  return { height, craters };
}

/**
 * Cámara del suelo para que coincida con la escala del cielo: la distancia focal en píxeles hace
 * que cerca del horizonte un grado mida `pxPerDeg`. Se dibuja la mitad de abajo de una vista con
 * el horizonte en el centro (setViewOffset), así el borde de arriba del suelo es la línea de 0°.
 */
export function groundCamera({ width, groundHeight, pxPerDeg }) {
  const focalPx = (pxPerDeg * 180) / Math.PI;
  const fullHeight = 2 * groundHeight;
  const vFovDeg = (2 * Math.atan(groundHeight / focalPx) * 180) / Math.PI;
  return { focalPx, vFovDeg, fullHeight, offsetY: groundHeight, aspect: width / fullHeight };
}
