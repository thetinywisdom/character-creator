import { MeshStandardMaterial } from 'three';
import {
  createBoxMesh,
  createFrustumMesh,
  createJointMesh,
  createMergedBoxMesh,
  createPaddleMesh,
  createRectTubeMesh,
  createTaperMesh,
  createFootMesh,
} from '../body/geometry.js';

/** Hard cap. The shoulder ball uses the same scale as the tube it joins. */
export const MUSCULAR_SCALE = 1.3;
/** Elbow, wrist, and the thin end of a skeleton arm. The shoulder ball stays full. */
export const SKELETON_SCALE = 0.55;
/**
 * Robot corners sit at this fraction of the joint radius.
 * An 8×6 ball's flats are about 7.6% inside the circumscribed sphere.
 */
export const BOX_FIT = 0.9;
/** Visual default when a robot leg's color is null. The document stays null. */
export const ROBOT_LEG_COLOR = '#b7b7b7';

function skinMaterial(ctx, flat) {
  const kind = flat ? 'flat' : 'smooth';
  return ctx.materials.find((material) => material.userData.skin === kind);
}

export function materialFor(ctx, color, flat) {
  if (!color) return skinMaterial(ctx, flat);
  const hex = String(color).toLowerCase();
  const key = `${flat ? 'flat' : 'smooth'}:${hex}`;
  let material = ctx.materials.find((entry) => entry.userData.poolKey === key);
  if (!material) {
    material = new MeshStandardMaterial({
      color: hex,
      roughness: 0.8,
      metalness: 0,
      flatShading: flat,
    });
    material.userData.poolKey = key;
    material.userData.lockedColor = true;
    ctx.materials.push(material);
  }
  return material;
}

function disposeMesh(mesh) {
  mesh.traverse((obj) => {
    if (obj.isMesh && obj.geometry) obj.geometry.dispose();
  });
  mesh.removeFromParent();
}

function stripMeshes(node) {
  for (const child of [...node.children]) {
    if (child.userData.joint) {
      stripMeshes(child);
      continue;
    }
    if (child.userData.socket) continue;
    if (child.isMesh) disposeMesh(child);
  }
}

function boxWidth(radius) {
  return radius * BOX_FIT * Math.SQRT2;
}

function hangTaper(parent, name, radiusTop, radiusBottom, length, material, sides) {
  const mesh = createTaperMesh(radiusTop, radiusBottom, length, material, sides);
  mesh.name = name;
  mesh.position.y = -length / 2;
  parent.add(mesh);
  return mesh;
}

function hangRect(parent, name, radiusTop, radiusBottom, length, material) {
  const top = boxWidth(radiusTop);
  const bottom = boxWidth(radiusBottom);
  const mesh = createRectTubeMesh(bottom, top, length, bottom, top, material);
  mesh.name = name;
  mesh.position.y = -length;
  parent.add(mesh);
  return mesh;
}

function addBall(parent, name, radius, material, segment) {
  const mesh = createJointMesh(radius, material);
  mesh.name = name;
  if (segment) mesh.userData.segment = segment;
  parent.add(mesh);
  return mesh;
}

function soleY(spec) {
  return spec.footCenterY - spec.footHeight / 2;
}

function takeMarkers(ankle, side) {
  const heel = ankle.getObjectByName(`foot${side}Heel`);
  const toe = ankle.getObjectByName(`foot${side}Toe`);
  if (heel) heel.removeFromParent();
  if (toe) toe.removeFromParent();
  return { heel, toe };
}

function placeMarkers(parent, markers, spec, y) {
  if (!markers.heel || !markers.toe) return;
  markers.heel.position.set(0, y, spec.footHeel);
  markers.toe.position.set(0, y, spec.footToe);
  parent.add(markers.heel);
  parent.add(markers.toe);
}

