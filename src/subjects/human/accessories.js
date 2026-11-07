import * as THREE from 'three';
import { capsuleBetween, ellipsoid, seg } from '../../lib/shapes.js';

// Back accessories (backpack, wings) and front accessories (fanny pack, ties,
// baby carrier). One item per slot. Built in body space; oversized where small.

export const BACK_ACCESSORIES = ['None', 'Backpack', 'Angel wings', 'Evil wings'];
export const BODY_ACCESSORIES = ['None', 'Fanny pack', 'Neck tie', 'Bow tie', 'Baby carrier'];

/** Front / back surface of the torso at torso-local height y, plus a margin. */
const frontAt = (f, y, extra = 0) => f.torsoR(y) * f.torsoDepth + extra;
const backAt = (f, y, extra = 0) => -(f.torsoR(y) * f.torsoDepth + extra);
/** How far the sculpted chest sticks out, so front items sit on top of it. */
const chestOut = (f) => (f.woman ? f.sw * 0.17 * f.chestSize : f.sw * 0.03);

/** Straps from the back, over the shoulder, to the front. */
function straps(f, material, frontY, backY, x0) {
  const g = new THREE.Group();
  const L = f.torsoLen;
  for (const sx of [-1, 1]) {
    const x = sx * x0;
    const back = [x, f.hipY + backY, backAt(f, backY, 0.01)];
    const over = [x, f.shoulderY - L * 0.04, 0];
    const front = [x, f.hipY + frontY, frontAt(f, frontY, chestOut(f) * 0.6)];
    g.add(capsuleBetween(back, over, f.armR * 0.28, material, 5));
    g.add(capsuleBetween(over, front, f.armR * 0.28, material, 5));
  }
  return g;
}

