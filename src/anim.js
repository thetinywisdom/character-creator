// Procedural walk / run, IK, reactions and the eight creator dances.
// Pose numbers are copied from iso-city.
import * as THREE from 'three';
import { mulberry32, HIP_Y, HIP_X, THIGH, SHIN, SHOULDER_Y, SHOULDER_X, UPPER, FORE } from './geom.js';

/** Angular rate shared by the hula dance and the idle watermelon hoop. */
export const HULA_W = Math.PI * 2 * 1.75;

const LEG_L = THIGH + SHIN, ANKLE_H = HIP_Y - LEG_L;     // ankle height above the sole
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (a, b, v) => { const t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const damp = (cur, goal, rate, dt) => cur + (goal - cur) * (1 - Math.exp(-rate * dt));
const WALK_TO_RUN = [3.4, 5.4];          // speed band where the walk cross-fades into the run
const WALK = { duty: 0.6, lift: 0.13, bobA: 0.032, lean: 0.07, pelvis: 0.13, shoulder: 0.16, sway: 0.028, roll: 0.05, crouch: 0.03 };
const RUN = { duty: 0.34, lift: 0.46, bobA: 0.06, lean: 0.23, pelvis: 0.16, shoulder: 0.2, sway: 0.014, roll: 0.035, crouch: 0.07 };
/** stride (two steps) in world units for a speed; tied to leg length */
export function strideLength(speed, run = 0, mul = 1) {
  const w = clamp(0.55 + 0.32 * speed, 0.8, 1.5) * (LEG_L / 0.82);
  const r = clamp(1.5 + 0.22 * speed, 2.2, 3.3) * (LEG_L / 0.82);
  return lerp(w, r, run) * mul;
}
const SLAP_HIT = 0.31, SLAP_DUR = 0.62, HIT_DUR = 0.7;   // slap timings (s)
export { SLAP_HIT };
const _m = new THREE.Matrix4(), _v = new THREE.Vector3(), _q = new THREE.Quaternion(), _e = new THREE.Euler();
const _kq = new THREE.Quaternion(), _kx = new THREE.Vector3(1, 0, 0);
const KD_FALL = 0.36, KD_UP = 0.55;   // knockdown: tumble / get-up durations (s)
const _A = new THREE.Vector3(), _B = new THREE.Vector3(), _C = new THREE.Vector3(), _D = new THREE.Vector3(), _E = new THREE.Vector3(),
  _F = new THREE.Vector3(), _G = new THREE.Vector3(), _Hv = new THREE.Vector3(), _M2 = new THREE.Matrix4();

export class Character {
  constructor(P, cfg) {
    this.root = P.root; this.parts = P; this.config = cfg;
    this.phase = 0; this.walk = 0; this.run = 0; this.air = 0; this.crouch = 0; this.lean = 0; this.leanZ = 0;
    this.land = 0; this.landV = 0; this.settle = 0; this.settleV = 0; this.prevSpeed = 0; this.grounded = true;
    this.vy = 0; this.spd = 0;
    this.t = (cfg.seed ? mulberry32(cfg.seed + ':t')() : 0) * 10;
    this.strideMul = clamp(P.legSwing / 0.34, 0.6, 1);   // skirts: shorter strides, no clipping
    // body variation: height scales the whole rig (stride scales with it, so no sliding); build widens it
    this.h = cfg.height || 1; const b = this.b = cfg.build || 1;
    // cfg.shape (creator body types) overrides the single build factor: { sh, hip, tx, tz, leg, arm }
    const S = cfg.shape || { sh: 1 + (b - 1) * 0.8, hip: 1 + (b - 1) * 0.6, tx: b, tz: 1 + (b - 1) * 0.7, leg: 1 + (b - 1) * 0.8, arm: 1 + (b - 1) * 0.6 };
    this.shX = SHOULDER_X * S.sh; this.hipX = HIP_X * S.hip;
    P.torso.scale.set(S.tx, 1, S.tz);
    for (const s of ['L', 'R']) {
      P['leg' + s].position.x = (s === 'L' ? 1 : -1) * this.hipX;
      P['leg' + s].scale.set(S.leg, 1, S.leg);
      P['arm' + s].scale.set(S.arm, 1, S.arm);
    }
    P.body.rotation.order = 'YXZ';
    for (const s of ['L', 'R']) P['arm' + s].rotation.order = 'YXZ';
    this.root.userData.character = this;
    let tris = 0;
    this.root.traverse((o) => {
      if (o.isMesh) {
        o.castShadow = true;
        const g = o.geometry;
        tris += (g.index ? g.index.count : g.attributes.position.count) / 3;
      }
    });
    this.triangles = tris;
    this.update(0, 0);
  }

  /** Player-side jump hooks (physics lives with the caller). */
  anticipate(amount = 1) { this._antic = amount; }

  /** Open-hand slap with the right arm: wind-up, fast swing across, follow-through.
   *  Returns the seconds until the hand connects (SLAP_HIT). */
  slap() { this._slapT = 0; return SLAP_HIT; }
  get slapping() { return this._slapT !== undefined && this._slapT < SLAP_DUR; }
  /** Got slapped: head snaps to `side` (+1 = to its left, -1 = to its right), body recoils. */
  hit(side = 1) { this._hitT = 0; this._hitSide = side; }
  /** Tripped: ragdoll-ish tumble (dir +1 = face-down forward, -1 = onto the back), lie for `lie` s, then get up.
   *  Pivots the whole body about the feet. Returns the total duration in s. */
  knockdown(dir = 1, lie = 1.5, roll = 0) {
    if (this._dance) this.stopDance(0.08);
    this._kd = { t: 0, dir, lie, roll: roll || (Math.random() < 0.5 ? -1 : 1) * (0.15 + Math.random() * 0.2) };
    return KD_FALL + lie + KD_UP;
  }
  get down() { return !!this._kd; }
  _kdStep(D) {
    const k = this._kd, P = this.parts, H = this.h;
    const t = (k.t += D), T1 = KD_FALL, T2 = KD_FALL + k.lie, T3 = T2 + KD_UP;
    if (t >= T3) { this._kd = null; return; }
    let a, flail;
    if (t < T1) { const u = t / T1; a = u * u * 1.04; flail = u; }                                  // gravity tumble
    else if (t < T2) { const u = t - T1; a = 1 + 0.07 * Math.exp(-u * 7) * Math.sin(u * 26 + 1.6) - 0.04; flail = Math.max(0.35, 1 - u * 3); }  // thud bounce, lie
    else { const u = (t - T2) / KD_UP; a = 1 - u * u * (3 - 2 * u); flail = 0.35 * (1 - u); }       // push up
    const ang = a * (Math.PI / 2 - 0.08) * k.dir;
    _kq.setFromAxisAngle(_kx, ang);
    P.body.position.applyQuaternion(_kq); P.body.quaternion.premultiply(_kq);
    _kq.setFromAxisAngle(_v.set(0, 0, 1), k.roll * a); P.body.position.applyQuaternion(_kq); P.body.quaternion.premultiply(_kq);
    P.body.position.y += 0.15 * H * Math.min(1, Math.abs(a));
    // limbs: arms fling out on the fall, splay while lying, push the ground getting up; head lolls
    for (const [side, sx] of [['L', 1], ['R', -1]]) {
      const arm = P['arm' + side];
      arm.rotation.z += sx * 1.25 * flail;
      arm.rotation.x += (t < T2 ? -1.1 * flail * k.dir : 0.9 * flail);
      P['elbow' + side].rotation.x -= 0.5 * flail;
      P['leg' + side].rotation.x += -0.25 * flail * (sx > 0 ? 1 : 0.3);
    }
    P.head.rotation.x += 0.35 * k.dir * Math.min(1, Math.abs(a)); P.head.rotation.z += k.roll * a * 0.8;
  }

  // additive action layer, applied after the locomotion pose
  _actions(D) {
    const P = this.parts;
    if (this.hold) this.hold(this);                 // specials: idle prop grip (e.g. ring at the hip)
    if (this._dance) this._danceStep(D);
    if (this.prop) this.prop(this, this._dance ? this._dancePose : null, this._danceW || 0);
    if (this._slapT !== undefined && this._slapT < SLAP_DUR) {
      const t = (this._slapT += D);
      const a = P.armR, e = P.elbowR, wr = P.wristR;
      // keyframes: [time, yaw (across body), abduction, elbow, torso twist]
      const K = [[0, 0, 0.1, 0.2, 0], [0.2, -0.75, 1.35, 1.35, -0.35], [0.25, -0.75, 1.4, 1.25, -0.38],
        [SLAP_HIT, 1.25, 1.45, 0.15, 0.35], [0.4, 1.85, 1.3, 0.3, 0.45], [SLAP_DUR, 0, 0.1, 0.2, 0]];
      let i = 0; while (i < K.length - 2 && t > K[i + 1][0]) i++;
      const k0 = K[i], k1 = K[i + 1];
      let u = clamp((t - k0[0]) / (k1[0] - k0[0]), 0, 1);
      u = i === 2 ? u * u : u * u * (3 - 2 * u);          // the swing accelerates into the hit
      const v = (j) => lerp(k0[j], k1[j], u);
      const fade = 1 - smooth(0.42, SLAP_DUR, t);
      const tw = v(4);
      P.torso.rotation.y = lerp(P.torso.rotation.y, tw, fade);
      _v.set(-this.shX, SHOULDER_Y, 0).applyAxisAngle(THREE.Object3D.DEFAULT_UP, P.torso.rotation.y);
      a.position.copy(_v);
      a.rotation.set(lerp(a.rotation.x, -0.25, fade), lerp(a.rotation.y, v(1) + tw, fade), lerp(a.rotation.z, -v(2), fade));
      e.rotation.x = lerp(e.rotation.x, -v(3), fade);
      wr.rotation.x = lerp(wr.rotation.x, 0, fade); wr.rotation.z = lerp(wr.rotation.z, -0.5 * fade, fade);
      P.head.rotation.y += -tw * 0.5 * fade;
    }
    if (this._hitT !== undefined && this._hitT < HIT_DUR) {
      const t = (this._hitT += D), s = this._hitSide;
      // instant snap, then a springy return
      const env = t < 0.05 ? t / 0.05 : Math.exp(-(t - 0.05) * 5.5) * Math.cos((t - 0.05) * 9);
      P.head.rotation.y += s * 0.95 * env;
      P.head.rotation.z = s * 0.35 * env;
      P.body.rotation.x -= 0.22 * Math.max(0, env);
      P.body.rotation.z += s * 0.12 * env;
      for (const [side, sx] of [['L', 1], ['R', -1]]) {   // arms flail out a little
        if (side === 'R' && this.slapping) continue;
        P['arm' + side].rotation.z += sx * 0.35 * Math.max(0, env);
      }
      if (t >= HIT_DUR) P.head.rotation.z = 0;
    }
    if (this._kd) this._kdStep(D);
  }

  /**
   * update(dt, speed) or update(dt, { speed, grounded, vy, crouch, turn })
   *  speed: horizontal units/s · grounded: false while airborne · vy: vertical velocity
   *  crouch: 0..1 jump anticipation · turn: heading change rad/s (lean into turns)
   */
  update(dt, state = 0) {
    const st = typeof state === 'number' ? { speed: state } : (state || {});
    const speed = Math.max(0, st.speed || 0);
    const grounded = st.grounded !== false, vy = st.vy || 0;
    const P = this.parts, D = dt || 0;
    this.t += D; this._lastD = D;
    // landing: squash spring kicked by impact speed
    if (grounded && !this.grounded) { this.landV += clamp(-this.vy, 2, 12) * 0.55; }
    this.grounded = grounded; if (!grounded) this.vy = vy;
    // ---- blend weights (cross-fades, never snaps) ----
    const wGoal = smooth(0.05, 0.9, speed), rGoal = smooth(WALK_TO_RUN[0], WALK_TO_RUN[1], speed);
    if (D === 0) { this.walk = wGoal; this.run = rGoal; this.air = grounded ? 0 : 1; this.crouch = st.crouch || 0; }
    this.walk = damp(this.walk, wGoal, 7, D); this.run = damp(this.run, rGoal, 6, D);
    this.air = damp(this.air, grounded ? 0 : 1, grounded ? 30 : 18, D);
    this.crouch = damp(this.crouch, st.crouch || this._antic || 0, 70, D); this._antic = 0;
    // stopping settle: decel kicks a small damped dip
    const decel = Math.max(0, this.prevSpeed - speed); this.prevSpeed = speed;
    if (grounded && D > 0) this.settleV += decel * 0.9;
    for (const [x, v, kk, c] of [['settle', 'settleV', 140, 14], ['land', 'landV', 170, 15]]) {
      this[v] += (-kk * this[x] - c * this[v]) * D; this[x] += this[v] * D;
    }
    const w = this.walk * (1 - this.air), r = this.run;
    const G = {}; for (const key in WALK) G[key] = lerp(WALK[key], RUN[key], r);
    const H = this.h;
    const S = strideLength(Math.max(speed, 0.6), r, this.strideMul);   // in rig units (world = S * H)
    if (grounded) this.phase = (this.phase + speed * D / (S * H)) % 1;   // phase advances by distance
    const p = this.phase, TAU = Math.PI * 2;
    const ex = 1 + 0.25 * r;   // readability boost at pixel scale
    // ---- body: bob (lowest at "down", 2x per cycle), lean, pelvis yaw/roll, sway ----
    const bobPh = lerp(0.07, G.duty / 2, r);
    const bob = -G.bobA * Math.cos(TAU * 2 * (p - bobPh)) * w - G.crouch * w;
    const squash = clamp(this.land, -0.2, 1);
    const crouchY = Math.max(this.crouch, 0) * 0.26 + squash * 0.17 + this.settle * 0.05;
    this.lean = damp(this.lean, G.lean * w * smooth(0.2, 2.5, speed) + this.crouch * 0.3 + squash * 0.25 - this.settle * 0.15 + this.air * (vy > 0 ? 0.08 : -0.02) * this.walk, 10, D || 1);
    const turnLean = clamp(-(st.turn || 0) * speed * 0.012, -0.22, 0.22);
    this.leanZ = damp(this.leanZ, turnLean * (1 - this.air), 6, D || 1);
    const c1 = Math.cos(TAU * p);                       // +1 when the left leg is forward
    const pelvisYaw = -G.pelvis * c1 * w;
    const shoulderYaw = G.shoulder * c1 * w * ex;      // counter-rotates the pelvis
    const breathe = Math.sin(this.t * 1.7);
    const hipY = HIP_Y + bob - crouchY + breathe * 0.002 * (1 - w);
    P.body.rotation.set(this.lean, pelvisYaw, G.roll * Math.sin(TAU * p) * w + this.leanZ);
    P.body.updateMatrix();
    _q.setFromEuler(P.body.rotation); _v.set(0, HIP_Y, 0).applyQuaternion(_q);
    P.body.position.set(G.sway * Math.sin(TAU * p) * w - _v.x, hipY - _v.y, -_v.z).multiplyScalar(H);
    P.body.scale.set(1 + squash * 0.03, 1 - squash * 0.04, 1 + squash * 0.03).multiplyScalar(H);
    P.body.updateMatrix();
    // ---- legs: foot targets in root space, then IK ----
    _m.copy(P.body.matrix).invert();
    for (const [side, off, sx] of [['L', 0, 1], ['R', 0.5, -1]]) {
      const lp = (p + off) % 1;
      const ft = this._foot(lp, G.duty, S, G.lift * ex, r);
      // airborne: tuck while rising, reach down for the landing
      const tuck = vy > 0 ? 0.42 : clamp(0.42 + vy * 0.05, 0.08, 0.42);
      const air = { z: sx * 0.06 * this.walk + 0.05, y: ANKLE_H + tuck, pitch: 0.35 };
      const rest = { z: 0, y: ANKLE_H, pitch: 0 };
      let z = lerp(rest.z, ft.z, w), y = lerp(rest.y, ft.y, w), pitch = lerp(rest.pitch, ft.pitch, w);
      z = lerp(z, air.z, this.air); y = lerp(y, air.y, this.air); pitch = lerp(pitch, air.pitch, this.air);
      this._ik(side, sx, _v.set(sx * this.hipX * H, y * H, z * H).applyMatrix4(_m), pitch);
    }
    // ---- arms: opposite to the legs, elbows bend more on the back-swing; run = pumping 90° ----
    const tYaw = shoulderYaw - pelvisYaw;
    P.torso.rotation.y = tYaw;
    for (const [side, sx, off] of [['L', 1, 0.5], ['R', -1, 0]]) {
      const a = P['arm' + side];
      const sw = Math.cos(TAU * (p + off - 0.04 * (1 - r)));   // +1 = this arm forward
      const fw = Math.max(0, sw), bk = Math.max(0, -sw);
      const walkSh = -(fw * 0.55 - bk * 0.42) * ex, runSh = -(fw * 0.85 - bk * 0.75) + 0.1;
      const walkEl = 0.18 + bk * 0.32 + fw * 0.22, runEl = 1.45 + fw * 0.2 - bk * 0.15;
      let shX = lerp(walkSh, runSh, r) * w + breathe * 0.015 * (1 - w);
      let el = lerp(walkEl, runEl, r) * w + 0.08 * (1 - w);
      let abd = 0.06 + 0.06 * w + r * 0.08 * w + Math.sin(this.t * 0.9 + sx) * 0.012 * (1 - w);
      // jump: arms swing back on the crouch, up and out in the air
      shX = shX * (1 - this.crouch) + this.crouch * 0.75;
      const up = this.air * (vy > 0 ? 1 : clamp(0.6 + vy * 0.04, 0.2, 0.6));
      shX = lerp(shX, -2.1, up * 0.8); abd = lerp(abd, 0.95, this.air); el = lerp(el, 0.35, this.air);
      shX += squash * 0.5;
      _v.set(sx * this.shX, SHOULDER_Y, 0).applyAxisAngle(THREE.Object3D.DEFAULT_UP, tYaw);
      a.position.copy(_v);
      a.rotation.set(shX, tYaw, sx * abd);
      P['elbow' + side].rotation.set(-el, 0, 0);
      P['wrist' + side].rotation.set(fw * 0.35 * w * (1 - r), 0, sx * 0.1 * w);
    }
    P.torso.position.y = breathe * 0.003 * (1 - w);
    // head stays level-ish and looks where it goes; idle look-around
    const look = Math.sin(this.t * 0.37) * 0.35 + Math.sin(this.t * 0.83) * 0.12;
    const idle = (1 - this.walk) * (1 - this.air);
    P.head.rotation.y = look * idle - pelvisYaw;
    P.head.rotation.z = 0;
    P.head.rotation.x = -this.lean * 0.6 + 0.03 * Math.sin(this.t * 0.5) * idle + this.air * (vy > 0 ? -0.1 : 0.12);
    this._actions(D);
  }

  // one leg's foot target at leg-phase lp (0 = heel strike), stance first then swing
  _foot(lp, duty, S, lift, r) {
    const span = duty * S;
    const zF = span * lerp(0.5, 0.42, r), zB = zF - span;   // run lands nearer under the hips
    let z, y, pitch;
    if (lp < duty) {                       // stance: planted, moves back at exactly body speed
      const t = lp / duty;
      z = lerp(zF, zB, t);
      const heel = lerp(-0.35, -0.06, r) * (1 - smooth(0, 0.18, t));   // heel strike, toe up
      const toe = lerp(0.75, 0.95, r) * smooth(0.62, 1, t);              // heel rises, roll onto toes
      pitch = heel + toe;
    } else {                               // swing: lift, knee drives forward, reach
      const t = (lp - duty) / (1 - duty);
      const e = r > 0.5 ? smooth(0, 1, Math.pow(t, 1.25)) : smooth(0, 1, t);
      z = lerp(zB, zF, e) + Math.sin(Math.PI * t) * 0.04 * r;
      const peak = Math.pow(Math.sin(Math.PI * Math.pow(t, lerp(0.75, 0.6, r))), 1.3);
      y = ANKLE_H + lift * peak;
      pitch = lerp(lerp(0.75, 0.95, r), lerp(-0.35, -0.06, r), smooth(0.05, 0.9, t)) + 0.25 * r * peak;
      return { z, y, pitch };
    }
    // foot roll: pivot on the heel (toe up) or on the toes (heel up) raises the ankle
    y = ANKLE_H + (pitch < 0 ? Math.sin(-pitch) * 0.075 : Math.sin(pitch) * 0.15);
    return { z, y, pitch };
  }

  // two-bone IK in the leg's sagittal plane; target is in body-local space
  _ik(side, sx, tgt, footPitch) {
    const P = this.parts;
    const dy = tgt.y - HIP_Y, dz = tgt.z;
    const L = clamp(Math.hypot(dy, dz), 0.25, LEG_L * 0.9995);
    const cosK = clamp((THIGH * THIGH + SHIN * SHIN - L * L) / (2 * THIGH * SHIN), -1, 1);
    const knee = Math.PI - Math.acos(cosK);
    const cosB = clamp((THIGH * THIGH + L * L - SHIN * SHIN) / (2 * THIGH * L), -1, 1);
    const hip = Math.atan2(-dz, -dy) - Math.acos(cosB);
    P['leg' + side].rotation.set(hip, 0, 0);
    P['knee' + side].rotation.set(knee, 0, 0);
    P['ankle' + side].rotation.set(footPitch - (this.lean + hip + knee), 0, 0);
  }

  /** Freeze into a walk/run pose at a cycle phase (0..1 or radians>1 legacy). */
  setWalkPose(phase = 0.25, speed = 1.4) {
    this.phase = phase > 1.0001 ? (phase / (Math.PI * 2)) % 1 : phase;
    this.prevSpeed = speed;
    const ph = this.phase; this.update(0, { speed }); this.phase = ph;
  }
  // ---- dances (special NPCs): full-body keyframed poses blended over the locomotion pose ----
  /** Start a named dance (see DANCES). Returns its duration in seconds (0 = unknown). */
  dance(name) {
    const d = DANCES[name]; if (!d) return 0;
    this._dance = { d, name, t: 0, out: -1, outDur: 0.2, outW: 1 }; this._danceW = 0;
    return d.dur;
  }
  /** Blend out of the current dance quickly (slap, interruption). */
  stopDance(fade = 0.18) {
    const s = this._dance; if (s && s.out < 0) { s.out = 0; s.outDur = fade; s.outW = this._danceW || 0; }
  }
  get dancing() { return !!this._dance && this._dance.out < 0; }
  get danceName() { return this._dance ? this._dance.name : null; }
  _danceStep(D) {
    const s = this._dance, d = s.d;
    s.t += D; if (s.out >= 0) s.out += D;
    let w = smooth(0, d.blendIn, s.t) * (1 - smooth(d.dur - d.blendOut, d.dur, s.t));
    if (s.out >= 0) w = Math.min(w, s.outW * (1 - smooth(0, s.outDur, s.out)));
    if (s.t >= d.dur || (s.out >= 0 && s.out >= s.outDur)) { this._dance = null; this._danceW = 0; return; }
    this._danceW = w;
    const P = this.parts;
    const J = this._joints || (this._joints = ['body', 'torso', 'head', 'armL', 'armR', 'elbowL', 'elbowR', 'wristL', 'wristR',
      'legL', 'legR', 'kneeL', 'kneeR', 'ankleL', 'ankleR'].map((k) => ({ o: P[k], p: new THREE.Vector3(), q: new THREE.Quaternion() })));
    for (const j of J) { j.p.copy(j.o.position); j.q.copy(j.o.quaternion); }
    const pose = this._dancePose = d.pose(s.t, this);
    this._applyPose(pose);
    for (const j of J) {
      j.o.position.lerpVectors(j.p, j.o.position, w);
      _q.copy(j.o.quaternion); j.o.quaternion.copy(j.q).slerp(_q, w);
    }
  }
  // pose: { dip, lean, yaw, roll, hx, hz, ty, stance, fz:[L,R], head:[x,y,z], L/R:{ w:[wrist], e:[elbow pole], r, f } }
  _applyPose(p) {
    const P = this.parts, H = this.h;
    const lean = p.lean || 0, dip = p.dip || 0;
    P.body.rotation.set(lean, p.yaw || 0, p.roll || 0);
    _q.setFromEuler(P.body.rotation); _v.set(0, HIP_Y, 0).applyQuaternion(_q);
    P.body.position.set((p.hx || 0) - _v.x, HIP_Y - dip - _v.y, (p.hz || 0) - _v.z).multiplyScalar(H);
    P.body.updateMatrix();
    _m.copy(P.body.matrix).invert();
    this.lean = lean;
    const st = p.stance || 0, fz = p.fz || [0, 0];
    for (const [side, sx, i] of [['L', 1, 0], ['R', -1, 1]]) {
      this._ik(side, sx, _v.set(sx * this.hipX * H, ANKLE_H * H, fz[i] * H).applyMatrix4(_m), 0);
      const a = Math.asin(clamp(st / Math.max(0.3, HIP_Y - dip - ANKLE_H), -0.6, 0.6));
      P['leg' + side].rotation.z = sx * a; P['ankle' + side].rotation.z = -sx * a;
    }
    const ty = p.ty || 0;
    P.torso.rotation.y = ty;
    const h = p.head || [0, 0, 0];
    P.head.rotation.set(h[0], h[1] + ty * 0.5, h[2]);
    const ao = this.armOff, adj = (a, sx) => (ao ? [a[0] + sx * ao.x, a[1], a[2] + ao.z] : a);   // custom bodies: wider / deeper
    if (p.L) this._armIK('L', adj(p.L.w, 1), adj(p.L.e, 1), p.L.r || 0, p.L.f || 0, ty);
    if (p.R) this._armIK('R', adj(p.R.w, -1), adj(p.R.e, -1), p.R.r || 0, p.R.f || 0, ty);
  }
  /** Two-bone arm IK in body space: wrist target W, elbow pole E (points, torso space), wrist roll/flex. */
  _armIK(side, W, E, roll = 0, flex = 0, ty = 0) {
    const P = this.parts, sx = side === 'L' ? 1 : -1;
    const S = _A.set(sx * this.shX, SHOULDER_Y, 0).applyAxisAngle(THREE.Object3D.DEFAULT_UP, ty);
    const T = _B.fromArray(W).applyAxisAngle(THREE.Object3D.DEFAULT_UP, ty).sub(S);
    const pp = _C.fromArray(E).applyAxisAngle(THREE.Object3D.DEFAULT_UP, ty).sub(S);
    P['arm' + side].position.copy(S);
    const A = UPPER, B = FORE;
    const dist = clamp(T.length(), A - B + 0.02, A + B - 0.002);
    const dn = T.normalize();
    const cosA = clamp((A * A + dist * dist - B * B) / (2 * A * dist), -1, 1), sinA = Math.sqrt(1 - cosA * cosA);
    pp.addScaledVector(dn, -pp.dot(dn)); if (pp.lengthSq() < 1e-8) pp.set(0, 0, -1); pp.normalize();
    const u = _D.copy(dn).multiplyScalar(cosA).addScaledVector(pp, sinA);           // upper-arm direction
    const f = _E.copy(dn).multiplyScalar(dist).addScaledVector(u, -A).normalize();  // forearm direction
    const Y = _F.copy(u).negate();
    const Z = _G.copy(f).addScaledVector(u, -f.dot(u));
    if (Z.lengthSq() < 1e-8) Z.copy(pp); Z.normalize();
    const X = _Hv.crossVectors(Y, Z);
    _M2.makeBasis(X, Y, Z);
    P['arm' + side].quaternion.setFromRotationMatrix(_M2);
    P['elbow' + side].rotation.set(-Math.acos(clamp(u.dot(f), -1, 1)), 0, 0);
    P['wrist' + side].rotation.set(flex, roll, 0);
  }
  dispose() { this.root.removeFromParent(); }
}

/**
 * Tiny jump physics shared by the game and the showcase.
 * motor.jump() -> anticipation crouch, then takeoff; motor.step(dt, groundY) each frame;
 * feed motor.state into character.update(dt, { speed, ...motor.state }).
 */
export class JumpMotor {
  constructor({ height = 1.1, gravity = 34, anticipation = 0.08 } = {}) {
    Object.assign(this, { height, gravity, anticipation });
    this.v0 = Math.sqrt(2 * gravity * height);
    this.y = 0; this.vy = 0; this.grounded = true; this.antic = -1; this.justLanded = false;
  }
  get busy() { return !this.grounded || this.antic >= 0; }
  jump() { if (this.busy) return false; this.antic = 0; return true; }   // no double jump
  step(dt, groundY = 0) {
    this.justLanded = false;
    if (this.antic >= 0) {
      this.antic += dt;
      if (this.antic >= this.anticipation) { this.antic = -1; this.vy = this.v0; this.grounded = false; this.y = Math.max(this.y, groundY); }
    }
    if (!this.grounded) {
      this.vy -= this.gravity * dt; this.y += this.vy * dt;
      if (this.y <= groundY && this.vy <= 0) { this.y = groundY; this.vy = 0; this.grounded = true; this.justLanded = true; }
      else if (this.y < groundY) this.y = groundY;            // rising past a curb edge
    } else this.y = damp(this.y, groundY, 20, dt);         // step up/down sidewalks
    return this.state;
  }
  get crouch() { return this.antic >= 0 ? smooth(0, 1, this.antic / this.anticipation) : 0; }
  get state() { return { grounded: this.grounded, vy: this.vy, crouch: this.crouch }; }
}

const SIL = (L, R, o = {}) => pose({ L, R, ...o });
const arm = (w, e, r = 0, f = 0) => ({ w, e, r, f });
const qstep = (t, rate, n) => Math.floor(t * rate) % n;            // robot: snap between held poses

const mirror = (a) => ({ ...a, w: [-a.w[0], a.w[1], a.w[2]], e: [-a.e[0], a.e[1], a.e[2]], r: -(a.r || 0) });
function lerpPose(a, b, u) {
  if (typeof a === 'number') return a + ((typeof b === 'number' ? b : a) - a) * u;
  if (Array.isArray(a)) return a.map((v, i) => lerpPose(v, b ? b[i] : v, u));
  const o = {};
  for (const k in a) o[k] = b && k in b ? lerpPose(a[k], b[k], u) : a[k];
  return o;
}
const clonePose = (p) => JSON.parse(JSON.stringify(p));
// keys: [[time, pose, ease('in'|'lin'|undefined=smoothstep)]], all poses share the same shape
function sampleKeys(K, t) {
  if (t <= K[0][0]) return clonePose(K[0][1]);
  let i = 0; while (i < K.length - 1 && t > K[i + 1][0]) i++;
  if (i >= K.length - 1) return clonePose(K[K.length - 1][1]);
  const [t0, a] = K[i], [t1, b, ease] = K[i + 1];
  let u = clamp((t - t0) / (t1 - t0), 0, 1);
  u = ease === 'lin' ? u : ease === 'in' ? u * u : ease === 'out' ? 1 - (1 - u) * (1 - u) : u * u * (3 - 2 * u);
  return lerpPose(a, b, u);
}
const pose = (o = {}) => ({ dip: 0, lean: 0, yaw: 0, roll: 0, hx: 0, hz: 0, ty: 0, stance: 0, fz: [0, 0], head: [0, 0, 0],
  L: ARM.restL, R: mirror(ARM.restL), ...o });
const ARM = {
  restL: { w: [0.245, 0.93, 0.04], e: [0.33, 1.25, -0.15], r: 0, f: 0 },
  looseL: { w: [0.27, 0.95, 0.07], e: [0.36, 1.25, -0.1], r: 0, f: 0.1 },
  templeL: { w: [0.125, 1.85, 0.075], e: [0.6, 1.74, 0.02], r: 0.4, f: 0.25 },
  crossR: { w: [0.13, 1.37, 0.23], e: [-0.34, 1.3, 0.12], r: -0.6, f: 0 },
  crossL: { w: [-0.13, 1.33, 0.24], e: [0.34, 1.27, 0.12], r: 0.6, f: 0 },
  outR: { w: [-0.52, 1.08, 0.16], e: [-0.45, 1.35, -0.1], r: 0, f: 0 },
  highR: { w: [-0.12, 2.27, 0.1], e: [-0.45, 1.95, 0.05], r: 0, f: 0 },
  midR: { w: [-0.02, 1.48, 0.36], e: [-0.4, 1.38, 0.12], r: -0.4, f: 0 },
  // the signature: right forearm flat across the stomach, palm down, elbow tucked at the ribs
  coreR: { w: [0.03, 1.21, 0.235], e: [-0.26, 1.2, -0.02], r: -1.25, f: 0 },
  hangL: { w: [0.255, 0.9, 0.03], e: [0.32, 1.2, -0.2], r: 0, f: 0 },
  heartL: { w: [0.07, 1.44, 0.3], e: [0.36, 1.3, 0.1], r: 0.9, f: 0.2 },
  clapOL: { w: [0.17, 1.36, 0.31], e: [0.42, 1.22, 0.02], r: 0.9, f: 0 },
  clapCL: { w: [0.04, 1.39, 0.33], e: [0.42, 1.22, 0.02], r: 0.9, f: 0 },
  // Syoya
  flingL: { w: [0.86, 1.52, 0.1], e: [0.55, 1.62, -0.25], r: 0, f: 0 },
  chestR: { w: [0.02, 1.4, 0.24], e: [-0.36, 1.3, 0.05], r: -0.5, f: 0 },
  wL: { w: [0.5, 1.9, 0.06], e: [0.62, 1.32, -0.02], r: 0, f: 0.3 },
};
const MB = {
  base: pose(),
  temple: pose({ dip: 0.02, head: [0.06, 0, 0], L: ARM.templeL, R: mirror(ARM.templeL) }),
  drop: pose({ dip: 0.05, yaw: 0.3, ty: 0.12, head: [0.02, -0.25, 0], L: ARM.looseL, R: mirror(ARM.looseL) }),
  crossR: pose({ dip: 0.04, yaw: 0.18, ty: 0.18, head: [0.0, -0.1, 0], L: ARM.looseL, R: ARM.crossR }),
  crossL: pose({ dip: 0.04, yaw: -0.05, ty: -0.2, head: [0.0, 0.1, 0], L: ARM.crossL, R: ARM.outR }),
  high: pose({ dip: 0.0, lean: -0.06, yaw: 0.08, head: [-0.22, -0.1, 0], L: ARM.looseL, R: ARM.highR }),
  mid: pose({ dip: 0.05, lean: 0.08, head: [0.08, 0, 0], L: ARM.looseL, R: ARM.midR }),
  core: pose({ dip: 0.05, lean: 0.1, hz: -0.02, head: [-0.12, 0.1, 0.1], L: ARM.hangL, R: ARM.coreR }),
  heart: pose({ dip: 0.02, lean: 0.0, head: [-0.06, 0, 0.14], L: ARM.heartL, R: mirror(ARM.heartL) }),
  clapO: pose({ dip: 0.03, head: [0.0, 0, 0], L: ARM.clapOL, R: mirror(ARM.clapOL) }),
  clapC: pose({ dip: 0.06, lean: 0.06, head: [0.08, 0, 0], L: ARM.clapCL, R: mirror(ARM.clapCL) }),
};
const MB_BEAT0 = 4.25, MB_BEAT = 1.7, MB_BEATS = 3;               // core: 3 phrases of flutter -> slow chest-puff press
const MB_FL = 0.6, MB_PR = 0.85, MB_HZ = 7;                         // flutter length, slow press length, flutter rate (Hz)
const MB_CORE_END = MB_BEAT0 + MB_BEAT * MB_BEATS, MB_OUT = MB_CORE_END - 8.35;
const MB_KEYS = [
  [0, MB.base], [0.55, MB.temple], [1.1, MB.temple],              // hands to temples, elbows flared
  [1.5, MB.drop], [1.8, MB.crossR, 'out'], [2.1, MB.crossL, 'out'], [2.45, MB.crossR, 'out'], [2.65, MB.crossR],
  [3.05, MB.high], [3.25, MB.high], [3.6, MB.mid, 'in'],            // right arm high, sweeps down to centre
  [3.95, MB.core], [MB_CORE_END + 0.1, MB.core],                    // core loop (phrases added on top)
  [8.75 + MB_OUT, MB.heart], [9.3 + MB_OUT, MB.heart],              // heart hands
  [9.45 + MB_OUT, MB.clapO], [9.65 + MB_OUT, MB.clapC, 'in'], [9.9 + MB_OUT, MB.clapO], [10.15 + MB_OUT, MB.clapC, 'in'], [10.9 + MB_OUT, MB.base],
];
// one core phrase, x in seconds since phrase start -> { fl: flutter offset (-1..1, enveloped), pr: slow press 0..1, rs: reset weight }
function mbPhrase(x) {
  const flE = smooth(0, 0.08, x) * (1 - smooth(MB_FL - 0.1, MB_FL, x));
  const fl = x < MB_FL ? Math.sin(x * Math.PI * 2 * MB_HZ) * flE : 0;
  const pr = x < MB_FL ? 0 : x < MB_FL + MB_PR ? smooth(MB_FL, MB_FL + MB_PR, x) : 1 - smooth(MB_FL + MB_PR, MB_BEAT, x);
  return { fl, flE, pr };
}
const SY_DUR = 7.4, SY_W = HULA_W;
export const DANCES = {
  mbappe: {
    dur: 10.9 + MB_OUT, blendIn: 0.35, blendOut: 0.7,
    pose(t, ch) {
      const p = sampleKeys(MB_KEYS, t);
      // temples: little nods
      if (t > 0.5 && t < 1.2) p.head[0] += 0.05 * Math.sin((t - 0.5) * 18);
      const bt = t - MB_BEAT0;
      if (bt >= 0 && t < MB_CORE_END) {
        const k = Math.floor(bt / MB_BEAT), x = bt - k * MB_BEAT;
        const { fl, flE, pr } = mbPhrase(x);
        // 1) rapid flutter: flat hand + forearm buzz up/down from the wrist, tiny body jiggle, knees soft
        p.R.w[1] += 0.03 * flE + 0.1 * fl; p.R.e[1] += 0.035 * fl; p.R.r += 0.35 * fl;
        p.dip += 0.05 * flE + 0.012 * fl; p.ty += 0.03 * fl; p.head[0] += 0.05 * flE;
        // 2) slow smooth press down while puffing the chest: arch back, shoulders up/back, chin up, rise out of the dip
        p.R.w[1] -= 0.11 * pr; p.R.w[2] += 0.03 * pr; p.R.e[1] -= 0.05 * pr; p.R.e[2] -= 0.05 * pr;
        p.lean -= 0.26 * pr; p.dip -= 0.06 * pr; p.hz += 0.03 * pr;
        p.head[0] -= 0.32 * pr; p.head[1] += 0.06 * pr;
        p.L.w[1] += 0.06 * pr; p.L.w[2] -= 0.06 * pr; p.L.e[1] += 0.06 * pr; p.L.e[2] -= 0.06 * pr;
        p.R.e[2] -= 0.04 * pr;
      }
      return p;
    },
  },
  hula: {
    dur: SY_DUR, blendIn: 0.45, blendOut: 0.6,
    pose(t) {
      const ph = SY_W * t;
      const e = smooth(0.1, 0.8, t) * (1 - smooth(SY_DUR - 0.9, SY_DUR - 0.25, t));
      const c = Math.cos(ph), s = Math.sin(ph);
      const armB = smooth(2.5, 3.0, t);
      const L = lerpPose(ARM.flingL, ARM.wL, armB), R = lerpPose(ARM.chestR, mirror(ARM.wL), armB);
      const bounce = Math.sin(ph * 2) * 0.045 * e * armB;
      L.w[1] += bounce; R.w[1] += bounce; L.e[1] += bounce * 0.6; R.e[1] += bounce * 0.6;
      L.w[1] += 0.04 * s * e * (1 - armB);
      const roll = -0.12 * c * e, lean = 0.03 + 0.06 * s * e;
      return {
        dip: 0.17 + 0.025 * Math.sin(ph * 2) * e, lean, yaw: 0.1 * s * e, roll,
        hx: 0.085 * c * e, hz: 0.065 * s * e, ty: -0.12 * s * e, stance: 0.13, fz: [0.03, 0.03],
        head: [-lean * 0.9 + 0.07 * Math.sin(ph * 2) * e, 0.08 * s * e, -roll * 1.7],
        L, R, ph, e,
      };
    },
  },
  flail: {   // the main character: wild windmill arm flail, bouncing, head banging
    dur: 6.6, blendIn: 0.2, blendOut: 0.35,
    pose(t) {
      const a = t * 10.5, b = t * 8.3 + 1.7;
      return SIL(
        arm([0.42 + 0.3 * Math.sin(a), 1.55 + 0.6 * Math.sin(a * 1.3), 0.12 + 0.2 * Math.cos(a)], [0.6, 1.5, -0.2], Math.sin(a) * 0.8),
        arm([-0.42 - 0.3 * Math.sin(b), 1.55 + 0.6 * Math.cos(b * 1.1), 0.12 + 0.2 * Math.sin(b)], [-0.6, 1.5, -0.2], -Math.cos(b) * 0.8),
        { dip: 0.07 + 0.06 * Math.abs(Math.sin(t * 7.5)), yaw: 0.4 * Math.sin(t * 3.7), roll: 0.12 * Math.sin(t * 5.1), lean: 0.06 * Math.sin(t * 7.5),
          stance: 0.12, fz: [0.05 * Math.sin(t * 7.5), -0.05 * Math.sin(t * 7.5)], head: [0.3 * Math.sin(t * 15), 0.25 * Math.sin(t * 3.7), 0.2 * Math.sin(t * 6)] });
    },
  },
  robot: {   // stiff 90° arms, snapping torso and head between held poses
    dur: 6.6, blendIn: 0.15, blendOut: 0.3,
    pose(t) {
      const k = qstep(t, 2.6, 4), up = arm([0.32, 1.95, 0.12], [0.45, 1.55, -0.05], 0, 0), out = arm([0.3, 1.42, 0.38], [0.42, 1.42, -0.12], 0, 0);
      const dn = arm([0.32, 1.05, 0.34], [0.42, 1.42, -0.1], 0, 0);
      const L = [up, out, dn, out][k], R = mirror([out, up, out, dn][k]);
      return SIL(L, R, { dip: 0.04 + (k % 2) * 0.04, ty: [0.45, 0, -0.45, 0][k], head: [0, [-0.5, 0, 0.5, 0][k], 0], stance: 0.1 });
    },
  },
  sprinkler: {   // hand behind the head, other arm out front ratcheting round, then a fast sweep back
    dur: 6.6, blendIn: 0.2, blendOut: 0.35,
    pose(t) {
      const c = (t * 0.9) % 1, ratchet = c < 0.8 ? Math.floor(c / 0.8 * 6) / 6 : 1 - (c - 0.8) / 0.2;
      return SIL(arm([0.13, 1.86, -0.06], [0.5, 1.82, 0.02], 0.3, 0.2), arm([-0.55, 1.48, 0.42], [-0.45, 1.6, 0.0], 0, 0),
        { dip: 0.08, yaw: -0.7 + 1.4 * ratchet, ty: 0.1, stance: 0.14, head: [0.05, 0.15, 0], fz: [0.08, -0.06] });
    },
  },
  chicken: {   // flapping elbow wings, pecking head, knees bent
    dur: 6.6, blendIn: 0.2, blendOut: 0.35,
    pose(t) {
      const fl = Math.sin(t * 15), pk = Math.max(0, Math.sin(t * 6.5));
      return SIL(arm([0.14, 1.5, 0.08], [0.55 + 0.25 * fl, 1.42 + 0.1 * fl, -0.2], 0.5, 0.4), arm([-0.14, 1.5, 0.08], [-0.55 - 0.25 * fl, 1.42 + 0.1 * fl, -0.2], -0.5, 0.4),
        { dip: 0.13 + 0.03 * Math.abs(fl), lean: 0.15 + 0.15 * pk, hz: 0.05 * pk, head: [0.45 * pk - 0.15, 0, 0], stance: 0.16, fz: [0.05 * Math.sin(t * 3.2), -0.05 * Math.sin(t * 3.2)] });
    },
  },
  disco: {   // the point: up-right, down-left, hand on hip, hips swinging
    dur: 6.6, blendIn: 0.2, blendOut: 0.35,
    pose(t) {
      const u = (Math.sin(t * 4.6) + 1) / 2, s = Math.sin(t * 4.6);
      const R = arm([-0.25 + 0.42 * (1 - u), 0.98 + 1.3 * u, 0.12 + 0.2 * (1 - u)], [-0.45, 1.55, 0.05], 0, 0);
      return SIL(arm([0.3, 1.05, -0.06], [0.5, 1.25, -0.1], 0, 0.3), R,
        { dip: 0.06 + 0.04 * Math.abs(s), hx: 0.06 * s, roll: -0.1 * s, ty: -0.25 * s, yaw: 0.15 * s, head: [-0.2 * u + 0.05, -0.3 * u, 0.1 * s], stance: 0.12 });
    },
  },
  flex: {   // bully taunt: double-biceps flex, chest out, little bounce
    dur: 1.7, blendIn: 0.12, blendOut: 0.3,
    pose(t) {
      const b = Math.abs(Math.sin(t * 7)) * 0.04, f = 0.9 + 0.3 * Math.sin(t * 7);
      return SIL(arm([0.36, 1.82 + b, 0.04], [0.52, 1.5, -0.02], 0.3, f), arm([-0.36, 1.82 + b, 0.04], [-0.52, 1.5, -0.02], -0.3, f),
        { lean: -0.12, dip: 0.05 - b, head: [-0.15, 0.2 * Math.sin(t * 3.5), 0], stance: 0.16 });
    },
  },
};

