import * as THREE from 'three';
import { poseHold } from '../../anim/gait.js';
import { seg, taperBetween } from '../../lib/shapes.js';
import { CLOTH_COLORS, HAIR_COLORS, SKIN_TONES } from '../../styles/palette.js';
import { buildBackAccessory, buildBodyAccessory } from './accessories.js';
import { measure } from './frame.js';
import { buildHair } from './hair.js';
import { HOLD_POSES, buildHandItem } from './handheld.js';
import { buildFaceAccessory, buildFacialHair, buildHeadwear, coversHair, hairUnder } from './head.js';
import { headGeometry } from './headShape.js';
import { human } from '../human.js';
import { buildSkirt } from './legwear.js';
import { buildOuterwear } from './outerwear.js';
import { isElderly } from './rules.js';
import { sculptTorso } from './sculpt.js';
import { TOPS, buildTorso } from './tops.js';

// Three opt-in ways to build a person, for the Human lab only.
// The creator, the catalogue and the City keep calling human.build.
//
// Each figure uses the same joint names as today's person (spine, head,
// legL/R, shinL/R, footL/R, armL/R, foreL/R, skirt, wings) and the same
// clothes, hair and accessory builders, so an outfit, a body type and the
// walk still apply. Nothing here draws eyes, a mouth, a nose or brows.
//
//   refined  today's lathe torso and tapered limbs, with the proportions
//            and the joints (shoulders, hips, hands, feet) adjusted so the
//            silhouette reads at a small size
//   toy      a big round head, an egg body and stubby peg limbs with a
//            ball at each joint, like a vinyl figure
//   lofted   one continuous torso (the cat v6 loft) and tube limbs with no
//            ball joints, so the body reads as a single shape

const smoothstep = (a, b, t) => {
  const x = Math.min(1, Math.max(0, (t - a) / (b - a)));
  return x * x * (3 - 2 * x);
};

function accentFor(topColor) {
  return ['White', 'Yellow', 'Khaki', 'Pink'].includes(topColor) ? CLOTH_COLORS.Navy : CLOTH_COLORS.White;
}

/** Replace the torso profile. `pts` is [radius, height] from hip space. */
function setProfile(f, pts) {
  const curve = pts.map(([x, y]) => new THREE.Vector2(x, y));
  f.torsoSamples = curve;
  f.torsoR = (y) => {
    if (y <= curve[0].y) return curve[0].x;
    for (let i = 1; i < curve.length; i++) {
      if (curve[i].y >= y) {
        const a = curve[i - 1], b = curve[i];
        return THREE.MathUtils.lerp(a.x, b.x, (y - a.y) / Math.max(b.y - a.y, 1e-6));
      }
    }
    return curve.at(-1).x;
  };
  f._surface = null;
}

function retuneProfile(f, mul) {
  const y0 = f.torsoBottom, y1 = f.torsoLen, n = 12, pts = [];
  for (let i = 0; i <= n; i++) {
    const y = y0 + (y1 - y0) * (i / n);
    pts.push([mul(y, f.torsoR(y)), y]);
  }
  setProfile(f, pts);
}

/** Child-like head size, short legs, thick limbs. The beard rule then applies. */
function toyParams(p) {
  const kid = p.bodyType === 'Boy' || p.bodyType === 'Girl';
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  return {
    ...p,
    headsTall: kid ? 3.05 : 3.55,
    legLength: kid ? 0.4 : 0.43,
    shoulderWidth: clamp((p.shoulderWidth ?? 0.25) * 1.16, 0.15, 0.34),
    hipWidth: clamp((p.hipWidth ?? 0.2) * 1.1, 0.12, 0.3),
    neckThickness: clamp((p.neckThickness ?? 0.03) * 1.8, 0.015, 0.06),
    armThickness: clamp((p.armThickness ?? 0.028) * 1.6, 0.015, 0.05),
    legThickness: clamp((p.legThickness ?? 0.034) * 1.45, 0.02, 0.07),
    headWidth: clamp((p.headWidth ?? 0.8) * 1.05, 0.7, 1.1),
  };
}

function adjustRefined(f) {
  // A slightly larger head and thicker extremities, so the same height still
  // reads when the figure is a dozen pixels tall. The torso keeps its
  // man / woman / child profile, only pulled into a clearer silhouette.
  const k = 1.07;
  f.rx *= k; f.ry *= k; f.rz *= k;
  f.headY -= f.ry * 0.03;
  f.neckR *= 0.94;
  f.shoulderR *= 1.08;
  f.handR *= 1.16;
  f.wristR *= 1.06;
  f.footL *= 1.12;
  f.footH *= 1.04;
  f.thighTop += f.legR * 0.32;
  f.thighR *= 1.06;
  f.hx *= 0.96;
  retuneProfile(f, (y, r) => {
    const t = (y - f.torsoBottom) / Math.max(f.torsoLen - f.torsoBottom, 1e-4);
    if (t > 0.97) return r;
    let m = 1;
    if (t > 0.7 && t < 0.94) m *= 1.05;
    if (!f.child && t > 0.34 && t < 0.58) m *= 0.94;
    if (t < 0.2) m *= 1.04;
    return r * m;
  });
}

