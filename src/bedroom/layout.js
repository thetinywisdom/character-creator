import { between, facing, inside, overlaps, pick, reaches, roomRng, yawBox } from '../lib/roomSeed.js';

// Seeded small bedroom. The window stays on the far wall, right of centre.
// Seed 0 is the hand-made layout. Other seeds pick one of three arrangements
// (bed on the north wall, bed along the west wall, or bed on the south wall),
// then nudge loose props and sometimes leave the basket, books, plant, clock
// or picture out. The rug and duvet change cloth swatch.
//
// The bed never spans the whole window. The wardrobe doors keep 0.5 m of
// swing clear. A clear walk of about 0.7 m runs from the south entrance to
// the bed and the desk. Chairs face the desk. Everything against a wall
// faces into the room.

const P = Math.PI;
const FOOT = {
  bed: [0.96, 2],
  side_table: [0.4, 0.4],
  lamp: [0.24, 0.24],
  wardrobe: [0.96, 0.56],
  desk: [0.9, 0.48],
  chair: [0.42, 0.42],
  rug: [1.55, 1.85],
  books: [0.18, 0.22],
  plant: [0.14, 0.14],
  basket: [0.26, 0.26],
  clock: [0.12, 0.06],
  picture: [0.46, 0.04],
};

const DUVETS = ['cloth:Powder blue', 'cloth:Navy', 'cloth:Sage', 'cloth:Dusty rose', 'cloth:Sky'];
const RUGS = ['cloth:Dusty rose', 'cloth:Navy', 'cloth:Sage', 'cloth:Sand', 'cloth:Slate'];

const INNER = { x0: -1.63, x1: 1.63, z0: -1.38, z1: 1.38 };
// South entrance, the way in through the open front of the cutaway.
const ENTRANCE = { x0: -0.38, x1: 0.42, z0: 0.82, z1: 1.4 };
// Window on the north wall. A bed covers it fully when its box contains this span.
const WINDOW = { x0: 0.47, x1: 1.43, z0: -1.45, z1: -0.7 };
const FLOOR = new Set(['bed', 'side_table', 'wardrobe', 'desk', 'chair', 'basket']);

function box(p) {
  const [w, d] = FOOT[p.item];
  return { item: p.item, ...yawBox(p.x, p.z, w, d, p.rotY || 0) };
}

// Wardrobe door swing: 0.5 m out from the front face, across the doors.
function swingOf(wardrobe) {
  const f = facing(wardrobe.rotY || 0);
  const [w, d] = FOOT.wardrobe;
  const c = Math.abs(Math.cos(wardrobe.rotY || 0));
  const s = Math.abs(Math.sin(wardrobe.rotY || 0));
  // Front face is the +z side of the unrotated box, pushed out along facing.
  const reach = 0.5;
  const cx = wardrobe.x + f.x * (d / 2 + reach / 2);
  const cz = wardrobe.z + f.z * (d / 2 + reach / 2);
  const across = w;
  const along = reach;
  const aw = (across / 2) * c + (along / 2) * s;
  const ad = (across / 2) * s + (along / 2) * c;
  return { x0: cx - aw, x1: cx + aw, z0: cz - ad, z1: cz + ad };
}

function place(out, item, x, y, z, rotY = 0) {
  out.push({ item, x, y, z, rotY });
}

// Keep the rug inside the walls even when the bed is pushed against one.
function rugAt(x, z, rot) {
  const sample = yawBox(0, 0, FOOT.rug[0], FOOT.rug[1], rot);
  const hw = (sample.x1 - sample.x0) / 2;
  const hd = (sample.z1 - sample.z0) / 2;
  return {
    x: Math.min(INNER.x1 - hw, Math.max(INNER.x0 + hw, x)),
    z: Math.min(INNER.z1 - hd, Math.max(INNER.z0 + hd, z)),
  };
}

