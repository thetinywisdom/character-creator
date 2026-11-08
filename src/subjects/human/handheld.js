import * as THREE from 'three';
import { capsuleBetween, seg } from '../../lib/shapes.js';

// Things carried in the right hand.
//
// Hanging items (shopping bag, briefcase, closed umbrella, walking stick) are
// built hanging straight down from the grip, turned to follow the forearm and
// added to the forearm joint, so they swing with the walk.
//
// Held items (open umbrella, phone, ice cream, coffee cup, boxes) need the arm
// in a pose: HOLD_POSES gives the joint angles (radians, same sign as the gait:
// negative x swings an arm forward / bends an elbow up). human.build poses the
// arm, builds the item upright (y up, facing +z) and fixes it to the forearm
// in that pose; poseGait keeps the arm there while walking (anim/gait.js).

export const HAND_ITEMS = ['None', 'Shopping bag', 'Briefcase', 'Umbrella', 'Walking stick',
  'Umbrella (open)', 'Phone', 'Ice cream', 'Coffee cup', 'Boxes'];

export const HOLD_POSES = {
  'Umbrella (open)': { armR: -0.15, foreR: -1.75 },
  Phone:             { armR: -0.15, foreR: -2.6, armRz: 0.35 },
  'Ice cream':       { armR: 0.05, foreR: -1.85 },
  'Coffee cup':      { armR: 0.05, foreR: -1.7 },
  // both arms round a stack of boxes in front of the belly
  Boxes:             { armR: -0.2, foreR: -1.2, armL: -0.2, foreL: -1.2, centre: true },
};

const CARDBOARD = 0xc09060;

/** grip: point in forearm space; dir: forearm direction (toward the fingers). */
export function buildHandItem(f, kind, material, grip, dir, style) {
  if (!kind || kind === 'None') return null;
  const g = new THREE.Group();
  g.name = 'handItem';
  const dark = f.mats.trim;
  const S = f.H / 1.7; // children carry smaller things
  if (HOLD_POSES[kind]) {
    buildHeld(g, kind, material, dark, S, style);
    g.userData.upright = true; // placed by human.build in the held pose
    return g;
  }
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
  } else if (kind === 'Walking stick') {
    // a crook handle over the fist and a stick down to about the ground
    const L = f.hipY * 0.98;
    g.add(new THREE.Mesh(new THREE.TorusGeometry(0.045 * S, 0.013, 4, seg(8, 6), Math.PI), material).translateY(0.02).translateZ(0.03 * S).rotateY(Math.PI / 2));
    g.add(capsuleBetween([0, 0.02, -0.015 * S], [0, -L, -0.015 * S], 0.013, material, 5));
    g.add(capsuleBetween([0, -L + 0.03, -0.015 * S], [0, -L, -0.015 * S], 0.017, dark, 5)); // rubber tip
  }
  g.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), dir);
  g.position.copy(grip);
  return g;
}

/** Items held upright in front of the body; the grip is at the origin. */
function buildHeld(g, kind, material, dark, S, style) {
  const M = (role, c) => style.material(role, c);
  if (kind === 'Umbrella (open)') {
    // shaft up from the fist, a wide shallow canopy over the head
    // the shaft leans back so the canopy is over the head, not the hand
    const top = 0.9 * S, back = -0.3 * S;
    g.add(capsuleBetween([0, -0.08 * S, 0.02 * S], [0, top + 0.05 * S, back], 0.011, dark, 5));
    // a closed cone (shared materials are single-sided; the base shows from below)
    const canopy = new THREE.Mesh(new THREE.ConeGeometry(0.52 * S, 0.2 * S, seg(8, 8)), material);
    canopy.position.set(0, top - 0.06 * S, back);
    g.add(canopy);
    // ribs: a darker rim so the canopy edge reads from above
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.52 * S, 0.012, 3, seg(8, 8)), dark);
    rim.rotation.x = Math.PI / 2;
    rim.position.set(0, top - 0.16 * S, back);
    g.add(rim);
  } else if (kind === 'Phone') {
    // held against the ear (oversized so it reads)
    const ph = new THREE.Mesh(new THREE.BoxGeometry(0.02 * S, 0.11 * S, 0.055 * S), material);
    ph.position.y = 0.03 * S;
    g.add(ph);
  } else if (kind === 'Ice cream') {
    const cone = new THREE.Mesh(new THREE.ConeGeometry(0.03 * S, 0.1 * S, seg(8, 6)), M('accent', 0xd9a35a));
    cone.rotation.x = Math.PI; // point down, in the fist
    cone.position.y = 0.02 * S;
    const scoop = new THREE.Mesh(new THREE.SphereGeometry(0.036 * S, seg(8, 6), seg(6, 4)), material);
    scoop.position.y = 0.085 * S;
    g.add(cone, scoop);
  } else if (kind === 'Coffee cup') {
    // a take-away cup: tapered, a dark lid and a cardboard sleeve
    const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.036 * S, 0.028 * S, 0.12 * S, seg(10, 6)), material);
    cup.position.y = 0.03 * S;
    const lid = new THREE.Mesh(new THREE.CylinderGeometry(0.039 * S, 0.039 * S, 0.015 * S, seg(10, 6)), dark);
    lid.position.y = 0.095 * S;
    const sleeve = new THREE.Mesh(new THREE.CylinderGeometry(0.035 * S, 0.031 * S, 0.045 * S, seg(10, 6)), M('accent', CARDBOARD));
    sleeve.position.y = 0.025 * S;
    g.add(cup, lid, sleeve);
  } else if (kind === 'Boxes') {
    // two cardboard boxes, the smaller one on top, taped across
    const card = M('cloth', CARDBOARD), tape = M('accent', 0xe8dcc0);
    const w = 0.4 * S, h = 0.26 * S, d = 0.3 * S;
    const low = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), card);
    low.position.set(0, 0.02 * S, -0.06 * S);
    const top = new THREE.Mesh(new THREE.BoxGeometry(w * 0.8, h * 0.75, d * 0.85), card);
    top.position.set(0.02 * S, 0.02 * S + h * 0.875, -0.06 * S);
    top.rotation.y = 0.12;
    const t1 = new THREE.Mesh(new THREE.BoxGeometry(w * 0.1, 0.004, d * 1.01), tape);
    t1.position.set(0, 0.02 * S + h / 2 + 0.002, -0.06 * S);
    g.add(low, top, t1);
  }
}
