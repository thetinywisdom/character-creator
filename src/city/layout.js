import { mulberry32 } from '../lib/rng.js';
import { FORMAT, VERSION, gridGeometry } from './format.js';
import { buildCity } from './build.js';

// A small Japanese town: a grid of blocks separated by roads. Each block has
// a raised sidewalk ring and a type that decides its buildings.
//
// generateCityData(seed) writes the town as a city file (see format.js):
// plain JSON, no 3D. buildCity() (build.js) turns any city file into the
// scene. generateCity(style, seed) does both, for convenience.

export const ROAD = 9;      // road width (two lanes)
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

/** Which building asset (and shop type) goes on a lot. */
function pickBuilding(type, rng, corner) {
  const r = rng();
  if (type === 'residential') return { asset: r < 0.62 ? 'building.house' : 'building.apartment' };
  if (type === 'shops') return corner ? { asset: 'building.shop', shopType: 'Konbini' } : { asset: r < 0.6 ? 'building.shop' : 'building.mixedUse' };
  if (type === 'downtown') return { asset: r < 0.6 ? 'building.office' : 'building.mixedUse' };
  return { asset: r < 0.7 ? 'building.mixedUse' : r < 0.85 ? 'building.shop' : 'building.apartment' };
}

const rotOf = (out) => Math.round(Math.atan2(out[0], out[1]) * 180 / Math.PI);
const r2 = (v) => Math.round(v * 100) / 100;

