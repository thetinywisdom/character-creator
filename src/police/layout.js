// Seeded police-station layout. Seed 0 is layout.json.
//
// Fixed: door and windows, the front counter, the holding cell in the back
// left corner. The lamp stays over the counter.
// Varies: one to three officer desks (a straight row behind the counter,
// each chair on the staff side facing its desk), filing-cabinet count along
// the right wall, bench against the left wall or out in the waiting area,
// locker position, which desk gets a lamp / radio / mug, and chair cloth.
// A 0.9 m corridor runs from the public side of the counter down to the cell,
// and a 0.9 m lane runs in front of the desks.

import handmade from '../../public/police-kit/layout.json';
import { rngFor, occupancy, auditPlan, facingOf } from '../lib/roomLayout.js';

const FP = {
  front_counter: [4.6, 0.8],
  officer_desk: [1.4, 0.72],
  officer_chair: [0.52, 0.54],
  holding_cell: [2.55, 2.2],
  locker_bank: [1.7, 0.52],
  notice_board: [1.36, 0.08],
  filing_cabinet: [0.5, 0.58],
  water_cooler: [0.4, 0.4],
  waiting_bench: [1.5, 0.5],
  desk_lamp: [0.2, 0.18],
  radio: [0.28, 0.18],
  mug: [0.12, 0.12],
  key_board: [0.56, 0.08],
  beacon: [0.28, 0.28],
  coat_rack: [0.42, 0.42],
  trash_bin: [0.32, 0.32],
  clock: [0.4, 0.08],
  ceiling_light: [0.44, 0.44],
  floor_mat: [0.94, 0.6],
};

const BACK = new Set(['notice_board', 'key_board', 'clock']);
const NO_HIT = new Set(['floor_mat', 'ceiling_light', 'beacon']);
const ON_TOP = new Set(['desk_lamp', 'radio', 'mug']);
const BOUNDS = { x0: -5.8, x1: 5.8, z0: -3.78, z1: 3.78 };
const SURFACES = new Set(['officer_desk']);

const CHAIR = ['cloth:Navy', 'cloth:Denim', 'cloth:Slate'];
const STRIPE = ['paint:Dusty rose', 'paint:Butter', 'paint:Apricot'];

