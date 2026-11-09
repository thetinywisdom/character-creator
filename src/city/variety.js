import { box } from '../props/util.js';
import { bicycle } from '../props/vehicles.js';
import { planter, vendingMachine } from '../props/extras.js';
import { bikeRack, paperLantern, sandwichBoard } from '../props/japan.js';
import { FLOOR, WALLS, gable, windowRow } from './buildings.js';
import { roofClutter, sideWindows } from './facades.js';

// Shared variety for building builders, so a new seed gives a really
// different building (shape, height, roof, layout, details, colours), not
// only a new colour. Every builder takes `rng` (seeded): draw from it, never
// from Math.random, so the same seed always rebuilds the same building.
//
// What a "new look" should change, in this order of importance:
//  1. shape: floors, width and depth used, roof type, extra wings or setbacks
//  2. layout: which side the door is on, where the signs and windows go
//  3. details: awnings, balconies, AC units, things out front
//  4. colours: walls, roofs, trims (alone this reads as "the same building")

export const pick = (rng, arr) => arr[Math.floor(rng() * arr.length)];
export const chance = (rng, p) => rng() < p;
/** -1 or 1: mirror a layout (door left or right). */
export const side = (rng) => (rng() < 0.5 ? -1 : 1);
/** A whole number from a to b inclusive. */
export const between = (rng, a, b) => a + Math.floor(rng() * (b - a + 1));

export const ROOF_COLORS = [0x4a5560, 0x6a4a3a, 0x3c4a5a, 0x7a3a32, 0x3a3f44, 0x5a6a5a];

/**
 * Flats over a shop (the Japanese shop house): `floors` storeys of windows
 * with curtains from height y0, plus side windows and sometimes balconies or
 * AC units on the front. The wall itself is the builder's body box.
 */
export function flatsAbove(g, style, rng, bw, bd, bz, front, y0, floors) {
  if (floors <= 0) return;
  const balconies = chance(rng, 0.35);
  for (let f = 0; f < floors; f++) {
    const y = y0 + f * FLOOR;
    windowRow(g, style, bw, y + 1.6, front + 0.01, { spacing: pick(rng, [2.2, 2.4, 3]), ww: 1.3, wh: 1.2 });
    if (balconies) {
      g.add(box(bw * 0.8, 0.12, 0.8, style.material('concrete', 0xc8c4bc), [0, y + 0.05, front + 0.4]));
      g.add(box(bw * 0.8, 0.85, 0.05, style.material('metal', 0xd8d8d0), [0, y + 0.5, front + 0.78]));
    } else if (chance(rng, 0.5)) {
      // an AC unit on a bracket under a window
      g.add(box(0.7, 0.5, 0.3, style.material('metal', 0xe8e8e4), [(rng() - 0.5) * bw * 0.6, y + 0.6, front + 0.2]));
    }
  }
  sideWindows(g, style, bd, bz, bw, floors, y0, FLOOR, { every: 5 });
}

/**
 * The top of a building at height H: a flat roof with a parapet and roof
 * clutter, or a pitched tile roof (along the street or gable end to it).
 */
export function roofTop(g, style, rng, bw, bd, bz, H, { pitched = 0.4, clutter = true } = {}) {
  const r = rng();
  if (r < pitched) {
    const mat = style.material('roof', pick(rng, ROOF_COLORS));
    const along = chance(rng, 0.6);
    const roof = along ? gable(bw + 0.6, bd + 0.8, Math.min(2.2, bd * 0.2), mat) : gable(bd + 0.6, bw + 0.8, Math.min(2.2, bw * 0.22), mat);
    if (!along) roof.rotation.y = Math.PI / 2;
    roof.position.set(0, H, bz);
    g.add(roof);
    return 'pitched';
  }
  // flat: a parapet round the edge, and things on the roof
  const pm = style.material('concrete', pick(rng, [0xb8b4aa, 0xc8c4bc, 0xa8a49a]));
  g.add(box(bw, 0.6, 0.15, pm, [0, H + 0.3, bz + bd / 2 - 0.08]));
  g.add(box(bw, 0.6, 0.15, pm, [0, H + 0.3, bz - bd / 2 + 0.08]));
  g.add(box(0.15, 0.6, bd, pm, [-bw / 2 + 0.08, H + 0.3, bz]));
  g.add(box(0.15, 0.6, bd, pm, [bw / 2 - 0.08, H + 0.3, bz]));
  if (!clutter) return 'flat';
  if (bw * bd > 160) roofClutter(g, style, rng, bw, bd, bz, H, { tank: chance(rng, 0.5), units: between(rng, 1, 3) });
  else smallRoof(g, style, rng, bw, bd, bz, H);
  return 'flat';
}