// Bed on the north wall, left of the window. Wardrobe shares that wall.
// Desk and chair on the east wall.
function north(j, scale, opt) {
  const s = scale;
  const out = [];
  const bed = { x: -1.12 + j.nudge * s, z: -0.36 };
  place(out, 'bed', bed.x, 0, bed.z, 0);
  const rug = rugAt(bed.x + 0.08, bed.z + 0.15, 0);
  place(out, 'rug', rug.x, -0.004, rug.z, 0);
  const side = { x: -0.38, z: 0.42 + j.nudge * s };
  place(out, 'side_table', side.x, 0, side.z, 0);
  place(out, 'lamp', side.x, 0.52, side.z - 0.04, j.lamp * s);
  if (opt.clock) place(out, 'clock', side.x + 0.1, 0.52, side.z + 0.1, j.clock * s);
  place(out, 'wardrobe', -0.02, 0, -1.1, 0);
  const desk = { x: 1.39, z: 0.28 };
  place(out, 'desk', desk.x, 0, desk.z, -P / 2);
  const pull = 0.06 + j.pull * s;
  place(out, 'chair', desk.x - 0.24 - 0.21 - pull, 0, desk.z, P / 2);
  if (opt.books) place(out, 'books', 1.28, 0.72, 0.08, j.book * s);
  if (opt.plant) place(out, 'plant', 1.3, 0.72, 0.55, j.plant * s);
  if (opt.basket) place(out, 'basket', 1.38, 0, 1.12, j.basket * s);
  if (opt.picture) place(out, 'picture', bed.x, 1.35, -1.39, 0);
  return out;
}

// Bed along the west wall, head to the west. Wardrobe and desk on the east.
function west(j, scale, opt) {
  const s = scale;
  const out = [];
  const bed = { x: -0.6, z: -0.28 + j.nudge * s };
  place(out, 'bed', bed.x, 0, bed.z, P / 2);
  const rug = rugAt(bed.x + 0.05, bed.z, P / 2);
  place(out, 'rug', rug.x, -0.004, rug.z, P / 2);
  const side = { x: -1.36, z: -1.1 };
  place(out, 'side_table', side.x, 0, side.z, 0);
  place(out, 'lamp', side.x + 0.02, 0.52, side.z + 0.05, j.lamp * s);
  if (opt.clock) place(out, 'clock', side.x + 0.12, 0.52, side.z - 0.1, j.clock * s);
  place(out, 'wardrobe', 1.35, 0, -0.72, -P / 2);
  const desk = { x: 1.39, z: 0.58 };
  place(out, 'desk', desk.x, 0, desk.z, -P / 2);
  const pull = 0.08 + j.pull * s;
  place(out, 'chair', desk.x - 0.24 - 0.21 - pull, 0, desk.z, P / 2);
  if (opt.books) place(out, 'books', 1.28, 0.72, 0.38, j.book * s);
  if (opt.plant) place(out, 'plant', 1.3, 0.72, 0.82, j.plant * s);
  if (opt.basket) place(out, 'basket', 0.95, 0, 1.15, j.basket * s);
  if (opt.picture) place(out, 'picture', -1.61, 1.35, bed.z, P / 2);
  return out;
}

// Bed on the south wall, head to the south. Window wall stays clear for the wardrobe.
function south(j, scale, opt) {
  const s = scale;
  const out = [];
  const bed = { x: -1.02 + j.nudge * s, z: 0.36 };
  place(out, 'bed', bed.x, 0, bed.z, P);
  const rug = rugAt(bed.x, bed.z - 0.08, 0);
  place(out, 'rug', rug.x, -0.004, rug.z, 0);
  const side = { x: -0.28, z: 0.15 };
  place(out, 'side_table', side.x, 0, side.z, 0);
  place(out, 'lamp', side.x, 0.52, side.z - 0.05, j.lamp * s);
  if (opt.clock) place(out, 'clock', side.x + 0.1, 0.52, side.z + 0.08, j.clock * s);
  place(out, 'wardrobe', -0.02, 0, -1.1, 0);
  const desk = { x: 1.39, z: 0.15 };
  place(out, 'desk', desk.x, 0, desk.z, -P / 2);
  const pull = 0.08 + j.pull * s;
  place(out, 'chair', desk.x - 0.24 - 0.21 - pull, 0, desk.z, P / 2);
  if (opt.books) place(out, 'books', 1.28, 0.72, -0.08, j.book * s);
  if (opt.plant) place(out, 'plant', 1.3, 0.72, 0.42, j.plant * s);
  if (opt.basket) place(out, 'basket', 1.38, 0, -0.85, j.basket * s);
  if (opt.picture) place(out, 'picture', -1.61, 1.3, -0.15, P / 2);
  return out;
}

const TEMPLATES = { north, west, south };

function lookOf(rng) {
  const rug = pick(rng, RUGS);
  return {
    duvet: pick(rng, DUVETS),
    rug,
    rugBand: rug === 'cloth:Sand' ? 'cloth:Dusty rose' : 'cloth:Sand',
  };
}

