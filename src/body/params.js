import { COLORS } from '../character/palette.js';
import {
  CYLINDER_SIDES,
  ISO_HEAD_CROWN,
  ISO_HEAD_NECK_RADIUS,
  ISO_HEAD_NECK_Y,
  JOINT_HEIGHT,
  JOINT_WIDTH,
} from './geometry.js';

export const REFERENCE_HEIGHT = 1.8;

/**
 * Fractions of the wooden mannequin in the reference photo
 * (crown y=2 to sole y=1076, 1074px on a 581×1229 plate).
 */
const PHOTO = {
  visibleNeck: 32 / 1074,
  waistWidth: 93 / 1074,
  pelvisWidth: 145 / 1074,
  hipSpan: 90 / 1074,
};

/** Shoulder span of the default 1.8 m figure. Presets scale from this. */
const DEFAULT_SHOULDER = 0.3;

/** How the flexible torso and legs share whatever height is left after the head and feet. */
const SHARE = {
  shin: 0.403,
  thigh: 0.436,
  hipToWaist: 0.201,
  chest: 0.353,
};

/** Shoulder centres sit this far up the chest, near the top corners. */
export const SHOULDER_T = 0.84;

/** Hairline so the waist blocks don't share a face. The ball fills it. */
const WAIST_GAP = 0.0012;

/**
 * Pass a number to pin a measurement. Leave it null to derive it from `height`.
 * Lengths are metres. `headSize` is the lathe origin to the crown.
 * `limbThickness` scales joint and limb radii.
 */
export const DEFAULT_PARAMS = {
  height: 1.8,
  shoulderWidth: null,
  hipWidth: null,
  bellyWidth: null,
  limbThickness: 1,
  headSize: null,
  skinColor: COLORS.skin,
  upperArmLength: null,
  forearmLength: null,
  thighLength: null,
  shinLength: null,
  torsoHeight: null,
  torsoWidth: null,
  torsoDepth: null,
  pelvisHeight: null,
  neckLength: null,
  handLength: null,
  footLength: null,
  footWidth: null,
  footHeight: null,
};

function auto(value, derived) {
  return value == null ? derived : value;
}

function clamp(value, min) {
  return Math.max(min, value);
}

/**
 * Concrete metres for one build. Auto lengths are scaled together so the
 * crown lands on `height`.
 */
