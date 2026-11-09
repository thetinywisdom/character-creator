// The "New" gait engine (Animation: New in the character creator).
//
// Learnt from the owner's previous game (iso-city): instead of playing back
// keyframed leg angles and pinning the lowest foot to the ground, this decides
// WHERE each foot goes and bends the hip and knee to reach it (2-bone IK).
//
//  - The cycle advances by distance travelled (one cycle = one stride of two
//    steps), so a planted foot moves back at exactly the body's speed: no
//    sliding at any speed, for any height (children take quicker steps).
//  - Each foot is planted for part of the cycle (duty: walk 0.6, run 0.3, so a
//    run has a real moment with both feet off the ground) and swings forward
//    on a raised curve the rest of the time; running swings tuck the heel high
//    behind first.
//  - Heel strike (toes up, rolling on the heel), flat foot, then push-off
//    (rolling over the toes).
//  - The hips ride as high as the planted leg allows, which gives the walk its
//    natural up-and-down twice a cycle; a run sinks into each landing and
//    floats between steps.
//  - Walk and run are blended as settings (stride, time on the ground, lift,
//    bounce, lean, arm swing), never as finished poses.
//  - Weight: a dip when stopping hard, a squash on landing a jump, a lean
//    forward when speeding up, a lean into turns inside the body (the feet stay
//    on the ground), the head kept steady, a look around when standing.
//
// The style settings (WALKS / RUNS in gait.js: stride, knee, bounce, arms,
// lean, sway, cadence, mode) still apply on top as multipliers.

import * as THREE from 'three';

const D = Math.PI / 180;
const lerp = (a, b, t) => a + (b - a) * t;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const pos = (v) => Math.max(0, v);
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const frac = (v) => v - Math.floor(v);
/** Soft minimum (rounds the corner where the two meet). */
const smin = (a, b, k) => { const h = clamp(0.5 + 0.5 * (b - a) / k, 0, 1); return lerp(b, a, h) - k * h * (1 - h); };

/** Leg measurements of a body, read once from its bones. */
function rigOf(body, j) {
  if (body.userData.legRig) return body.userData.legRig;
  const sole = j.footL.userData.sole ?? [];
  const heel = sole.reduce((m, p) => (!m || p.z < m.z ? p : m), null) ?? { y: -0.07, z: -0.06 };
  const toe = sole.reduce((m, p) => (!m || p.z > m.z ? p : m), null) ?? { y: -0.07, z: 0.18 };
  const L1 = Math.abs(j.shinL.position.y), L2 = Math.abs(j.footL.position.y);
  const rig = {
    L1, L2, L: L1 + L2, hipY: j.legL.position.y,
    heel: { y: heel.y, z: heel.z }, toe: { y: toe.y, z: toe.z }, mid: (heel.z + toe.z) / 2,
  };
  body.userData.legRig = rig;
  return rig;
}

// natural style settings: the styles are measured against these
const NAT = { walk: { stride: 0.85, cadence: 1.1, bounce: 1.9 }, run: { stride: 1, cadence: 1.2, bounce: 1.8 } };

const inv = new THREE.Matrix4();
const tv3 = new THREE.Vector3();

/** Foot pitch (toes up positive) and ankle position for a contact point. */
function ankleFrom(rig, groundZ, groundY, pitch, out) {
  // pivot on the heel while the toes are up, on the toes while the heel is up
  const p = pitch >= 0 ? rig.heel : rig.toe;
  const r = -pitch; // rotation.x of the foot (toes down positive)
  const c = Math.cos(r), s = Math.sin(r);
  const py = p.y * c - p.z * s, pz = p.y * s + p.z * c;
  out.y = groundY - py;
  out.z = groundZ + (p.z - rig.mid) - pz;
  return out;
}

/**
 * Pose a person with the IK gait. g: gait state (stepGait stores g.dt and
 * g.speed; this advances the stride by distance). tune: walk / run styles.
 */
