import * as THREE from 'three';
import { capsuleBetween, seg } from '../../lib/shapes.js';
import { band } from './tops.js';

// Outerwear: a second, slightly bigger layer over the torso (it follows the
// same profile and sculpting, so it fits both body types), plus thicker long
// sleeves (see arms.js). Cardigan and jacket are open at the front so the top
// shows; the hoodie is closed.

export const OUTERWEAR = ['None', 'Cardigan', 'Jacket', 'Hoodie'];

const SPECS = {
  Cardigan: { inflate: 0.012, gap: 0.9 },
  Jacket:   { inflate: 0.022, gap: 0.5, collar: true },
  Hoodie:   { inflate: 0.026, gap: 0, hood: true },
};

export function buildOuterwear(f, kind, mats) {
  const spec = SPECS[kind];
  const g = new THREE.Group();
  g.name = 'outerwear';
  if (!spec) return g;
  const L = f.torsoLen;
  const m = mats.outer;
  g.add(band(f, Math.max(f.torsoBottom, -0.02 * L), L * 0.975, m, { inflate: spec.inflate, gap: spec.gap }));

  if (spec.collar) {
    // a big, stand-up collar around the neck
    const collar = new THREE.Mesh(new THREE.CylinderGeometry(f.neckR * 2.1, f.neckR * 2.5, L * 0.12, seg(14), 1, true), m);
    collar.position.y = f.shoulderY - L * 0.01;
    collar.scale.z = 0.85;
    g.add(collar);
  }
  if (spec.hood) {
    // the hood, folded down on the upper back
    const hood = new THREE.Mesh(new THREE.SphereGeometry(1, seg(14, 8), seg(8, 5)), m);
    hood.scale.set(f.sw * 0.3, L * 0.16, f.sw * 0.2);
    hood.position.set(0, f.shoulderY - L * 0.06, -f.torsoR(L * 0.9) * f.torsoDepth - f.sw * 0.06);
    g.add(hood);
    // front pocket and drawstrings
    const front = (y) => (f.torsoR(y) + spec.inflate) * f.torsoDepth;
    const pocket = new THREE.Mesh(new THREE.BoxGeometry(f.sw * 0.55, L * 0.16, f.sw * 0.05), m);
    pocket.position.set(0, f.hipY + L * 0.2, front(L * 0.2) + f.sw * 0.01);
    g.add(pocket);
    for (const sx of [-1, 1]) {
      const x = sx * f.neckR * 0.9;
      const top = f.shoulderY - L * 0.03;
      g.add(capsuleBetween([x, top, front(L * 0.97) + 0.005], [x, top - L * 0.2, front(L * 0.77) + 0.01], f.armR * 0.18, mats.trim, 5));
    }
  }
  return g;
}
