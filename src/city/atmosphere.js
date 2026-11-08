import * as THREE from 'three';

// Atmosphere: lit night, rain and snow. Cheap on purpose:
//  - Night glow changes the shared style materials (no extra lights):
//      'light' role (lamps, sign faces)     glows brighter
//      painted textures with a light mask   (texture.userData.glowMap: curtains,
//        office facades) glow only where the mask is lit
//      shop interiors and other textured 'signage' glow as painted
//      'window' glass                       a dim warm glow
//    plus soft additive light pools on the ground under street lamps.
//  - Rain / snow: streaks or flakes faked around the camera (Precipitation),
//    real-world sizes, always covering the view; snow also: ground, grass, roofs and leaves turn
//    white (material colours lerp toward white, restored when it stops).
//  - weatherLight(preset, weather) darkens / cools a lighting preset.
//
// Materials are shared per style, so glow and snow also show in any other
// scene using the same style; call setNightGlow / setSnowCover on each root.

// A material's own (day) glow and colour, remembered outside the material:
// kept in userData they were mangled when a material was cloned (cars and
// people get marked copies for silhouettes), which made those cars black.
const dayGlowOf = new WeakMap(), baseColorOf = new WeakMap();

const GLOW = new THREE.Color(0xfff0d0);
const WINDOW_GLOW = new THREE.Color(0xffc870);

/** Turn the night glow on or off for every material under `root`. */
export function setNightGlow(root, on) {
  forMaterials(root, (m) => {
    const role = m.userData.role;
    if (!role || !m.emissive) return;
    if (!dayGlowOf.has(m)) dayGlowOf.set(m, { color: m.emissive.clone(), intensity: m.emissiveIntensity, map: m.emissiveMap });
    const base = dayGlowOf.get(m);
    if (!on) {
      m.emissive.copy(base.color); m.emissiveIntensity = base.intensity; setMap(m, base.map);
      return;
    }
    const glowMap = m.map?.userData.glowMap;
    if (glowMap) { m.emissive.copy(GLOW); m.emissiveIntensity = 1; setMap(m, glowMap); }
    else if (role === 'light') { m.emissiveIntensity = 1.3; if (m.map) { m.emissive.copy(GLOW); setMap(m, m.map); } }
    else if (role === 'signage' && m.map) { m.emissive.copy(GLOW); m.emissiveIntensity = 0.75; setMap(m, m.map); }
    else if (role === 'window') { m.emissive.copy(WINDOW_GLOW); m.emissiveIntensity = 0.3; }
  });
}

function setMap(m, map) {
  if (m.emissiveMap === map) return;
  m.emissiveMap = map ?? null;
  m.needsUpdate = true;
}

// how white each role turns under snow (roads are cleared, walls stay)
const SNOW = { ground: 0.55, sidewalk: 0.5, grass: 0.8, roof: 0.75, leaf: 0.45, road: 0.25, concrete: 0.2, bark: 0.1 };
const WHITE = new THREE.Color(0xf4f6fa);

/** Snow on the ground, grass, roofs and trees (on) or gone (off). */
export function setSnowCover(root, on) {
  forMaterials(root, (m) => {
    const k = SNOW[m.userData.role];
    if (k === undefined || !m.color) return;
    if (!baseColorOf.has(m)) baseColorOf.set(m, m.color.clone());
    const base = baseColorOf.get(m);
    m.color.copy(base);
    if (on) m.color.lerp(WHITE, k);
  });
}

function forMaterials(root, fn) {
  const seen = new Set();
  root.traverse((o) => {
    if (!o.material) return;
    for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
      if (seen.has(m)) continue;
      seen.add(m);
      fn(m);
    }
  });
}

/** The lighting preset adjusted for the weather (rain: darker, grey; snow: bright, cool). */
export function weatherLight(preset, weather) {
  if (weather === 'Rain') {
    return { ...preset, key: preset.key * 0.55, hemi: preset.hemi * 0.8,
      tint: preset.tint ?? 0x6a7480, tintAmount: Math.max(preset.tintAmount, 0.55) };
  }
  if (weather === 'Snow') {
    return { ...preset, key: preset.key * 0.75, hemi: preset.hemi * 1.1,
      tint: preset.tint ?? 0xdfe6ee, tintAmount: Math.max(preset.tintAmount, 0.6) };
  }
  return preset;
}

