// Vista 3D del cielo lunar (#30): parado en el sitio, arrastrá para mirar alrededor.
// Reemplaza a la brújula + regla: el rumbo es hacia dónde girás y la altura es cuánto levantás la vista.
// Un solo visor persistente (un solo contexto WebGL): renderPanel solo llama a update() en cada cambio.
// Las posiciones vienen de sampleAt (Horizons); aquí solo se dibujan, no se recalculan.
import * as THREE from 'three';
import { directionFromAzEl } from './dials-core.js';
import { horizonAt, statusAgainstHorizon } from './horizon.js';
import { compassLabel } from './ephemeris.js';
import { t } from './i18n.js';

const DIST = 280; // distancia de todo lo que hay en el cielo (la escala es arbitraria)
const EYE = 1.7; // altura de los ojos sobre el suelo
const MIN_ANGULAR_RADIUS_DEG = 2.5; // el Sol real mide 0,27°: se exagera para que se vea
const COLORS = { sun: '#ffc54d', earth: '#6cb2ff' };

function rng(seed) {
  let s = seed;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let r = Math.imul(s ^ (s >>> 15), 1 | s);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function canvasTexture(width, height, draw) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  draw(canvas.getContext('2d'), width, height);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function groundTexture() {
  const rand = rng(7);
  const texture = canvasTexture(512, 512, (ctx, w, h) => {
    ctx.fillStyle = '#8e9198';
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 2500; i += 1) {
      ctx.fillStyle = rand() > 0.5 ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.09)';
      ctx.fillRect(rand() * w, rand() * h, 1 + rand() * 3, 1 + rand() * 3);
    }
    for (let i = 0; i < 26; i += 1) {
      const x = rand() * w;
      const y = rand() * h;
      const r = 6 + rand() * 30;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(40,42,48,0.35)';
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = 'rgba(220,222,228,0.45)';
      ctx.stroke();
    }
  });
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(40, 40);
  return texture;
}

function earthTexture() {
  const rand = rng(11);
  return canvasTexture(256, 128, (ctx, w, h) => {
    ctx.fillStyle = '#3f86d6';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#5fd08a';
    for (let i = 0; i < 14; i += 1) {
      ctx.beginPath();
      ctx.ellipse(rand() * w, 20 + rand() * (h - 40), 8 + rand() * 22, 6 + rand() * 14, rand() * 3, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.fillRect(0, 0, w, 8);
    ctx.fillRect(0, h - 8, w, 8);
  });
}

function glowTexture(color) {
  return canvasTexture(128, 128, (ctx, w, h) => {
    const g = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    g.addColorStop(0, color);
    g.addColorStop(0.25, `${color}aa`);
    g.addColorStop(1, `${color}00`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  });
}

const labelCache = new Map();
// `width` = unidades del mundo por cada 256 px de textura (define el tamaño del texto en pantalla).
// El texto puede tener varias líneas; la textura se ajusta al texto para que no se corte.
function labelSprite(text, { color = '#ffffff', width = 56, size = 34 } = {}) {
  const key = `${text}|${color}|${size}`;
  if (!labelCache.has(key)) {
    const lines = text.split('\n');
    const font = `700 ${size}px system-ui, 'Segoe UI', 'Noto Sans', sans-serif`;
    const probe = document.createElement('canvas').getContext('2d');
    probe.font = font;
    const textWidth = Math.max(...lines.map((line) => probe.measureText(line).width));
    const lineHeight = Math.round(size * 1.35);
    const w = Math.ceil(textWidth) + 24;
    const h = lineHeight * lines.length + 12;
    labelCache.set(
      key,
      canvasTexture(w, h, (ctx) => {
        ctx.font = font;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.lineWidth = 7;
        ctx.strokeStyle = '#000000';
        ctx.lineJoin = 'round';
        lines.forEach((line, i) => {
          const y = 6 + lineHeight * (i + 0.5);
          ctx.strokeText(line, w / 2, y);
          ctx.fillStyle = color;
          ctx.fillText(line, w / 2, y);
        });
      }),
    );
  }
  const map = labelCache.get(key);
  const k = width / 256;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map, depthTest: false, transparent: true }));
  sprite.scale.set(map.image.width * k, map.image.height * k, 1);
  sprite.renderOrder = 10;
  return sprite;
}

function place(object, azimuthDeg, elevationDeg, distance = DIST) {
  const d = directionFromAzEl(azimuthDeg, elevationDeg);
  object.position.set(d.x * distance, EYE + d.y * distance, d.z * distance);
  return object;
}

function dispose(group) {
  group.traverse((o) => {
    o.geometry?.dispose();
    // Las texturas de etiquetas están en caché y se reutilizan: solo se liberan los materiales.
    o.material?.dispose();
  });
  group.clear();
}

