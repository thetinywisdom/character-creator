import { mulberry32 } from '../lib/rng.js';
import manifest from '../../public/office-kit/manifest.json' with { type: 'json' };
import layout from '../../public/office-kit/layout.json' with { type: 'json' };

// Seeded office layout. Seed 0 (or omitted) is the authored room in layout.json.
// Any other integer is a deterministic rearrangement of that room:
//   - walls, the stair, the door, the glass partition and the kitchen / bar stay
//   - desk count and which way the cluster faces change inside the north bay
//   - the lounge and the meeting set trade the glass room and the open floor
//   - the plan can mirror east-west across the main room
//   - chairs and desktop objects get a few centimetres and a few degrees
//   - optional plants, storage and a laptop come and go
//   - cloth, rug, mug, pot and book colours pick other swatches in the palette
//
// Plan coordinates: X east 0..6.5, Y north 0..14.5. three.js x = X - 3.25, z = 7.25 - Y.

const FACE = { S: 0, E: Math.PI / 2, N: Math.PI, W: -Math.PI / 2 };
const OPP = { S: 'N', N: 'S', E: 'W', W: 'E' };
const MIRROR_X = 7.6; // west wall face 1.25 mirrors onto the east wall face 6.35

// Walk-around size. Plants use the pot, not the leaf canopy, so foliage may
// visually overlap a neighbour the way the authored room already does.
const FOOT = {
  desk: [1.6, 0.8],
  office_chair: [0.61, 0.653],
  monitor: [0.62, 0.16],
  laptop: [0.31, 0.262],
  keyboard: [0.47, 0.12],
  desk_lamp: [0.14, 0.28],
  mug: [0.1, 0.09],
  bookcase: [0.8, 0.28],
  copier: [0.6, 0.62],
  flat_file: [1.65, 0.442],
  wall_shelf: [1.0, 0.2],
  sofa: [2.18, 0.86],
  coffee_table: [1.4, 0.6],
  side_table: [0.45, 0.45],
  whiteboard_mobile: [1.37, 0.56],
  whiteboard_wall: [1.84, 0.07],
  meeting_table: [2.0, 1.0],
  meeting_chair: [0.525, 0.595],
  kitchen_run: [3.246, 0.64],
  fridge: [0.76, 0.815],
  trash_can: [0.47, 0.33],
  coffee_machine: [0.34, 0.41],
  microwave: [0.46, 0.37],
  bar_table: [2.2, 0.65],
  bar_stool: [0.4, 0.4],
  plant_fig: [0.36, 0.36],
  plant_monstera: [0.44, 0.44],
  plant_snake: [0.28, 0.28],
  plant_small: [0.16, 0.16],
  planter_divider: [2.62, 0.56],
};

const NO_FLOOR = new Set(['rug', 'rug_large', 'pendant_lamp']);
const FIXED_ITEMS = new Set([
  'kitchen_run', 'fridge', 'microwave', 'coffee_machine',
  'bar_table', 'bar_stool', 'pendant_lamp', 'trash_can',
]);
const TUCK = new Set(['office_chair', 'meeting_chair']);
const SUPPORT = {
  monitor: 'desk', laptop: 'desk', keyboard: 'desk', desk_lamp: 'desk',
};

const SOFA = [
  ['Walnut', 'Cocoa'], ['Sand', 'Tan'], ['Sage', 'Moss'], ['Powder blue', 'Navy'],
  ['Dusty rose', 'Cocoa'], ['Slate', 'Charcoal'], ['Lilac', 'Navy'], ['Tan', 'Walnut'],
];
const RUG = [
  ['Sand', 'Tan'], ['Sage', 'Moss'], ['Powder blue', 'Denim'], ['Stone', 'Slate'],
  ['Dusty rose', 'Tan'], ['Butter', 'Apricot'], ['Seafoam', 'Sage'],
];
const MUG = ['Off white', 'Powder blue', 'Sage', 'Butter', 'Blush', 'Lilac', 'Seafoam', 'Peach'];
const CHAIR = [
  ['Ink', 'Charcoal'], ['Navy', 'Ink'], ['Slate', 'Charcoal'], ['Cocoa', 'Walnut'], ['Charcoal', 'Ink'],
];
const MEET = ['Ink', 'Navy', 'Slate', 'Cocoa', 'Sage', 'Dusty rose'];
const POT = ['Off white', 'Stone', 'Light gray', 'Paper'];
const BASKET = ['Sand', 'Tan', 'Sage', 'Cocoa'];
const BOOKS = ['Powder blue', 'Lilac', 'Dusty rose', 'Slate', 'Sage', 'Sand', 'Navy', 'Tan', 'Seafoam'];

