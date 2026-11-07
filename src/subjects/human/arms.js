import * as THREE from 'three';
import { ellipsoid, taperBetween } from '../../lib/shapes.js';

// Arms: a rounded shoulder cap, an upper arm that tapers to the elbow, and a
// slimmer forearm with a slight forward bend. Each arm is a group pivoting at
// the shoulder (ready for animation), held a little away from the body.

/** Elbow and wrist points in arm-local space (shoulder at the origin). */
function joints(f, sx) {
  const upper = f.armLen * 0.45;
  const fore = f.armLen - upper - f.handR * 1.6;
  const elbow = new THREE.Vector3(0, -upper, 0);
  // forearm tilts forward (bend) and a touch outward
  const dir = new THREE.Vector3(sx * Math.sin(f.elbowBend * 0.4), -1, Math.sin(f.elbowBend)).normalize();
  const wrist = elbow.clone().addScaledVector(dir, fore);
  return { elbow, wrist, dir };
}

export function buildArm(f, sx, top, mats, sleeveFor) {
  const arm = new THREE.Group();
  arm.name = sx < 0 ? 'armR' : 'armL';
  // pivot low enough that the rounded shoulder cap sits inside the shoulder line
  arm.position.set(sx * (f.sw * 0.5 - f.shoulderR * 0.55), f.shoulderY - f.shoulderR * 1.15, 0);
  arm.rotation.z = sx * f.armSpread;

  const { elbow, wrist, dir } = joints(f, sx);
  const O = [0, 0, 0], E = elbow.toArray(), W = wrist.toArray();
  arm.add(taperBetween(O, E, f.shoulderR, f.elbowR, mats.skin));
  arm.add(taperBetween(E, W, f.elbowR, f.wristR, mats.skin));

  // sleeves follow the same segments, a little wider
  const sleeve = sleeveFor(top);
  if (sleeve === 'short') {
    const t = 0.6;
    arm.add(taperBetween(O, elbow.clone().multiplyScalar(t).toArray(), f.shoulderR * 1.15,
      THREE.MathUtils.lerp(f.shoulderR, f.elbowR, t) * 1.2, mats.top));
  } else if (sleeve === 'long') {
    arm.add(taperBetween(O, E, f.shoulderR * 1.12, f.elbowR * 1.15, mats.top));
    arm.add(taperBetween(E, W, f.elbowR * 1.15, f.wristR * 1.2, mats.top));
  }

  const hand = wrist.clone().addScaledVector(dir, f.handR * 0.8);
  arm.add(ellipsoid(f.handR, [0.8, 1.15, 0.9], mats.skin, { position: hand.toArray() }));
  return arm;
}
