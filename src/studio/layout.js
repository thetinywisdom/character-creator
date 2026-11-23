import { between, facing, inside, overlaps, pick, reaches, roomRng, yawBox } from '../lib/roomSeed.js';

// Seeded Japanese 1R studio. The kitchen run, both windows, the entrance
// door and the unit bath stay put (plumbing, the bath door and the glass).
// Seed 0 is the hand-made layout.
//
// What changes: which wall the bed and the sofa use, where the low table
// sits, whether the cushion, teacup, kettle, rice cooker and shoe tray are
// out, a few centimetres of jitter on those loose props, and the bedding
// and cushion swatches. The sofa faces its TV. The screen is the local +z
// face, and it has to sit in the catalogue iso camera's half-space (viewDir
// [1, 1.15, 1] in src/catalog/index.js): a TV faces south or east, never
// north or west, so the camera sees the screen and not the wooden back.
// The bath door keeps its swing clear, and a walk of about 0.7 m still
// reaches the bed, the kitchen and the bath from the entrance.

const P = Math.PI;
const FOOT = {
  bed: [1.02, 1.95],
  sink: [0.78, 0.56],
  hob: [0.7, 0.56],
  fridge: [0.52, 0.56],
  counter: [0.58, 0.56],
  table: [0.72, 0.72],
  cushion: [0.42, 0.42],
  sofa: [1.48, 0.74],
  tv: [1.05, 0.4],
  kettle: [0.18, 0.16],
  rice_cooker: [0.22, 0.22],
  shoe_tray: [0.52, 0.28],
  teacup: [0.1, 0.08],
};

const DUVETS = ['cloth:Navy', 'cloth:Powder blue', 'cloth:Sage', 'cloth:Dusty rose'];
const CUSHIONS = ['cloth:Apricot', 'cloth:Dusty rose', 'cloth:Sage', 'cloth:Sky'];

const INNER = { x0: -2.86, x1: 2.86, z0: -1.86, z1: 1.86 };
// Entrance door on the south wall, plus the walk in front of it.
const DOOR = { x0: 1.55, x1: 2.55, z0: 1.0, z1: 1.9 };
// Unit bath, rotY = π/2, and the glass door swinging toward +x.
const BATH = { item: 'bath', x0: -2.86, x1: -1.44, z0: -1.86, z1: -0.36 };
// The sink is fixed just east of the door, so the swing that stays clear is
// the south half of the door, about 0.42 m into the room.
const BATH_SWING = { x0: -1.44, x1: -1.02, z0: -1.2, z1: -0.66 };
// West window. The bed covers it fully when it sits against that wall and
// contains this z span.
const WINDOW_Z = { z0: 0.43, z1: 1.27 };

const KITCHEN = [
  { item: 'sink', x: -0.55, y: 0, z: -1.58, rotY: 0 },
  { item: 'hob', x: 0.28, y: 0, z: -1.58, rotY: 0 },
  { item: 'counter', x: 1.0, y: 0, z: -1.58, rotY: 0 },
  { item: 'fridge', x: 1.68, y: 0, z: -1.55, rotY: 0 },
];

const FLOOR = new Set(['bed', 'sink', 'hob', 'fridge', 'counter', 'table', 'sofa', 'tv', 'shoe_tray']);

function box(p) {
  const [w, d] = FOOT[p.item];
  return { item: p.item, ...yawBox(p.x, p.z, w, d, p.rotY || 0) };
}

function place(out, item, x, y, z, rotY = 0) {
  out.push({ item, x, y, z, rotY });
}

function kitchenProps(out, j, scale, opt) {
  const s = scale;
  if (opt.rice) {
    place(out, 'rice_cooker', 0.86 + j.riceX * s, 0.86, -1.5 + j.riceZ * s, j.riceRot * s);
  }
  if (opt.kettle) {
    place(out, 'kettle', 1.16 + j.kettleX * s, 0.86, -1.48 + j.kettleZ * s, j.kettleRot * s);
  }
}

