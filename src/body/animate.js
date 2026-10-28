import { Vector3 } from 'three';

/** Flexion from the straight bind pose, in radians. */
export const POSE_BEND = (120 * Math.PI) / 180;

/** The fourteen ball joints. The pelvis group and the root are rig nodes, not joints. */
export const JOINT_NAMES = [
  'neck',
  'waist',
  'shoulderL',
  'shoulderR',
  'elbowL',
  'elbowR',
  'wristL',
  'wristR',
  'hipL',
  'hipR',
  'kneeL',
  'kneeR',
  'ankleL',
  'ankleR',
];

const DEG = Math.PI / 180;
const WALK_RATE = 6.2;

const _v = new Vector3();

function reset(rig) {
  rig.pelvis.rotation.set(0, 0, 0);
  for (const name of JOINT_NAMES) rig[name].rotation.set(0, 0, 0);
}

/**
 * Positive X rotation swings a downward limb toward -Z (back).
 * Knees flex backward (+X). Elbows flex forward (-X).
 */
function pose(rig) {
  const spread = 28 * DEG;
  const lift = 68 * DEG;
  rig.shoulderL.rotation.z = -spread;
  rig.shoulderR.rotation.z = spread;
  rig.shoulderL.rotation.x = -lift;
  rig.shoulderR.rotation.x = -lift;
  rig.elbowL.rotation.x = -POSE_BEND;
  rig.elbowR.rotation.x = -POSE_BEND;

  const thigh = 42 * DEG;
  rig.hipL.rotation.x = -thigh;
  rig.hipR.rotation.x = -thigh;
  rig.kneeL.rotation.x = POSE_BEND;
  rig.kneeR.rotation.x = POSE_BEND;
  const ankle = thigh - POSE_BEND;
  rig.ankleL.rotation.x = ankle;
  rig.ankleR.rotation.x = ankle;
}

function walk(rig, time) {
  const phase = time * WALK_RATE;
  const s = Math.sin(phase);
  const c = Math.cos(phase);
  const swing = 0.58;
  const lift = 1.15;

  rig.hipL.rotation.x = -s * swing;
  rig.hipR.rotation.x = s * swing;
  rig.kneeL.rotation.x = Math.max(0, -c) * lift;
  rig.kneeR.rotation.x = Math.max(0, c) * lift;
  rig.ankleL.rotation.x = -rig.hipL.rotation.x * 0.7 - rig.kneeL.rotation.x * 0.42;
  rig.ankleR.rotation.x = -rig.hipR.rotation.x * 0.7 - rig.kneeR.rotation.x * 0.42;

  rig.shoulderL.rotation.x = s * 0.42;
  rig.shoulderR.rotation.x = -s * 0.42;
  rig.elbowL.rotation.x = -0.22 - Math.max(0, s) * 0.38;
  rig.elbowR.rotation.x = -0.22 - Math.max(0, -s) * 0.38;

  rig.pelvis.rotation.y = s * 0.16;
  rig.waist.rotation.y = -s * 0.12;
  rig.waist.rotation.z = -s * 0.035;
  rig.neck.rotation.y = -s * 0.05;
}

function idle(rig, time) {
  const breath = Math.sin(time * 1.35);
  rig.waist.rotation.x = breath * 0.02;
  rig.neck.rotation.y = Math.sin(time * 0.55) * 0.07;
  rig.neck.rotation.x = breath * 0.015;
  rig.shoulderL.rotation.z = breath * 0.03;
  rig.shoulderR.rotation.z = -breath * 0.03;
  rig.shoulderL.rotation.x = Math.sin(time * 0.85) * 0.035;
  rig.shoulderR.rotation.x = Math.sin(time * 0.85 + 0.5) * 0.035;
  rig.pelvis.rotation.z = Math.sin(time * 0.7) * 0.014;
  rig.elbowL.rotation.x = Math.sin(time * 0.85) * 0.04;
  rig.elbowR.rotation.x = Math.sin(time * 0.85 + 0.5) * 0.04;
}

export function poseBody(rig, mode, time) {
  reset(rig);
  if (mode === 'pose') pose(rig);
  else if (mode === 'walk') walk(rig, time);
  else idle(rig, time);
}

/** Drop the pelvis so the lowest heel or toe sits on the root's ground plane. */
export function plantFeet(root, markers, bindPelvisY, pelvis) {
  pelvis.position.y = bindPelvisY;
  root.updateMatrixWorld(true);
  let minY = Infinity;
  for (const name of ['footLHeel', 'footLToe', 'footRHeel', 'footRToe']) {
    markers[name].getWorldPosition(_v);
    root.worldToLocal(_v);
    if (_v.y < minY) minY = _v.y;
  }
  pelvis.position.y = bindPelvisY - minY;
}
