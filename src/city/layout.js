import { mulberry32 } from '../lib/rng.js';
import { FORMAT, VERSION, gridGeometry } from './format.js';
import { buildCity } from './build.js';

// A small Japanese town: a grid of blocks separated by roads. Each block has
// a raised sidewalk ring and a type that decides its buildings.
//
// generateCityData(seed) writes the town as a city file (see format.js):
// plain JSON, no 3D. buildCity() (build.js) turns any city file into the
// scene. generateCity(style, seed) does both, for convenience.

export const ROAD = 6;      // road width (two narrow lanes; was 9, felt too big to explore)
export const BLOCK = 40;    // block size including its sidewalk
export const WALK = 3;      // sidewalk width
const CURB_H = 0.12;        // sidewalks are this much higher than the road

const TYPES = [
  ['residential', 'mixed', 'shops', 'residential'],
  ['mixed', 'park', 'downtown', 'mixed'],
  ['residential', 'shops', 'mixed', 'residential'],
];

const LOT = {
  residential: { min: 9, max: 12, depth: 12 },
  mixed: { min: 8, max: 12, depth: 12 },
  shops: { min: 7, max: 12, depth: 12 },
  downtown: { min: 12, max: 17, depth: 13 },
};

// individual shops (city/shops.js) that blocks fill themselves with
const NEW_SHOPS = ['laundromat', 'kissaten', 'pharmacy', 'sushi', 'florist', 'fishmonger', 'udonSoba', 'takoyaki'];

/** Which building asset (and shop type) goes on a lot. */
function pickBuilding(type, rng, corner) {
  const r = rng();
  if (type === 'residential') return { asset: r < 0.55 ? 'building.house' : r < 0.75 ? 'building.woodApartment' : 'building.apartment' };
  if (type === 'shops') {
    if (corner) return { asset: 'building.shop', shopType: 'Konbini' };
    if (r < 0.45) return { asset: `building.${NEW_SHOPS[Math.floor(rng() * NEW_SHOPS.length)]}` };
    return { asset: r < 0.75 ? 'building.shop' : 'building.mixedUse' };
  }
  if (type === 'downtown') return { asset: r < 0.55 ? 'building.office' : r < 0.7 ? 'building.karaoke' : 'building.mixedUse' };
  if (r < 0.2) return { asset: `building.${NEW_SHOPS[Math.floor(rng() * NEW_SHOPS.length)]}` };
  return { asset: r < 0.7 ? 'building.mixedUse' : r < 0.85 ? 'building.shop' : 'building.apartment' };
}

const rotOf = (out) => Math.round(Math.atan2(out[0], out[1]) * 180 / Math.PI);
const r2 = (v) => Math.round(v * 100) / 100;

/** Collects objects for a city file, all tagged with one group. */
function placer(objects, group) {
  return (asset, params, x, z, out, y) => {
    const o = { asset, params, x: r2(x), z: r2(z), rot: rotOf(out), group };
    if (y) o.y = y;
    objects.push(o);
  };
}

/**
 * Everything belonging to one block, tagged 'block:col,row': its buildings
 * (or park / plaza), things in front of them, the curbside poles, wires and
 * lamps round it, and maybe a car parked at its kerb. Seeded, so the same
 * block seed always gives the same block.
 */
