// Seeded clinic layout. Seed 0 (or omitted) is the hand-placed layout.json.
// Any other integer is deterministic: same seed, same room.
//
// Fixed: door and windows (in the shell), reception desk, sink, medicine
// cabinet on the left wall (the plumbing wall).
// Varies: which wall the waiting chairs use, how many chairs, which exam bay
// gets an IV, optional loose props, a few centimetres of jitter, and accent
// swatches (wainscot, chairs, curtains).
// Walkways (0.9 m): door to the desk, a spine to the exam bays, and a path
// around the left bed to the sink. Chairs face the room or the desk. The
// stool faces the doctor desk.

import handmade from '../../public/clinic-kit/layout.json';
import { rngFor, occupancy, shuffled, auditPlan, facingOf } from '../lib/roomLayout.js';

const FP = {
  reception_desk: [2.4, 0.8],
  waiting_chair: [0.5, 0.5],
  exam_bed: [0.78, 1.95],
  privacy_curtain: [1.55, 0.14],
  doctor_desk: [1.2, 0.64],
  scale: [0.4, 0.42],
  iv_stand: [0.28, 0.28],
  medicine_cabinet: [0.8, 0.4],
  exam_stool: [0.38, 0.38],
  sink: [0.66, 0.48],
  blood_pressure: [0.38, 0.36],
  chart_rack: [0.7, 0.08],
  waste_bin: [0.32, 0.32],
  slipper_rack: [0.82, 0.34],
  coat_hooks: [0.56, 0.12],
  clinic_cross: [0.46, 0.06],
  plant: [0.26, 0.26],
  clock: [0.4, 0.08],
  ceiling_light: [0.44, 0.44],
  floor_mat: [1.1, 0.7],
};

const BACK = new Set(['chart_rack', 'coat_hooks', 'clinic_cross', 'clock']);
const NO_HIT = new Set(['floor_mat', 'ceiling_light']);
const ON_TOP = new Set();
const BOUNDS = { x0: -4.8, x1: 4.8, z0: -3.78, z1: 3.78 };

const CHAIR = ['cloth:Powder blue', 'cloth:Seafoam', 'cloth:Lilac', 'cloth:Sky'];
const CURTAIN = ['cloth:Sky', 'cloth:Powder blue', 'cloth:Seafoam', 'cloth:Lilac'];
const SHEET = ['cloth:Sky', 'cloth:Powder blue', 'cloth:Mint'];
const WAINSCOT = ['paint:Seafoam', 'paint:Powder blue', 'paint:Sage', 'paint:Mint'];
const BAY = ['paint:Sky', 'paint:Powder blue', 'paint:Mint'];

function accent(rng) {
  return {
    chair: rng.pick(CHAIR),
    curtain: rng.pick(CURTAIN),
    sheet: rng.pick(SHEET),
    wainscot: rng.pick(WAINSCOT),
    bay: rng.pick(BAY),
    plantSeed: rng.int(1, 900),
  };
}