function armRadii(spec, type) {
  const base = spec.radii;
  if (type === 'muscular') {
    return {
      shoulder: base.shoulder * MUSCULAR_SCALE,
      elbow: base.elbow * MUSCULAR_SCALE,
      wrist: base.wrist * MUSCULAR_SCALE,
    };
  }
  if (type === 'skeleton') {
    return {
      shoulder: base.shoulder,
      elbow: base.elbow * SKELETON_SCALE,
      wrist: base.wrist * SKELETON_SCALE,
    };
  }
  return { shoulder: base.shoulder, elbow: base.elbow, wrist: base.wrist };
}

function addHand(wrist, spec, side, sign, hand, material) {
  const mesh = handMesh(spec, hand, material);
  mesh.name = `hand${side}Mesh`;
  mesh.rotation.x = spec.handPitch;
  mesh.rotation.z = -sign * spec.handYaw;
  wrist.add(mesh);
}

function handMesh(spec, hand, material) {
  if (hand === 'fist') return fistMesh(spec, material);
  if (hand === 'claw') return clawMesh(spec, material);
  if (hand === 'hook') return hookMesh(spec, material);
  return createPaddleMesh(
    spec.handLength,
    spec.handBaseRx,
    spec.handBaseRz,
    spec.handMidRx,
    spec.handMidRz,
    material,
  );
}

function fistMesh(spec, material) {
  const limit = spec.radii.wrist * BOX_FIT;
  const shift = limit * 0.25;
  const half = (limit - shift) / Math.sqrt(3);
  const mesh = createBoxMesh(half * 2, half * 2, half * 2, material);
  mesh.position.y = -shift;
  return mesh;
}

function clawMesh(spec, material) {
  const reach = spec.handLength * 0.92;
  const spread = spec.handMidRx * 0.62;
  const width = Math.max(spec.handMidRx * 0.22, 0.004);
  const depth = Math.max(spec.handMidRz * 0.55, 0.004);
  const boxes = [-spread, 0, spread].map((x) => [x, -reach / 2, 0, width, reach, depth]);
  return createMergedBoxMesh(boxes, material);
}

function hookMesh(spec, material) {
  const shaft = spec.handLength * 0.78;
  const thick = Math.max(spec.radii.wrist * 0.28, 0.006);
  const bill = Math.max(spec.radii.wrist * 0.55, 0.01);
  return createMergedBoxMesh([
    [0, -shaft / 2, 0, thick, shaft, thick],
    [0, -shaft, bill * 0.45, thick * 0.8, thick * 0.8, bill],
  ], material);
}

function replaceArm(ctx, side, sign, arm) {
  const spec = ctx.spec;
  const shoulder = ctx.joints[`shoulder${side}`];
  const elbow = ctx.joints[`elbow${side}`];
  const wrist = ctx.joints[`wrist${side}`];
  stripMeshes(shoulder);
  const radii = armRadii(spec, arm.type);
  const flat = materialFor(ctx, arm.color, true);
  const smooth = materialFor(ctx, arm.color, false);
  const robot = arm.type === 'robot';
  const sides = arm.type === 'skeleton' ? 4 : undefined;
  addBall(shoulder, `shoulder${side}Mesh`, radii.shoulder, smooth, `upperArm${side}`);
  const upper = robot
    ? hangRect(shoulder, `upperArm${side}Mesh`, radii.shoulder, radii.elbow, spec.upperArmLength, flat)
    : hangTaper(shoulder, `upperArm${side}Mesh`, radii.shoulder, radii.elbow, spec.upperArmLength, flat, sides);
  upper.userData.segment = `upperArm${side}`;
  addBall(elbow, `elbow${side}Mesh`, radii.elbow, smooth);
  if (robot) {
    hangRect(elbow, `forearm${side}Mesh`, radii.elbow, radii.wrist, spec.forearmLength, flat);
  } else {
    hangTaper(elbow, `forearm${side}Mesh`, radii.elbow, radii.wrist, spec.forearmLength, flat, sides);
  }
  addBall(wrist, `wrist${side}Mesh`, radii.wrist, smooth);
  addHand(wrist, spec, side, sign, arm.hand, flat);
}