function adjustToy(f) {
  // Round the head off (the hair shells follow these radii) and sit it down
  // on a short neck so it reads as one toy, not a head on a stick.
  f.rx *= 1.14;
  f.ry *= 1.08;
  f.rz *= 1.16;
  f.headY -= f.ry * 0.08;
  f.armLen *= 0.78;
  f.elbowBend = Math.min(f.elbowBend, 0.06);
  f.armSpread = Math.max(f.armSpread, 0.3);
  f.kneeIn *= 0.35;
  f.footL *= 0.7;
  f.footH *= 0.82;
  // chubby, barely tapered limbs
  f.elbowR = Math.max(f.elbowR, f.shoulderR * 0.78);
  f.wristR = Math.max(f.wristR, f.elbowR * 0.82);
  f.kneeR = Math.max(f.kneeR, f.thighR * 0.8);
  f.ankleR = Math.max(f.ankleR, f.kneeR * 0.72);
  f.calfR = Math.max(f.calfR, f.kneeR);
  f.handR *= 1.15;
  const L = f.torsoLen;
  const y0 = f.torsoBottom;
  const belly = 1 + 0.2 * (f.belly || 0);
  const hip = f.hw * (f.woman ? 0.64 : f.child ? 0.56 : 0.52) * (f.woman ? 1 : belly);
  const tum = (f.woman ? f.hw * 0.56 : f.hw * 0.54 * belly);
  const waist = (f.hw + f.sw) * (f.woman ? 0.25 : 0.28) * (1 + 0.1 * (f.belly || 0));
  const chest = f.sw * (f.woman ? 0.5 : 0.46) * (1 + 0.06 * (f.muscle || 0));
  const pts = [];
  const add = (x, y) => { if (!pts.length || y > pts.at(-1)[1] + 1e-4) pts.push([x, y]); };
  if (y0 < -0.001) add(hip * 0.78, y0);
  add(hip, 0);
  add(tum, L * 0.3);
  add(waist, L * 0.5);
  add(chest, L * 0.72);
  add(f.sw * 0.4, L * 0.88);
  add(f.neckR * 1.45, L * 0.97);
  add(f.neckR * 1.05, L);
  setProfile(f, pts);
  f.torsoRadial = 8; // few sides: a faceted egg, not a smooth lathe
  const depth = Math.min(0.96, (f.woman ? 0.9 : f.child ? 0.86 : 0.82) * (1 + 0.06 * (f.belly || 0)));
  f.depthAt = (y) => depth * (1 - 0.08 * smoothstep(L * 0.78, L, y));
}

/** Elbow, wrist and forearm direction. Matches arms.js so a held item sits in the hand. */
function limbJoints(f, sx, kind) {
  const upper = f.armLen * (kind === 'toy' ? 0.46 : 0.42);
  // today's builder reserves a long box-hand below the wrist; a ball hand needs less
  const reserve = kind === 'toy' ? f.handR * 1.15 : f.handR * 3.7;
  const foreLen = Math.max(f.armLen * 0.26, f.armLen - upper - reserve);
  const elbow = new THREE.Vector3(0, -upper, 0);
  const dir = new THREE.Vector3(sx * Math.sin(f.elbowBend * 0.4), -1, Math.sin(f.elbowBend)).normalize();
  const wrist = elbow.clone().addScaledVector(dir, foreLen);
  return { elbow, wrist, dir, foreLen };
}

function coneBetween(a, b, r0, r1, sides, material) {
  const A = a instanceof THREE.Vector3 ? a.clone() : new THREE.Vector3(...a);
  const B = b instanceof THREE.Vector3 ? b.clone() : new THREE.Vector3(...b);
  const dir = B.clone().sub(A);
  const len = Math.max(dir.length(), 1e-4);
  dir.multiplyScalar(1 / len);
  const geo = new THREE.CylinderGeometry(r1, r0, len, sides, 1);
  const mesh = new THREE.Mesh(geo, material);
  mesh.position.copy(A).add(B).multiplyScalar(0.5);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
  return mesh;
}

/** A cone that ends inside the joint balls, so the ball reads as the joint. */
function toyCone(a, b, r0, r1, material) {
  const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b);
  const dir = B.clone().sub(A);
  const len = Math.max(dir.length(), 1e-4);
  dir.multiplyScalar(1 / len);
  const inset0 = Math.min(r0 * 0.45, len * 0.22);
  const inset1 = Math.min(r1 * 0.45, len * 0.22);
  return coneBetween(A.addScaledVector(dir, inset0), B.clone().addScaledVector(dir, -inset1), r0 * 0.94, r1 * 0.94, 5, material);
}

