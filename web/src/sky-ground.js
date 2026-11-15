// Suelo 3D ilustrativo de la vista del cielo (rediseño #99). Se carga aparte (import dinámico)
// porque usa three.js; mientras tanto, o si no hay WebGL, queda la textura plana del Figma.
// El terreno (cráteres y ondulaciones) es generado y NO es topografía real; está acotado para que
// nada asome sobre el horizonte de 0° (sky-terrain-core.js, con tests). Lo que sí es real es la luz:
// el Sol y la Tierra iluminan desde su azimut y elevación de JPL Horizons, así que en los polos se
// ven las sombras larguísimas del Sol rasante y, de noche, solo la luz de la Tierra (earthshine).
// Las sombras se calculan recorriendo el terreno hacia el Sol en cada píxel (los mapas de sombras
// comunes fallan con el Sol a 1-2° de altura). El regolito refleja según Lommel-Seeliger.
import * as THREE from 'three';
import { directionFromAzEl } from './dials-core.js';
import { EYE_M, createTerrain, curvatureDrop, groundCamera } from './sky-terrain-core.js';

const RINGS = 220; // anillos de la malla, más densos cerca del observador
const SEGMENTS = 540; // divisiones alrededor
const R_MIN = 0.6;
const R_MAX = 4200; // más allá del horizonte geométrico (~2,4 km)
const NEAR_SIZE = 512; // m: mapa de alturas fino (1 m por texel) para las sombras cercanas
const NEAR_RES = 512;
const FAR_SIZE = 8192; // m: mapa de alturas grueso para las sombras lejanas
const FAR_RES = 256;

const VERTEX = /* glsl */ `
  attribute float hRaw;
  attribute vec3 albedo;
  varying vec3 vPos;     // posición sin curvatura (para las sombras)
  varying vec3 vNormal;
  varying vec3 vAlbedo;
  varying vec3 vView;
  void main() {
    vPos = vec3(position.x, hRaw, position.z);
    vNormal = normal;
    vAlbedo = albedo;
    vec4 world = modelMatrix * vec4(position, 1.0);
    vView = cameraPosition - world.xyz;
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`;

const FRAGMENT = /* glsl */ `
  precision highp float;
  uniform sampler2D hNear;
  uniform sampler2D hFar;
  uniform sampler2D detail;
  uniform vec3 sunDir;
  uniform float sunI;
  uniform float sunSoft;
  uniform float earthSoft;
  uniform vec3 earthDir;
  uniform float earthI;
  varying vec3 vPos;
  varying vec3 vNormal;
  varying vec3 vAlbedo;
  varying vec3 vView;

  float H(vec2 p) {
    vec2 uv = p / ${NEAR_SIZE.toFixed(1)} + 0.5;
    if (uv.x > 0.002 && uv.x < 0.998 && uv.y > 0.002 && uv.y < 0.998) return texture2D(hNear, uv).r;
    return texture2D(hFar, p / ${FAR_SIZE.toFixed(1)} + 0.5).r;
  }

  // Sombra con penumbra física: avanza hacia la luz y mide cuánto del disco tapa el terreno.
  // soft = 1 / tan(radio angular): el Sol (0,27°) da sombras nítidas; la Tierra (1°), más suaves.
  float shadow(vec3 p, vec3 L, float soft) {
    float s = 1.0;
    float t = 0.35;
    for (int i = 0; i < 48; i++) {
      vec3 q = p + L * t;
      float d = q.y - H(q.xz);
      if (d < -0.5 * t / soft) return 0.0;
      s = min(s, 0.5 + 0.5 * soft * d / t);
      t *= 1.16;
      if (t > 2500.0) break;
    }
    return clamp(s, 0.0, 1.0);
  }

  // Reflectancia del regolito (Lommel-Seeliger): sin oscurecimiento hacia el borde, como la Luna.
  float lommel(vec3 n, vec3 L, vec3 V) {
    float mu0 = max(dot(n, L), 0.0);
    float mu = max(dot(n, V), 0.02);
    return mu0 / (mu0 + mu);
  }

  void main() {
    vec3 V = normalize(vView);
    float dist = length(vView);
    // Detalle fino del regolito (dos escalas), se apaga con la distancia
    vec2 d1 = texture2D(detail, vPos.xz / 2.7).rg * 2.0 - 1.0;
    vec2 d2 = texture2D(detail, vPos.xz / 23.0 + 0.37).rg * 2.0 - 1.0;
    float fade = clamp(1.0 - dist / 260.0, 0.0, 1.0);
    vec3 n = normalize(vNormal + vec3(d1.x, 0.0, d1.y) * 0.55 * fade + vec3(d2.x, 0.0, d2.y) * 0.25);

    vec3 color = vAlbedo * 0.012; // luz rebotada del terreno vecino (casi nada: sombras negras)
    if (sunI > 0.0) {
      float sh = shadow(vPos + vec3(0.0, 0.04, 0.0), sunDir, sunSoft);
      color += vAlbedo * vec3(1.0, 0.98, 0.94) * sunI * 2.0 * lommel(n, sunDir, V) * sh;
    }
    if (earthI > 0.0) {
      float sh = shadow(vPos + vec3(0.0, 0.04, 0.0), earthDir, earthSoft);
      color += vAlbedo * vec3(0.62, 0.74, 1.0) * earthI * 2.0 * lommel(n, earthDir, V) * sh;
    }
    color = color / (1.0 + color * 0.35); // compresión suave de los brillos
    gl_FragColor = vec4(pow(clamp(color, 0.0, 1.0), vec3(1.0 / 2.2)), 1.0);
  }
`;

