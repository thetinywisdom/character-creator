import { mulberry32 } from '../lib/rng.js';
import layout from '../../public/classroom-kit/layout.json';
import { aabb, pick } from '../lib/roomPlan.js';

// Seeded classroom. Seed 0 is the hand layout in layout.json.
//
// Fixed: walls, side windows, sliding door, blackboard, clock, cubbies.
// The teacher podium and desk stay on the dais and can swap sides.
// Student desks stay in neat rows facing the board. The seed picks 3 or 4
// columns, 2 or 3 rows, and one shared sideways shift so the grid does not
// break. Chairs sit on the door side of each desk, facing the board.
// A walk runs along the cubby wall from the door to the front of the class.
// Loose props (books, a pencil cup, the broom, the bin, the plant) come and go.

const BOUNDS = { x0: -4.36, x1: 4.36, z0: -3.36, z1: 3.36 };
const AISLE = { x0: -3.55, x1: -2.5, z0: -3.15, z1: 3.25 };
const DOOR_POCKET = { x0: -4.28, x1: -2.5, z0: 1.95, z1: 2.95 };

const FOOT = {
  podium: [0.64, 0.48],
  teacher_desk: [1.4, 0.72],
  teacher_chair: [0.48, 0.44],
  student_desk: [0.62, 0.42],
  student_chair: [0.36, 0.32],
  cubbies: [1.7, 0.36],
  bin: [0.34, 0.28],
  broom: [0.3, 0.14],
  plant: [0.32, 0.32],
};

const NO_BLOCK = new Set(['blackboard', 'clock', 'pencil_cup', 'globe', 'books', 'sliding_door', 'window']);

export function classroomFloorBoxes(plan) {
  const boxes = [];
  for (const p of plan.placements) {
    if ((p.y || 0) >= 0.25 || NO_BLOCK.has(p.item)) continue;
    const fp = FOOT[p.item];
    if (!fp) throw new Error(`classroom footprint missing for ${p.item}`);
    boxes.push({ item: p.item, ...aabb(p.x, p.z, fp[0], fp[1], p.rotY || 0) });
  }
  return boxes;
}

function put(out, item, x, y, z, rotY = 0) {
  out.push({ item, x, y, z, rotY });
}

export function classroomPlan(seed) {
  const n = Number(seed) || 0;
  if (!n) return { placements: layout.placements, look: {}, keepOut: null, goals: null, door: null, bounds: BOUNDS };
  const rng = mulberry32(n >>> 0);
  const bags = pick(rng, [
    ['cloth:Navy', 'cloth:Dusty rose', 'cloth:Sage', 'paint:Butter', 'cloth:Denim'],
    ['cloth:Denim', 'paint:Butter', 'cloth:Navy', 'cloth:Sage', 'cloth:Dusty rose'],
    ['cloth:Sage', 'cloth:Navy', 'paint:Apricot', 'cloth:Denim', 'paint:Blush'],
  ]);
  const look = { pot: pick(rng, ['Apricot', 'Off white', 'Sage']), bags };
  const out = [];
  put(out, 'blackboard', 0.35, 0.78, -3.36);
  put(out, 'clock', 0.35, 2.15, -3.36);
  put(out, 'cubbies', -4.18, 0, -1.45, Math.PI / 2);
  put(out, 'cubbies', -4.18, 0, 0.25, Math.PI / 2);

  const swap = rng() < 0.5;
  const podium = swap ? { x: 1.85, z: -2.32 } : { x: -1.2, z: -2.32 };
  const desk = swap ? { x: -0.85, z: -2.42 } : { x: 1.75, z: -2.42 };
  put(out, 'podium', podium.x, 0.08, podium.z);
  put(out, 'pencil_cup', podium.x + 0.14, 1.12, podium.z + 0.1, rng() * 0.5);
  put(out, 'teacher_desk', desk.x, 0.08, desk.z);
  put(out, 'teacher_chair', desk.x, 0.08, desk.z - 0.64);
  put(out, 'globe', desk.x + 0.4, 0.86, desk.z + 0.12, rng() * 0.6);
  put(out, 'books', desk.x - 0.38, 0.86, desk.z - 0.06, (rng() - 0.5) * 0.3);

  const cols = rng() < 0.5 ? 3 : 4;
  const rows = rng() < 0.45 ? 2 : 3;
  const shift = pick(rng, [-0.1, 0, 0.2]);
  const xs = (cols === 4 ? [-1.6, -0.4, 0.8, 2.0] : [-1.35, 0.15, 1.65]).map((x) => x + shift);
  const zs = rows === 3 ? [-0.4, 0.95, 2.15] : [0.15, 1.55];
  const desks = [];
  for (const z of zs) {
    for (const x of xs) {
      const pull = rng() * 0.05;
      const yaw = (rng() - 0.5) * 0.05;
      put(out, 'student_desk', x, 0, z);
      put(out, 'student_chair', x, 0, z + 0.42 + pull, Math.PI + yaw);
      desks.push({ x, z });
    }
  }
  const withBooks = Math.floor(rng() * Math.min(3, desks.length));
  for (let i = 0; i < withBooks; i++) {
    const d = desks[Math.floor(rng() * desks.length)];
    put(out, 'books', d.x + (rng() - 0.5) * 0.08, 0.74, d.z + (rng() - 0.5) * 0.06, (rng() - 0.5) * 0.4);
  }
  if (rng() < 0.6) {
    const d = desks[Math.floor(rng() * desks.length)];
    put(out, 'pencil_cup', d.x + 0.16, 0.74, d.z - 0.06, rng());
  }
  if (rng() < 0.75) put(out, 'broom', -3.95, 0, -3.02, 0.1 + rng() * 0.2);
  if (rng() < 0.8) put(out, 'bin', -3.95, 0, 1.45, rng() * 0.4);
  if (rng() < 0.85) put(out, 'plant', 3.6, 0, swap ? -1.4 : -2.6, rng());

  const goals = [
    { name: 'board', x: -3.0, z: -2.6 },
    { name: 'door', x: -3.7, z: 2.45 },
    ...zs.map((z) => ({ name: 'row', x: -3.0, z })),
  ];
  return {
    placements: out,
    look,
    keepOut: [AISLE, DOOR_POCKET],
    goals,
    door: { x: -3.7, z: 2.45 },
    bounds: BOUNDS,
  };
}
