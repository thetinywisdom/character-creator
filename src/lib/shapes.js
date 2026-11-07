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
