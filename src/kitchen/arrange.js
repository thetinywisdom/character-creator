import { mulberry32 } from '../lib/rng.js';
import layout from '../../public/kitchen-kit/layout.json';
import manifest from '../../public/kitchen-kit/manifest.json';
import { aabb, pick } from '../lib/roomPlan.js';

// Seeded home kitchen. Seed 0 is the hand layout in layout.json.
//
// Fixed: the cabinet run, fridge, microwave rack, sink, hob and fish grill.
// The door and windows are part of the shell.
// Varies: which of three dining-nook spots the table uses, chair cloth, and
// how much clutter sits on the counter. Chairs stay on the four sides of the
// table, facing it. A metre-wide walk runs from the door along the right wall
// to the kitchen.

const BOUNDS = { x0: -2.36, x1: 2.36, z0: -1.86, z1: 1.86 };
const SPINE = { x0: 1.15, x1: 2.2, z0: -0.95, z1: 1.7 };
const DOOR = { x: 1.65, z: 1.52 };

const SLOTS = [
  { x: -0.55, z: 0.32 },
  { x: -0.9, z: 0.55 },
  { x: -0.4, z: 0.22 },
];

const NO_BLOCK = new Set(['pendant', 'jar', 'board', 'sink', 'hob', 'grill', 'rice', 'dish', 'window', 'door']);

const FIXED = [
  ['run', -0.7, -1.48, 0],
  ['fridge', 1.25, -1.46, 0],
  ['microwave', 1.98, -1.5, 0],
  ['sink', -1.6, -1.4, 0],
  ['hob', -0.85, -1.38, 0],
  ['grill', -0.22, -1.38, 0],
];

export function kitchenFloorBoxes(plan) {
  const boxes = [];
  for (const p of plan.placements) {
    if ((p.y || 0) >= 0.25 || NO_BLOCK.has(p.item)) continue;
    const fp = manifest.items[p.item]?.footprint;
    if (!fp) throw new Error(`kitchen footprint missing for ${p.item}`);
    boxes.push({ item: p.item, ...aabb(p.x, p.z, fp[0], fp[1], p.rotY || 0) });
  }
  return boxes;
}

function put(out, item, x, y, z, rotY = 0) {
  out.push({ item, x, y, z, rotY });
}

function near(a, b) {
  return Math.abs(a - b) < 1e-3;
}

function dine(out, slot) {
  const { x, z } = slot;
  put(out, 'table', x, 0, z, 0);
  put(out, 'chair', x, 0, z - 0.63, 0);
  put(out, 'chair', x, 0, z + 0.63, 3.1416);
  put(out, 'chair', x - 0.83, 0, z, 1.5708);
  put(out, 'chair', x + 0.83, 0, z, -1.5708);
  put(out, 'pendant', x, 1.72, z, 0);
}

function pack(placements, look, keepOut) {
  const table = placements.find((p) => p.item === 'table');
  return {
    placements,
    look,
    keepOut,
    goals: keepOut ? [
      { name: 'door', x: DOOR.x, z: DOOR.z },
      { name: 'kitchen', x: 1.65, z: -0.55 },
      { name: 'table', x: 1.65, z: table ? table.z : 0.32 },
    ] : null,
    door: keepOut ? DOOR : null,
    bounds: BOUNDS,
  };
}

export function kitchenPlan(seed) {
  const n = Number(seed) || 0;
  if (!n) return pack(layout.placements, layout.look || {}, null);
  const rng = mulberry32(n >>> 0);
  const look = {
    chair: rng() < 0.5 ? 'cushion' : 'wood',
    shade: pick(rng, ['Butter', 'Apricot', 'Paper']),
    pot: pick(rng, ['Sage', 'Off white', 'Apricot']),
  };
  const slot = SLOTS[Math.floor(rng() * SLOTS.length)];
  const out = [];
  for (const [item, x, z, rotY] of FIXED) {
    const onCounter = item === 'sink' || item === 'hob' || item === 'grill';
    put(out, item, x, onCounter ? 0.9 : 0, z, rotY);
  }
  dine(out, slot);
  if (rng() < 0.8) put(out, 'rice', 0.38, 0.9, -1.4, 0.2);
  if (rng() < 0.7) put(out, 'dish', -1.95, 0.9, -1.58, 0);
  if (rng() < 0.55) put(out, 'jar', 0.12, 0.9, -1.62, 0.4);
  if (rng() < 0.5) put(out, 'board', -1.2, 0.9, -1.58, 0.3);
  return pack(out, look, [SPINE]);
}

/** Fixed anchors, and every chair facing the table. */
export function kitchenExtraErrors(plan) {
  const errs = [];
  for (const [item, x, z, rotY] of FIXED) {
    const hit = plan.placements.some((p) => p.item === item && near(p.x, x) && near(p.z, z) && near(p.rotY || 0, rotY));
    if (!hit) errs.push(`anchor moved ${item} @ ${x},${z}`);
  }
  const tables = plan.placements.filter((p) => p.item === 'table');
  for (const p of plan.placements) {
    if (p.item !== 'chair') continue;
    const fx = Math.sin(p.rotY || 0);
    const fz = Math.cos(p.rotY || 0);
    const ok = tables.some((t) => {
      const dx = t.x - p.x;
      const dz = t.z - p.z;
      const len = Math.hypot(dx, dz);
      return len < 1.6 && (fx * dx + fz * dz) / len > 0.65;
    });
    if (!ok) errs.push(`chair faces away @ ${p.x},${p.z}`);
  }
  return errs;
}
