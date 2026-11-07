import * as THREE from 'three';
import { ellipsoid, seg, taperBetween } from '../../lib/shapes.js';

// Legwear: trousers, shorts, skirt. Legs are groups pivoting at the hip.

export const LEGWEAR = ['Trousers', 'Shorts', 'Skirt'];

export function buildLeg(f, kind, mats, sx) {
  const leg = new THREE.Group();
  leg.name = sx < 0 ? 'legR' : 'legL';
  leg.position.set(sx * f.hx, f.hipY, 0);
  const ankle = -f.legLen + f.footH;
  const knee = -f.legLen * 0.48;
  const legMat = kind === 'Trousers' ? mats.legwear : mats.skin;
  // knees and feet sit a little closer to the centre than the hips
  const inX = -sx * f.hx * f.kneeIn;
  // thigh (hip -> knee) and shin (knee -> ankle), tapered
  leg.add(taperBetween([0, 0, 0], [inX, knee, 0], f.thighR, f.kneeR, legMat));
  leg.add(taperBetween([inX, knee, 0], [inX, ankle + f.ankleR, 0], f.kneeR, f.ankleR, legMat));
  if (kind === 'Shorts') {
    // covers the upper thigh, a little wider than the leg
    const t = 0.8;
    const rEnd = THREE.MathUtils.lerp(f.thighR, f.kneeR, t);
    leg.add(taperBetween([0, 0, 0], [inX * t, knee * t, 0], f.thighR * 1.12, rEnd * 1.15, mats.legwear));
  }
  leg.add(ellipsoid(1, [Math.max(f.ankleR * 1.6, f.legR * 0.9), f.footH / 2, f.footL / 2], mats.shoe, {
    position: [inX, -f.legLen + f.footH / 2, f.footL * 0.22],
  }));
  return leg;
}

/** A flared skirt hanging from just above the hips to about knee height. */
export function buildSkirt(f, mats) {
  const L = f.torsoLen;
  const topY = L * 0.14;
  const len = L * 0.14 + f.legLen * 0.42;
  const pts = [
    new THREE.Vector2(f.hx + f.thighR * 2.1, topY - len),
    new THREE.Vector2(f.torsoR(topY) * 1.04, topY),
  ];
  const skirt = new THREE.Mesh(new THREE.LatheGeometry(pts, seg(24)), mats.legwear);
  skirt.position.y = f.hipY;
  skirt.scale.z = 0.8;
  skirt.name = 'skirt';
  return skirt;
}
