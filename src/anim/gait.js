import * as THREE from 'three';
import { poseIK, landGait } from './gaitIK.js';
import { stretchSkirt } from './skirt.js';

// Procedural walk / run for the human rig.
//
// Joints (groups placed at their pivots, built in subjects/human/*.js):
//   legL/legR (hip) -> shinL/shinR (knee) -> footL/footR (ankle)
//   spine (hips, carries the upper body) -> armL/armR (shoulder) -> foreL/foreR (elbow), head
// For a joint hanging down, negative x rotation swings it forward (+z, the way
// the character faces); positive bends a knee back; for the foot, positive
// points the toes down.
//
// Two movement styles:
//  - 'natural': joint angles keyframed from clinical gait data (hip, knee and
//    ankle curves over the cycle, heel strike at 0%). The lowest point of the
//    soles is pinned to the ground, so the body rises over the standing leg
//    and the planted foot does not slide or float.
//      Walk: keyed from a classic animation walk (contact, down, passing, up):
//      heel strike with a nearly straight knee, a soft settle after contact,
//      up after passing, toe push-off behind; the passing knee bends ~45°,
//      just enough to clear the ground (more reads as marching).
//      Run: keyed from a classic animation run cycle (contact, down, passing,
//      up, flight), 4 steps a second, strong lean, big arm swing, high heel
//      tuck behind and high knee in front.
//  - 'skate': the first, sine-based cycle (smooth and gliding; kept as the
//    "Roller skate" option).
// Sources for the shapes of the curves: standard sagittal-plane gait data
// (e.g. Perry & Burnfield; Winter), see README.

export const JOINT_NAMES = ['spine', 'head', 'legL', 'legR', 'shinL', 'shinR', 'footL', 'footR', 'armL', 'armR', 'foreL', 'foreR', 'wingL', 'wingR', 'skirt'];

const lerp = (a, b, t) => a + (b - a) * t;
const clamp01 = (x) => Math.max(0, Math.min(1, x));
const pos = (x) => Math.max(0, x);
const D = Math.PI / 180;

export const WALK_SPEED = 1.6; // m/s

/**
 * Walk lab presets (City: the Walk lab panel tunes the main character).
 * stride, knee, arms, lean, sway, cadence: 1 = the natural cycle; bounce: extra
 * up-and-down (0 = none); mode: a special way of moving (sneak, power,
 * swagger, stiff for walking; wheel, panic, ninja for running).
 */
export const WALK_STYLES = {
  'Natural': {},
  'Relaxed stroll': { stride: 0.85, knee: 0.8, bounce: 0.3, arms: 0.7, lean: 0.5, sway: 1.3, cadence: 0.85 },
  'Bouncy cartoon': { stride: 1.15, knee: 1.5, bounce: 2.6, arms: 1.6, lean: 0.8, sway: 1.1, cadence: 1.1 },
  'Power walk': { stride: 1.25, knee: 1, bounce: 0.5, arms: 1.6, lean: 1.8, sway: 1.2, cadence: 1.3, mode: 'power' },
  'Sneak': { stride: 0.7, knee: 1.3, bounce: 0, arms: 0.4, lean: 1.4, sway: 0.6, cadence: 0.7, mode: 'sneak' },
  'Swagger': { stride: 1.05, knee: 1.1, bounce: 1.2, arms: 1.3, lean: -0.5, sway: 3, cadence: 0.85, mode: 'swagger' },
  'Stiff toy': { stride: 0.8, knee: 1, bounce: 0, arms: 0.9, lean: 0, sway: 1.5, cadence: 1.15, mode: 'stiff' },
};
/**
 * The walks and runs a character can have (the owner's picks, tuned in the
 * Walk lab): chosen separately in the character creator (walkStyle,
 * runStyle); townspeople get a random mix, mostly Natural.
 */