export function createViewer() {
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#02030a');
  const camera = new THREE.PerspectiveCamera(80, 1.6, 0.5, 2000);
  camera.position.set(0, EYE, 0);

  const element = document.createElement('div');
  element.className = 'view3d';
  renderer.domElement.className = 'view3d__canvas';
  const bar = document.createElement('div');
  bar.className = 'view3d__bar';
  element.append(renderer.domElement, bar);

  // Fondo fijo: estrellas, suelo con cráteres.
  const rand = rng(3);
  const starPositions = [];
  for (let i = 0; i < 900; i += 1) {
    const v = new THREE.Vector3(rand() * 2 - 1, rand() * 2 - 1, rand() * 2 - 1);
    if (v.lengthSq() > 1 || v.lengthSq() < 0.05) continue;
    v.normalize().multiplyScalar(1500);
    starPositions.push(v.x, v.y, v.z);
  }
  const starGeometry = new THREE.BufferGeometry();
  starGeometry.setAttribute('position', new THREE.Float32BufferAttribute(starPositions, 3));
  scene.add(new THREE.Points(starGeometry, new THREE.PointsMaterial({ color: '#ffffff', size: 2, sizeAttenuation: false })));
  const ground = new THREE.Mesh(
    new THREE.CircleGeometry(DIST * 1.05, 64),
    new THREE.MeshBasicMaterial({ map: groundTexture() }),
  );
  ground.material.map.anisotropy = renderer.capabilities.getMaxAnisotropy();
  ground.rotation.x = -Math.PI / 2;
  ground.renderOrder = 0;
  scene.add(ground);

  const dynamic = new THREE.Group();
  const horizonGroup = new THREE.Group();
  scene.add(dynamic, horizonGroup);

  // Mirada: azimut (0° = norte, horario) y cabeceo.
  const view = { az: 0, pitch: 10, fov: 80 };
  let initialized = false;
  let queued = false;
  function render() {
    queued = false;
    const d = directionFromAzEl(view.az, view.pitch);
    camera.fov = view.fov;
    camera.updateProjectionMatrix();
    camera.lookAt(camera.position.x + d.x, camera.position.y + d.y, camera.position.z + d.z);
    renderer.render(scene, camera);
  }
  const requestRender = () => {
    if (!queued) {
      queued = true;
      requestAnimationFrame(render);
    }
  };

  const clampPitch = (p) => Math.max(-30, Math.min(85, p));
  function lookAt(az, pitch) {
    const from = { az: view.az, pitch: view.pitch };
    // Gira por el camino corto.
    const delta = ((((az - from.az) % 360) + 540) % 360) - 180;
    const start = performance.now();
    const step = (now) => {
      const k = Math.min(1, (now - start) / 450);
      const e = 1 - (1 - k) ** 3;
      view.az = (from.az + delta * e + 360) % 360;
      view.pitch = from.pitch + (clampPitch(pitch) - from.pitch) * e;
      render();
      if (k < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  // Arrastrar = mirar alrededor; rueda = zoom.
  let drag = null;
  const canvas = renderer.domElement;
  canvas.addEventListener('pointerdown', (e) => {
    drag = { x: e.clientX, y: e.clientY };
    canvas.setPointerCapture(e.pointerId);
    element.classList.add('view3d--grabbing');
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!drag) return;
    const perPx = view.fov / canvas.clientHeight;
    view.az = (view.az - (e.clientX - drag.x) * perPx + 360) % 360;
    view.pitch = clampPitch(view.pitch + (e.clientY - drag.y) * perPx);
    drag = { x: e.clientX, y: e.clientY };
    requestRender();
  });
  const endDrag = () => {
    drag = null;
    element.classList.remove('view3d--grabbing');
  };
  canvas.addEventListener('pointerup', endDrag);
  canvas.addEventListener('pointercancel', endDrag);
  canvas.addEventListener(
    'wheel',
    (e) => {
      e.preventDefault();
      view.fov = Math.max(25, Math.min(110, view.fov + Math.sign(e.deltaY) * 4));
      requestRender();
    },
    { passive: false },
  );

  function resize() {
    const w = element.clientWidth;
    const h = element.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    requestRender();
  }
  new ResizeObserver(resize).observe(element);

  let horizonKey = null;
  function buildHorizon(horizon) {
    dispose(horizonGroup);
    horizonKey = horizon;
    if (!horizon || horizon.elevation_deg.every((v) => v === 0)) return;
    const n = 360;
    const positions = [];
    for (let i = 0; i <= n; i += 1) {
      const az = i % n;
      const h = Math.tan((horizonAt(horizon, az) * Math.PI) / 180) * DIST;
      const d = directionFromAzEl(az, 0);
      positions.push(d.x * DIST, 0, d.z * DIST, d.x * DIST, Math.max(h, 0), d.z * DIST);
    }
    const index = [];
    for (let i = 0; i < n; i += 1) index.push(2 * i, 2 * i + 1, 2 * i + 2, 2 * i + 1, 2 * i + 3, 2 * i + 2);
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setIndex(index);
    horizonGroup.add(new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ color: '#4a4d56', side: THREE.DoubleSide })));
  }

  function lookButton(label, onClick) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'view3d__btn';
    b.textContent = label;
    b.addEventListener('click', onClick);
    return b;
  }

  const textures = { earth: earthTexture(), sunGlow: glowTexture('#ffc54d'), earthGlow: glowTexture('#6cb2ff') };
  let last = null;

  function update({ sample, radius, horizon }) {
    last = { sample, radius, horizon };
    if (horizon !== horizonKey) buildHorizon(horizon);
    dispose(dynamic);

    // Brújula: letras de los puntos cardinales sobre el horizonte.
    for (const [key, az] of [['N', 0], ['E', 90], ['S', 180], ['W', 270]]) {
      dynamic.add(place(labelSprite(t(`compass.${key}`), { color: key === 'N' ? '#6cb2ff' : '#ffffff', width: 100, size: 64 }), az, 3.5));
    }
    // Cuatro marcas más sobre el horizonte, cada 45°: ayudan a ubicarse al girar.
    for (const [key, az] of [['NE', 45], ['SE', 135], ['SW', 225], ['NW', 315]]) {
      dynamic.add(place(labelSprite(t(`compass.${key}`), { color: '#a9b3c9', width: 70, size: 56 }), az, 3));
    }
    // Línea del horizonte (altura 0°) para que se vea dónde empieza el cielo.
    const ring = [];
    for (let az = 0; az <= 360; az += 3) {
      const d = directionFromAzEl(az, 0);
      ring.push(new THREE.Vector3(d.x * DIST, EYE, d.z * DIST));
    }
    dynamic.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(ring), new THREE.LineBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.5 })));

    for (const body of ['sun', 'earth']) {
      const position = sample[body];
      const state = statusAgainstHorizon(position, radius[body], horizon);
      const down = state === 'down';
      const color = COLORS[body];

      // Regla de elevación: arco vertical sobre el azimut del cuerpo, con marcas cada 15°.
      const arc = [];
      for (let el = 0; el <= 90; el += 3) {
        const d = directionFromAzEl(position.azimuth_deg, el);
        arc.push(new THREE.Vector3(d.x * DIST, EYE + d.y * DIST, d.z * DIST));
      }
      dynamic.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(arc), new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.55 })));
      for (let el = 15; el <= 75; el += 15) {
        const tick = labelSprite(`${el}°`, { color, width: 64, size: 56 });
        dynamic.add(place(tick, position.azimuth_deg + 2.2, el));
      }

      // El disco: tamaño exagerado. Bajo el horizonte se dibuja "fantasma" (se ve a través del suelo).
      const angular = Math.max(radius[body], MIN_ANGULAR_RADIUS_DEG);
      const size = Math.tan((angular * Math.PI) / 180) * DIST;
      const material = new THREE.MeshBasicMaterial(
        body === 'earth' ? { map: textures.earth } : { color },
      );
      const glowMaterial = new THREE.SpriteMaterial({ map: body === 'earth' ? textures.earthGlow : textures.sunGlow, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
      for (const m of [material, glowMaterial]) {
        if (down) {
          m.transparent = true;
          m.opacity = 0.4;
          m.depthTest = false;
        }
      }
      const disc = new THREE.Mesh(new THREE.SphereGeometry(size, 32, 16), material);
      place(disc, position.azimuth_deg, position.elevation_deg);
      disc.renderOrder = 5;
      const glow = new THREE.Sprite(glowMaterial);
      glow.scale.setScalar(size * (body === 'sun' ? 7 : 4));
      place(glow, position.azimuth_deg, position.elevation_deg);
      glow.renderOrder = 4;
      dynamic.add(glow, disc);

      const where = `${t(`panel.${body}`)} · ${t(`compass.${compassLabel(position.azimuth_deg)}`)}`;
      const text = down ? `${where}\n${t('panel.status.down')}` : where;
      const name = labelSprite(text, { color: '#ffffff', width: 120, size: 32 });
      // Sobre el disco; el rótulo de dos líneas sube un poco más para no taparlo.
      place(name, position.azimuth_deg, position.elevation_deg + angular + (down ? 6 : 3.5));
      dynamic.add(name);
    }

    if (!initialized) {
      initialized = true;
      const target = sample.sun.elevation_deg > -2 ? sample.sun : sample.earth;
      view.az = target.azimuth_deg;
      view.pitch = clampPitch(Math.max(8, Math.min(34, target.elevation_deg * 0.5)));
    }
    // Los botones se rehacen en cada update para seguir el idioma elegido.
    bar.replaceChildren(
      lookButton(t('view3d.lookSun'), () => last && lookAt(last.sample.sun.azimuth_deg, last.sample.sun.elevation_deg)),
      lookButton(t('view3d.lookEarth'), () => last && lookAt(last.sample.earth.azimuth_deg, last.sample.earth.elevation_deg)),
      lookButton(t('view3d.lookNorth'), () => lookAt(0, 10)),
    );
    requestRender();
  }

  return { element, update, refreshLabels: () => labelCache.clear() };
}