/**
 * A tube through rings. `scales[i]` is [across, up] so a hand can be a flat
 * paddle on the end of the same mesh. Few sides, several rings: faceted, but
 * one continuous shape instead of a cylinder with a ball at each end.
 */
function ringMesh(points, radii, scales, sides, material) {
  const frames = points.map((p0, i) => {
    const p = p0 instanceof THREE.Vector3 ? p0 : new THREE.Vector3(...p0);
    const prev = points[Math.max(0, i - 1)];
    const next = points[Math.min(points.length - 1, i + 1)];
    const A = prev instanceof THREE.Vector3 ? prev : new THREE.Vector3(...prev);
    const C = next instanceof THREE.Vector3 ? next : new THREE.Vector3(...next);
    const dir = C.clone().sub(A);
    if (dir.lengthSq() < 1e-10) dir.set(0, -1, 0);
    dir.normalize();
    const helper = Math.abs(dir.y) > 0.92 ? new THREE.Vector3(0, 0, 1) : new THREE.Vector3(0, 1, 0);
    const right = new THREE.Vector3().crossVectors(helper, dir);
    if (right.lengthSq() < 1e-8) right.set(1, 0, 0);
    right.normalize();
    const up = new THREE.Vector3().crossVectors(dir, right).normalize();
    const sc = scales?.[i] ?? [1, 1];
    return { p, right, up, r: radii[i], sx: sc[0], sy: sc[1] };
  });
  const pos = [];
  for (const f of frames) {
    for (let k = 0; k < sides; k++) {
      const a = (k / sides) * Math.PI * 2;
      const c = Math.cos(a) * f.r * f.sx;
      const s = Math.sin(a) * f.r * f.sy;
      pos.push(
        f.p.x + c * f.right.x + s * f.up.x,
        f.p.y + c * f.right.y + s * f.up.y,
        f.p.z + c * f.right.z + s * f.up.z,
      );
    }
  }
  const idx = [];
  const ring = (i, k) => i * sides + ((k % sides) + sides) % sides;
  for (let i = 0; i < frames.length - 1; i++) {
    for (let k = 0; k < sides; k++) {
      const a = ring(i, k), b = ring(i, k + 1), c = ring(i + 1, k), d = ring(i + 1, k + 1);
      idx.push(a, b, c, b, d, c);
    }
  }
  const s0 = pos.length / 3;
  pos.push(frames[0].p.x, frames[0].p.y, frames[0].p.z);
  const s1 = pos.length / 3;
  const lastP = frames.at(-1).p;
  pos.push(lastP.x, lastP.y, lastP.z);
  const last = frames.length - 1;
  for (let k = 0; k < sides; k++) {
    idx.push(s0, ring(0, k + 1), ring(0, k));
    idx.push(s1, ring(last, k), ring(last, k + 1));
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  return new THREE.Mesh(geo, material);
}

function loftTube(a, b, r0, r1, material, rings = 4) {
  const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b);
  const points = [], radii = [];
  for (let i = 0; i < rings; i++) {
    const t = i / (rings - 1);
    const u = t * t * (3 - 2 * t);
    points.push(A.clone().lerp(B, t));
    radii.push(THREE.MathUtils.lerp(r0, r1, u));
  }
  return ringMesh(points, radii, null, seg(10, 6), material);
}

function loftStations(stations, material) {
  return ringMesh(stations.map((s) => new THREE.Vector3(s[0], s[1], s[2])), stations.map((s) => s[3]), null, seg(10, 6), material);
}

function addSegment(kind, parent, a, b, r0, r1, material) {
  if (kind === 'refined') parent.add(taperBetween(a, b, r0, r1, material));
  else if (kind === 'toy') parent.add(toyCone(a, b, r0, r1, material));
  else parent.add(loftTube(a, b, r0, r1, material));
}

/**
 * Forearm skin. The lofted hand is the same tube, flattened at the end, so
 * the wrist does not break into a separate block.
 */
function addForearm(kind, fore, wristLocal, dir, r0, r1, material, f, { hand = false } = {}) {
  if (kind !== 'lofted' || !hand) {
    addSegment(kind, fore, [0, 0, 0], wristLocal.toArray(), r0, r1, material);
    return;
  }
  const len = Math.max(wristLocal.length(), 1e-4);
  const d = dir.clone().normalize();
  const handLen = f.handR * 2.15;
  const stations = [
    [0, r0, 1, 1],
    [0.5, THREE.MathUtils.lerp(r0, r1, 0.5), 1, 1],
    [1, r1, 1, 1],
    [1 + handLen * 0.45 / len, f.handR * 1.2, 0.72, 1.35],
    [1 + handLen / len, f.handR * 0.62, 0.5, 0.9],
  ];
  const points = [], radii = [], scales = [];
  for (const [t, r, sx, sy] of stations) {
    points.push(d.clone().multiplyScalar(len * t));
    radii.push(r);
    scales.push([sx, sy]);
  }
  fore.add(ringMesh(points, radii, scales, seg(10, 6), material));
}