/** A whole town as a city file (JSON-ready object). */
export function generateCityData(seed = 3) {
  const rng = mulberry32(seed * 9973 + 1);
  const seedOf = () => Math.floor(rng() * 1e9);
  const grid = { cols: TYPES[0].length, rows: TYPES.length, block: BLOCK, road: ROAD, sidewalk: WALK, curb: CURB_H };
  const { X, Z, blockRect } = gridGeometry(grid);
  const objects = [];
  const blocks = [];
  /** Place an asset at x, z facing `out` (unit x or z), optionally at height y. */
  const place = (asset, params, x, z, out, y) => {
    const o = { asset, params, x: r2(x), z: r2(z), rot: rotOf(out) };
    if (y) o.y = y;
    objects.push(o);
  };

  for (let row = 0; row < grid.rows; row++) {
    for (let col = 0; col < grid.cols; col++) {
      const type = TYPES[row][col];
      blocks.push({ col, row, type });
      const { x0, x1, z0, z1 } = blockRect(col, row);
      const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;

      if (type === 'park') {
        place('area.park', { w: BLOCK - WALK * 2, d: BLOCK - WALK * 2, seed: seedOf() }, cx, cz, [0, 1]);
        continue;
      }

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
          // a vending machine, planter or bicycle in front of some buildings
          const r = rng();
          const frontZ = side === 'north' ? z0 + WALK + 0.1 : z1 - WALK - 0.1;
          const fwd = side === 'north' ? -0.5 : 0.5;
          if (r < 0.25 && w > 8) {
            place('prop.vendingMachine', { variant: ['White', 'Red', 'Blue'][Math.floor(rng() * 3)] }, x + w - 1.2, frontZ + fwd * 0.9, out);
          } else if (r < 0.4) {
            place('prop.planter', { variant: 'Potted plant' }, x + 0.8, frontZ + fwd * 0.6, out);
          } else if (r < 0.48) {
            place('vehicle.bicycle', { color: ['White', 'Gray', 'Blue', 'Red'][Math.floor(rng() * 4)] }, x + w - 1, frontZ + fwd * 0.9, [1, 0]);
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
    }
  }

  // --- curbside props along every block: utility poles + wires (north and
  // west edges), street lamps (south and east edges)
  for (const b of blocks.map((b) => blockRect(b.col, b.row))) {
    const curb = 0.45;
    const poles = [];
    for (let x = b.x0 + 4; x <= b.x1 - 4; x += 16) {
      place('prop.utilityPole', { variant: poles.length % 2 ? 'Plain' : 'With transformer' }, x, b.z0 + curb, [0, -1]);
      poles.push(x);
    }
    for (let k = 0; k < poles.length - 1; k++) {
      for (const [dx, y] of [[-0.6, 8.7], [0.6, 8.7], [0, 7.9]]) {
        objects.push({ asset: 'line.wire', params: { a: [r2(poles[k] + dx), y, r2(b.z0 + curb)], b: [r2(poles[k + 1] + dx), y, r2(b.z0 + curb)], sag: 0.5 }, x: 0, z: 0, rot: 0 });
      }
    }
    for (let z = b.z0 + 12; z <= b.z1 - 8; z += 16) place('prop.utilityPole', { variant: 'Plain' }, b.x0 + curb, z, [-1, 0]);
    for (let x = b.x0 + 12; x <= b.x1 - 8; x += 16) place('prop.streetLamp', { variant: 'Single' }, x, b.z1 - curb, [0, 1]);
    for (let z = b.z0 + 6; z <= b.z1 - 6; z += 16) place('prop.streetLamp', { variant: 'Single' }, b.x1 - curb, z, [1, 0]);
  }

  // --- intersections: crosswalks on every arm, traffic lights on two corners
  const nx = grid.cols, nz = grid.rows;
  for (let j = 0; j <= nz; j++) {
    for (let i = 0; i <= nx; i++) {
      const xi = -X / 2 + ROAD / 2 + i * (BLOCK + ROAD);
      const zi = -Z / 2 + ROAD / 2 + j * (BLOCK + ROAD);
      const off = ROAD / 2 + 2.3;
      const top = r2(-CURB_H + 0.001);
      const arms = [];
      if (i > 0) arms.push([xi - off, zi, [0, 1]]);            // arm crossing the road toward -x
      if (i < nx) arms.push([xi + off, zi, [0, 1]]);
      if (j > 0) arms.push([xi, zi - off, [1, 0]]);
      if (j < nz) arms.push([xi, zi + off, [1, 0]]);
      for (const [x, z, out] of arms) place('prop.crosswalk', { length: ROAD }, x, z, out, top);
      const interior = i > 0 && i < nx && j > 0 && j < nz;
      if (interior) {
        const c = ROAD / 2 + 0.6;
        place('prop.trafficLight', { variant: 'Car signal' }, xi + c, zi - c, [0, 1]);
        place('prop.trafficLight', { variant: 'Car signal' }, xi - c, zi + c, [0, -1]);
        place('prop.trafficLight', { variant: 'Pedestrian signal' }, xi + c, zi + c, [-1, 0]);
      } else if ((i + j) % 2 === 0) {
        place('prop.streetSign', { variant: (i + j) % 4 === 0 ? 'Stop' : 'Speed limit' }, xi + ROAD / 2 + 0.6, zi + ROAD / 2 + 0.6, [0, 1]);
      }
    }
  }

  // --- a bus stop and a street-name sign
  const b0 = blockRect(blocks[1].col, blocks[1].row);
  place('prop.busStop', { variant: 'Shelter' }, (b0.x0 + b0.x1) / 2, b0.z1 - 1.2, [0, 1]);
  place('prop.streetSign', { variant: 'Street name' }, b0.x1 - 1, b0.z1 - 0.5, [0, 1]);

  // --- parked cars along some curbs (Japan: they drive on the left)
  const kinds = ['Kei car', 'Sedan', 'Minivan', 'Kei car'];
  const colors = ['White', 'Gray', 'Black', 'Blue', 'Red', 'White'];
  for (const b of blocks.map((b) => blockRect(b.col, b.row))) {
    if (rng() < 0.5) continue;
    const x = b.x0 + 8 + rng() * (BLOCK - 16);
    // facing east: the left (kerb-side) lane for eastbound traffic
    place('vehicle.car', { variant: kinds[Math.floor(rng() * kinds.length)], color: colors[Math.floor(rng() * colors.length)] }, x, b.z1 + 1.4, [1, 0], -CURB_H);
  }

  return { format: FORMAT, version: VERSION, meta: { name: 'Sample town', seed }, grid, blocks, objects };
}

/** Generate a town and build it (the scene plus colliders, loops, ...). */
export function generateCity(style, seed = 3) {
  return buildCity(generateCityData(seed), style);
}