const baseTris = layout.placements.reduce((sum, p) => sum + (manifest.items[p.item]?.tris ?? 0), 0);
const SHELL_TRIS = manifest.room.tris - baseTris;

const r3 = (n) => Math.round(n * 1000) / 1000;
const r4 = (n) => Math.round(n * 10000) / 10000;

/** Unsigned 32-bit seed. 0 means "the authored layout". */
export function officeSeed(seed) {
  if (seed === undefined || seed === null || seed === false || seed === '') return 0;
  const n = Number(seed);
  if (!Number.isFinite(n)) return 0;
  return n >>> 0;
}

export function planOf(p) {
  return { X: p.x + 3.25, Y: 7.25 - p.z };
}

function facing(rotY) {
  return { x: Math.sin(rotY), y: -Math.cos(rotY) };
}

function cardinal(rotY) {
  const cards = [['S', 0], ['E', Math.PI / 2], ['N', Math.PI], ['W', -Math.PI / 2]];
  let best = 'S';
  let bestD = 99;
  for (const [name, ang] of cards) {
    const d = Math.abs(Math.atan2(Math.sin(rotY - ang), Math.cos(rotY - ang)));
    if (d < bestD) { bestD = d; best = name; }
  }
  return best;
}

function boxOf(p) {
  const [w, d] = FOOT[p.item] ?? [0.4, 0.4];
  const { X, Y } = planOf(p);
  const c = Math.abs(Math.cos(p.rotY));
  const s = Math.abs(Math.sin(p.rotY));
  const hw = (w / 2) * c + (d / 2) * s;
  const hd = (w / 2) * s + (d / 2) * c;
  return { ...p, X, Y, hw, hd, x0: X - hw, x1: X + hw, y0: Y - hd, y1: Y + hd };
}

function penetration(a, b) {
  const ox = Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0);
  const oy = Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0);
  if (ox <= 0.02 || oy <= 0.02) return 0;
  return Math.min(ox, oy);
}

function hitsWall(b) {
  const walls = [
    { x0: 0, x1: 6.5, y0: 0, y1: 0.15, name: 'south' },
    { x0: 0, x1: 0.15, y0: 0, y1: 14.5, name: 'west' },
    { x0: 6.35, x1: 6.5, y0: 0, y1: 14.5, name: 'east' },
    { x0: 0, x1: 6.5, y0: 14.35, y1: 14.5, name: 'north' },
    { x0: 0.15, x1: 1.1, y0: 0.15, y1: 4.92, name: 'stair' },
    { x0: 1.1, x1: 1.25, y0: 0.15, y1: 5.0, name: 'hall' },
    { x0: 1.1, x1: 1.25, y0: 5.9, y1: 14.35, name: 'hall' },
    { x0: 1.25, x1: 6.35, y0: 2.65, y1: 2.8, name: 'glass' },
  ];
  for (const w of walls) {
    if (penetration(b, w) > (b.item === 'whiteboard_wall' || b.item === 'wall_shelf' ? 0.08 : 0)) return w.name;
  }
  return null;
}

const floorItem = (p) => p.y < 0.2 && !NO_FLOOR.has(p.item) && FOOT[p.item];

/**
 * Layout problems a person would notice: overlapping solids, furniture in a
 * wall, chairs turned away from their table, or no ~0.9 m route from the
 * stair-hall door to the desks, the lounge and the kitchen.
 * @returns {string[]}
 */
