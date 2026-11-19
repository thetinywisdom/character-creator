import manifest from '../../public/diner-kit/manifest.json';
import layout from '../../public/diner-kit/layout.json';
import { mulberry32 } from '../lib/rng.js';

// Seeded diner layouts. Seed 0 (or no seed) is the hand-placed room in
// layout.json. Any other integer builds the same room every time.
//
// Fixed, on every seed: walls, windows, the door, the floor, the counter run,
// the kitchen line (work counters, grill, soda fountain, pass windows), the
// coffee maker, the register, the menu, the clock, and the mat at the door.
// The right-hand aisle from the door to the counter stays clear (~0.9 m), and
// so does the walk along the customer side of the counter.
//
// What changes: which zone the booths use (one row, a front pair, or the left
// wall), how many booths and stools, a mirror of the row within the dining
// floor, a few centimetres and a small turn on stools and table items, which
// loose props are out, and a palette theme for the red / teal surfaces.

const TRI = Object.fromEntries(Object.entries(manifest.items).map(([k, v]) => [k, v.tris]));
const FOOT = Object.fromEntries(Object.entries(manifest.items).map(([k, v]) => [k, v.footprint]));

// Walls, windows, door and floor. Measured from the seed-0 room
// (9747 total − 7095 of placed items).
export const SHELL_TRIS = 2652;
const TRI_LIMIT = 10000;

const BACK = new Set(['menu_board', 'neon_sign', 'clock', 'poster']);
const HANGING = new Set(['pendant']);
const WALL = BACK;

const FIXED = new Set([
  'counter', 'work_counter', 'grill', 'soda_fountain', 'coffee_maker',
  'register', 'pass_window', 'menu_board', 'clock', 'welcome_mat',
]);

// Customer circulation. Furniture may touch these edges; it may not stand in them.
// The mat is the one exception (it lies in the landing).
const BASE_WALKS = [
  { name: 'landing', x: 4.7, z: 3.2, hw: 0.75, hd: 0.55 },
  { name: 'aisle', x: 4.35, z: 1.45, hw: 0.48, hd: 1.2 },
  { name: 'counter', x: 0, z: 0.22, hw: 4.55, hd: 0.45 },
];

const INNER = { minX: -5.84, maxX: 5.84, minZ: -3.84, maxZ: 3.84 };

// cloth / paint / light swaps. Ketchup stays Dusty rose (it is not in this map).
const THEMES = [
  null,
  {
    'cloth:Dusty rose': 'cloth:Cocoa',
    'paint:Dusty rose': 'paint:Brick',
    'paint:Seafoam': 'paint:Sage',
    'light:Dusty rose': 'light:Butter',
    'light:Seafoam': 'light:Seafoam',
  },
  {
    'cloth:Dusty rose': 'cloth:Brick',
    'paint:Dusty rose': 'paint:Cocoa',
    'paint:Seafoam': 'paint:Powder blue',
    'light:Dusty rose': 'light:Dusty rose',
    'light:Seafoam': 'light:Butter',
  },
  {
    'cloth:Dusty rose': 'cloth:Sand',
    'paint:Dusty rose': 'paint:Dusty rose',
    'paint:Seafoam': 'paint:Sage',
    'light:Dusty rose': 'light:Seafoam',
    'light:Seafoam': 'light:Dusty rose',
  },
];

const jitter = (rng, amount) => (rng() - 0.5) * 2 * amount;

function footprintBox(p) {
  const [w, d] = FOOT[p.item];
  const rot = p.rotY || 0;
  const c = Math.cos(rot);
  const s = Math.sin(rot);
  const lz = BACK.has(p.item) ? d / 2 : 0;
  return {
    x: p.x + lz * s,
    z: p.z + lz * c,
    hw: (w / 2) * Math.abs(c) + (d / 2) * Math.abs(s),
    hd: (w / 2) * Math.abs(s) + (d / 2) * Math.abs(c),
    p,
  };
}