// Ruido de detalle que se repite sin cortes (para la textura del regolito).
function detailTexture(size = 256) {
  let seed = 99;
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  const hgt = new Float32Array(size * size);
  for (const [cells, amp] of [[8, 1], [16, 0.6], [32, 0.4], [64, 0.25], [128, 0.15]]) {
    const g = Array.from({ length: cells * cells }, rand);
    const at = (i, j) => g[((j + cells) % cells) * cells + ((i + cells) % cells)];
    for (let y = 0; y < size; y += 1) {
      for (let x = 0; x < size; x += 1) {
        const fx = (x / size) * cells;
        const fy = (y / size) * cells;
        const xi = Math.floor(fx);
        const yi = Math.floor(fy);
        const u = (fx - xi) ** 2 * (3 - 2 * (fx - xi));
        const v = (fy - yi) ** 2 * (3 - 2 * (fy - yi));
        const a = at(xi, yi) + (at(xi + 1, yi) - at(xi, yi)) * u;
        const b = at(xi, yi + 1) + (at(xi + 1, yi + 1) - at(xi, yi + 1)) * u;
        hgt[y * size + x] += amp * (a + (b - a) * v);
      }
    }
  }
  // Pozos chicos (cráteres de centímetros a decímetros)
  for (let i = 0; i < 90; i += 1) {
    const cx = rand() * size;
    const cy = rand() * size;
    const r = 2 + rand() * 7;
    for (let y = -r; y <= r; y += 1) {
      for (let x = -r; x <= r; x += 1) {
        const q = Math.hypot(x, y) / r;
        if (q >= 1) continue;
        const px = (Math.floor(cx + x) + size) % size;
        const py = (Math.floor(cy + y) + size) % size;
        hgt[py * size + px] += 0.9 * (q * q - 1);
      }
    }
  }
  const data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const h = (i, j) => hgt[((j + size) % size) * size + ((i + size) % size)];
      const dx = h(x + 1, y) - h(x - 1, y);
      const dy = h(x, y + 1) - h(x, y - 1);
      const k = (y * size + x) * 4;
      data[k] = Math.max(0, Math.min(255, 128 - dx * 90));
      data[k + 1] = Math.max(0, Math.min(255, 128 - dy * 90));
      data[k + 2] = 255;
      data[k + 3] = 255;
    }
  }
  const tex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.generateMipmaps = true;
  tex.anisotropy = 4;
  tex.needsUpdate = true;
  return tex;
}

