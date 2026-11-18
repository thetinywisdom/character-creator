import { mulberry32 } from '../lib/rng.js';
import layout from '../../public/openoffice-kit/layout.json';
import { aabb, pick } from '../lib/roomPlan.js';

// Seeded open office. Seed 0 is the hand layout in layout.json.
// This is not the private office kit: benches stay shared, chairs stay
// sled-base, and there are no cubicle walls.
//
// Fixed: walls, windows, glass door, sage accent wall, pantry and fridge
// (the "plumbing"), pinboard on that wall.
// Varies: two or three bench desks (the third is a second row on the right),
// whether the left bench is in, printer spot, lounge accent, a few plants,
// and small pull / jitter on chairs and desk clutter.
// Chairs sit on the near side of a bench and face the monitors.
// Walks: in from the centre door, across to the pantry, and down between
// the benches. Each is about a metre wide.

const BOUNDS = { x0: -5.86, x1: 5.86, z0: -4.86, z1: 4.86 };
const SPINE = { x0: -0.55, x1: 0.55, z0: 1.4, z1: 4.75 };
const CROSS = { x0: -5.35, x1: 0.55, z0: 1.48, z1: 2.42 };
const WORK = { x0: 0.05, x1: 1.0, z0: -3.15, z1: 1.55 };
const LEFT = { x0: -4.75, x1: -3.75, z0: -1.7, z1: 2.42 };

const FOOT = {
  bench: [3.4, 0.78],
  task_chair: [0.46, 0.4],
  sofa: [1.7, 0.82],
  coffee_table: [0.84, 0.84],
  floor_lamp: [0.36, 0.28],
  printer: [0.74, 0.54],
  pantry: [1.8, 0.64],
  fridge: [0.6, 0.62],
  plant: [0.4, 0.4],
  bin: [0.3, 0.3],
};

const NO_BLOCK = new Set(['monitor', 'rug', 'kettle', 'mug', 'plant_small', 'pinboard', 'pendant_bar', 'notebook', 'window', 'door']);

export function openOfficeFloorBoxes(plan) {
  const boxes = [];
  for (const p of plan.placements) {
    if ((p.y || 0) >= 0.25 || NO_BLOCK.has(p.item)) continue;
    const fp = FOOT[p.item];
    if (!fp) throw new Error(`open office footprint missing for ${p.item}`);
    boxes.push({ item: p.item, ...aabb(p.x, p.z, fp[0], fp[1], p.rotY || 0) });
  }
  return boxes;
}

function put(out, item, x, y, z, rotY = 0) {
  out.push({ item, x, y, z, rotY });
}

function benchAt(out, rng, x, z) {
  const zz = z + (rng() - 0.5) * 0.12;
  put(out, 'bench', x, 0, zz);
  put(out, 'pendant_bar', x, 2.15, zz);
  for (const dx of [-1.1, 0, 1.1]) {
    const pull = rng() * 0.06;
    const yaw = (rng() - 0.5) * 0.06;
    put(out, 'monitor', x + dx, 0.74, zz - 0.2);
    put(out, 'task_chair', x + dx, 0, zz + 0.64 + pull, Math.PI + yaw);
  }
  if (rng() < 0.7) put(out, 'plant_small', x - 1.45, 0.74, zz + 0.12, rng());
  if (rng() < 0.65) put(out, 'notebook', x + 0.35 + (rng() - 0.5) * 0.1, 0.74, zz + 0.16, (rng() - 0.5) * 0.4);
  if (rng() < 0.4) put(out, 'mug', x - 0.45, 0.74, zz + 0.12, rng());
  return zz;
}

export function openOfficePlan(seed) {
  const n = Number(seed) || 0;
  if (!n) return { placements: layout.placements, look: {}, keepOut: null, goals: null, door: null, bounds: BOUNDS };
  const rng = mulberry32(n >>> 0);
  const look = {
    sofa: pick(rng, ['Seafoam', 'Powder blue', 'Sage', 'Denim']),
    chair: pick(rng, ['Powder blue', 'Denim', 'Sage', 'Slate']),
    pot: pick(rng, ['Apricot', 'Off white', 'Sage']),
  };
  const out = [];
  put(out, 'pinboard', -4.4, 1.2, -4.86);
  put(out, 'pantry', -5.5, 0, -0.55, Math.PI / 2);
  put(out, 'fridge', -5.55, 0, -2.05, Math.PI / 2);
  put(out, 'kettle', -5.42, 0.86, -0.35, rng() * 0.8);
  put(out, 'mug', -5.38, 0.86, -0.75, rng());
  if (rng() < 0.7) put(out, 'mug', -5.4, 0.86, -0.98, rng());

  const goals = [
    { name: 'door', x: 0, z: 3.6 },
    { name: 'pantry', x: -4.2, z: -0.4 },
  ];
  const left = rng() < 0.75;
  if (left) {
    benchAt(out, rng, -1.85, -2.5);
    goals.push({ name: 'bench-left', x: 0.5, z: -2.4 });
  }
  benchAt(out, rng, 2.9, -2.5);
  goals.push({ name: 'bench-right', x: 0.5, z: -2.4 });
  if (rng() < 0.7) {
    benchAt(out, rng, 2.9, 0.15);
    goals.push({ name: 'bench-front', x: 0.5, z: 0.3 });
  }

  // Lounge stays in the front-left corner, clear of the cross walk.
  put(out, 'sofa', -5.22, 0, 3.9, Math.PI / 2);
  put(out, 'coffee_table', -4.15, 0, 3.9);
  put(out, 'rug', -4.7, 0, 3.9, Math.PI / 2);
  put(out, 'floor_lamp', -5.35, 0, 2.68);
  put(out, 'mug', -4.05, 0.38, 3.75, rng());
  goals.push({ name: 'lounge', x: -4.2, z: 1.95 });

  const printerFront = rng() < 0.5;
  put(out, 'printer', printerFront ? 4.9 : 5.2, 0, printerFront ? 3.35 : -0.55, printerFront ? 0.25 : -0.3);
  put(out, 'bin', printerFront ? 4.15 : 5.15, 0, printerFront ? 2.6 : 0.55, rng() * 0.3);

  if (rng() < 0.8) put(out, 'plant', -5.15, 0, -4.2, rng());
  if (rng() < 0.75) put(out, 'plant', -5.2, 0, 1.05, rng());
  if (!left && rng() < 0.8) put(out, 'plant', -1.7, 0, -2.4, rng());

  return {
    placements: out,
    look,
    keepOut: [SPINE, CROSS, WORK, LEFT],
    goals,
    door: { x: 0, z: 4.2 },
    bounds: BOUNDS,
  };
}
