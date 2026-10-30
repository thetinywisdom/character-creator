import { Group, MeshStandardMaterial, Object3D } from 'three';
import { JOINT_NAMES, createMotion } from './animate.js';
import {
  countStats,
  createChestMesh,
  createHeadMesh,
  createFootMesh,
  createFrustumMesh,
  createJointMesh,
  createPaddleMesh,
  createTaperMesh,
} from './geometry.js';
import { DEFAULT_PARAMS, resolveParams } from './params.js';

export { JOINT_NAMES };

function makeJoints() {
  const joints = {};
  for (const name of JOINT_NAMES) {
    const node = new Object3D();
    node.name = name;
    node.userData.joint = true;
    joints[name] = node;
  }
  return joints;
}

function disposeTree(obj) {
  obj.traverse((child) => {
    if (child.isMesh && child.geometry) child.geometry.dispose();
    if (child.skeleton?.boneTexture) child.skeleton.boneTexture.dispose();
  });
}

function clearGenerated(nodes) {
  const keep = new Set(nodes);
  for (const node of nodes) {
    for (const child of [...node.children]) {
      if (keep.has(child)) continue;
      disposeTree(child);
      node.remove(child);
    }
  }
}

/**
 * Wooden artist's mannequin.
 * The pelvis group is only there so the feet can plant and the walk can sway.
 * It is not one of the fourteen joints. The head is a mesh under the neck joint.
 *
 *   root
 *     pelvis
 *       pelvis block
 *       hip > thigh > knee > shin > ankle > foot
 *       waist ball
 *         chest box, straight sides, sloped into the neck
 *         shoulder > shoulder ball and upper arm (the ball belongs to the arm)
 *         neck ball > neck > lathe head
 *
 * A joint sphere uses the radius of the segment it joins, so a straight limb
 * hides it and a bend lets it fill the wedge. The shoulder ball is part of
 * the upper arm, the same radius as that limb, and sits at the shoulder
 * joint beside the chest. The hip ball matches the thigh and sits against
 * the pelvis.
 */
function layoutBody(root, pelvis, joints, spec, flat, smooth, markers) {
  const j = joints;
  const L = spec.layout;
  const R = spec.radii;

  root.add(pelvis);
  pelvis.position.set(0, L.hipY, 0);

  const pelvisMesh = createFrustumMesh(
    spec.pelvisTopWidth,
    spec.pelvisBottomWidth,
    spec.pelvisMeshHeight,
    spec.pelvisTopDepth,
    spec.pelvisBottomDepth,
    smooth,
  );
  pelvisMesh.name = 'pelvisMesh';
  pelvisMesh.position.set(0, spec.pelvisMeshY, 0);
  pelvis.add(pelvisMesh);

  pelvis.add(j.hipL);
  pelvis.add(j.hipR);
  addLeg(j, spec, flat, smooth, markers, 'L', -1);
  addLeg(j, spec, flat, smooth, markers, 'R', 1);

  pelvis.add(j.waist);
  j.waist.position.set(0, L.waistY - L.hipY, 0);
  const waistBall = createJointMesh(R.waist, smooth);
  waistBall.name = 'waistMesh';
  j.waist.add(waistBall);

  const chest = createChestMesh(spec, smooth);
  chest.name = 'chestMesh';
  chest.position.y = spec.chestMeshY;
  j.waist.add(chest);

  const shoulderY = spec.chestHeight * spec.shoulderT;
  addArm(j, spec, flat, smooth, 'L', -1, shoulderY);
  addArm(j, spec, flat, smooth, 'R', 1, shoulderY);

  j.waist.add(j.neck);
  j.neck.position.set(0, spec.chestHeight, 0);
  const neckBall = createJointMesh(R.neck, smooth);
  neckBall.name = 'neckMesh';
  j.neck.add(neckBall);

  const neckLength = spec.visibleNeck + spec.neckEmbed;
  const neck = createTaperMesh(R.neck, R.neck, neckLength, flat);
  neck.name = 'neckTube';
  neck.position.y = neckLength / 2;
  j.neck.add(neck);

  const head = createHeadMesh(spec.headScale, flat);
  head.name = 'headMesh';
  head.position.y = spec.neckLength;
  j.neck.add(head);
}

function addArm(joints, spec, flat, smooth, side, sign, shoulderY) {
  const R = spec.radii;
  const shoulder = joints[`shoulder${side}`];
  joints.waist.add(shoulder);
  shoulder.position.set(sign * spec.shoulderWidth / 2, shoulderY, 0);

  const ball = createJointMesh(R.shoulder, smooth);
  ball.name = `shoulder${side}Mesh`;
  ball.userData.segment = `upperArm${side}`;
  shoulder.add(ball);

  const upper = createTaperMesh(R.shoulder, R.elbow, spec.upperArmLength, flat);
  upper.name = `upperArm${side}Mesh`;
  upper.userData.segment = `upperArm${side}`;
  upper.position.y = -spec.upperArmLength / 2;
  shoulder.add(upper);

  const elbow = joints[`elbow${side}`];
  shoulder.add(elbow);
  elbow.position.set(0, -spec.upperArmLength, 0);
  const elbowBall = createJointMesh(R.elbow, smooth);
  elbowBall.name = `elbow${side}Mesh`;
  elbow.add(elbowBall);

  const forearm = createTaperMesh(R.elbow, R.wrist, spec.forearmLength, flat);
  forearm.name = `forearm${side}Mesh`;
  forearm.position.y = -spec.forearmLength / 2;
  elbow.add(forearm);

  const wrist = joints[`wrist${side}`];
  elbow.add(wrist);
  wrist.position.set(0, -spec.forearmLength, 0);
  const wristBall = createJointMesh(R.wrist, smooth);
  wristBall.name = `wrist${side}Mesh`;
  wrist.add(wristBall);

  const hand = createPaddleMesh(
    spec.handLength,
    spec.handBaseRx,
    spec.handBaseRz,
    spec.handMidRx,
    spec.handMidRz,
    flat,
  );
  hand.name = `hand${side}Mesh`;
  hand.rotation.x = spec.handPitch;
  hand.rotation.z = -sign * spec.handYaw;
  wrist.add(hand);
}

