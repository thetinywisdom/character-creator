import { mulberry32 } from '../lib/rng.js';
import layout from '../../public/dojo-kit/layout.json';
import { aabb, hits, inside, pick, rectBox } from '../lib/roomPlan.js';

// Seeded dojo. Seed 0 is the hand layout in layout.json.
//
// Fixed: walls, windows, sliding door, shoe shelf, kamidana, mirror wall.
// The mat block grows from a fixed back-left corner. Two columns is the gym
// end of the split, four columns is the dojo end. The seed picks that split,
// whether the bokken rack and the bag are out, which wall the rack uses, and
// one pre-checked equipment trio in the weights corner.
// A walk a little over 0.9 m runs from the sliding door along the front wall.

const BOUNDS = { x0: -4.36, x1: 4.36, z0: -4.36, z1: 4.36 };
const FRONT = { x0: -4.28, x1: 4.22, z0: 2.48, z1: 3.52 };

const MAT_W = 1.56;
const MAT_D = 0.78;
const PITCH_X = 1.64;
const PITCH_Z = 0.86;
const OX = -3.15;
const OZ = -3.4;

const FOOT = {
  tatami: [MAT_W, MAT_D],
  bokken_rack: [1.15, 0.26],
  punching_bag: [0.46, 0.46],
  weight_bench: [1.3, 0.5],
  dumbbell_rack: [0.92, 0.4],
  shoe_shelf: [1.08, 0.32],
};

const COMBOS = {
  2: [
    { bench: [1.2, -2.6, 0], rack: [3.5, -2.6, 0], bag: [2.3, 0.3, 0] },
    { bench: [2.6, -2.5, 0], rack: [3.85, -0.8, Math.PI / 2], bag: [1.1, 0.6, 0] },
    { bench: [3.4, 0.4, Math.PI / 2], rack: [1.0, -2.7, 0], bag: [2.4, -0.8, 0] },
    { bench: [0.6, -2.55, 0], rack: [3.85, 0.9, Math.PI / 2], bag: [2.2, 1.1, 0] },
  ],
  3: [
    { bench: [2.3, -2.6, 0], rack: [3.85, -1.0, Math.PI / 2], bag: [2.5, 0.55, 0] },
    { bench: [3.5, -1.8, Math.PI / 2], rack: [2.2, -2.7, 0], bag: [3.15, 0.7, 0] },
    { bench: [2.5, -2.55, 0], rack: [3.85, 0.85, Math.PI / 2], bag: [3.2, -0.6, 0] },
  ],
  4: [
    { bench: [3.6, -2.5, Math.PI / 2], rack: [3.85, -0.55, Math.PI / 2], bag: [3.15, 0.9, 0] },
    { bench: [3.6, 0.7, Math.PI / 2], rack: [3.85, -2.3, Math.PI / 2], bag: [3.15, -0.7, 0] },
  ],
};

const q = (n) => Math.round(n * 1000) / 1000;

export function dojoFloorBoxes(plan) {
  const boxes = [];
  for (const p of plan.placements) {
    if ((p.y || 0) >= 0.25) continue;
    const fp = FOOT[p.item];
    if (!fp) throw new Error(`dojo footprint missing for ${p.item}`);
    boxes.push({ item: p.item, ...aabb(p.x, p.z, fp[0], fp[1], p.rotY || 0) });
  }
  return boxes;
}

export function dojoPlan(seed) {
  const n = Number(seed) || 0;
  if (!n) {
    return { placements: layout.placements, look: {}, keepOut: null, goals: null, door: null, bounds: BOUNDS };
  }
  const rng = mulberry32(n >>> 0);
  const split = rng();
  const cols = split < 0.34 ? 2 : split < 0.67 ? 3 : 4;
  const rows = cols === 2 ? 4 : cols === 3 ? 5 : 6;
  const look = { bag: pick(rng, ['Navy', 'Denim', 'Charcoal']) };
  const out = [];
  const boxes = [];
  const keeps = [FRONT];

  const add = (item, x, z, rotY = 0) => {
    const fp = FOOT[item];
    boxes.push({ item, ...aabb(x, z, fp[0], fp[1], rotY) });
    out.push({ item, x: q(x), y: 0, z: q(z), rotY: q(rotY) });
  };
  const fits = (item, x, z, rotY) => {
    const fp = FOOT[item];
    const b = aabb(x, z, fp[0], fp[1], rotY);
    if (!inside(b, BOUNDS)) return false;
    if (boxes.some((o) => hits(o, b, 0.04))) return false;
    if (keeps.some((r) => hits(b, rectBox(r), 0.02))) return false;
    return true;
  };
  const put = (item, x, z, rotY = 0) => {
    if (!fits(item, x, z, rotY)) return false;
    add(item, x, z, rotY);
    return true;
  };

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) add('tatami', OX + c * PITCH_X, OZ + r * PITCH_Z, 0);
  }
  add('shoe_shelf', -4.16, 1.8, Math.PI / 2);

  if (rng() < 0.85) {
    const spots = rng() < 0.5
      ? [[-3.4, -4.12, 0], [-4.15, -0.15, Math.PI / 2]]
      : [[-4.15, -0.15, Math.PI / 2], [-3.4, -4.12, 0]];
    if (!put('bokken_rack', spots[0][0], spots[0][1], spots[0][2])) {
      put('bokken_rack', spots[1][0], spots[1][1], spots[1][2]);
    }
  }

  const combo = COMBOS[cols][Math.floor(rng() * COMBOS[cols].length)];
  if (!put('weight_bench', combo.bench[0], combo.bench[1], combo.bench[2])) {
    throw new Error(`dojo seed ${n}: bench did not fit`);
  }
  if (!put('dumbbell_rack', combo.rack[0], combo.rack[1], combo.rack[2])) {
    throw new Error(`dojo seed ${n}: rack did not fit`);
  }
  if (rng() < 0.8) put('punching_bag', combo.bag[0], combo.bag[1], combo.bag[2]);

  return {
    placements: out,
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
