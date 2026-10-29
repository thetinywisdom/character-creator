import { Matrix4, Quaternion, Vector3 } from 'three';

/** Flexion from the straight bind pose, in radians. */
export const POSE_BEND = (120 * Math.PI) / 180;

/** The fourteen ball joints. The pelvis group and the root are rig nodes, not joints. */
export const JOINT_NAMES = [
  'neck',
  'waist',
  'shoulderL',
  'shoulderR',
  'elbowL',
  'elbowR',
  'wristL',
  'wristR',
  'hipL',
  'hipR',
  'kneeL',
  'kneeR',
  'ankleL',
  'ankleR',
];

/**
 * Named clips. `speed` is metres per second for locomotion and a playback
 * rate for dances and one-shots. Pose X in the dance data is the character's
 * left; this rig's +X is the character's right, so those poses are mirrored
 * when they are applied.
 */
export const ANIMATIONS = [
  { id: 'idle', label: 'Idle', group: 'Move', speed: 0, kind: 'move', unit: 'm/s' },
  { id: 'walk', label: 'Walk', group: 'Move', speed: 1.6, kind: 'move', unit: 'm/s' },
  { id: 'run', label: 'Run', group: 'Move', speed: 6.5, kind: 'move', unit: 'm/s' },
  { id: 'jump', label: 'Jump', group: 'Move', speed: 0, kind: 'jump', unit: 'm/s' },
  { id: 'crouch', label: 'Crouch', group: 'Move', speed: 0, kind: 'crouch', unit: 'm/s' },
  { id: 'slap', label: 'Slap', group: 'Actions', speed: 1, kind: 'action', unit: '×' },
  { id: 'hit', label: 'Hit', group: 'Actions', speed: 1, kind: 'action', unit: '×', side: 1 },
  { id: 'hit-r', label: 'Hit (other side)', group: 'Actions', speed: 1, kind: 'action', unit: '×', side: -1 },
  { id: 'knockdown', label: 'Knockdown', group: 'Actions', speed: 1, kind: 'action', unit: '×', dir: 1 },
  { id: 'knockback', label: 'Fall back', group: 'Actions', speed: 1, kind: 'action', unit: '×', dir: -1 },
  { id: 'pose', label: 'Pose test', group: 'Actions', speed: 0, kind: 'pose', unit: 'm/s' },
  { id: 'robot', label: 'Robot', group: 'Dances', speed: 1, kind: 'dance', unit: '×' },
  { id: 'chicken', label: 'Chicken', group: 'Dances', speed: 1, kind: 'dance', unit: '×' },
  { id: 'disco', label: 'Disco', group: 'Dances', speed: 1, kind: 'dance', unit: '×' },
  { id: 'sprinkler', label: 'Sprinkler', group: 'Dances', speed: 1, kind: 'dance', unit: '×' },
  { id: 'flail', label: 'Flail', group: 'Dances', speed: 1, kind: 'dance', unit: '×' },
  { id: 'hula', label: 'Hula', group: 'Dances', speed: 1, kind: 'dance', unit: '×' },
  { id: 'flex', label: 'Flex', group: 'Dances', speed: 1, kind: 'dance', unit: '×' },
  { id: 'mbappe', label: 'Bad', group: 'Dances', speed: 1, kind: 'dance', unit: '×' },
];

