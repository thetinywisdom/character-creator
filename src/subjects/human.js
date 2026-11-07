import * as THREE from 'three';
import { capsuleBetween, ellipsoid, seg } from '../lib/shapes.js';

// Human. Default is the Realistic preset (picked in the milestone 2 review).
// Proportions are driven by "heads tall" (2.5 = chibi,
// 7.5 = realistic) so we can slide between comic-style and natural figures.
// Faces +z. Feet rest on y = 0. Units are metres.

export const human = {
  id: 'human',
  label: 'Human',
  schema: {
    headsTall:      { value: 7.5,     min: 2.5,  max: 7.5,  step: 0.1,   label: 'Heads tall' },
    height:         { value: 1.6,   min: 1.0,  max: 2.0,  step: 0.01,  label: 'Height (m)' },
    legLength:      { value: 0.54,   min: 0.35, max: 0.65, step: 0.01,  label: 'Leg length' },
    shoulderWidth:  { value: 0.25,  min: 0.15, max: 0.34, step: 0.005, label: 'Shoulder width' },
    hipWidth:       { value: 0.2,  min: 0.12, max: 0.3,  step: 0.005, label: 'Hip width' },
    limbThickness:  { value: 0.026,  min: 0.018, max: 0.06, step: 0.001, label: 'Limb thickness' },
    headWidth:      { value: 0.8,  min: 0.7,  max: 1.1,  step: 0.01,  label: 'Head width' },
    hair:           { value: 'short', options: ['none', 'short', 'long', 'bun', 'spiky'], label: 'Hair' },
  },
  presets: {
    Chibi:     { headsTall: 2.6, legLength: 0.42, shoulderWidth: 0.2,  hipWidth: 0.18, limbThickness: 0.035, headWidth: 0.95 },
    Stylized:  { headsTall: 5,   legLength: 0.5,  shoulderWidth: 0.24, hipWidth: 0.19, limbThickness: 0.03,  headWidth: 0.85 },
    Realistic: { headsTall: 7.5, legLength: 0.54, shoulderWidth: 0.25, hipWidth: 0.2,  limbThickness: 0.026, headWidth: 0.8 },
  },

  build(p, style) {
    const M = (role) => style.material(role);
    const root = new THREE.Group();
    root.name = 'human';

    // --- proportions ---------------------------------------------------
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

    // --- torso (lathe profile: hips -> waist -> chest -> shoulders) -------
    const L = torsoLen;
    const side = new THREE.SplineCurve([
      new THREE.Vector2(hw * 0.42, 0),
      new THREE.Vector2(hw * 0.5, L * 0.18),
      new THREE.Vector2((hw + sw) * 0.25 * 0.9, L * 0.5),
      new THREE.Vector2(sw * 0.5, L * 0.86),
      new THREE.Vector2(sw * 0.4, L * 0.98),
      new THREE.Vector2(limbR * 1.2, L),
    ]);
    const lathePts = [new THREE.Vector2(0, 0), ...side.getPoints(seg(28, 6)), new THREE.Vector2(0, L)];
    const torso = new THREE.Mesh(new THREE.LatheGeometry(lathePts, seg(28)), M('cloth'));
    torso.position.y = hipY;
    torso.scale.z = 0.62;
    torso.name = 'torso';
    root.add(torso);

    // --- neck -----------------------------------------------------------
    const neckBottom = shoulderY - L * 0.05;
    const neckTop = headY - R * 0.4;
    const neckR = limbR * 1.15;
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(neckR, neckR, neckTop - neckBottom, seg(14)), M('skin'));
    neck.position.y = (neckTop + neckBottom) / 2;
    root.add(neck);

    // --- legs (pivot at hip, for later animation) ----------------------
    const footH = Math.max(legR * 1.1, H * 0.04);
    const footL = H * 0.13;
    const hx = Math.max(hw * 0.5 - legR, legR * 0.9);
    for (const sx of [-1, 1]) {
      const leg = new THREE.Group();
      leg.name = sx < 0 ? 'legR' : 'legL';
      leg.position.set(sx * hx, hipY, 0);
      const ankle = -legLen + footH;
      leg.add(capsuleBetween([0, 0, 0], [0, ankle + legR * 0.5, 0], legR, M('clothAlt')));
      leg.add(ellipsoid(1, [legR * 1.1, footH / 2, footL / 2], M('shoe'), {
        position: [0, -legLen + footH / 2, footL * 0.22],
      }));
      root.add(leg);
    }

    // --- arms (pivot at shoulder) --------------------------------------
    const armLen = torsoLen * 0.85 + legLen * 0.25;
    const handR = armR * 1.4;
    for (const sx of [-1, 1]) {
      const arm = new THREE.Group();
      arm.name = sx < 0 ? 'armR' : 'armL';
      arm.position.set(sx * (sw * 0.5 - armR * 0.6), shoulderY - armR * 0.9, 0);
      arm.rotation.z = sx * 0.12;
      arm.add(capsuleBetween([0, 0, 0], [0, -(armLen - handR * 1.6), 0], armR, M('skin')));
      arm.add(capsuleBetween([0, 0, 0], [0, -armLen * 0.28, 0], armR * 1.2, M('cloth'))); // sleeve
      arm.add(ellipsoid(handR, [0.8, 1.15, 0.9], M('skin'), { position: [0, -(armLen - handR), 0] }));
      root.add(arm);
    }

    // --- head ----------------------------------------------------------
    const head = new THREE.Group();
    head.name = 'head';
    head.position.y = headY;
    root.add(head);
    const rx = R * p.headWidth, ry = R, rz = R * 0.92;
    head.add(ellipsoid(1, [rx, ry, rz], M('skin')));

    // no facial features: these figures are seen tiny, in a city

    // --- hair ----------------------------------------------------------
    if (p.hair !== 'none') {
      const cap = new THREE.Mesh(
        new THREE.SphereGeometry(1, seg(32), seg(16), 0, Math.PI * 2, 0, Math.PI * 0.58),
        M('hair'),
      );
      cap.scale.set(rx * 1.08, ry * 1.08, rz * 1.1);
      cap.rotation.x = -0.45; // exposes the forehead, covers the back
      head.add(cap);
    }
    if (p.hair === 'long') {
      const end = shoulderY - torsoLen * 0.2 - headY;
      const back = capsuleBetween([0, -R * 0.1, -rz * 0.4], [0, end, -rz * 0.5], R * 0.78, M('hair'));
      back.scale.set(1.2, 1, 0.55);
      head.add(back);
    }
    if (p.hair === 'bun') {
      head.add(ellipsoid(R * 0.38, [1, 1, 1], M('hair'), { position: [0, R * 0.8, -R * 0.55] }));
    }
    if (p.hair === 'spiky') {
      const n = 11;
      for (let i = 0; i < n; i++) {
        const phi = (i / n) * Math.PI * 2;
        const tilt = 0.35 + (i % 2) * 0.4;
        const dir = new THREE.Vector3(Math.sin(tilt) * Math.sin(phi), Math.cos(tilt), Math.sin(tilt) * Math.cos(phi));
        if (dir.z > 0.45) continue; // keep spikes off the face
        const spike = new THREE.Mesh(new THREE.ConeGeometry(R * 0.24, R * 0.6, seg(10)), M('hair'));
        spike.position.set(dir.x * rx, dir.y * ry, dir.z * rz).multiplyScalar(1.02);
        spike.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
        head.add(spike);
      }
    }

    return root;
  },
};
