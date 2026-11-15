// Suelo lunar generado para cuando no hay WebGL (lo usa sky.js en lugar de la foto cenital que se
// repetía en mosaico). Dos pasos:
//  1. Un campo de alturas del suelo (plano, visto desde arriba) con ondulaciones y cráteres de borde
//     levantado y eyecta (muchos chicos, pocos grandes), iluminado de costado. Se repite en ambos ejes.
//  2. Un panorama de 360°: para cada columna (azimut) y fila (ángulo bajo el horizonte) se busca qué
//     punto del suelo se ve ahí, parado a EYE_M del piso: distancia = EYE_M / tan(depresión). Así el
//     suelo trae perspectiva (cráteres achatados y más chicos hacia el horizonte). Las filas lejanas
//     se leen de una pirámide de mipmaps para que no aparezca ruido.
// La vista del cielo es equirectangular (grados → píxeles igual en x e y), así que el panorama se
// pega tal cual: columna = azimut, fila = depresión.
import { EYE_M } from './sky-terrain-core.js';

export const PANO_DEP_MIN_DEG = 0.4; // primera fila: justo debajo del horizonte
export const PANO_DEP_MAX_DEG = 32; // última fila; más abajo se extiende el color del borde
export const FIELD_TEXEL_M = 0.5; // lado de un texel del campo de alturas
export const FINE_TEXEL_M = 0.02; // lado de un texel de la capa fina (grano del regolito)
export const FINE_REACH_M = 14; // hasta qué distancia se nota la capa fina

// Pseudoaleatorio con semilla (mulberry32): mismo suelo en cada carga.
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

/** Campo de alturas n × n que se repite sin cortes en x e y: ruido de valores + cráteres. */
export function groundHeightField(n = 2048, seed = 7, { baseCells = 4, rMin = 2, rMax = Math.max(8, n / 18) } = {}) {
  const rand = rng(seed);
  const field = new Float32Array(n * n);

  for (let o = 0; o < 5; o += 1) {
    const cells = baseCells * 2 ** o;
    const grid = Float32Array.from({ length: cells * cells }, rand);
    const amp = 1.6 / 2 ** o;
    for (let y = 0; y < n; y += 1) {
      const fy = (y / n) * cells;
      const yi = Math.floor(fy);
      const y1 = (yi + 1) % cells;
      const v = (fy - yi) ** 2 * (3 - 2 * (fy - yi));
      for (let x = 0; x < n; x += 1) {
        const fx = (x / n) * cells;
        const xi = Math.floor(fx);
        const x1 = (xi + 1) % cells;
        const u = (fx - xi) ** 2 * (3 - 2 * (fx - xi));
        const a = grid[yi * cells + xi] + (grid[yi * cells + x1] - grid[yi * cells + xi]) * u;
        const b = grid[y1 * cells + xi] + (grid[y1 * cells + x1] - grid[y1 * cells + xi]) * u;
        field[y * n + x] += amp * (a + (b - a) * v);
      }
    }
  }

  // Cráteres: la cantidad crece con el cuadrado inverso del radio (ley de potencias).
  const bins = 9;
  const areaScale = (n * n) / (2048 * 2048);
  for (let i = 0; i < bins; i += 1) {
    const r0 = rMin * (rMax / rMin) ** (i / bins);
    const r1 = rMin * (rMax / rMin) ** ((i + 1) / bins);
    const count = Math.round(2.6 * areaScale * (rMax / r0) ** 2 * (1 - (r0 / r1) ** 2)) + 1;
    for (let k = 0; k < count; k += 1) {
      const R = r0 + (r1 - r0) * rand();
      const cx = Math.round(rand() * n);
      const cy = Math.round(rand() * n);
      const age = 0.35 + 0.65 * rand(); // los viejos están más gastados
      const depth = (0.12 + 0.1 * rand()) * R * age * 0.06;
      const rim = depth * (0.5 + 0.5 * age);
      const reach = Math.ceil(R * 2.6);
      const R2 = R * R;
      for (let dy = -reach; dy <= reach; dy += 1) {
        const yy = (((cy + dy) % n) + n) % n;
        for (let dx = -reach; dx <= reach; dx += 1) {
          const q2 = (dx * dx + dy * dy) / R2;
          if (q2 > 6.76) continue; // más allá de 2,6 radios
          const q = Math.sqrt(q2);
          let dh;
          if (q < 1) dh = -depth * (1 - q2) + rim * q2 * q2 * q2; // cuenco con piso redondeado
          else dh = rim / (1 + ((q - 1) / 0.16) ** 2) + (rim * 0.22) / (q2 * q); // borde + eyecta
          field[yy * n + ((((cx + dx) % n) + n) % n)] += dh;
        }
      }
    }
  }
  return field;
}

