// Procedural walk / run for the cat (subjects/cat.js).
//
// Joints: legFL, legFR, legBL, legBR (hang from the top of the leg), head, tail.
// Uses the same gait state as people (createGait / stepGait style: phase,
// amount 0..1 = moving, run 0..1), advanced by stepCatGait.
//
//  Walk: the cat's lateral sequence: back left, front left, back right, front
//        right, a quarter cycle apart. Feet lift in the swing, the head bobs
//        a little, the tail sways slowly, held up.
//  Poses: sit, loaf and sleep (CAT_POSES), blended in when the cat stops
//        (set g.pose; stepCatGait fades it in and out).
//  Run:  a bounding gallop: the front pair lands together, then the back pair
//        half a cycle later; the body rocks nose-up / nose-down and lifts off
//        the ground between bounds; the tail streams out behind.

export const CAT_JOINTS = ['legFL', 'legFR', 'legBL', 'legBR', 'lowFL', 'lowFR', 'lowBL', 'lowBR', 'head', 'tail'];
export const CAT_WALK_SPEED = 0.8; // m/s (for a cat drawn 1.5x)
export const CAT_RUN_SPEED = 3.2;

const lerp = (a, b, t) => a + (b - a) * t;
const clamp01 = (x) => Math.max(0, Math.min(1, x));
const TAU = Math.PI * 2;

// leg phase offsets (fraction of a cycle)
const WALK_OFF = { legBL: 0, legFL: 0.25, legBR: 0.5, legFR: 0.75 };
const RUN_OFF = { legFL: 0, legFR: 0.08, legBL: 0.5, legBR: 0.58 };

export function createCatGait(phase = 0) {
  return { phase, amount: 0, run: 0, t: Math.random() * 10, pose: null, poseW: 0 };
}

// Resting poses (blended in when the cat stops; g.pose = 'sit' | 'loaf' | 'sleep').
// Angles in radians; y in leg heights (the cat lowers itself onto the ground).
//  sit:   rear down, front legs straight, back legs folded forward, head up,
//         tail lying round to one side
//  loaf:  all paws tucked under, body down on the ground, tail wrapped round
//  sleep: loaf rolled a little onto one side, head down and turned, tail
//         wrapped round further
export const CAT_POSES = {
  // legF / legB: shoulder / hip; lowF / lowB: elbow / hock (the legs fold, not swing stiff)
  sit:   { y: -0.42, rx: -0.85, rz: 0, legF: 0.85, lowF: 0, legB: -0.7, lowB: 2.6, head: 0.65, headY: 0, tailX: -0.5, tailY: 1.2 },
  loaf:  { y: -0.86, rx: 0.02, rz: 0, legF: 1.1, lowF: -2.5, legB: -1.3, lowB: 2.7, head: 0.1, headY: 0, tailX: -1.35, tailY: 1.9 },
  sleep: { y: -0.9, rx: 0.02, rz: 0.3, legF: 1.0, lowF: -2.3, legB: -1.2, lowB: 2.6, head: 0.55, headY: 0.85, tailX: -1.35, tailY: 1.9 },
};

/** Advance the cycle for a cat moving at `speed` m/s. */
export function stepCatGait(g, dt, speed) {
  const k = Math.min(1, dt * 6);
  g.amount += (clamp01(speed / 0.3) - g.amount) * k;
  g.run += (clamp01((speed - 1.4) / 1.2) - g.run) * k;
  // steps per second: about 2 cycles/s walking, 3.4 bounding
  const ref = lerp(CAT_WALK_SPEED, CAT_RUN_SPEED, g.run);
  const stride = Math.max(0.6, Math.min(1.3, speed / ref));
  if (g.amount > 0.01) g.phase += lerp(TAU * 1.9, TAU * 3.4, g.run) * stride * dt;
  // a resting pose fades in when standing still, out when moving off
  const want = g.pose && speed < 0.05 ? 1 : 0;
  g.poseW += (want - g.poseW) * Math.min(1, dt * (want ? 1.6 : 4));
  g.t += dt;
}

function jointsOf(body) {
  if (!body.userData.catJoints) {
    const j = {};
    body.traverse((o) => { if (CAT_JOINTS.includes(o.name)) j[o.name] = o; });
    // the tail first lowers (x), then swings round the side (y)
    if (j.tail) j.tail.rotation.order = 'YXZ';
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
  // blend toward a resting pose
  const P = CAT_POSES[g.pose], w = g.poseW ?? 0;
  body.rotation.z = 0;
  for (const n of ['lowFL', 'lowFR', 'lowBL', 'lowBR']) if (j[n]) j[n].rotation.x = 0;
  if (!P || w < 0.001) return;
  const legH = body.userData.cat?.legH ?? 0.13;
  const breathe = g.pose === 'sleep' ? 0.004 * Math.sin(g.t * 1.4) : 0;
  body.position.y = lerp(body.position.y, P.y * legH + breathe, w);
  body.rotation.x = lerp(body.rotation.x, P.rx, w);
  body.rotation.z = P.rz * w;
  for (const name of ['legFL', 'legFR', 'legBL', 'legBR']) {
    const leg = j[name], low = j[name.replace('leg', 'low')];
    const front = name.startsWith('legF');
    if (leg) {
      leg.rotation.x = lerp(leg.rotation.x, front ? P.legF : P.legB, w);
      leg.position.y = lerp(leg.position.y, leg.userData.restY, w);
    }
    if (low) low.rotation.x = (front ? P.lowF : P.lowB) * w;
  }
  if (j.head) {
    j.head.rotation.x = lerp(j.head.rotation.x, P.head, w);
    j.head.rotation.y = lerp(j.head.rotation.y, P.headY + (g.pose === 'sit' ? 0.25 * Math.sin(g.t * 0.4) : 0), w);
  }
  if (j.tail) {
    // a sitting tail still flicks now and then
    const flick = g.pose === 'sit' ? 0.12 * Math.sin(g.t * 2.2) * Math.max(0, Math.sin(g.t * 0.5)) : 0;
    j.tail.rotation.x = lerp(j.tail.rotation.x, P.tailX, w);
    j.tail.rotation.y = lerp(j.tail.rotation.y, P.tailY + flick, w);
  }
}
