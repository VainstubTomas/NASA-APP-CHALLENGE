// Lógica pura de la malla adaptativa del suelo (sin THREE ni DOM, para testear con node --test).
// Cada anillo tiene una cantidad de segmentos según cuánto varía la altura a lo largo del anillo:
// donde el terreno es plano, pocos segmentos; donde hay cráteres o cambios bruscos, la malla fina.

/** Cantidad de segmentos de la malla fina (referencia del muestreo de alturas). */
export const FINE_N = 1080;
/** Cantidades posibles por anillo, de menos a más. La última es FINE_N (no entra en la prueba). */
export const RING_COUNTS = [135, 270, 540];

/**
 * Error de altura tolerado en un anillo a `r` metros: proporcional a la distancia (un error de altura
 * de un metro a 300 m se ve muy poco; a 1 m se ve mucho). Equivale a unos 0,17° como máximo.
 */
export const ringToleranceM = (r) => Math.min(1, Math.max(0.02, r * 0.003));

/**
 * Menor cantidad de segmentos n (de RING_COUNTS) para la que el error de interpolar linealmente
 * entre vértices vecinos queda por debajo de `tolM` metros en todo el anillo. `h` son las alturas
 * del anillo muestreadas en la malla fina (length = fineN, muestras equiespaciadas en ángulo).
 */
export function pickRingCount(h, fineN = FINE_N, tolM = 0.01, counts = RING_COUNTS) {
  for (const n of counts) {
    const step = fineN / n; // entero: las cantidades son divisores de fineN
    let err = 0;
    for (let s = 0; s < n && err <= tolM; s += 1) {
      const a = s * step;
      const b = ((s + 1) * step) % fineN;
      const m = a + step / 2; // muestra del medio (step es par en todas las cantidades de counts)
      err = Math.max(err, Math.abs(h[m] - 0.5 * (h[a] + h[b])));
    }
    if (err <= tolM) return n;
  }
  return fineN;
}

/**
 * Franja de triángulos entre dos anillos cíclicos de distinta cantidad de vértices, sin grietas.
 * a: anillo interior, b: anillo exterior. Cada anillo: { base, n, step } con `base` el índice global
 * del primer vértice, `n` la cantidad de vértices y `step` el paso angular en unidades de la malla fina.
 * Agrega triángulos [i, j, k] (índices globales) a `out`. Mismo sentido que la malla de cuadros:
 * (inner s, inner s+1, outer s) y (inner s+1, outer s+1, outer s).
 */
export function stitchRings(a, b, out) {
  let i = 0;
  let j = 0;
  const total = a.n + b.n;
  for (let t = 0; t < total; t += 1) {
    const nextA = (i + 1) * a.step;
    const nextB = (j + 1) * b.step;
    const A0 = a.base + (i % a.n);
    const A1 = a.base + ((i + 1) % a.n);
    const B0 = b.base + (j % b.n);
    const B1 = b.base + ((j + 1) % b.n);
    if (nextA <= nextB) {
      out.push(A0, A1, B0);
      i += 1;
    } else {
      out.push(A0, B1, B0);
      j += 1;
    }
  }
  return out;
}