export const WALKS = {
  Natural: { stride: 0.85, knee: 1.1, bounce: 1.9, arms: 1.7, lean: 1.05, sway: 1, cadence: 1.1 },
  Brisk: { stride: 1.05, knee: 1.1, bounce: 0, arms: 1.15, lean: 1.3, sway: 1.1, cadence: 1.1 },
  Swagger: { stride: 1.05, knee: 1.65, bounce: 2.3, arms: 1.3, lean: -0.5, sway: 0.3, cadence: 0.85, mode: 'swagger' },
  Sneak: { stride: 0.55, knee: 1.4, bounce: 0, arms: 0, lean: 2.5, sway: 0, cadence: 0.6, mode: 'sneak' },
};
export const RUNS = {
  Natural: { stride: 1, knee: 1.15, bounce: 1.8, arms: 1.5, lean: 1, sway: 1.3, cadence: 1.2 },
  Ninja: { stride: 1.1, knee: 1.15, bounce: 0, arms: 0, lean: 2.5, sway: 0, cadence: 1.6, mode: 'ninja' },
  Panic: { stride: 1, knee: 1.25, bounce: 1, arms: 1, lean: -0.3, sway: 1, cadence: 1.2, mode: 'panic' },
};
// everyone switches from walk to run quickly: from 1.6 m/s, over 0.2 m/s
export const RUN_AT = 1.6, RUN_BLEND = 0.2;
const tuneCache = new Map();
/** The gait tune for a look ({ walkStyle, runStyle }), shared per combination. */
export function tuneOf(look = {}) {
  const w = WALKS[look.walkStyle] ? look.walkStyle : 'Natural', r = RUNS[look.runStyle] ? look.runStyle : 'Natural';
  const key = `${w}|${r}`;
  if (!tuneCache.has(key)) tuneCache.set(key, { walk: WALKS[w], run: RUNS[r], runAt: RUN_AT, blend: RUN_BLEND, fps: 0 });
  return tuneCache.get(key);
}

export const RUN_STYLES = {
  'Natural sprint': {},
  'Jog': { stride: 0.8, knee: 0.8, arms: 0.7, lean: 0.5, cadence: 0.85, bounce: 0.6 },
  'Cartoon wheel': { stride: 1, knee: 1, arms: 1.8, lean: 1.4, cadence: 1.45, mode: 'wheel' },
  'Panic': { stride: 1, knee: 1.25, arms: 1, lean: -0.3, cadence: 1.2, bounce: 1, mode: 'panic' },
  'Ninja': { stride: 1.15, knee: 1.1, arms: 1, lean: 2.2, cadence: 1.15, mode: 'ninja' },
};
export const RUN_SPEED = 4.2;
// how fast people run in the City: you are 1.25x faster than any townsperson
export const PLAYER_RUN_SPEED = 4.6;
export const NPC_RUN_SPEED = PLAYER_RUN_SPEED / 1.25; // 3.68 m/s

// --- keyframes: [cycle fraction, degrees]; hip & knee flexion positive,
// ankle dorsiflexion (toes up) positive ---------------------------------------
// Walk: keyed from the classic animation walk (contact, down, passing, up,
// contact per step), read for the left leg. "The weight goes DOWN just after
// the contact, and UP just after the passing position": the down pose bends
// the standing knee; the up pose straightens it and rises onto the ball of
// the foot. Ground pinning turns that into the body's up-and-down.
//  contact (0)    leg forward, knee straight, heel down and toes up
//  down    (1/8)  standing knee bent, foot flat; back foot peeling off
//  passing (2/8)  standing leg upright; other leg passes, knee bent, foot hanging
//  up      (3/8)  standing leg straight, heel lifting; other leg reaching forward
//  contact (4/8)  this leg is now behind, on its toes
// The second half is the other leg's first half.
// Kept relaxed so it does not read as marching: the passing knee only lifts
// enough for the foot to clear the ground, the leg reaches forward moderately,
// and the "down" is a soft settle rather than a drop.
const WALK = {
  hip: [[0, 25], [1 / 8, 18], [2 / 8, 6], [3 / 8, -6], [4 / 8, -13], [5 / 8, -6], [6 / 8, 12], [7 / 8, 24]],
  knee: [[0, 4], [1 / 8, 14], [2 / 8, 8], [3 / 8, 4], [4 / 8, 12], [5 / 8, 36], [6 / 8, 45], [7 / 8, 20]],
  ankle: [[0, 8], [1 / 8, -2], [2 / 8, 3], [3 / 8, -4], [4 / 8, -12], [5 / 8, -14], [6 / 8, -4], [7 / 8, 4]],
};
// Run: keyed from a classic animation run cycle (7 drawings per step:
// contact, down, -, passing, up, -, contact), read for the left leg:
//  1 contact  (0/12)  leg reaching forward, heel landing
//  2 down     (1/12)  knee bent deep, body lowest
//  4 passing  (3/12)  standing leg straightening, other heel tucked high behind
//  5 up       (4/12)  push-off leg extended behind on the toe, body highest
//  6          (5/12)  both feet off the ground
//  7 contact  (6/12)  the other foot lands; this leg folds up behind
// The second half of the cycle is the other leg's first half.
const RUN = {
  hip: [[0, 35], [1 / 12, 15], [2 / 12, 0], [3 / 12, -15], [4 / 12, -25], [5 / 12, -20],
    [6 / 12, -15], [7 / 12, 10], [8 / 12, 35], [9 / 12, 55], [10 / 12, 68], [11 / 12, 55]],
  knee: [[0, 10], [1 / 12, 48], [2 / 12, 35], [3 / 12, 20], [4 / 12, 8], [5 / 12, 50],
    [6 / 12, 100], [7 / 12, 125], [8 / 12, 115], [9 / 12, 100], [10 / 12, 78], [11 / 12, 38]],
  ankle: [[0, 0], [1 / 12, 22], [2 / 12, 15], [3 / 12, -5], [4 / 12, -30], [5 / 12, -22],
    [6 / 12, -12], [7 / 12, 0], [8 / 12, 2], [9 / 12, 6], [10 / 12, 6], [11 / 12, 4]],
};

