// Pruebas del diseño (#38): contraste suficiente entre texto y fondo (WCAG 2.1, nivel AA = 4,5:1).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const css = readFileSync(new URL('./theme.css', import.meta.url), 'utf8');
const vars = Object.fromEntries([...css.matchAll(/--([\w-]+):\s*(#[0-9a-fA-F]{6})/g)].map((m) => [m[1], m[2]]));

// Luminancia relativa y contraste según WCAG 2.1.
function luminance(hex) {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const lin = (c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}
function contrast(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

test('la fórmula de contraste da los valores conocidos', () => {
  assert.equal(Math.round(contrast('#000000', '#ffffff') * 10) / 10, 21);
  assert.equal(contrast('#777777', '#777777'), 1);
});

// [texto, fondo] tal como se usan en la web.
const PAIRS = [
  ['color-text', 'color-bg'],
  ['color-text', 'color-surface'],
  ['color-text', 'color-surface-2'],
  ['color-muted', 'color-bg'],
  ['color-muted', 'color-surface'],
  ['color-sun', 'color-surface'],
  ['color-earth', 'color-surface'],
  ['color-up', 'color-up-bg'],
  ['color-partial', 'color-partial-bg'],
  ['color-down', 'color-down-bg'],
  ['color-notice', 'color-notice-bg'],
  // Vista del cielo (#99)
  ['sky-text', 'sky-bg'],
  ['sky-text-dim', 'sky-bg'],
  ['sky-text-dim', 'sky-card'],
  ['sky-horizon', 'sky-bg'],
  ['sky-earth', 'sky-bg'],
  ['color-sun', 'sky-bg'],
  ['sky-earth', 'sky-card'],
  ['color-sun', 'sky-card'],
  ['sky-horizon', 'sky-card'],
  ['sky-white', 'sky-tab'],
  ['sky-white', 'sky-primary'],
];

test('todos los pares de texto y fondo tienen contraste AA (4,5:1 o más)', () => {
  for (const [fg, bg] of PAIRS) {
    assert.ok(vars[fg] && vars[bg], `falta --${fg} o --${bg} en theme.css`);
    const ratio = contrast(vars[fg], vars[bg]);
    assert.ok(ratio >= 4.5, `--${fg} sobre --${bg}: ${ratio.toFixed(2)}:1 (mínimo 4,5:1)`);
  }
});