/**
 * Falling rain or snow, faked around the camera instead of filling a box in
 * the world: it always covers the whole view, it has no edges, and it is
 * drawn on top (depthTest off), so buildings never hide it. Sizes and
 * densities are in metres, like real rain:
 *  drops sit on one plane in front of the camera, sized in metres for the
 *  view at the player: iso uses the orthographic view size, third person the
 *  view size at the camera's distance to the player. The number shown
 *  follows that visible area (zoomed in: a few real-size drops and flakes;
 *  zoomed out: the whole view covered with small ones). Same logic for both.
 *  Zoomed in past a 24 m tall view, drops keep their screen size and number
 *  (capped), so the weather looks the same and never gets in the way.
 *
 *   precip.update(dt, camera, { pixels, distance })   // after the camera moved;
 *     pixels = low-res picture height, distance = camera to player (third person)
 */
const REF_AREA = 1536; // view area (m²) at the default iso zoom, where all drops show
const MIN_HALF_VIEW = 12; // m: below this half view height, drops keep their screen size
export class Precipitation {
  constructor(kind, { count = kind === 'Rain' ? 1200 : 900 } = {}) {
    this.kind = kind;
    this.count = count;
    const rnd = () => Math.random();
    // [u, v] in -1..1 on the view, speed factor, phase, distance factor
    this.seeds = Array.from({ length: count }, () => [rnd() * 2 - 1, rnd() * 2 - 1, 0.8 + rnd() * 0.4, rnd() * 100, rnd()]);
    const geo = new THREE.BufferGeometry();
    const rain = kind === 'Rain';
    this.pos = new Float32Array(count * (rain ? 6 : 3));
    geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    const common = { transparent: true, depthTest: false, depthWrite: false };
    this.object = rain
      ? new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color: 0xb8c8dc, opacity: 0.55, ...common }))
      : new THREE.Points(geo, new THREE.PointsMaterial({ color: 0xffffff, size: 1, sizeAttenuation: false, ...common }));
    this.object.frustumCulled = false;
    this.object.renderOrder = 20; // after everything, on top
    this.t = 0;
  }

  update(dt, camera, { pixels = 300, distance = 6 } = {}) {
    this.t += dt;
    const rain = this.kind === 'Rain';
    const ortho = camera.isOrthographicCamera;
    const fall = rain ? 14 : 1.1; // m/s
    // the view's half size in metres where the player is
    const halfH = ortho ? (camera.top - camera.bottom) / 2 / camera.zoom : Math.tan((camera.fov * Math.PI) / 360) * distance;
    const halfW = ortho ? (camera.right - camera.left) / 2 / camera.zoom : halfH * camera.aspect;
    const depth = ortho ? camera.near + 1 : distance;
    // drops shown follow the visible area, never less than a 24 m tall view's
    const capH = Math.max(halfH, MIN_HALF_VIEW), capW = capH * (halfW / halfH);
    const shown = Math.min(this.count, Math.round((this.count * 4 * capW * capH) / REF_AREA));
    // zoomed in closer than a 24 m tall view, drops stop growing on screen
    // (only fewer of them show), so they never get in the way
    const grow = Math.min(1, halfH / MIN_HALF_VIEW);
    const p = this.pos;
    for (let i = 0; i < shown; i++) {
      const sd = this.seeds[i];
      sd[1] -= (fall * sd[2] * (rain ? 1 : 0.85) * dt) / halfH;
      if (sd[1] < -1.05) { sd[1] += 2.1; sd[0] = Math.random() * 2 - 1; }
      let x = sd[0] * halfW;
      if (!rain) x += Math.sin(this.t * 0.8 + sd[3]) * 0.4; // snow drifts
      const y = sd[1] * halfH;
      if (rain) p.set([x, y, -depth, x + 0.06 * grow, y + 0.5 * grow, -depth], i * 6);
      else p.set([x, y, -depth], i * 3);
    }
    this.object.geometry.setDrawRange(0, shown * (rain ? 2 : 1));
    this.object.geometry.attributes.position.needsUpdate = true;
    // an 8 cm flake, in pixels of the low-res picture
    if (!rain) this.object.material.size = Math.max(1, (0.08 * pixels) / (2 * Math.max(halfH, MIN_HALF_VIEW)));
    // ride along with the camera
    this.object.position.copy(camera.position);
    this.object.quaternion.copy(camera.quaternion);
    this.object.updateMatrixWorld();
  }

  dispose() {
    this.object.geometry.dispose();
    this.object.material.dispose();
  }
}

/** Soft warm light pools on the ground under street lamps (for the night). */
export function lampPools(points) {
  const g = new THREE.Group();
  g.name = 'lampPools';
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const x = c.getContext('2d');
  const grad = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, 'rgba(255,220,150,0.55)');
  grad.addColorStop(1, 'rgba(255,220,150,0)');
  x.fillStyle = grad; x.fillRect(0, 0, 64, 64);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
  const geo = new THREE.PlaneGeometry(7, 7).rotateX(-Math.PI / 2);
  for (const [px, pz] of points) {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(px, 0.2, pz);
    m.renderOrder = 1;
    g.add(m);
  }
  return g;
}
