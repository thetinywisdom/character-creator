// Procedural walk / run cycle for the human rig.
//
// Joints (groups placed at their pivots, built in subjects/human/*.js):
//   legL/legR (hip) -> shinL/shinR (knee) -> footL/footR (ankle)
//   armL/armR (shoulder) -> foreL/foreR (elbow)
// Angles are rotations about x. For a joint hanging down, negative x swings
// it forward (+z, the way the character faces); positive bends a knee back.
//
// One phase drives everything; the left leg uses phase φ, the right leg
// φ + π, and each arm swings with the opposite leg. Walking blends smoothly
// into running with speed, and both fade out to a standing pose.

export const JOINT_NAMES = ['legL', 'legR', 'shinL', 'shinR', 'footL', 'footR', 'armL', 'armR', 'foreL', 'foreR'];

const lerp = (a, b, t) => a + (b - a) * t;
const clamp01 = (x) => Math.max(0, Math.min(1, x));
const pos = (x) => Math.max(0, x);

export const WALK_SPEED = 1.6; // m/s
export const RUN_SPEED = 4.2;

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

function legPose(psi, run) {
  // hip: forward when sin ψ > 0; running carries the thighs a little forward
  const hipW = -0.42 * Math.sin(psi);
  const hipR = -0.78 * Math.sin(psi) - 0.18;
  // knee: bends most in early swing (cos ψ > 0 is the swing half); running
  // kicks the heel up high and keeps some bend while landing
  const kneeW = 0.08 + 0.95 * Math.pow(pos(Math.cos(psi + 0.3)), 1.5) + 0.12 * pos(Math.sin(psi + 0.6));
  const kneeR = 0.4 + 1.6 * Math.pow(pos(Math.cos(psi + 0.45)), 1.2);
  const hip = lerp(hipW, hipR, run);
  const knee = lerp(kneeW, kneeR, run);
  // ankle: keep the sole roughly level, toes up at heel strike, push off at the back
  const toe = 0.32 * pos(-Math.sin(psi + 0.5)) - 0.18 * pos(Math.sin(psi));
  return { hip, knee, foot: -(hip + knee) * 0.9 + toe };
}

function armPose(psi, run) {
  const swing = -lerp(0.32, 0.72, run) * Math.sin(psi) + lerp(0.04, -0.1, run);
  const elbow = lerp(0.22 + 0.28 * pos(Math.sin(psi)), 1.35 + 0.25 * Math.sin(psi), run);
  return { swing, elbow };
}

/** Pose `body` (the character root) for the gait state `g`. */
export function poseGait(body, g) {
  const j = jointsOf(body);
  const a = g.amount, run = g.run, phi = g.phase;
  for (const [side, psi] of [['L', phi], ['R', phi + Math.PI]]) {
    const leg = legPose(psi, run);
    if (j[`leg${side}`]) j[`leg${side}`].rotation.x = leg.hip * a;
    if (j[`shin${side}`]) j[`shin${side}`].rotation.x = leg.knee * a;
    if (j[`foot${side}`]) j[`foot${side}`].rotation.x = leg.foot * a;
    // each arm swings with the opposite leg
    const arm = armPose(side === 'L' ? phi + Math.PI : phi, run);
    if (j[`arm${side}`]) j[`arm${side}`].rotation.x = arm.swing * a;
    if (j[`fore${side}`]) j[`fore${side}`].rotation.x = -arm.elbow * a;
  }
  // body: rises over each step when walking; when running it dips on landing
  // and floats between steps. Running leans forward; walking sways a little.
  const c2 = Math.cos(2 * phi);
  const bob = lerp(0.022 * c2, 0.035 - 0.045 * c2, run) * a;
  const breathe = 0.004 * Math.sin(g.t * 2.2) * (1 - a);
  body.position.y = bob + breathe;
  body.rotation.x = 0.16 * run * a;
  body.rotation.z = 0.025 * Math.sin(phi) * a * (1 - run);
  body.rotation.y = 0.06 * Math.sin(phi) * a;
}