/** Periodic Catmull-Rom through keyframes (u in [0, 1)). */
function sample(keys, u) {
  u = ((u % 1) + 1) % 1;
  const n = keys.length;
  let i = n - 1;
  for (let k = 0; k < n; k++) if (keys[k][0] <= u) i = k;
  const at = (k) => keys[((k % n) + n) % n][1];
  const t0 = keys[i][0];
  const t1 = i + 1 < n ? keys[i + 1][0] : 1;
  const s = (u - t0) / Math.max(t1 - t0, 1e-6);
  const p0 = at(i - 1), p1 = at(i), p2 = at(i + 1), p3 = at(i + 2);
  return 0.5 * (2 * p1 + (-p0 + p2) * s + (2 * p0 - 5 * p1 + 4 * p2 - p3) * s * s + (-p0 + 3 * p1 - 3 * p2 + p3) * s * s * s);
}

/**
 * Which gait engine people use: 'New' (foot targets + IK, learnt from
 * iso-city: gaitIK.js) or 'Classic' (keyframed legs, the lowest foot pinned).
 * Set from the character creator (Animation) and the Walk lab.
 */
let ENGINE = 'New';
export function setGaitEngine(e) { ENGINE = e === 'Classic' ? 'Classic' : 'New'; }
export function gaitEngine() { return ENGINE; }
export { landGait };

export function createGait(phase = 0) {
  return { phase, amount: 0, run: 0, t: Math.random() * 10 };
}

/** Advance the cycle for an entity moving at `speed` m/s. */
export function stepGait(g, dt, speed, tune = null) {
  g.dt = (g.dt ?? 0) + dt; g.speed = speed; // the New engine advances its stride by distance (gaitIK.js)
  const amountTarget = clamp01(speed / 0.6);
  // when running starts and how long walk and run are blended (Walk lab: runAt, blend)
  const runTarget = clamp01((speed - (tune?.runAt ?? 2.2)) / (tune?.blend ?? 1.6));
  const k = Math.min(1, dt * 6);
  g.amount += (amountTarget - g.amount) * k;
  g.run += (runTarget - g.run) * k;
  // cadence: about 1.8 steps/s walking, 4 running (a full cycle is two steps)
  const refSpeed = lerp(WALK_SPEED, RUN_SPEED, g.run);
  const stride = Math.max(0.55, Math.min(1.25, speed / refSpeed));
  const cadence = tune ? lerp(tune.walk?.cadence ?? 1, tune.run?.cadence ?? 1, g.run) : 1;
  const omega = lerp(5.6, 12.6, g.run) * stride * cadence;
  if (g.amount > 0.01) g.phase += omega * dt;
  g.t += dt;
}

