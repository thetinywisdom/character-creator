import * as THREE from 'three';
import { seg } from '../lib/shapes.js';

// Small helpers shared by all props. Everything in metres; props stand on
// y = 0 and face +z.

export function box(w, h, d, material, pos = [0, 0, 0], rot = null) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
  m.position.set(...pos);
  if (rot) m.rotation.set(...rot);
  return m;
}

/**
 * Large flat slab split into tiles. PS1 vertex snapping distorts huge
 * polygons whose corners are far away (the ground under them shows through),
 * so roads, sidewalks and lawns are built from ~tile-sized pieces.
 */
export function tiledBox(w, h, d, material, pos = [0, 0, 0], tile = 6) {
  const geo = new THREE.BoxGeometry(w, h, d, Math.max(1, Math.ceil(w / tile)), 1, Math.max(1, Math.ceil(d / tile)));
  const m = new THREE.Mesh(geo, material);
  m.position.set(...pos);
  return m;
}

/** Vertical cylinder (or cone when rTop != rBottom). */
export function cyl(rTop, rBottom, h, material, pos = [0, 0, 0], { segments = 12, rot = null, open = false } = {}) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(rTop, rBottom, h, seg(segments, 5), 1, open), material);
  m.position.set(...pos);
  if (rot) m.rotation.set(...rot);
  return m;
}

/** Flat disc (lens, sign, wheel face) facing +z. */
export function disc(r, thickness, material, pos = [0, 0, 0], segments = 14) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, thickness, seg(segments, 6)), material);
  m.rotation.x = Math.PI / 2;
  m.position.set(...pos);
  return m;
}

/** Flat textured plane facing +z (sign faces). */
export function face(w, h, material, pos = [0, 0, 0]) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), material);
  m.position.set(...pos);
  return m;
}

/** Wheel lying on its side (axle along x). */
export function wheel(r, width, material, pos = [0, 0, 0], segments = 12) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, width, seg(segments, 6)), material);
  m.rotation.z = Math.PI / 2;
  m.position.set(...pos);
  return m;
}

export const names = (o) => Object.keys(o);
