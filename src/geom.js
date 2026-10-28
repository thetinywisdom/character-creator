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
export function mat(color, double = false, bias = 0) {
  const key = color + (double ? 'd' : '') + (bias || '');
  if (!matCache.has(key)) {
    const m = new THREE.MeshLambertMaterial({
      color, flatShading: true, side: double ? THREE.DoubleSide : THREE.FrontSide,
    });
    // Outer shells (shirt, sleeves, hair) draw in front of the skin they wrap,
    // so a shared edge does not flicker.
    if (bias) {
      m.polygonOffset = true;
      m.polygonOffsetFactor = bias;
      m.polygonOffsetUnits = bias;
    }
    matCache.set(key, m);
  }
  return matCache.get(key);
}

export function mesh(geo, color, parent, { double = false, pos, rot, scale, bias = 0 } = {}) {
  const m = new THREE.Mesh(geo, mat(color, double, bias));
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

// A bent limb is one tube. Straight parts stay on the bones; a fillet of radius
// rho replaces the corner, so a straight joint has no crease and a bend reads
// as an arc. The wrist / ankle stay on the bone. rho is shared by a sleeve and
// the skin under it so the two centerlines match.
const _bendBox = new THREE.Box3();
const _bendV = new THREE.Vector3();
const MAX_RINGS = 24;
const MAX_RADIAL = 8;

/**
 * Tube along -Y of `parent`, bending with `joint` (a child whose rest position
 * is (0, -dElbow, 0)). Call applyBends after the joint rotates.
 */
export function bendTube(root, parent, joint, color, spec) {
  const radial = spec.radial ?? 6;
  const posArr = new Float32Array(MAX_RINGS * MAX_RADIAL * 3 + 6);
  const idxArr = new Uint16Array((MAX_RINGS - 1) * MAX_RADIAL * 6 + MAX_RADIAL * 6);
  const geo = new THREE.BufferGeometry();
  const posAttr = new THREE.BufferAttribute(posArr, 3);
  const idxAttr = new THREE.BufferAttribute(idxArr, 1);
  geo.setAttribute('position', posAttr);
  geo.setIndex(idxAttr);
  geo.boundingSphere = new THREE.Sphere();
  const m = mesh(geo, color, parent, { bias: spec.bias || 0 });
  m.name = spec.name || 'bend';
  m.userData.spec = spec;
  m.userData.joint = joint;
  m.userData.radial = radial;
  m.userData.applyBend = () => fillBend(m);
  const list = root.userData.bends || (root.userData.bends = []);
  list.push(m);
  m.userData.applyBend();
  return m;
}

export function applyBends(root) {
  const list = root?.userData?.bends;
  if (!list) return;
  for (let i = 0; i < list.length; i++) list[i].userData.applyBend();
}

function radiusAt(spec, d) {
  const { d0, d1, dElbow, r0, rElbow, r1 } = spec;
  if (dElbow <= d0 + 1e-4 || dElbow >= d1 - 1e-4) {
    const span = Math.max(d1 - d0, 1e-4);
    return r0 + (r1 - r0) * ((d - d0) / span);
  }
  if (d <= dElbow) return r0 + (rElbow - r0) * ((d - d0) / Math.max(dElbow - d0, 1e-4));
  return rElbow + (r1 - rElbow) * ((d - dElbow) / Math.max(d1 - dElbow, 1e-4));
}

function fillBend(m) {
  const spec = m.userData.spec;
  const joint = m.userData.joint;
  const radial = m.userData.radial;
  const { d0, d1, dElbow, rho, tMax, innerFrac = 0.85 } = spec;
  const bend = -joint.rotation.x;
  const sign = bend >= 0 ? 1 : -1;
  const alpha = Math.min(Math.abs(bend), Math.PI - 0.08);
  let t = 0;
  let rhoEff = rho;
  if (alpha > 1e-4) {
    const tanH = Math.tan(alpha * 0.5);
    t = Math.min(tMax, rho * tanH);
    rhoEff = t / tanH;
  }
  const limit = rhoEff * innerFrac;
  const pivotY = -dElbow;
  const ds = [];
  const push = (d) => {
    const c = Math.max(d0, Math.min(d1, d));
    if (ds.length && c - ds[ds.length - 1] < 0.008) return;
    ds.push(c);
  };
  push(d0);
  if (t > 0.004) {
    const dA = dElbow - t;
    const dB = dElbow + t;
    if (dA > d0 + 0.05) push((d0 + dA) * 0.5);
    const steps = 10;
    for (let i = 0; i <= steps; i++) push(dA + (dB - dA) * (i / steps));
    if (d1 > dB + 0.05) push((dB + d1) * 0.5);
  } else if (d1 > d0 + 0.05) {
    push((d0 + d1) * 0.5);
  }
  push(d1);

  const pos = m.geometry.attributes.position.array;
  let v = 0;
  const place = (d, x, zRest) => {
    const s = dElbow - d;
    const z0 = zRest * sign;
    let y;
    let z;
    if (t < 1e-4 || s >= t) {
      y = s;
      z = z0;
    } else if (s <= -t) {
      const c = Math.cos(alpha);
      const sn = Math.sin(alpha);
      y = s * c + z0 * sn;
      z = -s * sn + z0 * c;
    } else {
      const zc = z0 > limit ? limit : z0;
      const phi = ((t - s) / (2 * t)) * alpha;
      const sp = Math.sin(phi);
      const cp = Math.cos(phi);
      y = (t - rhoEff * sp) + zc * sp;
      z = rhoEff * (1 - cp) + zc * cp;
    }
    pos[v++] = x;
    pos[v++] = pivotY + y;
    pos[v++] = z * sign;
  };

  const ringStart = [];
  for (let i = 0; i < ds.length; i++) {
    ringStart.push(v / 3);
    const r = radiusAt(spec, ds[i]);
    for (let k = 0; k < radial; k++) {
      const a = (k / radial) * Math.PI * 2;
      place(ds[i], Math.cos(a) * r, Math.sin(a) * r);
    }
  }
  let topCenter = -1;
  let botCenter = -1;
  if (spec.caps !== false) {
    topCenter = v / 3;
    place(ds[0], 0, 0);
    botCenter = v / 3;
    place(ds[ds.length - 1], 0, 0);
  }
  const vertCount = v / 3;

  const idx = m.geometry.index.array;
  let n = 0;
  const tri = (a, b, c) => { idx[n++] = a; idx[n++] = b; idx[n++] = c; };
  for (let i = 0; i < ds.length - 1; i++) {
    const a0 = ringStart[i];
    const b0 = ringStart[i + 1];
    for (let k = 0; k < radial; k++) {
      const k1 = (k + 1) % radial;
      tri(a0 + k, a0 + k1, b0 + k);
      tri(a0 + k1, b0 + k1, b0 + k);
    }
  }
  if (topCenter >= 0) {
    for (let k = 0; k < radial; k++) {
      const k1 = (k + 1) % radial;
      // Caps face out of the tube: +Y at the shoulder end, down the bone at the wrist.
      tri(topCenter, ringStart[0] + k1, ringStart[0] + k);
      tri(botCenter, ringStart[ds.length - 1] + k, ringStart[ds.length - 1] + k1);
    }
  }

  const geo = m.geometry;
  geo.attributes.position.needsUpdate = true;
  geo.index.needsUpdate = true;
  geo.setDrawRange(0, n);
  _bendBox.makeEmpty();
  for (let i = 0; i < vertCount; i++) _bendBox.expandByPoint(_bendV.fromArray(pos, i * 3));
  _bendBox.getBoundingSphere(geo.boundingSphere);
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