function jointsOf(body) {
  if (!body.userData.joints) {
    const j = {};
    body.traverse((o) => { if (JOINT_NAMES.includes(o.name)) j[o.name] = o; });
    body.userData.joints = j;
  }
  return body.userData.joints;
}

// ---------------------------------------------------------------------------
// Natural gait

const tmp = new THREE.Vector3();

/** Lowest sole point (heel or toe of either foot) in the body's parent space. */
function lowestSole(body, j) {
  body.updateWorldMatrix(true, true);
  let min = Infinity;
  for (const name of ['footL', 'footR']) {
    const foot = j[name];
    if (!foot?.userData.sole) continue;
    for (const p of foot.userData.sole) {
      tmp.copy(p).applyMatrix4(foot.matrixWorld);
      if (body.parent) body.parent.worldToLocal(tmp);
      min = Math.min(min, tmp.y);
    }
  }
  return min === Infinity ? 0 : min;
}

function poseNatural(body, g, tune = null) {
  const j = jointsOf(body);
  const a = g.amount, run = g.run;
  // a tune (Walk lab): walk and run settings, blended like the poses
  const W = tune?.walk ?? {}, R = tune?.run ?? {};
  const tv = (k, d = 1) => lerp(W[k] ?? d, R[k] ?? d, run);
  const wm = W.mode ?? 'natural', rm = R.mode ?? 'natural';
  const wOf = (mode) => (wm === mode ? 1 - run : 0) + (rm === mode ? run : 0); // how much a special mode applies
  // choppy frame rate (pixel feel): the pose only moves on whole frames
  let ph = g.phase;
  if (tune?.fps) { g.held ??= { t: -1, phase: 0 }; if (g.t - g.held.t >= 1 / tune.fps || g.t < g.held.t) { g.held = { t: g.t, phase: g.phase }; } ph = g.held.phase; }
  const u = ph / (Math.PI * 2); // cycle fraction, left heel strike at 0
  const legAt = (key, uu) => lerp(sample(WALK[key], uu), sample(RUN[key], uu), run);
  const stride = tv('stride'), kneeK = tv('knee'), armK = tv('arms');
  const crouch = wOf('sneak'), wheel = wOf('wheel'), stiff = wOf('stiff');
  for (const [side, uu, opp] of [['L', u, u + 0.5], ['R', u + 0.5, u]]) {
    let hip = legAt('hip', uu) * stride, knee = legAt('knee', uu) * kneeK * (1 - 0.85 * stiff), ankle = legAt('ankle', uu) * stride;
    if (crouch) { hip += 22 * crouch; knee += 38 * crouch; ankle += 12 * crouch; } // knees bent, low and careful
    if (wheel) { const q = Math.PI * 2 * uu; hip = lerp(hip, 55 * Math.cos(q) + 20, wheel); knee = lerp(knee, 75 + 55 * Math.sin(q), wheel); ankle = lerp(ankle, -10 * Math.sin(q), wheel); } // legs go round like a wheel
    if (j[`leg${side}`]) j[`leg${side}`].rotation.x = -hip * D * a;
    if (j[`shin${side}`]) j[`shin${side}`].rotation.x = knee * D * a;
    if (j[`foot${side}`]) j[`foot${side}`].rotation.x = -ankle * D * a;
    // arms swing with the opposite leg: forward when that leg's heel strikes
    const c = Math.cos(Math.PI * 2 * opp);
    let shoulder = lerp(3 + 15 * c * armK, 10 + 50 * c * armK, run);   // running: big swing, forward ~60°, back ~40°
    let elbow = lerp(14 + 10 * c, 90 + 20 * c, run);     // forward arm bent more than the back arm
    const power = wOf('power'), panic = wOf('panic'), ninja = wOf('ninja'), swag = wOf('swagger');
    if (power) { elbow = lerp(elbow, 90, power); shoulder = lerp(shoulder, 10 + 45 * c, power); }               // elbows at 90°, pumping
    if (crouch) { elbow = lerp(elbow, 70, crouch); shoulder = lerp(shoulder, 25 + 6 * c, crouch); }              // hands up in front, tiptoeing
    if (panic) { const fl = Math.sin(g.t * 22 + (side === 'L' ? 0 : 2)); shoulder = lerp(shoulder, 150 + 25 * fl, panic); elbow = lerp(elbow, 30 + 30 * fl, panic); } // arms waving over the head
    if (ninja) { shoulder = lerp(shoulder, -55, ninja); elbow = lerp(elbow, 5, ninja); }                           // arms straight out behind
    if (stiff) elbow = lerp(elbow, 0, stiff);                                                                       // arms like a toy's
    const arm = j[`arm${side}`];
    if (arm) {
      arm.rotation.x = -shoulder * D * a;
      // running: arms tuck closer to the body and come a little across the
      // chest on the forward swing (never past the centre line)
      if (arm.userData.baseZ === undefined) arm.userData.baseZ = arm.rotation.z;
      const sx = side === 'L' ? 1 : -1;
      arm.rotation.z = arm.userData.baseZ * (1 - 0.45 * run * a) - sx * 7 * D * pos(c) * run * a
        + sx * 18 * D * swag * a + sx * 35 * D * panic * a;                                                          // swagger: arms out a little
    }
    if (j[`fore${side}`]) j[`fore${side}`].rotation.x = -elbow * D * a;
  }
  // trunk. Lean and twist happen at the spine (hips), not around the feet:
  //  - the upper body leans forward from the hips (more when running)
  //  - pelvis and shoulders counter-rotate: as the left leg swings forward,
  //    the left hip comes forward and the right shoulder comes forward
  //  - the head turns back against the shoulders so it keeps facing ahead,
  //    and tilts up a little against the lean so the eyes stay on the path
  const c0 = Math.cos(Math.PI * 2 * u); // 1 at left heel strike
  const sway = tv('sway');
  const swagT = wOf('swagger'), stiffT = wOf('stiff');
  const pelvis = lerp(4, 7, run) * D * a * sway;
  const shoulders = lerp(4, 9, run) * D * a * sway;
  const lean = (lerp(2, 16, run) * tv('lean') + 14 * crouch) * D * a;
  body.rotation.x = 5 * D * run * a * tv('lean');  // plus some whole-body lean from the ankles
  body.rotation.y = -pelvis * c0;             // left hip forward at left heel strike
  body.rotation.z = (g.turn ?? 0) + (1.5 + 4 * swagT + 6 * stiffT) * D * Math.sin(Math.PI * 2 * u) * a * (1 - run) * Math.max(1, sway * 0.6); // side sway (a waddle for the toy)
  if (j.spine) {
    j.spine.rotation.x = lean;
    j.spine.rotation.y = (pelvis + shoulders) * c0; // undo the pelvis, then turn the shoulders the other way
    j.spine.rotation.z = -0.8 * D * Math.sin(Math.PI * 2 * u) * a; // small counter-sway
  }
  if (j.head) {
    j.head.rotation.y = -shoulders * c0;
    j.head.rotation.x = -lean * 0.7;
  }
  // keep the standing foot on the ground; when running, float between steps
  body.position.y = 0;
  const ground = lowestSole(body, j);
  // flight: centred between push-off (4/12) and the next contact (6/12)
  const flight = 0.06 * Math.pow(pos(Math.cos(Math.PI * 4 * (u - 5 / 12))), 2) * run * a;
  const breathe = 0.004 * Math.sin(g.t * 2.2) * (1 - a);
  // extra bounce on top (bouncy styles): up twice a cycle, on each passing
  const bounce = Math.max(0, tv('bounce', 0)) * 0.035 * Math.pow(Math.sin(Math.PI * 2 * u), 2) * a;
  body.position.y = -ground + flight + breathe + bounce;
}

