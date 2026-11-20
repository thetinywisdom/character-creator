import { mulberry32 } from '../lib/rng.js';
import layout from '../../public/library-kit/layout.json';
import manifest from '../../public/library-kit/manifest.json';
import { aabb, pick } from '../lib/roomPlan.js';

// Seeded library. Seed 0 is the hand layout in layout.json.
//
// Fixed: three rows of shelf bays, the front desk and its chair, the return
// cart and the magazine rack. The door and windows are part of the shell.
// Varies: a fourth shelf row, and which end holds the reading tables versus
// the kids' corner. Chairs face their table (the desk chair faces the desk).
// Aisles between the rows are about 0.9 m and meet a walk from the door.

const BOUNDS = { x0: -4.86, x1: 4.86, z0: -3.86, z1: 3.86 };
const XS = [-3.7, -2.48, -1.26, -0.04];
const ROWS = [-3.32, -1.96, -0.6, 0.76];
const SPINE = { x0: 0.78, x1: 1.84, z0: -3.25, z1: 3.65 };
const FRONT = { x0: -4.2, x1: 2, z0: 1.12, z1: 2.04 };
const AISLE = [
  { x0: -4.1, x1: 0.95, z0: -3.1, z1: -2.18 },
  { x0: -4.1, x1: 0.95, z0: -1.74, z1: -0.82 },
  { x0: -4.1, x1: 0.95, z0: -0.38, z1: 0.54 },
];
const DOOR = { x: 1.3, z: 3.48 };

const NO_BLOCK = new Set(['lamp', 'book', 'window', 'door']);

const FIXED = [
  ['desk', 3.4, 2.4, 0],
  ['chair', 3.4, 1.78, 0],
  ['cart', 2.45, 3.3, 0],
  ['magazine', -4.55, 2.7, 1.5708],
  ['plant', 4.58, 3.45, 0.4],
];

export function libraryFloorBoxes(plan) {
  const boxes = [];
  for (const p of plan.placements) {
    if ((p.y || 0) >= 0.25 || NO_BLOCK.has(p.item)) continue;
    const fp = manifest.items[p.item]?.footprint;
    if (!fp) throw new Error(`library footprint missing for ${p.item}`);
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

function shelves(out, rows) {
  for (let r = 0; r < rows; r++) {
    for (const x of XS) put(out, 'shelf_bay', x, 0, ROWS[r], 0);
  }
}

function reading(out, where, books) {
  const spots = where === 'front'
    ? [{ x: -3.15, z: 2.78 }, { x: -1.35, z: 2.78 }]
    : [{ x: 3.45, z: -2.55 }, { x: 3.45, z: -0.85 }];
  for (const s of spots) {
    put(out, 'table', s.x, 0, s.z, 0);
    put(out, 'lamp', s.x, 0.76, s.z - 0.12, 0);
    if (books) put(out, 'book', s.x + 0.22, 0.76, s.z + 0.08, 0.4);
    if (where === 'front') {
      put(out, 'chair', s.x - 0.26, 0, s.z + 0.61, 3.1416);
      put(out, 'chair', s.x + 0.26, 0, s.z + 0.61, 3.1416);
    } else {
      put(out, 'chair', s.x - 0.82, 0, s.z, 1.5708);
      put(out, 'chair', s.x + 0.82, 0, s.z, -1.5708);
    }
  }
}

function kids(out, where) {
  if (where === 'side') {
    put(out, 'low_shelf', 3.5, 0, -3.25, 0);
    put(out, 'cushion', 2.95, 0, -2.35, 0.4);
    put(out, 'cushion', 3.55, 0, -2.15, 1.2);
    put(out, 'cushion', 4.15, 0, -2.45, 0.2);
  } else {
    put(out, 'low_shelf', -2.2, 0, 3.28, 3.1416);
    put(out, 'cushion', -3.1, 0, 2.5, 0.5);
    put(out, 'cushion', -2.2, 0, 2.42, 1.1);
    put(out, 'cushion', -1.3, 0, 2.52, 0.3);
  }
}

function pack(placements, look, keepOut) {
  const goals = keepOut ? [
    { name: 'door', x: DOOR.x, z: DOOR.z },
    { name: 'aisle', x: -1.5, z: -2.64 },
    { name: 'aisle', x: -1.5, z: -1.28 },
    { name: 'front', x: -1.6, z: 1.55 },
  ] : null;
  if (keepOut && placements.some((p) => p.item === 'shelf_bay' && p.z > 0)) {
    goals.push({ name: 'aisle', x: -1.5, z: 0.08 });
  }
  return {
    placements,
    look,
    keepOut,
    goals,
    door: keepOut ? DOOR : null,
    bounds: BOUNDS,
  };
}

export function libraryPlan(seed) {
  const n = Number(seed) || 0;
  if (!n) return pack(layout.placements, layout.look || {}, null);
  const rng = mulberry32(n >>> 0);
  const rows = rng() < 0.5 ? 3 : 4;
  const readFront = rng() < 0.5;
  const look = {
    shade: pick(rng, ['Butter', 'Apricot', 'Paper']),
    cushion: pick(rng, ['Dusty rose', 'Sage', 'Powder blue', 'Butter']),
    pot: pick(rng, ['Sage', 'Off white', 'Apricot']),
  };
  const out = [];
  shelves(out, rows);
  for (const [item, x, z, rotY] of FIXED) put(out, item, x, 0, z, rotY);
  const books = rng() < 0.75;
  reading(out, readFront ? 'front' : 'side', books);
  kids(out, readFront ? 'side' : 'front');
  if (rng() < 0.7) put(out, 'plant', -4.58, 0, -1.2, 0.6);
  const walks = rows === 4 ? [...AISLE, SPINE, FRONT] : [AISLE[0], AISLE[1], SPINE, FRONT];
  return pack(out, look, walks);
}

/** Fixed anchors, the three shelf rows, and chairs facing their table or desk. */
export function libraryExtraErrors(plan) {
  const errs = [];
  for (const [item, x, z, rotY] of FIXED) {
    const hit = plan.placements.some((p) => p.item === item && near(p.x, x) && near(p.z, z) && near(p.rotY || 0, rotY));
    if (!hit) errs.push(`anchor moved ${item} @ ${x},${z}`);
  }
  for (const z of ROWS.slice(0, 3)) {
    for (const x of XS) {
      const hit = plan.placements.some((p) => p.item === 'shelf_bay' && near(p.x, x) && near(p.z, z));
      if (!hit) errs.push(`missing shelf @ ${x},${z}`);
    }
  }
  const targets = plan.placements.filter((p) => p.item === 'table' || p.item === 'desk');
  for (const p of plan.placements) {
    if (p.item !== 'chair') continue;
    const fx = Math.sin(p.rotY || 0);
    const fz = Math.cos(p.rotY || 0);
    const ok = targets.some((t) => {
      const dx = t.x - p.x;
      const dz = t.z - p.z;
      const len = Math.hypot(dx, dz);
      return len < 2 && (fx * dx + fz * dz) / len > 0.65;
    });
    if (!ok) errs.push(`chair faces away @ ${p.x},${p.z}`);
  }
  return errs;
}