export function blockObjects(grid, block) {
  const { col, row, type } = block;
  const rng = mulberry32((block.seed ?? 1) * 7919 + 13);
  const seedOf = () => Math.floor(rng() * 1e9);
  const { block: BLOCK, sidewalk: WALK, road: ROAD, curb: CURB_H } = grid;
  const { blockRect } = gridGeometry(grid);
  const objects = [];
  const place = placer(objects, `block:${col},${row}`);
  const { x0, x1, z0, z1 } = blockRect(col, row);
  const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;

  if (type === 'park') {
    place('area.park', { w: BLOCK - WALK * 2, d: BLOCK - WALK * 2, seed: seedOf() }, cx, cz, [0, 1]);
  } else if (type === 'shrine') {
    // a shrine in a grove: old trees, zelkova and pines round the edge, cherry trees by the gate
    const inner = BLOCK - WALK * 2;
    place('building.shrine', { w: 18, d: inner - 2, seed: seedOf() }, cx, cz, [0, 1]);
    for (let i = 0; i < 10; i++) {
      const side = i % 2 ? 1 : -1;
      const z = z0 + WALK + 3 + Math.floor(i / 2) * ((inner - 6) / 4);
      const kind = z > z1 - WALK - 9 ? 'Cherry blossom' : ['Old giant', 'Zelkova', 'Black pine', 'Pine'][Math.floor(rng() * 4)];
      place('nature.tree', { variant: kind, seed: 1 + Math.floor(rng() * 50) }, cx + side * (inner / 2 - 3.5), z, [0, 1]);
    }
  } else if (type === 'school') {
    place('building.school', { w: BLOCK - WALK * 2, d: BLOCK - WALK * 2, seed: seedOf() }, cx, cz, [0, 1]);
  } else if (type === 'plaza') {
    place('ground.paving', { w: BLOCK - WALK * 2, d: BLOCK - WALK * 2, color: 0xc9c1ae }, cx, cz, [0, 1]);
    for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      place('prop.bench', { variant: 'Park bench' }, cx + dx * 8, cz + dz * 8, [-dx, 0]);
    }
    place('prop.planter', { variant: 'Planter box' }, cx, cz, [0, 1]);
  } else if (LOT[type]) {
    // --- buildings: rows along the north and south edges, one lot on each of east and west
    const spec = LOT[type];
    const D = spec.depth;
    const inner0 = x0 + WALK, inner1 = x1 - WALK;
    for (const side of ['north', 'south']) {
      let x = inner0;
      while (inner1 - x > spec.min * 0.8) {
        let w = spec.min + rng() * (spec.max - spec.min);
        if (inner1 - x - w < spec.min * 0.8) w = inner1 - x; // last lot takes the rest
        const corner = x === inner0 && side === 'south';
        const pick = pickBuilding(type, rng, corner);
        const out = side === 'north' ? [0, -1] : [0, 1];
        const lz = side === 'north' ? z0 + WALK + D / 2 : z1 - WALK - D / 2;
        place(pick.asset, { w: r2(w), d: D, seed: seedOf(), ...(pick.shopType ? { shopType: pick.shopType } : {}) }, x + w / 2, lz, out);
        // a vending machine, planter, bicycle or motorbike in front of some buildings
        const r = rng();
        const frontZ = side === 'north' ? z0 + WALK + 0.1 : z1 - WALK - 0.1;
        const fwd = side === 'north' ? -0.5 : 0.5;
        if (r < 0.25 && w > 8) {
          place('prop.vendingMachine', { variant: ['White', 'Red', 'Blue'][Math.floor(rng() * 3)] }, x + w - 1.2, frontZ + fwd * 0.9, out);
        } else if (r < 0.4) {
          place('prop.planter', { variant: 'Potted plant' }, x + 0.8, frontZ + fwd * 0.6, out);
        } else if (r < 0.48) {
          place('vehicle.bicycle', { color: ['White', 'Gray', 'Blue', 'Red'][Math.floor(rng() * 4)] }, x + w - 1, frontZ + fwd * 0.9, [1, 0]);
        } else if (r < 0.55) {
          // a parked motorbike (a delivery scooter outside food shops)
          const variant = pick.shopType ? 'Delivery' : ['50cc', 'Step-through', 'Motorcycle', 'Mini scooter'][Math.floor(rng() * 4)];
          place('vehicle.scooter', { variant, color: { '50cc': 'White', Delivery: 'White', 'Step-through': 'Green', Motorcycle: 'Black', 'Mini scooter': 'Yellow' }[variant] }, x + w - 1.2, frontZ + fwd * 1.0, [1, 0]);
        }
        if (pick.shopType === 'Konbini') {
          place('prop.postBox', {}, x + w + 0.2, frontZ + fwd * 1.0, out);
          place('prop.trashBin', { variant: 'Recycling station' }, x + 2, frontZ + fwd * 0.8, out);
        }
        x += w;
      }
    }
    for (const side of ['west', 'east']) {
      const w = BLOCK - WALK * 2 - D * 2; // the gap between the two rows
      if (w < 6) continue;
      const pick = pickBuilding(type, rng, false);
      const out = side === 'west' ? [-1, 0] : [1, 0];
      const lx = side === 'west' ? x0 + WALK + D / 2 : x1 - WALK - D / 2;
      place(pick.asset, { w: r2(w), d: D, seed: seedOf(), ...(pick.shopType ? { shopType: pick.shopType } : {}) }, lx, cz, out);
    }
    // paving inside the block, between the building rows
    place('ground.paving', { w: BLOCK - WALK * 2 - 0.2, d: BLOCK - WALK * 2 - D * 2 }, cx, cz, [0, 1]);
    // a bus stop on some mixed blocks
    if (type === 'mixed' && rng() < 0.4) {
      place('prop.busStop', { variant: 'Shelter' }, cx, z1 - 1.2, [0, 1]);
      place('prop.streetSign', { variant: 'Street name' }, x1 - 1, z1 - 0.5, [0, 1]);
    }
  }

  // --- curbside: utility poles + wires (north and west edges), street lamps
  // (south and east edges)
  const curb = 0.45;
  const poles = [];
  for (let x = x0 + 4; x <= x1 - 4; x += 16) {
    place('prop.utilityPole', { variant: poles.length % 2 ? 'Plain' : 'With transformer' }, x, z0 + curb, [0, -1]);
    poles.push(x);
  }
  for (let k = 0; k < poles.length - 1; k++) {
    for (const [dx, y] of [[-0.6, 8.7], [0.6, 8.7], [0, 7.9]]) {
      objects.push({ asset: 'line.wire', params: { a: [r2(poles[k] + dx), y, r2(z0 + curb)], b: [r2(poles[k + 1] + dx), y, r2(z0 + curb)], sag: 0.5 }, x: 0, z: 0, rot: 0, group: `block:${col},${row}` });
    }
  }
  for (let z = z0 + 12; z <= z1 - 8; z += 16) place('prop.utilityPole', { variant: 'Plain' }, x0 + curb, z, [-1, 0]);
  for (let x = x0 + 12; x <= x1 - 8; x += 16) place('prop.streetLamp', { variant: 'Single' }, x, z1 - curb, [0, 1]);
  for (let z = z0 + 6; z <= z1 - 6; z += 16) place('prop.streetLamp', { variant: 'Single' }, x1 - curb, z, [1, 0]);

  // (no cars parked at the kerb: on 6 m roads they would block the moving cars'
  // lane; park cars by hand in parking garages or lots instead)
  return objects;
}

