import * as THREE from 'three';
import { seg } from './shapes.js';

// Shared pieces for trees, bushes and hedges. Vertex colours are greyscale
// only, so they darken the existing palette colour instead of shifting its hue.
// One clone per source material keeps the PS1 snap shader and lets the city
// merge every shrub of that colour into one mesh.

const shaded = new Map();
const UP = new THREE.Vector3(0, 1, 0);

/** Lambert clone of a style material with vertex colours and the PS1 snap. */
export function shadeMaterial(source) {
  let m = shaded.get(source);
  if (m) return m;
  m = source.clone();
  m.vertexColors = true;
  if (source.onBeforeCompile) m.onBeforeCompile = source.onBeforeCompile;
  m.customProgramCacheKey = () => 'ps1-snap-vc';
  m.userData.role = source.userData.role;
  m.userData.keepAttributes = ['color'];
  shaded.set(source, m);
  return m;
}

/**
 * Value bands from the face normal (light top, darker underside) plus a little
 * of the shape's own height, so a vertical face still reads lighter above.
 */
export function paintBands(geo, { hi = 1, mid = 0.84, lo = 0.64, height = 0.4 } = {}) {
  const g = geo.index ? geo.toNonIndexed() : geo;
  if (g !== geo) geo.dispose();
  g.deleteAttribute('normal');
  g.computeVertexNormals();
  const pos = g.attributes.position;
  const nrm = g.attributes.normal;
  let minY = Infinity, maxY = -Infinity;
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i);
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }
  const span = Math.max(0.001, maxY - minY);
  const col = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i += 3) {
    const ny = (nrm.getY(i) + nrm.getY(i + 1) + nrm.getY(i + 2)) / 3;
    const face = ny > 0.32 ? hi : ny < -0.22 ? lo : mid;
    for (let k = 0; k < 3; k++) {
      const y01 = (pos.getY(i + k) - minY) / span;
      const v = face * (1 - height) + (lo + (hi - lo) * y01) * height;
      col[(i + k) * 3] = col[(i + k) * 3 + 1] = col[(i + k) * 3 + 2] = v;
    }
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return g;
}

/**
 * A flat leaf, leaflet or frond: a diamond, drawn on both sides, wider at the
 * middle and lighter at the tip. `width` is the half-width. Kept chunky so a
 * frond still reads when the whole tree is small.
 */
export function frond(material, from, to, width) {
  const O = new THREE.Vector3(...from);
  const T = new THREE.Vector3(...to);
  const dir = T.clone().sub(O);
  if (dir.lengthSq() < 1e-8) dir.set(0, 1, 0);
  dir.normalize();
  const side = new THREE.Vector3(-dir.z, 0, dir.x);
  if (side.lengthSq() < 1e-8) side.set(1, 0, 0);
  side.normalize();
  const mid = O.clone().lerp(T, 0.45);
  const left = mid.clone().addScaledVector(side, width);
  const right = mid.clone().addScaledVector(side, -width);
  const geo = new THREE.BufferGeometry();
  const pos = [];
  const col = [];
  const shade = (p) => (p === T ? 1 : p === O ? 0.7 : 0.86);
  for (const tri of [[O, left, T], [O, T, right], [O, T, left], [O, right, T]]) {
    for (const p of tri) {
      pos.push(p.x, p.y, p.z);
      const s = shade(p);
      col.push(s, s, s);
    }
  }
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  geo.computeVertexNormals();
  return new THREE.Mesh(geo, material);
}

/** Bake a mesh's transform into its geometry and return a new identity mesh. */
function baked(mesh, material, paint) {
  mesh.updateMatrix();
  const geo = mesh.geometry;
  geo.applyMatrix4(mesh.matrix);
  const out = new THREE.Mesh(paint(geo), material);
  return out;
}

/** Flat greyscale vertex colour, for a node ring that should read lighter than the culm. */
function paintFlat(geo, v) {
  const g = geo.index ? geo.toNonIndexed() : geo;
  if (g !== geo) geo.dispose();
  if (!g.attributes.normal) g.computeVertexNormals();
  const col = new Float32Array(g.attributes.position.count * 3);
  col.fill(v);
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return g;
}

