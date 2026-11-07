import * as THREE from 'three';

// Shared building blocks for procedural, primitive-based models.
// Every subject is assembled from these so a style can later swap
// materials (or add outlines) without touching the subject code.

const UP = new THREE.Vector3(0, 1, 0);

/** Sphere of radius `r`, then stretched by `scale` = [sx, sy, sz]. */
export function ellipsoid(r, scale, material, { position, rotation, segments = 32 } = {}) {
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(r, segments, Math.round(segments * 0.66)), material);
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
  const geo = new THREE.CapsuleGeometry(radius, Math.max(length, 1e-4), 8, radialSegments);
  const mesh = new THREE.Mesh(geo, material);
  mesh.position.copy(A).add(B).multiplyScalar(0.5);
  if (length > 1e-6) mesh.quaternion.setFromUnitVectors(UP, dir.normalize());
  return mesh;
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