const BY_ID = Object.fromEntries(ANIMATIONS.map((item) => [item.id, item]));
const DEG = Math.PI / 180;
const TAU = Math.PI * 2;
const BLEND = 0.2;
const WALK_TO_RUN = [3.4, 5.4];
const WALK = { duty: 0.6, lift: 0.13, bobA: 0.032, lean: 0.07, pelvis: 0.13, shoulder: 0.16, sway: 0.028, roll: 0.05, crouch: 0.03 };
const RUN = { duty: 0.34, lift: 0.46, bobA: 0.06, lean: 0.23, pelvis: 0.16, shoulder: 0.2, sway: 0.014, roll: 0.035, crouch: 0.07 };
const SRC_LEG = 0.82;
const SRC_ARM = 0.71;
const SRC_SHOULDER_X = 0.205;
const SRC_SHOULDER_Y = 1.572;
const SLAP_HIT = 0.31;
const SLAP_DUR = 0.62;
const HIT_DUR = 0.7;
const KD_FALL = 0.36;
const KD_UP = 0.55;
const KD_LIE = 1.5;
const SLAP_KEYS = [
  [0, 0, 0.1, 0.2, 0],
  [0.2, -0.75, 1.35, 1.35, -0.35],
  [0.25, -0.75, 1.4, 1.25, -0.38],
  [SLAP_HIT, 1.25, 1.45, 0.15, 0.35],
  [0.4, 1.85, 1.3, 0.3, 0.45],
  [SLAP_DUR, 0, 0.1, 0.2, 0],
];

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const fract = (v) => v - Math.floor(v);
const smooth = (a, b, v) => {
  const t = clamp((v - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
const damp = (cur, goal, rate, dt) => cur + (goal - cur) * (1 - Math.exp(-rate * dt));

function strideLength(speed, run, leg) {
  const scale = leg / SRC_LEG;
  const w = clamp(0.55 + 0.32 * speed, 0.8, 1.5) * scale;
  const r = clamp(1.5 + 0.22 * speed, 2.2, 3.3) * scale;
  return lerp(w, r, run);
}

const _v = new Vector3();
const _ground = new Vector3();
const _a = new Vector3();
const _b = new Vector3();
const _c = new Vector3();
const _d = new Vector3();
const _e = new Vector3();
const _f = new Vector3();
const _g = new Vector3();
const _h = new Vector3();
const _tip = new Vector3();
const _hold = new Vector3();
const _sample = new Vector3();
const _push = new Vector3();
const _head = new Vector3();
const _inv = new Matrix4();
const _basis = new Matrix4();
const _q = new Quaternion();
const _kq = new Quaternion();
const _kx = new Vector3(1, 0, 0);
const _kz = new Vector3(0, 0, 1);

function reset(rig) {
  rig.pelvis.rotation.order = 'YXZ';
  rig.pelvis.rotation.set(0, 0, 0);
  for (const name of JOINT_NAMES) rig[name].rotation.set(0, 0, 0);
}

/** The 120° reach. Joint angles are exact; the picker uses this as a rig check. */
function pose(rig) {
  const spread = 28 * DEG;
  const lift = 68 * DEG;
  rig.shoulderL.rotation.set(-lift, 0, -spread);
  rig.shoulderR.rotation.set(-lift, 0, spread);
  rig.elbowL.rotation.set(-POSE_BEND, 0, 0);
  rig.elbowR.rotation.set(-POSE_BEND, 0, 0);
  rig.wristL.rotation.set(0, 0, 0);
  rig.wristR.rotation.set(0, 0, 0);
  const thigh = 42 * DEG;
  rig.hipL.rotation.set(-thigh, 0, 0);
  rig.hipR.rotation.set(-thigh, 0, 0);
  rig.kneeL.rotation.set(POSE_BEND, 0, 0);
  rig.kneeR.rotation.set(POSE_BEND, 0, 0);
  const ankle = thigh - POSE_BEND;
  rig.ankleL.rotation.set(ankle, 0, 0);
  rig.ankleR.rotation.set(ankle, 0, 0);
}

function lowestFoot(root, markers) {
  root.updateMatrixWorld(true);
  let minY = Infinity;
  for (const name of ['footLHeel', 'footLToe', 'footRHeel', 'footRToe']) {
    markers[name].getWorldPosition(_ground);
    root.worldToLocal(_ground);
    if (_ground.y < minY) minY = _ground.y;
  }
  return minY;
}

/** Drop the pelvis so the lowest heel or toe sits on the root's ground plane. */
export function plantFeet(root, markers, bindPelvisY, pelvis) {
  pelvis.position.y = bindPelvisY;
  const minY = lowestFoot(root, markers);
  pelvis.position.y = bindPelvisY - minY;
}

/** Raise the pelvis when a foot has crossed the ground. Does not pull a body down. */
function liftFeet(root, markers, pelvis) {
  const minY = lowestFoot(root, markers);
  if (minY < 0) pelvis.position.y -= minY;
}

function ikLeg(rig, spec, side, dy, dz, footPitch, lean) {
  const thigh = spec.thighLength;
  const shin = spec.shinLength;
  const maxL = (thigh + shin) * 0.9995;
  const minL = Math.min(Math.abs(thigh - shin) + 0.02, maxL);
  const L = clamp(Math.hypot(dy, dz), minL, maxL);
  const cosK = clamp((thigh * thigh + shin * shin - L * L) / (2 * thigh * shin), -1, 1);
  const knee = clamp(Math.PI - Math.acos(cosK), 0, Math.PI * 0.95);
  const cosB = clamp((thigh * thigh + L * L - shin * shin) / (2 * thigh * L), -1, 1);
  const hip = Math.atan2(-dz, -dy) - Math.acos(cosB);
  rig[`hip${side}`].rotation.set(hip, 0, 0);
  rig[`knee${side}`].rotation.set(knee, 0, 0);
  rig[`ankle${side}`].rotation.set(footPitch - (lean + hip + knee), 0, 0);
}

function clearHeadSegment(a, b, center, radius, chinY) {
  for (let iter = 0; iter < 4; iter += 1) {
    let worst = 0;
    _push.set(0, 0, 0);
    for (let i = 1; i <= 6; i += 1) {
      const t = i / 6;
      _sample.lerpVectors(a, b, t);
      if (_sample.y < chinY) continue;
      const dx = _sample.x - center.x;
      const dy = _sample.y - center.y;
      const dz = _sample.z - center.z;
      const dist = Math.hypot(dx, dy, dz);
      const pen = radius - dist;
      if (pen > worst) {
        worst = pen;
        if (dist < 1e-6) _push.set(0, 0, 1);
        else _push.set(dx / dist, dy / dist, dz / dist);
      }
    }
    if (worst <= 0) break;
    b.addScaledVector(_push, worst + 0.006);
  }
}

function clearChestForward(shoulder, wrist, spec) {
  const x = spec.chestTopWidth * 0.34;
  const z = spec.chestTopDepth * 0.34 + spec.handLength * 0.28;
  const y0 = 0.02;
  const y1 = spec.chestHeight * 0.92;
  for (let iter = 0; iter < 3; iter += 1) {
    let pen = 0;
    for (let i = 1; i <= 4; i += 1) {
      _sample.lerpVectors(shoulder, wrist, i / 4);
      if (_sample.y < y0 || _sample.y > y1) continue;
      if (Math.abs(_sample.x) > x) continue;
      const need = z - _sample.z;
      if (need > pen) pen = need;
    }
    if (pen <= 0) break;
    wrist.z += pen + 0.012;
  }
}

function clearPelvisForward(shoulder, wrist, spec) {
  const x = spec.pelvisBottomWidth * 0.4;
  const z = spec.pelvisBottomDepth * 0.4 + spec.handLength * 0.2;
  const y0 = -spec.pelvisHeight;
  const y1 = 0.04;
  for (let iter = 0; iter < 2; iter += 1) {
    let pen = 0;
    for (let i = 1; i <= 4; i += 1) {
      _sample.lerpVectors(shoulder, wrist, i / 4);
      if (_sample.y < y0 || _sample.y > y1) continue;
      if (Math.abs(_sample.x) > x) continue;
      const need = z - _sample.z;
      if (need > pen) pen = need;
    }
    if (pen <= 0) break;
    wrist.z += pen + 0.012;
  }
}

/** Foundation arm point (+X = character left) → waist space on this rig. */
function mapArmPoint(out, point, sign, spec) {
  const srcX = -sign * SRC_SHOULDER_X;
  const k = (spec.upperArmLength + spec.forearmLength) / SRC_ARM;
  const ox = point[0] - srcX;
  const oy = point[1] - SRC_SHOULDER_Y;
  const oz = point[2];
  out.set(
    sign * spec.shoulderWidth / 2 - ox * k,
    spec.chestHeight * spec.shoulderT + oy * k,
    oz * k,
  );
}

function ikArm(rig, spec, side, sign, wrist, pole, roll, flex) {
  const shoulder = rig[`shoulder${side}`];
  const elbow = rig[`elbow${side}`];
  const wristJoint = rig[`wrist${side}`];
  const A = spec.upperArmLength;
  const B = spec.forearmLength;
  _a.copy(shoulder.position);
  _b.copy(wrist).sub(_a);
  const reach = _b.length();
  const dist = clamp(reach, Math.abs(A - B) + 0.02, A + B - 0.002);
  if (reach < 1e-6) _b.set(0, -1, 0);
  else _b.multiplyScalar(1 / reach);
  const cosA = clamp((A * A + dist * dist - B * B) / (2 * A * dist), -1, 1);
  const sinA = Math.sqrt(Math.max(0, 1 - cosA * cosA));
  _c.copy(pole).sub(_a);
  _c.addScaledVector(_b, -_c.dot(_b));
  if (_c.lengthSq() < 1e-8) _c.set(0, 0, -1);
  else _c.normalize();
  _d.copy(_b).multiplyScalar(cosA).addScaledVector(_c, sinA);
  _e.copy(_b).multiplyScalar(dist).addScaledVector(_d, -A);
  if (_e.lengthSq() < 1e-8) _e.copy(_c);
  else _e.normalize();
  _f.copy(_d).negate();
  _g.copy(_e).addScaledVector(_d, -_e.dot(_d));
  if (_g.lengthSq() < 1e-8) _g.copy(_c);
  else _g.normalize();
  _h.crossVectors(_f, _g);
  _basis.makeBasis(_h, _f, _g);
  shoulder.quaternion.setFromRotationMatrix(_basis);
  elbow.rotation.set(-Math.acos(clamp(_d.dot(_e), -1, 1)), 0, 0);
  wristJoint.rotation.set(flex, roll, 0);
}

function solveArm(rig, spec, side, sign, arm) {
  const shoulder = _a;
  shoulder.set(sign * spec.shoulderWidth / 2, spec.chestHeight * spec.shoulderT, 0);
  mapArmPoint(_b, arm.w, sign, spec);
  mapArmPoint(_c, arm.e, sign, spec);
  const chinY = spec.chestHeight + spec.neckLength + spec.headNeckY;
  _head.set(0, spec.chestHeight + spec.neckLength + 0.0065 * spec.headScale, 0);
  const skull = spec.headScale * 0.11 * 1.08 + 0.012;
  for (let pass = 0; pass < 2; pass += 1) {
    clearHeadSegment(shoulder, _b, _head, skull + spec.radii.elbow, chinY);
    _hold.copy(_b).sub(shoulder);
    if (_hold.lengthSq() < 1e-8) _hold.set(0, -1, 0);
    else _hold.normalize();
    _tip.copy(_b).addScaledVector(_hold, spec.handLength * 0.82);
    _hold.copy(_tip);
    clearHeadSegment(_b, _tip, _head, skull, chinY);
    _tip.sub(_hold);
    _b.add(_tip);
    clearChestForward(shoulder, _b, spec);
    clearPelvisForward(shoulder, _b, spec);
  }
  // The pole is a bend hint. Keep it out of the skull, and leave it near the ribs.
  clearHeadSegment(shoulder, _c, _head, skull, chinY);
  ikArm(rig, spec, side, sign, _b, _c, arm.r || 0, arm.f || 0);
}

function footTarget(lp, duty, stride, lift, run, ankleY, heel, toe) {
  const span = duty * stride;
  const zF = span * lerp(0.5, 0.42, run);
  const zB = zF - span;
  let z;
  let y;
  let pitch;
  if (lp < duty) {
    const t = lp / duty;
    z = lerp(zF, zB, t);
    const heelPitch = lerp(-0.35, -0.06, run) * (1 - smooth(0, 0.18, t));
    const toePitch = lerp(0.75, 0.95, run) * smooth(0.62, 1, t);
    pitch = heelPitch + toePitch;
    y = ankleY + (pitch < 0 ? Math.sin(-pitch) * heel : Math.sin(pitch) * toe);
  } else {
    const t = (lp - duty) / (1 - duty);
    const e = run > 0.5 ? smooth(0, 1, t ** 1.25) : smooth(0, 1, t);
    z = lerp(zB, zF, e) + Math.sin(Math.PI * t) * 0.04 * run;
    const peak = Math.sin(Math.PI * t ** lerp(0.75, 0.6, run)) ** 1.3;
    y = ankleY + lift * peak;
    pitch = lerp(lerp(0.75, 0.95, run), lerp(-0.35, -0.06, run), smooth(0.05, 0.9, t)) + 0.25 * run * peak;
  }
  return { z, y, pitch };
}

function createJumpMotor() {
  return {
    gravity: 34,
    anticipation: 0.08,
    y: 0,
    vy: 0,
    grounded: true,
    antic: -1,
    justLanded: false,
    impact: 0,
    v0: 1,
    height: -1,
    sync(bodyHeight) {
      const height = 1.1 * (bodyHeight / 1.8);
      if (height === this.height) return;
      this.height = height;
      this.v0 = Math.sqrt(2 * this.gravity * height);
    },
    reset() {
      this.y = 0;
      this.vy = 0;
      this.grounded = true;
      this.antic = -1;
      this.justLanded = false;
      this.impact = 0;
    },
    get crouch() {
      return this.antic >= 0 ? smooth(0, 1, this.antic / this.anticipation) : 0;
    },
    jump() {
      if (!this.grounded || this.antic >= 0) return;
      this.antic = 0;
    },
    step(dt) {
      this.justLanded = false;
      this.impact = 0;
      if (this.antic >= 0) {
        this.antic += dt;
        if (this.antic >= this.anticipation) {
          this.antic = -1;
          this.vy = this.v0;
          this.grounded = false;
          this.y = Math.max(this.y, 0);
        }
      }
      if (!this.grounded) {
        this.vy -= this.gravity * dt;
        this.y += this.vy * dt;
        if (this.y <= 0 && this.vy <= 0) {
          this.impact = -this.vy;
          this.y = 0;
          this.vy = 0;
          this.grounded = true;
          this.justLanded = true;
        } else if (this.y < 0) this.y = 0;
      } else this.y = damp(this.y, 0, 20, dt);
    },
  };
}

const arm = (w, e, r = 0, f = 0) => ({ w, e, r, f });
const qstep = (t, rate, n) => Math.floor(t * rate) % n;
const mirror = (a) => ({
  w: [-a.w[0], a.w[1], a.w[2]],
  e: [-a.e[0], a.e[1], a.e[2]],
  r: -(a.r || 0),
  f: a.f || 0,
});

function lerpPose(a, b, u) {
  if (typeof a === 'number') return a + ((typeof b === 'number' ? b : a) - a) * u;
  if (Array.isArray(a)) return a.map((v, i) => lerpPose(v, b ? b[i] : v, u));
  const o = {};
  for (const k in a) o[k] = b && k in b ? lerpPose(a[k], b[k], u) : a[k];
  return o;
}

const clonePose = (p) => JSON.parse(JSON.stringify(p));

function sampleKeys(keys, t) {
  if (t <= keys[0][0]) return clonePose(keys[0][1]);
  let i = 0;
  while (i < keys.length - 1 && t > keys[i + 1][0]) i += 1;
  if (i >= keys.length - 1) return clonePose(keys[keys.length - 1][1]);
  const [t0, a] = keys[i];
  const [t1, b, ease] = keys[i + 1];
  let u = clamp((t - t0) / (t1 - t0), 0, 1);
  u = ease === 'lin' ? u : ease === 'in' ? u * u : ease === 'out' ? 1 - (1 - u) * (1 - u) : u * u * (3 - 2 * u);
  return lerpPose(a, b, u);
}

const dancePose = (o = {}) => ({
  dip: 0, lean: 0, yaw: 0, roll: 0, hx: 0, hz: 0, ty: 0, stance: 0, fz: [0, 0], head: [0, 0, 0],
  L: ARM.restL, R: mirror(ARM.restL), ...o,
});

const ARM = {
  restL: { w: [0.245, 0.93, 0.04], e: [0.33, 1.25, -0.15], r: 0, f: 0 },
  looseL: { w: [0.27, 0.95, 0.07], e: [0.36, 1.25, -0.1], r: 0, f: 0.1 },
  templeL: { w: [0.125, 1.85, 0.075], e: [0.6, 1.74, 0.02], r: 0.4, f: 0.25 },
  crossR: { w: [0.13, 1.37, 0.23], e: [-0.34, 1.3, 0.12], r: -0.6, f: 0 },
  crossL: { w: [-0.13, 1.33, 0.24], e: [0.34, 1.27, 0.12], r: 0.6, f: 0 },
  outR: { w: [-0.52, 1.08, 0.16], e: [-0.45, 1.35, -0.1], r: 0, f: 0 },
  highR: { w: [-0.12, 2.27, 0.1], e: [-0.45, 1.95, 0.05], r: 0, f: 0 },
  midR: { w: [-0.02, 1.48, 0.36], e: [-0.4, 1.38, 0.12], r: -0.4, f: 0 },
  coreR: { w: [0.03, 1.21, 0.235], e: [-0.26, 1.2, -0.02], r: -1.25, f: 0 },
  hangL: { w: [0.255, 0.9, 0.03], e: [0.32, 1.2, -0.2], r: 0, f: 0 },
  heartL: { w: [0.07, 1.44, 0.3], e: [0.36, 1.3, 0.1], r: 0.9, f: 0.2 },
  clapOL: { w: [0.17, 1.36, 0.31], e: [0.42, 1.22, 0.02], r: 0.9, f: 0 },
  clapCL: { w: [0.04, 1.39, 0.33], e: [0.42, 1.22, 0.02], r: 0.9, f: 0 },
  flingL: { w: [0.86, 1.52, 0.1], e: [0.55, 1.62, -0.25], r: 0, f: 0 },
  chestR: { w: [0.02, 1.4, 0.24], e: [-0.36, 1.3, 0.05], r: -0.5, f: 0 },
  wL: { w: [0.5, 1.9, 0.06], e: [0.62, 1.32, -0.02], r: 0, f: 0.3 },
};

const MB = {
  base: dancePose(),
  temple: dancePose({ dip: 0.02, head: [0.06, 0, 0], L: ARM.templeL, R: mirror(ARM.templeL) }),
  drop: dancePose({ dip: 0.05, yaw: 0.3, ty: 0.12, head: [0.02, -0.25, 0], L: ARM.looseL, R: mirror(ARM.looseL) }),
  crossR: dancePose({ dip: 0.04, yaw: 0.18, ty: 0.18, head: [0.0, -0.1, 0], L: ARM.looseL, R: ARM.crossR }),
  crossL: dancePose({ dip: 0.04, yaw: -0.05, ty: -0.2, head: [0.0, 0.1, 0], L: ARM.crossL, R: ARM.outR }),
  high: dancePose({ dip: 0.0, lean: -0.06, yaw: 0.08, head: [-0.22, -0.1, 0], L: ARM.looseL, R: ARM.highR }),
  mid: dancePose({ dip: 0.05, lean: 0.08, head: [0.08, 0, 0], L: ARM.looseL, R: ARM.midR }),
  core: dancePose({ dip: 0.05, lean: 0.1, hz: -0.02, head: [-0.12, 0.1, 0.1], L: ARM.hangL, R: ARM.coreR }),
  heart: dancePose({ dip: 0.02, lean: 0.0, head: [-0.06, 0, 0.14], L: ARM.heartL, R: mirror(ARM.heartL) }),
  clapO: dancePose({ dip: 0.03, head: [0.0, 0, 0], L: ARM.clapOL, R: mirror(ARM.clapOL) }),
  clapC: dancePose({ dip: 0.06, lean: 0.06, head: [0.08, 0, 0], L: ARM.clapCL, R: mirror(ARM.clapCL) }),
};

const MB_BEAT0 = 4.25;
const MB_BEAT = 1.7;
const MB_BEATS = 3;
const MB_FL = 0.6;
const MB_PR = 0.85;
const MB_HZ = 7;
const MB_CORE_END = MB_BEAT0 + MB_BEAT * MB_BEATS;
const MB_OUT = MB_CORE_END - 8.35;
const MB_KEYS = [
  [0, MB.base], [0.55, MB.temple], [1.1, MB.temple],
  [1.5, MB.drop], [1.8, MB.crossR, 'out'], [2.1, MB.crossL, 'out'], [2.45, MB.crossR, 'out'], [2.65, MB.crossR],
  [3.05, MB.high], [3.25, MB.high], [3.6, MB.mid, 'in'],
  [3.95, MB.core], [MB_CORE_END + 0.1, MB.core],
  [8.75 + MB_OUT, MB.heart], [9.3 + MB_OUT, MB.heart],
  [9.45 + MB_OUT, MB.clapO], [9.65 + MB_OUT, MB.clapC, 'in'], [9.9 + MB_OUT, MB.clapO], [10.15 + MB_OUT, MB.clapC, 'in'], [10.9 + MB_OUT, MB.base],
];

function mbPhrase(x) {
  const flE = smooth(0, 0.08, x) * (1 - smooth(MB_FL - 0.1, MB_FL, x));
  const fl = x < MB_FL ? Math.sin(x * TAU * MB_HZ) * flE : 0;
  const pr = x < MB_FL ? 0 : x < MB_FL + MB_PR ? smooth(MB_FL, MB_FL + MB_PR, x) : 1 - smooth(MB_FL + MB_PR, MB_BEAT, x);
  return { fl, flE, pr };
}

const HULA_W = TAU * 1.75;
const HULA_DUR = 7.4;
const SIL = (L, R, o = {}) => dancePose({ L, R, ...o });

const DANCES = {
  mbappe: {
    dur: 10.9 + MB_OUT,
    blendIn: 0.35,
    blendOut: 0.7,
    pose(t) {
      const p = sampleKeys(MB_KEYS, t);
      if (t > 0.5 && t < 1.2) p.head[0] += 0.05 * Math.sin((t - 0.5) * 18);
      const bt = t - MB_BEAT0;
      if (bt >= 0 && t < MB_CORE_END) {
        const x = bt - Math.floor(bt / MB_BEAT) * MB_BEAT;
        const { fl, flE, pr } = mbPhrase(x);
        p.R.w[1] += 0.03 * flE + 0.1 * fl;
        p.R.e[1] += 0.035 * fl;
        p.R.r += 0.35 * fl;
        p.dip += 0.05 * flE + 0.012 * fl;
        p.ty += 0.03 * fl;
        p.head[0] += 0.05 * flE;
        p.R.w[1] -= 0.11 * pr;
        p.R.w[2] += 0.03 * pr;
        p.R.e[1] -= 0.05 * pr;
        p.R.e[2] -= 0.05 * pr;
        p.lean -= 0.26 * pr;
        p.dip -= 0.06 * pr;
        p.hz += 0.03 * pr;
        p.head[0] -= 0.32 * pr;
        p.head[1] += 0.06 * pr;
        p.L.w[1] += 0.06 * pr;
        p.L.w[2] -= 0.06 * pr;
        p.L.e[1] += 0.06 * pr;
        p.L.e[2] -= 0.06 * pr;
        p.R.e[2] -= 0.04 * pr;
      }
      return p;
    },
  },
  hula: {
    dur: HULA_DUR,
    blendIn: 0.45,
    blendOut: 0.6,
    pose(t) {
      const ph = HULA_W * t;
      const e = smooth(0.1, 0.8, t) * (1 - smooth(HULA_DUR - 0.9, HULA_DUR - 0.25, t));
      const c = Math.cos(ph);
      const s = Math.sin(ph);
      const armB = smooth(2.5, 3.0, t);
      const L = lerpPose(ARM.flingL, ARM.wL, armB);
      const R = lerpPose(ARM.chestR, mirror(ARM.wL), armB);
      const bounce = Math.sin(ph * 2) * 0.045 * e * armB;
      L.w[1] += bounce;
      R.w[1] += bounce;
      L.e[1] += bounce * 0.6;
      R.e[1] += bounce * 0.6;
      L.w[1] += 0.04 * s * e * (1 - armB);
      const roll = -0.12 * c * e;
      const lean = 0.03 + 0.06 * s * e;
      return {
        dip: 0.17 + 0.025 * Math.sin(ph * 2) * e,
        lean,
        yaw: 0.1 * s * e,
        roll,
        hx: 0.085 * c * e,
        hz: 0.065 * s * e,
        ty: -0.12 * s * e,
        stance: 0.13,
        fz: [0.03, 0.03],
        head: [-lean * 0.9 + 0.07 * Math.sin(ph * 2) * e, 0.08 * s * e, -roll * 1.7],
        L,
        R,
      };
    },
  },
  flail: {
    dur: 6.6,
    blendIn: 0.2,
    blendOut: 0.35,
    pose(t) {
      const a = t * 10.5;
      const b = t * 8.3 + 1.7;
      return SIL(
        arm([0.42 + 0.3 * Math.sin(a), 1.55 + 0.6 * Math.sin(a * 1.3), 0.12 + 0.2 * Math.cos(a)], [0.6, 1.5, -0.2], Math.sin(a) * 0.8),
        arm([-0.42 - 0.3 * Math.sin(b), 1.55 + 0.6 * Math.cos(b * 1.1), 0.12 + 0.2 * Math.sin(b)], [-0.6, 1.5, -0.2], -Math.cos(b) * 0.8),
        {
          dip: 0.07 + 0.06 * Math.abs(Math.sin(t * 7.5)),
          yaw: 0.4 * Math.sin(t * 3.7),
          roll: 0.12 * Math.sin(t * 5.1),
          lean: 0.06 * Math.sin(t * 7.5),
          stance: 0.12,
          fz: [0.05 * Math.sin(t * 7.5), -0.05 * Math.sin(t * 7.5)],
          head: [0.3 * Math.sin(t * 15), 0.25 * Math.sin(t * 3.7), 0.2 * Math.sin(t * 6)],
        },
      );
    },
  },
  robot: {
    dur: 6.6,
    blendIn: 0.15,
    blendOut: 0.3,
    pose(t) {
      const k = qstep(t, 2.6, 4);
      const up = arm([0.32, 1.95, 0.12], [0.45, 1.55, -0.05], 0, 0);
      const out = arm([0.3, 1.42, 0.38], [0.42, 1.42, -0.12], 0, 0);
      const dn = arm([0.32, 1.05, 0.34], [0.42, 1.42, -0.1], 0, 0);
      const L = [up, out, dn, out][k];
      const R = mirror([out, up, out, dn][k]);
      return SIL(L, R, {
        dip: 0.04 + (k % 2) * 0.04,
        ty: [0.45, 0, -0.45, 0][k],
        head: [0, [-0.5, 0, 0.5, 0][k], 0],
        stance: 0.1,
      });
    },
  },
  sprinkler: {
    dur: 6.6,
    blendIn: 0.2,
    blendOut: 0.35,
    pose(t) {
      const c = (t * 0.9) % 1;
      const ratchet = c < 0.8 ? Math.floor(c / 0.8 * 6) / 6 : 1 - (c - 0.8) / 0.2;
      return SIL(
        arm([0.32, 1.7, -0.18], [0.58, 1.68, -0.02], 0.3, 0.2),
        arm([-0.55, 1.48, 0.42], [-0.45, 1.6, 0.0], 0, 0),
        { dip: 0.08, yaw: -0.7 + 1.4 * ratchet, ty: 0.1, stance: 0.14, head: [0.05, 0.15, 0], fz: [0.08, -0.06] },
      );
    },
  },
  chicken: {
    dur: 6.6,
    blendIn: 0.2,
    blendOut: 0.35,
    pose(t) {
      const fl = Math.sin(t * 15);
      const pk = Math.max(0, Math.sin(t * 6.5));
      return SIL(
        arm([0.14, 1.5, 0.08], [0.55 + 0.25 * fl, 1.42 + 0.1 * fl, -0.2], 0.5, 0.4),
        arm([-0.14, 1.5, 0.08], [-0.55 - 0.25 * fl, 1.42 + 0.1 * fl, -0.2], -0.5, 0.4),
        {
          dip: 0.13 + 0.03 * Math.abs(fl),
          lean: 0.15 + 0.15 * pk,
          hz: 0.05 * pk,
          head: [0.45 * pk - 0.15, 0, 0],
          stance: 0.16,
          fz: [0.05 * Math.sin(t * 3.2), -0.05 * Math.sin(t * 3.2)],
        },
      );
    },
  },
  disco: {
    dur: 6.6,
    blendIn: 0.2,
    blendOut: 0.35,
    pose(t) {
      const u = (Math.sin(t * 4.6) + 1) / 2;
      const s = Math.sin(t * 4.6);
      const R = arm([-0.4 + 0.16 * (1 - u), 1.12 + 1.16 * u, 0.2], [-0.58, 1.72, 0.14], 0, 0);
      return SIL(
        arm([0.38, 1.02, 0.2], [0.55, 1.22, 0.12], 0, 0.25),
        R,
        {
          dip: 0.06 + 0.04 * Math.abs(s),
          hx: 0.06 * s,
          roll: -0.1 * s,
          ty: -0.25 * s,
          yaw: 0.15 * s,
          head: [-0.2 * u + 0.05, -0.3 * u, 0.1 * s],
          stance: 0.12,
        },
      );
    },
  },
  flex: {
    dur: 1.7,
    blendIn: 0.12,
    blendOut: 0.3,
    pose(t) {
      const b = Math.abs(Math.sin(t * 7)) * 0.04;
      const f = 0.9 + 0.3 * Math.sin(t * 7);
      return SIL(
        arm([0.44, 1.78 + b, 0.1], [0.58, 1.48, 0.02], 0.3, f),
        arm([-0.44, 1.78 + b, 0.1], [-0.58, 1.48, 0.02], -0.3, f),
        { lean: -0.12, dip: 0.05 - b, head: [-0.15, 0.2 * Math.sin(t * 3.5), 0], stance: 0.16 },
      );
    },
  },
};

function applyDance(poseIn, ctx) {
  const { rig, spec, bindPelvisY } = ctx;
  const pelvis = rig.pelvis;
  const legScale = (spec.thighLength + spec.shinLength) / SRC_LEG;
  const lean = poseIn.lean || 0;
  const yaw = poseIn.yaw || 0;
  const roll = poseIn.roll || 0;
  const ty = poseIn.ty || 0;
  const dip = (poseIn.dip || 0) * legScale;
  pelvis.rotation.order = 'YXZ';
  pelvis.rotation.set(lean, -yaw, -roll);
  pelvis.position.set(-(poseIn.hx || 0) * legScale, bindPelvisY - dip, (poseIn.hz || 0) * legScale);
  pelvis.updateMatrix();
  _inv.copy(pelvis.matrix).invert();
  const fz = poseIn.fz || [0, 0];
  const stance = (poseIn.stance || 0) * legScale;
  const ankleY = spec.layout.ankleY;
  const reach = Math.max(0.3, spec.thighLength + spec.shinLength - dip);
  const spread = Math.asin(clamp(stance / reach, -0.6, 0.6));
  for (const [side, sign, i] of [['L', -1, 0], ['R', 1, 1]]) {
    _v.set(sign * spec.hipWidth / 2, ankleY, (fz[i] || 0) * legScale).applyMatrix4(_inv);
    ikLeg(rig, spec, side, _v.y, _v.z, 0, lean);
    rig[`hip${side}`].rotation.z = sign * spread;
    rig[`ankle${side}`].rotation.z = -sign * spread;
  }
  rig.waist.rotation.set(0, -ty, 0);
  const head = poseIn.head || [0, 0, 0];
  const worldYaw = -(yaw + (head[1] || 0) + ty * 0.5);
  rig.neck.rotation.set(head[0] || 0, worldYaw - pelvis.rotation.y - rig.waist.rotation.y, -(head[2] || 0));
  if (poseIn.L) solveArm(rig, spec, 'L', -1, poseIn.L);
  if (poseIn.R) solveArm(rig, spec, 'R', 1, poseIn.R);
}

function actionDuration(id) {
  if (id === 'slap') return SLAP_DUR;
  if (id === 'hit' || id === 'hit-r') return HIT_DUR;
  return KD_FALL + KD_LIE + KD_UP;
}

function copyPose(storeQ, storePQ, storePP, rig) {
  for (let i = 0; i < JOINT_NAMES.length; i += 1) storeQ[i].copy(rig[JOINT_NAMES[i]].quaternion);
  storePQ.copy(rig.pelvis.quaternion);
  storePP.copy(rig.pelvis.position);
}

function blendPose(fromQ, fromPQ, fromPP, rig, u) {
  for (let i = 0; i < JOINT_NAMES.length; i += 1) {
    const joint = rig[JOINT_NAMES[i]];
    _q.copy(joint.quaternion);
    joint.quaternion.copy(fromQ[i]).slerp(_q, u);
  }
  _q.copy(rig.pelvis.quaternion);
  rig.pelvis.quaternion.copy(fromPQ).slerp(_q, u);
  _v.copy(rig.pelvis.position);
  rig.pelvis.position.copy(fromPP).lerp(_v, u);
}

/**
 * @returns {{ step: (ctx: object, dt: number, state?: string | object) => void }}
 */
export function createMotion() {
  const motor = createJumpMotor();
  const baseQ = JOINT_NAMES.map(() => new Quaternion());
  const fadeQ = JOINT_NAMES.map(() => new Quaternion());
  const basePQ = new Quaternion();
  const fadePQ = new Quaternion();
  const basePP = new Vector3();
  const fadePP = new Vector3();
  const motion = {
    anim: 'idle',
    solved: false,
    fading: false,
    fadeT: 0,
    t: 0,
    clipT: 0,
    phase: 0,
    walk: 0,
    run: 0,
    air: 0,
    crouch: 0,
    lean: 0,
    leanZ: 0,
    land: 0,
    landV: 0,
    settle: 0,
    settleV: 0,
    prevSpeed: 0,
    wasGrounded: true,
    prevVy: 0,
    jumpWait: 0,
    droveRoot: false,
    kdRoll: 0.18,
  };

  function step(ctx, dt, state) {
    const { rig, root, markers, bindPelvisY, spec } = ctx;
    const pelvis = rig.pelvis;
    let requested = null;
    let freeze = false;
    let time = null;
    let speedIn = null;
    let turn = 0;
    let groundedIn = null;
    let vyIn = null;
    let crouchIn = null;
    let sideIn = null;
    let dirIn = null;
    if (typeof state === 'string') requested = state;
    else if (state && typeof state === 'object') {
      if (state.anim) requested = state.anim;
      else if (state.mode) requested = state.mode;
      if (state.freeze) freeze = true;
      if (typeof state.time === 'number') time = state.time;
      if (typeof state.speed === 'number') speedIn = state.speed;
      if (typeof state.turn === 'number') turn = state.turn;
      if (typeof state.grounded === 'boolean') groundedIn = state.grounded;
      if (typeof state.vy === 'number') vyIn = state.vy;
      if (typeof state.side === 'number') sideIn = state.side;
      if (typeof state.dir === 'number') dirIn = state.dir;
      if (typeof state.crouch === 'number') crouchIn = state.crouch;
    }
    let id = motion.anim;
    if (requested) id = BY_ID[requested] ? requested : 'idle';
    const info = BY_ID[id] || BY_ID.idle;
    const changed = id !== motion.anim || !motion.solved;
    const snap = dt === 0 || freeze;
    if (changed && motion.solved && !snap) {
      copyPose(fadeQ, fadePQ, fadePP, rig);
      motion.fading = true;
      motion.fadeT = 0;
    }
    if (snap) motion.fading = false;
    if (changed) {
      motion.clipT = 0;
      motion.jumpWait = 0;
      motor.reset();
      motion.kdRoll = (info.dir || 1) >= 0 ? 0.18 : -0.18;
    }
    motion.anim = id;
    motion.solved = true;

    const playback = info.kind === 'dance' || info.kind === 'action'
      ? Math.max(0, speedIn != null ? speedIn : info.speed)
      : 1;
    if (time != null) {
      motion.t = time;
      motion.clipT = time;
    }
    if (!freeze) {
      const clock = info.kind === 'dance' || info.kind === 'action' ? playback : 1;
      motion.t += dt * clock;
      motion.clipT += dt * playback;
    }

    if (info.kind === 'pose') {
      reset(rig);
      pose(rig);
      pelvis.position.set(0, bindPelvisY, 0);
      if (motion.fading && !snap) {
        motion.fadeT += dt;
        const u = smooth(0, 1, motion.fadeT / BLEND);
        blendPose(fadeQ, fadePQ, fadePP, rig, u);
        if (motion.fadeT >= BLEND) motion.fading = false;
      }
      separateLimbs(rig, spec);
      plantFeet(root, markers, bindPelvisY, pelvis);
      if (motion.droveRoot) {
        root.position.y = 0;
        motion.droveRoot = false;
      }
      return;
    }

    let locoSpeed = 0;
    if (info.kind === 'move' || info.kind === 'jump' || info.kind === 'crouch') {
      locoSpeed = Math.max(0, speedIn != null ? speedIn : info.speed);
    }
    let grounded = groundedIn != null ? groundedIn : true;
    let vy = vyIn || 0;
    let crouchCmd = crouchIn != null ? crouchIn : 0;
    let impact = 0;
    const driveJump = info.kind === 'jump' && groundedIn == null && vyIn == null;
    if (info.kind === 'crouch' && crouchIn == null) crouchCmd = 1;
    if (driveJump) {
      motor.sync(spec.height);
      if (motor.grounded && motor.antic < 0 && motion.jumpWait <= 0 && dt > 0) motor.jump();
      motor.step(dt);
      if (motor.justLanded) motion.jumpWait = 0.4;
      if (dt > 0) motion.jumpWait = Math.max(0, motion.jumpWait - dt);
      grounded = motor.grounded;
      vy = motor.vy;
      crouchCmd = Math.max(crouchCmd, motor.crouch);
      impact = motor.impact;
      root.position.y = motor.y;
      motion.droveRoot = true;
    } else if (motion.droveRoot) {
      root.position.y = 0;
      motion.droveRoot = false;
    }

    const wGoal = smooth(0.05, 0.9, locoSpeed);
    const rGoal = smooth(WALK_TO_RUN[0], WALK_TO_RUN[1], locoSpeed);
    if (dt === 0) {
      motion.walk = wGoal;
      motion.run = rGoal;
      motion.air = grounded ? 0 : 1;
      motion.crouch = crouchCmd;
    } else {
      motion.walk = damp(motion.walk, wGoal, 7, dt);
      motion.run = damp(motion.run, rGoal, 6, dt);
      motion.air = damp(motion.air, grounded ? 0 : 1, grounded ? 30 : 18, dt);
      motion.crouch = damp(motion.crouch, crouchCmd, 70, dt);
    }
    const decel = Math.max(0, motion.prevSpeed - locoSpeed);
    motion.prevSpeed = locoSpeed;
    if (grounded && dt > 0) motion.settleV += decel * 0.9;
    if (impact > 0) motion.landV += clamp(impact, 2, 12) * 0.55;
    else if (grounded && !motion.wasGrounded) motion.landV += clamp(-motion.prevVy, 2, 12) * 0.55;
    motion.wasGrounded = grounded;
    motion.prevVy = vy;
    for (const [x, v, kk, c] of [['settle', 'settleV', 140, 14], ['land', 'landV', 170, 15]]) {
      motion[v] += (-kk * motion[x] - c * motion[v]) * dt;
      motion[x] += motion[v] * dt;
    }

    const w = motion.walk * (1 - motion.air);
    const r = motion.run;
    const G = {};
    for (const key in WALK) G[key] = lerp(WALK[key], RUN[key], r);
    const leg = spec.thighLength + spec.shinLength;
    const legScale = leg / SRC_LEG;
    const S = Math.max(0.2, strideLength(Math.max(locoSpeed, 0.6), r, leg));
    if (grounded) {
      if (time != null) motion.phase = fract(locoSpeed * motion.t / S);
      else if (!freeze) motion.phase = fract(motion.phase + locoSpeed * dt / S);
    }
    const p = motion.phase;
    const ex = 1 + 0.25 * r;
    const bobPh = lerp(0.07, G.duty / 2, r);
    const breathe = Math.sin(motion.t * 1.7);
    const bob = (-G.bobA * Math.cos(TAU * 2 * (p - bobPh)) * w - G.crouch * w) * legScale;
    const squash = clamp(motion.land, -0.2, 1);
    const crouchY = (Math.max(motion.crouch, 0) * 0.26 + squash * 0.17 + motion.settle * 0.05) * legScale;
    const leanGoal = G.lean * w * smooth(0.2, 2.5, locoSpeed) + motion.crouch * 0.3 + squash * 0.25
      - motion.settle * 0.15 + motion.air * (vy > 0 ? 0.08 : -0.02) * motion.walk;
    const turnLean = clamp(-turn * locoSpeed * 0.012, -0.22, 0.22);
    if (dt === 0) {
      motion.lean = leanGoal;
      motion.leanZ = turnLean * (1 - motion.air);
    } else {
      motion.lean = damp(motion.lean, leanGoal, 10, dt);
      motion.leanZ = damp(motion.leanZ, turnLean * (1 - motion.air), 6, dt);
    }

    const c1 = Math.cos(TAU * p);
    const pelvisYawTheir = -G.pelvis * c1 * w;
    const tYaw = G.shoulder * c1 * w * ex - pelvisYawTheir;
    reset(rig);
    pelvis.rotation.order = 'YXZ';
    pelvis.rotation.set(
      motion.lean,
      -pelvisYawTheir,
      -G.roll * Math.sin(TAU * p) * w + motion.leanZ,
    );
    pelvis.position.set(
      -G.sway * Math.sin(TAU * p) * w * legScale,
      bindPelvisY + bob - crouchY + breathe * 0.002 * (1 - w) * legScale,
      0,
    );
    pelvis.updateMatrix();
    _inv.copy(pelvis.matrix).invert();

    const ankleY = spec.layout.ankleY;
    const heel = Math.abs(spec.footHeel);
    const toe = Math.max(0.02, spec.footToe);
    for (const [side, sign, off] of [['L', -1, 0], ['R', 1, 0.5]]) {
      const lp = (p + off) % 1;
      const ft = footTarget(lp, G.duty, S, G.lift * ex * legScale, r, ankleY, heel, toe);
      const tuck = vy > 0 ? 0.42 : clamp(0.42 + vy * 0.05, 0.08, 0.42);
      let z = lerp(0, ft.z, w);
      let y = lerp(ankleY, ft.y, w);
      let pitch = lerp(0, ft.pitch, w);
      z = lerp(z, sign * -0.06 * motion.walk + 0.05, motion.air);
      y = lerp(y, ankleY + tuck * legScale, motion.air);
      pitch = lerp(pitch, 0.35, motion.air);
      _v.set(sign * spec.hipWidth / 2, y, z).applyMatrix4(_inv);
      ikLeg(rig, spec, side, _v.y, _v.z, pitch, motion.lean);
    }

    rig.waist.rotation.set(breathe * 0.012 * (1 - w), -tYaw, 0);
    for (const [side, sign, off] of [['L', -1, 0.5], ['R', 1, 0]]) {
      const sw = Math.cos(TAU * (p + off - 0.04 * (1 - r)));
      const fw = Math.max(0, sw);
      const bk = Math.max(0, -sw);
      const walkSh = -(fw * 0.55 - bk * 0.42) * ex;
      const runSh = -(fw * 0.85 - bk * 0.75) + 0.1;
      let shX = lerp(walkSh, runSh, r) * w + breathe * 0.015 * (1 - w);
      let el = lerp(0.18 + bk * 0.32 + fw * 0.22, 1.45 + fw * 0.2 - bk * 0.15, r) * w;
      let abd = 0.06 + 0.06 * w + r * 0.08 * w + Math.sin(motion.t * 0.9 + -sign) * 0.012 * (1 - w);
      shX = shX * (1 - motion.crouch) + motion.crouch * 0.75;
      const up = motion.air * (vy > 0 ? 1 : clamp(0.6 + vy * 0.04, 0.2, 0.6));
      shX = lerp(shX, -2.1, up * 0.8);
      abd = lerp(abd, 0.95, motion.air);
      el = lerp(el, 0.35, motion.air);
      shX += squash * 0.5;
      // Positive Z on the character's right (+X) is outward. Their left was +X.
      rig[`shoulder${side}`].rotation.set(shX, 0, sign * abd);
      rig[`elbow${side}`].rotation.set(-el, 0, 0);
      rig[`wrist${side}`].rotation.set(fw * 0.35 * w * (1 - r), 0, sign * 0.1 * w);
    }
    const look = Math.sin(motion.t * 0.37) * 0.35 + Math.sin(motion.t * 0.83) * 0.12;
    const idleMix = (1 - motion.walk) * (1 - motion.air);
    const headX = -motion.lean * 0.6 + 0.03 * Math.sin(motion.t * 0.5) * idleMix + motion.air * (vy > 0 ? -0.1 : 0.12);
    const worldYaw = -(look * idleMix);
    rig.neck.rotation.set(headX, worldYaw - pelvis.rotation.y - rig.waist.rotation.y, 0);

    let plant = grounded;
    if (info.kind === 'dance') {
      const dance = DANCES[id];
      const local = dance.dur > 0 ? motion.clipT % dance.dur : 0;
      let env = smooth(0, dance.blendIn, local) * (1 - smooth(dance.dur - dance.blendOut, dance.dur, local));
      if (env >= 0.999) applyDance(dance.pose(local), { rig, spec, bindPelvisY });
      else if (env > 0.001) {
        copyPose(baseQ, basePQ, basePP, rig);
        applyDance(dance.pose(local), { rig, spec, bindPelvisY });
        blendPose(baseQ, basePQ, basePP, rig, env);
      }
    } else if (info.kind === 'action') {
      const dur = actionDuration(id);
      const local = dur > 0 ? motion.clipT % dur : 0;
      if (id === 'slap') applySlap(rig, local, tYaw);
      else if (id === 'hit' || id === 'hit-r') applyHit(rig, local, sideIn != null ? sideIn : (info.side || 1));
      else {
        plant = false;
        applyKnockdown(rig, spec, local, dirIn != null ? dirIn : (info.dir || 1), motion.kdRoll);
      }
    }

    if (motion.fading && !snap) {
      motion.fadeT += dt;
      const u = smooth(0, 1, motion.fadeT / BLEND);
      blendPose(fadeQ, fadePQ, fadePP, rig, u);
      if (motion.fadeT >= BLEND) motion.fading = false;
    }
    separateLimbs(rig, spec);
    if (plant) plantFeet(root, markers, bindPelvisY, pelvis);
    else liftFeet(root, markers, pelvis);
  }

  return { step };
}

function applySlap(rig, t, tYaw) {
  let i = 0;
  while (i < SLAP_KEYS.length - 2 && t > SLAP_KEYS[i + 1][0]) i += 1;
  const k0 = SLAP_KEYS[i];
  const k1 = SLAP_KEYS[i + 1];
  let u = clamp((t - k0[0]) / (k1[0] - k0[0]), 0, 1);
  u = i === 2 ? u * u : u * u * (3 - 2 * u);
  const v = (j) => lerp(k0[j], k1[j], u);
  const fade = 1 - smooth(0.42, SLAP_DUR, t);
  const tw = v(4);
  const torsoTheir = lerp(tYaw, tw, fade);
  const prevWaistY = rig.waist.rotation.y;
  const prevNeckY = rig.neck.rotation.y;
  rig.waist.rotation.y = -torsoTheir;
  rig.shoulderL.rotation.y = torsoTheir - tYaw;
  const armY = lerp(tYaw, v(1) + tw, fade);
  rig.shoulderR.rotation.set(
    lerp(rig.shoulderR.rotation.x, -0.25, fade),
    -armY + torsoTheir,
    lerp(rig.shoulderR.rotation.z, v(2), fade),
  );
  rig.elbowR.rotation.x = lerp(rig.elbowR.rotation.x, -v(3), fade);
  rig.wristR.rotation.x = lerp(rig.wristR.rotation.x, 0, fade);
  rig.wristR.rotation.z = lerp(rig.wristR.rotation.z, 0.5 * fade, fade);
  const deltaWaist = rig.waist.rotation.y - prevWaistY;
  rig.neck.rotation.y = prevNeckY - deltaWaist + tw * 0.5 * fade;
}

function applyHit(rig, t, side) {
  const env = t < 0.05 ? t / 0.05 : Math.exp(-(t - 0.05) * 5.5) * Math.cos((t - 0.05) * 9);
  rig.neck.rotation.y += -side * 0.95 * env;
  rig.neck.rotation.z = -side * 0.35 * env;
  rig.pelvis.rotation.x -= 0.22 * Math.max(0, env);
  rig.pelvis.rotation.z += -side * 0.12 * env;
  for (const [name, sign] of [['shoulderL', -1], ['shoulderR', 1]]) {
    rig[name].rotation.z += sign * 0.35 * Math.max(0, env);
  }
}

const headProfiles = new WeakMap();

function headRadiusAt(geometry, y) {
  let profile = headProfiles.get(geometry);
  if (!profile) {
    const pos = geometry.attributes.position;
    const bands = new Map();
    for (let i = 0; i < pos.count; i += 1) {
      const py = pos.getY(i);
      const key = py.toFixed(4);
      const radius = Math.hypot(pos.getX(i), pos.getZ(i) / 1.08);
      bands.set(key, Math.max(bands.get(key) || 0, radius));
    }
    profile = [...bands.entries()].map(([py, radius]) => ({ y: Number(py), radius }));
    profile.sort((a, b) => a.y - b.y);
    headProfiles.set(geometry, profile);
  }
  if (!profile.length || y < profile[0].y || y > profile[profile.length - 1].y) return null;
  for (let i = 0; i < profile.length - 1; i += 1) {
    const a = profile[i];
    const b = profile[i + 1];
    if (y >= a.y && y <= b.y) {
      const u = (y - a.y) / Math.max(1e-6, b.y - a.y);
      return a.radius + (b.radius - a.radius) * u;
    }
  }
  return profile[profile.length - 1].radius;
}

function blockOverlap(mesh, point) {
  mesh.worldToLocal(_sample.copy(point));
  const data = mesh.geometry.userData;
  const height = data.height;
  if (!height || _sample.y < 0 || _sample.y > height) return 0;
  const u = _sample.y / height;
  const halfW = ((data.bottomWidth * (1 - u)) + (data.topWidth * u)) / 2;
  const halfD = ((data.bottomDepth * (1 - u)) + (data.topDepth * u)) / 2;
  const ix = halfW - Math.abs(_sample.x);
  const iz = halfD - Math.abs(_sample.z);
  if (ix <= 0 || iz <= 0) return 0;
  return Math.min(ix, iz);
}

function headOverlap(mesh, point) {
  mesh.worldToLocal(_sample.copy(point));
  const limit = headRadiusAt(mesh.geometry, _sample.y);
  if (limit == null) return 0;
  const radius = Math.hypot(_sample.x, _sample.z / 1.08);
  return Math.max(0, limit - radius);
}

function addOverlap(score, rig, point) {
  const head = rig.neck.getObjectByName('headMesh');
  const chest = rig.waist.getObjectByName('chestMesh');
  const pelvisMesh = rig.pelvis.getObjectByName('pelvisMesh');
  return score + headOverlap(head, point) * 1.4 + blockOverlap(chest, point) + blockOverlap(pelvisMesh, point);
}

function limbOverlap(rig, side, spec) {
  const wrist = rig[`wrist${side}`];
  const elbow = rig[`elbow${side}`];
  const hand = wrist.getObjectByName(`hand${side}Mesh`);
  rig.pelvis.updateWorldMatrix(true, true);
  let score = 0;
  if (hand) {
    score = addOverlap(score, rig, hand.localToWorld(_tip.set(0, -spec.handLength, 0)));
    score = addOverlap(score, rig, hand.localToWorld(_tip.set(0, -spec.handLength * 0.5, 0)));
  }
  score = addOverlap(score, rig, wrist.getWorldPosition(_tip));
  elbow.getWorldPosition(_a);
  wrist.getWorldPosition(_b);
  score = addOverlap(score, rig, _hold.copy(_a).lerp(_b, 0.5));
  score = addOverlap(score, rig, _a);
  return score;
}

/**
 * After the pose is solved, nudge a limb that still passes through the head,
 * chest, or pelvis. Standing clips are left alone, including the 120° pose.
 */
function separateLimbs(rig, spec) {
  for (const side of ['L', 'R']) {
    const sign = side === 'L' ? -1 : 1;
    const shoulder = rig[`shoulder${side}`];
    const elbow = rig[`elbow${side}`];
    for (let iter = 0; iter < 8; iter += 1) {
      const base = limbOverlap(rig, side, spec);
      if (base <= 0.008) break;
      const trials = [
        [shoulder, 'z', sign * 0.12],
        [shoulder, 'z', -sign * 0.12],
        [shoulder, 'x', -0.12],
        [shoulder, 'x', 0.12],
        [shoulder, 'y', 0.16],
        [shoulder, 'y', -0.16],
        [elbow, 'x', -0.22],
        [elbow, 'x', 0.22],
        [rig[`wrist${side}`], 'x', 0.2],
        [rig[`wrist${side}`], 'x', -0.2],
        [rig[`wrist${side}`], 'z', sign * 0.2],
      ];
      let best = null;
      for (const [joint, axis, delta] of trials) {
        const prev = joint.rotation[axis];
        const next = prev + delta;
        if (joint === elbow && (next > 0.05 || next < -3.08)) continue;
        if (joint !== elbow && Math.abs(next) > 3.05) continue;
        joint.rotation[axis] = next;
        const score = limbOverlap(rig, side, spec);
        joint.rotation[axis] = prev;
        if (score < base - 0.002 && (!best || score < best.score)) {
          best = { joint, axis, delta, score };
        }
      }
      if (!best) break;
      best.joint.rotation[best.axis] += best.delta;
    }
  }
}

function applyKnockdown(rig, spec, t, dir, roll) {
  const T1 = KD_FALL;
  const T2 = KD_FALL + KD_LIE;
  const T3 = T2 + KD_UP;
  const u = t >= T3 ? 1 : t;
  let a;
  let flail;
  if (u < T1) {
    const k = u / T1;
    a = k * k * 1.04;
    flail = k;
  } else if (u < T2) {
    const k = u - T1;
    a = 1 + 0.07 * Math.exp(-k * 7) * Math.sin(k * 26 + 1.6) - 0.04;
    flail = Math.max(0.35, 1 - k * 3);
  } else {
    const k = (u - T2) / KD_UP;
    a = 1 - k * k * (3 - 2 * k);
    flail = 0.35 * (1 - k);
  }
  const ang = a * (Math.PI / 2 - 0.08) * dir;
  _kq.setFromAxisAngle(_kx, ang);
  rig.pelvis.position.applyQuaternion(_kq);
  rig.pelvis.quaternion.premultiply(_kq);
  _kq.setFromAxisAngle(_kz, -roll * a);
  rig.pelvis.position.applyQuaternion(_kq);
  rig.pelvis.quaternion.premultiply(_kq);
  rig.pelvis.position.y += 0.15 * (spec.height / 1.8) * Math.min(1, Math.abs(a));
  for (const [side, sign] of [['L', -1], ['R', 1]]) {
    rig[`shoulder${side}`].rotation.z += sign * 1.25 * flail;
    rig[`shoulder${side}`].rotation.x += (u < T2 ? -1.1 * flail * dir : 0.9 * flail);
    rig[`elbow${side}`].rotation.x -= 0.5 * flail;
    rig[`hip${side}`].rotation.x += -0.25 * flail * (sign < 0 ? 1 : 0.3);
  }
  rig.neck.rotation.x += 0.35 * dir * Math.min(1, Math.abs(a));
  rig.neck.rotation.z += -roll * a * 0.8;
}
