import * as THREE from 'three';
import { taperBetween } from '../../lib/shapes.js';

// Arms: a rounded shoulder cap, an upper arm that tapers to the elbow, and a
// slimmer forearm with a slight forward bend. Joints for animation: shoulder
// (armL/armR) -> elbow (foreL/foreR), each group at its pivot point.

/** Elbow and wrist points in arm-local space (shoulder at the origin). */
function joints(f, sx) {
  const upper = f.armLen * 0.42; // the pivot sits lower now, so the upper arm is a bit shorter
  // forearm ends at the wrist; the hand box (about 2.1 × handR long) hangs
  // below it, so leave room for it or the forearm reads like a long pole
  const fore = f.armLen - upper - f.handR * 1.6 - f.handR * 2.1;
  const elbow = new THREE.Vector3(0, -upper, 0);
  // forearm tilts forward (bend) and a touch outward
  const dir = new THREE.Vector3(sx * Math.sin(f.elbowBend * 0.4), -1, Math.sin(f.elbowBend)).normalize();
  const wrist = elbow.clone().addScaledVector(dir, fore);
  return { elbow, wrist, dir };
}

/** Where the right hand grips things, in forearm (fore joint) space, and the forearm direction. */
export function handGrip(f, sx) {
  const { elbow, wrist, dir } = joints(f, sx);
  return { grip: wrist.clone().sub(elbow).addScaledVector(dir, f.handR * 1.5), dir };
}

/** outer: material of a jacket/hoodie/cardigan, whose long sleeves go over everything. */
export function buildArm(f, sx, top, mats, sleeveFor, outer = null) {
  const arm = new THREE.Group();
  arm.name = sx < 0 ? 'armR' : 'armL';
  // pivot tucked in and down, so the rounded shoulder cap (and a sleeve over
  // it) stays inside the torso's shoulder curve instead of poking above it
  arm.position.set(sx * (f.sw * 0.5 - f.shoulderR * 0.75), f.shoulderY - f.torsoLen * 0.19, 0);
  arm.rotation.z = sx * f.armSpread;

  const { elbow, wrist, dir } = joints(f, sx);
  const O = [0, 0, 0], E = elbow.toArray();
  // forearm hangs from the elbow joint; its points are elbow-relative
  const fore = new THREE.Group();
  fore.name = sx < 0 ? 'foreR' : 'foreL';
  fore.position.copy(elbow);
  arm.add(fore);
  const W = wrist.clone().sub(elbow).toArray();
  arm.add(taperBetween(O, E, f.shoulderR, f.elbowR, mats.skin));
  fore.add(taperBetween([0, 0, 0], W, f.elbowR, f.wristR, mats.skin));

  // sleeves follow the same segments, a little wider
  const sleeve = outer ? 'outer' : sleeveFor(top);
  if (sleeve === 'outer') {
    // thicker, looser sleeves of the outer layer
    arm.add(taperBetween(O, E, f.shoulderR * 1.18, f.elbowR * 1.32, outer));
    fore.add(taperBetween([0, 0, 0], W, f.elbowR * 1.32, f.wristR * 1.4, outer));
  } else if (sleeve === 'short') {
    const t = 0.6;
    arm.add(taperBetween(O, elbow.clone().multiplyScalar(t).toArray(), f.shoulderR * 1.06,
      THREE.MathUtils.lerp(f.shoulderR, f.elbowR, t) * 1.2, mats.top));
  } else if (sleeve === 'none') {
    // bare shoulder: a skin cap over the corner of the torso, so the top's
    // shoulder edge doesn't poke out past the arm
    arm.add(taperBetween(O, elbow.clone().multiplyScalar(0.3).toArray(), f.shoulderR * 1.08,
      THREE.MathUtils.lerp(f.shoulderR, f.elbowR, 0.3) * 1.04, mats.skin));
  } else if (sleeve === 'wide') {
    // yukata: a wide sleeve hanging open below the elbow
    arm.add(taperBetween(O, E, f.shoulderR * 1.12, f.elbowR * 2.3, mats.top));
    const W2 = wrist.clone().sub(elbow).multiplyScalar(0.55).toArray();
    fore.add(taperBetween([0, 0, 0], W2, f.elbowR * 2.3, f.elbowR * 2.1, mats.top));
  } else if (sleeve === 'long') {
    arm.add(taperBetween(O, E, f.shoulderR * 1.06, f.elbowR * 1.15, mats.top));
    fore.add(taperBetween([0, 0, 0], W, f.elbowR * 1.15, f.wristR * 1.2, mats.top));
  }

  fore.add(buildHand(f, wrist.clone().sub(elbow), dir, mats.skin));
  return arm;
}

/**
 * Blocky, mitten-like hand: a box that is flat side-to-side (palm facing the
 * body), wider front-to-back, narrowing toward the fingertips.
 */
function buildHand(f, wrist, dir, material) {
  const r = f.handR;
  const len = r * 2.1;
  const geo = new THREE.BoxGeometry(r * 0.85, len, r * 1.35);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    if (pos.getY(i) < 0) pos.setZ(i, pos.getZ(i) * 0.75); // fingers narrower than the palm
  }
  geo.computeVertexNormals();
  const hand = new THREE.Mesh(geo, material);
  hand.position.copy(wrist).addScaledVector(dir, len * 0.45);
  hand.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), dir);
  return hand;
}