// `linear`: interpola entre texels (sombras suaves). Los Float32 solo se pueden filtrar si el
// navegador da OES_texture_float_linear; si no, se queda en el vecino más cercano (bloques).
function heightTexture(terrain, sizeM, res, linear) {
  const data = new Float32Array(res * res);
  for (let j = 0; j < res; j += 1) {
    for (let i = 0; i < res; i += 1) {
      const x = ((i + 0.5) / res - 0.5) * sizeM;
      const z = ((j + 0.5) / res - 0.5) * sizeM;
      data[j * res + i] = terrain.height(x, z);
    }
  }
  const tex = new THREE.DataTexture(data, res, res, THREE.RedFormat, THREE.FloatType);
  tex.magFilter = linear ? THREE.LinearFilter : THREE.NearestFilter;
  tex.minFilter = linear ? THREE.LinearFilter : THREE.NearestFilter;
  tex.needsUpdate = true;
  return tex;
}

function terrainMesh(terrain, material) {
  const count = (RINGS + 1) * SEGMENTS;
  const pos = new Float32Array(count * 3);
  const hRaw = new Float32Array(count);
  const albedo = new Float32Array(count * 3);
  // Tono del suelo: gris de las tierras altas, con manchas suaves y eyecta clara en cráteres frescos
  const fresh = terrain.craters.filter((c) => c.fresh > 0.75);
  let v = 0;
  for (let ring = 0; ring <= RINGS; ring += 1) {
    const r = R_MIN * (R_MAX / R_MIN) ** (ring / RINGS);
    for (let s = 0; s < SEGMENTS; s += 1) {
      const a = (s / SEGMENTS) * Math.PI * 2;
      const x = r * Math.sin(a);
      const z = -r * Math.cos(a);
      const h = terrain.height(x, z);
      pos[v * 3] = x;
      pos[v * 3 + 1] = h - curvatureDrop(r) - EYE_M; // el observador está en y = 0
      pos[v * 3 + 2] = z;
      hRaw[v] = h - EYE_M;
      let tone = 0.4 + 0.04 * Math.sin(x * 0.013 + Math.cos(z * 0.011) * 2.1) + 0.03 * Math.sin(z * 0.047 - x * 0.029);
      for (const c of fresh) {
        const q = Math.hypot(x - c.x, z - c.z) / (c.d / 2);
        if (q < 3) tone += 0.12 * (c.fresh - 0.75) * 4 * Math.exp(-((q - 1.2) ** 2) / 0.8);
      }
      albedo[v * 3] = tone;
      albedo[v * 3 + 1] = tone * 0.985;
      albedo[v * 3 + 2] = tone * 0.965;
      v += 1;
    }
  }
  const index = [];
  for (let ring = 0; ring < RINGS; ring += 1) {
    for (let s = 0; s < SEGMENTS; s += 1) {
      const a = ring * SEGMENTS + s;
      const b = ring * SEGMENTS + ((s + 1) % SEGMENTS);
      const c = a + SEGMENTS;
      const d = b + SEGMENTS;
      // Sentido antihorario visto desde arriba: normales hacia +y (arriba) y caras visibles
      index.push(a, b, c, b, d, c);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('hRaw', new THREE.BufferAttribute(hRaw, 1));
  geo.setAttribute('albedo', new THREE.BufferAttribute(albedo, 3));
  geo.setIndex(index);
  geo.computeVertexNormals();
  return new THREE.Mesh(geo, material);
}

/**
 * Crea el suelo 3D dentro de `container` (el div .sky-ground). Devuelve { render(state) } o
 * lanza un error si no hay WebGL (quien llama se queda con la textura plana).
 * state: { width, groundHeight, pxPerDeg, heading, sun, earth, radii }
 *   sun / earth: { azimuth_deg, elevation_deg } o null; radii: angular_radius_deg del contrato.
 */
export function createGround(container) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
  if (!renderer.capabilities.isWebGL2) throw new Error('El suelo 3D necesita WebGL2');
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  renderer.setClearColor(0x000000, 1);
  renderer.domElement.className = 'sky-ground__canvas';
  renderer.domElement.setAttribute('aria-hidden', 'true');

  const linearHeights = renderer.extensions.has('OES_texture_float_linear');

  // Mismo cielo, mismo terreno en cada carga (las coordenadas del sitio no cambian el dibujo).
  const terrain = createTerrain(11);
  const uniforms = {
    hNear: { value: heightTexture({ height: (x, z) => terrain.height(x, z) - EYE_M }, NEAR_SIZE, NEAR_RES, linearHeights) },
    hFar: { value: heightTexture({ height: (x, z) => terrain.height(x, z) - EYE_M }, FAR_SIZE, FAR_RES, linearHeights) },
    detail: { value: detailTexture() },
    sunDir: { value: new THREE.Vector3(0, 1, 0) },
    sunI: { value: 0 },
    sunSoft: { value: 212 },
    earthSoft: { value: 57 },
    earthDir: { value: new THREE.Vector3(0, 1, 0) },
    earthI: { value: 0 },
  };
  const material = new THREE.ShaderMaterial({ vertexShader: VERTEX, fragmentShader: FRAGMENT, uniforms });
  const scene = new THREE.Scene();
  scene.add(terrainMesh(terrain, material));
  const camera = new THREE.PerspectiveCamera(15, 4, 0.2, 6000);
  camera.position.set(0, 0, 0);
  camera.rotation.order = 'YXZ';
  container.append(renderer.domElement);

  // Fracción visible del disco (0 = bajo el horizonte, 1 = entero arriba)
  const size = { w: 0, h: 0 }; // último tamaño aplicado al canvas

  const visibleFraction = (el, r) => Math.min(1, Math.max(0, (el + r) / (2 * r)));

  return {
    render({ width, groundHeight, pxPerDeg, heading, sun, earth, radii }) {
      if (groundHeight < 1 || width < 1) return;
      const cam = groundCamera({ width, groundHeight, pxPerDeg });
      // setSize reasigna canvas.width/height, lo que borra el buffer: solo si el tamaño cambió.
      if (width !== size.w || groundHeight !== size.h) {
        size.w = width;
        size.h = groundHeight;
        renderer.setSize(width, groundHeight, false);
        renderer.domElement.style.width = `${width}px`;
        renderer.domElement.style.height = `${groundHeight}px`;
      }
      camera.fov = cam.vFovDeg;
      camera.aspect = cam.aspect;
      camera.setViewOffset(width, cam.fullHeight, 0, cam.offsetY, width, groundHeight);
      camera.rotation.y = (-heading * Math.PI) / 180;
      camera.updateProjectionMatrix();

      const setLight = (body, dirU, iU, strength, radius) => {
        if (!body) { iU.value = 0; return; }
        const d = directionFromAzEl(body.azimuth_deg, Math.max(body.elevation_deg, 0.05));
        dirU.value.set(d.x, d.y, d.z).normalize();
        iU.value = strength * visibleFraction(body.elevation_deg, radius);
      };
      const soft = (r) => 1 / Math.tan((r * Math.PI) / 180);
      uniforms.sunSoft.value = soft(radii?.sun ?? 0.25);
      uniforms.earthSoft.value = soft(radii?.earth ?? 1);
      setLight(sun, uniforms.sunDir, uniforms.sunI, 0.85, radii?.sun ?? 0.25);
      // La luz de la Tierra es miles de veces más débil que la del Sol (y depende de su fase, que
      // no se modela); acá se realza a propósito para que la noche no quede totalmente negra.
      setLight(earth, uniforms.earthDir, uniforms.earthI, 0.06, radii?.earth ?? 1);
      renderer.render(scene, camera);
    },
  };
}