export function poseIK(body, g, tune, j) {
  const rig = rigOf(body, j);
  const dt = g.dt ?? 0, speed = g.speed ?? 0;
  g.dt = 0; // posed again without a step: do not advance twice
  const W = tune?.walk ?? {}, R = tune?.run ?? {};

  // --- smooth weights: moving at all, and walk -> run ------------------------
  g.amt ??= 0; g.rw ??= 0; g.cyc ??= Math.random();
  const kA = Math.min(1, dt * 8), kR = Math.min(1, dt * 6);
  g.amt += (smooth(0.03, 0.5, speed) - g.amt) * kA;
  g.rw += (smooth(2.0, 3.3, speed) - g.rw) * kR;
  const amt = g.amt, rw = g.rw;
  const tv = (k, d = 1) => lerp(W[k] ?? d, R[k] ?? d, rw);
  const wm = W.mode ?? 'natural', rm = R.mode ?? 'natural';
  const wOf = (mode) => (wm === mode ? 1 - rw : 0) + (rm === mode ? rw : 0);
  const crouch = wOf('sneak');

  // --- stride: from speed and leg length; a style changes the step length ---
  const L = rig.L, vn = speed * 0.75 / L; // speed as if the legs were 0.75 m
  const styleStep = (s, nat) => clamp(((s.stride ?? 1) / (s.cadence ?? 1)) / (nat.stride / nat.cadence), 0.75, 1.35);
  const walkCyc = L * clamp(0.9 + 0.55 * vn, 1.0, 1.85) * styleStep(W, NAT.walk);
  const runCyc = L * clamp(1.5 + 0.45 * vn, 2.3, 3.8) * styleStep(R, NAT.run);
  const cycle = lerp(walkCyc, runCyc, rw) * lerp(0.35, 1, amt); // small shuffling steps when nearly still
  g.cyc += (speed * dt) / cycle;
  // choppy frame rate (Walk lab): the pose only moves on whole frames
  let cyc = g.cyc;
  if (tune?.fps) { g.heldIK ??= { t: -1, cyc: 0 }; if (g.t - g.heldIK.t >= 1 / tune.fps || g.t < g.heldIK.t) g.heldIK = { t: g.t, cyc: g.cyc }; cyc = g.heldIK.cyc; }

  const duty = lerp(0.6 + 0.1 * crouch, 0.3, rw);
  const travel = cycle * duty;                 // how far a planted foot moves back
  const ahead = lerp(0.5, 0.42, rw);           // share of it in front of the hip
  const lift = lerp(0.1, 0.42, rw) * L * clamp(tv('knee'), 0.5, 1.8) * amt;
  const heelUp = lerp(18, 8, rw) * D * amt, toeOff = lerp(30, 45, rw) * D * amt;
  const bob = clamp(tv('bounce', 0) / lerp(NAT.walk.bounce, NAT.run.bounce, rw), 0, 1.6);

  // --- feet: where each one is -------------------------------------------------
  const feet = {};
  for (const [side, off] of [['L', 0], ['R', 0.5]]) {
    const ul = frac(cyc + off);
    const f = { stance: ul < duty, s: 0, ankle: { y: 0, z: 0 } };
    let z, y = 0, pitch;
    if (f.stance) {
      const s = ul / duty; f.s = s;
      z = travel * (ahead - s);
      const roll = lerp(0.55, 0.45, rw);
      pitch = s < 0.12 ? heelUp * (1 - s / 0.12) : s > roll ? -toeOff * Math.pow((s - roll) / (1 - roll), 1.5) : 0;
    } else {
      const s = (ul - duty) / (1 - duty); f.s = s;
      // the foot leaves and lands moving back at ground speed (no skid at touch-down);
      // running, that keeps the heel going back and up first, then the leg reaches forward
      const z0 = -travel * (1 - ahead), z1 = travel * ahead, m = -travel * (1 - duty) / duty;
      const s2 = s * s, s3 = s2 * s;
      z = (2 * s3 - 3 * s2 + 1) * z0 + (s3 - 2 * s2 + s) * m + (-2 * s3 + 3 * s2) * z1 + (s3 - s2) * m;
      y = lift * Math.sin(Math.PI * Math.pow(s, lerp(0.85, 0.65, rw)));
      pitch = lerp(-toeOff, heelUp, smooth(0.1, 0.9, s)) * (1 - 0.4 * rw * Math.sin(Math.PI * s));
    }
    ankleFrom(rig, z, y, pitch, f.ankle);
    f.pitch = pitch;
    feet[side] = f;
  }

  // --- hips: as high as the planted leg allows (walk), springy (run) ---------
  const reach = 0.985 * L;
  const cap = rig.hipY * (0.985 - 0.16 * crouch) - 0.03 * L * amt;
  let walkY = cap;
  for (const f of Object.values(feet)) {
    if (!f.stance) continue;
    walkY = smin(walkY, f.ankle.y + Math.sqrt(pos(reach * reach - f.ankle.z * f.ankle.z)), 0.04 * L);
    if (f.s < 0.3) walkY -= 0.035 * L * bob * Math.sin(Math.PI * f.s / 0.3) * amt; // the knee soaks up the landing
  }
  let runY = rig.hipY * (0.95 - 0.12 * crouch);
  const planted = Object.values(feet).find((f) => f.stance);
  if (planted) runY -= 0.07 * L * (0.5 + 0.5 * bob) * Math.sin(Math.PI * planted.s);
  else {
    // between steps: the foot that pushed off last decides where in the float we are
    const ul = Math.min(frac(cyc) < 0.5 ? frac(cyc) : frac(cyc) - 0.5, 0.5);
    const fl = clamp((ul - duty) / Math.max(0.5 - duty, 0.01), 0, 1);
    runY += 0.06 * L * (0.5 + 0.5 * bob) * 4 * fl * (1 - fl);
  }
  let hipY = lerp(walkY, runY, rw);

  // --- weight: stopping dip, landing squash, speeding-up lean ----------------
  const accel = dt > 0 ? (speed - (g.prevSpeed ?? speed)) / dt : 0;
  g.prevSpeed = speed;
  g.dip ??= 0; g.dipV ??= 0;
  if (dt > 0) {
    const kick = pos(-accel - 2) * 0.02;
    g.dipV += (-140 * g.dip - 16 * g.dipV + kick * 60) * dt;
    g.dip = clamp(g.dip + g.dipV * dt, -0.04, 0.08 * L);
    g.accLean = lerp(g.accLean ?? 0, clamp(accel * 1.6, -6, 9), Math.min(1, dt * 5));
  }
  hipY -= g.dip;

  // --- trunk -------------------------------------------------------------------
  const u = frac(cyc), c0 = Math.cos(Math.PI * 2 * u);
  const sway = tv('sway');
  const swagT = wOf('swagger'), stiffT = wOf('stiff');
  const pelvis = lerp(4, 7, rw) * D * amt * sway;
  const shoulders = lerp(4, 9, rw) * D * amt * sway;
  const turn = g.turn ?? 0;
  body.position.set(0.012 * Math.sin(Math.PI * 2 * u) * (1 - rw) * amt * Math.max(1, sway * 0.6), hipY - rig.hipY, 0);
  body.position.y += 0.004 * Math.sin((g.t ?? 0) * 2.2) * (1 - amt); // breathing
  const tilt = 5 * D * rw * amt * tv('lean'); // running: the whole body leans a little from the feet too
  body.rotation.set(tilt, -pelvis * c0,
    (1.5 + 4 * swagT + 6 * stiffT) * D * Math.sin(Math.PI * 2 * u) * amt * (1 - rw) * Math.max(1, sway * 0.6) + turn * 0.65);
  const lean = (lerp(3, 14, rw) * tv('lean') + 14 * crouch + (g.accLean ?? 0) * amt) * D * amt + g.dip * 2.5;
  if (j.spine) {
    j.spine.rotation.x = lean;
    j.spine.rotation.y = (pelvis + shoulders) * c0;
    j.spine.rotation.z = -0.8 * D * Math.sin(Math.PI * 2 * u) * amt + turn * 0.35;
  }

  // --- legs: bend hip and knee to reach the foot targets (2-bone IK) ----------
  body.updateMatrix();
  inv.copy(body.matrix).invert();
  for (const side of ['L', 'R']) {
    const leg = j[`leg${side}`], shin = j[`shin${side}`], foot = j[`foot${side}`];
    if (!leg || !shin) continue;
    const f = feet[side];
    tv3.set(leg.position.x, f.ankle.y, f.ankle.z).applyMatrix4(inv);
    const dy = tv3.y - leg.position.y, dz = tv3.z - leg.position.z;
    const L1 = rig.L1, L2 = rig.L2;
    const d = clamp(Math.hypot(dy, dz), 0.3 * L, 0.999 * L);
    const knee = Math.PI - Math.acos(clamp((L1 * L1 + L2 * L2 - d * d) / (2 * L1 * L2), -1, 1));
    const thigh = Math.atan2(dz, -dy) + Math.acos(clamp((L1 * L1 + d * d - L2 * L2) / (2 * L1 * d), -1, 1));
    leg.rotation.x = -thigh;
    shin.rotation.x = knee;
    // sideways: the hips sway and turn over the planted foot, so swing the leg out or in to keep it there
    const abd = Math.asin(clamp((tv3.x - leg.position.x) / d, -0.5, 0.5));
    leg.rotation.z = abd;
    if (foot) { foot.rotation.set(-f.pitch + thigh - knee - tilt, -body.rotation.y, -abd); } // the foot keeps pointing along the path
  }

  // --- arms ---------------------------------------------------------------------
  const armK = tv('arms');
  const lag = lerp(0.04, 0.02, rw); // the arms trail the legs a little
  const power = wOf('power'), panic = wOf('panic'), ninja = wOf('ninja');
  for (const [side, opp] of [['L', u + 0.5], ['R', u]]) {
    const c = Math.cos(Math.PI * 2 * (opp - lag));
    // a bigger swing forward than back; elbows bend more as the arm swings back (walk), pump (run)
    let shoulder = lerp(3 + armK * (c > 0 ? 17 : 11) * c, 8 + armK * (c > 0 ? 50 : 38) * c, rw);
    let elbow = lerp(14 + 6 * pos(c) + 10 * pos(-c), 85 + 15 * c, rw);
    if (power) { elbow = lerp(elbow, 90, power); shoulder = lerp(shoulder, 10 + 45 * c, power); }
    if (crouch) { elbow = lerp(elbow, 70, crouch); shoulder = lerp(shoulder, 25 + 6 * c, crouch); }
    if (panic) { const fl = Math.sin((g.t ?? 0) * 22 + (side === 'L' ? 0 : 2)); shoulder = lerp(shoulder, 150 + 25 * fl, panic); elbow = lerp(elbow, 30 + 30 * fl, panic); }
    if (ninja) { shoulder = lerp(shoulder, -55, ninja); elbow = lerp(elbow, 5, ninja); }
    if (stiffT) elbow = lerp(elbow, 0, stiffT);
    const arm = j[`arm${side}`];
    if (arm) {
      arm.rotation.x = -shoulder * D * amt;
      if (arm.userData.baseZ === undefined) arm.userData.baseZ = arm.rotation.z;
      const sx = side === 'L' ? 1 : -1;
      arm.rotation.z = arm.userData.baseZ * (1 - 0.45 * rw * amt) - sx * 7 * D * pos(c) * rw * amt
        + sx * 18 * D * swagT * amt + sx * 35 * D * panic * amt;
    }
    if (j[`fore${side}`]) j[`fore${side}`].rotation.x = -elbow * D * amt;
  }

  // --- head: steady, looking ahead; a look around when standing still --------
  if (j.head) {
    g.idle = amt < 0.05 ? (g.idle ?? 0) + dt : 0;
    if (g.idle > (g.nextLook ?? 2.5)) { g.lookTo = (Math.random() - 0.5) * 1.0; g.nextLook = g.idle + 2 + Math.random() * 3; }
    if (!g.idle) { g.lookTo = 0; g.nextLook = 2.5 + Math.random() * 2; }
    g.look = lerp(g.look ?? 0, g.lookTo ?? 0, Math.min(1, dt * 2.5));
    j.head.rotation.y = -shoulders * c0 + pelvis * c0 + g.look;
    j.head.rotation.x = -lean * 0.7;
    j.head.rotation.z = -turn * 0.5;
  }
}

/** A jump landed (falling at vy m/s): the legs squash. */
export function landGait(g, vy) {
  g.dipV = (g.dipV ?? 0) + Math.min(1.6, Math.abs(vy) * 0.22);
}