function generate(seed) {
  const rng = rngFor(seed, 0xB0B);
  const occ = occupancy({ bounds: BOUNDS, footprints: FP, back: BACK, noHit: NO_HIT, onTop: ON_TOP });
  const keepouts = [];

  // Door is on the right (x ≈ 4.39). Public side of the counter, then a
  // corridor down the counter's left end to the cell, and a lane in front of the desks.
  keepouts.push(occ.keep(4.45, 3.1, 1.05, 0.6, 'entrance'));
  keepouts.push(occ.keep(0.7, 2.7, 3.3, 0.45, 'public'));
  // The gap between the cell and the counter is just wide enough for 0.9 m.
  keepouts.push(occ.keep(-2.665, 0.45, 0.445, 1.9, 'to cell'));
  keepouts.push(occ.keep(-0.1, 0.72, 2.4, 0.45, 'desk lane'));

  occ.place('front_counter', 0.1, 1.75, 0);
  occ.place('holding_cell', -4.4, -2.65, 0);
  occ.add('beacon', 0.1, 2.55, 0, 2.15);

  const count = rng.int(1, 3);
  const xs = { 1: [0.25], 2: [-1.1, 1.4], 3: [-1.1, 0.55, 2.2] }[count];
  const z = -0.22 + rng.jitter(0.04);
  const desks = [];
  xs.forEach((x, i) => {
    const desk = occ.place('officer_desk', x + rng.jitter(0.05), z, 0);
    occ.place('officer_chair', desk.x, desk.z - 0.69, 0);
    desks.push(desk);
    if (i === 0 && rng.chance(0.9)) occ.add('desk_lamp', desk.x + 0.38, desk.z + 0.1, rng.jitter(0.3), 0.75);
    if (i === 0 && rng.chance(0.75)) occ.add('mug', desk.x - 0.42, desk.z - 0.05, rng.jitter(0.5), 0.75);
    if (i === 1 && rng.chance(0.8)) occ.add('radio', desk.x + 0.2, desk.z + 0.08, rng.jitter(0.3), 0.75);
    if (i === 2 && rng.chance(0.5)) occ.add('mug', desk.x - 0.3, desk.z + 0.06, rng.jitter(0.4), 0.75);
  });

  const files = rng.int(2, 3);
  for (let i = 0; i < files; i++) occ.place('filing_cabinet', 5.4, -2.65 + i * 0.75, 0);

  const coolerSpots = [
    { x: 5.2, z: 0.7 }, { x: 5.15, z: 1.35 }, { x: 4.55, z: -3.35 },
  ];
  if (!occ.tryAt('water_cooler', coolerSpots.map((s) => ({ ...s, rotY: rng.jitter(0.4) })))) {
    occ.place('water_cooler', 5.2, 0.7, 0);
  }

  const lockerZ = rng.pick([0.05, 0.4]);
  occ.place('locker_bank', -5.48, lockerZ, Math.PI / 2);

  if (rng.chance(0.55)) occ.place('waiting_bench', -4.35, 2.55, Math.PI);
  else occ.place('waiting_bench', -5.4, 2.3, Math.PI / 2);

  if (rng.chance(0.7)) occ.tryAt('coat_rack', [
    { x: -5.15, z: 3.25, rotY: rng.jitter(0.4) },
    { x: -4.9, z: -0.85, rotY: 0.3 },
  ]);
  if (rng.chance(0.75)) occ.tryAt('trash_bin', [
    { x: 5.25, z: 2.05, rotY: 0.2 },
    { x: 3.3, z: -3.3, rotY: 0 },
  ]);

  const noticeX = rng.pick([-0.8, 0.3, 1.5]);
  occ.place('notice_board', noticeX, -3.86, 0, 1.25);
  occ.place('key_board', noticeX + 1.7, -3.86, 0, 1.4);
  const clockX = noticeX > 0.5 ? -2.15 : 4.15;
  occ.place('clock', clockX, -3.86, 0, 2.05);

  occ.add('floor_mat', 4.4 + rng.jitter(0.08), 3.38, 0);
  occ.add('ceiling_light', -3.2, -0.3, 0, 2.15);
  occ.add('ceiling_light', desks[0].x, -0.5, 0, 2.15);
  occ.add('ceiling_light', 2.2, 1.6, 0, 2.15);
  if (count > 1) occ.add('ceiling_light', desks[desks.length - 1].x, 0.2, 0, 2.15);

  return {
    placements: occ.placements,
    keepouts,
    accent: {
      chair: rng.pick(CHAIR),
      stripe: rng.pick(STRIPE),
    },
  };
}

export function policeLayout(seed) {
  if (!(seed | 0)) return { placements: handmade.placements, keepouts: [], accent: null };
  return generate(seed | 0);
}

const SPEC = { bounds: BOUNDS, footprints: FP, back: BACK, noHit: NO_HIT, onTop: ON_TOP, surfaces: SURFACES };

export function policeIssues(seed) {
  const plan = policeLayout(seed);
  const errors = (seed | 0) ? auditPlan(plan, SPEC) : auditPlan({ ...plan, keepouts: [] }, SPEC);
  if (!(seed | 0)) return errors;
  if (!plan.placements.some((p) => p.item === 'holding_cell')) errors.push('no cell');
  if (!plan.placements.some((p) => p.item === 'front_counter')) errors.push('no counter');
  const desks = plan.placements.filter((p) => p.item === 'officer_desk');
  const chairs = plan.placements.filter((p) => p.item === 'officer_chair');
  if (desks.length < 1 || desks.length > 3) errors.push(`desks ${desks.length}`);
  if (chairs.length !== desks.length) errors.push('chair count');
  for (const chair of chairs) {
    const desk = desks.find((d) => Math.abs(d.x - chair.x) < 0.4);
    if (!desk) { errors.push('chair without desk'); continue; }
    const f = facingOf(chair.rotY);
    const dx = desk.x - chair.x;
    const dz = desk.z - chair.z;
    const len = Math.hypot(dx, dz) || 1;
    if (f.x * dx / len + f.z * dz / len < 0.7) errors.push('chair faces away from its desk');
  }
  const bench = plan.placements.find((p) => p.item === 'waiting_bench');
  if (bench) {
    const f = facingOf(bench.rotY);
    const inward = f.x * (0 - bench.x) + f.z * (0 - bench.z);
    if (inward <= 0.2) errors.push('bench faces the wall');
  }
  return errors;
}
