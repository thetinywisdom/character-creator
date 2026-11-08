import * as THREE from 'three';

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

export const JOINT_NAMES = ['spine', 'head', 'legL', 'legR', 'shinL', 'shinR', 'footL', 'footR', 'armL', 'armR', 'foreL', 'foreR'];

const lerp = (a, b, t) => a + (b - a) * t;
const clamp01 = (x) => Math.max(0, Math.min(1, x));
const pos = (x) => Math.max(0, x);
const D = Math.PI / 180;

export const WALK_SPEED = 1.6; // m/s
export const RUN_SPEED = 4.2;

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

export function createGait(phase = 0) {
  return { phase, amount: 0, run: 0, t: Math.random() * 10 };
}

/** Advance the cycle for an entity moving at `speed` m/s. */
export function stepGait(g, dt, speed) {
  const amountTarget = clamp01(speed / 0.6);
  const runTarget = clamp01((speed - 2.2) / 1.6);
  const k = Math.min(1, dt * 6);
  g.amount += (amountTarget - g.amount) * k;
  g.run += (runTarget - g.run) * k;
  // cadence: about 1.8 steps/s walking, 4 running (a full cycle is two steps)
  const refSpeed = lerp(WALK_SPEED, RUN_SPEED, g.run);
  const stride = Math.max(0.55, Math.min(1.25, speed / refSpeed));
  const omega = lerp(5.6, 12.6, g.run) * stride;
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

function poseNatural(body, g) {
  const j = jointsOf(body);
  const a = g.amount, run = g.run;
  const u = g.phase / (Math.PI * 2); // cycle fraction, left heel strike at 0
  const legAt = (key, uu) => lerp(sample(WALK[key], uu), sample(RUN[key], uu), run);
  for (const [side, uu, opp] of [['L', u, u + 0.5], ['R', u + 0.5, u]]) {
    const hip = legAt('hip', uu), knee = legAt('knee', uu), ankle = legAt('ankle', uu);
    if (j[`leg${side}`]) j[`leg${side}`].rotation.x = -hip * D * a;
    if (j[`shin${side}`]) j[`shin${side}`].rotation.x = knee * D * a;
    if (j[`foot${side}`]) j[`foot${side}`].rotation.x = -ankle * D * a;
    // arms swing with the opposite leg: forward when that leg's heel strikes
    const c = Math.cos(Math.PI * 2 * opp);
    const shoulder = lerp(3 + 15 * c, 10 + 50 * c, run);   // running: big swing, forward ~60°, back ~40°
    const elbow = lerp(14 + 10 * c, 90 + 20 * c, run);     // forward arm bent more than the back arm
    const arm = j[`arm${side}`];
    if (arm) {
      arm.rotation.x = -shoulder * D * a;
      // running: arms tuck closer to the body and come a little across the
      // chest on the forward swing (never past the centre line)
      if (arm.userData.baseZ === undefined) arm.userData.baseZ = arm.rotation.z;
      const sx = side === 'L' ? 1 : -1;
      arm.rotation.z = arm.userData.baseZ * (1 - 0.45 * run * a) - sx * 7 * D * pos(c) * run * a;
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
  const pelvis = lerp(4, 7, run) * D * a;
  const shoulders = lerp(4, 9, run) * D * a;
  const lean = lerp(2, 16, run) * D * a;
  body.rotation.x = 5 * D * run * a;          // plus some whole-body lean from the ankles
  body.rotation.y = -pelvis * c0;             // left hip forward at left heel strike
  body.rotation.z = 1.5 * D * Math.sin(Math.PI * 2 * u) * a * (1 - run);
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
  body.position.y = -ground + flight + breathe;
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
export function poseGait(body, g, style = 'natural') {
  if (style === 'skate') poseSkate(body, g);
  else poseNatural(body, g);
}
