import * as THREE from 'three';
import { seg, taperBetween } from '../../lib/shapes.js';

// Footwear: chunky low-poly shoes and ankle boots. The foot is a box whose
// top slopes down toward the toe, like the blocky feet of 90s console models.

export const FOOTWEAR = ['Shoes', 'Boots'];

/** One foot (leg-local: the hip at the origin, ground at y = -legLen). */
export function buildFoot(f, kind, material, x) {
  const g = new THREE.Group();
  const W = Math.max(f.ankleR * 2.7, f.legR * 1.5);
  const H = f.footH * 1.15;
  const Lf = f.footL * 1.05;
  const geo = new THREE.BoxGeometry(W, H, Lf, 1, 1, 2);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i), z = pos.getZ(i);
    if (y > 0 && z > 0) pos.setY(i, y - H * 0.55 * (z / (Lf / 2))); // toe slope
    if (z > Lf * 0.45) pos.setX(i, pos.getX(i) * 0.85);             // narrower toe
  }
  geo.computeVertexNormals();
  const foot = new THREE.Mesh(geo, material);
  foot.position.set(x, -f.legLen + H / 2, Lf * 0.25);
  g.add(foot);

  if (kind === 'Boots') {
    // a chunky cuff around the ankle, up the lower shin
    const bottom = -f.legLen + H * 0.6;
    const topY = -f.legLen + f.footH + f.legLen * 0.22;
    g.add(taperBetween([x, bottom, 0], [x, topY, 0], f.ankleR * 1.75, f.ankleR * 1.65, material, seg(10, 6)));
  }
  return g;
}
