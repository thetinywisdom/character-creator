import { mulberry32 } from '../lib/rng.js';
import layout from '../../public/cafe-kit/layout.json';
import { aabb, pick } from '../lib/roomPlan.js';

// Seeded cafe. Seed 0 is the hand layout in layout.json.
//
// Fixed: walls, windows, door, espresso bar (and the machine on it), chalk
// menu, wall shelf, pastry case, window counter, noren, door mat.
// Varies: how many round tables (2 or 3) and which of the three slots, how
// many stools, whether a cake or a corner plant is out, a little pull on the
// chairs, jitter on cups and the caddy, and one accent (pots, shades, noren)
// from the existing palette.
//
// Chairs stay on the north and south of their table, facing it. A 0.9 m
// walk runs from the door up the right side and across in front of the bar,
// so every table and the bar can be reached without stepping through a chair.

const BOUNDS = { x0: -3.86, x1: 3.86, z0: -2.86, z1: 2.86 };
const SPINE = { x0: 2.08, x1: 3.18, z0: -2.55, z1: 2.68 };
const BAR_WALK = { x0: -3.45, x1: 2.12, z0: -1.74, z1: -0.84 };

const FOOT = {
  bar: [2.52, 0.74],
  pastry_case: [0.8, 0.44],
  table: [0.72, 0.72],
  chair: [0.38, 0.36],
  window_counter: [2.5, 0.46],
  stool: [0.34, 0.34],
  plant: [0.36, 0.36],
};

const NO_BLOCK = new Set(['menu_board', 'shelf', 'pendant', 'noren', 'mat', 'cup', 'cake', 'caddy', 'plant_small', 'espresso_machine', 'grinder', 'register']);

export function cafeFloorBoxes(plan) {
  const boxes = [];
  for (const p of plan.placements) {
    if ((p.y || 0) >= 0.25 || NO_BLOCK.has(p.item)) continue;
    const fp = FOOT[p.item];
    if (!fp) throw new Error(`cafe footprint missing for ${p.item}`);
    boxes.push({ item: p.item, ...aabb(p.x, p.z, fp[0], fp[1], p.rotY || 0) });
  }
  return boxes;
}

function put(out, item, x, y, z, rotY = 0) {
  out.push({ item, x, y, z, rotY });
}

export function cafePlan(seed) {
  const n = Number(seed) || 0;
  if (!n) return { placements: layout.placements, look: {}, keepOut: null, goals: null, door: null, bounds: BOUNDS };
  const rng = mulberry32(n >>> 0);
  const look = {
    pot: pick(rng, ['Apricot', 'Off white', 'Sage']),
    shade: pick(rng, ['Apricot', 'Butter', 'Dusty rose', 'Sage']),
    noren: pick(rng, ['Sage', 'Dusty rose', 'Powder blue', 'Butter']),
  };
  const out = [];
  // The bar, the machine and the menu stay put. The caddy can slide a little.
  put(out, 'bar', -1.15, 0, -2.2);
  put(out, 'espresso_machine', -1.9, 1.05, -2.28);
  put(out, 'grinder', -1.28, 1.05, -2.18, 0.15 + rng() * 0.3);
  put(out, 'caddy', -0.7 + (rng() - 0.5) * 0.08, 1.05, -2.1 + (rng() - 0.5) * 0.04, rng() * 0.4);
  put(out, 'register', -0.28, 1.05, -2.12);
  put(out, 'pastry_case', 1.15, 0, -2.15);
  put(out, 'menu_board', -1.15, 1.42, -2.86);
  put(out, 'shelf', -3.86, 1.35, -0.15, Math.PI / 2);
  put(out, 'plant', -3.35, 0, -2.35, rng() * 1.2);
  put(out, 'window_counter', 0.7, 0, 2.15);
  put(out, 'noren', 2.66, 1.22, 2.5);
  put(out, 'mat', 2.66, 0, 2.35);
  if (rng() < 0.65) put(out, 'plant_small', -0.55 + (rng() - 0.5) * 0.06, 1.05, -2.05, rng());

  const slots = [-2.45, -1.2, 0.15];
  const pattern = Math.floor(rng() * 3); // 0 both ends, 1 left pair, 2 all three
  const chosen = pattern === 0 ? [slots[0], slots[2]] : pattern === 1 ? [slots[0], slots[1]] : slots;
  const tableZ = 0.08;
  const goals = [
    { name: 'bar', x: -1.15, z: -1.3 },
    { name: 'counter', x: 2.4, z: 1.7 },
  ];
  for (const x of chosen) {
    const pullS = rng() * 0.04;
    const pullN = rng() * 0.04;
    const yaw = (rng() - 0.5) * 0.08;
    put(out, 'table', x, 0, tableZ);
    put(out, 'chair', x, 0, tableZ - 0.6 - pullS, yaw);
    put(out, 'chair', x, 0, tableZ + 0.6 + pullN, Math.PI + yaw);
    put(out, 'cup', x + (rng() - 0.5) * 0.1, 0.74, tableZ + (rng() - 0.5) * 0.08, rng() * 0.8);
    if (rng() < 0.55) put(out, 'cake', x + (rng() - 0.5) * 0.16, 0.74, tableZ + (rng() - 0.5) * 0.1, rng());
    put(out, 'pendant', x, 1.9, tableZ);
    goals.push({ name: 'table', x, z: -1.25 });
  }
  if (rng() < 0.7) put(out, 'plant', -3.4, 0, 1.55, rng() * 1.5);

  const stoolX = [-0.4, 0.35, 1.15, 1.7];
  const stoolN = 2 + Math.floor(rng() * 3);
  for (let i = 0; i < stoolN; i++) put(out, 'stool', stoolX[i], 0, 1.55, (rng() - 0.5) * 0.06);
  if (rng() < 0.5) put(out, 'cup', 0.15, 1.05, 2.08, rng());
  if (rng() < 0.5) put(out, 'plant_small', 1.65, 1.05, 2.1, rng());

  return {
    placements: out,
    look,
    keepOut: [SPINE, BAR_WALK],
    goals,
    door: { x: 2.66, z: 2.35 },
    bounds: BOUNDS,
  };
}
