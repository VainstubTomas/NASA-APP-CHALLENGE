// Banderas en SVG inline para el selector de idioma. Los emoji de bandera no se ven en Windows (salen como letras).
// Español usa la bandera de España: el proyecto no define un país para el español.
// hindi y chino usan la bandera de su país (India y China).

const star = (cx, cy, r) => {
  const pts = [];
  for (let i = 0; i < 10; i += 1) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const rad = i % 2 ? r * 0.382 : r;
    pts.push(`${(cx + rad * Math.cos(a)).toFixed(2)},${(cy + rad * Math.sin(a)).toFixed(2)}`);
  }
  return pts.join(' ');
};

const svg = (viewBox, body) => `<svg viewBox="${viewBox}" aria-hidden="true" focusable="false">${body}</svg>`;

const chakraSpokes = Array.from({ length: 24 }, (_, i) => {
  const a = (i * Math.PI) / 12;
  const x2 = (15 + Math.cos(a) * 2.6).toFixed(2);
  const y2 = (10 + Math.sin(a) * 2.6).toFixed(2);
  return `<line x1="15" y1="10" x2="${x2}" y2="${y2}"/>`;
}).join('');

export const LANG_FLAGS = {
  es: svg('0 0 30 20',
    '<rect width="30" height="20" fill="#AA151B"/><rect y="5" width="30" height="10" fill="#F1BF00"/>'),
  en: svg('0 0 60 30',
    '<rect width="60" height="30" fill="#012169"/>'
    + '<path d="M0 0L60 30M60 0L0 30" stroke="#fff" stroke-width="6"/>'
    + '<path d="M0 0L60 30M60 0L0 30" stroke="#C8102E" stroke-width="2"/>'
    + '<path d="M30 0V30M0 15H60" stroke="#fff" stroke-width="10"/>'
    + '<path d="M30 0V30M0 15H60" stroke="#C8102E" stroke-width="6"/>'),
  hi: svg('0 0 30 20',
    '<rect width="30" height="7" fill="#FF9933"/><rect y="7" width="30" height="6" fill="#fff"/>'
    + '<rect y="13" width="30" height="7" fill="#138808"/>'
    + `<g fill="none" stroke="#000080" stroke-width=".35"><circle cx="15" cy="10" r="2.5"/>${chakraSpokes}</g>`),
  zh: svg('0 0 30 20',
    '<rect width="30" height="20" fill="#DE2910"/>'
    + `<polygon fill="#FFDE00" points="${star(5, 5, 3)}"/>`
    + `<polygon fill="#FFDE00" points="${star(10, 2, 1)}"/>`
    + `<polygon fill="#FFDE00" points="${star(12, 4, 1)}"/>`
    + `<polygon fill="#FFDE00" points="${star(12, 7, 1)}"/>`
    + `<polygon fill="#FFDE00" points="${star(10, 9, 1)}"/>`),
};
