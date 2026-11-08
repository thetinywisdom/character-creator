import * as THREE from 'three';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { seg } from '../../lib/shapes.js';

// The head: a sphere reshaped into a head (fuller skull at the back, flatter
// face plane and forehead, a jaw that narrows to the chin, the back of the
// lower head tucking in toward the neck), then scaled by the head radii.
//
// Hair, beards and masks are "shells" grown from this same shape: a region of
// the head surface pushed outward by a thickness that can vary over the head.
// Because they follow the head exactly, nothing pokes through and nothing
// floats, and a thickness that tapers to almost zero at the edge makes hair
// blend into the scalp instead of sitting on it like a cap.
//
// Directions: d is a point on the unit sphere before reshaping; +z is the
// face, +y the top of the head. Helpers below give the angle round the head
// (az: 0 = front, ±π = back) and the height (d.y, -1 chin .. 1 crown).

const smooth = (a, b, t) => {
  const x = Math.min(1, Math.max(0, (t - a) / (b - a)));
  return x * x * (3 - 2 * x);
};

/** Unit-sphere point -> head-shaped point (about unit size). */
export function shapeHead(x, y, z) {
  let X = x, Y = y, Z = z;
  const low = smooth(0.05, -0.9, y);    // 0 above the cheekbones, 1 at the chin
  X *= 1 - 0.3 * low;                   // jaw narrows toward the chin
  if (z < 0) Z *= 1 - 0.38 * low;        // back of the lower head tucks in to the neck
  if (z < 0) Z *= 1 + 0.12 * smooth(-0.3, 0.45, y); // fuller skull at the back
  if (z > 0 && y > -0.65 && y < 0.55) Z = Math.min(Z, 0.9); // flatter face plane
  if (z > 0 && y >= 0.55) Z *= 0.95;     // slightly flatter forehead
  if (z > 0 && y < -0.6) Z += 0.06 * smooth(-0.6, -1, y); // chin forward a touch
  if (y > 0) Y *= 1 - 0.05 * y;          // a little flatter on top
  X *= 0.97;                             // slightly flatter sides
  return [X, Y, Z];
}

/**
 * Sphere for the head (enough segments to shape a jaw) or, finer, for the
 * shells grown from it: a finer mesh gives smoother hairlines, and its
 * vertices lie on the true head surface, so it always sits just outside the
 * coarser head.
 */
function sphereGeo(fine = false) {
  const g = fine
    ? new THREE.SphereGeometry(1, seg(44, 28), seg(30, 20))
    : new THREE.SphereGeometry(1, seg(28, 16), seg(20, 12));
  g.deleteAttribute('uv');
  g.deleteAttribute('normal');
  return mergeVertices(g, 1e-5);
}

/** Head geometry in head-local space (scaled by the head radii). */
export function headGeometry(f, fine = false) {
  const g = sphereGeo(fine);
  const pos = g.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const [x, y, z] = shapeHead(pos.getX(i), pos.getY(i), pos.getZ(i));
    pos.setXYZ(i, x * f.rx, y * f.ry, z * f.rz);
  }
  g.computeVertexNormals();
  return g;
}

/** Angle round the head: 0 straight ahead, ±π at the back. */
export const azimuth = (d) => Math.atan2(d.x, d.z);

/**
 * A shell grown from part of the head surface.
 *  include(d)   -> true for directions the shell covers
 *  thickness(d) -> outward offset in metres at direction d
 */
export function headShell(f, include, thickness) {
  const g = headGeometry(f, true);
  const pos = g.attributes.position;
  const nrm = g.attributes.normal;
  const sphere = sphereGeo(true).attributes.position; // same topology: the unit directions
  const dirs = [];
  const d = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    d.fromBufferAttribute(sphere, i);
    dirs.push(d.clone());
    const t = thickness(d);
    pos.setXYZ(i, pos.getX(i) + nrm.getX(i) * t, pos.getY(i) + nrm.getY(i) * t, pos.getZ(i) + nrm.getZ(i) * t);
  }
  // keep only the triangles whose centre is inside the covered region
  const idx = g.index.array;
  const keep = [];
  const c = new THREE.Vector3();
  for (let k = 0; k < idx.length; k += 3) {
    c.copy(dirs[idx[k]]).add(dirs[idx[k + 1]]).add(dirs[idx[k + 2]]).normalize();
    if (include(c)) keep.push(idx[k], idx[k + 1], idx[k + 2]);
  }
  g.setIndex(keep);
  g.computeVertexNormals();
  return g;
}

/**
 * Hairline as a height threshold that varies round the head:
 * front (forehead), temple, side (over the ear) and back (nape).
 * Returns how far above the hairline direction d is (negative = below).
 */
export function aboveHairline(d, [front, temple, side, back], asym = 0) {
  const a = Math.abs(azimuth(d));
  const keys = [[0, front], [0.95, temple], [1.75, side], [Math.PI, back]];
  let h = back;
  for (let i = 0; i < keys.length - 1; i++) {
    if (a <= keys[i + 1][0]) {
      const t = smooth(keys[i][0], keys[i + 1][0], a);
      h = keys[i][1] + (keys[i + 1][1] - keys[i][1]) * t;
      break;
    }
  }
  // asymmetry: lower the hairline on one side (a side parting)
  h -= asym * Math.max(0, d.x) * smooth(1.6, 0, a);
  return d.y - h;
}

export { smooth };
