import { Vector3 } from 'three';

/** Flexion from the straight bind pose, in radians. */
export const POSE_BEND = (120 * Math.PI) / 180;

const DEG = Math.PI / 180;
const WALK_RATE = 6.2;

const ANIMATED = [
  'hips',
  'spine',
  'neck',
  'head',
  'clavicle',
  'shoulderL',
  'elbowL',
  'wristL',
  'shoulderR',
  'elbowR',
  'wristR',
  'hipL',
  'kneeL',
  'ankleL',
  'hipR',
  'kneeR',
  'ankleR',
];

const _v = new Vector3();

function reset(joints) {
  for (const name of ANIMATED) {
    joints[name].rotation.set(0, 0, 0);
  }
}

/**
 * Positive X rotation swings a downward limb toward -Z (back).
 * Knees flex backward (+X). Elbows flex forward (-X).
 */
function pose(joints) {
  // Mostly a forward raise, with a small spread so the arms don't stack.
  // Elbows then share a hinge and both fold forward by POSE_BEND.
  const spread = 28 * DEG;
  const lift = 68 * DEG;
  joints.shoulderL.rotation.z = -spread;
  joints.shoulderR.rotation.z = spread;
  joints.shoulderL.rotation.x = -lift;
  joints.shoulderR.rotation.x = -lift;
  joints.elbowL.rotation.x = -POSE_BEND;
  joints.elbowR.rotation.x = -POSE_BEND;

  const thigh = 42 * DEG;
  joints.hipL.rotation.x = -thigh;
  joints.hipR.rotation.x = -thigh;
  joints.kneeL.rotation.x = POSE_BEND;
  joints.kneeR.rotation.x = POSE_BEND;
  // Keep the foot box level: ankle cancels the chain's X rotation.
  const ankle = thigh - POSE_BEND;
  joints.ankleL.rotation.x = ankle;
  joints.ankleR.rotation.x = ankle;
}

function walk(joints, time) {
  const phase = time * WALK_RATE;
  const s = Math.sin(phase);
  const c = Math.cos(phase);
  const swing = 0.58;
  const lift = 1.15;

  joints.hipL.rotation.x = -s * swing;
  joints.hipR.rotation.x = s * swing;
  joints.kneeL.rotation.x = Math.max(0, -c) * lift;
  joints.kneeR.rotation.x = Math.max(0, c) * lift;
  joints.ankleL.rotation.x = -joints.hipL.rotation.x * 0.7 - joints.kneeL.rotation.x * 0.42;
  joints.ankleR.rotation.x = -joints.hipR.rotation.x * 0.7 - joints.kneeR.rotation.x * 0.42;

  joints.shoulderL.rotation.x = s * 0.42;
  joints.shoulderR.rotation.x = -s * 0.42;
  joints.elbowL.rotation.x = -0.22 - Math.max(0, s) * 0.38;
  joints.elbowR.rotation.x = -0.22 - Math.max(0, -s) * 0.38;

  joints.hips.rotation.y = s * 0.16;
  joints.spine.rotation.y = -s * 0.12;
  joints.spine.rotation.z = -s * 0.035;
  joints.neck.rotation.y = -s * 0.05;
}

function idle(joints, time) {
  const breath = Math.sin(time * 1.35);
  joints.spine.rotation.x = breath * 0.02;
  joints.neck.rotation.y = Math.sin(time * 0.55) * 0.07;
  joints.neck.rotation.x = breath * 0.015;
  joints.shoulderL.rotation.z = breath * 0.03;
  joints.shoulderR.rotation.z = -breath * 0.03;
  joints.shoulderL.rotation.x = Math.sin(time * 0.85) * 0.035;
  joints.shoulderR.rotation.x = Math.sin(time * 0.85 + 0.5) * 0.035;
  joints.hips.rotation.z = Math.sin(time * 0.7) * 0.014;
  joints.elbowL.rotation.x = Math.sin(time * 0.85) * 0.04;
  joints.elbowR.rotation.x = Math.sin(time * 0.85 + 0.5) * 0.04;
}

export function poseBody(joints, mode, time) {
  reset(joints);
  if (mode === 'pose') pose(joints);
  else if (mode === 'walk') walk(joints, time);
  else idle(joints, time);
}

/** Drop the hips so the lowest heel or toe sits on the root's ground plane. */
export function plantFeet(root, markers, bindHipY, hips) {
  hips.position.y = bindHipY;
  root.updateMatrixWorld(true);
  let minY = Infinity;
  for (const name of ['footLHeel', 'footLToe', 'footRHeel', 'footRToe']) {
    markers[name].getWorldPosition(_v);
    root.worldToLocal(_v);
    if (_v.y < minY) minY = _v.y;
  }
  hips.position.y = bindHipY - minY;
}
