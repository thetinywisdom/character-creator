import * as THREE from 'three';
import { capsuleBetween, seg } from '../../lib/shapes.js';
import { band, torsoSurface } from './tops.js';

// Outerwear: a second, slightly bigger layer over the torso (it follows the
// same profile and sculpting, so it fits both body types), plus thicker long
// sleeves (see arms.js). Cardigan and jacket are open at the front so the top
// shows; the hoodie is closed.

export const OUTERWEAR = ['None', 'Cardigan', 'Jacket', 'Hoodie', 'Suit jacket'];

const SPECS = {
  Cardigan: { inflate: 0.012, gap: 0.9 },
  Jacket:   { inflate: 0.022, gap: 0.5, collar: true },
  Hoodie:   { inflate: 0.026, gap: 0, hood: true },
  // closed below the chest, open in a V above it (shirt and tie show), lapels
  'Suit jacket': { inflate: 0.016, gap: 0, suit: true },
};

export function buildOuterwear(f, kind, mats) {
  const spec = SPECS[kind];
  const g = new THREE.Group();
  g.name = 'outerwear';
  if (!spec) return g;
  const L = f.torsoLen;
  const m = mats.outer;
  if (spec.suit) {
    // closed body up to the chest, then the V opening; a bit longer at the hips
    g.add(band(f, Math.min(f.torsoBottom, -0.06 * L), L * 0.6, m, { inflate: spec.inflate }));
    g.add(band(f, L * 0.6, L * 0.975, m, { inflate: spec.inflate, gap: 1.0 }));
    // lapels: a strip down each side of the V, standing a little proud
    const surf = torsoSurface(f);
    for (const sx of [-1, 1]) {
      g.add(lapel(f, surf, sx, m, spec.inflate));
    }
    // one button where the V closes
    const by = L * 0.55;
    const btn = new THREE.Mesh(new THREE.CylinderGeometry(f.sw * 0.028, f.sw * 0.028, 0.008, seg(8, 6)), mats.trim);
    btn.rotation.x = Math.PI / 2;
    btn.position.set(0, f.hipY + by, surf.front(0, by) + spec.inflate + 0.006);
    g.add(btn);
    return g;
  }
  g.add(band(f, Math.max(f.torsoBottom, -0.02 * L), L * 0.975, m, { inflate: spec.inflate, gap: spec.gap }));

  if (spec.collar) {
    // a big, stand-up collar around the neck
    const collar = new THREE.Mesh(new THREE.CylinderGeometry(f.neckR * 2.1, f.neckR * 2.5, L * 0.12, seg(14), 1, true), m);
    collar.position.y = f.shoulderY - L * 0.01;
    collar.scale.z = 0.85;
    g.add(collar);
  }
  if (spec.hood) {
    if (!f.hideHood) {
      // the hood, folded down on the upper back
      const hood = new THREE.Mesh(new THREE.SphereGeometry(1, seg(14, 8), seg(8, 5)), m);
      hood.scale.set(f.sw * 0.3, L * 0.16, f.sw * 0.2);
      hood.position.set(0, f.shoulderY - L * 0.06, -f.torsoR(L * 0.9) * f.depthAt(L * 0.9) - f.sw * 0.06);
      g.add(hood);
    }
    // front pocket and drawstrings
    const front = (y) => (f.torsoR(y) + spec.inflate) * f.depthAt(y);
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

/** A suit lapel: a flat wedge from the shoulder down to where the jacket closes. */
function lapel(f, surf, sx, material, inflate) {
  const L = f.torsoLen;
  const top = [sx * f.neckR * 1.3, L * 0.96], bottom = [sx * f.sw * 0.02, L * 0.56], outer = [sx * f.sw * 0.2, L * 0.8];
  const pt = ([x, y], out = 0.008) => new THREE.Vector3(x, f.hipY + y, surf.front(x, y) + inflate + out);
  const a = pt(top), b = pt(bottom), c = pt(outer);
  const geo = new THREE.BufferGeometry().setFromPoints(sx > 0 ? [a, b, c] : [a, c, b]);
  geo.computeVertexNormals();
  return new THREE.Mesh(geo, material);
}
