import { mulberry32 } from '../lib/rng.js';
import layout from '../../public/dojo-kit/layout.json';
import { aabb, hits, inside, pick, rectBox } from '../lib/roomPlan.js';

// Seeded dojo. Seed 0 is the hand layout in layout.json.
//
// The tatami is one solid rectangle (plan.mat). It is not a floor blocker,
// so racks, bags and dummies stand on it. Its back-left corner stays put.
// The seed only changes how far that rectangle reaches, and which extra
// pieces from a fixed, non-overlapping set are out.
// A walk a little over 0.9 m runs from the sliding door along the front wall.

const BOUNDS = { x0: -4.36, x1: 4.36, z0: -4.36, z1: 4.36 };
const FRONT = { x0: -4.28, x1: 4.22, z0: 2.48, z1: 3.52 };

const FOOT = {
  bokken_rack: [1.15, 0.26],
  punching_bag: [0.46, 0.46],
  weight_bench: [1.3, 0.5],
  dumbbell_rack: [0.92, 0.4],
  shoe_shelf: [1.08, 0.32],
  dummy: [0.42, 0.42],
  mat_stack: [0.72, 0.5],
};

const NO_BLOCK = new Set(['scroll']);

// Always present. Positions are clear of each other and of the front walk.
const CORE = [
  ['shoe_shelf', -4.16, 1.8, Math.PI / 2],
  ['bokken_rack', -1.45, -4.12, 0],
  ['dummy', -2.4, -2.15, 0],
  ['dummy', -0.7, -2.15, 0],
  ['dummy', -2.4, -0.45, 0],
  ['punching_bag', 1.5, -1.15, 0],
  ['punching_bag', 1.5, 0.7, 0],
  ['weight_bench', 3.05, -2.5, 0],
  ['dumbbell_rack', 3.88, -0.95, Math.PI / 2],
  ['mat_stack', -3.55, -3.2, 0],
];

// Optional, and still clear of CORE and of each other.
const EXTRA = [
  ['dummy', -0.7, -0.45, 0],
  ['dummy', 0.6, -2.15, 0],
  ['dummy', 0.6, -0.45, 0],
  ['dummy', -2.4, 1.05, 0],
  ['dummy', -0.7, 1.05, 0],
  ['punching_bag', 3.15, 0.35, 0],
  ['bokken_rack', -3.4, -4.12, 0],
  ['bokken_rack', 3.45, -4.08, 0],
  ['weight_bench', 3.4, 1.35, Math.PI / 2],
  ['shoe_shelf', -4.12, 0.4, Math.PI / 2],
];

const SCROLLS = [
  [-0.15, -4.36, 0],
  [3.55, -4.36, 0],
  [-4.36, -3.6, Math.PI / 2],
  [-4.36, 0.55, Math.PI / 2],
];

const q = (n) => Math.round(n * 1000) / 1000;

function matFor(split) {
  // Grows from a fixed back-left corner. One rectangle, no internal seams.
  const x0 = -4.05;
  const z0 = -4.08;
  const w = split < 0.34 ? 4.5 : split < 0.67 ? 6.4 : 7.7;
  const d = split < 0.34 ? 4.6 : split < 0.67 ? 5.5 : 6.15;
  return { x: q(x0 + w / 2), z: q(z0 + d / 2), w, d };
}

export function dojoFloorBoxes(plan) {
  const boxes = [];
  for (const p of plan.placements) {
    if ((p.y || 0) >= 0.25 || NO_BLOCK.has(p.item)) continue;
    const fp = FOOT[p.item];
    if (!fp) throw new Error(`dojo footprint missing for ${p.item}`);
    boxes.push({ item: p.item, ...aabb(p.x, p.z, fp[0], fp[1], p.rotY || 0) });
  }
  return boxes;
}

export function dojoPlan(seed) {
  const n = Number(seed) || 0;
  if (!n) {
    return {
      placements: layout.placements,
      mat: layout.mat,
      look: {},
      keepOut: null,
      goals: null,
      door: null,
      bounds: BOUNDS,
    };
  }
  const rng = mulberry32(n >>> 0);
  const split = rng();
  const look = { bag: pick(rng, ['Navy', 'Denim', 'Charcoal']) };
  const out = [];
  const boxes = [];
  const keeps = [FRONT];

  const add = (item, x, z, rotY = 0, y = 0) => {
    if (!NO_BLOCK.has(item)) {
      const fp = FOOT[item];
      const b = aabb(x, z, fp[0], fp[1], rotY);
      if (!inside(b, BOUNDS) || boxes.some((o) => hits(o, b, 0.02)) || keeps.some((r) => hits(b, rectBox(r)))) {
        throw new Error(`dojo seed ${n}: ${item} at ${q(x)},${q(z)} does not fit`);
      }
      boxes.push({ item, ...b });
    }
    out.push({ item, x: q(x), y, z: q(z), rotY: q(rotY) });
  };

  for (const [item, x, z, rot] of CORE) add(item, x, z, rot);
  EXTRA.forEach((spot, i) => {
    const keep = i < 3 ? rng() < 0.85 : rng() < 0.62;
    if (keep) add(spot[0], spot[1], spot[2], spot[3]);
  });
  const scrollN = 2 + Math.floor(rng() * 3);
  for (let i = 0; i < scrollN && i < SCROLLS.length; i++) {
    const [x, z, rot] = SCROLLS[i];
    add('scroll', x, z, rot, 1.35);
  }

  return {
    placements: out,
    mat: matFor(split),
    look,
    keepOut: [FRONT],
    goals: [
      { name: 'entrance', x: -3.85, z: 3.05 },
      { name: 'mats', x: -1.5, z: 3.0 },
      { name: 'gym', x: 2.8, z: 3.0 },
    ],
    door: { x: -3.85, z: 3.05 },
    bounds: BOUNDS,
  };
}
