import * as THREE from 'three';
import { capsuleBetween, ellipsoid, seg } from '../../lib/shapes.js';

// Legwear: trousers, shorts, skirt. Legs are groups pivoting at the hip.

export const LEGWEAR = ['Trousers', 'Shorts', 'Skirt'];

export function buildLeg(f, kind, mats, sx) {
  const leg = new THREE.Group();
  leg.name = sx < 0 ? 'legR' : 'legL';
  leg.position.set(sx * f.hx, f.hipY, 0);
  const ankle = -f.legLen + f.footH;
  const bottom = [0, ankle + f.legR * 0.5, 0];

  if (kind === 'Trousers') {
    leg.add(capsuleBetween([0, 0, 0], bottom, f.legR, mats.legwear));
  } else {
    // bare leg, slightly slimmer than a trouser leg
    leg.add(capsuleBetween([0, 0, 0], bottom, f.legR * 0.85, mats.skin));
    if (kind === 'Shorts') {
      leg.add(capsuleBetween([0, 0, 0], [0, -f.legLen * 0.4, 0], f.legR * 1.18, mats.legwear));
    }
  }
  leg.add(ellipsoid(1, [f.legR * 1.1, f.footH / 2, f.footL / 2], mats.shoe, {
    position: [0, -f.legLen + f.footH / 2, f.footL * 0.22],
  }));
  return leg;
}

/** A flared skirt hanging from just above the hips to about knee height. */
export function buildSkirt(f, mats) {
  const L = f.torsoLen;
  const topY = L * 0.14;
  const len = L * 0.14 + f.legLen * 0.42;
  const pts = [
    new THREE.Vector2(f.hx + f.legR * 2.6, topY - len),
    new THREE.Vector2(f.torsoR(topY) * 1.04, topY),
  ];
  const skirt = new THREE.Mesh(new THREE.LatheGeometry(pts, seg(24)), mats.legwear);
  skirt.position.y = f.hipY;
  skirt.scale.z = 0.8;
  skirt.name = 'skirt';
  return skirt;
}
