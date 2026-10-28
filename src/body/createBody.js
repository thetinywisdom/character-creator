import { Group, MeshStandardMaterial, Object3D } from 'three';
import { plantFeet, poseBody } from './animate.js';
import {
  countStats,
  createBoxMesh,
  createCylinderMesh,
  createSphereMesh,
  createTrapezoidMesh,
} from './geometry.js';
import { DEFAULT_PARAMS, resolveParams } from './params.js';

export const JOINT_NAMES = [
  'root',
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

function makeJoints(root) {
  const joints = { root };
  for (const name of JOINT_NAMES) {
    if (name === 'root') continue;
    const node = new Object3D();
    node.name = name;
    joints[name] = node;
  }
  return joints;
}

function disposeTree(obj) {
  obj.traverse((child) => {
    if (child.isMesh) child.geometry.dispose();
  });
}

function clearGenerated(joints) {
  const keep = new Set(Object.values(joints));
  for (const node of keep) {
    if (!node || node === joints.root) continue;
    for (const child of [...node.children]) {
      if (keep.has(child)) continue;
      disposeTree(child);
      node.remove(child);
    }
  }
}

/**
 * Cylinders run joint-center to joint-center, so each end disc sits inside its ball.
 * The ball's inscribed radius is larger than the limb, which keeps the seam covered
 * at any bend. Shoulder width is the clavicle length (ball center to ball center).
 */
function layoutBody(joints, spec, material, markers) {
  const j = joints;
  const L = spec.layout;
  const root = j.root;

  root.add(j.hips);
  j.hips.position.set(0, L.hipY, 0);

  j.hips.add(j.spine);
  j.spine.position.set(0, L.spineY - L.hipY, 0);

  j.hips.add(j.hipL);
  j.hipL.position.set(-spec.hipWidth / 2, 0, 0);
  j.hips.add(j.hipR);
  j.hipR.position.set(spec.hipWidth / 2, 0, 0);

  const pelvis = createTrapezoidMesh(
    spec.torsoWidth,
    spec.hipWidth,
    spec.pelvisHeight,
    spec.pelvisDepth,
    material,
  );
  pelvis.name = 'pelvisMesh';
  pelvis.position.set(0, L.pelvisBottomY - L.hipY, spec.pelvisZ);
  j.hips.add(pelvis);

  const torso = createBoxMesh(spec.torsoWidth, spec.torsoHeight, spec.torsoDepth, material);
  torso.name = 'torsoMesh';
  torso.position.y = spec.torsoHeight / 2;
  j.spine.add(torso);

  j.spine.add(j.clavicle);
  j.clavicle.position.set(0, L.shoulderY - L.spineY, 0);
  const clavicle = createCylinderMesh(spec.radii.clavicle, spec.shoulderWidth, material);
  clavicle.name = 'clavicleMesh';
  clavicle.rotation.z = Math.PI / 2;
  j.clavicle.add(clavicle);

  j.spine.add(j.neck);
  j.neck.position.set(0, L.neckY - L.spineY, 0);
  const neckLength = spec.neckLength + spec.neckEmbed;
  const neck = createCylinderMesh(spec.radii.neck, neckLength, material);
  neck.name = 'neckMesh';
  neck.position.y = (spec.neckLength - spec.neckEmbed) / 2;
  j.neck.add(neck);

  j.neck.add(j.head);
  j.head.position.set(0, spec.neckLength, 0);
  const head = createSphereMesh(spec.headRadius, material);
  head.name = 'headMesh';
  j.head.add(head);

  addArm(j, spec, material, 'L', -1);
  addArm(j, spec, material, 'R', 1);
  addLeg(j, spec, material, markers, 'L', -1);
  addLeg(j, spec, material, markers, 'R', 1);
}

function addArm(joints, spec, material, side, sign) {
  const shoulder = joints[`shoulder${side}`];
  joints.clavicle.add(shoulder);
  shoulder.position.set(sign * spec.shoulderWidth / 2, 0, 0);

  const ball = createSphereMesh(spec.radii.shoulder, material);
  ball.name = `shoulder${side}Mesh`;
  shoulder.add(ball);

  const upper = createCylinderMesh(spec.radii.upperArm, spec.upperArmLength, material);
  upper.name = `upperArm${side}Mesh`;
  upper.position.y = -spec.upperArmLength / 2;
  shoulder.add(upper);

  const elbow = joints[`elbow${side}`];
  shoulder.add(elbow);
  elbow.position.set(0, -spec.upperArmLength, 0);
  const elbowBall = createSphereMesh(spec.radii.elbow, material);
  elbowBall.name = `elbow${side}Mesh`;
  elbow.add(elbowBall);

  const forearm = createCylinderMesh(spec.radii.forearm, spec.forearmLength, material);
  forearm.name = `forearm${side}Mesh`;
  forearm.position.y = -spec.forearmLength / 2;
  elbow.add(forearm);

  const wrist = joints[`wrist${side}`];
  elbow.add(wrist);
  wrist.position.set(0, -spec.forearmLength, 0);
  const wristBall = createSphereMesh(spec.radii.wrist, material);
  wristBall.name = `wrist${side}Mesh`;
  wrist.add(wristBall);

  const hand = createBoxMesh(spec.handWidth, spec.handLength, spec.handDepth, material);
  hand.name = `hand${side}Mesh`;
  hand.position.y = spec.handTopY - spec.handLength / 2;
  wrist.add(hand);
}

function addLeg(joints, spec, material, markers, side, sign) {
  const hip = joints[`hip${side}`];
  joints.hips.add(hip);
  hip.position.set(sign * spec.hipWidth / 2, 0, 0);

  const ball = createSphereMesh(spec.radii.hip, material);
  ball.name = `hip${side}Mesh`;
  hip.add(ball);

  const thigh = createCylinderMesh(spec.radii.thigh, spec.thighLength, material);
  thigh.name = `thigh${side}Mesh`;
  thigh.position.y = -spec.thighLength / 2;
  hip.add(thigh);

  const knee = joints[`knee${side}`];
  hip.add(knee);
  knee.position.set(0, -spec.thighLength, 0);
  const kneeBall = createSphereMesh(spec.radii.knee, material);
  kneeBall.name = `knee${side}Mesh`;
  knee.add(kneeBall);

  const shin = createCylinderMesh(spec.radii.shin, spec.shinLength, material);
  shin.name = `shin${side}Mesh`;
  shin.position.y = -spec.shinLength / 2;
  knee.add(shin);

  const ankle = joints[`ankle${side}`];
  knee.add(ankle);
  ankle.position.set(0, -spec.shinLength, 0);
  const ankleBall = createSphereMesh(spec.radii.ankle, material);
  ankleBall.name = `ankle${side}Mesh`;
  ankle.add(ankleBall);

  const foot = createBoxMesh(spec.footWidth, spec.footHeight, spec.footLength, material);
  foot.name = `foot${side}Mesh`;
  foot.position.set(0, spec.footCenterY, spec.footCenterZ);
  ankle.add(foot);

  const bottomY = spec.footCenterY - spec.footHeight / 2;
  const heel = new Object3D();
  heel.name = `foot${side}Heel`;
  heel.position.set(0, bottomY, -spec.footHeel);
  ankle.add(heel);
  const toe = new Object3D();
  toe.name = `foot${side}Toe`;
  toe.position.set(0, bottomY, spec.footToe);
  ankle.add(toe);
  markers[`foot${side}Heel`] = heel;
  markers[`foot${side}Toe`] = toe;
}

function readState(state, previousMode) {
  let mode = previousMode;
  let freeze = false;
  let time = null;
  if (typeof state === 'string') mode = state;
  else if (state && typeof state === 'object') {
    if (state.mode) mode = state.mode;
    if (state.freeze) freeze = true;
    if (typeof state.time === 'number') time = state.time;
  }
  if (mode !== 'idle' && mode !== 'walk' && mode !== 'pose') mode = 'idle';
  return { mode, freeze, time };
}

/**
 * @param {Partial<typeof DEFAULT_PARAMS>} [input]
 * @returns {{
 *   root: Group,
 *   joints: Record<string, Object3D>,
 *   update: (dt: number, state?: string | { mode?: string, time?: number, freeze?: boolean }) => void,
 *   setParams: (partial: object) => void,
 * }}
 */
export function createBody(input = {}) {
  const params = { ...DEFAULT_PARAMS, ...input };
  const root = new Group();
  root.name = 'root';
  const joints = makeJoints(root);
  const markers = {};
  const material = new MeshStandardMaterial({
    color: params.skinColor || DEFAULT_PARAMS.skinColor,
    roughness: 0.82,
    metalness: 0,
    flatShading: true,
  });

  let resolved = resolveParams(params);
  let bindHipY = resolved.layout.hipY;
  let time = 0;
  let mode = 'idle';

  function rebuild() {
    resolved = resolveParams(params);
    material.color.set(resolved.skinColor);
    clearGenerated(joints);
    layoutBody(joints, resolved, material, markers);
    bindHipY = resolved.layout.hipY;
    joints.hips.position.y = bindHipY;
  }

  rebuild();

  return {
    root,
    joints,
    material,
    update(dt, state) {
      const next = readState(state, mode);
      mode = next.mode;
      if (next.time != null) time = next.time;
      if (!next.freeze) time += Math.min(Math.max(Number(dt) || 0, 0), 0.05);
      poseBody(joints, mode, time);
      plantFeet(root, markers, bindHipY, joints.hips);
    },
    setParams(partial) {
      if (!partial || typeof partial !== 'object') return;
      Object.assign(params, partial);
      const keys = Object.keys(partial);
      if (keys.length > 0 && keys.every((key) => key === 'skinColor')) {
        resolved = resolveParams(params);
        material.color.set(resolved.skinColor);
        return;
      }
      rebuild();
    },
    getParams() {
      return { ...params };
    },
    getResolved() {
      return resolved;
    },
    getStats() {
      return {
        ...countStats(root),
        sphereDetail: resolved.sphereDetail,
        cylinderSides: resolved.cylinderSides,
      };
    },
  };
}