export function officeLayoutIssues(placements) {
  const issues = [];
  const boxes = placements.map(boxOf);
  const floor = boxes.filter(floorItem);

  for (const b of floor) {
    if (b.x0 < 0.12 || b.x1 > 6.38 || b.y0 < 0.12 || b.y1 > 14.38) issues.push(`${b.item} outside the room`);
    const wall = hitsWall(b);
    if (wall) issues.push(`${b.item} in the ${wall}`);
    // Keep the door landing clear (the opening itself is only 0.82 m).
    if (penetration(b, { x0: 1.25, x1: 2.15, y0: 4.95, y1: 6.02 }) > 0) issues.push(`${b.item} blocks the entrance`);
  }

  for (let i = 0; i < floor.length; i++) {
    for (let j = i + 1; j < floor.length; j++) {
      const a = floor[i];
      const b = floor[j];
      const pen = penetration(a, b);
      if (!pen) continue;
      const pair = (chair, host) => TUCK.has(chair.item) && (host.item === 'desk' || host.item === 'meeting_table')
        && pen < 0.5 && Math.hypot(chair.X - host.X, chair.Y - host.Y) < 1.3;
      const tuck = pair(a, b) || pair(b, a);
      if (!tuck) issues.push(`${a.item} overlaps ${b.item}`);
    }
  }

  for (const p of placements) {
    if (![p.x, p.y, p.z, p.rotY].every(Number.isFinite)) issues.push(`${p.item} has a bad position`);
    if (p.y < -0.001 || p.y > 2.4) issues.push(`${p.item} off the floor`);
    const want = SUPPORT[p.item];
    if (!want) continue;
    const host = boxes.find((b) => b.item === want && p.x + 3.25 > b.x0 - 0.02 && p.x + 3.25 < b.x1 + 0.02 && (7.25 - p.z) > b.y0 - 0.02 && (7.25 - p.z) < b.y1 + 0.02);
    if (!host) issues.push(`${p.item} is not on a ${want}`);
  }
  for (const p of placements) {
    if (p.item !== 'plant_small' || p.y < 0.3) continue;
    if (p.y > 0.5 && p.y < 0.9) {
      const desk = boxes.find((b) => b.item === 'desk' && Math.abs(b.X - planOf(p).X) < b.hw + 0.02 && Math.abs(b.Y - planOf(p).Y) < b.hd + 0.02);
      if (!desk) issues.push('desk plant missed the desktop');
    }
    if (p.y > 0.9) {
      const shelf = boxes.find((b) => b.item === 'wall_shelf' && Math.hypot(b.X - planOf(p).X, b.Y - planOf(p).Y) < 0.45);
      if (!shelf) issues.push('shelf plant missed the shelf');
    }
  }

  for (const c of floor) {
    if (c.item !== 'office_chair' && c.item !== 'meeting_chair') continue;
    const hostName = c.item === 'office_chair' ? 'desk' : 'meeting_table';
    const dir = facing(c.rotY);
    let ok = false;
    for (const d of floor) {
      if (d.item !== hostName) continue;
      const vx = d.X - c.X;
      const vy = d.Y - c.Y;
      // Aimed at the table, including a chair at the end of a long table,
      // where the centre sits off to one side.
      const along = vx * dir.x + vy * dir.y;
      const side = Math.abs(vx * dir.y - vy * dir.x);
      if (along > 0.15 && along < 1.2 && side < 0.95) ok = true;
    }
    if (!ok) issues.push(`${c.item} does not face its ${hostName}`);
  }

  for (const b of boxes) {
    if (!['bookcase', 'copier', 'flat_file', 'wall_shelf', 'whiteboard_wall'].includes(b.item)) continue;
    const face = cardinal(b.rotY);
    const into = b.X < 1.7 ? 'E' : b.X > 5.9 ? 'W' : b.Y < 0.45 ? 'N' : b.Y > 14.05 ? 'S' : null;
    if (into && face !== into) issues.push(`${b.item} faces ${face}, not into the room`);
  }

  issues.push(...routeIssues(floor));

  const tris = SHELL_TRIS + placements.reduce((sum, p) => sum + (manifest.items[p.item]?.tris ?? 0), 0);
  if (tris > 10000) issues.push(`triangle budget ${tris}`);
  return [...new Set(issues)];
}