function overlaps(a, b, slack = 0.01) {
  return Math.abs(a.x - b.x) < a.hw + b.hw - slack
    && Math.abs(a.z - b.z) < a.hd + b.hd - slack;
}

function insideRoom(box, wall) {
  // A few centimetres of bite is the piece sitting against the wall, same as the hand-placed jukebox.
  const out = wall ? 0.14 : 0.06;
  return box.x - box.hw >= INNER.minX - out
    && box.x + box.hw <= INNER.maxX + out
    && box.z - box.hd >= INNER.minZ - out
    && box.z + box.hd <= INNER.maxZ + out;
}

function onSupport(item, floors) {
  return floors.some((f) => {
    if (f.p.item !== 'booth' && f.p.item !== 'counter' && f.p.item !== 'work_counter') return false;
    if (item.x < f.x - f.hw - 0.02 || item.x > f.x + f.hw + 0.02) return false;
    if (item.z < f.z - f.hd - 0.02 || item.z > f.z + f.hd + 0.02) return false;
    // The grill straddles two kitchen counters, so a seam may cut the box.
    const hangX = Math.max(0, item.x + item.hw - (f.x + f.hw), (f.x - f.hw) - (item.x - item.hw));
    const hangZ = Math.max(0, item.z + item.hd - (f.z + f.hd), (f.z - f.hd) - (item.z - item.hd));
    return hangX < 0.85 && hangZ < 0.28;
  });
}

const isFloor = (p) => (p.y || 0) < 0.4 && !HANGING.has(p.item) && !WALL.has(p.item);
const isSurface = (p) => (p.y || 0) >= 0.4 && !HANGING.has(p.item) && !WALL.has(p.item);

function touches(a, b, pad = 0.04) {
  return Math.abs(a.x - b.x) <= a.hw + b.hw + pad
    && Math.abs(a.z - b.z) <= a.hd + b.hd + pad;
}

