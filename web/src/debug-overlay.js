// Overlay de debug de la vista del cielo: FPS, estadísticas del render 3D y modo wireframe.
// Se activa con ?debug en la URL. F3 muestra u oculta el panel.
import { createFpsMeter, ratePerSecond, formatCount } from './debug-core.js';

const REFRESH_MS = 250; // cada cuánto se actualizan los números (el FPS se mide en cada cuadro)

/**
 * Crea el panel dentro de `root`. `getStats()` devuelve { renders, triangles, meshTriangles, calls,
 * geometries, textures, canvas: {w, h}, pixelRatio } o null. `onWireframe(on)` cambia el modo.
 */
export function createDebugOverlay(root, { getStats, onWireframe }) {
  const box = document.createElement('div');
  box.className = 'sky-debug';
  box.innerHTML = `
    <div class="sky-debug__title">debug · F3</div>
    <div class="sky-debug__row"><span>FPS (pantalla)</span><b data-k="fps">–</b></div>
    <div class="sky-debug__row"><span>ms por cuadro</span><b data-k="frame">–</b></div>
    <div class="sky-debug__row"><span>renders / s</span><b data-k="rps">–</b></div>
    <div class="sky-debug__row"><span>triángulos (cuadro)</span><b data-k="tris">–</b></div>
    <div class="sky-debug__row"><span>triángulos (malla)</span><b data-k="meshTris">–</b></div>
    <div class="sky-debug__row"><span>draw calls</span><b data-k="calls">–</b></div>
    <div class="sky-debug__row"><span>geometrías / texturas</span><b data-k="mem">–</b></div>
    <div class="sky-debug__row"><span>canvas</span><b data-k="canvas">–</b></div>
    <label class="sky-debug__row sky-debug__check"><span>wireframe</span><input type="checkbox" data-k="wire"></label>
  `;
  const field = (k) => box.querySelector(`[data-k="${k}"]`);
  const wire = field('wire');
  wire.addEventListener('change', () => onWireframe(wire.checked));

  const meter = createFpsMeter();
  let visible = false;
  let raf = 0;
  let lastText = 0;
  let lastRenders = 0;
  let lastStatsMs = 0;
  let rps = 0;

  function loop(now) {
    if (!visible) return;
    const { fps, frameMs } = meter.tick(now);
    if (now - lastText >= REFRESH_MS) {
      const s = getStats?.() ?? null;
      if (s) {
        if (lastStatsMs) rps = ratePerSecond(lastRenders, s.renders, lastStatsMs, now);
        lastRenders = s.renders;
        lastStatsMs = now;
        field('tris').textContent = formatCount(s.triangles);
        field('meshTris').textContent = formatCount(s.meshTriangles);
        field('calls').textContent = formatCount(s.calls);
        field('mem').textContent = `${s.geometries} / ${s.textures}`;
        field('canvas').textContent = `${s.canvas.w}×${s.canvas.h} @${s.pixelRatio}`;
      }
      field('fps').textContent = fps ? fps.toFixed(0) : '–';
      field('frame').textContent = frameMs ? `${frameMs.toFixed(1)} ms` : '–';
      field('rps').textContent = rps.toFixed(1);
      lastText = now;
    }
    raf = requestAnimationFrame(loop);
  }

  function setVisible(on) {
    visible = on;
    box.hidden = !on;
    cancelAnimationFrame(raf);
    if (on) {
      lastText = 0;
      lastStatsMs = 0;
      raf = requestAnimationFrame(loop);
    }
  }

  window.addEventListener('keydown', (e) => {
    if (e.key === 'F3') {
      e.preventDefault();
      setVisible(!visible);
    }
  });

  root.append(box);
  setVisible(true);
  return { setVisible };
}