/** Which road segments and intersections exist: roads run round every block. */
export function roadNetwork(grid, blocks) {
  const has = new Set(blocks.map((b) => `${b.col},${b.row}`));
  const at = (c, r) => has.has(`${c},${r}`);
  // horizontal segment (i, j): along node row j, from node column i to i+1
  const hSeg = (i, j) => at(i, j - 1) || at(i, j);
  // vertical segment (i, j): along node column i, from node row j to j+1
  const vSeg = (i, j) => at(i - 1, j) || at(i, j);
  const nodeArms = (i, j) => ({ w: i > 0 && hSeg(i - 1, j), e: hSeg(i, j), n: j > 0 && vSeg(i, j - 1), s: vSeg(i, j) });
  return { hSeg, vSeg, nodeArms };
}

/**
 * Street furniture that depends on how blocks meet, tagged 'streets':
 * crosswalks on every road arm at an intersection, traffic lights where four
 * roads meet, stop / speed-limit signs at the others.
 */
export function streetObjects(grid, blocks) {
  const objects = [];
  const place = placer(objects, 'streets');
  const { X, Z } = gridGeometry(grid);
  const { block: BLOCK, road: ROAD, curb: CURB_H } = grid;
  const { nodeArms } = roadNetwork(grid, blocks);
  for (let j = 0; j <= grid.rows; j++) {
    for (let i = 0; i <= grid.cols; i++) {
      const arms = nodeArms(i, j);
      const n = Object.values(arms).filter(Boolean).length;
      if (n === 0) continue;
      const xi = -X / 2 + ROAD / 2 + i * (BLOCK + ROAD);
      const zi = -Z / 2 + ROAD / 2 + j * (BLOCK + ROAD);
      const off = ROAD / 2 + 2.3;
      const top = r2(-CURB_H + 0.001);
      if (n >= 3) {
        if (arms.w) place('prop.crosswalk', { length: ROAD }, xi - off, zi, [0, 1], top);
        if (arms.e) place('prop.crosswalk', { length: ROAD }, xi + off, zi, [0, 1], top);
        if (arms.n) place('prop.crosswalk', { length: ROAD }, xi, zi - off, [1, 0], top);
        if (arms.s) place('prop.crosswalk', { length: ROAD }, xi, zi + off, [1, 0], top);
      }
      const c = ROAD / 2 + 0.6;
      if (n === 4) {
        place('prop.trafficLight', { variant: 'Car signal' }, xi + c, zi - c, [0, 1]);
        place('prop.trafficLight', { variant: 'Car signal' }, xi - c, zi + c, [0, -1]);
        place('prop.trafficLight', { variant: 'Pedestrian signal' }, xi + c, zi + c, [-1, 0]);
      } else if (n === 3 && (i + j) % 2 === 0 && arms.e && arms.s) {
        place('prop.streetSign', { variant: (i + j) % 4 === 0 ? 'Stop' : 'Speed limit' }, xi + c, zi + c, [0, 1]);
      }
    }
  }
  return objects;
}

/** A whole town as a city file (JSON-ready object). */
export function generateCityData(seed = 3) {
  const rng = mulberry32(seed * 9973 + 1);
  const grid = { cols: TYPES[0].length, rows: TYPES.length, block: BLOCK, road: ROAD, sidewalk: WALK, curb: CURB_H };
  const blocks = [];
  for (let row = 0; row < grid.rows; row++) {
    for (let col = 0; col < grid.cols; col++) blocks.push({ col, row, type: TYPES[row][col], seed: Math.floor(rng() * 1e9) });
  }
  const objects = [...blocks.flatMap((b) => blockObjects(grid, b)), ...streetObjects(grid, blocks)];
  return { format: FORMAT, version: VERSION, meta: { name: 'Sample town', seed }, grid, blocks, objects };
}

/** Generate a town and build it (the scene plus colliders, loops, ...). */
export function generateCity(style, seed = 3) {
  return buildCity(generateCityData(seed), style);
}