/** A small flat roof: maybe a stair hut, a water tank on legs, AC units, a laundry pole. */
function smallRoof(g, style, rng, bw, bd, bz, H) {
  const grey = style.material('concrete', 0xb8b4aa), metal = style.material('metal', 0xc8ccd0);
  const sx = side(rng);
  if (chance(rng, 0.6)) g.add(box(1.6, 2.2, 1.8, grey, [sx * (bw / 2 - 1.2), H + 1.1, bz - bd / 2 + 1.3])); // stair hut
  if (chance(rng, 0.4)) {
    const tx = -sx * (bw / 2 - 1.2), tz = bz - bd / 4;
    g.add(box(1.0, 0.8, 1.0, style.material('darkMetal'), [tx, H + 0.4, tz]));
    g.add(box(1.2, 1.0, 1.2, metal, [tx, H + 1.3, tz]));
  }
  for (let i = between(rng, 0, 3); i > 0; i--) g.add(box(0.8, 0.55, 0.35, style.material('metal', 0xe8e8e4), [(rng() - 0.5) * (bw - 2), H + 0.28, bz + (rng() - 0.5) * (bd - 2)]));
  if (chance(rng, 0.35)) { // a laundry pole with a few things drying
    const lz = bz + bd * 0.2;
    for (const px of [-1, 1]) g.add(box(0.06, 1.6, 0.06, metal, [px * 1.2, H + 0.8, lz]));
    g.add(box(2.4, 0.03, 0.03, metal, [0, H + 1.55, lz]));
    for (let k = 0; k < 3; k++) g.add(box(0.35, 0.5, 0.03, style.material('cloth', pick(rng, [0xf2f2ee, 0x3f7fd6, 0xf28cb8, 0xf2c230])), [-0.8 + k * 0.8, H + 1.25, lz]));
  }
}

/**
 * Things out on the pavement in front of a shop, at x away from `keepClear`
 * ([x0, x1] ranges to leave free: doors, displays). Returns colliders.
 */
export function frontExtras(g, style, rng, bw, front, { keepClear = [], max = 2, kinds = ['board', 'planter', 'bike', 'vending', 'lantern', 'rack'] } = {}) {
  const colliders = [];
  const n = between(rng, 0, max);
  const used = [...keepClear];
  for (let i = 0; i < n; i++) {
    const x = (rng() - 0.5) * (bw - 1.6);
    if (used.some(([a, b]) => x > a - 0.7 && x < b + 0.7)) continue;
    used.push([x - 0.6, x + 0.6]);
    const kind = pick(rng, kinds);
    let o, c = { hw: 0.35, hd: 0.3 };
    if (kind === 'board') o = sandwichBoard.build({ variant: pick(rng, sandwichBoard.variants) }, style);
    else if (kind === 'planter') o = planter.build({ variant: pick(rng, planter.variants) }, style);
    else if (kind === 'bike') { o = bicycle.build({ color: pick(rng, ['White', 'Gray', 'Blue', 'Red', 'Black']) }, style); o.rotation.y = Math.PI / 2; c = { hw: 0.9, hd: 0.3 }; }
    else if (kind === 'vending') { o = vendingMachine.build({ variant: pick(rng, vendingMachine.variants) }, style); c = { hw: 0.55, hd: 0.45 }; }
    else if (kind === 'lantern') { o = paperLantern.build({ variant: pick(rng, paperLantern.variants) }, style); c = null; }
    else { o = bikeRack.build({ variant: '3 bikes' }, style); c = { hw: 1.2, hd: 0.5 }; }
    const z = front + (kind === 'vending' ? 0.55 : 0.6);
    o.position.set(x, 0, kind === 'lantern' ? front - 0.3 : z);
    if (kind === 'board' || kind === 'planter') o.userData.knock = true; // vehicles knock these over
    if (kind === 'bike') o.userData.rideable = 'bicycle';               // you can ride it off
    g.add(o);
    if (c) colliders.push({ x, z, ...c });
  }
  return colliders;
}

export { WALLS };