/** Campo de alturas → brillo 0..255 (un canal) con luz rasante y manchas de albedo. */
export function shadeField(field, n, seed = 3, gain = 11) {
  const rand = rng(seed);
  const out = new Uint8Array(n * n);
  const cells = 12;
  const blotch = Float32Array.from({ length: cells * cells }, rand);
  const lx = -0.74;
  const ly = -0.45; // la luz llega desde arriba a la izquierda
  for (let y = 0; y < n; y += 1) {
    const ym = (y - 1 + n) % n;
    const yp = (y + 1) % n;
    const fy = (y / n) * cells;
    const yi = Math.floor(fy);
    const y1 = (yi + 1) % cells;
    for (let x = 0; x < n; x += 1) {
      const xm = (x - 1 + n) % n;
      const xp = (x + 1) % n;
      const slope = -((field[y * n + xp] - field[y * n + xm]) * lx + (field[yp * n + x] - field[ym * n + x]) * ly) * gain;
      const fx = (x / n) * cells;
      const xi = Math.floor(fx);
      const x1 = (xi + 1) % cells;
      const a = blotch[yi * cells + xi] + (blotch[yi * cells + x1] - blotch[yi * cells + xi]) * (fx - xi);
      const b = blotch[y1 * cells + xi] + (blotch[y1 * cells + x1] - blotch[y1 * cells + xi]) * (fx - xi);
      const albedo = 0.9 + 0.2 * (a + (b - a) * (fy - yi)) + 0.05 * (rand() - 0.5);
      out[y * n + x] = Math.min(255, 150 * albedo * Math.min(1.6, Math.max(0.12, 0.62 + slope)));
    }
  }
  return out;
}

/** Pirámide de mipmaps de un canal n × n (promedio de 2 × 2). Devuelve [{ n, data }, ...]. */
export function buildMips(base, n) {
  const levels = [{ n, data: base }];
  while (levels[levels.length - 1].n > 1) {
    const { n: m, data } = levels[levels.length - 1];
    const h = m >> 1;
    const next = new Uint8Array(h * h);
    for (let y = 0; y < h; y += 1) {
      for (let x = 0; x < h; x += 1) {
        const i = 2 * y * m + 2 * x;
        next[y * h + x] = (data[i] + data[i + 1] + data[i + m] + data[i + m + 1] + 2) >> 2;
      }
    }
    levels.push({ n: h, data: next });
  }
  return levels;
}

// Lectura bilinear con envoltura en un nivel de la pirámide; (u, v) en texels de ese nivel.
function bilinear({ n, data }, u, v) {
  const x0 = Math.floor(u);
  const y0 = Math.floor(v);
  const fx = u - x0;
  const fy = v - y0;
  const xa = ((x0 % n) + n) % n;
  const ya = ((y0 % n) + n) % n;
  const xb = (xa + 1) % n;
  const yb = (ya + 1) % n;
  const top = data[ya * n + xa] + (data[ya * n + xb] - data[ya * n + xa]) * fx;
  const bot = data[yb * n + xa] + (data[yb * n + xb] - data[yb * n + xa]) * fx;
  return top + (bot - top) * fy;
}

/**
 * Panorama RGBA de w × h píxeles: columna = azimut 0..360°, fila = depresión de PANO_DEP_MIN_DEG a
 * PANO_DEP_MAX_DEG bajo el horizonte. `n` es el lado del campo de alturas.
 */
