import * as THREE from 'three';
import { seg, taperBetween } from '../../lib/shapes.js';
import { buildFoot } from './footwear.js';

// Legwear: trousers, shorts, skirt. Each leg is a chain of joints so it can
// walk and run naturally: hip (legL/legR) -> knee (shinL/shinR) -> ankle
// (footL/footR). Each joint group sits at its pivot point.

export const LEGWEAR = ['Trousers', 'Shorts', 'Skirt'];

export function buildLeg(f, kind, mats, sx, footwear = 'Shoes') {
  const leg = new THREE.Group();
  leg.name = sx < 0 ? 'legR' : 'legL';
  leg.position.set(sx * f.hx, f.hipY, 0);
  const ankle = -f.legLen + f.footH;
  const knee = -f.legLen * 0.48;
  const legMat = kind === 'Trousers' ? mats.legwear : mats.skin;
  const side = sx < 0 ? 'R' : 'L';
  // knees and feet sit a little closer to the centre than the hips
  const inX = -sx * f.hx * f.kneeIn;
  // thigh (hip -> knee), tapered
  const hip = [0, f.thighTop, 0];
  leg.add(taperBetween(hip, [inX, knee, 0], f.thighR, f.kneeR, legMat));
  // knee joint: the shin hangs from here (knee -> calf bulging back -> ankle)
  const shin = new THREE.Group();
  shin.name = `shin${side}`;
  shin.position.set(inX, knee, 0);
  leg.add(shin);
  const calfY = (ankle - knee) * 0.3;
  const calfZ = -f.kneeR * 0.35;
  const ankleY = ankle + f.ankleR - knee;
  shin.add(taperBetween([0, 0, 0], [0, calfY, calfZ], f.kneeR, f.calfR, legMat));
  shin.add(taperBetween([0, calfY, calfZ], [0, ankleY, 0], f.calfR, f.ankleR, legMat));
  // ankle joint: the foot (built in leg space, so shift it back by the joint position)
  const footJoint = new THREE.Group();
  footJoint.name = `foot${side}`;
  footJoint.position.set(0, ankle - knee, 0);
  const foot = buildFoot(f, footwear, mats.shoe, 0);
  foot.position.set(0, -ankle, 0);
  footJoint.add(foot);
  // heel and toe on the sole, in ankle-joint space: the gait keeps the
  // lowest of these on the ground so the standing foot stays planted
  const Lf = f.footL * 1.05;
  footJoint.userData.sole = [
    new THREE.Vector3(0, -f.footH, Lf * 0.25 - Lf / 2),
    new THREE.Vector3(0, -f.footH, Lf * 0.25 + Lf / 2),
  ];
  shin.add(footJoint);
  if (kind === 'Shorts') {
    // covers the upper thigh, a little wider than the leg
    const t = 0.8;
    const rEnd = THREE.MathUtils.lerp(f.thighR, f.kneeR, t);
    leg.add(taperBetween(hip, [inX * t, knee * t, 0], f.thighR * 1.12, rEnd * 1.15, mats.legwear));
  }
  return leg;
}

/**
 * Bottom (women): a rounded, low-poly volume behind the top of the thighs,
 * so the side view gets its S-curve (chest forward, bottom back). Few
 * segments on purpose: it reads as faceted, like the rest of the PS1 body.
 * Covered by whatever legwear is worn (not drawn under skirts).
 */
export function buildBottom(f, mats) {
  const L = f.torsoLen;
  const back = f.torsoR(L * 0.05) * f.torsoDepth;
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(1, 8, 5), mats.legwear);
  // sticks out about 0.1 × hip width behind the torso: a curve, not a shelf
  mesh.scale.set(f.hw * 0.44, L * 0.16, f.hw * 0.2);
  mesh.position.set(0, f.hipY - L * 0.03, -back + f.hw * 0.1);
  mesh.name = 'bottom';
  return mesh;
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
