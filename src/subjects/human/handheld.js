import * as THREE from 'three';
import { capsuleBetween, seg } from '../../lib/shapes.js';

// Things carried in the right hand: a shopping bag, a briefcase, a closed
// umbrella. Built hanging straight down from the grip, then turned to follow
// the forearm, and added to the forearm joint so they swing with the walk.

export const HAND_ITEMS = ['None', 'Shopping bag', 'Briefcase', 'Umbrella'];

/** grip: point in forearm space; dir: forearm direction (toward the fingers). */
export function buildHandItem(f, kind, material, grip, dir) {
  if (!kind || kind === 'None') return null;
  const g = new THREE.Group();
  const dark = f.mats.trim;
  const S = f.H / 1.7; // children carry smaller things
  if (kind === 'Shopping bag') {
    const w = 0.13 * S, h = 0.36 * S, d = 0.32 * S;
    // two rope handles from the fist down to the bag's top edge
    for (const sz of [-1, 1]) g.add(capsuleBetween([0, 0, 0], [0, -0.13 * S, sz * d * 0.3], 0.008, dark, 4));
    const bag = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
    bag.position.y = -0.13 * S - h / 2;
    g.add(bag);
  } else if (kind === 'Briefcase') {
    const w = 0.09 * S, h = 0.3 * S, d = 0.42 * S;
    g.add(new THREE.Mesh(new THREE.TorusGeometry(0.04 * S, 0.01, 4, seg(8, 6), Math.PI), dark).rotateY(Math.PI / 2).rotateX(Math.PI));
    const c = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
    c.position.y = -0.04 * S - h / 2;
    g.add(c);
  } else if (kind === 'Umbrella') {
    // a long umbrella, closed, carried point-down like a walking stick
    const L = 0.78 * S;
    g.add(new THREE.Mesh(new THREE.TorusGeometry(0.05 * S, 0.012, 4, seg(8, 6), Math.PI), dark).translateY(0.05 * S).rotateY(Math.PI / 2));
    g.add(capsuleBetween([0, 0.05 * S, 0], [0, -L, 0], 0.011, dark, 5));
    const furled = new THREE.Mesh(new THREE.ConeGeometry(0.05 * S, L * 0.62, seg(8, 6)), material);
    furled.rotation.x = Math.PI; // wide end up
    furled.position.y = -L * 0.2 - (L * 0.62) / 2 + 0.05;
    g.add(furled);
  }
  g.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), dir);
  g.position.copy(grip);
  g.name = 'handItem';
  return g;
}
