import * as THREE from 'three';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';

// Sculpting the torso surface itself (women): instead of adding a separate
// block or ball, vertices of the torso are pushed forward at the chest and
// backward at the bottom with soft falloffs. The shapes grow out of the body
// with no seams, and still look faceted at PS1 polygon counts.
//
// Shapes:  'Smooth'       one soft mass
//          'Smooth (two)' two soft lobes with a slight dip between them
// ('Wedge' chest and 'Round' bottom are separate meshes, see tops.js / legwear.js.)

const gauss = (d, s) => Math.exp(-((d / s) ** 2));

/** Returns a new, sculpted geometry for one lathe band of the torso. */
export function sculptTorso(geo, f) {
  if (!f.woman) return geo;
  const L = f.torsoLen;
  const zones = [];
  if (f.chestShape !== 'Wedge') {
    zones.push({
      sign: 1,                      // front
      yc: 0.64 * L,                 // fullest point
      up: 0.17 * L,                 // long slope up toward the collarbone
      down: 0.075 * L,              // short drop underneath
      amount: f.sw * 0.17 * f.chestSize,
      two: f.chestShape === 'Smooth (two)',
      x0: f.sw * 0.13, sx: f.sw * 0.11, // lobe centres and width
      wx: f.sw * 0.22,                  // width of the single mass
    });
  }
  if (f.bottomShape !== 'Round') {
    zones.push({
      sign: -1,                     // back
      yc: -0.05 * L,                // over the top of the thighs
      up: 0.14 * L,                 // curve up into the lower back
      down: 0.1 * L,                // rounded underneath, not a shelf
      amount: f.hw * 0.19 * f.bottomSize,
      two: f.bottomShape === 'Smooth (two)',
      x0: f.hw * 0.21, sx: f.hw * 0.17,
      wx: f.hw * 0.3,
    });
  }
  if (!zones.length) return geo;

  // weld the lathe seam first so recomputed normals stay smooth across it
  geo.deleteAttribute('uv');
  geo.deleteAttribute('normal');
  const out = mergeVertices(geo, 1e-6);
  geo.dispose();

  const pos = out.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    const r = Math.hypot(x, z);
    if (r < 1e-6) continue;
    let dz = 0;
    for (const s of zones) {
      const facing = (s.sign * z) / r; // 1 = straight ahead of the zone
      if (facing <= 0) continue;
      const t = y - s.yc;
      const vy = gauss(t, t > 0 ? s.up : s.down);
      const vx = s.two ? Math.max(gauss(x - s.x0, s.sx), gauss(x + s.x0, s.sx)) : gauss(x, s.wx);
      dz += s.sign * s.amount * vy * vx * facing ** 1.5;
    }
    // the torso mesh is squashed front-to-back by torsoDepth, so compensate
    pos.setZ(i, z + dz / f.torsoDepth);
  }
  out.computeVertexNormals();
  return out;
}
