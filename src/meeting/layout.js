import { between, facing, inside, overlaps, pick, reaches, roomRng, yawBox } from '../lib/roomSeed.js';

// Seeded meeting room. The glass partition, its door and the walls stay
// where the room shell builds them. Seed 0 (or none) is the hand-made layout.
// Any other integer rebuilds the same arrangement every time.
//
// What changes: how many chairs, how far they are pulled out, whether the
// ends of the table are occupied, which side the credenza stands on, the
// order of the TV and the whiteboard along the west wall, which tabletop
// props and the trash can appear, and a small shift of the table.
// Chairs always face the table. The door in the glass wall keeps a clear
// approach of about 0.85 m.

const P = Math.PI;
const FOOT = {
  table: [3.2, 1.05],
  chair: [0.5, 0.5],
  wall_tv: [1.16, 0.08],
  whiteboard: [1.72, 0.08],
  credenza: [1.2, 0.44],
  carafe: [0.2, 0.14],
  notepad: [0.2, 0.16],
  pen_cup: [0.1, 0.1],
  conference_phone: [0.28, 0.16],
  pendant: [0.32, 0.32],
  trash_can: [0.3, 0.3],
  plant: [0.18, 0.18],
};

const INNER = { x0: -2.86, x1: 2.86, z0: -1.86, z1: 1.86 };
// Glass door, east end of the far wall, plus the swing into the room.
const DOOR = { x0: 1.62, x1: 2.74, z0: -1.88, z1: -1.02 };
const FLOOR = new Set(['table', 'chair', 'credenza', 'trash_can']);
const ON_TABLE = new Set(['carafe', 'notepad', 'pen_cup', 'conference_phone']);

function box(p) {
  const [w, d] = FOOT[p.item];
  return { item: p.item, ...yawBox(p.x, p.z, w, d, p.rotY || 0) };
}

function decide(rng) {
  const mode = pick(rng, ['four', 'six-side', 'six-ends', 'eight', 'eight']);
  return {
    mode,
    credSide: rng() < 0.55 ? -1 : 1,
    credZ: null,
    showCredenza: rng() < 0.88,
    showPlant: rng() < 0.8,
    showTrash: rng() < 0.85,
    swapWall: rng() < 0.5,
    twoPendants: rng() < 0.72,
    props: {
      carafe: true,
      notepad: rng() < 0.75,
      pen_cup: rng() < 0.7,
      conference_phone: rng() < 0.78,
    },
  };
}

function assemble(choice, jit, scale) {
  const s = scale;
  const tx = jit.tx * s;
  const tz = jit.tz * s;
  const pull = jit.pull * s;
  const out = [{ item: 'table', x: tx, y: 0, z: tz, rotY: 0 }];

  const perSide = choice.mode === 'six-side' || choice.mode === 'eight' ? 3 : 2;
  const ends = choice.mode === 'six-ends' || choice.mode === 'eight';
  const along = perSide === 3 ? [-1.02, 0, 1.02] : [-0.72, 0.72];
  // Half the table, half a chair, and a few centimetres so nobody sits in the top.
  const side = 0.84 + pull;
  along.forEach((ax, i) => {
    const x = tx + ax + jit.chairX[i] * s;
    out.push({ item: 'chair', x, y: 0, z: tz - side - jit.chairZ[i] * s, rotY: 0 });
    out.push({ item: 'chair', x: tx + ax + jit.chairX[i + 3] * s, y: 0, z: tz + side + jit.chairZ[i + 3] * s, rotY: P });
  });
  if (ends) {
    const end = 1.92 + pull;
    out.push({ item: 'chair', x: tx - end, y: 0, z: tz + jit.endZ * s, rotY: P / 2 });
    out.push({ item: 'chair', x: tx + end, y: 0, z: tz - jit.endZ * s, rotY: -P / 2 });
  }

  const slots = [
    ['carafe', 0.32, 0.06],
    ['notepad', -0.72, 0.1],
    ['pen_cup', -0.32, -0.12],
    ['conference_phone', 0.78, -0.04],
  ];
  for (const [name, lx, lz] of slots) {
    if (!choice.props[name]) continue;
    const j = jit.prop[name];
    out.push({
      item: name, x: tx + lx + j.x * s, y: 0.74, z: tz + lz + j.z * s, rotY: j.rot * s,
    });
  }

  const boardZ = choice.swapWall ? 1.12 : -0.58;
  const tvZ = choice.swapWall ? -0.58 : 1.12;
  out.push({ item: 'whiteboard', x: -2.84, y: 0.9, z: boardZ, rotY: P / 2 });
  out.push({ item: 'wall_tv', x: -2.84, y: 1.15, z: tvZ, rotY: P / 2 });

  if (choice.showCredenza) {
    const west = choice.credSide < 0;
    const z = (west ? jit.credWest : jit.credEast) ;
    out.push({
      item: 'credenza',
      x: (west ? -2.64 : 2.64) + jit.credX * s * choice.credSide,
      y: 0,
      z: z + jit.credZ * s,
      rotY: west ? P / 2 : -P / 2,
    });
    if (choice.showPlant) {
      out.push({
        item: 'plant',
        x: (west ? -2.64 : 2.64),
        y: 0.72,
        z: z + jit.credZ * s,
        rotY: jit.plantRot * s,
      });
    }
  }

  if (choice.twoPendants) {
    out.push({ item: 'pendant', x: tx - 0.75, y: 1.65, z: tz, rotY: 0 });
    out.push({ item: 'pendant', x: tx + 0.75, y: 1.65, z: tz, rotY: 0 });
  } else {
    out.push({ item: 'pendant', x: tx, y: 1.65, z: tz, rotY: 0 });
  }

  if (choice.showTrash) {
    const corners = [[-2.48, 1.48], [2.48, 1.48], [-2.48, -1.32], [2.2, 0.15]];
    const solids = out.filter((p) => FLOOR.has(p.item)).map(box);
    for (const [cx, cz] of corners) {
      const trash = { item: 'trash_can', x: cx + jit.trashX * s, y: 0, z: cz + jit.trashZ * s, rotY: jit.trashRot * s };
      const b = box(trash);
      if (!inside(b, INNER) || overlaps(b, DOOR, 0.02)) continue;
      if (solids.some((o) => overlaps(o, b, 0.04))) continue;
      out.push(trash);
      break;
    }
  }
  return out;
}