// Bed in the southwest, running east so the west window stays half clear.
// Sofa and TV on the east wall. The north-centre stays open up to the sink.
function southwest(j, scale, opt) {
  const s = scale;
  const out = [...KITCHEN];
  kitchenProps(out, j, scale, opt);
  const bedZ = 1.16 + j.bed * s;
  place(out, 'bed', -1.82, 0, bedZ, j.head ? -P / 2 : P / 2);
  const sofaZ = -0.08 + j.sofa * s;
  place(out, 'sofa', 2.42, 0, sofaZ, -P / 2);
  place(out, 'tv', 1.42, 0, sofaZ, P / 2);
  const table = { x: 0.55 + j.tableX * s, z: -0.58 + j.tableZ * s };
  place(out, 'table', table.x, 0, table.z, j.tableRot * s);
  if (opt.cushion) place(out, 'cushion', 0.15, 0, 0.35, j.cushion * s);
  if (opt.cup) place(out, 'teacup', table.x + 0.08, 0.335, table.z - 0.05, j.cup * s);
  if (opt.shoes) place(out, 'shoe_tray', 2.45, 0, 0.85, j.shoes * s);
  place(out, 'ceiling_light', 0.15, 1.75, 0.15, 0);
  return out;
}

// Bed on the south wall, clear of the west window. Sofa and TV on the east.
function southbed(j, scale, opt) {
  const s = scale;
  const out = [...KITCHEN];
  kitchenProps(out, j, scale, opt);
  place(out, 'bed', -0.15 + j.bed * s, 0, 0.86, j.head ? 0 : P);
  const sofaZ = -0.15 + j.sofa * s;
  place(out, 'sofa', 2.42, 0, sofaZ, -P / 2);
  place(out, 'tv', 1.5, 0, sofaZ, P / 2);
  const table = { x: -1.2, z: 0.42 + j.tableZ * s };
  place(out, 'table', table.x, 0, table.z, 0);
  if (opt.cushion) place(out, 'cushion', -1.2, 0, 1.15, j.cushion * s);
  if (opt.cup) place(out, 'teacup', table.x + 0.08, 0.335, table.z + 0.06, j.cup * s);
  if (opt.shoes) place(out, 'shoe_tray', 0.7, 0, 1.52, j.shoes * s);
  place(out, 'ceiling_light', -0.2, 1.75, -0.15, 0);
  return out;
}

// Sofa facing north across a low table toward the TV, so the screen points
// south into the iso camera. The pair sits east of a walk to the bed; the
// south strip in front of the door stays clear. Bed stays southwest.
function lounge(j, scale, opt) {
  const s = scale;
  const out = [...KITCHEN];
  kitchenProps(out, j, scale, opt);
  place(out, 'bed', -1.82, 0, 1.16 + j.bed * s, P / 2);
  const sofaX = 0.78 + j.sofa * s;
  place(out, 'tv', sofaX, 0, -0.87, 0);
  place(out, 'sofa', sofaX, 0, 0.58, P);
  const table = { x: sofaX, z: -0.23 + j.tableZ * s };
  place(out, 'table', table.x, 0, table.z, 0);
  if (opt.cushion) place(out, 'cushion', 1.9, 0, 0.5, j.cushion * s);
  if (opt.cup) place(out, 'teacup', table.x + 0.06, 0.335, table.z - 0.04, j.cup * s);
  if (opt.shoes) place(out, 'shoe_tray', 2.5, 0, 0.5, j.shoes * s);
  place(out, 'ceiling_light', 0.78, 1.75, -0.12, 0);
  return out;
}

const TEMPLATES = { southwest, southbed, lounge };

// Horizontal part of the catalogue iso viewDir [1, 1.15, 1]. The camera
// sits in the +x/+z half-space; the screen faces that half-space when its
// normal points the same way.
const ISO_CAM = { x: 1, z: 1 };

/** Sofa looks at the TV, and the TV screen looks back and toward the iso camera. */
export function studioScreenProblems(placements) {
  const problems = [];
  const sofa = placements.find((p) => p.item === 'sofa');
  const tv = placements.find((p) => p.item === 'tv');
  const look = facing(sofa.rotY || 0);
  const screen = facing(tv.rotY || 0);
  const dx = tv.x - sofa.x;
  const dz = tv.z - sofa.z;
  const len = Math.hypot(dx, dz) || 1;
  if (look.x * dx / len + look.z * dz / len < 0.75) problems.push('sofa faces away from the tv');
  if (screen.x * -dx / len + screen.z * -dz / len < 0.75) problems.push('tv faces away from the sofa');
  const cam = Math.hypot(ISO_CAM.x, ISO_CAM.z);
  if (screen.x * ISO_CAM.x / cam + screen.z * ISO_CAM.z / cam <= 0) {
    problems.push('tv front faces away from the iso camera half-space');
  }
  return problems;
}

