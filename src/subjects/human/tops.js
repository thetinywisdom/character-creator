import * as THREE from 'three';
import { capsuleBetween, seg } from '../../lib/shapes.js';

// Tops: the torso is built from horizontal bands (fractions of torso height),
// each in its own material. That's how a crop top shows a strip of skin and a
// tank top shows bare shoulders.
// Small details (shirt collars and plackets) are deliberately oversized so
// they still read when the character is tiny (style guide).

export const TOPS = {
  'T-shirt':                { sleeve: 'short' },
  'T-shirt (long sleeve)':  { sleeve: 'long' },
  'Shirt':                  { sleeve: 'short', collar: true },
  'Shirt (long sleeve)':    { sleeve: 'long', collar: true },
  'Tank top':               { sleeve: 'none', tank: true },
  'Crop top':               { sleeve: 'short', crop: true },
  'Crop top (long sleeve)': { sleeve: 'long', crop: true },
};

/** One horizontal slice of the torso, from y0 to y1 (torso-local metres). */
function band(f, y0, y1, material) {
  const L = f.torsoLen;
  const pts = [];
  if (y0 <= 0) pts.push(new THREE.Vector2(0, 0));
  pts.push(new THREE.Vector2(f.torsoR(y0), y0));
  for (const q of f.torsoSamples) if (q.y > y0 && q.y < y1) pts.push(q.clone());
  pts.push(new THREE.Vector2(f.torsoR(y1), y1));
  if (y1 >= L) pts.push(new THREE.Vector2(0, L));
  const mesh = new THREE.Mesh(new THREE.LatheGeometry(pts, seg(28)), material);
  mesh.position.y = f.hipY;
  mesh.scale.z = f.torsoDepth;
  return mesh;
}

export function buildTorso(f, spec, mats) {
  const L = f.torsoLen;
  const torso = new THREE.Group();
  torso.name = 'torso';
  // [from, to, material] as fractions of the torso height
  const bands = spec.crop
    ? [[0, 0.16, mats.legwear], [0.16, 0.5, mats.skin], [0.5, 1, mats.top]]
    : spec.tank
      ? [[0, 0.88, mats.top], [0.88, 1, mats.skin]]
      : [[0, 1, mats.top]];
  for (const [a, b, m] of bands) torso.add(band(f, a * L, b * L, m));

  if (f.woman) {
    // chest: two large, soft shapes that merge into one bust silhouette, in
    // whatever covers that height. Kept smooth (min segments) even in low-poly.
    const y = L * 0.72;
    const m = (bands.find(([a, b]) => y >= a * L && y <= b * L) ?? bands.at(-1))[2];
    const r = f.sw * 0.19;
    const front = f.torsoR(y) * f.torsoDepth;
    for (const sx of [-1, 1]) {
      const bust = new THREE.Mesh(new THREE.SphereGeometry(r, seg(16, 10), seg(10, 7)), m);
      bust.scale.set(1, 0.85, 0.75);
      bust.position.set(sx * f.sw * 0.12, f.hipY + y, front - r * 0.5);
      torso.add(bust);
    }
  }

  if (spec.tank) {
    // chunky shoulder straps over the bare band
    for (const sx of [-1, 1]) {
      const x = sx * f.sw * 0.22;
      const strap = new THREE.Mesh(new THREE.BoxGeometry(f.sw * 0.12, L * 0.16, f.torsoR(L * 0.93) * f.torsoDepth * 2.1), mats.top);
      strap.position.set(x, f.hipY + L * 0.93, 0);
      torso.add(strap);
    }
  }

  if (spec.collar) {
    // a chunky collar ring and a button strip down the front
    const collar = new THREE.Mesh(
      new THREE.TorusGeometry(f.neckR * 1.55, f.neckR * 0.6, seg(6), seg(14)),
      mats.accent,
    );
    collar.rotation.x = Math.PI / 2;
    collar.scale.y = 0.8;
    collar.position.y = f.shoulderY - L * 0.02;
    torso.add(collar);
    const front = f.torsoR(L * 0.5) * f.torsoDepth;
    const placket = new THREE.Mesh(new THREE.BoxGeometry(f.sw * 0.1, L * 0.82, f.limbR * 0.6), mats.accent);
    placket.position.set(0, f.hipY + L * 0.44, front + f.limbR * (f.woman ? 0.9 : 0.15));
    torso.add(placket);
  }
  return torso;
}

/** Sleeve for one arm (arm-local: shoulder at the origin, arm hangs down -y). */
export function buildSleeve(f, spec, material) {
  if (spec.sleeve === 'short') {
    return capsuleBetween([0, 0, 0], [0, -f.armLen * 0.28, 0], f.armR * 1.2, material);
  }
  if (spec.sleeve === 'long') {
    return capsuleBetween([0, 0, 0], [0, -(f.armLen - f.handR * 1.7), 0], f.armR * 1.15, material);
  }
  return null;
}
