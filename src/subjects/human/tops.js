import * as THREE from 'three';
import { capsuleBetween, seg } from '../../lib/shapes.js';
import { sculptTorso } from './sculpt.js';

// Tops: the torso is built from horizontal bands (fractions of torso height),
// each in its own material. That's how a crop top shows a strip of skin.
// A tank top is a clean sleeveless body: the bare arms are what make it read.
// Small details (shirt collars and plackets) are deliberately oversized so
// they still read when the character is tiny (style guide).

export const TOPS = {
  'T-shirt':                { sleeve: 'short' },
  'T-shirt (long sleeve)':  { sleeve: 'long' },
  'Shirt':                  { sleeve: 'short', collar: true },
  'Shirt (long sleeve)':    { sleeve: 'long', collar: true },
  'Tank top':               { sleeve: 'none' },
  'Crop top':               { sleeve: 'short', crop: true },
  'Crop top (long sleeve)': { sleeve: 'long', crop: true },
};

/** One horizontal slice of the torso, from y0 to y1 (torso-local metres). */
function band(f, y0, y1, material) {
  const L = f.torsoLen;
  const pts = [];
  if (y0 <= f.torsoBottom) pts.push(new THREE.Vector2(0, y0));
  pts.push(new THREE.Vector2(f.torsoR(y0), y0));
  for (const q of f.torsoSamples) if (q.y > y0 && q.y < y1) pts.push(q.clone());
  pts.push(new THREE.Vector2(f.torsoR(y1), y1));
  if (y1 >= L) pts.push(new THREE.Vector2(0, L));
  // phiStart = π/2 puts the lathe seam at the side, away from the sculpted zones
  const lathe = new THREE.LatheGeometry(pts, f.torsoRadial, Math.PI / 2);
  const mesh = new THREE.Mesh(sculptTorso(lathe, f), material);
  mesh.position.y = f.hipY;
  mesh.scale.z = f.torsoDepth;
  return mesh;
}

export function buildTorso(f, spec, mats) {
  const L = f.torsoLen;
  const torso = new THREE.Group();
  torso.name = 'torso';
  // [from, to, material] as fractions of the torso height
  // Every top stops at the hip line, so the waistband of the trousers or
  // skirt shows below it and the hip shape reads as body, not as a flared shirt.
  const HIP = 0.12;
  const start = f.torsoBottom / L; // 0, or below the hip line for women
  const bands = spec.crop
    ? [[start, 0.16, mats.legwear], [0.16, 0.5, mats.skin], [0.5, 1, mats.top]]
    : [[start, HIP, mats.legwear], [HIP, 1, mats.top]];
  for (const [a, b, m] of bands) torso.add(band(f, a * L, b * L, m));

  if (f.woman && f.chestShape === 'Wedge') torso.add(chest(f, L, bands));

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
    const placket = new THREE.Mesh(new THREE.BoxGeometry(f.sw * 0.1, L * 0.82, f.armR * 0.6), mats.accent);
    placket.position.set(0, f.hipY + L * 0.44, front + f.armR * 0.15);
    torso.add(placket);
  }
  return torso;
}

/**
 * Chest: a single trapezoid block, the classic low-poly way to suggest a bust.
 * The back face sits on the torso; the front face is narrower and only as
 * tall as the lower part of the back face, so the top slopes down and forward
 * from the upper chest while the underside stays nearly flat. Flat faces.
 */
function chest(f, L, bands) {
  const y = L * 0.72;
  const m = (bands.find(([a, b]) => y >= a * L && y <= b * L) ?? bands.at(-1))[2];
  const W = f.sw * 0.72;   // width at the chest (spans most of it)
  const Hb = L * 0.34;     // height where it meets the chest
  const D = f.sw * 0.34;   // depth of the block
  const geo = new THREE.BoxGeometry(W, Hb, D);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    if (pos.getZ(i) > 0) {
      // front face: narrower, shorter, lower
      pos.setX(i, pos.getX(i) * 0.9);
      pos.setY(i, -Hb / 2 + (pos.getY(i) + Hb / 2) * 0.42);
    }
  }
  geo.computeVertexNormals();
  const mesh = new THREE.Mesh(geo, m);
  mesh.position.set(0, f.hipY + y, f.torsoR(y) * f.torsoDepth - D * 0.2);
  mesh.name = 'chest';
  return mesh;
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
