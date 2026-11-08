// Procedural walk / run for the cat (subjects/cat.js).
//
// Joints: legFL, legFR, legBL, legBR (hang from the top of the leg), head, tail.
// Uses the same gait state as people (createGait / stepGait style: phase,
// amount 0..1 = moving, run 0..1), advanced by stepCatGait.
//
//  Walk: the cat's lateral sequence: back left, front left, back right, front
//        right, a quarter cycle apart. Feet lift in the swing, the head bobs
//        a little, the tail sways slowly, held up.
//  Run:  a bounding gallop: the front pair lands together, then the back pair
//        half a cycle later; the body rocks nose-up / nose-down and lifts off
//        the ground between bounds; the tail streams out behind.

export const CAT_JOINTS = ['legFL', 'legFR', 'legBL', 'legBR', 'head', 'tail'];
export const CAT_WALK_SPEED = 0.8; // m/s (for a cat drawn 1.5x)
export const CAT_RUN_SPEED = 3.2;

const lerp = (a, b, t) => a + (b - a) * t;
const clamp01 = (x) => Math.max(0, Math.min(1, x));
const TAU = Math.PI * 2;

// leg phase offsets (fraction of a cycle)
const WALK_OFF = { legBL: 0, legFL: 0.25, legBR: 0.5, legFR: 0.75 };
const RUN_OFF = { legFL: 0, legFR: 0.08, legBL: 0.5, legBR: 0.58 };

export function createCatGait(phase = 0) {
  return { phase, amount: 0, run: 0, t: Math.random() * 10 };
}

/** Advance the cycle for a cat moving at `speed` m/s. */
export function stepCatGait(g, dt, speed) {
  const k = Math.min(1, dt * 6);
  g.amount += (clamp01(speed / 0.3) - g.amount) * k;
  g.run += (clamp01((speed - 1.4) / 1.2) - g.run) * k;
  // steps per second: about 2 cycles/s walking, 3.4 bounding
  const ref = lerp(CAT_WALK_SPEED, CAT_RUN_SPEED, g.run);
  const stride = Math.max(0.6, Math.min(1.3, speed / ref));
  if (g.amount > 0.01) g.phase += lerp(TAU * 1.9, TAU * 3.4, g.run) * stride * dt;
  g.t += dt;
}

function jointsOf(body) {
  if (!body.userData.catJoints) {
    const j = {};
    body.traverse((o) => { if (CAT_JOINTS.includes(o.name)) j[o.name] = o; });
    body.userData.catJoints = j;
  }
  return body.userData.catJoints;
}

/** Pose `body` (the cat root, or a scaled wrapper's child) for gait state `g`. */
export function poseCat(body, g) {
  const j = jointsOf(body);
  const a = g.amount, run = g.run;
  const u = g.phase / TAU;
  for (const name of ['legFL', 'legFR', 'legBL', 'legBR']) {
    const leg = j[name];
    if (!leg) continue;
    const rest = leg.userData.restY ??= leg.position.y;
    const walkU = u + WALK_OFF[name], runU = u + RUN_OFF[name];
    // swing: + = foot forward (rotation.x negative swings a hanging leg toward +z)
    const walkSwing = 0.38 * Math.sin(TAU * walkU);
    const runSwing = 0.85 * Math.sin(TAU * runU);
    const swing = lerp(walkSwing, runSwing, run);
    leg.rotation.x = -swing * a;
    // lift the foot while it travels forward (cos > 0 = swinging forward)
    const lift = lerp(0.018 * Math.max(0, Math.cos(TAU * walkU)), 0.03 * Math.max(0, Math.cos(TAU * runU)), run);
    leg.position.y = rest + lift * a;
  }
  // body: small bob walking; rocking and lift-off when bounding
  const bob = 0.004 * Math.cos(TAU * u * 2) * (1 - run);
  const bound = 0.035 * Math.max(0, Math.sin(TAU * (u + 0.75))) * run;
  body.position.y = (bob + bound) * a + 0.002 * Math.sin(g.t * 2.4) * (1 - a);
  body.rotation.x = 0.16 * Math.sin(TAU * u) * run * a;
  if (j.head) {
    // the head stays steady when running (counters the rock), nods walking
    j.head.rotation.x = (0.05 * Math.sin(TAU * u * 2) * (1 - run) - 0.16 * Math.sin(TAU * u) * run) * a;
    j.head.rotation.y = 0.12 * Math.sin(g.t * 0.5) * (1 - a); // looks around when standing
  }
  if (j.tail) {
    j.tail.rotation.y = lerp(0.25 * Math.sin(g.t * 1.6), 0.08 * Math.sin(TAU * u), a);
    j.tail.rotation.x = -0.55 * run * a; // lowers to stream out behind when running
  }
}
