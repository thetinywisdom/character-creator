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
//      Walk: heel strike with the hip ~30° forward and the knee nearly straight,
//      small knee give on loading, foot rolls flat, heel rises, toe push-off
//      ~18° at ~62%, knee peaks ~60° in early swing, then reaches forward again.
//      Run: shorter stance (~38%), knee bends ~40° on landing, strong push-off,
//      knee ~100° in swing, flight phases between steps, forward lean,
//      elbows ~90°.
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
const WALK = {
  hip: [[0, 30], [0.1, 25], [0.2, 15], [0.3, 6], [0.4, -3], [0.5, -10], [0.58, -8], [0.66, 4], [0.75, 21], [0.85, 32], [0.93, 32]],
  knee: [[0, 4], [0.08, 13], [0.15, 18], [0.25, 11], [0.4, 5], [0.5, 10], [0.6, 38], [0.7, 62], [0.76, 58], [0.85, 35], [0.95, 6]],
  ankle: [[0, 0], [0.07, -7], [0.15, -1], [0.3, 6], [0.45, 10], [0.53, 4], [0.62, -18], [0.7, -10], [0.8, -1], [0.9, 2]],
};
const RUN = {
  hip: [[0, 28], [0.12, 18], [0.25, 2], [0.38, -12], [0.5, 4], [0.65, 34], [0.8, 48], [0.9, 40]],
  knee: [[0, 20], [0.13, 42], [0.28, 28], [0.38, 18], [0.5, 55], [0.65, 100], [0.74, 104], [0.85, 70], [0.95, 30]],
  ankle: [[0, 2], [0.12, 18], [0.28, 10], [0.38, -22], [0.5, -12], [0.65, 0], [0.85, 4]],
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
  // cadence: about 1.8 steps/s walking, 2.9 running (a full cycle is two steps)
  const refSpeed = lerp(WALK_SPEED, RUN_SPEED, g.run);
  const stride = Math.max(0.55, Math.min(1.25, speed / refSpeed));
  const omega = lerp(5.6, 9.2, g.run) * stride;
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
    const shoulder = lerp(4 + 16 * c, 8 + 32 * c, run);
    const elbow = lerp(18 + 10 * c, 88 + 12 * c, run);
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
  const lean = lerp(2, 10, run) * D * a;
  body.rotation.x = 2 * D * run * a;          // a touch of whole-body lean from the ankles
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
  const flight = 0.055 * Math.pow(pos(Math.cos(Math.PI * 4 * (u - 0.44))), 1.5) * run * a;
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