// A route is a chain of cross-sections that each leave a 0.9 m gap between
// the walls and the furniture. The authored bar, copier and lounge aisles
// are what this is measured against.
function gapsAt(floor, Y) {
  const blocks = [];
  for (const b of floor) if (Y >= b.y0 && Y <= b.y1) blocks.push([b.x0, b.x1]);
  blocks.sort((a, c) => a[0] - c[0]);
  let x = 1.25;
  const gaps = [];
  for (const [a, b] of blocks) {
    if (a - x >= 0.9) gaps.push([x, a]);
    x = Math.max(x, b);
  }
  if (6.35 - x >= 0.9) gaps.push([x, 6.35]);
  return gaps;
}

function routeIssues(floor) {
  const STEP = 0.1;
  const slices = [];
  for (let Y = 2.9; Y <= 14.15; Y += STEP) slices.push({ Y, gaps: gapsAt(floor, Y) });
  const reach = slices.map((s) => s.gaps.map(() => false));
  const door = slices.findIndex((s) => Math.abs(s.Y - 5.45) <= STEP / 2);
  const queue = [];
  slices[door].gaps.forEach((g, i) => {
    if (g[0] <= 1.85 && g[1] >= 1.85) { reach[door][i] = true; queue.push([door, i]); }
  });
  const joins = (a, b) => Math.min(a[1], b[1]) - Math.max(a[0], b[0]) >= 0.4;
  while (queue.length) {
    const [i, gi] = queue.pop();
    for (const j of [i - 1, i + 1]) {
      if (j < 0 || j >= slices.length) continue;
      slices[j].gaps.forEach((h, hi) => {
        if (reach[j][hi] || !joins(slices[i].gaps[gi], h)) return;
        reach[j][hi] = true;
        queue.push([j, hi]);
      });
    }
  }
  const near = (X, Y, ySlack = 0.7) => {
    for (let i = 0; i < slices.length; i++) {
      if (Math.abs(slices[i].Y - Y) > ySlack) continue;
      for (let gi = 0; gi < slices[i].gaps.length; gi++) {
        if (!reach[i][gi]) continue;
        const g = slices[i].gaps[gi];
        if (X >= g[0] - 0.2 && X <= g[1] + 0.2) return true;
      }
    }
    return false;
  };
  const issues = [];
  if (!reach[door].some(Boolean)) issues.push('entrance is blocked');
  if (!near(1.8, 3.5, 0.5)) issues.push('no clear path to the kitchen');
  const desks = floor.filter((b) => b.item === 'desk');
  if (desks.length) {
    const south = Math.min(...desks.map((d) => d.y0));
    const ax = desks.reduce((s, d) => s + d.X, 0) / desks.length;
    if (!near(Math.min(5.2, Math.max(2.0, ax)), south - 0.4, 0.85)) issues.push('no clear path to the desks');
  }
  const beside = (b) => near(b.X, b.y0 - 0.55, 0.45) || near(b.X, b.y1 + 0.55, 0.45)
    || near(b.x0 - 0.55, b.Y, 0.45) || near(b.x1 + 0.55, b.Y, 0.45);
  const sofas = floor.filter((b) => b.item === 'sofa' && b.Y > 3);
  if (sofas.length && !sofas.some(beside)) issues.push('no clear path to the lounge');
  const table = floor.find((b) => b.item === 'meeting_table' && b.Y > 3);
  if (table && !beside(table)) issues.push('no clear path to the meeting table');
  return issues;
}

function fixedPlacements() {
  return layout.placements.filter((p) => FIXED_ITEMS.has(p.item) || (p.item === 'mug' && p.y >= 0.9));
}

function pick(rnd, list) {
  return list[Math.floor(rnd() * list.length)];
}