export function buildArm(ctx) {
  const side = ctx.slot.endsWith('left') ? 'L' : 'R';
  const sign = side === 'L' ? -1 : 1;
  const arm = ctx.document.arms[side === 'L' ? 'left' : 'right'];
  const shoulder = ctx.joints[`shoulder${side}`];
  const stamp = `${arm.type}|${arm.color}|${arm.hand}`;
  const identity = arm.type === 'normal' && arm.color == null && arm.hand === 'open';
  if (shoulder.userData.partStamp === stamp) return;
  if (identity && !shoulder.userData.customArm) {
    shoulder.userData.partStamp = stamp;
    return;
  }
  replaceArm(ctx, side, sign, arm);
  shoulder.userData.customArm = !identity;
  shoulder.userData.partStamp = stamp;
}

function legColor(leg) {
  if (leg.color) return leg.color;
  if (leg.type === 'robot') return ROBOT_LEG_COLOR;
  return null;
}

function replaceLeg(ctx, side, leg) {
  const spec = ctx.spec;
  const hip = ctx.joints[`hip${side}`];
  const knee = ctx.joints[`knee${side}`];
  const ankle = ctx.joints[`ankle${side}`];
  const markers = takeMarkers(ankle, side);
  stripMeshes(hip);
  const color = legColor(leg);
  const flat = materialFor(ctx, color, true);
  const smooth = materialFor(ctx, color, false);
  const radii = spec.radii;
  addBall(hip, `hip${side}Mesh`, radii.hip, smooth);

  if (leg.type === 'peg') {
    const length = spec.thighLength + spec.shinLength;
    hangTaper(hip, `peg${side}Mesh`, radii.hip * 0.85, radii.ankle * 0.7, length, flat);
    const ySole = soleY(spec);
    const nubH = Math.max(-ySole, 0.012);
    const nubW = Math.max(radii.ankle * 1.15, 0.012);
    const nub = createBoxMesh(nubW, nubH, nubW, flat);
    nub.name = `nub${side}`;
    nub.position.y = ySole / 2;
    ankle.add(nub);
    placeMarkers(nub, markers, spec, ySole / 2);
    return;
  }

  const robot = leg.type === 'robot';
  if (robot) {
    hangRect(hip, `thigh${side}Mesh`, radii.hip, radii.knee, spec.thighLength, flat);
  } else {
    hangTaper(hip, `thigh${side}Mesh`, radii.hip, radii.knee, spec.thighLength, flat);
  }
  addBall(knee, `knee${side}Mesh`, radii.knee, smooth);
  if (robot) {
    hangRect(knee, `shin${side}Mesh`, radii.knee, radii.ankle, spec.shinLength, flat);
  } else {
    hangTaper(knee, `shin${side}Mesh`, radii.knee, radii.ankle, spec.shinLength, flat);
  }
  addBall(ankle, `ankle${side}Mesh`, radii.ankle, smooth);
  const foot = createFootMesh(spec.footWidth, spec.footHeight, spec.footLength, smooth);
  foot.name = `foot${side}Mesh`;
  foot.position.set(0, spec.footCenterY, spec.footCenterZ);
  ankle.add(foot);
  placeMarkers(ankle, markers, spec, soleY(spec));
}

export function buildLeg(ctx) {
  const side = ctx.slot.endsWith('left') ? 'L' : 'R';
  const leg = ctx.document.legs[side === 'L' ? 'left' : 'right'];
  const hip = ctx.joints[`hip${side}`];
  const stamp = `${leg.type}|${leg.color}`;
  const identity = leg.type === 'normal' && leg.color == null;
  if (hip.userData.partStamp === stamp) return;
  if (identity && !hip.userData.customLeg) {
    hip.userData.partStamp = stamp;
    return;
  }
  replaceLeg(ctx, side, leg);
  hip.userData.customLeg = !identity;
  hip.userData.partStamp = stamp;
}