function refinedHand(f, sx, wrist, dir, material) {
  const r = f.handR;
  const len = r * 2.05;
  const geo = new THREE.BoxGeometry(r * 0.78, len, r * 1.35, 1, 2, 2);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    if (pos.getY(i) < 0) {
      pos.setZ(i, pos.getZ(i) * 0.6);
      pos.setX(i, pos.getX(i) * 0.82);
    }
  }
  geo.computeVertexNormals();
  const hand = new THREE.Mesh(geo, material);
  // -Y runs toward the fingers; +Z is the front of the hand (wider than the sides)
  const fingers = dir.clone().normalize();
  const forward = new THREE.Vector3(0, 0, 1);
  let side = new THREE.Vector3().crossVectors(forward, fingers);
  if (side.lengthSq() < 1e-6) side = new THREE.Vector3(1, 0, 0);
  side.normalize();
  const front = new THREE.Vector3().crossVectors(fingers, side).normalize();
  hand.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(side, fingers.clone().negate(), front));
  hand.position.copy(wrist).addScaledVector(fingers, len * 0.42);
  // a thumb nub on the inner front corner, so the hand has a silhouette at street size
  // inner front corner: sx < 0 is the right hand, and local +X points to world +X
  const thumb = new THREE.Mesh(new THREE.BoxGeometry(r * 0.34, r * 0.55, r * 0.32), material);
  thumb.position.set(-sx * r * 0.32, len * 0.16, r * 0.52);
  thumb.rotation.z = -sx * 0.6;
  hand.add(thumb);
  return hand;
}

function coverArm(kind, arm, fore, f, elbow, wristLocal, dir, mats, sleeve, outerMat) {
  const E = elbow.toArray();
  const cloth = sleeve === 'outer' ? outerMat : mats.top;
  if (sleeve === 'outer') {
    addSegment(kind, arm, [0, 0, 0], E, f.shoulderR * 1.16, f.elbowR * 1.28, cloth);
    addForearm(kind, fore, wristLocal, dir, f.elbowR * 1.28, f.wristR * 1.35, cloth, f);
  } else if (sleeve === 'short') {
    const end = elbow.clone().multiplyScalar(0.62);
    addSegment(kind, arm, [0, 0, 0], end.toArray(), f.shoulderR * 1.06, THREE.MathUtils.lerp(f.shoulderR, f.elbowR, 0.62) * 1.16, cloth);
  } else if (sleeve === 'wide') {
    addSegment(kind, arm, [0, 0, 0], E, f.shoulderR * 1.1, f.elbowR * 2.2, cloth);
    addForearm(kind, fore, wristLocal.clone().multiplyScalar(0.55), dir, f.elbowR * 2.2, f.elbowR * 2.0, cloth, f);
  } else if (sleeve === 'long') {
    addSegment(kind, arm, [0, 0, 0], E, f.shoulderR * 1.06, f.elbowR * 1.14, cloth);
    addForearm(kind, fore, wristLocal, dir, f.elbowR * 1.14, f.wristR * 1.18, cloth, f);
  }
}

function buildArmOf(kind, f, sx, spec, mats, outerMat) {
  const arm = new THREE.Group();
  arm.name = sx < 0 ? 'armR' : 'armL';
  // The cap stays inside the shoulder slope. Refined sits a little higher in
  // that corner; lofted starts further in so the tube does not ridge the shirt.
  if (kind === 'toy') arm.position.set(sx * f.sw * 0.42, f.shoulderY - f.torsoLen * 0.12, 0);
  else if (kind === 'refined') arm.position.set(sx * (f.sw * 0.5 - f.shoulderR * 0.7), f.shoulderY - f.torsoLen * 0.16, 0);
  else arm.position.set(sx * (f.sw * 0.5 - f.shoulderR * 0.85), f.shoulderY - f.torsoLen * 0.18, 0);
  arm.rotation.z = sx * f.armSpread;

  const { elbow, wrist, dir } = limbJoints(f, sx, kind);
  const fore = new THREE.Group();
  fore.name = sx < 0 ? 'foreR' : 'foreL';
  fore.position.copy(elbow);
  arm.add(fore);
  const wristLocal = wrist.clone().sub(elbow);
  const sleeve = outerMat ? 'outer' : (spec.sleeve ?? 'short');
  const elbowCovered = sleeve === 'outer' || sleeve === 'long' || sleeve === 'wide';

  if (kind === 'toy') {
    const shoulderMat = sleeve === 'none' ? mats.skin : (sleeve === 'outer' ? outerMat : mats.top);
    arm.add(new THREE.Mesh(new THREE.SphereGeometry(f.shoulderR * 0.95, 6, 5), shoulderMat));
    fore.add(new THREE.Mesh(new THREE.SphereGeometry(f.elbowR * 0.9, 6, 5), elbowCovered ? (sleeve === 'outer' ? outerMat : mats.top) : mats.skin));
  }

  addSegment(kind, arm, [0, 0, 0], elbow.toArray(), f.shoulderR, f.elbowR, mats.skin);
  addForearm(kind, fore, wristLocal, dir, f.elbowR, f.wristR, mats.skin, f, { hand: true });
  coverArm(kind, arm, fore, f, elbow, wristLocal, dir, mats, sleeve, outerMat);

  if (kind === 'refined') fore.add(refinedHand(f, sx, wristLocal, dir, mats.skin));
  else if (kind === 'toy') {
    const r = f.handR * 1.05;
    const ball = new THREE.Mesh(new THREE.SphereGeometry(r, 6, 5), mats.skin);
    ball.position.copy(wristLocal).addScaledVector(dir, r * 0.55);
    fore.add(ball);
  }

  const grip = wristLocal.clone().addScaledVector(dir, kind === 'toy' ? f.handR * 0.3 : f.handR * 1.15);
  return { arm, fore, grip, dir };
}