export function groundPanorama({ w = 6144, h = 704, n = 1024, seed = 7 } = {}) {
  const mips = buildMips(shadeField(groundHeightField(n, seed), n, seed), n);
  // Capa fina (grano y cráteres de centímetros a decímetros) que repite cada nF × FINE_TEXEL_M
  // metros y solo se nota cerca: modula el brillo de la capa gruesa hasta FINE_REACH_M.
  const nF = Math.max(32, n / 2);
  const fine = buildMips(shadeField(groundHeightField(nF, seed + 1, { baseCells: 16, rMin: 1.5, rMax: nF / 26 }), nF, seed + 1, 6), nF);
  const fineMean = fine.at(-1).data[0] || 1;
  const fineTexelsPerM = 1 / FINE_TEXEL_M;
  const px = new Uint8ClampedArray(w * h * 4);
  const rad = Math.PI / 180;
  const dMin = PANO_DEP_MIN_DEG * rad;
  const dMax = PANO_DEP_MAX_DEG * rad;
  const sin = new Float32Array(w);
  const cos = new Float32Array(w);
  for (let c = 0; c < w; c += 1) {
    sin[c] = Math.sin(((c + 0.5) / w) * 2 * Math.PI);
    cos[c] = Math.cos(((c + 0.5) / w) * 2 * Math.PI);
  }
  const dDep = (dMax - dMin) / h;
  const texelsPerM = 1 / FIELD_TEXEL_M;
  for (let r = 0; r < h; r += 1) {
    const dep = dMin + (r + 0.5) * dDep;
    const dist = EYE_M / Math.tan(dep); // metros hasta el punto del suelo
    // Cuánto suelo (en texels) cubre un píxel del panorama: a lo ancho y a lo largo del rayo
    const stepAz = (dist * 2 * Math.PI) / w * texelsPerM;
    const stepRad = (EYE_M / Math.sin(dep) ** 2) * dDep * texelsPerM;
    const lod = Math.min(mips.length - 1, Math.max(0, Math.log2(Math.max(stepAz, stepRad, 1e-6))));
    const l0 = Math.floor(lod);
    const l1 = Math.min(mips.length - 1, l0 + 1);
    const mix = lod - l0;
    const s0 = 2 ** l0;
    const s1 = 2 ** l1;
    // Capa fina: su propio nivel de mipmap y un peso que baja con la distancia
    const wFine = Math.min(1, Math.max(0, 1 - (dist - 2) / (FINE_REACH_M - 2)));
    const fStep = Math.max((dist * 2 * Math.PI) / w, (EYE_M / Math.sin(dep) ** 2) * dDep) * fineTexelsPerM;
    const fLod = Math.min(fine.length - 1, Math.max(0, Math.log2(Math.max(fStep, 1e-6))));
    const f0 = Math.floor(fLod);
    const f1 = Math.min(fine.length - 1, f0 + 1);
    const fMix = fLod - f0;
    const fs0 = 2 ** f0;
    const fs1 = 2 ** f1;
    for (let c = 0; c < w; c += 1) {
      const u = dist * sin[c] * texelsPerM;
      const v = dist * cos[c] * texelsPerM;
      const a = bilinear(mips[l0], u / s0, v / s0);
      let val = l1 === l0 ? a : a + (bilinear(mips[l1], u / s1, v / s1) - a) * mix;
      if (wFine > 0) {
        const fu = dist * sin[c] * fineTexelsPerM;
        const fv = dist * cos[c] * fineTexelsPerM;
        const fa = bilinear(fine[f0], fu / fs0, fv / fs0);
        const fVal = f1 === f0 ? fa : fa + (bilinear(fine[f1], fu / fs1, fv / fs1) - fa) * fMix;
        val *= 1 + wFine * wFine * (3 - 2 * wFine) * 0.75 * (fVal / fineMean - 1);
      }
      const i = (r * w + c) * 4;
      px[i] = val * 0.97;
      px[i + 1] = val * 0.985;
      px[i + 2] = val * 1.02;
      px[i + 3] = 255;
    }
  }
  return { px, w, h };
}

/** Canvas del panorama. Tarda unos cientos de ms: se hace una vez, y solo sin WebGL. */
export function makeGroundPanorama(options) {
  const { px, w, h } = groundPanorama(options);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  canvas.getContext('2d').putImageData(new ImageData(px, w, h), 0, 0);
  // Color medio de la fila de arriba: rellena entre el horizonte y la primera fila
  let sum = 0;
  for (let c = 0; c < w; c += 1) sum += px[c * 4];
  const g = Math.round(sum / w);
  return { canvas, edgeColor: `rgb(${g}, ${Math.round(g * 1.015)}, ${Math.round(g * 1.05)})` };
}
