import { BALL_VISUAL, CYLINDER_SIDES, SPHERE_DETAIL, ballCircumradius, sphereInradiusRatio } from './geometry.js';

export const REFERENCE_HEIGHT = 1.8;

/**
 * Pass a number to pin a measurement. Leave it null to derive it from `height`.
 * Lengths are metres. `headSize` is the head circumradius. `limbThickness` scales radii.
 */
export const DEFAULT_PARAMS = {
  height: 1.8,
  shoulderWidth: null,
  hipWidth: null,
  limbThickness: 1,
  headSize: null,
  skinColor: '#e0a37c',
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

/** Shares of the flexible vertical budget (sole-to-crown, minus head, feet, and joint overlap). */
const LENGTH_SHARE = {
  shin: 0.225,
  thigh: 0.24,
  pelvis: 0.155,
  torso: 0.24,
  neck: 0.14,
};

const SHARE_SUM = Object.values(LENGTH_SHARE).reduce((sum, n) => sum + n, 0);

function auto(value, derived) {
  return value == null ? derived : value;
}

/**
 * Concrete metres for a build. Vertical segments that were left on auto are
 * scaled together so the crown lands on `height`.
 */
export function resolveParams(input = {}) {
  const p = { ...DEFAULT_PARAMS, ...input };
  const height = Math.max(0.4, Number(p.height) || REFERENCE_HEIGHT);
  const s = height / REFERENCE_HEIGHT;
  const thick = Math.max(0.2, Number(p.limbThickness) || 1);
  const ratio = sphereInradiusRatio(SPHERE_DETAIL);

  const headRadius = Math.max(0.04, auto(p.headSize, 0.132 * s));

  const upperArmR = 0.042 * s * thick;
  const forearmR = 0.034 * s * thick;
  const clavicleR = 0.044 * s * thick;
  const thighR = 0.052 * s * thick;
  const shinR = 0.04 * s * thick;
  let neckR = 0.04 * s * thick;
  const headIn = headRadius * ratio;
  if (neckR > headIn * 0.55) neckR = headIn * 0.55;

  const shoulderR = ballCircumradius(Math.max(clavicleR, upperArmR), ratio);
  const elbowR = ballCircumradius(Math.max(upperArmR, forearmR), ratio);
  const wristR = ballCircumradius(forearmR, ratio);
  const hipR = ballCircumradius(thighR, ratio);
  const kneeR = ballCircumradius(Math.max(thighR, shinR), ratio);
  const ankleR = ballCircumradius(shinR, ratio);

  const torsoWidth = Math.max(0.08, auto(p.torsoWidth, 0.36 * s));
  const torsoDepth = Math.max(0.06, auto(p.torsoDepth, 0.2 * s));
  const shoulderWidth = Math.max(0.12, auto(p.shoulderWidth, 0.5 * s));
  const hipWidth = Math.max(0.1, auto(p.hipWidth, 0.27 * s));

  const footHeight = Math.max(0.02, auto(p.footHeight, Math.max(0.052 * s, ankleR * 0.7)));
  const footWidth = Math.max(0.04, auto(p.footWidth, Math.max(0.11 * s, ankleR * 2.15)));
  const footLength = Math.max(0.08, auto(p.footLength, Math.max(0.25 * s, footWidth * 2.05)));
  const footHeel = footLength * 0.28;
  const footToe = footLength - footHeel;

  // Bury the bottom vertex in the foot so the faceted ball still sits on it.
  const ankleSink = 0.22;
  const footTopY = -ankleR * (1 - ankleSink);
  const footCenterY = footTopY - footHeight / 2;
  const footCenterZ = (footToe - footHeel) / 2;
  const ankleY = footHeight - footTopY;

  const hipEmbed = hipR * 0.22;
  const torsoOverlap = 0.016 * s;
  // Most of the clavicle sits above the torso so the bar reads between the shoulder balls.
  const shoulderLift = clavicleR * 0.98;
  const neckEmbed = clavicleR * 1.25 + shoulderLift;

  const lengths = {
    shin: Math.max(0.05, auto(p.shinLength, 0.4 * s)),
    thigh: Math.max(0.05, auto(p.thighLength, 0.42 * s)),
    pelvis: Math.max(0.04, auto(p.pelvisHeight, 0.16 * s)),
    torso: Math.max(0.08, auto(p.torsoHeight, 0.42 * s)),
    neck: Math.max(0.04, auto(p.neckLength, 0.2 * s)),
  };

  const scalable = [];
  if (p.shinLength == null) scalable.push('shin');
  if (p.thighLength == null) scalable.push('thigh');
  if (p.pelvisHeight == null) scalable.push('pelvis');
  if (p.torsoHeight == null) scalable.push('torso');
  if (p.neckLength == null) scalable.push('neck');

  const fixed = ankleY - hipEmbed - torsoOverlap + shoulderLift + headRadius;
  const explicitSum = Object.entries(lengths)
    .filter(([key]) => !scalable.includes(key))
    .reduce((sum, [, value]) => sum + value, 0);
  const autoSum = scalable.reduce((sum, key) => sum + lengths[key], 0);
  if (scalable.length && autoSum > 0) {
    const budget = height - fixed - explicitSum;
    const shareBudget = Math.max(budget, height * 0.2);
    const scalableShare = scalable.reduce((sum, key) => sum + LENGTH_SHARE[key], 0);
    for (const key of scalable) {
      lengths[key] = (LENGTH_SHARE[key] / scalableShare) * shareBudget;
    }
  }

  const layout = stackLayout({
    ankleY,
    lengths,
    hipEmbed,
    torsoOverlap,
    shoulderLift,
    headRadius,
  });

  const wristIn = wristR * ratio;
  // Top of the box stays inside the wrist ball; the rest hangs below it.
  const handTopY = -wristIn * 0.55;
  const handWidth = wristIn * 1.35;
  const handDepth = wristIn * 0.78;
  const handLength = p.handLength == null
    ? Math.max(wristIn * 3.6, 0.11 * s)
    : Math.max(0.03, p.handLength);

  const upperArmLength = Math.max(0.05, auto(p.upperArmLength, 0.3 * s));
  const forearmLength = Math.max(0.05, auto(p.forearmLength, 0.26 * s));

  return {
    height,
    skinColor: p.skinColor || DEFAULT_PARAMS.skinColor,
    limbThickness: thick,
    headRadius,
    shoulderWidth,
    hipWidth,
    torsoWidth,
    torsoDepth,
    torsoHeight: lengths.torso,
    pelvisHeight: lengths.pelvis,
    pelvisDepth: torsoDepth * 1.12,
    pelvisZ: -torsoDepth * 0.06,
    neckLength: lengths.neck,
    neckEmbed,
    upperArmLength,
    forearmLength,
    thighLength: lengths.thigh,
    shinLength: lengths.shin,
    handWidth,
    handDepth,
    handLength,
    handTopY,
    footLength,
    footWidth,
    footHeight,
    footHeel,
    footToe,
    footTopY,
    footCenterY,
    footCenterZ,
    radii: {
      neck: neckR,
      clavicle: clavicleR,
      upperArm: upperArmR,
      forearm: forearmR,
      thigh: thighR,
      shin: shinR,
      head: headRadius,
      shoulder: shoulderR,
      elbow: elbowR,
      wrist: wristR,
      hip: hipR,
      knee: kneeR,
      ankle: ankleR,
    },
    /** Limb radius the joint ball must fully contain. */
    cover: {
      shoulder: Math.max(clavicleR, upperArmR),
      elbow: Math.max(upperArmR, forearmR),
      wrist: forearmR,
      hip: thighR,
      knee: Math.max(thighR, shinR),
      ankle: shinR,
      neck: neckR,
    },
    inradiusRatio: ratio,
    sphereDetail: SPHERE_DETAIL,
    cylinderSides: CYLINDER_SIDES,
    ballVisual: BALL_VISUAL,
    layout,
  };
}

function stackLayout({ ankleY, lengths, hipEmbed, torsoOverlap, shoulderLift, headRadius }) {
  const kneeY = ankleY + lengths.shin;
  const hipY = kneeY + lengths.thigh;
  const pelvisBottomY = hipY - hipEmbed;
  const pelvisTopY = pelvisBottomY + lengths.pelvis;
  const spineY = pelvisTopY - torsoOverlap;
  const torsoTopY = spineY + lengths.torso;
  const shoulderY = torsoTopY + shoulderLift;
  const neckY = shoulderY;
  const headY = neckY + lengths.neck;
  const crownY = headY + headRadius;
  return {
    soleY: 0,
    ankleY,
    kneeY,
    hipY,
    pelvisBottomY,
    pelvisTopY,
    spineY,
    torsoTopY,
    shoulderY,
    neckY,
    headY,
    crownY,
  };
}