function makeFoot(kind, f, footwear, material) {
  const g = new THREE.Group();
  let heelZ = -f.footL * 0.35, toeZ = f.footL * 0.45;
  if (kind === 'toy') {
    const ry = f.footH * 0.5, rz = f.footL * 0.46, rx = Math.max(f.ankleR * 1.2, ry);
    const zc = rz * 0.2;
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(1, 6, 5), material);
    mesh.scale.set(rx, ry, rz);
    mesh.position.set(0, -f.footH + ry, zc);
    g.add(mesh);
    heelZ = zc - rz * 0.8;
    toeZ = zc + rz * 0.8;
  } else if (kind === 'lofted') {
    const H = f.footH * 0.78;
    const Lf = f.footL;
    const W = Math.max(f.ankleR * 2.15, f.legR * 1.15);
    const z0 = -Lf * 0.32, z1 = Lf * 0.62;
    const rings = [
      { z: z0, rx: W * 0.42, ry: H * 0.55 },
      { z: THREE.MathUtils.lerp(z0, z1, 0.4), rx: W * 0.48, ry: H * 0.42 },
      { z: THREE.MathUtils.lerp(z0, z1, 0.72), rx: W * 0.34, ry: H * 0.3 },
      { z: z1, rx: W * 0.22, ry: H * 0.2 },
    ];
    // bottom of every ring sits on the ground, so the toe slopes down
    const points = rings.map((r) => new THREE.Vector3(0, -f.footH + r.ry, r.z));
    g.add(ringMesh(points, rings.map(() => 1), rings.map((r) => [r.rx, r.ry]), seg(8, 5), material));
    heelZ = z0;
    toeZ = z1;
  } else {
    const H = f.footH * 0.9;
    const Lf = f.footL;
    const W = Math.max(f.ankleR * 2.35, f.legR * 1.22);
    const geo = new THREE.BoxGeometry(W, H, Lf, 2, 1, 4);
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const y = pos.getY(i), z = pos.getZ(i);
      const t = z / (Lf / 2);
      if (y > 0 && t > -0.15) pos.setY(i, y - H * 0.65 * Math.max(0, t + 0.15) / 1.15);
      if (t > 0.25) pos.setX(i, pos.getX(i) * (1 - 0.38 * (t - 0.25) / 0.75));
    }
    geo.computeVertexNormals();
    const zc = Lf * 0.16;
    const foot = new THREE.Mesh(geo, material);
    foot.position.set(0, -f.footH + H / 2, zc);
    g.add(foot);
    // a heel block standing up at the back, so a step reads as a heel and a toe
    const heelH = H * 1.05;
    const heel = new THREE.Mesh(new THREE.BoxGeometry(W * 0.76, heelH, Lf * 0.24), material);
    heel.position.set(0, -f.footH + heelH / 2, zc - Lf * 0.4);
    g.add(heel);
    heelZ = zc - Lf / 2;
    toeZ = zc + Lf / 2;
  }
  if (footwear === 'Boots') {
    const h = f.legLen * (kind === 'toy' ? 0.14 : 0.2);
    const cuff = kind === 'lofted'
      ? loftTube([0, 0, 0], [0, h, 0], f.ankleR * 1.4, f.ankleR * 1.25, material, 3)
      : new THREE.Mesh(new THREE.CylinderGeometry(f.ankleR * (kind === 'toy' ? 1.55 : 1.4), f.ankleR * 1.3, h, kind === 'toy' ? 6 : seg(10, 6)), material);
    if (cuff.isMesh) cuff.position.y = h * 0.45;
    else cuff.position.y = 0;
    g.add(cuff);
  }
  return {
    group: g,
    sole: [new THREE.Vector3(0, -f.footH, heelZ), new THREE.Vector3(0, -f.footH, toeZ)],
  };
}