export function auditBedroom(placements) {
  const problems = [];
  const floor = placements.filter((p) => FLOOR.has(p.item)).map(box);
  const wardrobe = placements.find((p) => p.item === 'wardrobe');
  const swing = swingOf(wardrobe);
  for (const b of floor) {
    if (!inside(b, INNER)) problems.push(`${b.item} outside`);
    if (b.item !== 'wardrobe' && overlaps(b, ENTRANCE, 0)) problems.push(`${b.item} blocks the entrance`);
    if (b.item !== 'wardrobe' && overlaps(b, swing, 0.02)) problems.push(`${b.item} blocks the wardrobe doors`);
  }
  for (let i = 0; i < floor.length; i++) {
    for (let j = i + 1; j < floor.length; j++) {
      if (overlaps(floor[i], floor[j], 0.02)) problems.push(`${floor[i].item} overlaps ${floor[j].item}`);
    }
  }
  const bed = box(placements.find((p) => p.item === 'bed'));
  if (bed.x0 <= WINDOW.x0 && bed.x1 >= WINDOW.x1 && overlaps(bed, WINDOW, 0)) {
    problems.push('bed covers the window');
  }
  const desk = placements.find((p) => p.item === 'desk');
  const chair = placements.find((p) => p.item === 'chair');
  const f = facing(chair.rotY || 0);
  const dx = desk.x - chair.x;
  const dz = desk.z - chair.z;
  const len = Math.hypot(dx, dz) || 1;
  if (f.x * dx / len + f.z * dz / len < 0.8) problems.push('chair faces away from the desk');
  const wf = facing(wardrobe.rotY || 0);
  // Doors (+z) point into the room, so the facing vector points away from the nearest wall.
  if (wardrobe.z < -0.9 && wf.z < 0.9) problems.push('wardrobe faces the wall');
  if (wardrobe.x > 0.9 && wf.x > -0.9) problems.push('wardrobe faces the wall');
  if (wardrobe.x < -0.9 && wf.x < 0.9) problems.push('wardrobe faces the wall');
  const side = box(placements.find((p) => p.item === 'side_table'));
  for (const name of ['lamp', 'clock']) {
    const p = placements.find((q) => q.item === name);
    if (p && !inside(box(p), side)) problems.push(`${name} is off the side table`);
  }
  const deskBox = box(desk);
  for (const name of ['books', 'plant']) {
    const p = placements.find((q) => q.item === name);
    if (p && !inside(box(p), deskBox)) problems.push(`${name} is off the desk`);
  }
  const rug = placements.find((p) => p.item === 'rug');
  if (rug && !inside(box(rug), { x0: -1.72, x1: 1.72, z0: -1.48, z1: 1.48 })) problems.push('rug outside');
  const blocked = floor.filter((b) => b.item !== 'chair').map((b) => ({ ...b }));
  // The chair is where you sit; the path has to reach it, so it is not a wall.
  if (!reaches(blocked, INNER, { x: 0, z: 1.15 }, [bed, deskBox].map((g) => ({ ...g, near: 0.8 })), 0.35)) {
    problems.push('no clear path from the entrance to the bed and desk');
  }
  return problems;
}

/** `{ placements, look }` for a nonzero seed, or null for the hand-made layout. */
export function bedroomPlan(seed) {
  const n = seed | 0;
  if (!n) return null;
  const rng = roomRng(n, 2);
  const which = pick(rng, ['north', 'west', 'south']);
  const opt = {
    clock: rng() < 0.85,
    books: rng() < 0.8,
    plant: rng() < 0.7,
    basket: rng() < 0.75,
    picture: rng() < 0.8,
  };
  const look = lookOf(rng);
  const j = {
    nudge: between(rng, -0.04, 0.04),
    pull: between(rng, 0, 0.05),
    lamp: between(rng, -0.2, 0.2),
    clock: between(rng, -0.3, 0.3),
    book: between(rng, -0.25, 0.25),
    plant: between(rng, -0.4, 0.4),
    basket: between(rng, -0.5, 0.5),
  };
  let last = [];
  for (const scale of [1, 0.5, 0]) {
    const placements = TEMPLATES[which](j, scale, opt);
    last = auditBedroom(placements);
    if (!last.length) return { placements, look };
  }
  throw new Error(`bedroom seed ${n} (${which}): ${last.join('; ')}`);
}
