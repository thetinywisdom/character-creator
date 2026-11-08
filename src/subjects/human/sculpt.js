import * as THREE from 'three';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';

// Sculpting the torso surface itself: instead of adding separate blocks or
// balls, torso vertices are pushed forward / backward with soft falloffs.
// Women: chest and bottom. Men: flat, defined pecs. Both: upper-back trapezius. The shapes grow out of the body
// with no seams, and still look faceted at PS1 polygon counts.
//
// Chest and bottom are two soft lobes with a slight dip between them.

const gauss = (d, s) => Math.exp(-((d / s) ** 2));

/** Returns a new, sculpted geometry for one lathe band of the torso. */
export function sculptTorso(geo, f) {
  const L = f.torsoLen;
  const zones = [];
  if (!f.woman && !f.child) {
    // pecs (adults only: children have a soft, flat chest): two broad, flat masses with a short edge underneath
    zones.push({
      sign: 1, yc: 0.74 * L, up: 0.11 * L, down: 0.05 * L,
      amount: f.sw * 0.03 * (1 + 1.6 * (f.muscle ?? 0)), two: true, x0: f.sw * 0.16, sx: f.sw * 0.13, wx: f.sw * 0.3,
    });
  }
  if (f.belly > 0) {
    // a round belly, fullest just below the middle of the torso
    zones.push({
      sign: 1, yc: 0.3 * L, up: 0.3 * L, down: 0.24 * L,
      amount: f.sw * 0.16 * f.belly, two: false, x0: 0, sx: f.sw * 0.2, wx: f.sw * 0.34,
    });
  }
  if (f.woman) {
    zones.push({
      sign: 1,                      // front
      // Natural profile: a gentle, slightly hollow slope down from the
      // collarbone, the fullest point low on the chest, and a rounded,
      // heavier underside that curves back in (not a shelf near the top).
      yc: 0.56 * L,                 // fullest point, low on the chest
      up: 0.34 * L,                 // long, slightly concave slope from the collarbone
      down: 0.1 * L,                // rounded underside
      upShape: 'droop',
      amount: f.sw * 0.2 * f.chestSize, // a touch more: the droop profile has less volume up top
      two: true,
      x0: f.sw * 0.13, sx: f.sw * 0.11, // lobe centres and width
      wx: f.sw * 0.22,                  // width of the single mass
    });
  }
  if (f.woman) {
    zones.push({
      sign: -1,                     // back
      yc: -0.05 * L,                // over the top of the thighs
      up: 0.14 * L,                 // curve up into the lower back
      down: 0.1 * L,                // rounded underneath, not a shelf
      amount: f.hw * 0.19 * f.bottomSize,
      two: true,
      x0: f.hw * 0.21, sx: f.hw * 0.17,
      wx: f.hw * 0.3,
    });
  }
  // trapezius: a very slight, wide fullness across the upper back (a narrow,
  // strong one reads as a hump)
  zones.push({
    sign: -1, yc: 0.86 * L, up: 0.08 * L, down: 0.14 * L,
    amount: f.sw * 0.02, two: false, wx: f.sw * 0.45,
  });
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
      // above the fullest point: a 'droop' ramp (slightly hollow, gently
      // rising toward the fullest point) instead of a bell curve
      const vy = t > 0 && s.upShape === 'droop'
        ? Math.pow(Math.max(0, 1 - t / s.up), 1.8)
        : gauss(t, t > 0 ? s.up : s.down);
      const vx = s.two ? Math.max(gauss(x - s.x0, s.sx), gauss(x + s.x0, s.sx)) : gauss(x, s.wx);
      dz += s.sign * s.amount * vy * vx * facing ** 1.5;
    }
    // the torso mesh is squashed front-to-back by torsoDepth, so compensate
    pos.setZ(i, z + dz / f.torsoDepth);
  }
  out.computeVertexNormals();
  return out;
}
