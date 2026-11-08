import * as THREE from 'three';
import { CATALOG } from '../catalog/index.js';
import { tiledBox } from '../props/util.js';
import { gridGeometry, validateCity } from './format.js';
import { roadNetwork } from './layout.js';

// Turns a city file (see format.js) into a scene plus everything the game
// needs: colliders, pedestrian loops, a car loop, the park area and a ground
// height function. Any city file works: generated, hand-edited or saved from
// the editor.

const D2R = Math.PI / 180;

/** A local collider box moved into the world by an object's placement. */
function placeCollider(c, x, z, rot) {
  const cos = Math.cos(rot), sin = Math.sin(rot);
  return {
    x: x + c.x * cos + c.z * sin,
    z: z - c.x * sin + c.z * cos,
    // axis-aligned box round the turned one (exact for 90° turns)
    hw: Math.abs(cos) * c.hw + Math.abs(sin) * c.hd,
    hd: Math.abs(sin) * c.hw + Math.abs(cos) * c.hd,
  };
}

/** Build one city object (asset + placement), or null for an unknown asset. */
export function buildObject(o, style) {
  const asset = CATALOG[o.asset];
  if (!asset) return null;
  const obj = asset.build({ ...asset.params, ...o.params }, style);
  obj.position.set(o.x ?? 0, o.y ?? 0, o.z ?? 0);
  obj.rotation.y = (o.rot ?? 0) * D2R;
  obj.userData.asset = o.asset;
  obj.userData.cityObject = o; // the city-file entry it was built from
  return obj;
}

export function buildCity(data, style) {
  const problems = validateCity(data, CATALOG);
  if (problems.some((p) => !p.startsWith('unknown asset'))) throw new Error(`Bad city file: ${problems.join(', ')}`);
  for (const p of problems) console.warn(`city: ${p} (skipped)`);

  const grid = data.grid;
  const { block: BLOCK, road: ROAD, sidewalk: WALK = 3, curb: CURB_H = 0.12 } = grid;
  const { X, Z, blockRect } = gridGeometry(grid);
  const g = new THREE.Group();
  const colliders = [];
  const walkLoops = [];
  const blocks = [];
  let parkRect = null;

  // grass everywhere; roads run round every block and join up by themselves
  g.add(tiledBox(X + 60, 0.1, Z + 60, style.material('grass', 0x6f9a52), [0, -CURB_H - 0.06, 0], 8));
  const roadMat = style.material('road');
  const { hSeg, vSeg, nodeArms } = roadNetwork(grid, data.blocks ?? []);
  const nodeX = (i) => -X / 2 + ROAD / 2 + i * (BLOCK + ROAD);
  const nodeZ = (j) => -Z / 2 + ROAD / 2 + j * (BLOCK + ROAD);
  for (let j = 0; j <= grid.rows; j++) {
    for (let i = 0; i <= grid.cols; i++) {
      if (Object.values(nodeArms(i, j)).some(Boolean)) g.add(tiledBox(ROAD, 0.02, ROAD, roadMat, [nodeX(i), -CURB_H, nodeZ(j)]));
      if (i < grid.cols && hSeg(i, j)) g.add(tiledBox(BLOCK, 0.02, ROAD, roadMat, [nodeX(i) + (ROAD + BLOCK) / 2, -CURB_H, nodeZ(j)]));
      if (j < grid.rows && vSeg(i, j)) g.add(tiledBox(ROAD, 0.02, BLOCK, roadMat, [nodeX(i), -CURB_H, nodeZ(j) + (ROAD + BLOCK) / 2]));
    }
  }

  for (const b of data.blocks ?? []) {
    const r = blockRect(b.col, b.row);
    const cx = (r.x0 + r.x1) / 2, cz = (r.z0 + r.z1) / 2;
    blocks.push({ ...r, type: b.type });
    // raised sidewalk slab (the whole block; buildings sit on it)
    g.add(tiledBox(BLOCK, CURB_H, BLOCK, style.material('sidewalk'), [cx, -CURB_H / 2, cz]));
    // pedestrians walk a loop in the middle of the sidewalk
    const o = WALK / 2;
    walkLoops.push([[r.x0 + o, r.z0 + o], [r.x1 - o, r.z0 + o], [r.x1 - o, r.z1 - o], [r.x0 + o, r.z1 - o]]);
    if (b.type === 'park' && !parkRect) {
      parkRect = { x0: r.x0 + WALK + 1, x1: r.x1 - WALK - 1, z0: r.z0 + WALK + 1, z1: r.z1 - WALK - 1 };
    }
  }

  // everything placed in the town
  for (const o of data.objects ?? []) {
    const obj = buildObject(o, style);
    if (!obj) continue;
    g.add(obj);
    for (const c of obj.userData.colliders ?? []) colliders.push(placeCollider(c, o.x ?? 0, o.z ?? 0, obj.rotation.y));
  }

  // car routes: round each block in the lane next to it, with the block on
  // the driver's left (Japan drives on the left)
  const e = ROAD / 4;
  const carLoops = blocks.map((b) => [[b.x0 - e, b.z0 - e], [b.x0 - e, b.z1 + e], [b.x1 + e, b.z1 + e], [b.x1 + e, b.z0 - e]]);
  const carLoop = carLoops[0] ?? null;
  // where the player starts: the sidewalk south of the park, else of the first block
  const startBlock = blocks.find((b) => b.type === 'park') ?? blocks[0];
  const start = startBlock ? { x: (startBlock.x0 + startBlock.x1) / 2, z: startBlock.z1 - WALK / 2 } : { x: 0, z: 0 };
  // somewhere for cats to wander: the park, else the first block's sidewalk
  if (!parkRect && blocks[0]) {
    const b = blocks[0];
    parkRect = { x0: b.x0 + 1, x1: b.x1 - 1, z0: b.z0 + 1, z1: b.z0 + WALK - 1 };
  }

  const inBlock = (x, z) => blocks.some((b) => x >= b.x0 && x <= b.x1 && z >= b.z0 && z <= b.z1);
  const groundHeight = (x, z) => (inBlock(x, z) ? 0 : -CURB_H);

  return { group: g, colliders, walkLoops, carLoop, carLoops, parkRect, start, groundHeight, size: { X, Z }, blocks, data };
}