/** Tapered branch or culm from a (radius r1) to b (radius r2). */
export function tapered(a, b, r1, r2, material, radial = 14, { open = false, flat = null } = {}) {
  const A = new THREE.Vector3(...a);
  const B = new THREE.Vector3(...b);
  const dir = B.clone().sub(A);
  const length = Math.max(dir.length(), 1e-4);
  const geo = new THREE.CylinderGeometry(Math.max(r2, 1e-4), Math.max(r1, 1e-4), length, seg(radial, 4), 1, open);
  const mesh = new THREE.Mesh(geo, material);
  mesh.position.copy(A).add(B).multiplyScalar(0.5);
  if (dir.lengthSq() > 1e-8) mesh.quaternion.setFromUnitVectors(UP, dir.normalize());
  const paint = flat == null
    ? (g) => paintBands(g, { hi: 1, mid: 0.9, lo: 0.74, height: 0.25 })
    : (g) => paintFlat(g, flat);
  return baked(mesh, material, paint);
}

/**
 * One faceted canopy lobe. `rng` only picks the lump and the tilt, so the same
 * seed always rebuilds the same shrub and two seeds do not match.
 */
export function lobe(material, radius, rng, position, { scale = [1, 0.8, 1], kind = 'ico' } = {}) {
  const geo = kind === 'oct'
    ? new THREE.OctahedronGeometry(radius, 0)
    : new THREE.IcosahedronGeometry(radius, 0);
  const pos = geo.attributes.position;
  const twist = rng() * Math.PI * 2;
  const amp = 0.07 + rng() * 0.1;
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const len = v.length() || 1;
    v.multiplyScalar(1 / len);
    const wob = Math.sin(v.x * 4.1 + twist) * Math.cos(v.z * 3.4 - twist) * Math.sin(v.y * 4.7 + twist * 0.5);
    v.multiplyScalar(radius * (1 + amp * wob));
    v.x *= scale[0];
    v.y *= scale[1];
    v.z *= scale[2];
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  pos.needsUpdate = true;
  const mesh = new THREE.Mesh(geo, material);
  mesh.position.set(position[0], position[1], position[2]);
  mesh.rotation.set((rng() - 0.5) * 0.45, rng() * Math.PI * 2, (rng() - 0.5) * 0.45);
  return baked(mesh, material, (g) => paintBands(g));
}

/**
 * Upright trunk: wider at the ground, a slight bend and an uneven section so
 * it is not a perfect pole. Sits on y = 0.
 */
export function uprightTrunk(height, rBottom, rTop, material, rng) {
  const geo = new THREE.CylinderGeometry(rTop, rBottom, height, seg(16, 5), 3, false);
  const pos = geo.attributes.position;
  const twist = rng() * Math.PI * 2;
  const bend = (rng() - 0.5) * rBottom * 0.65;
  const bendZ = (rng() - 0.5) * rBottom * 0.45;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    const rad = Math.hypot(x, z);
    const t = y / height + 0.5;
    const ang = Math.atan2(z, x);
    const k = rad < 1e-5 ? 1 : 1 + Math.sin(ang * 2 + twist) * 0.07 + Math.sin(ang * 3 - twist) * 0.035;
    const ox = Math.sin(t * Math.PI) * bend;
    const oz = Math.sin(t * Math.PI) * bendZ;
    pos.setXYZ(i, x * k + ox, y, z * k + oz);
  }
  pos.needsUpdate = true;
  const mesh = new THREE.Mesh(paintBands(geo, { hi: 1, mid: 0.9, lo: 0.76, height: 0.3 }), material);
  mesh.position.y = height / 2;
  mesh.name = 'trunk';
  return mesh;
}

/**
 * A trimmed hedge: still a long low block of the same outer size, but the
 * sides lean in and the top is clipped in a regular rhythm instead of one box.
 * Mesh is centred on its own origin (caller puts y at height / 2).
 */
export function trimmedHedge(length, height, depth, material) {
  const segX = Math.max(2, Math.min(7, Math.round(length / 0.95)));
  const geo = new THREE.BoxGeometry(length, height, depth, segX, 2, 1);
  const pos = geo.attributes.position;
  const dip = Math.min(0.15, height * 0.17);
  for (let i = 0; i < pos.count; i++) {
    let x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    const yn = y / (height / 2);
    // upper half draws in, so the top reads as a cut rather than a wall
    z *= 1 - 0.2 * Math.max(0, yn);
    if (yn > 0.45) {
      const u = (x / length + 0.5) * segX * Math.PI;
      const notch = (0.5 - 0.5 * Math.cos(u)) * dip;
      y -= notch * ((yn - 0.45) / 0.55);
    }
    pos.setXYZ(i, x, y, z);
  }
  pos.needsUpdate = true;
  return new THREE.Mesh(paintBands(geo, { hi: 1, mid: 0.8, lo: 0.62, height: 0.5 }), material);
}