function buildLegOf(kind, f, legwear, mats, sx, footwear) {
  const leg = new THREE.Group();
  leg.name = sx < 0 ? 'legR' : 'legL';
  leg.position.set(sx * f.hx, f.hipY, 0);
  const ankle = -f.legLen + f.footH;
  const knee = -f.legLen * (kind === 'refined' ? 0.5 : 0.48);
  const cloth = legwear === 'Robe' ? mats.top : mats.legwear;
  const bare = legwear === 'Trousers' || legwear === 'Robe' ? cloth : mats.skin;
  const side = sx < 0 ? 'R' : 'L';
  const inX = -sx * f.hx * f.kneeIn;
  const hip = [0, kind === 'toy' ? f.thighR * 0.1 : f.thighTop, 0];
  const kneePt = [inX, knee, 0];

  if (kind === 'toy') {
    leg.add(new THREE.Mesh(new THREE.SphereGeometry(f.thighR * 0.7, 6, 5), cloth));
  }
  addSegment(kind, leg, hip, kneePt, f.thighR, f.kneeR, bare);

  const shin = new THREE.Group();
  shin.name = `shin${side}`;
  shin.position.set(inX, knee, 0);
  leg.add(shin);
  const calfY = (ankle - knee) * 0.32;
  const calfZ = kind === 'toy' ? 0 : -f.kneeR * 0.32;
  const ankleLocal = ankle - knee;
  if (kind === 'toy') shin.add(new THREE.Mesh(new THREE.SphereGeometry(f.kneeR * 0.82, 5, 4), bare));
  if (kind === 'lofted') {
    shin.add(loftStations([
      [0, 0, 0, f.kneeR],
      [0, calfY, calfZ, f.calfR],
      [0, ankleLocal, 0, f.ankleR],
    ], bare));
  } else if (kind === 'refined') {
    shin.add(taperBetween([0, 0, 0], [0, calfY, calfZ], f.kneeR, f.calfR, bare));
    shin.add(taperBetween([0, calfY, calfZ], [0, ankleLocal, 0], f.calfR, f.ankleR, bare));
  } else {
    addSegment(kind, shin, [0, 0, 0], [0, ankleLocal, 0], f.kneeR, f.ankleR, bare);
  }

  const footJoint = new THREE.Group();
  footJoint.name = `foot${side}`;
  footJoint.position.set(0, ankleLocal, 0);
  const foot = makeFoot(kind, f, footwear, mats.shoe);
  footJoint.add(foot.group);
  footJoint.userData.sole = foot.sole;
  shin.add(footJoint);

  if (legwear === 'Shorts' || legwear === 'Skirt') {
    const t = legwear === 'Shorts' ? 0.8 : 0.4 / 0.48;
    const end = [inX * t, knee * t, 0];
    const rEnd = THREE.MathUtils.lerp(f.thighR, f.kneeR, t);
    const a = legwear === 'Shorts' ? 1.12 : 1.06;
    const b = legwear === 'Shorts' ? 1.15 : 1.08;
    addSegment(kind, leg, hip, end, f.thighR * a, rEnd * b, mats.legwear);
  }
  return leg;
}

/** Drop the lathe shells from a torso group and keep collars, buttons, bows. */
function stripShells(group, f, mats) {
  const base = new Set([mats.top, mats.legwear, mats.skin]);
  for (const c of [...group.children]) {
    if (!c.isMesh || !base.has(c.material)) continue;
    if (Math.abs(c.position.y - f.hipY) > 1e-3) continue;
    group.remove(c);
    c.geometry?.dispose();
  }
}

