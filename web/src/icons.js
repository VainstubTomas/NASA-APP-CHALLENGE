// Íconos del Sol y la Tierra (#38). SVG propio en vez de emoji: se ve igual en todos los
// sistemas y usa los colores de theme.css (--color-sun, --color-earth, --color-earth-land).
// Uso: element.append(sunIcon()) / earthIcon(). Son decorativos (aria-hidden): el nombre va en texto.
const NS = 'http://www.w3.org/2000/svg';

function svg(size, children) {
  const root = document.createElementNS(NS, 'svg');
  root.setAttribute('viewBox', '0 0 24 24');
  root.setAttribute('width', size);
  root.setAttribute('height', size);
  root.setAttribute('aria-hidden', 'true');
  root.setAttribute('focusable', 'false');
  root.classList.add('icon');
  for (const [tag, attrs] of children) {
    const node = document.createElementNS(NS, tag);
    for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
    root.appendChild(node);
  }
  return root;
}

export function sunIcon(size = 24) {
  const rays = Array.from({ length: 8 }, (_, i) => {
    const a = (i * Math.PI) / 4;
    const [x1, y1, x2, y2] = [12 + 7 * Math.cos(a), 12 + 7 * Math.sin(a), 12 + 10.5 * Math.cos(a), 12 + 10.5 * Math.sin(a)];
    return ['line', {
      x1: x1.toFixed(2), y1: y1.toFixed(2), x2: x2.toFixed(2), y2: y2.toFixed(2),
      stroke: 'var(--color-sun)', 'stroke-width': '2', 'stroke-linecap': 'round',
    }];
  });
  return svg(size, [['circle', { cx: '12', cy: '12', r: '5', fill: 'var(--color-sun)' }], ...rays]);
}

export function earthIcon(size = 24) {
  return svg(size, [
    ['circle', { cx: '12', cy: '12', r: '10', fill: 'var(--color-earth)' }],
    // Continentes estilizados
    ['path', { d: 'M7 6.5c2-.8 4 .2 4.5 1.8.4 1.4-1 2.2-2.3 2.6-1.4.4-1.6 1.8-2.7 2.1-1.2.3-2.4-1-2.2-2.6.2-1.7 1.1-3.2 2.7-3.9z', fill: 'var(--color-earth-land)' }],
    ['path', { d: 'M14.5 12.5c1.5-.4 3.4.4 3.8 1.9.4 1.6-.8 3.4-2.4 4-1.3.5-2.2-.4-2.4-1.7-.2-1.5-.4-3.8 1-4.2z', fill: 'var(--color-earth-land)' }],
  ]);
}
