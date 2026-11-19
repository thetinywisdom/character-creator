// Seeded minimarket layout. Seed 0 is layout.json.
//
// Fixed: door and windows, and the drinks fridge wall along the back
// (four or five cases, always facing the shop). The register is the counter:
// it sits on the left or the right, never in the doorway.
// Varies: register side (the whole checkout mirrors), two or three shelf
// aisles with a 0.9 m gap, whether the end bay is an ice chest, ATM and
// magazine side, basket count, optional copier / umbrella / trash, goods
// colour rotation, register stripe and noren cloth.
// A 0.9 m spine runs from the door to the fridges. Aisles stay on either
// side of it. Baskets and the hot-food case sit off that path.

import handmade from '../../public/minimarket-kit/layout.json';
import { rngFor, occupancy, auditPlan, facingOf } from '../lib/roomLayout.js';

const FP = {
  register_counter: [2.24, 0.82],
  shelf_aisle: [2.66, 0.66],
  drinks_fridge: [1.12, 0.64],
  hot_food: [0.86, 0.52],
  magazine_rack: [0.74, 0.42],
  atm: [0.58, 0.5],
  copier: [0.72, 0.64],
  basket: [0.42, 0.32],
  coffee_machine: [0.34, 0.36],
  microwave: [0.5, 0.38],
  ice_chest: [1.06, 0.64],
  umbrella_stand: [0.36, 0.36],
  noren: [1.4, 0.08],
  poster: [0.54, 0.06],
  trash_bin: [0.36, 0.36],
  clock: [0.4, 0.08],
  ceiling_light: [0.74, 0.34],
  floor_mat: [1.2, 0.7],
};

const BACK = new Set(['poster', 'clock']);
const NO_HIT = new Set(['floor_mat', 'ceiling_light', 'noren']);
const ON_TOP = new Set(['coffee_machine', 'microwave']);
const BOUNDS = { x0: -4.78, x1: 4.78, z0: -3.78, z1: 3.78 };
const SURFACES = new Set(['register_counter']);

const STRIPE = ['paint:Butter', 'paint:Dusty rose', 'paint:Seafoam'];
const NOREN = [
  ['cloth:Seafoam', 'cloth:Off white'],
  ['cloth:Navy', 'cloth:Off white'],
  ['cloth:Dusty rose', 'cloth:Butter'],
];
const BASKET = [
  ['paint:Dusty rose', 'paint:Powder blue'],
  ['paint:Navy', 'paint:Butter'],
  ['paint:Seafoam', 'paint:Sand'],
];
const BAND = ['paint:Navy', 'paint:Dusty rose', 'paint:Seafoam'];