// ---------------------------------------------------------------------------
// Roller skate (the first, sine-based cycle)

function skateLeg(psi, run) {
  const hipW = -0.42 * Math.sin(psi);
  const hipR = -0.78 * Math.sin(psi) - 0.18;
  const kneeW = 0.08 + 0.95 * Math.pow(pos(Math.cos(psi + 0.3)), 1.5) + 0.12 * pos(Math.sin(psi + 0.6));
  const kneeR = 0.4 + 1.6 * Math.pow(pos(Math.cos(psi + 0.45)), 1.2);
  const hip = lerp(hipW, hipR, run);
  const knee = lerp(kneeW, kneeR, run);
  const toe = 0.32 * pos(-Math.sin(psi + 0.5)) - 0.18 * pos(Math.sin(psi));
  return { hip, knee, foot: -(hip + knee) * 0.9 + toe };
}

function skateArm(psi, run) {
  const swing = -lerp(0.32, 0.72, run) * Math.sin(psi) + lerp(0.04, -0.1, run);
  const elbow = lerp(0.22 + 0.28 * pos(Math.sin(psi)), 1.35 + 0.25 * Math.sin(psi), run);
  return { swing, elbow };
}

function poseSkate(body, g) {
  const j = jointsOf(body);
  // the skate cycle moves the whole body; keep the upper-body joints neutral
  for (const n of ['spine', 'head']) if (j[n]) j[n].rotation.set(0, 0, 0);
  for (const n of ['armL', 'armR']) if (j[n] && j[n].userData.baseZ !== undefined) j[n].rotation.z = j[n].userData.baseZ;
  const a = g.amount, run = g.run, phi = g.phase;
  for (const [side, psi] of [['L', phi], ['R', phi + Math.PI]]) {
    const leg = skateLeg(psi, run);
    if (j[`leg${side}`]) j[`leg${side}`].rotation.x = leg.hip * a;
    if (j[`shin${side}`]) j[`shin${side}`].rotation.x = leg.knee * a;
    if (j[`foot${side}`]) j[`foot${side}`].rotation.x = leg.foot * a;
    const arm = skateArm(side === 'L' ? phi + Math.PI : phi, run);
    if (j[`arm${side}`]) j[`arm${side}`].rotation.x = arm.swing * a;
    if (j[`fore${side}`]) j[`fore${side}`].rotation.x = -arm.elbow * a;
  }
  const c2 = Math.cos(2 * phi);
  const bob = lerp(0.022 * c2, 0.035 - 0.045 * c2, run) * a;
  body.position.y = bob + 0.004 * Math.sin(g.t * 2.2) * (1 - a);
  body.rotation.x = 0.16 * run * a;
  body.rotation.z = 0.025 * Math.sin(phi) * a * (1 - run);
  body.rotation.y = 0.06 * Math.sin(phi) * a;
}

