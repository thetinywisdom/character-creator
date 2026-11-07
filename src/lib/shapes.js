import * as THREE from 'three';

// Shared building blocks for procedural, primitive-based models.
// Every subject is assembled from these so a style can later swap
// materials (or add outlines) without touching the subject code.

const UP = new THREE.Vector3(0, 1, 0);

// Geometry detail multiplier, set by the active style while a subject builds
// (low-poly uses a fraction, clay uses extra). Subjects wrap every segment
// count in seg() so they never need to know which style they are built for.
let detail = 1;
export function setDetail(d) { detail = d; }
export function seg(n, min = 3) { return Math.max(min, Math.round(n * detail)); }

/** Sphere of radius `r`, then stretched by `scale` = [sx, sy, sz]. */
export function ellipsoid(r, scale, material, { position, rotation, segments = 32 } = {}) {
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(r, seg(segments), seg(segments * 0.66, 2)), material);
  if (scale) mesh.scale.set(...scale);
  if (position) mesh.position.set(...position);
  if (rotation) mesh.rotation.set(...rotation);
  return mesh;
}

/** Capsule (rounded cylinder) whose end-cap centres sit on points a and b. */
export function capsuleBetween(a, b, radius, material, radialSegments = 16) {
  const A = new THREE.Vector3(...a);
  const B = new THREE.Vector3(...b);
  const dir = B.clone().sub(A);
  const length = dir.length();
  const geo = new THREE.CapsuleGeometry(radius, Math.max(length, 1e-4), seg(8, 1), seg(radialSegments, 4));
  const mesh = new THREE.Mesh(geo, material);
  mesh.position.copy(A).add(B).multiplyScalar(0.5);
  if (length > 1e-6) mesh.quaternion.setFromUnitVectors(UP, dir.normalize());
  return mesh;
}

/**
 * Tapered limb segment from a (radius r1) to b (radius r2): a cone-like
 * cylinder with a ball at each end, so joints stay rounded.
 */
export function taperBetween(a, b, r1, r2, material, radialSegments = 14) {
  const A = new THREE.Vector3(...a);
  const B = new THREE.Vector3(...b);
  const dir = B.clone().sub(A);
  const length = Math.max(dir.length(), 1e-4);
  const g = new THREE.Group();
  // CylinderGeometry runs from +y (radiusTop) to -y (radiusBottom)
  const cyl = new THREE.Mesh(new THREE.CylinderGeometry(r2, r1, length, seg(radialSegments, 4)), material);
  cyl.position.copy(A).add(B).multiplyScalar(0.5);
  cyl.quaternion.setFromUnitVectors(UP, dir.clone().normalize());
  const ballA = new THREE.Mesh(new THREE.SphereGeometry(r1, seg(radialSegments, 4), seg(radialSegments * 0.66, 3)), material);
  ballA.position.copy(A);
  const ballB = new THREE.Mesh(new THREE.SphereGeometry(r2, seg(radialSegments, 4), seg(radialSegments * 0.66, 3)), material);
  ballB.position.copy(B);
  g.add(cyl, ballA, ballB);
  return g;
}

/**
 * Soft, padded box: a subdivided box whose corners are pulled toward an
 * ellipsoid. round = how rounded overall (0 = box, 1 = ellipsoid); topRound
 * adds extra rounding to the upper half (domed tops); topDepth < 1 makes the
 * top thinner front-to-back than the bottom (like a backpack), keeping the
 * +z face in place (the side that rests against the body).
 */
export function softBox(W, H, D, material, { round = 0.35, topRound = 0, topDepth = 1 } = {}) {
  const geo = new THREE.BoxGeometry(W, H, D, seg(5, 3), seg(6, 3), seg(4, 2));
  const pos = geo.attributes.position;
  const half = new THREE.Vector3(W / 2, H / 2, D / 2);
  const p = new THREE.Vector3(), n = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    p.fromBufferAttribute(pos, i);
    n.copy(p).divide(half);                          // -1..1 inside the box
    const up = Math.max(0, n.y);                     // 0 at the middle, 1 at the top
    const k = round + topRound * up;
    const e = n.clone().normalize().multiply(half);  // matching point on the ellipsoid
    p.lerp(e, Math.min(k, 1));
    const depth = THREE.MathUtils.lerp(1, topDepth, (n.y + 1) / 2);
    p.z = (p.z - D / 2) * depth + D / 2; // taper toward the +z face
    pos.setXYZ(i, p.x, p.y, p.z);
  }
  geo.computeVertexNormals();
  return new THREE.Mesh(geo, material);
}

/** z coordinate on the front of an ellipsoid with radii rx, ry, rz at (x, y). */
export function surfaceZ(x, y, rx, ry, rz) {
  return rz * Math.sqrt(Math.max(0, 1 - (x / rx) ** 2 - (y / ry) ** 2));
}

/** Free all geometry under `root`. Materials are owned (and cached) by styles. */
export function disposeGeometry(root) {
  root.traverse((o) => {
    if (o.geometry) o.geometry.dispose();
  });
}
