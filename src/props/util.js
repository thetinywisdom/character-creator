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
