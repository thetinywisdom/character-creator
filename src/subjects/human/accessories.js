import * as THREE from 'three';
import { capsuleBetween, ellipsoid, seg, softBox } from '../../lib/shapes.js';

// Back accessories (backpack, wings) and front accessories (fanny pack, ties,
// baby carrier). One item per slot. Built in body space; oversized where small.

export const BACK_ACCESSORIES = ['None', 'Backpack', 'Angel wings', 'Evil wings'];
export const BODY_ACCESSORIES = ['None', 'Fanny pack', 'Neck tie', 'Bow tie', 'Baby carrier'];

/** Front / back surface of the torso at torso-local height y, plus a margin. */
const frontAt = (f, y, extra = 0) => f.torsoR(y) * f.depthAt(y) + extra;
const backAt = (f, y, extra = 0) => -(f.torsoR(y) * f.depthAt(y) + extra);
/** How far the sculpted chest sticks out, so front items sit on top of it. */
const chestOut = (f) => (f.woman ? f.sw * 0.17 * f.chestSize : f.sw * 0.03);

/** Height (torso-local) where the top of the shoulder is, at distance x from the centre. */
function shoulderTop(f, x) {
  const L = f.torsoLen;
  for (let y = L; y > L * 0.5; y -= L * 0.01) if (f.torsoR(y) >= Math.abs(x)) return y;
  return L * 0.85;
}

