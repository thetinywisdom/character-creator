import { mulberry32 } from '../lib/rng.js';
import layout from '../../public/ramen-kit/layout.json';
import manifest from '../../public/ramen-kit/manifest.json';
import { aabb, pick } from '../lib/roomPlan.js';

// Seeded ramen shop. Seed 0 is the hand layout in layout.json.
//
// Fixed: the long counter, the prep counter, the noodle boiler, the ticket
// machine, the sake shelf, the menu strips, the lanterns, the noren and the
// mat. The door and windows are part of the shell.
// Varies: an L return versus a straight counter, 8–10 stools, lantern and
// noren colours, and a few small props (a floor pot, a corner plant, bottles).
//
// Stools face the counter. A walk about a metre wide runs from the door
// across the front of the stools.

const BOUNDS = { x0: -3.36, x1: 3.36, z0: -2.36, z1: 2.36 };
const WALK = { x0: -1.05, x1: 1.9, z0: 0.72, z1: 1.64 };
const SPINE = { x0: 1.45, x1: 2.5, z0: 0.55, z1: 2.22 };
const DOOR = { x: 2, z: 2.05 };

const NO_BLOCK = new Set(['lantern', 'menu_strip', 'noren', 'mat', 'condiment', 'bottle', 'window', 'door']);

const FIXED = [
  ['counter', -0.15, -0.95, 0],
  ['prep', -0.7, -1.88, 0],
  ['boiler', 1.2, -1.85, 0],
  ['ticket', 0.75, 1.95, 0],
  ['shelf', -3.08, 1.4, 1.5708],
  ['menu_strip', -1.6, -2.28, 0],
  ['menu_strip', -0.2, -2.28, 0],
  ['menu_strip', 1.2, -2.28, 0],
  ['lantern', -1.6, -0.7, 0],
  ['lantern', 0.1, -0.7, 0],
  ['lantern', 1.5, -0.7, 0],
  ['lantern', 2, 1.15, 0],
  ['noren', 2, 1.35, 0],
  ['mat', 2, 1.9, 0],
];

export function ramenFloorBoxes(plan) {
  const boxes = [];
  for (const p of plan.placements) {
    if ((p.y || 0) >= 0.25 || NO_BLOCK.has(p.item)) continue;
    const fp = manifest.items[p.item]?.footprint;
    if (!fp) throw new Error(`ramen footprint missing for ${p.item}`);
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

function spread(a, b, n) {
  if (n <= 1) return [(a + b) / 2];
  const step = (b - a) / (n - 1);
  return Array.from({ length: n }, (_, i) => Math.round((a + step * i) * 1000) / 1000);
}

function pack(placements, look, keepOut) {
  return {
    placements,
    look,
    keepOut,
    goals: keepOut ? [
      { name: 'counter', x: 0.2, z: 1.1 },
      { name: 'door', x: DOOR.x, z: DOOR.z },
      { name: 'ticket', x: 0.9, z: 1.2 },
    ] : null,
    door: keepOut ? DOOR : null,
    bounds: BOUNDS,
  };
}

export function ramenPlan(seed) {
  const n = Number(seed) || 0;
  if (!n) return pack(layout.placements, layout.look || {}, null);
  const rng = mulberry32(n >>> 0);
  const elbow = rng() < 0.5;
  const count = 8 + Math.floor(rng() * 3);
  const look = {
    lantern: pick(rng, ['Brick', 'Dusty rose', 'Blush']),
    noren: pick(rng, ['Brick', 'Dusty rose', 'Navy', 'Sage']),
    pot: pick(rng, ['Off white', 'Stone', 'Apricot']),
  };
  const out = [];
  for (const [item, x, z, rotY] of FIXED) {
    const y = item === 'menu_strip' ? 1.55 : item === 'lantern' ? (z > 0 ? 2.05 : 2.15) : item === 'noren' ? 1.35 : 0;
    put(out, item, x, y, z, rotY);
  }
  if (elbow) put(out, 'counter_return', -1.97, 0, 0.1, 0);

  const backN = elbow ? count - 2 : count;
  const xs = spread(elbow ? -1.35 : -1.92, elbow ? 1.53 : 1.68, backN);
  for (const x of xs) put(out, 'stool', x, 0, -0.46, 3.1416);
  if (elbow) {
    put(out, 'stool', -1.47, 0, -0.05, -1.5708);
    put(out, 'stool', -1.47, 0, 0.42, -1.5708);
  }

  put(out, 'pot', -1.25, 0.86, -1.9, 0.3);
  put(out, 'pot', -0.35, 0.86, -1.8, -0.2);
  if (rng() < 0.7) put(out, 'pot', 2.15, 0, -1.85, 0.4);
  const trays = 1 + (rng() < 0.65 ? 1 : 0);
  put(out, 'condiment', -0.35, 1.02, -0.84, 0.2);
  if (trays > 1) put(out, 'condiment', 0.55, 1.02, -0.86, -0.3);
  if (rng() < 0.6) put(out, 'bottle', 1.15, 1.02, -0.84, 0.5);
  put(out, 'plant', -2.95, 0, -2, 0.4);
  if (rng() < 0.65) put(out, 'plant', 2.9, 0, 1.15, 0.8);

  return pack(out, look, [WALK, SPINE]);
}

/** Fixed anchors and stool facing. Used by scripts/check-room-seeds.mjs. */
export function ramenExtraErrors(plan) {
  const errs = [];
  for (const [item, x, z, rotY] of FIXED) {
    const hit = plan.placements.some((p) => p.item === item && near(p.x, x) && near(p.z, z) && near(p.rotY || 0, rotY));
    if (!hit) errs.push(`anchor moved ${item} @ ${x},${z}`);
  }
  const counters = plan.placements.filter((p) => p.item === 'counter' || p.item === 'counter_return');
  for (const p of plan.placements) {
    if (p.item !== 'stool') continue;
    const fx = Math.sin(p.rotY || 0);
    const fz = Math.cos(p.rotY || 0);
    const ok = counters.some((c) => {
      const dx = c.x - p.x;
      const dz = c.z - p.z;
      if (Math.abs(fz) >= Math.abs(fx)) return fz * dz > 0 && Math.abs(dx) < 2.4 && Math.abs(dz) < 1.3;
      return fx * dx > 0 && Math.abs(dx) < 1.3 && Math.abs(dz) < 1.3;
    });
    if (!ok) errs.push(`stool faces away @ ${p.x},${p.z}`);
  }
  return errs;
}
