import * as THREE from 'three';
import { capsuleBetween, ellipsoid, seg, softBox } from '../../lib/shapes.js';
import { ribbon, torsoSurface } from './tops.js';

// Back accessories (backpack, wings) and front accessories (fanny pack, ties,
// baby carrier). One item per slot. Built in body space; oversized where small.

export const BACK_ACCESSORIES = ['None', 'Backpack', 'Angel wings', 'Evil wings'];
export const BODY_ACCESSORIES = ['None', 'Fanny pack', 'Neck tie', 'Bow tie', 'Baby carrier', 'Apron'];

/**
 * Front / back surface of the sculpted torso at torso-local height y (and
 * across-offset x), plus a margin: measured on the real body shape, so straps
 * and ties lie on the chest and back instead of floating in front of them.
 */
const frontAt = (f, y, extra = 0, x = 0) => torsoSurface(f).front(x, y) + extra;
const backAt = (f, y, extra = 0, x = 0) => torsoSurface(f).back(x, y) - extra;

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
    wing.name = sx < 0 ? 'wingL' : 'wingR'; // animated: a slow, gentle flap (anim/gait.js)
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
    // rests on the furthest-back point of the back over its height
    const surf = torsoSurface(f);
    const back = Math.min(...[-0.35, 0, 0.35].map((k) => surf.backMin(y - H * 0.45, y + H * 0.45, W * k)));
    const z = back - D * 0.5 + f.sw * 0.015;
    const cy = f.hipY + y;
    // padded body with a domed top, thinner at the top than at the bottom
    const body = softBox(W, H, D, mats.back, { round: 0.3, topRound: 0.45, topDepth: 0.75 });
    // no rotation: softBox keeps its +z face full and flat, and +z points at the
    // person's back, so the flat side rests on the back and the top tapers outward
    body.position.set(0, cy, z);
    // rounded front pocket in a darker shade, low on the outer face
    const pocket = softBox(W * 0.72, H * 0.36, D * 0.32, mats.backDark, { round: 0.45 });
    pocket.position.set(0, cy - H * 0.22, z - D * 0.5);
    // top carry handle
    const handle = new THREE.Mesh(new THREE.TorusGeometry(W * 0.13, f.armR * 0.12, 4, seg(10, 6), Math.PI), mats.trim);
    handle.position.set(0, cy + H * 0.5, z + D * 0.15);
    g.add(body, pocket, handle);

    // shoulder straps: top of the pack -> over the shoulder -> down the chest
    // -> under the arm -> bottom of the pack; plus a chest strap between them
    const r = f.armR * 0.32;
    for (const sx of [-1, 1]) {
      const x = sx * f.sw * 0.2;
      const top = shoulderTop(f, x);
      const side = (y) => sx * f.torsoR(y) * 0.98;
      // over the shoulder, flat down the chest, round under the arm, and back
      // to the bottom of the pack: every point is on the body surface
      const pts = [[x * 0.9, cy + H * 0.36, back - 0.004]];
      for (const k of [0.92, 0.97]) pts.push([x, f.hipY + L * k, backAt(f, L * k, r, x)]);
      pts.push([x, f.hipY + top + r * 0.7, 0]);
      for (const k of [0.95, 0.88, 0.8, 0.72, 0.62, 0.54]) pts.push([x * (1 + (0.95 - k) * 0.25), f.hipY + L * k, frontAt(f, L * k, r, x)]);
      const yu = L * 0.44;
      pts.push([(x + side(yu)) * 0.5, f.hipY + yu, frontAt(f, yu, r * 0.8, (x + side(yu)) * 0.5)]);
      pts.push([side(L * 0.4) * 1.04, f.hipY + L * 0.4, 0]);
      pts.push([x * 1.2, cy - H * 0.42, back - 0.004]);
      g.add(strapPath(f, pts, r, mats.trim));
    }
    // chest strap, lying on the strap fronts
    const chestY = L * 0.72;
    const zc = Math.max(frontAt(f, chestY, 0, f.sw * 0.2), frontAt(f, chestY, 0, -f.sw * 0.2), frontAt(f, chestY)) + r * 1.6;
    g.add(capsuleBetween([-f.sw * 0.2, f.hipY + chestY, zc], [f.sw * 0.2, f.hipY + chestY, zc], r * 0.55, mats.trim, 5));
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
    pack.position.set(0, f.hipY + y, frontAt(f, y, f.sw * 0.09));
    const belt = new THREE.Mesh(new THREE.TorusGeometry(f.torsoR(y) * 1.06, f.armR * 0.2, seg(4, 3), seg(18, 10)), mats.trim);
    belt.rotation.x = Math.PI / 2;
    belt.scale.y = f.depthAt(y); // torus lies flat; its local y is world z
    belt.position.y = f.hipY + y;
    g.add(pack, belt);
  } else if (kind === 'Neck tie') {
    // The blade hangs from the knot and drapes over the chest: at each height
    // it is as far forward as the body anywhere above it, so it lies on the
    // shirt and falls straight down off a bust instead of cutting into it.
    const surf = torsoSurface(f);
    const knotY = L * 0.94;
    const knot = new THREE.Mesh(new THREE.BoxGeometry(f.sw * 0.11, L * 0.07, f.sw * 0.06), m);
    knot.position.set(0, f.hipY + knotY, surf.front(0, knotY) + f.sw * 0.02);
    const samples = [];
    let zMax = -Infinity;
    const y0 = L * 0.92, y1 = L * 0.4, n = 14;
    for (let i = 0; i <= n; i++) {
      const y = THREE.MathUtils.lerp(y0, y1, i / n);
      zMax = Math.max(zMax, surf.front(0, y));
      const w = f.sw * THREE.MathUtils.lerp(0.08, 0.14, i / n);
      samples.push({ y: f.hipY + y, z: zMax + 0.001, w });
    }
    const tip = L * 0.07; // pointed end
    samples.push({ y: f.hipY + y1 - tip, z: zMax + 0.001, w: f.sw * 0.01 });
    g.add(knot, ribbon(samples, f.sw * 0.025, m));
  } else if (kind === 'Apron') {
    // a bib apron: on the chest, tied at the waist, hanging to mid thigh
    const surf = torsoSurface(f);
    const waist = L * 0.36;
    const samples = [];
    let zHang = -Infinity;
    for (let i = 0; i <= 20; i++) {
      const y = THREE.MathUtils.lerp(L * 0.8, -f.legLen * 0.32, i / 20);
      let z;
      if (y >= waist) z = surf.front(0, y);
      else {
        // below the ties it hangs: as far forward as the belly / hips below
        zHang = Math.max(zHang, surf.front(0, Math.max(y, f.torsoBottom + 0.001)));
        z = zHang + f.sw * 0.02;
      }
      const w = y >= waist ? f.sw * 0.44 : f.hw * 0.95;
      samples.push({ y: f.hipY + y, z: z + 0.002, w });
    }
    g.add(ribbon(samples, f.sw * 0.015, m));
    // neck strap and waist ties
    const r = f.armR * 0.18;
    const topZ = surf.front(0, L * 0.8) + 0.004;
    for (const sx of [-1, 1]) {
      g.add(capsuleBetween([sx * f.sw * 0.2, f.hipY + L * 0.8, topZ], [sx * f.neckR * 1.15, f.shoulderY + f.neckLen * 0.2, 0], r, m, 5));
    }
    const belt = new THREE.Mesh(new THREE.TorusGeometry(f.torsoR(waist) * 1.03, r, 4, seg(18, 10)), m);
    belt.rotation.x = Math.PI / 2;
    belt.scale.y = f.depthAt(waist);
    belt.position.y = f.hipY + waist;
    g.add(belt);
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
    // the back of the panel rests on the furthest-forward point of the body
    const surf = torsoSurface(f);
    const zBody = Math.max(...[-0.3, 0, 0.3].map((k) => surf.frontMax(y - H * 0.45, y + H * 0.45, W * k)));
    const z = zBody + D * 0.5 - f.sw * 0.02;
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
        [sx * W * 0.38, cy + H * 0.4, z - D * 0.3],
        [x, f.hipY + L * 0.9, frontAt(f, L * 0.9, r, x)],
        [x, f.hipY + top + r * 0.6, 0],
        [x * 0.85, f.hipY + L * 0.9, backAt(f, L * 0.9, r, x * 0.85)],
        [x * 0.6, f.hipY + L * 0.6, backAt(f, L * 0.6, r, x * 0.6)],
        [x * 0.9, f.hipY + beltY, backAt(f, beltY, f.sw * 0.03, x * 0.9)],
      ], r, m));
    }
  }
  return g;
}