/** A padded strap through a list of points (torso-local y, absolute x / z). */
function strapPath(f, pts, r, material) {
  const g = new THREE.Group();
  for (let i = 0; i < pts.length - 1; i++) g.add(capsuleBetween(pts[i], pts[i + 1], r, material, 6));
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
    const y = L * 0.56;
    const W = f.sw * 0.68, H = L * 0.56, D = f.sw * 0.3;
    const back = backAt(f, y);
    const z = back - D * 0.5 + f.sw * 0.02;
    const cy = f.hipY + y;
    // padded body with a domed top, thinner at the top than at the bottom
    const body = softBox(W, H, D, mats.back, { round: 0.3, topRound: 0.45, topDepth: 0.75 });
    // no rotation: softBox keeps its +z face full and flat, and +z points at the
    // person's back, so the flat side rests on the back and the top tapers outward
    body.position.set(0, cy, z);
    // rounded front pocket in a darker shade, low on the outer face
    const pocket = softBox(W * 0.72, H * 0.36, D * 0.32, mats.backDark, { round: 0.45 });
    pocket.position.set(0, cy - H * 0.22, z - D * 0.5);
    // zipper line around the top of the main compartment
    const zip = new THREE.Mesh(new THREE.TorusGeometry(W * 0.4, f.armR * 0.07, 3, seg(16, 8), Math.PI), mats.trim);
    zip.scale.set(1, 0.9, 1);
    zip.rotation.y = Math.PI / 2; // arc runs front-to-back over the top
    zip.position.set(0, cy + H * 0.05, z);
    // top carry handle
    const handle = new THREE.Mesh(new THREE.TorusGeometry(W * 0.13, f.armR * 0.12, 4, seg(10, 6), Math.PI), mats.trim);
    handle.position.set(0, cy + H * 0.5, z + D * 0.15);
    g.add(body, pocket, zip, handle);

    // shoulder straps: top of the pack -> over the shoulder -> down the chest
    // -> under the arm -> bottom of the pack; plus a chest strap between them
    const r = f.armR * 0.32;
    const out = f.woman ? f.sw * 0.17 * f.chestSize * 0.5 : f.sw * 0.02;
    for (const sx of [-1, 1]) {
      const x = sx * f.sw * 0.2;
      const top = shoulderTop(f, x);
      const side = sx * f.torsoR(L * 0.45) * 1.02;
      g.add(strapPath(f, [
        [x * 0.9, cy + H * 0.38, back - 0.004],
        [x, f.hipY + top + r * 0.6, 0],
        [x, f.hipY + L * 0.78, frontAt(f, L * 0.78, out + r)],
        [x * 1.05, f.hipY + L * 0.5, frontAt(f, L * 0.5, r * 0.8)],
        [side, f.hipY + L * 0.38, 0],
        [x * 1.2, cy - H * 0.42, back - 0.004],
      ], r, mats.trim));
    }
    const chestY = L * 0.68;
    g.add(capsuleBetween(
      [-f.sw * 0.2, f.hipY + chestY, frontAt(f, chestY, out + r * 1.6)],
      [f.sw * 0.2, f.hipY + chestY, frontAt(f, chestY, out + r * 1.6)], r * 0.55, mats.trim, 5));
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
    belt.scale.y = f.depthAt(y); // torus lies flat; its local y is world z
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
    const y = L * 0.52;
    const W = f.sw * 0.62, H = L * 0.44, D = f.sw * 0.3;
    const out = f.woman ? f.sw * 0.17 * f.chestSize * 0.7 : f.sw * 0.03;
    const z = frontAt(f, y, out + D * 0.28);
    const cy = f.hipY + y;
    // soft padded panel, wider at the seat (bottom) than at the top
    const panel = softBox(W, H, D, m, { round: 0.4, topRound: 0.15 });
    const pos = panel.geometry.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const t = (pos.getY(i) + H / 2) / H; // 0 at the bottom, 1 at the top
      pos.setX(i, pos.getX(i) * THREE.MathUtils.lerp(1.1, 0.82, t));
    }
    panel.geometry.computeVertexNormals();
    panel.position.set(0, cy, z);
    g.add(panel);

    // the baby: body inside the carrier, head above it, little legs dangling
    const babyR = f.R * 0.62;
    g.add(ellipsoid(babyR * 1.15, [1, 1.05, 0.85], mats.babyCloth, { position: [0, cy + H * 0.36, z], segments: 12 }));
    g.add(ellipsoid(babyR, [1, 1, 1], mats.skin, { position: [0, cy + H * 0.5 + babyR * 0.75, z + D * 0.05], segments: 14 }));
    for (const sx of [-1, 1]) {
      const hip = [sx * W * 0.42, cy - H * 0.3, z + D * 0.15];
      const foot = [sx * W * 0.62, cy - H * 0.62, z + D * 0.35];
      g.add(capsuleBetween(hip, foot, babyR * 0.32, mats.babyCloth, 8));
      g.add(ellipsoid(babyR * 0.3, [1, 0.8, 1.3], mats.skin, { position: [foot[0], foot[1] - babyR * 0.2, foot[2] + babyR * 0.1], segments: 8 }));
      // tiny hands resting on the top edge of the panel
      g.add(ellipsoid(babyR * 0.26, [1, 1, 1], mats.skin, { position: [sx * W * 0.3, cy + H * 0.47, z + D * 0.4], segments: 8 }));
    }

    // thick waist belt and shoulder straps over to the back
    const beltY = L * 0.14;
    const belt = new THREE.Mesh(new THREE.TorusGeometry(f.torsoR(beltY) + f.sw * 0.03, f.armR * 0.45, seg(5, 4), seg(18, 10)), m);
    belt.rotation.x = Math.PI / 2;
    belt.scale.y = f.depthAt(beltY);
    belt.position.y = f.hipY + beltY;
    g.add(belt);
    const r = f.armR * 0.36;
    for (const sx of [-1, 1]) {
      const x = sx * f.sw * 0.22;
      const top = shoulderTop(f, x);
      g.add(strapPath(f, [
        [sx * W * 0.38, cy + H * 0.4, z - D * 0.2],
        [x, f.hipY + top + r * 0.6, 0],
        [x * 0.6, f.hipY + L * 0.6, backAt(f, L * 0.6, r)],
        [x * 0.9, f.hipY + beltY, backAt(f, beltY, f.sw * 0.03)],
      ], r, m));
    }
  }
  return g;
}
