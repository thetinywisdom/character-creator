// Joint hierarchy shared by every character. Parts hang meshes off these
// groups; they do not create a second set of joints. Positions match iso-city
// buildBody so walk, IK and held-item poses keep working.
import * as THREE from 'three';
import { group, HIP_X, HIP_Y, THIGH, SHIN, SHOULDER_X, SHOULDER_Y, UPPER, FORE, NECK_Y, HEAD_C } from './geom.js';

/**
 * Empty rig. Feet at y=0, facing +Z, about 2 units tall before height scale.
 * Joints: root, body, torso, head, headCenter, armL/R, elbowL/R, wristL/R,
 * legL/R, kneeL/R, ankleL/R.
 * @param {string} [name]
 */
export function createSkeleton(name = 'character') {
  const root = new THREE.Group();
  root.name = name;
  const body = group(root);
  const torso = group(body);
  const P = { root, body, torso, legSwing: 0.34 };

  P.head = group(body, 0, NECK_Y, 0);
  P.headCenter = group(P.head, 0, HEAD_C, 0);

  for (const side of ['L', 'R']) {
    const sx = side === 'L' ? 1 : -1;
    const sh = P['arm' + side] = group(body, sx * SHOULDER_X, SHOULDER_Y, 0);
    const el = P['elbow' + side] = group(sh, 0, -UPPER, 0);
    P['wrist' + side] = group(el, 0, -FORE, 0);
  }

  for (const side of ['L', 'R']) {
    const sx = side === 'L' ? 1 : -1;
    const hip = P['leg' + side] = group(body, sx * HIP_X, HIP_Y, 0);
    const knee = P['knee' + side] = group(hip, 0, -THIGH, 0);
    const ankle = P['ankle' + side] = group(knee, 0, -SHIN, 0);
    P['legParts' + side] = { hip, knee, ankle };
  }
  return P;
}
