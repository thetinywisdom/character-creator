// Shared mesh helpers and rig proportions. Numbers match iso-city so existing
// parts land on the same joints the walk, IK and held-item poses expect.
import * as THREE from 'three';

export const HIP_Y = 0.9, HIP_X = 0.088, THIGH = 0.42, SHIN = 0.40;
export const SHOULDER_Y = 1.572, SHOULDER_X = 0.205, UPPER = 0.40, FORE = 0.31;
export const NECK_Y = 1.62, HEAD_C = 0.215; // head centre above the neck pivot
export const TORSO_Z = 0.72, HEAD_Z = 1.08;
export const TORSO = [[0, 0.84], [0.15, 0.845], [0.168, 0.9], [0.17, 1.0], [0.163, 1.15], [0.172, 1.35],
  [0.18, 1.48], [0.182, 1.58], [0.15, 1.645], [0.07, 1.675], [0, 1.68]];
export const HEAD = [[0, -0.15], [0.06, -0.145], [0.093, -0.108], [0.106, -0.045], [0.11, 0.03],
  [0.103, 0.09], [0.08, 0.135], [0.042, 0.158], [0, 0.163]];

/** Body-type scales. Shoulder / hip / belly sliders offset these; 0 leaves them unchanged. */
export const SHAPES = {
  skinny: { sh: 0.9, hip: 0.86, tx: 0.8, tz: 0.78, leg: 0.74, arm: 0.72 },
  average: { sh: 1, hip: 1, tx: 1, tz: 1, leg: 1, arm: 1 },
  fat: { sh: 1.2, hip: 1.38, tx: 1.4, tz: 1.42, leg: 1.36, arm: 1.32 },
  muscle: { sh: 1.36, hip: 1.06, tx: 1.26, tz: 1.12, leg: 1.22, arm: 1.6 },
};

export const LAYER_TOPS = ['blazer', 'cardigan', 'coat', 'hoodie'];

export const METRICS = {
  HIP_Y, HIP_X, THIGH, SHIN, UPPER, FORE, NECK_Y, HEAD_C, TORSO_Z, HEAD_Z,
  SHOULDER_Y, SHOULDER_X, SHAPES, LAYER_TOPS,
};

const matCache = new Map();
export function mat(color, double = false) {
  const key = color + (double ? 'd' : '');
  if (!matCache.has(key)) {
    matCache.set(key, new THREE.MeshLambertMaterial({
      color, flatShading: true, side: double ? THREE.DoubleSide : THREE.FrontSide,
    }));
  }
  return matCache.get(key);
}

export function mesh(geo, color, parent, { double = false, pos, rot, scale } = {}) {
  const m = new THREE.Mesh(geo, mat(color, double));
  if (pos) m.position.set(...pos);
  if (rot) m.rotation.set(...rot);
  if (scale) m.scale.set(...scale);
  parent.add(m);
  return m;
}

export function group(parent, x = 0, y = 0, z = 0) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  parent.add(g);
  return g;
}

/** profile: [[radius, y], ...] ascending y. zs = depth scale (elliptical sections). */
export function lathe(profile, segs, zs = 1, phiStart = 0, phiLength = Math.PI * 2) {
  const pts = profile.map(([r, y]) => new THREE.Vector2(Math.max(r, 0.0001), y));
  const g = new THREE.LatheGeometry(pts, segs, phiStart, phiLength);
  g.scale(1, 1, zs);
  return g;
}

/** Clip a profile to [y0, y1] (interpolating ends) and grow it radially. */
export function clip(profile, y0, y1, grow = 1, yGrow = 1) {
  const out = [];
  const at = (y) => {
    for (let i = 0; i < profile.length - 1; i++) {
      const [r0, a] = profile[i], [r1, b] = profile[i + 1];
      if (y >= a && y <= b) return r0 + (r1 - r0) * ((y - a) / (b - a || 1));
    }
    return y < profile[0][1] ? profile[0][0] : profile[profile.length - 1][0];
  };
  out.push([at(y0), y0]);
  for (const p of profile) if (p[1] > y0 && p[1] < y1) out.push(p);
  out.push([at(y1), y1]);
  return out.map(([r, y]) => [r * grow, y * yGrow]);
}

/** Cylinder hanging down from its pivot by `len`. */
export function limb(rTop, rBot, len, segs = 6, y0 = 0) {
  const g = new THREE.CylinderGeometry(rTop, rBot, len, segs, 1);
  g.translate(0, y0 - len / 2, 0);
  return g;
}

/** Tapered box (hands / feet): bottom / front verts scaled. */
export function taperBox(w, h, d, { botX = 1, botZ = 1, frontTopY = 0 } = {}) {
  const g = new THREE.BoxGeometry(w, h, d);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    if (p.getY(i) < 0) { p.setX(i, p.getX(i) * botX); p.setZ(i, p.getZ(i) * botZ); }
    if (frontTopY && p.getZ(i) > 0 && p.getY(i) > 0) p.setY(i, p.getY(i) + frontTopY);
  }
  g.computeVertexNormals();
  return g;
}

/** Thin line following the front of a lathe profile (plackets, coat edges). */
export function frontLine(parent, profile, y0, y1, zs, color, x = 0, w = 0.008, push = 0.004) {
  const pts = clip(profile, y0, y1);
  for (let i = 0; i < pts.length - 1; i++) {
    const [ra, ya] = pts[i], [rb, yb] = pts[i + 1];
    const za = Math.sqrt(Math.max(ra * ra - x * x, 0)) * zs + push;
    const zb = Math.sqrt(Math.max(rb * rb - x * x, 0)) * zs + push;
    const len = Math.hypot(yb - ya, zb - za);
    const m = mesh(new THREE.BoxGeometry(w, len, w), color, parent);
    m.position.set(x, (ya + yb) / 2, (za + zb) / 2);
    m.rotation.x = -Math.atan2(zb - za, yb - ya);
  }
}

export function mulberry32(seed) {
  let a = (typeof seed === 'string' ? [...seed].reduce((h, c) => (h * 31 + c.charCodeAt(0)) | 0, 7) : seed) >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function disposeTree(root) {
  root?.traverse?.((o) => {
    if (o.geometry) o.geometry.dispose();
  });
}