function coversWindow(bed) {
  return bed.x0 < -2.15 && bed.z0 <= WINDOW_Z.z0 + 0.04 && bed.z1 >= WINDOW_Z.z1 - 0.04;
}

export function auditStudio(placements) {
  const problems = [];
  const floor = placements.filter((p) => FLOOR.has(p.item)).map(box);
  const fixed = [BATH, BATH_SWING, DOOR];
  for (const b of floor) {
    if (!inside(b, INNER)) problems.push(`${b.item} outside`);
    if (fixed.some((k) => overlaps(b, k, 0))) problems.push(`${b.item} blocks a door or the bath`);
  }
  const cushion = placements.find((p) => p.item === 'cushion');
  if (cushion) {
    const b = box(cushion);
    if (!inside(b, INNER)) problems.push('cushion outside');
    if (fixed.some((k) => overlaps(b, k, 0))) problems.push('cushion blocks a door');
    if (floor.some((o) => overlaps(o, b, 0.02))) problems.push('cushion overlaps furniture');
  }
  for (let i = 0; i < floor.length; i++) {
    for (let j = i + 1; j < floor.length; j++) {
      if (overlaps(floor[i], floor[j], 0.02)) problems.push(`${floor[i].item} overlaps ${floor[j].item}`);
    }
  }
  const bed = box(placements.find((p) => p.item === 'bed'));
  if (coversWindow(bed)) problems.push('bed covers the window');
  problems.push(...studioScreenProblems(placements));
  const counter = box(placements.find((p) => p.item === 'counter'));
  for (const name of ['kettle', 'rice_cooker']) {
    const p = placements.find((q) => q.item === name);
    if (p && !inside(box(p), counter)) problems.push(`${name} is off the counter`);
  }
  const table = placements.find((p) => p.item === 'table');
  const cup = placements.find((p) => p.item === 'teacup');
  if (cup && !inside(box(cup), box(table))) problems.push('teacup is off the table');
  const blocked = [...floor.map((b) => ({ ...b })), BATH];
  const sink = box(placements.find((p) => p.item === 'sink'));
  const goals = [bed, sink, BATH].map((g) => ({ ...g, near: 0.85 }));
  if (!reaches(blocked, INNER, { x: 2.05, z: 1.4 }, goals, 0.35)) {
    problems.push(`no clear path from the entrance to ${reaches.lastMissed?.join(', ') || 'the bed, kitchen and bath'}`);
  }
  return problems;
}

/** `{ placements, look }` for a nonzero seed, or null for the hand-made layout. */
export function studioPlan(seed) {
  const n = seed | 0;
  if (!n) return null;
  const rng = roomRng(n, 3);
  const which = pick(rng, ['southwest', 'southbed', 'lounge']);
  const opt = {
    rice: rng() < 0.8,
    kettle: rng() < 0.85,
    cushion: rng() < 0.8,
    cup: rng() < 0.75,
    shoes: rng() < 0.8,
  };
  const look = { duvet: pick(rng, DUVETS), cushion: pick(rng, CUSHIONS) };
  const j = {
    bed: between(rng, -0.05, 0.05),
    sofa: between(rng, -0.06, 0.06),
    head: rng() < 0.5,
    tableX: between(rng, -0.04, 0.04),
    tableZ: between(rng, -0.04, 0.04),
    tableRot: between(rng, -0.12, 0.12),
    cushion: between(rng, -0.4, 0.4),
    cup: between(rng, -0.4, 0.4),
    shoes: between(rng, -0.2, 0.2),
    riceX: between(rng, -0.02, 0.02),
    riceZ: between(rng, -0.02, 0.02),
    riceRot: between(rng, -0.3, 0.3),
    kettleX: between(rng, -0.02, 0.02),
    kettleZ: between(rng, -0.02, 0.02),
    kettleRot: between(rng, -0.4, 0.4),
  };
  let last = [];
  for (const scale of [1, 0.5, 0]) {
    const placements = TEMPLATES[which](j, scale, opt);
    last = auditStudio(placements);
    if (!last.length) return { placements, look };
  }
  throw new Error(`studio seed ${n} (${which}): ${last.join('; ')}`);
}