/** One lathe from the pelvis up through the neck, split into cloth and skin. */
function loftedBody(f, spec, mats) {
  const L = f.torsoLen;
  const pts = [];
  const push = (x, y) => {
    if (pts.length && y <= pts.at(-1).y + 1e-5) return;
    pts.push(new THREE.Vector2(Math.max(0, x), y));
  };
  const y0 = Math.min(f.torsoBottom, -0.08 * L);
  push(0, y0);
  push(f.torsoR(Math.max(y0, f.torsoBottom)) * 0.4, y0 + 0.002);
  for (const s of f.torsoSamples) push(s.x, s.y);
  const neckTop = Math.max(L + f.neckR, (f.headY - f.R * 0.42) - f.hipY);
  const n0 = f.torsoR(L);
  for (let i = 1; i <= 3; i++) {
    const t = i / 3;
    push(THREE.MathUtils.lerp(n0, f.neckR, t), THREE.MathUtils.lerp(L, neckTop, t));
  }
  const lathe = new THREE.LatheGeometry(pts, seg(12, 8), Math.PI / 2);
  const geo = sculptTorso(lathe, f);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i);
    const d = y >= L
      ? THREE.MathUtils.lerp(f.depthAt(L * 0.98), 1, Math.min(1, (y - L) / Math.max(neckTop - L, 1e-3)))
      : f.depthAt(Math.min(L, Math.max(f.torsoBottom, y)));
    pos.setZ(i, pos.getZ(i) * d);
  }
  if (!geo.index) {
    const n = pos.count, ids = [];
    for (let i = 0; i < n; i++) ids.push(i);
    geo.setIndex(ids);
  }
  geo.computeVertexNormals();

  const index = geo.index;
  const lists = [[], [], []];
  const band = (y) => {
    if (y > L * 0.99) return 1;
    if (spec.yukata) return 2;
    if (spec.crop) return y < 0.16 * L ? 0 : y < 0.5 * L ? 1 : 2;
    return y < 0.12 * L ? 0 : 2;
  };
  for (let t = 0; t < index.count; t += 3) {
    const a = index.getX(t), b = index.getX(t + 1), c = index.getX(t + 2);
    const y = (pos.getY(a) + pos.getY(b) + pos.getY(c)) / 3;
    lists[band(y)].push(a, b, c);
  }
  const order = [];
  geo.clearGroups();
  for (let k = 0; k < 3; k++) {
    if (!lists[k].length) continue;
    geo.addGroup(order.length, lists[k].length, k);
    order.push(...lists[k]);
  }
  geo.setIndex(order);
  const mesh = new THREE.Mesh(geo, [mats.legwear, mats.skin, mats.top]);
  mesh.position.y = f.hipY;
  mesh.name = 'loft';
  return mesh;
}

function addNeck(kind, upper, f, mats) {
  if (kind === 'lofted') return;
  const neckBottom = f.shoulderY - f.torsoLen * (kind === 'toy' ? 0.02 : 0.05);
  const neckTop = f.headY - f.R * (kind === 'toy' ? 0.62 : 0.4);
  const y0 = Math.min(neckBottom, neckTop), y1 = Math.max(neckBottom, neckTop);
  const h = Math.max(0.012, y1 - y0);
  const sides = kind === 'toy' ? 6 : seg(14);
  const neck = new THREE.Mesh(
    new THREE.CylinderGeometry(f.neckR, f.neckR * (kind === 'toy' ? 1.4 : 1), h, sides),
    mats.skin,
  );
  neck.position.y = (y0 + y1) / 2;
  upper.add(neck);
}

function placeHeld(root, fore, item, grip, hold) {
  root.userData.hold = hold;
  poseHold(root, hold);
  root.updateMatrixWorld(true);
  const at = root.worldToLocal(fore.localToWorld(grip.clone()));
  if (hold.centre) at.x = 0;
  root.localToWorld(at);
  item.position.copy(fore.worldToLocal(at));
  const q = new THREE.Quaternion();
  item.quaternion.copy(fore.getWorldQuaternion(q).invert().multiply(root.getWorldQuaternion(new THREE.Quaternion())));
  fore.add(item);
}