export function resolveParams(input = {}) {
  const p = { ...DEFAULT_PARAMS, ...input };
  const height = clamp(Number(p.height) || REFERENCE_HEIGHT, 0.4);
  const s = height / REFERENCE_HEIGHT;
  const thick = clamp(Number(p.limbThickness) || 1, 0.35);
  const rad = (metres) => metres * s * thick;

  const neckTarget = rad(0.054);
  // Thick at the root, clearly narrower at the wrist and ankle, as in the turnaround.
  const shoulderR = rad(0.052);
  const elbowR = rad(0.04);
  const wristR = rad(0.028);
  const hipR = rad(0.066);
  const kneeR = rad(0.05);
  const ankleR = rad(0.038);
  const baseWaistR = rad(0.076);
  let waistR = baseWaistR;
  if (p.bellyWidth != null && Number.isFinite(Number(p.bellyWidth))) {
    waistR = clamp(Number(p.bellyWidth) / 2, 0.01);
  }

  let headScale = neckTarget / ISO_HEAD_NECK_RADIUS;
  if (p.headSize != null) {
    const pinned = clamp(Number(p.headSize) || ISO_HEAD_CROWN * headScale, 0.04);
    headScale = pinned / ISO_HEAD_CROWN;
  }
  const ry = ISO_HEAD_CROWN * headScale;
  const neckR = ISO_HEAD_NECK_RADIUS * headScale;
  const socketDrop = -ISO_HEAD_NECK_Y * headScale;
  const headNeckY = ISO_HEAD_NECK_Y * headScale;

  const shoulderWidth = clamp(auto(p.shoulderWidth, Math.max(DEFAULT_SHOULDER * s, shoulderR * 3.2)), 0.08);
  const hipWidth = clamp(auto(p.hipWidth, Math.max(0.18 * s, hipR * 2.15 + 0.02)), 0.06);
  const hipX = hipWidth / 2;

  const chestBottom = waistR * 2;
  // Straight upper-torso box. The shoulder joints sit on its side faces.
  const chestTopWidth = shoulderWidth;

  const pelvisTop = waistR * 2;
  let pelvisBottomHalf = hipX + hipR * 0.7;
  pelvisBottomHalf = Math.max(pelvisBottomHalf, waistR * 1.22);
  const pelvisBottomWidth = pelvisBottomHalf * 2;
  // Side depth stays close to the front width. The sheet's torso is a thick column.
  const pelvisBottomDepth = Math.max(pelvisTop * 1.15, pelvisBottomWidth * 0.68, chestTopWidth * 0.74);
  const chestTopDepth = p.torsoDepth != null
    ? clamp(Number(p.torsoDepth) || pelvisBottomDepth, 0.04)
    : pelvisBottomDepth;

  const footHeight = clamp(auto(p.footHeight, Math.max(0.032 * s, ankleR * 0.7)), 0.012);
  const footWidth = clamp(auto(p.footWidth, Math.max(0.09 * s, ankleR * 1.8)), 0.02);
  const footLength = clamp(auto(p.footLength, Math.max(0.19 * s, footWidth * 1.7)), 0.04);
  const footCenterZ = footLength * 0.22;
  const footTop = -ankleR * 0.42;
  const footCenterY = footTop - footHeight / 2;
  const soleY = footCenterY - footHeight / 2;
  const ankleY = -soleY;
  const footHeel = footCenterZ - footLength / 2;
  const footToe = footCenterZ + footLength / 2;

  const visibleNeck = p.neckLength == null
    ? PHOTO.visibleNeck * REFERENCE_HEIGHT * s
    : null;
  const neckLen = p.neckLength == null
    ? socketDrop + visibleNeck
    : clamp(Number(p.neckLength) || socketDrop, socketDrop * 0.35);

  const lengths = {
    shin: p.shinLength == null ? null : clamp(Number(p.shinLength) || 0.05, 0.04),
    thigh: p.thighLength == null ? null : clamp(Number(p.thighLength) || 0.05, 0.04),
    hipToWaist: p.pelvisHeight == null ? null : clamp(Number(p.pelvisHeight) || 0.05, 0.04),
    chest: p.torsoHeight == null ? null : clamp(Number(p.torsoHeight) || 0.08, 0.06),
  };
  const scalable = Object.entries(lengths).filter(([, value]) => value == null).map(([key]) => key);
  const explicitSum = Object.values(lengths).reduce((sum, value) => sum + (value || 0), 0);
  const fixed = ankleY + neckLen + ry;
  if (scalable.length) {
    const weight = scalable.reduce((sum, key) => sum + SHARE[key], 0);
    const room = Math.max(height - fixed - explicitSum, scalable.length * 0.05);
    for (const key of scalable) lengths[key] = (SHARE[key] / weight) * room;
  }

  const belowHip = Math.min(hipR * 0.5, lengths.hipToWaist * 0.45);
  const chestMeshHeight = Math.max(lengths.chest - WAIST_GAP, 0.02);
  const pelvisMeshHeight = Math.max(lengths.hipToWaist + belowHip - WAIST_GAP, 0.02);

  const layout = stackLayout({
    ankleY,
    shin: lengths.shin,
    thigh: lengths.thigh,
    hipToWaist: lengths.hipToWaist,
    chest: lengths.chest,
    neckLen,
    ry,
  });

  const handLength = clamp(auto(p.handLength, Math.max(0.112 * s, wristR * 3.4)), 0.03);
  const handBaseRx = wristR * 0.5;
  const handBaseRz = wristR * 0.42;
  const handMidRx = wristR * 1.55;
  const handMidRz = wristR * 0.95;

  const upperArmLength = clamp(auto(p.upperArmLength, 0.3 * s), 0.05);
  const forearmLength = clamp(auto(p.forearmLength, 0.27 * s), 0.05);

  const chestNeckWidth = Math.min(chestTopWidth * 0.48, Math.max(neckR * 2.8, chestTopWidth * 0.34));
  const chestNeckDepth = Math.min(chestTopDepth * 0.72, Math.max(neckR * 2.4, chestTopDepth * 0.48));
  const shoulderRun = Math.max((chestTopWidth - chestNeckWidth) / 2, 0.01);
  const dropMax = Math.min(chestMeshHeight * 0.14, lengths.chest * SHOULDER_T * 0.55);
  const chestShoulderDrop = Math.min(Math.max(shoulderRun * 0.36, Math.min(0.018 * s, dropMax)), dropMax);

  return {
    height,
    skinColor: p.skinColor || DEFAULT_PARAMS.skinColor,
    limbThickness: thick,
    headScale,
    headRy: ry,
    headRadius: ry,
    headNeckY,
    socketDrop,
    visibleNeck: neckLen - socketDrop,
    shoulderWidth,
    hipWidth,
    bellyWidth: waistR * 2,
    shoulderT: SHOULDER_T,
    chestHeight: lengths.chest,
    chestTopWidth,
    chestBottomWidth: chestBottom,
    chestTopDepth,
    chestBottomDepth: chestTopDepth,
    chestNeckWidth,
    chestNeckDepth,
    chestShoulderDrop,
    chestMeshY: WAIST_GAP,
    chestMeshHeight,
    pelvisHeight: lengths.hipToWaist,
    pelvisTopWidth: pelvisTop,
    pelvisBottomWidth,
    pelvisTopDepth: pelvisTop,
    pelvisBottomDepth,
    pelvisMeshY: -belowHip,
    pelvisMeshHeight,
    belowHip,
    neckLength: neckLen,
    neckEmbed: 0.004,
    upperArmLength,
    forearmLength,
    thighLength: lengths.thigh,
    shinLength: lengths.shin,
    handLength,
    handBaseRx,
    handBaseRz,
    handMidRx,
    handMidRz,
    handPitch: -0.1,
    handYaw: 0.16,
    footLength,
    footWidth,
    footHeight,
    footCenterY,
    footCenterZ,
    footHeel,
    footToe,
    radii: {
      neck: neckR,
      waist: waistR,
      shoulder: shoulderR,
      elbow: elbowR,
      wrist: wristR,
      hip: hipR,
      knee: kneeR,
      ankle: ankleR,
    },
    cylinderSides: CYLINDER_SIDES,
    jointWidth: JOINT_WIDTH,
    jointHeight: JOINT_HEIGHT,
    layout,
  };
}

function stackLayout({ ankleY, shin, thigh, hipToWaist, chest, neckLen, ry }) {
  const kneeY = ankleY + shin;
  const hipY = kneeY + thigh;
  const waistY = hipY + hipToWaist;
  const neckY = waistY + chest;
  const shoulderY = waistY + chest * SHOULDER_T;
  const headY = neckY + neckLen;
  const crownY = headY + ry;
  return {
    soleY: 0,
    ankleY,
    kneeY,
    hipY,
    waistY,
    shoulderY,
    neckY,
    headY,
    crownY,
  };
}