/** Pose `body` (the character root) for gait state `g`. style: 'natural' | 'skate'. */
export function poseGait(body, g, style = 'natural', tune = null) {
  if (style === 'skate') poseSkate(body, g);
  else if (ENGINE === 'New' && jointsOf(body).footL?.userData.sole) poseIK(body, g, tune, jointsOf(body));
  else poseNatural(body, g, tune);
  poseHold(body, body.userData.hold ?? {});
  flapWings(body, g);
  const j = jointsOf(body);
  if (j.skirt) stretchSkirt(j.skirt, [j.shinL, j.shinR]);
}

/**
 * Pose kept on top of the walk: a grandparent's stoop (body.userData.stoop,
 * radians forward at the hips, the head tilted back up) and the arms holding
 * something (hold = HOLD_POSES entry in subjects/human/handheld.js:
 * armR / foreR / armL / foreL x angles, armRz turns the right arm inward).
 * Called after the walk pose each frame (and once by human.build).
 */
export function poseHold(body, hold) {
  const j = jointsOf(body);
  const stoop = body.userData.stoop ?? 0;
  if (stoop) {
    if (j.spine) j.spine.rotation.x += stoop;
    if (j.head) j.head.rotation.x -= stoop * 0.7;
  }
  for (const name of ['armR', 'foreR', 'armL', 'foreL']) {
    const o = j[name];
    if (!o || hold[name] === undefined) continue;
    o.rotation.x = hold[name];
    if (name === 'armR' && hold.armRz) {
      o.userData.baseZ ??= o.rotation.z;
      o.rotation.z = o.userData.baseZ + hold.armRz;
    }
  }
}

/** Wings beat slowly and gently all the time, a little faster when running. */
function flapWings(body, g) {
  const j = jointsOf(body);
  for (const [name, sx] of [['wingL', -1], ['wingR', 1]]) {
    const w = j[name];
    if (!w) continue;
    const base = w.userData.restY ??= w.rotation.y;
    const beat = Math.sin(g.t * (1.8 + 1.2 * g.run));
    w.rotation.y = base + sx * (0.2 + 0.14 * beat); // folds back, then opens out
    w.rotation.z = sx * 0.05 * beat;                // tips lift a touch on the way out
  }
}