// ---------------------------------------------------------------------------
/** A wing as a flat, two-sided fan of triangles from the root outward. */
function fanGeometry(points) {
  const pos = [];
  for (let i = 1; i < points.length - 1; i++) {
    const a = [0, 0, 0], b = points[i], c = points[i + 1];
    pos.push(...a, ...b, ...c, ...a, ...c, ...b); // both windings: visible from both sides
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.computeVertexNormals();
  return geo;
}

function buildWings(f, kind, mats) {
  const g = new THREE.Group();
  const L = f.torsoLen;
  const span = f.sw * 1.6; // big on purpose: wings are a silhouette item
  const y = L * 0.78;
  for (const sx of [-1, 1]) {
    const wing = new THREE.Group();
    wing.position.set(sx * f.sw * 0.12, f.hipY + y, backAt(f, y, f.sw * 0.04));
    wing.rotation.y = sx * 0.35; // swept back a little
    if (kind === 'Angel wings') {
      // four layers of broad feathers, fanned from up-and-out to down-and-out
      const feathers = [[1.15, 0.85], [1.0, 0.5], [0.82, 0.15], [0.62, -0.2]];
      for (const [len, angle] of feathers) {
        const feather = ellipsoid(1, [span * len * 0.5, span * 0.17, span * 0.04], mats.wings, { segments: 10 });
        const a = angle;
        feather.position.set(sx * Math.cos(a) * span * len * 0.48, Math.sin(a) * span * len * 0.48, 0);
        feather.rotation.z = sx * a;
        wing.add(feather);
      }
    } else {
      // bat wing: a bony top edge and a scalloped membrane
      const tip = [sx * span, span * 0.55, 0];
      const pts = [[0, 0, 0], tip,
        [sx * span * 0.85, span * 0.05, 0], [sx * span * 0.62, span * 0.12, 0],
        [sx * span * 0.45, -span * 0.12, 0], [sx * span * 0.25, -span * 0.02, 0],
        [sx * span * 0.08, -span * 0.25, 0]];
      wing.add(new THREE.Mesh(fanGeometry(pts), mats.wings));
      wing.add(capsuleBetween([0, 0, 0], tip, f.armR * 0.35, mats.wings, 5));
    }
    g.add(wing);
  }
  return g;
}

export function buildBackAccessory(f, kind, mats) {
  const g = new THREE.Group();
  g.name = 'backAccessory';
  const L = f.torsoLen;
  if (kind === 'Backpack') {
    const y = L * 0.55;
    const W = f.sw * 0.7, H = L * 0.5, D = f.sw * 0.34;
    const bag = new THREE.Mesh(new THREE.BoxGeometry(W, H, D), mats.back);
    bag.position.set(0, f.hipY + y, backAt(f, y, D * 0.45));
    const flap = new THREE.Mesh(new THREE.BoxGeometry(W * 1.02, H * 0.28, D * 1.04), mats.trim);
    flap.position.set(0, bag.position.y + H * 0.36, bag.position.z);
    const pocket = new THREE.Mesh(new THREE.BoxGeometry(W * 0.6, H * 0.3, D * 0.3), mats.back);
    pocket.position.set(0, bag.position.y - H * 0.18, bag.position.z - D * 0.6);
    g.add(bag, flap, pocket, straps(f, mats.trim, L * 0.6, L * 0.75, f.sw * 0.2));
  } else if (kind === 'Angel wings' || kind === 'Evil wings') {
    g.add(buildWings(f, kind, mats));
  }
  return g;
}

// ---------------------------------------------------------------------------
export function buildBodyAccessory(f, kind, mats) {
  const g = new THREE.Group();
  g.name = 'bodyAccessory';
  const L = f.torsoLen;
  const m = mats.bodyAcc;
  if (kind === 'Fanny pack') {
    const y = L * 0.06;
    const pack = new THREE.Mesh(new THREE.BoxGeometry(f.sw * 0.5, L * 0.13, f.sw * 0.18), m);
    pack.position.set(0, f.hipY + y, frontAt(f, y, f.sw * 0.08));
    const belt = new THREE.Mesh(new THREE.TorusGeometry(f.torsoR(y) * 1.06, f.armR * 0.2, seg(4, 3), seg(18, 10)), mats.trim);
    belt.rotation.x = Math.PI / 2;
    belt.scale.y = f.torsoDepth; // torus lies flat; its local y is world z
    belt.position.y = f.hipY + y;
    g.add(pack, belt);
  } else if (kind === 'Neck tie') {
    const z = Math.max(frontAt(f, L * 0.9), frontAt(f, L * 0.6)) + chestOut(f) * 0.9 + 0.006;
    const knot = new THREE.Mesh(new THREE.BoxGeometry(f.sw * 0.11, L * 0.07, f.sw * 0.06), m);
    knot.position.set(0, f.shoulderY - L * 0.05, frontAt(f, L * 0.95, 0.006));
    const blade = new THREE.Mesh(new THREE.BoxGeometry(f.sw * 0.13, L * 0.42, f.sw * 0.03), m);
    blade.position.set(0, f.shoulderY - L * 0.3, z);
    const tip = new THREE.Mesh(new THREE.BoxGeometry(f.sw * 0.093, f.sw * 0.093, f.sw * 0.03), m);
    tip.rotation.z = Math.PI / 4;
    tip.position.set(0, f.shoulderY - L * 0.51, z);
    g.add(knot, blade, tip);
  } else if (kind === 'Bow tie') {
    const y = f.shoulderY - L * 0.04;
    const z = frontAt(f, L * 0.96, 0.012);
    for (const sx of [-1, 1]) {
      const wing = new THREE.Mesh(new THREE.ConeGeometry(f.sw * 0.08, f.sw * 0.16, 3), m);
      wing.rotation.z = sx * Math.PI / 2; // points toward the knot
      wing.position.set(sx * f.sw * 0.08, y, z);
      wing.scale.z = 0.5;
      g.add(wing);
    }
    const knot = new THREE.Mesh(new THREE.BoxGeometry(f.sw * 0.05, f.sw * 0.06, f.sw * 0.05), m);
    knot.position.set(0, y, z + 0.004);
    g.add(knot);
  } else if (kind === 'Baby carrier') {
    const y = L * 0.5;
    const W = f.sw * 0.6, H = L * 0.4, D = f.sw * 0.32;
    const z = frontAt(f, y, chestOut(f) * 0.6 + D * 0.5);
    const pouch = new THREE.Mesh(new THREE.BoxGeometry(W, H, D), m);
    pouch.position.set(0, f.hipY + y, z);
    // the baby: just a round head peeking out of the top
    const babyR = f.R * 0.6;
    const baby = ellipsoid(babyR, [1, 1, 1], mats.skin, { position: [0, f.hipY + y + H * 0.5 + babyR * 0.55, z], segments: 14 });
    g.add(pouch, baby, straps(f, m, L * 0.62, L * 0.6, f.sw * 0.22));
  }
  return g;
}
