import * as THREE from 'three';

// Atmosphere: lit night, rain and snow. Cheap on purpose:
//  - Night glow changes the shared style materials (no extra lights):
//      'light' role (lamps, sign faces)     glows brighter
//      painted textures with a light mask   (texture.userData.glowMap: curtains,
//        office facades) glow only where the mask is lit
//      shop interiors and other textured 'signage' glow as painted
//      'window' glass                       a dim warm glow
//    plus soft additive light pools on the ground under street lamps.
//  - Rain: ~1500 short line streaks in a box that follows the camera target.
//  - Snow: ~1200 points drifting down; ground, grass, roofs and leaves turn
//    white (material colours lerp toward white, restored when it stops).
//  - weatherLight(preset, weather) darkens / cools a lighting preset.
//
// Materials are shared per style, so glow and snow also show in any other
// scene using the same style; call setNightGlow / setSnowCover on each root.

const GLOW = new THREE.Color(0xfff0d0);
const WINDOW_GLOW = new THREE.Color(0xffc870);

/** Turn the night glow on or off for every material under `root`. */
export function setNightGlow(root, on) {
  forMaterials(root, (m) => {
    const role = m.userData.role;
    if (!role || !m.emissive) return;
    const base = (m.userData.dayGlow ??= { color: m.emissive.clone(), intensity: m.emissiveIntensity, map: m.emissiveMap });
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
    const base = (m.userData.baseColor ??= m.color.clone());
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

/** Falling rain or snow in a box around a moving centre. */
export class Precipitation {
  constructor(kind, { count = kind === 'Rain' ? 1500 : 1200, size = [36, 18, 36] } = {}) {
    this.kind = kind;
    this.size = size;
    const n = count;
    const rnd = () => Math.random();
    this.seeds = Array.from({ length: n }, () => [rnd() * size[0], rnd() * size[1], rnd() * size[2], rnd()]);
    const geo = new THREE.BufferGeometry();
    if (kind === 'Rain') {
      this.pos = new Float32Array(n * 6);
      geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
      this.object = new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color: 0xb8c8dc, transparent: true, opacity: 0.55, depthWrite: false }));
    } else {
      this.pos = new Float32Array(n * 3);
      geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
      this.object = new THREE.Points(geo, new THREE.PointsMaterial({ color: 0xffffff, size: 0.05, sizeAttenuation: true, depthWrite: false }));
    }
    this.object.frustumCulled = false;
    this.object.renderOrder = 2;
    this.t = 0;
  }

  /** Advance by dt seconds around `center` (a Vector3, usually the player). */
  update(dt, center) {
    this.t += dt;
    const [W, H, D] = this.size;
    const rain = this.kind === 'Rain';
    const fall = rain ? 14 : 1.1;
    const p = this.pos;
    // particles live in a box that wraps around the centre (no respawning)
    const wrap = (v, size, c) => c - size / 2 + ((((v - c + size / 2) % size) + size) % size);
    this.seeds.forEach((s, i) => {
      s[1] -= fall * dt * (rain ? 1 : 0.7 + s[3] * 0.6);
      const drift = rain ? 0 : Math.sin(this.t * 0.8 + s[3] * 20) * 0.4;
      const x = wrap(s[0] + drift, W, center.x), z = wrap(s[2], D, center.z);
      const y = ((s[1] % H) + H) % H;
      if (rain) {
        // a short streak, slanting a little with the wind
        p.set([x, y, z, x + 0.06, y + 0.5, z + 0.03], i * 6);
      } else p.set([x, y, z], i * 3);
    });
    this.object.geometry.attributes.position.needsUpdate = true;
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
