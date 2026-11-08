import * as THREE from 'three';
import { CATALOG } from '../catalog/index.js';
import { tiledBox } from '../props/util.js';
import { gridGeometry, validateCity } from './format.js';

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

  // road surface everywhere, plus a grass verge beyond the town
  g.add(tiledBox(X + 60, 0.1, Z + 60, style.material('grass', 0x6f9a52), [0, -CURB_H - 0.06, 0], 8));
  g.add(tiledBox(X, 0.02, Z, style.material('road'), [0, -CURB_H, 0]));

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
    const asset = CATALOG[o.asset];
    if (!asset) continue;
    const obj = asset.build({ ...asset.params, ...o.params }, style);
    const rot = (o.rot ?? 0) * D2R;
    obj.position.set(o.x ?? 0, o.y ?? 0, o.z ?? 0);
    obj.rotation.y = rot;
    obj.userData.asset = o.asset;
    g.add(obj);
    for (const c of obj.userData.colliders ?? []) colliders.push(placeCollider(c, o.x ?? 0, o.z ?? 0, rot));
  }

  // a ring road loop for moving cars (left-hand traffic)
  const ring = ROAD / 2;
  const carLoop = [[-X / 2 + ring, -Z / 2 + ring], [X / 2 - ring, -Z / 2 + ring], [X / 2 - ring, Z / 2 - ring], [-X / 2 + ring, Z / 2 - ring]];

  const inBlock = (x, z) => blocks.some((b) => x >= b.x0 && x <= b.x1 && z >= b.z0 && z <= b.z1);
  const groundHeight = (x, z) => (inBlock(x, z) ? 0 : -CURB_H);

  return { group: g, colliders, walkLoops, carLoop, parkRect, groundHeight, size: { X, Z }, blocks, data };
}