function fitEnd(width, depth, radius) {
  const limit = radius * BOX_FIT;
  const diag = Math.hypot(width / 2, depth / 2) || 1;
  const scale = Math.min(1, limit / diag);
  return { width: width * scale, depth: depth * scale };
}

function removeNamed(root, name) {
  const mesh = root.getObjectByName(name);
  if (mesh) disposeMesh(mesh);
}

function addBlock(parent, name, topW, bottomW, height, topD, bottomD, y, material) {
  const mesh = createFrustumMesh(topW, bottomW, height, topD, bottomD, material);
  mesh.name = name;
  mesh.position.y = y;
  parent.add(mesh);
  return mesh;
}

function restoreTorso(ctx) {
  const spec = ctx.spec;
  const smooth = skinMaterial(ctx, false);
  removeNamed(ctx.root, 'chestMesh');
  removeNamed(ctx.root, 'pelvisMesh');
  removeNamed(ctx.root, 'yokeMesh');
  addBlock(
    ctx.joints.waist,
    'chestMesh',
    spec.chestTopWidth,
    spec.chestBottomWidth,
    spec.chestMeshHeight,
    spec.chestTopDepth,
    spec.chestBottomDepth,
    spec.chestMeshY,
    smooth,
  );
  addBlock(
    ctx.pelvis,
    'pelvisMesh',
    spec.pelvisTopWidth,
    spec.pelvisBottomWidth,
    spec.pelvisMeshHeight,
    spec.pelvisTopDepth,
    spec.pelvisBottomDepth,
    spec.pelvisMeshY,
    smooth,
  );
}

function replaceRobotTorso(ctx) {
  const spec = ctx.spec;
  const flat = skinMaterial(ctx, true);
  const waist = fitEnd(spec.chestBottomWidth, spec.chestBottomDepth, spec.radii.waist);
  const pelvisWaist = fitEnd(spec.pelvisTopWidth, spec.pelvisTopDepth, spec.radii.waist);
  removeNamed(ctx.root, 'chestMesh');
  removeNamed(ctx.root, 'pelvisMesh');
  removeNamed(ctx.root, 'yokeMesh');
  const chest = createRectTubeMesh(
    waist.width,
    spec.chestTopWidth,
    spec.chestMeshHeight,
    waist.depth,
    spec.chestTopDepth,
    flat,
  );
  chest.name = 'chestMesh';
  chest.position.y = spec.chestMeshY;
  ctx.joints.waist.add(chest);
  const pelvis = createRectTubeMesh(
    spec.pelvisBottomWidth,
    pelvisWaist.width,
    spec.pelvisMeshHeight,
    spec.pelvisBottomDepth,
    pelvisWaist.depth,
    flat,
  );
  pelvis.name = 'pelvisMesh';
  pelvis.position.y = spec.pelvisMeshY;
  ctx.pelvis.add(pelvis);
  const yokeH = Math.max(spec.radii.shoulder * 0.35, 0.01);
  const yoke = createBoxMesh(spec.chestTopWidth, yokeH, Math.max(spec.chestTopDepth * 0.28, 0.02), flat);
  yoke.name = 'yokeMesh';
  yoke.position.y = spec.chestHeight * spec.shoulderT;
  ctx.joints.waist.add(yoke);
}

export function buildTorso(ctx) {
  const type = ctx.document.body.torso;
  const root = ctx.root;
  if (root.userData.torsoStamp === type) return;
  const identity = type === 'normal';
  if (identity && !root.userData.customTorso) {
    root.userData.torsoStamp = type;
    return;
  }
  if (identity) restoreTorso(ctx);
  else replaceRobotTorso(ctx);
  root.userData.customTorso = !identity;
  root.userData.torsoStamp = type;
}