function generate(seed) {
  const rng = rngFor(seed, 0x5109);
  const occ = occupancy({ bounds: BOUNDS, footprints: FP, back: BACK, noHit: NO_HIT, onTop: ON_TOP });
  const keepouts = [];

  // Door centred at x = 1. Spine follows it back to the fridge wall.
  keepouts.push(occ.keep(1.0, 3.15, 0.95, 0.55, 'entrance'));
  keepouts.push(occ.keep(0.2, 2.7, 3.6, 0.45, 'concourse'));
  keepouts.push(occ.keep(1.0, -0.35, 0.45, 2.55, 'spine'));

  const side = rng.chance(0.5) ? 1 : -1;
  const regX = side * 2.6;
  const register = occ.place('register_counter', regX, 1.72, 0);
  // Hot case on the outer end of the counter, clear of the spine.
  occ.place('hot_food', side * 4.22, 1.72, 0);
  if (rng.chance(0.85)) occ.add('coffee_machine', register.x + side * 0.5, register.z - 0.1, rng.jitter(0.15), 0.97);
  if (rng.chance(0.8)) occ.add('microwave', register.x - side * 0.55, register.z - 0.12, rng.jitter(0.15), 0.97);

  const fridgeCount = rng.chance(0.55) ? 5 : 4;
  const fridgeX = fridgeCount === 5 ? [-3.6, -1.8, 0, 1.8, 3.6] : [-1.8, 0, 1.8, 3.6];
  for (const x of fridgeX) occ.place('drinks_fridge', x, -3.42, 0);
  if (fridgeCount === 4) occ.place('ice_chest', -4.1, -3.42, 0);
  else if (rng.chance(0.7)) occ.tryAt('ice_chest', [{ x: -4.15, z: -2.55, rotY: 0 }]);

  const rowZ = -1.82 + rng.jitter(0.04);
  const frontZ = rowZ + 1.58;
  // Right gondola stops short of the side wall so the ATM has a slot.
  occ.place('shelf_aisle', -1.5, rowZ, 0);
  occ.place('shelf_aisle', 2.82, rowZ, 0);
  const third = rng.chance(0.6);
  if (third) occ.place('shelf_aisle', side > 0 ? -1.5 : 2.82, frontZ, 0);

  // ATM and magazines on the wall opposite the register, facing in.
  const wall = -side;
  const wallX = wall * 4.52;
  const faceIn = wall > 0 ? -Math.PI / 2 : Math.PI / 2;
  occ.place('atm', wallX, -0.55, faceIn);
  occ.place('magazine_rack', wallX, 1.15, faceIn);

  const baskets = rng.int(1, 3);
  const basketSpots = [
    { x: regX - side * 0.85, z: 1.1 },
    { x: regX - side * 0.35, z: 1.05 },
    { x: regX - side * 1.3, z: 1.15 },
  ];
  for (let i = 0; i < baskets; i++) {
    occ.tryAt('basket', [{ ...basketSpots[i], rotY: rng.jitter(0.4) }]);
  }

  if (rng.chance(0.65)) {
    occ.tryAt('copier', [
      { x: -side * 2.7, z: 1.15, rotY: rng.jitter(0.3) },
      { x: -side * 3.4, z: 0.9, rotY: side * 0.4 },
    ]);
  }
  if (rng.chance(0.7)) occ.tryAt('umbrella_stand', [
    { x: -0.55, z: 3.48, rotY: rng.jitter(0.3) },
    { x: 2.45, z: 3.48, rotY: 0.2 },
  ]);
  if (rng.chance(0.75)) occ.tryAt('trash_bin', [
    { x: side * 4.4, z: 0.85, rotY: 0.2 },
    { x: -side * 4.35, z: 2.55, rotY: 0 },
  ]);

  const posterZ = rng.pick([-2.15, -1.15, 2.35]);
  occ.place('poster', wall * 4.86, posterZ, wall > 0 ? -Math.PI / 2 : Math.PI / 2, 1.25);
  occ.place('clock', rng.pick([-2.6, -0.9, 0.9, 2.6]), -3.86, 0, 2.2);

  occ.add('noren', 1.0, 2.95, 0);
  occ.add('floor_mat', 1.0 + rng.jitter(0.1), 3.38, 0);
  occ.add('ceiling_light', -1.5, rowZ, 0, 2.2);
  occ.add('ceiling_light', 2.4, rowZ, 0, 2.2);
  occ.add('ceiling_light', regX, 1.5, 0, 2.2);

  const noren = rng.pick(NOREN);
  const basket = rng.pick(BASKET);
  return {
    placements: occ.placements,
    keepouts,
    accent: {
      stripe: rng.pick(STRIPE),
      norenA: noren[0],
      norenB: noren[1],
      basketA: basket[0],
      basketB: basket[1],
      band: rng.pick(BAND),
      goods: rng.int(0, 11),
    },
    stripes: [
      { x: -0.2, z: (rowZ + frontZ) / 2, len: 2.2, key: 'paint:Navy' },
      { x: 2.0, z: rowZ, len: 1.6, key: 'paint:Butter' },
    ],
  };
}

export function minimarketLayout(seed) {
  if (!(seed | 0)) return { placements: handmade.placements, keepouts: [], accent: null, stripes: null };
  return generate(seed | 0);
}

const SPEC = { bounds: BOUNDS, footprints: FP, back: BACK, noHit: NO_HIT, onTop: ON_TOP, surfaces: SURFACES };

export function minimarketIssues(seed) {
  const plan = minimarketLayout(seed);
  const errors = (seed | 0) ? auditPlan(plan, SPEC) : auditPlan({ ...plan, keepouts: [] }, SPEC);
  if (!(seed | 0)) return errors;
  const fridges = plan.placements.filter((p) => p.item === 'drinks_fridge');
  if (fridges.length < 4) errors.push(`fridges ${fridges.length}`);
  for (const f of fridges) {
    if (Math.abs(f.rotY) > 0.01 || f.z > -3) errors.push('fridge left the back wall');
  }
  const shelves = plan.placements.filter((p) => p.item === 'shelf_aisle');
  if (shelves.length < 2 || shelves.length > 3) errors.push(`shelves ${shelves.length}`);
  const register = plan.placements.find((p) => p.item === 'register_counter');
  const food = plan.placements.find((p) => p.item === 'hot_food');
  if (!register || !food) errors.push('checkout');
  else if (Math.sign(register.x) !== Math.sign(food.x)) errors.push('hot food left the register');
  for (const atm of plan.placements.filter((p) => p.item === 'atm' || p.item === 'magazine_rack')) {
    const f = facingOf(atm.rotY);
    if (f.x * (0 - atm.x) + f.z * (0 - atm.z) <= 0.2) errors.push(`${atm.item} faces the wall`);
  }
  return errors;
}
