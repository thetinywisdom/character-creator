import * as THREE from 'three';
import { seg } from '../../lib/shapes.js';

// Body measurements shared by every part builder (hair, tops, legwear, ...).
// All lengths in metres. Proportions are driven by "heads tall"
// (2.5 = chibi, 7.5 = realistic).

const smoothstep = (a, b, t) => {
  const x = Math.min(1, Math.max(0, (t - a) / (b - a)));
  return x * x * (3 - 2 * x);
};

export function measure(p) {
  const H = p.height;
  const headH = H / p.headsTall;
  const R = headH / 2;
  const chib = THREE.MathUtils.clamp((7.5 - p.headsTall) / 5, 0, 1); // 1 = chibi
  const legLen = (H - headH) * p.legLength;
  const neckLen = headH * (0.15 - 0.1 * chib); // chibi necks all but disappear
  const torsoLen = Math.max(H - headH - legLen - neckLen, headH * 0.3);
  const hipY = legLen;
  const shoulderY = hipY + torsoLen;
  const headY = H - R;
  const sw = p.shoulderWidth * H;
  const hw = p.hipWidth * H;
  const neckR = p.neckThickness * H;
  const armR = p.armThickness * H;
  const legR = p.legThickness * H;
  const L = torsoLen;
  const woman = p.bodyType === 'Woman';
  const child = p.bodyType === 'Boy' || p.bodyType === 'Girl';
  const girl = p.bodyType === 'Girl';

  // torso side profile (radius by height): hips -> waist -> chest -> shoulders.
  // The woman's profile is an hourglass: wide flared hips, a narrow waist.
  // The woman's torso continues below the hip line (to torsoBottom) so the
  // sculpted bottom can sit over the top of the thighs, where it belongs.
  const torsoBottom = woman ? -0.16 * L : 0;
  const side = new THREE.SplineCurve(child ? [
    // children: a straight, soft torso: no waist, no V, a slightly round
    // tummy, small sloping shoulders
    new THREE.Vector2(hw * 0.47, 0),
    new THREE.Vector2(hw * 0.5, L * 0.18),
    new THREE.Vector2((hw + sw) * 0.25 * 0.98, L * 0.42),
    new THREE.Vector2(sw * 0.45, L * 0.74),
    new THREE.Vector2(sw * 0.42, L * 0.84),
    new THREE.Vector2(sw * 0.31, L * 0.91),
    new THREE.Vector2(sw * 0.2, L * 0.96),
    new THREE.Vector2(neckR * 1.25, L * 0.99),
    new THREE.Vector2(neckR * 1.05, L),
  ] : woman ? [
    new THREE.Vector2(hw * 0.4, torsoBottom),
    new THREE.Vector2(hw * 0.5, 0),
    new THREE.Vector2(hw * 0.56, L * 0.12),
    new THREE.Vector2((hw + sw) * 0.25 * 0.72, L * 0.5),
    new THREE.Vector2(sw * 0.47, L * 0.77),
    // shoulders slope down from the neck: one smooth curve, no flat top
    new THREE.Vector2(sw * 0.43, L * 0.85),
    new THREE.Vector2(sw * 0.33, L * 0.91),
    new THREE.Vector2(sw * 0.2, L * 0.96),
    new THREE.Vector2(neckR * 1.25, L * 0.992),
    new THREE.Vector2(neckR * 1.05, L),
  ] : [
    // the man's profile is a V: narrow hips and waist, broad chest and shoulders
    new THREE.Vector2(hw * 0.44, 0),
    new THREE.Vector2(hw * 0.5, L * 0.14),
    new THREE.Vector2((hw + sw) * 0.25 * 0.88, L * 0.42),
    new THREE.Vector2(sw * 0.48, L * 0.76),
    // a squarer shoulder, then the trapezius slopes up to the neck (no flat top)
    new THREE.Vector2(sw * 0.46, L * 0.84),
    new THREE.Vector2(sw * 0.37, L * 0.9),
    new THREE.Vector2(sw * 0.23, L * 0.955),
    new THREE.Vector2(neckR * 1.3, L * 0.99),
    new THREE.Vector2(neckR * 1.05, L),
  ]);
  // women get extra rings/segments so the sculpted chest and bottom have room
  const torsoSamples = side.getPoints(seg(28, 16));
  const dense = side.getPoints(96);
  const torsoR = (y) => {
    if (y <= dense[0].y) return dense[0].x;
    for (let i = 1; i < dense.length; i++) {
      if (dense[i].y >= y) {
        const a = dense[i - 1], b = dense[i];
        return THREE.MathUtils.lerp(a.x, b.x, (y - a.y) / Math.max(b.y - a.y, 1e-6));
      }
    }
    return dense.at(-1).x;
  };

  const footH = Math.max(legR * 1.1, H * 0.04);
  return {
    woman, child, girl,
    chestShape: p.chestShape ?? 'Smooth (two)',
    chestSize: p.chestSize ?? 1,
    bottomShape: p.bottomShape ?? 'Smooth (two)',
    bottomSize: p.bottomSize ?? 1,
    torsoRadial: seg(28, 16),
    H, headH, R, chib, legLen, neckLen, torsoLen, hipY, shoulderY, headY,
    sw, hw, armR, legR, neckR,
    torsoSamples, torsoR, torsoBottom,
    torsoDepth: woman ? 0.72 : child ? 0.74 : 0.63, // torso is a lathe squashed front-to-back
    // ...and squashed more toward the shoulders: the upper torso is wide but
    // shallow. Without this the widest part (the shoulders) was also the
    // deepest, which pushed out a hump on the upper back.
    depthAt: (y) => (woman ? 0.72 : child ? 0.74 : 0.63) * (1 - 0.32 * smoothstep(L * 0.55, L * 0.97, y)),
    armLen: torsoLen * 0.85 + legLen * 0.25,
    handR: armR * 1.3,
    footH,
    footL: H * 0.13,
    hx: Math.max(hw * 0.5 - legR * (woman ? 1.25 : 1), legR * 0.9), // leg spacing
    kneeIn: woman ? 0.2 : girl ? 0.1 : 0.04, // how far knees and feet move toward the centre (× hx)
    // leg shape: thigh -> knee -> ankle radii. Women: full thighs, slim knees and calves.
    // men: straight, solid legs with little taper
    thighR: legR * (woman ? 1.55 : child ? 1.15 : 1.18),
    thighTop: woman ? legR * 0.45 : legR * 0.25, // thighs start a little higher, so hips flow into legs
    kneeR: legR * (woman ? 0.78 : child ? 0.9 : 0.98),
    ankleR: legR * (woman ? 0.55 : child ? 0.7 : 0.78),
    // calf bulge behind the upper shin
    calfR: legR * (woman ? 0.78 * 1.22 : child ? 0.9 * 1.06 : 0.98 * 1.08),
    // arms held a little away from the body (A-pose); wider for the woman
    armSpread: woman ? 0.2 : 0.17,
    // arm shape: rounded shoulder cap -> elbow -> slimmer wrist, slight bend
    shoulderR: armR * (woman ? 1.55 : child ? 1.2 : 1.35),   // men: strong shoulder caps and upper arms
    elbowR: armR * (woman ? 0.95 : 1.05),
    wristR: armR * (woman ? 0.62 : child ? 0.78 : 0.86),
    elbowBend: woman ? 0.2 : 0.18,
    // head ellipsoid radii
    rx: R * p.headWidth, ry: R, rz: R * 0.92,
  };
}