function addLeg(joints, spec, flat, smooth, markers, side, sign) {
  const R = spec.radii;
  const hip = joints[`hip${side}`];
  hip.position.set(sign * spec.hipWidth / 2, 0, 0);

  const ball = createJointMesh(R.hip, smooth);
  ball.name = `hip${side}Mesh`;
  hip.add(ball);

  const thigh = createTaperMesh(R.hip, R.knee, spec.thighLength, flat);
  thigh.name = `thigh${side}Mesh`;
  thigh.position.y = -spec.thighLength / 2;
  hip.add(thigh);

  const knee = joints[`knee${side}`];
  hip.add(knee);
  knee.position.set(0, -spec.thighLength, 0);
  const kneeBall = createJointMesh(R.knee, smooth);
  kneeBall.name = `knee${side}Mesh`;
  knee.add(kneeBall);

  const shin = createTaperMesh(R.knee, R.ankle, spec.shinLength, flat);
  shin.name = `shin${side}Mesh`;
  shin.position.y = -spec.shinLength / 2;
  knee.add(shin);

  const ankle = joints[`ankle${side}`];
  knee.add(ankle);
  ankle.position.set(0, -spec.shinLength, 0);
  const ankleBall = createJointMesh(R.ankle, smooth);
  ankleBall.name = `ankle${side}Mesh`;
  ankle.add(ankleBall);

  const foot = createFootMesh(spec.footWidth, spec.footHeight, spec.footLength, smooth);
  foot.name = `foot${side}Mesh`;
  foot.position.set(0, spec.footCenterY, spec.footCenterZ);
  ankle.add(foot);

  const soleY = spec.footCenterY - spec.footHeight / 2;
  const heel = new Object3D();
  heel.name = `foot${side}Heel`;
  heel.position.set(0, soleY, spec.footHeel);
  ankle.add(heel);
  const toe = new Object3D();
  toe.name = `foot${side}Toe`;
  toe.position.set(0, soleY, spec.footToe);
  ankle.add(toe);
  markers[`foot${side}Heel`] = heel;
  markers[`foot${side}Toe`] = toe;
}

function paint(materials, color) {
  for (const material of materials) {
    if (material.userData.lockedColor) continue;
    material.color.set(color);
  }
}

/**
 * @param {Partial<typeof DEFAULT_PARAMS>} [input]
 * @returns {{
 *   root: Group,
 *   pelvis: Object3D,
 *   joints: Record<string, Object3D>,
 *   materials: MeshStandardMaterial[],
 *   update: (dt: number, state?: string | {
 *     anim?: string, mode?: string, speed?: number, time?: number, freeze?: boolean,
 *     turn?: number, grounded?: boolean, vy?: number, crouch?: number, side?: number, dir?: number,
 *   }) => void,
 *   setParams: (partial: object) => void,
 * }}
 */
export function createBody(input = {}) {
  const params = { ...DEFAULT_PARAMS, ...input };
  const root = new Group();
  root.name = 'root';
  const pelvis = new Object3D();
  pelvis.name = 'pelvis';
  const joints = makeJoints();
  const markers = {};
  const flat = new MeshStandardMaterial({
    color: params.skinColor || DEFAULT_PARAMS.skinColor,
    roughness: 0.8,
    metalness: 0,
    flatShading: true,
  });
  const smooth = new MeshStandardMaterial({
    color: params.skinColor || DEFAULT_PARAMS.skinColor,
    roughness: 0.8,
    metalness: 0,
    flatShading: false,
  });
  flat.userData.skin = 'flat';
  smooth.userData.skin = 'smooth';
  const materials = [flat, smooth];

  let resolved = resolveParams(params);
  let bindPelvisY = resolved.layout.hipY;
  const rig = { pelvis, ...joints };
  const motion = createMotion();

  function rebuild() {
    resolved = resolveParams(params);
    paint(materials, resolved.skinColor);
    clearGenerated([root, pelvis, ...Object.values(joints)]);
    layoutBody(root, pelvis, joints, resolved, flat, smooth, markers);
    bindPelvisY = resolved.layout.hipY;
    pelvis.position.y = bindPelvisY;
  }

  rebuild();

  return {
    root,
    pelvis,
    joints,
    materials,
    update(dt, state) {
      const step = Math.min(Math.max(Number(dt) || 0, 0), 0.05);
      motion.step({
        rig,
        root,
        markers,
        bindPelvisY,
        spec: resolved,
      }, step, state);
    },
    setParams(partial) {
      if (!partial || typeof partial !== 'object') return;
      Object.assign(params, partial);
      const keys = Object.keys(partial);
      if (keys.length > 0 && keys.every((key) => key === 'skinColor')) {
        resolved = resolveParams(params);
        paint(materials, resolved.skinColor);
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
        cylinderSides: resolved.cylinderSides,
        jointWidth: resolved.jointWidth,
        jointHeight: resolved.jointHeight,
      };
    },
  };
}
