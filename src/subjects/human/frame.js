import * as THREE from 'three';
import { seg } from '../../lib/shapes.js';

// Body measurements shared by every part builder (hair, tops, legwear, ...).
// All lengths in metres. Proportions are driven by "heads tall"
// (2.5 = chibi, 7.5 = realistic).

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
  const limbR = p.limbThickness * H;
  const armR = limbR;
  const legR = limbR * 1.3;
  const L = torsoLen;
  const woman = p.bodyType === 'Woman';

  // torso side profile (radius by height): hips -> waist -> chest -> shoulders.
  // The woman's profile flares wider at the hips from a narrower waist.
  const side = new THREE.SplineCurve([
    new THREE.Vector2(hw * (woman ? 0.47 : 0.42), 0),
    new THREE.Vector2(hw * (woman ? 0.64 : 0.5), L * (woman ? 0.15 : 0.18)),
    new THREE.Vector2((hw + sw) * 0.25 * (woman ? 0.76 : 0.9), L * 0.5),
    new THREE.Vector2(sw * 0.5, L * 0.86),
    new THREE.Vector2(sw * 0.4, L * 0.98),
    new THREE.Vector2(limbR * 1.2, L),
  ]);
  const torsoSamples = side.getPoints(seg(28, 6));
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
    woman,
    H, headH, R, chib, legLen, neckLen, torsoLen, hipY, shoulderY, headY,
    sw, hw, limbR, armR, legR,
    torsoSamples, torsoR,
    torsoDepth: 0.62, // torso is a lathe squashed front-to-back
    neckR: limbR * (woman ? 1.0 : 1.15),
    armLen: torsoLen * 0.85 + legLen * 0.25,
    handR: armR * 1.4,
    footH,
    footL: H * 0.13,
    hx: Math.max(hw * 0.5 - legR, legR * 0.9), // leg spacing from the centre line
    // head ellipsoid radii
    rx: R * p.headWidth, ry: R, rz: R * 0.92,
  };
}