/** Point just outside the open side of a booth: −z (toward the counter), +x, or −x. */
function accessPoint(box) {
  const rot = box.p.rotY || 0;
  const n = ((rot % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
  if (n < 0.25 || n > Math.PI * 2 - 0.25) return [box.x, box.z - box.hd - 0.05];
  if (Math.abs(n - Math.PI / 2) < 0.25) return [box.x + box.hw + 0.05, box.z];
  if (Math.abs(n - Math.PI * 1.5) < 0.25) return [box.x - box.hw - 0.05, box.z];
  return null;
}

function nearWalk(px, pz, walks, reach = 0.28) {
  return walks.some((w) => Math.abs(px - w.x) <= w.hw + reach && Math.abs(pz - w.z) <= w.hd + reach);
}

/**
 * @returns {{ ok: boolean, problems: string[], tris: number }}
 */
export function auditDiner(plan) {
  const problems = [];
  const boxes = plan.placements.map(footprintBox);
  const floors = boxes.filter((b) => isFloor(b.p));
  const surfaces = boxes.filter((b) => isSurface(b.p));
  const walks = plan.walks;

  let tris = SHELL_TRIS;
  for (const p of plan.placements) tris += TRI[p.item] || 0;
  if (tris > TRI_LIMIT) problems.push(`tris ${tris} over ${TRI_LIMIT}`);

  for (const b of boxes) {
    if (HANGING.has(b.p.item)) continue;
    if (!insideRoom(b, WALL.has(b.p.item))) {
      problems.push(`outside ${b.p.item} @ ${b.p.x.toFixed(2)},${b.p.z.toFixed(2)}`);
    }
  }
  for (let i = 0; i < floors.length; i++) {
    for (let j = i + 1; j < floors.length; j++) {
      if (overlaps(floors[i], floors[j])) {
        problems.push(`overlap ${floors[i].p.item} and ${floors[j].p.item}`);
      }
    }
    if (floors[i].p.item === 'welcome_mat') continue;
    for (const w of walks) {
      if (overlaps(floors[i], w, 0)) problems.push(`blocks ${w.name}: ${floors[i].p.item}`);
    }
  }
  for (let i = 0; i < surfaces.length; i++) {
    for (let j = i + 1; j < surfaces.length; j++) {
      if (Math.abs((surfaces[i].p.y || 0) - (surfaces[j].p.y || 0)) > 0.4) continue;
      if (overlaps(surfaces[i], surfaces[j])) {
        problems.push(`overlap ${surfaces[i].p.item} and ${surfaces[j].p.item}`);
      }
    }
    if (!onSupport(surfaces[i], floors)) {
      problems.push(`off surface ${surfaces[i].p.item} @ ${surfaces[i].p.x.toFixed(2)},${surfaces[i].p.z.toFixed(2)}`);
    }
  }

  const seen = new Set([0]);
  let grew = true;
  while (grew) {
    grew = false;
    for (let i = 0; i < walks.length; i++) {
      if (seen.has(i)) continue;
      for (const j of seen) {
        if (touches(walks[i], walks[j])) { seen.add(i); grew = true; break; }
      }
    }
  }
  if (seen.size !== walks.length) problems.push('walkway does not reach the door');

  for (const b of floors) {
    if (b.p.item !== 'booth') continue;
    const pt = accessPoint(b);
    if (!pt || !nearWalk(pt[0], pt[1], walks)) problems.push(`booth has no path @ ${b.p.x.toFixed(2)},${b.p.z.toFixed(2)}`);
  }
  for (const b of floors) {
    if (b.p.item !== 'stool') continue;
    if (b.p.z < -0.7 || b.p.z > -0.25) problems.push(`stool not at the counter @ ${b.p.z.toFixed(2)}`);
  }

  return { ok: problems.length === 0, problems, tris };
}

function world(rot, lx, lz) {
  const c = Math.cos(rot);
  const s = Math.sin(rot);
  return [lx * c + lz * s, -lx * s + lz * c];
}

function rowXs(rng, xs) {
  if (rng() < 0.5) return xs;
  const flipped = xs.map((x) => -1.6 - x);
  if (flipped.every((x) => x > -5.2 && x < 2.9)) return flipped;
  return xs;
}

const ARRANGEMENTS = [
  {
    name: 'row',
    // One line of booths facing the counter. Sometimes mirrored within the dining floor.
    build(rng) {
      let xs = [-4.5, -2.68, -0.86, 0.96];
      if (rng() < 0.4) xs = xs.slice(0, 3);
      xs = rowXs(rng, xs);
      const z = 1.38 + jitter(rng, 0.02);
      return {
        booths: xs.map((x) => ({ item: 'booth', x, y: 0, z, rotY: 0 })),
        walks: [],
      };
    },
  },
  {
    name: 'front',
    // Two booths by the counter, two more in the empty front half, open toward a 0.9 m corridor.
    build() {
      return {
        booths: [
          { item: 'booth', x: -4.35, y: 0, z: 1.3, rotY: 0 },
          { item: 'booth', x: -2.5, y: 0, z: 1.3, rotY: 0 },
          { item: 'booth', x: -0.15, y: 0, z: 2.6, rotY: -Math.PI / 2 },
          { item: 'booth', x: 1.21, y: 0, z: 2.6, rotY: Math.PI / 2 },
        ],
        walks: [
          { name: 'corridor', x: -1.19, z: 1.7, hw: 0.45, hd: 1.25 },
          { name: 'front-side', x: 2.28, z: 1.65, hw: 0.45, hd: 1.15 },
        ],
      };
    },
  },
  {
    name: 'wall',
    // A pair against the left wall, facing into the room, plus a short row by the counter.
    build(rng) {
      const extra = rng() < 0.5;
      const booths = [
        { item: 'booth', x: -5.25, y: 0, z: 0.8, rotY: Math.PI / 2 },
        { item: 'booth', x: -5.25, y: 0, z: 2.62, rotY: Math.PI / 2 },
        { item: 'booth', x: -2.05, y: 0, z: 1.3, rotY: 0 },
        { item: 'booth', x: -0.15, y: 0, z: 1.3, rotY: 0 },
      ];
      if (extra) booths.push({ item: 'booth', x: 1.7, y: 0, z: 1.3, rotY: 0 });
      return {
        booths,
        walks: [
          { name: 'wall-aisle', x: -4.21, z: 1.75, hw: 0.45, hd: 1.35 },
        ],
      };
    },
  },
  {
    name: 'open',
    // Three booths and a clear front corner for the jukebox.
    build(rng) {
      let xs = [-4.4, -2.2, 0.1];
      xs = rowXs(rng, xs);
      const z = 1.4;
      return {
        booths: xs.map((x) => ({ item: 'booth', x, y: 0, z, rotY: 0 })),
        walks: [],
      };
    },
  },
];

function tryAdd(state, p) {
  const t = TRI[p.item];
  if (state.tris + t > TRI_LIMIT) return false;
  const box = footprintBox(p);
  if (!HANGING.has(p.item) && !insideRoom(box, WALL.has(p.item))) return false;
  if (WALL.has(p.item)) {
    for (const other of state.walls) if (overlaps(box, other, 0.04)) return false;
    state.walls.push(box);
  }
  if (isFloor(p)) {
    for (const other of state.floors) if (overlaps(box, other)) return false;
    if (p.item !== 'welcome_mat') {
      for (const w of state.walks) if (overlaps(box, w, 0)) return false;
    }
    state.floors.push(box);
  } else if (isSurface(p)) {
    for (const other of state.surfaces) {
      if (Math.abs((other.p.y || 0) - (p.y || 0)) <= 0.4 && overlaps(box, other)) return false;
    }
    state.surfaces.push(box);
  }
  state.placements.push(p);
  state.tris += t;
  return true;
}

function place(state, base, loose) {
  if (loose && tryAdd(state, loose)) return true;
  return tryAdd(state, base);
}

/**
 * @param {number} seed integer. 0 (or anything that truncates to 0) is the hand-made room.
 */
export function dinerLayout(seed) {
  const n = Math.trunc(Number(seed));
  if (!Number.isFinite(n) || n === 0) {
    return {
      seed: 0,
      arrangement: 'handmade',
      theme: null,
      placements: layout.placements,
      walks: BASE_WALKS,
    };
  }
  const rng = mulberry32(n >>> 0);
  const theme = THEMES[Math.floor(rng() * THEMES.length)];
  const arrangement = ARRANGEMENTS[Math.floor(rng() * ARRANGEMENTS.length)];
  const built = arrangement.build(rng);
  const walks = BASE_WALKS.concat(built.walks || []);
  const state = {
    placements: [],
    floors: [],
    surfaces: [],
    walls: [],
    walks,
    tris: SHELL_TRIS,
  };

  for (const p of layout.placements) {
    if (!FIXED.has(p.item)) continue;
    if (!tryAdd(state, p)) throw new Error(`Fixed diner piece does not fit: ${p.item}`);
  }
  for (const b of built.booths) {
    if (!tryAdd(state, b)) throw new Error(`Booth does not fit in "${arrangement.name}"`);
  }

  const stoolCount = 6 + Math.floor(rng() * 4);
  for (let i = 0; i < stoolCount; i++) {
    const x = -4.25 + (8.5 * i) / (stoolCount - 1);
    const base = { item: 'stool', x, y: 0, z: -0.5, rotY: 0 };
    const loose = {
      item: 'stool',
      x: x + jitter(rng, 0.03),
      y: 0,
      z: -0.5 + jitter(rng, 0.02),
      rotY: jitter(rng, 0.45),
    };
    place(state, base, loose);
  }

  const booths = state.placements.filter((p) => p.item === 'booth');
  const condiment = [
    ['ketchup', -0.12, 0.08],
    ['napkin_dispenser', 0.12, 0.06],
    ['mustard', -0.1, -0.1],
    ['salt_pepper', 0.1, -0.08],
  ];
  booths.forEach((b) => {
    condiment.forEach(([item, lx, lz], ci) => {
      if (ci >= 2 && rng() < 0.35) return;
      const [dx, dz] = world(b.rotY || 0, lx + jitter(rng, 0.012), lz + jitter(rng, 0.012));
      const at = { item, x: b.x + dx, y: 0.755, z: b.z + dz, rotY: jitter(rng, 0.4) };
      if (!tryAdd(state, at)) {
        const [bx, bz] = world(b.rotY || 0, lx, lz);
        tryAdd(state, { item, x: b.x + bx, y: 0.755, z: b.z + bz, rotY: 0 });
      }
    });
  });

  const counterSlots = [-3.55, -0.65, 0.55, 1.45, 2.45, 3.25];
  const looseCounter = [
    ['pie_case', true],
    ['milkshake_mixer', true],
    ['cup_stack', rng() < 0.75],
    ['straw_holder', rng() < 0.7],
    ['service_bell', rng() < 0.8],
  ];
  looseCounter.forEach(([item, want], i) => {
    if (!want) return;
    const x = counterSlots[i];
    const base = { item, x, y: 1.05, z: -1.22, rotY: 0 };
    const loose = { item, x: x + jitter(rng, 0.06), y: 1.05, z: -1.22 + jitter(rng, 0.03), rotY: jitter(rng, 0.35) };
    place(state, base, loose);
  });

  const jukeSpots = [
    { x: -5.52, z: 3.02, rotY: Math.PI / 2 },
    { x: -5.52, z: 1.15, rotY: Math.PI / 2 },
    { x: -5.52, z: -0.35, rotY: Math.PI / 2 },
    // Front edge, left of the door, facing back into the room. Used when the left wall is booths.
    { x: 2.85, z: 3.5, rotY: Math.PI },
  ];
  for (const spot of jukeSpots) {
    const loose = { item: 'jukebox', ...spot, y: 0, rotY: spot.rotY + jitter(rng, 0.08) };
    if (tryAdd(state, loose) || tryAdd(state, { item: 'jukebox', ...spot, y: 0 })) break;
  }

  const neonSpots = [
    { x: -5.875, y: 1.82, z: -1.4, rotY: Math.PI / 2 },
    { x: -5.875, y: 1.82, z: 0.15, rotY: Math.PI / 2 },
    { x: -3.4, y: 1.7, z: -3.875, rotY: 0 },
  ];
  const neon = neonSpots[Math.floor(rng() * neonSpots.length)];
  tryAdd(state, { item: 'neon_sign', ...neon });

  const posterSpots = [
    { x: -5.875, y: 1.15, z: 2.35, rotY: Math.PI / 2 },
    { x: 2.15, y: 1.35, z: -3.875, rotY: 0 },
    { x: -5.875, y: 1.15, z: -2.55, rotY: Math.PI / 2 },
  ];
  for (const spot of posterSpots) if (tryAdd(state, { item: 'poster', ...spot })) break;

  for (const x of [-3.2, 0, 3.2]) tryAdd(state, { item: 'pendant', x, y: 2.02, z: -1.18, rotY: 0 });
  const lit = booths.filter((_, i) => i % 2 === 0).slice(0, 3);
  for (const b of lit) tryAdd(state, { item: 'pendant', x: b.x, y: 2.02, z: b.z, rotY: 0 });

  const coatSpots = [
    { x: -4.15, z: 3.22, rotY: 0.35 },
    { x: -3.15, z: 3.28, rotY: -0.2 },
    { x: 2.55, z: 3.22, rotY: 0.2 },
  ];
  if (rng() < 0.75) {
    for (const spot of coatSpots) {
      if (tryAdd(state, { item: 'coat_rack', y: 0, ...spot })) break;
    }
  }

  return {
    seed: n,
    arrangement: arrangement.name,
    theme,
    placements: state.placements,
    walks,
    tris: state.tris,
  };
}
