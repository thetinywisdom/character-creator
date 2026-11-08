import * as THREE from 'three';
import { seg, taperBetween } from '../../lib/shapes.js';

// Footwear: low-poly shoes and ankle boots. The foot is a slim box whose top
// slopes down toward a narrowed toe, like the feet of 90s console models.

export const FOOTWEAR = ['Shoes', 'Boots'];

/** One foot (leg-local: the hip at the origin, ground at y = -legLen). */
export function buildFoot(f, kind, material, x) {
  const g = new THREE.Group();
  // slimmer and lower than before (they read as bricks): a sole-length box
  // that narrows and slopes down toward a rounded toe, with a softened heel
  const W = Math.max(f.ankleR * 2.2, f.legR * 1.15);
  const H = f.footH * 0.85;
  const Lf = f.footL * 0.98;
  const geo = new THREE.BoxGeometry(W, H, Lf, 2, 1, 4);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i), z = pos.getZ(i);
    const t = z / (Lf / 2); // -1 heel .. 1 toe
    if (y > 0 && t > -0.2) pos.setY(i, y - H * 0.7 * Math.max(0, t + 0.2) / 1.2); // top slopes down to the toe
    if (t > 0.3) pos.setX(i, pos.getX(i) * (1 - 0.35 * (t - 0.3) / 0.7));           // toe narrows
    if (t < -0.8 && y > 0) pos.setZ(i, z + Lf * 0.04);                               // softened heel
  }
  geo.computeVertexNormals();
  const foot = new THREE.Mesh(geo, material);
  foot.position.set(x, -f.legLen + H / 2, Lf * 0.25);
  g.add(foot);

  if (kind === 'Boots') {
    // a chunky cuff around the ankle, up the lower shin
    const bottom = -f.legLen + H * 0.7;
    const topY = -f.legLen + f.footH + f.legLen * 0.22;
    g.add(taperBetween([x, bottom, 0], [x, topY, 0], f.ankleR * 1.45, f.ankleR * 1.38, material, seg(10, 6)));
  }
  return g;
}