function generate(seed) {
  const rng = rngFor(seed, 0xC11C);
  const occ = occupancy({ bounds: BOUNDS, footprints: FP, back: BACK, noHit: NO_HIT, onTop: ON_TOP });
  const keepouts = [];

  // Door is centred on x = -0.02. The spine stays left of the reception desk.
  // Paths are 0.9 m or wider and meet at the entrance.
  keepouts.push(occ.keep(-0.02, 2.95, 0.9, 0.8, 'entrance'));
  keepouts.push(occ.keep(1.0, 2.1, 0.85, 0.45, 'reception'));
  keepouts.push(occ.keep(-0.55, 0.55, 0.45, 1.7, 'spine'));
  keepouts.push(occ.keep(-0.15, -0.78, 2.35, 0.45, 'exam approach'));
  // Between the left bed and the sink, then across to the spine.
  keepouts.push(occ.keep(-3.7, -1.05, 0.45, 0.65, 'sink approach'));
  keepouts.push(occ.keep(-2.15, -0.55, 1.3, 0.45, 'to sink'));

  occ.place('reception_desk', 1.45, 1.15, 0);
  occ.place('sink', -4.48, -1.45, Math.PI / 2);
  occ.place('medicine_cabinet', -4.5, -3.1, Math.PI / 2);

  const jx = rng.jitter(0.1);
  const jz = rng.jitter(0.04);
  const left = occ.place('exam_bed', -2.35 + jx, -2.55 + jz, 0);
  const right = occ.place('exam_bed', 1.55 - jx * 0.4, -2.55 + jz, 0);
  occ.place('privacy_curtain', left.x, left.z + 1.13, 0);
  occ.place('privacy_curtain', right.x, right.z + 1.13, Math.PI);

  const desk = occ.place('doctor_desk', 3.42 + rng.jitter(0.06), -2.5, Math.PI / 2);
  // Stool on the desk's front (+x), facing back toward the desk.
  occ.place('exam_stool', desk.x + 0.72, desk.z + rng.jitter(0.06), -Math.PI / 2);

  const midX = (left.x + right.x) / 2;
  const midZ = (left.z + right.z) / 2;
  occ.block(midX, midZ, 0.06, 0.85, 'divider');

  occ.place('iv_stand', left.x - 0.7, left.z - 0.15, rng.jitter(0.25));
  if (rng.chance(0.65)) occ.tryAt('iv_stand', [{ x: right.x + 0.7, z: right.z - 0.1, rotY: rng.jitter(0.25) }]);

  const zone = rng.int(0, 2);
  const n = rng.int(3, 5);
  if (zone === 0) {
    for (let i = 0; i < n; i++) occ.place('waiting_chair', -4.15, 0.4 + i * 0.7, Math.PI / 2);
    if (rng.chance(0.7)) {
      occ.place('waiting_chair', 2.85, 2.6, Math.PI);
      occ.place('waiting_chair', 3.6, 2.6, Math.PI);
    }
  } else if (zone === 1) {
    const m = Math.min(n, 4);
    for (let i = 0; i < m; i++) occ.place('waiting_chair', 4.2, 0.45 + i * 0.7, -Math.PI / 2);
  } else {
    const m = Math.min(n, 4);
    for (let i = 0; i < m; i++) occ.place('waiting_chair', -3.85 + i * 0.72, 2.72, Math.PI);
  }

  const scaleSpots = shuffled(rng, [
    { x: -2.15, z: 0.6 }, { x: -2.3, z: 1.7 }, { x: 3.9, z: 0.85 }, { x: 2.9, z: 0.45 },
  ]);
  if (!occ.tryAt('scale', scaleSpots.map((s) => ({ ...s, rotY: rng.jitter(0.2) })))) {
    occ.place('scale', -2.15, 0.6, 0);
  }

  if (rng.chance(0.75)) {
    occ.tryAt('blood_pressure', shuffled(rng, [
      { x: 2.35, z: 0.45 }, { x: -1.65, z: 0.25 }, { x: 3.95, z: -0.85 },
    ]).map((s) => ({ ...s, rotY: rng.jitter(0.3) })));
  }
  if (rng.chance(0.8)) occ.tryAt('waste_bin', [{ x: 3.55, z: 0.42, rotY: rng.jitter(0.3) }, { x: -2.55, z: 2.15, rotY: 0.2 }]);
  if (rng.chance(0.7)) occ.tryAt('slipper_rack', [{ x: -1.85, z: 3.28, rotY: 0 }, { x: 2.4, z: 3.3, rotY: 0 }]);
  if (rng.chance(0.8)) {
    occ.tryAt('coat_hooks', [
      { x: -4.86, z: 2.55, rotY: Math.PI / 2, y: 1.4 },
      { x: 4.86, z: 2.3, rotY: -Math.PI / 2, y: 1.4 },
    ]);
  }
  if (rng.chance(0.85)) {
    occ.tryAt('plant', shuffled(rng, [
      { x: 4.4, z: 3.25 }, { x: -4.35, z: 3.28 }, { x: 4.45, z: 0.7 },
    ]).map((s) => ({ ...s, rotY: rng.jitter(0.5) })));
  }

  const wallX = shuffled(rng, [-3.3, -1.4, 0.35, 2.05, 3.65]);
  const hung = [];
  for (const x of wallX) {
    if (hung.every((h) => Math.abs(h - x) >= 1.25)) hung.push(x);
    if (hung.length === 3) break;
  }
  occ.place('clinic_cross', hung[0], -3.86, 0, 1.9);
  occ.place('chart_rack', hung[1], -3.86, 0, 1.15);
  occ.place('clock', hung[2], -3.86, 0, 2.0);

  occ.add('floor_mat', -0.05 + rng.jitter(0.08), 3.38, 0);
  occ.add('ceiling_light', left.x, left.z + 0.2, 0, 2.15);
  occ.add('ceiling_light', right.x, right.z + 0.2, 0, 2.15);
  occ.add('ceiling_light', -1.4, 1.5, 0, 2.15);
  occ.add('ceiling_light', 2.1, 1.55, 0, 2.15);

  return {
    placements: occ.placements,
    keepouts,
    accent: accent(rngFor(seed, 0xA77)),
    divider: { x: midX, z: midZ },
  };
}

export function clinicLayout(seed) {
  if (!(seed | 0)) return { placements: handmade.placements, keepouts: [], accent: null, divider: null };
  return generate(seed | 0);
}

const SPEC = { bounds: BOUNDS, footprints: FP, back: BACK, noHit: NO_HIT, onTop: ON_TOP, surfaces: new Set() };

export function clinicIssues(seed) {
  const plan = clinicLayout(seed);
  const errors = (seed | 0) ? auditPlan(plan, SPEC) : auditPlan({ ...plan, keepouts: [] }, SPEC);
  if (!(seed | 0)) return errors;
  const beds = plan.placements.filter((p) => p.item === 'exam_bed');
  if (beds.length !== 2) errors.push(`exam beds ${beds.length}`);
  const curtains = plan.placements.filter((p) => p.item === 'privacy_curtain');
  if (curtains.length !== 2) errors.push('curtains');
  for (const bed of beds) {
    if (!curtains.some((c) => Math.abs(c.x - bed.x) < 0.2 && c.z > bed.z)) errors.push('curtain not in front of bed');
  }
  const stool = plan.placements.find((p) => p.item === 'exam_stool');
  const desk = plan.placements.find((p) => p.item === 'doctor_desk');
  if (!stool || !desk) errors.push('doctor pair');
  else {
    const f = facingOf(stool.rotY);
    const dx = desk.x - stool.x;
    const dz = desk.z - stool.z;
    const len = Math.hypot(dx, dz) || 1;
    if (f.x * dx / len + f.z * dz / len < 0.7) errors.push('stool faces away from the desk');
  }
  for (const c of plan.placements.filter((p) => p.item === 'waiting_chair')) {
    const f = facingOf(c.rotY);
    const nearest = Math.min(Math.abs(c.x - BOUNDS.x0), Math.abs(c.x - BOUNDS.x1), Math.abs(c.z - BOUNDS.z1));
    if (nearest < 0.9) {
      const inward = (c.x < 0 ? f.x : -f.x) + (c.z > 2 ? -f.z : 0);
      if (inward < 0.4) errors.push('chair faces the wall');
    }
  }
  if (!plan.placements.some((p) => p.item === 'reception_desk')) errors.push('no reception');
  if (!plan.placements.some((p) => p.item === 'sink')) errors.push('no sink');
  return errors;
}