function jitOf(rng) {
  const chairX = [0, 1, 2, 3, 4, 5].map(() => between(rng, -0.04, 0.04));
  const chairZ = [0, 1, 2, 3, 4, 5].map(() => between(rng, 0, 0.035));
  const prop = {};
  for (const name of ON_TABLE) prop[name] = { x: between(rng, -0.05, 0.05), z: between(rng, -0.04, 0.04), rot: between(rng, -0.35, 0.35) };
  return {
    tx: between(rng, -0.1, 0.1),
    tz: between(rng, -0.05, 0.05),
    pull: between(rng, 0, 0.055),
    chairX, chairZ,
    endZ: between(rng, -0.04, 0.04),
    prop,
    credWest: pick(rng, [-0.4, 0.45, 1.15]),
    credEast: pick(rng, [0.55, 1.2]),
    credX: between(rng, -0.02, 0.02),
    credZ: between(rng, -0.06, 0.06),
    plantRot: between(rng, -0.4, 0.4),
    trashX: between(rng, -0.04, 0.04),
    trashZ: between(rng, -0.04, 0.04),
    trashRot: between(rng, -0.4, 0.4),
  };
}

/** Problems with a seeded arrangement. Empty means it is safe to build. */
export function auditMeeting(placements) {
  const problems = [];
  const floor = placements.filter((p) => FLOOR.has(p.item)).map(box);
  for (const b of floor) {
    if (!inside(b, INNER)) problems.push(`${b.item} outside`);
    if (overlaps(b, DOOR, 0)) problems.push(`${b.item} blocks the glass door`);
  }
  for (let i = 0; i < floor.length; i++) {
    for (let j = i + 1; j < floor.length; j++) {
      if (overlaps(floor[i], floor[j], 0.02)) problems.push(`${floor[i].item} overlaps ${floor[j].item}`);
    }
  }
  const table = placements.find((p) => p.item === 'table');
  const tableBox = box(table);
  for (const p of placements) {
    if (p.item !== 'chair') continue;
    const f = facing(p.rotY || 0);
    const edge = {
      x: Math.min(tableBox.x1, Math.max(tableBox.x0, p.x)),
      z: Math.min(tableBox.z1, Math.max(tableBox.z0, p.z)),
    };
    const dx = edge.x - p.x;
    const dz = edge.z - p.z;
    const len = Math.hypot(dx, dz) || 1;
    if (f.x * dx / len + f.z * dz / len < 0.7) problems.push('chair faces away from the table');
    if (overlaps(box(p), tableBox, 0)) problems.push('chair intersects the table');
  }
  const credenza = placements.find((p) => p.item === 'credenza');
  if (credenza) {
    const f = facing(credenza.rotY || 0);
    if (credenza.x < 0 && f.x < 0.9) problems.push('credenza does not face into the room');
    if (credenza.x > 0 && f.x > -0.9) problems.push('credenza does not face into the room');
  }
  for (const p of placements.filter((q) => ON_TABLE.has(q.item))) {
    if (!inside(box(p), tableBox)) problems.push(`${p.item} is off the table`);
  }
  const wall = placements.filter((p) => p.item === 'whiteboard' || p.item === 'wall_tv').map(box);
  if (wall.length === 2 && overlaps(wall[0], wall[1], 0.04)) problems.push('tv overlaps the whiteboard');
  const names = new Set(placements.map((p) => p.item));
  if (!names.has('table') || !names.has('wall_tv') || !names.has('whiteboard')) problems.push('missing anchor');
  if (placements.filter((p) => p.item === 'chair').length < 4) problems.push('too few chairs');
  const blocked = floor.map((b) => ({ x0: b.x0, x1: b.x1, z0: b.z0, z1: b.z1 }));
  if (!reaches(blocked, INNER, { x: 2.15, z: -1.45 }, [{ ...tableBox, near: 0.8 }], 0.35)) {
    problems.push('no clear path from the door to the table');
  }
  return problems;
}

/** `{ placements, look }` for a nonzero seed, or null for the hand-made layout. */
export function meetingPlan(seed) {
  const n = seed | 0;
  if (!n) return null;
  const rng = roomRng(n, 1);
  const choice = decide(rng);
  const jit = jitOf(rng);
  let last = [];
  for (const scale of [1, 0.5, 0]) {
    const placements = assemble(choice, jit, scale);
    last = auditMeeting(placements);
    if (!last.length) return { placements, look: null };
  }
  throw new Error(`meeting seed ${n}: ${last.join('; ')}`);
}