function assemble(p, style, kind) {
  const root = new THREE.Group();
  root.name = 'human';
  root.userData.approach = kind;
  const f = measure(p);
  if (kind === 'refined') adjustRefined(f);
  else if (kind === 'toy') adjustToy(f);
  const spec = TOPS[p.top] ?? TOPS['T-shirt'];
  const mats = {
    skin: style.material('skin', SKIN_TONES[p.skin]),
    hair: style.material('hair', HAIR_COLORS[p.hairColor]),
    stubble: style.material('skin', new THREE.Color(SKIN_TONES[p.skin]).lerp(new THREE.Color(HAIR_COLORS[p.hairColor]), 0.5).getHex()),
    top: style.material('cloth', CLOTH_COLORS[p.topColor]),
    legwear: style.material('clothAlt', CLOTH_COLORS[p.legwearColor]),
    shoe: style.material('shoe', CLOTH_COLORS[p.shoeColor]),
    accent: style.material('accent', accentFor(p.topColor)),
    headwear: style.material('cloth', CLOTH_COLORS[p.headwearColor]),
    frame: style.material('accent', CLOTH_COLORS[p.accessoryColor]),
    mask: style.material('cloth', CLOTH_COLORS[p.maskColor ?? p.accessoryColor] ?? CLOTH_COLORS[p.accessoryColor]),
    lens: style.material('accent', 0x16161c),
    band: style.material('accent', CLOTH_COLORS.Black),
    outer: style.material('cloth', CLOTH_COLORS[p.outerwearColor]),
    back: style.material('cloth', CLOTH_COLORS[p.backColor]),
    backDark: style.material('cloth', new THREE.Color(CLOTH_COLORS[p.backColor]).multiplyScalar(0.72).getHex()),
    babyCloth: style.material('cloth', 0xf3e2a0),
    bodyAcc: style.material('cloth', CLOTH_COLORS[p.bodyAccessoryColor]),
    trim: style.material('accent', 0x2a2a30),
    wings: style.material('accent', p.backAccessory === 'Evil wings' ? 0x3a1424 : 0xf4f4f0),
    handItem: style.material('cloth', CLOTH_COLORS[p.handItemColor] ?? CLOTH_COLORS.Brown),
    sailorCollar: style.material('cloth', 0x2c3652),
    sailorTrim: style.material('cloth', 0xf2f2ee),
    sailorScarf: style.material('accent', 0xd8443c),
    gold: style.material('accent', 0xd9b44a),
    obi: style.material('clothAlt', CLOTH_COLORS[p.legwearColor]),
  };
  f.mats = mats;

  const spine = new THREE.Group();
  spine.name = 'spine';
  spine.position.y = f.hipY;
  root.add(spine);
  const upper = new THREE.Group();
  upper.position.y = -f.hipY;
  spine.add(upper);
  if (isElderly(p)) root.userData.stoop = 0.2;

  if (kind === 'lofted') {
    const torso = buildTorso(f, spec, mats);
    stripShells(torso, f, mats);
    torso.add(loftedBody(f, spec, mats));
    upper.add(torso);
  } else upper.add(buildTorso(f, spec, mats));

  const hasOuter = p.outerwear && p.outerwear !== 'None';
  f.hideHood = /^long(?! · (ponytail|high ponytail|braid|twin tails))/.test(p.hair ?? '');
  if (hasOuter) upper.add(buildOuterwear(f, p.outerwear, mats));
  addNeck(kind, upper, f, mats);

  const robe = spec.yukata;
  for (const sx of [-1, 1]) root.add(buildLegOf(kind, f, robe ? 'Robe' : p.legwear, mats, sx, p.footwear));
  if (robe) upper.add(buildSkirt(f, mats, { robe: true }));
  else if (p.legwear === 'Skirt') upper.add(buildSkirt(f, mats));

  let held = null;
  for (const sx of [-1, 1]) {
    const built = buildArmOf(kind, f, sx, spec, mats, hasOuter ? mats.outer : null);
    if (sx < 0) {
      const item = buildHandItem(f, p.handItem, mats.handItem, built.grip, built.dir, style);
      if (item && !item.userData.upright) built.fore.add(item);
      else if (item) held = { item, grip: built.grip, fore: built.fore };
    }
    upper.add(built.arm);
  }
  if (held && HOLD_POSES[p.handItem]) placeHeld(root, held.fore, held.item, held.grip, HOLD_POSES[p.handItem]);

  upper.add(buildBackAccessory(f, p.backAccessory, mats));
  upper.add(buildBodyAccessory(f, p.bodyAccessory, mats));

  const head = new THREE.Group();
  head.name = 'head';
  head.position.y = f.headY;
  head.add(new THREE.Mesh(headGeometry(f), mats.skin));
  f.hood = p.outerwear === 'Hoodie';
  const hair = hairUnder(p.headwear, p.hair);
  head.add(buildHair(f, hair, mats.hair, { underHat: coversHair(p.headwear) }));
  const mask = p.faceAccessory === 'Flu mask' ? 'Flu mask' : (p.mask ?? 'None');
  const eyewear = p.faceAccessory === 'Flu mask' ? 'None' : p.faceAccessory;
  if (mask === 'None') head.add(buildFacialHair(f, p.beard, p.moustache, mats.hair, mats.stubble));
  head.add(buildHeadwear(f, p.headwear, mats.headwear, hair));
  head.add(buildFaceAccessory(f, eyewear, mats));
  head.add(buildFaceAccessory(f, mask, mats));
  upper.add(head);
  if (root.userData.stoop && !root.userData.hold) poseHold(root, {});
  return root;
}

export const APPROACHES = [
  { id: 'current', label: 'Current' },
  { id: 'refined', label: 'A · Refined' },
  { id: 'toy', label: 'B · Toy' },
  { id: 'lofted', label: 'C · Lofted' },
];

/** Today's human, or one of the lab figures. `current` is human.build unchanged. */
export function buildApproach(id, p, style) {
  const dressed = human.applyRules({ ...p });
  if (id === 'current') return human.build(dressed, style);
  if (id === 'toy') return assemble(human.applyRules(toyParams(dressed)), style, 'toy');
  return assemble(dressed, style, id);
}

/** Triangles actually drawn (a shared geometry used twice counts twice). */
export function triangleCount(root) {
  let n = 0;
  root?.traverse((o) => {
    if (!o.isMesh || !o.geometry?.attributes?.position) return;
    const g = o.geometry;
    n += g.index ? g.index.count / 3 : g.attributes.position.count / 3;
  });
  return Math.round(n);
}