function shuffle(rnd, list) {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function choicesOf(seed) {
  const rnd = mulberry32(seed);
  return {
    mirror: rnd() < 0.5,
    swap: rnd() < 0.5,
    deskKind: pick(rnd, ['pack4', 'pack2', 'north2', 'bench4', 'pack3']),
    dx: pick(rnd, [-0.3, -0.12, 0.12, 0.32]),
    dy: pick(rnd, [-0.16, 0, 0.1]),
    loungeKind: pick(rnd, ['classic', 'linear']),
    loungeTx: pick(rnd, [3.85, 4.05, 4.22]),
    loungeTy: pick(rnd, [7.6, 7.9, 8.15]),
    meetingKind: pick(rnd, ['classic', 'turned']),
    meetingDx: pick(rnd, [-0.32, 0, 0.28]),
    meetChairs: rnd() < 0.55 ? 6 : 4,
    openX: pick(rnd, [3.85, 4.2, 4.5]),
    openY: pick(rnd, [7.55, 8.0, 8.4]),
    opts: {
      laptop: rnd() < 0.72,
      lamp: rnd() < 0.68,
      mugs: rnd() < 0.45 ? 2 : 1,
      deskPlant: rnd() < 0.62,
      planter: rnd() < 0.55,
      bookcases: pick(rnd, [0, 1, 2]),
      copier: rnd() < 0.55,
      fig: rnd() < 0.7,
      monstera: rnd() < 0.75,
      snake: rnd() < 0.65,
      sideTable: rnd() < 0.7,
      mobileBoard: rnd() < 0.5,
      flatFile: rnd() < 0.45,
      shelves: rnd() < 0.72,
    },
    look: {
      sofa: pick(rnd, SOFA),
      rug: pick(rnd, RUG),
      mug: pick(rnd, MUG),
      chair: pick(rnd, CHAIR),
      meeting: pick(rnd, MEET),
      pot: pick(rnd, POT),
      basket: pick(rnd, BASKET),
      books: shuffle(rnd, BOOKS),
    },
  };
}

function fwd(face, dist, side = 0) {
  const F = { S: [0, -1], N: [0, 1], E: [1, 0], W: [-1, 0] }[face];
  const R = { S: [1, 0], N: [-1, 0], E: [0, 1], W: [0, -1] }[face];
  return [F[0] * dist + R[0] * side, F[1] * dist + R[1] * side];
}

function push(list, item, X, Y, face = 'S', el = 0, tag = '', yaw = 0) {
  list.push({ item, X, Y, face, el, tag, yaw });
}

function stationsFor(kind, dx, dy) {
  if (kind === 'pack4') {
    return [
      [3.69 + dx, 13.35 + dy, 'W'],
      [3.69 + dx, 11.75 + dy, 'W'],
      [4.51 + dx, 13.35 + dy, 'E'],
      [4.51 + dx, 11.75 + dy, 'E'],
    ];
  }
  if (kind === 'pack2') {
    return [
      [3.55 + dx, 13.25 + dy, 'W'],
      [4.55 + dx, 13.25 + dy, 'E'],
    ];
  }
  if (kind === 'north2') {
    return [
      [3.15 + dx * 0.6, 13.88, 'S'],
      [4.95 + dx * 0.6, 13.88, 'S'],
    ];
  }
  if (kind === 'bench4') {
    return [
      [3.2 + dx * 0.5, 13.88, 'S'],
      [5.0 + dx * 0.5, 13.88, 'S'],
      [3.2 + dx * 0.5, 11.08 + dy, 'N'],
      [5.0 + dx * 0.5, 11.08 + dy, 'N'],
    ];
  }
  return [
    [3.15 + dx * 0.5, 13.88, 'S'],
    [4.95 + dx * 0.5, 13.88, 'S'],
    [3.15 + dx * 0.5, 11.15 + dy, 'N'],
  ];
}

function addStation(list, X, Y, face, tag, rnd, extras) {
  push(list, 'desk', X, Y, face, 0, tag);
  const [cx, cy] = fwd(face, 0.65 + (rnd() - 0.5) * 0.04, (rnd() - 0.5) * 0.05);
  push(list, 'office_chair', X + cx, Y + cy, OPP[face], 0, tag, (rnd() - 0.5) * 0.1);
  const [mx, my] = fwd(face, -0.28 + (rnd() - 0.5) * 0.04, (rnd() - 0.5) * 0.12);
  push(list, 'monitor', X + mx, Y + my, face, 0.73, tag, (rnd() - 0.5) * 0.1);
  const [kx, ky] = fwd(face, 0.13 + (rnd() - 0.5) * 0.03, (rnd() - 0.5) * 0.1);
  push(list, 'keyboard', X + kx, Y + ky, face, 0.73, tag, (rnd() - 0.5) * 0.16);
  if (extras.lamp) {
    const [lx, ly] = fwd(face, -0.18, -0.52);
    push(list, 'desk_lamp', X + lx, Y + ly, face, 0.73, tag, (rnd() - 0.5) * 0.2);
  }
  if (extras.mug) {
    const [ux, uy] = fwd(face, 0.16, 0.42 + (rnd() - 0.5) * 0.08);
    push(list, 'mug', X + ux, Y + uy, 'S', 0.73, tag);
  }
  if (extras.plant) {
    const [px, py] = fwd(face, -0.2, 0.5);
    push(list, 'plant_small', X + px, Y + py, 'S', 0.73, tag);
  }
  if (extras.laptop) {
    const [lx, ly] = fwd(face, 0.02, 0.28);
    push(list, 'laptop', X + lx, Y + ly, face, 0.73, tag, (rnd() - 0.5) * 0.2);
  }
}

function addLounge(list, spec, rnd) {
  const { loungeKind, loungeTx: tx, loungeTy: ty, opts } = spec;
  if (spec.swap) {
    push(list, 'rug', 4.05, 1.15, 'S');
    push(list, 'sofa', 4.05, 0.78, 'N', 0, 'lounge');
    push(list, 'coffee_table', 4.05, 1.78, 'S', 0, 'lounge');
    if (opts.sideTable) push(list, 'side_table', 5.55, 0.72, 'S', 0, 'lounge');
    push(list, 'plant_small', 4.4, 1.78, 'S', 0.38, 'lounge');
    push(list, 'mug', 3.7, 1.74, 'S', 0.38, 'lounge');
    return;
  }
  if (loungeKind === 'linear') {
    push(list, 'rug', tx, ty + 0.15, 'S');
    push(list, 'sofa', tx, ty + 0.95, 'S', 0, 'lounge');
    push(list, 'coffee_table', tx, ty - 0.15, 'S', 0, 'lounge');
    if (opts.sideTable) push(list, 'side_table', tx + 1.55, ty + 0.95, 'S', 0, 'lounge');
  } else {
    push(list, 'rug', tx - 0.11, ty - 0.2, 'S');
    push(list, 'sofa', tx - 0.1, ty + 1.19, 'S', 0, 'lounge');
    push(list, 'sofa', tx + 1.55, ty - 0.2, 'W', 0, 'lounge');
    push(list, 'coffee_table', tx, ty, 'S', 0, 'lounge');
    if (opts.sideTable) push(list, 'side_table', tx + 1.45, ty + 1.32, 'S', 0, 'lounge');
  }
  const jx = (rnd() - 0.5) * 0.08;
  const jz = (rnd() - 0.5) * 0.06;
  const tX = tx;
  const tY = loungeKind === 'linear' ? ty - 0.15 : ty;
  push(list, 'plant_small', tX + 0.28 + jx, tY + jz, 'S', 0.38, 'lounge');
  push(list, 'mug', tX - 0.28 + jx, tY - jz, 'S', 0.38, 'lounge');
}

function addMeeting(list, spec, rnd) {
  const n = spec.meetChairs;
  const yaw = () => (rnd() - 0.5) * 0.08;
  const nudge = () => (rnd() - 0.5) * 0.03;
  if (!spec.swap && spec.meetingKind === 'turned') {
    const X = 4.05;
    const Y = 1.3;
    push(list, 'rug', X, Y, 'S');
    push(list, 'meeting_table', X, Y, 'E', 0, 'meet');
    const ys = n === 6 ? [Y - 0.62, Y, Y + 0.62] : [Y - 0.42, Y + 0.42];
    for (const y of ys) {
      push(list, 'meeting_chair', X - 0.58, y + nudge(), 'E', 0, 'meet', yaw());
      push(list, 'meeting_chair', X + 0.58, y + nudge(), 'W', 0, 'meet', yaw());
    }
    return;
  }
  if (spec.swap) {
    const X = spec.openX;
    const Y = spec.openY;
    push(list, 'rug_large', X, Y, 'S');
    push(list, 'meeting_table', X, Y, 'S', 0, 'meet');
    const xs = n === 6 ? [X - 0.66, X, X + 0.66] : [X - 0.42, X + 0.42];
    for (const x of xs) {
      push(list, 'meeting_chair', x + nudge(), Y + 0.58, 'S', 0, 'meet', yaw());
      push(list, 'meeting_chair', x + nudge(), Y - 0.58, 'N', 0, 'meet', yaw());
    }
    return;
  }
  const X = 3.75 + spec.meetingDx;
  const Y = 1.35;
  push(list, 'rug_large', X + 0.08, Y, 'S');
  push(list, 'meeting_table', X, Y, 'S', 0, 'meet');
  const xs = n === 6 ? [X - 0.69, X, X + 0.69] : [X - 0.4, X + 0.4];
  for (const x of xs) {
    push(list, 'meeting_chair', x + nudge(), Y + 0.4, 'S', 0, 'meet', yaw());
    push(list, 'meeting_chair', x + nudge(), Y - 0.4, 'N', 0, 'meet', yaw());
  }
}

function addStorage(list, spec) {
  const { opts } = spec;
  const deskYs = list.filter((p) => p.item === 'desk').map((p) => p.Y);
  const south = deskYs.length ? Math.min(...deskYs) - 0.9 : 9;
  if (opts.bookcases >= 1) push(list, 'bookcase', 1.39, 13.3, 'E');
  if (opts.bookcases >= 2) push(list, 'bookcase', 1.39, 12.4, 'E');
  if (opts.copier && opts.bookcases > 0) push(list, 'copier', 1.56, opts.bookcases > 1 ? 11.5 : 12.35, 'E');
  if (opts.flatFile) push(list, 'flat_file', 1.47, 6.85, 'E');
  if (opts.shelves) {
    for (const h of [1.06, 1.44, 1.82]) push(list, 'wall_shelf', 1.25, 7.85, 'E', h);
    push(list, 'plant_small', 1.38, 8.05, 'E', 1.1);
    push(list, 'plant_small', 1.38, 7.55, 'E', 1.48);
    push(list, 'plant_small', 1.38, 8.1, 'E', 1.86);
  }
  if (opts.mobileBoard && !spec.swap) push(list, 'whiteboard_mobile', 2.5, Math.min(9.1, south), 'E');
  if (!spec.swap) {
    push(list, 'whiteboard_wall', 3.77 + spec.meetingDx, 0.15, 'N', 0.88);
    push(list, 'whiteboard_wall', 1.25, 1.4, 'E', 0.88);
  } else {
    push(list, 'whiteboard_wall', 1.25, 1.35, 'E', 0.88);
  }
}

function addPlanter(list, spec) {
  if (!spec.opts.planter || spec.swap) return;
  const desks = list.filter((p) => p.item === 'desk');
  const sofas = list.filter((p) => p.item === 'sofa');
  if (!desks.length || !sofas.length) return;
  const deskSouth = Math.min(...desks.map((d) => d.Y)) - 0.8;
  const loungeNorth = Math.max(...sofas.map((d) => d.Y)) + 0.5;
  if (deskSouth - loungeNorth < 0.85) return;
  push(list, 'planter_divider', 4.05, (deskSouth + loungeNorth) / 2, 'S');
}

function emit(list, mirror) {
  return list.map((p) => {
    let { X, Y, face, yaw = 0 } = p;
    if (mirror) {
      X = MIRROR_X - X;
      if (face === 'E') face = 'W';
      else if (face === 'W') face = 'E';
      yaw = -yaw;
    }
    return {
      item: p.item,
      x: r3(X - 3.25),
      y: r3(p.el || 0),
      z: r3(7.25 - Y),
      rotY: r4((FACE[face] ?? 0) + yaw),
      tag: p.tag || '',
    };
  });
}

function planPlacement(item, X, Y, face = 'S', el = 0) {
  return { item, x: r3(X - 3.25), y: r3(el), z: r3(7.25 - Y), rotY: r4(FACE[face] ?? 0), tag: '' };
}

// Corner plants go in after the flip, and only where they do not overlap or
// close the walk. A fig that would land on a mirrored desk is skipped.
function withPlants(placements, spec) {
  let next = placements;
  const trySpot = (item, spots) => {
    if (!spec.opts[item === 'plant_fig' ? 'fig' : item === 'plant_monstera' ? 'monstera' : 'snake']) return;
    for (const [X, Y] of spots) {
      const trial = planPlacement(item, X, Y);
      const candidate = [...next, trial];
      if (officeLayoutIssues(candidate).length === 0) { next = candidate; return; }
    }
  };
  trySpot('plant_fig', [[1.72, 13.95], [6.0, 13.92], [6.02, 6.5], [2.15, 6.55]]);
  trySpot('plant_monstera', [[6.0, 13.9], [6.02, 10.4], [1.75, 13.9], [6.0, 6.7]]);
  trySpot('plant_snake', [[6.05, 6.4], [6.02, 10.6], [2.2, 6.6], [5.9, 9.4]]);
  return next;
}

function assemble(spec, seed) {
  const rnd = mulberry32((seed + 0x9e3779b9) >>> 0);
  const list = [];
  const spots = stationsFor(spec.deskKind, spec.dx, spec.dy);
  spots.forEach(([X, Y, face], i) => {
    addStation(list, X, Y, face, `d${i}`, rnd, {
      lamp: spec.opts.lamp && i === 0,
      mug: i < spec.opts.mugs,
      plant: spec.opts.deskPlant && i === 1,
      laptop: spec.opts.laptop && i === spots.length - 1,
    });
  });
  addLounge(list, spec, rnd);
  addMeeting(list, spec, rnd);
  addStorage(list, spec);
  addPlanter(list, spec);
  return withPlants([...emit(list, spec.mirror), ...fixedPlacements()], spec);
}

function stripped(spec, level) {
  const opts = { ...spec.opts };
  if (level >= 1) {
    opts.planter = false;
    opts.copier = false;
    opts.flatFile = false;
    opts.mobileBoard = false;
    opts.snake = false;
    opts.bookcases = Math.min(opts.bookcases, 1);
  }
  if (level >= 2) {
    opts.bookcases = 0;
    opts.fig = false;
    opts.shelves = false;
    opts.sideTable = false;
    opts.monstera = false;
  }
  return { ...spec, opts, mirror: level >= 2 ? false : spec.mirror };
}

/**
 * Placements and a swatch look for one office.
 * The same seed always returns the same objects. Seed 0 keeps layout.json
 * and the authored colours (look is null).
 */
export function officeLayout(seed) {
  const n = officeSeed(seed);
  if (!n) return { placements: layout.placements, look: null, seed: 0 };
  const base = choicesOf(n);
  const tries = [
    base,
    stripped(base, 1),
    stripped({ ...base, swap: false }, 2),
    {
      ...base,
      mirror: false,
      swap: false,
      deskKind: 'pack4',
      dx: 0,
      dy: 0,
      loungeKind: 'classic',
      loungeTx: 4.26,
      loungeTy: 7.63,
      meetingKind: 'classic',
      meetingDx: 0,
      meetChairs: 6,
      opts: {
        laptop: true, lamp: true, mugs: 2, deskPlant: true, planter: false,
        bookcases: 1, copier: false, fig: false, monstera: true, snake: false,
        sideTable: true, mobileBoard: false, flatFile: false, shelves: true,
      },
    },
  ];
  let placements = null;
  for (const spec of tries) {
    const built = assemble(spec, n);
    if (officeLayoutIssues(built).length === 0) {
      placements = built;
      break;
    }
  }
  placements ??= assemble(tries[tries.length - 1], n);
  return { placements, look: base.look, seed: n };
}

export function officeTriangleCount(placements) {
  return SHELL_TRIS + placements.reduce((sum, p) => sum + (manifest.items[p.item]?.tris ?? 0), 0);
}
