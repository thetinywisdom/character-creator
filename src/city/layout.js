import * as THREE from 'three';
import { mulberry32 } from '../lib/rng.js';
import { apartment, house, mixedUse, office, shop } from './buildings.js';
import { park } from './park.js';
import { busStop, postBox, streetLamp, trashBin } from '../props/furniture.js';
import { crosswalk, streetSign, trafficLight } from '../props/traffic.js';
import { bicycle, car } from '../props/vehicles.js';
import { planter, utilityPole, vendingMachine, wire } from '../props/extras.js';
import { box, tiledBox } from '../props/util.js';

// A small Japanese town: a grid of blocks separated by roads. Each block has
// a raised sidewalk ring and a type that decides its buildings. Returns the
// static scene (to be merged), colliders, sidewalk loops for pedestrians, a
// road loop for cars, the park area and a ground-height function.

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

function pickBuilder(type, rng, corner) {
  const r = rng();
  if (type === 'residential') return r < 0.62 ? house : apartment;
  if (type === 'shops') return corner ? 'Konbini' : r < 0.6 ? shop : mixedUse;
  if (type === 'downtown') return r < 0.6 ? office : mixedUse;
  return r < 0.7 ? mixedUse : r < 0.85 ? shop : apartment;
}

export function generateCity(style, seed = 3) {
  const rng = mulberry32(seed * 9973 + 1);
  const g = new THREE.Group();
  const colliders = [];
  const walkLoops = [];
  const nz = TYPES.length, nx = TYPES[0].length;
  const X = nx * BLOCK + (nx + 1) * ROAD;
  const Z = nz * BLOCK + (nz + 1) * ROAD;
  const blocks = [];
  let parkRect = null;

  // road surface everywhere, plus a grass verge beyond the town
  g.add(tiledBox(X + 60, 0.1, Z + 60, style.material('grass', 0x6f9a52), [0, -CURB_H - 0.06, 0], 8));
  g.add(tiledBox(X, 0.02, Z, style.material('road'), [0, -CURB_H, 0]));

  const addCollider = (x, z, hw, hd) => colliders.push({ x, z, hw, hd });

  /** Place a building / prop built facing +z, so it faces `out` (unit x or z). */
  const place = (obj, x, z, out) => {
    obj.position.set(x, 0, z);
    obj.rotation.y = Math.atan2(out[0], out[1]);
    g.add(obj);
    return obj;
  };

  for (let j = 0; j < nz; j++) {
    for (let i = 0; i < nx; i++) {
      const type = TYPES[j][i];
      const x0 = -X / 2 + ROAD + i * (BLOCK + ROAD), z0 = -Z / 2 + ROAD + j * (BLOCK + ROAD);
      const x1 = x0 + BLOCK, z1 = z0 + BLOCK;
      const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
      blocks.push({ x0, x1, z0, z1, type });
      // raised sidewalk slab (the whole block; buildings sit on it)
      g.add(tiledBox(BLOCK, CURB_H, BLOCK, style.material('sidewalk'), [cx, -CURB_H / 2, cz]));
      // pedestrians walk a loop in the middle of the sidewalk
      const o = 1.5;
      walkLoops.push([[x0 + o, z0 + o], [x1 - o, z0 + o], [x1 - o, z1 - o], [x0 + o, z1 - o]]);

      if (type === 'park') {
        const p = park(style, rng, BLOCK - WALK * 2, BLOCK - WALK * 2);
        p.group.position.set(cx, 0, cz);
        g.add(p.group);
        for (const c of p.colliders) addCollider(c.x + cx, c.z + cz, c.hw, c.hd);
        parkRect = { x0: x0 + WALK + 1, x1: x1 - WALK - 1, z0: z0 + WALK + 1, z1: z1 - WALK - 1 };
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
          const builder = pickBuilder(type, rng, corner);
          const b = typeof builder === 'string' ? shop(style, rng, w, D, builder) : builder(style, rng, w, D);
          const out = side === 'north' ? [0, -1] : [0, 1];
          const lz = side === 'north' ? z0 + WALK + D / 2 : z1 - WALK - D / 2;
          place(b.group, x + w / 2, lz, out);
          // collider: footprint rotated into the world (north side is flipped)
          const fz = side === 'north' ? lz - b.footprint.z : lz + b.footprint.z;
          addCollider(x + w / 2, fz, b.footprint.w / 2, b.footprint.d / 2);
          // a vending machine or planter in front of some buildings
          const r = rng();
          const frontZ = side === 'north' ? z0 + WALK + 0.1 : z1 - WALK - 0.1;
          const fwd = side === 'north' ? -0.5 : 0.5;
          if (r < 0.25 && w > 8) {
            const vm = vendingMachine.build({ variant: ['White', 'Red', 'Blue'][Math.floor(rng() * 3)] }, style);
            place(vm, x + w - 1.2, frontZ + fwd * 0.9, out);
            addCollider(x + w - 1.2, frontZ + fwd * 0.9, 0.55, 0.45);
          } else if (r < 0.4) {
            place(planter.build({ variant: 'Potted plant' }, style), x + 0.8, frontZ + fwd * 0.6, out);
          } else if (r < 0.48) {
            place(bicycle.build({ color: ['White', 'Gray', 'Blue', 'Red'][Math.floor(rng() * 4)] }, style), x + w - 1, frontZ + fwd * 0.9, [1, 0]);
          }
          if (builder === 'Konbini') {
            place(postBox.build({}, style), x + w + 0.2, frontZ + fwd * 1.0, out);
            addCollider(x + w + 0.2, frontZ + fwd * 1.0, 0.25, 0.25);
            place(trashBin.build({ variant: 'Recycling station' }, style), x + 2, frontZ + fwd * 0.8, out);
          }
          x += w;
        }
      }
      for (const side of ['west', 'east']) {
        const w = BLOCK - WALK * 2 - D * 2; // the gap between the two rows
        if (w < 6) continue;
        const builder = pickBuilder(type, rng, false);
        const b = typeof builder === 'string' ? shop(style, rng, w, D, builder) : builder(style, rng, w, D);
        const out = side === 'west' ? [-1, 0] : [1, 0];
        const lx = side === 'west' ? x0 + WALK + D / 2 : x1 - WALK - D / 2;
        place(b.group, lx, cz, out);
        const fx = side === 'west' ? lx - b.footprint.z : lx + b.footprint.z;
        addCollider(fx, cz, b.footprint.d / 2, b.footprint.w / 2);
      }
      // ground inside the block, between the building rows
      g.add(tiledBox(BLOCK - WALK * 2 - 0.2, 0.02, BLOCK - WALK * 2 - D * 2, style.material('concrete', 0x9c9a92), [cx, 0.01, cz]));
    }
  }

  // --- curbside props along every block: utility poles + wires (north and
  // west edges), street lamps (south and east edges)
  for (const b of blocks) {
    const curb = 0.45;
    const poles = [];
    for (let x = b.x0 + 4; x <= b.x1 - 4; x += 16) {
      place(utilityPole.build({ variant: poles.length % 2 ? 'Plain' : 'With transformer' }, style), x, b.z0 + curb, [0, -1]);
      addCollider(x, b.z0 + curb, 0.2, 0.2);
      poles.push(x);
    }
    for (let k = 0; k < poles.length - 1; k++) {
      for (const [dx, y] of [[-0.6, 8.7], [0.6, 8.7], [0, 7.9]]) {
        g.add(wire([poles[k] + dx, y, b.z0 + curb], [poles[k + 1] + dx, y, b.z0 + curb], style, 0.5));
      }
    }
    for (let z = b.z0 + 12; z <= b.z1 - 8; z += 16) {
      place(utilityPole.build({ variant: 'Plain' }, style), b.x0 + curb, z, [-1, 0]);
      addCollider(b.x0 + curb, z, 0.2, 0.2);
    }
    for (let x = b.x0 + 12; x <= b.x1 - 8; x += 16) {
      place(streetLamp.build({ variant: 'Single' }, style), x, b.z1 - curb, [0, 1]);
      addCollider(x, b.z1 - curb, 0.15, 0.15);
    }
    for (let z = b.z0 + 6; z <= b.z1 - 6; z += 16) {
      place(streetLamp.build({ variant: 'Single' }, style), b.x1 - curb, z, [1, 0]);
      addCollider(b.x1 - curb, z, 0.15, 0.15);
    }
  }

  // --- intersections: crosswalks on every arm, traffic lights on two corners
  for (let j = 0; j <= nz; j++) {
    for (let i = 0; i <= nx; i++) {
      const xi = -X / 2 + ROAD / 2 + i * (BLOCK + ROAD);
      const zi = -Z / 2 + ROAD / 2 + j * (BLOCK + ROAD);
      const off = ROAD / 2 + 2.3;
      const top = -CURB_H + 0.001;
      const arms = [];
      if (i > 0) arms.push([xi - off, zi, 0]);            // arm crossing the road toward -x
      if (i < nx) arms.push([xi + off, zi, 0]);
      if (j > 0) arms.push([xi, zi - off, Math.PI / 2]);
      if (j < nz) arms.push([xi, zi + off, Math.PI / 2]);
      for (const [x, z, ry] of arms) {
        const cw = crosswalk.build({}, style, { length: ROAD });
        cw.position.set(x, top, z);
        cw.rotation.y = ry;
        g.add(cw);
      }
      const interior = i > 0 && i < nx && j > 0 && j < nz;
      if (interior) {
        const c = ROAD / 2 + 0.6;
        const t1 = trafficLight.build({ variant: 'Car signal' }, style);
        place(t1, xi + c, zi - c, [0, 1]);
        const t2 = trafficLight.build({ variant: 'Car signal' }, style);
        place(t2, xi - c, zi + c, [0, -1]);
        for (const [x, z] of [[xi + c, zi - c], [xi - c, zi + c]]) addCollider(x, z, 0.2, 0.2);
        const ped = trafficLight.build({ variant: 'Pedestrian signal' }, style);
        place(ped, xi + c, zi + c, [-1, 0]);
        addCollider(xi + c, zi + c, 0.2, 0.2);
      } else if ((i + j) % 2 === 0) {
        const s = streetSign.build({ variant: (i + j) % 4 === 0 ? 'Stop' : 'Speed limit' }, style);
        place(s, xi + ROAD / 2 + 0.6, zi + ROAD / 2 + 0.6, [0, 1]);
      }
    }
  }

  // --- a bus stop and a few street-name signs
  const b0 = blocks[1];
  place(busStop.build({ variant: 'Shelter' }, style), (b0.x0 + b0.x1) / 2, b0.z1 - 1.2, [0, 1]);
  addCollider((b0.x0 + b0.x1) / 2, b0.z1 - 1.6, 1.6, 0.7);
  place(streetSign.build({ variant: 'Street name' }, style), b0.x1 - 1, b0.z1 - 0.5, [0, 1]);

  // --- parked cars along some curbs (Japan: they drive on the left)
  const kinds = ['Kei car', 'Sedan', 'Minivan', 'Kei car'];
  const colors = ['White', 'Gray', 'Black', 'Blue', 'Red', 'White'];
  for (const b of blocks) {
    if (rng() < 0.5) continue;
    const x = b.x0 + 8 + rng() * (BLOCK - 16);
    const c = car.build({ variant: kinds[Math.floor(rng() * kinds.length)], color: colors[Math.floor(rng() * colors.length)] }, style);
    c.position.set(x, -CURB_H, b.z1 + 1.4);
    c.rotation.y = Math.PI / 2; // facing east: the left (kerb-side) lane for eastbound traffic
    g.add(c);
    addCollider(x, b.z1 + 1.4, 2.3, 0.9);
  }

  // --- a ring road loop for moving cars (left-hand traffic, clockwise lane)
  const ring = ROAD / 2;
  const carLoop = [
    [-X / 2 + ring, -Z / 2 + ring], [X / 2 - ring, -Z / 2 + ring], [X / 2 - ring, Z / 2 - ring], [-X / 2 + ring, Z / 2 - ring],
  ];

  const inBlock = (x, z) => blocks.some((b) => x >= b.x0 && x <= b.x1 && z >= b.z0 && z <= b.z1);
  const groundHeight = (x, z) => (inBlock(x, z) ? 0 : -CURB_H);

  return { group: g, colliders, walkLoops, carLoop, parkRect, groundHeight, size: { X, Z }, blocks };
}
