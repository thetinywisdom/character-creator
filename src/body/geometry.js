import {
  BufferGeometry,
  CylinderGeometry,
  Float32BufferAttribute,
  Mesh,
  SphereGeometry,
  Uint16BufferAttribute,
  Vector3,
} from 'three';

/** Open 8-sided limbs. Faceted on purpose; the joint spheres carry the roundness. */
export const CYLINDER_SIDES = 8;

/** Smooth joint spheres. Width is the silhouette, height the poles. */
export const JOINT_WIDTH = 24;
export const JOINT_HEIGHT = 16;

/** Egg head. Enough rings to read as smooth next to the neck sphere. */
export const HEAD_WIDTH = 20;
export const HEAD_HEIGHT = 14;

/** Small rounded feet. Smooth-shaded, still only a handful of rings. */
export const FOOT_WIDTH = 8;
export const FOOT_HEIGHT = 6;

/**
 * Horizontal flare of the egg: wider toward the crown, narrower toward the socket.
 * 0 is a sphere. The reference head is wider in its upper half.
 */
export const EGG_FLARE = 0.22;

const _v = new Vector3();

function shade(mesh, role) {
  mesh.castShadow = true;
  mesh.userData.role = role;
  return mesh;
}

/** Unit-sphere egg profile radius at normalized height y in [-1, 1], before rx. */
export function eggFlareFactor(yNorm, flare = EGG_FLARE) {
  const span = Math.sqrt(Math.max(0, 1 - yNorm * yNorm));
  return (1 + flare * yNorm) * span;
}

/** Widest horizontal radius of an egg with equatorial scale `rx`. */
export function eggMaxRadius(rx, flare = EGG_FLARE) {
  let max = 0;
  for (let i = 0; i <= 64; i += 1) {
    const y = -1 + (2 * i) / 64;
    max = Math.max(max, rx * eggFlareFactor(y, flare));
  }
  return max;
}

export function eggMaxFactor(flare = EGG_FLARE) {
  return eggMaxRadius(1, flare);
}

/**
 * Normalized height of the neck socket: the lower y where the egg is exactly
 * as wide as the neck. Everything below that point is narrower than the neck,
 * so the mesh stops there and the cylinder meets a matching ring.
 */
export function eggCutNorm(rx, neckRadius, flare = EGG_FLARE) {
  if (!(rx > 0)) return -0.2;
  const target = neckRadius / rx;
  if (target >= eggFlareFactor(0, flare) * 0.98) return -0.12;
  let lo = -0.995;
  let hi = 0;
  for (let i = 0; i < 28; i += 1) {
    const mid = (lo + hi) / 2;
    if (eggFlareFactor(mid, flare) < target) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

export function eggProfile(yNorm, rx, flare = EGG_FLARE) {
  return rx * eggFlareFactor(yNorm, flare);
}

/**
 * Tall egg, wider above the middle, open at the bottom on the neck socket.
 * `ry` is the distance from the centre to the crown.
 */
export function createEggGeometry(rx, ry, neckRadius, flare = EGG_FLARE) {
  const cut = eggCutNorm(rx, neckRadius, flare);
  const thetaLength = Math.acos(Math.min(0.999, Math.max(-0.999, cut)));
  const geo = new SphereGeometry(1, HEAD_WIDTH, HEAD_HEIGHT, 0, Math.PI * 2, 0, thetaLength);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i += 1) {
    _v.fromBufferAttribute(pos, i);
    const flareScale = 1 + flare * _v.y;
    pos.setXYZ(i, _v.x * rx * flareScale, _v.y * ry, _v.z * rx * flareScale);
  }
  pos.needsUpdate = true;
  geo.computeVertexNormals();
  const socketR = eggProfile(cut, rx, flare);
  geo.userData.rx = rx;
  geo.userData.ry = ry;
  geo.userData.cutNorm = cut;
  geo.userData.socketR = socketR;
  return geo;
}

export function createJointMesh(radius, material) {
  const geo = new SphereGeometry(radius, JOINT_WIDTH, JOINT_HEIGHT);
  const mesh = new Mesh(geo, material);
  return shade(mesh, 'ball');
}

export function createEggMesh(rx, ry, neckRadius, material) {
  const mesh = new Mesh(createEggGeometry(rx, ry, neckRadius), material);
  return shade(mesh, 'head');
}

export function createFootMesh(width, height, length, material) {
  const mesh = new Mesh(new SphereGeometry(1, FOOT_WIDTH, FOOT_HEIGHT), material);
  mesh.scale.set(width / 2, height / 2, length / 2);
  return shade(mesh, 'foot');
}

/**
 * Open tapered cylinder along Y. radiusTop is the +Y end.
 * Ends stay open so they disappear into the joint spheres.
 * An 8-gon's faces sit about 7.6% inside the circle the vertices lie on,
 * so a flush sphere peeks a couple of millimetres past each flat.
 */
export function createTaperMesh(radiusTop, radiusBottom, length, material) {
  const mesh = new Mesh(
    new CylinderGeometry(radiusTop, radiusBottom, Math.max(length, 0.001), CYLINDER_SIDES, 1, true),
    material,
  );
  return shade(mesh, 'cylinder');
}

/** Quarter-circle samples on each corner of a chest or pelvis block. */
export const BLOCK_BEVEL_SEGMENTS = 2;

/**
 * Points around a rounded rectangle, CCW when viewed from above.
 * Each corner is a quarter circle of `segments` straight cuts.
 */
function roundedRectLoop(hx, hz, radius, segments) {
  const c = Math.min(radius, hx * 0.999, hz * 0.999);
  const corners = [
    { cx: hx - c, cz: hz - c, a0: 0 },
    { cx: -(hx - c), cz: hz - c, a0: Math.PI / 2 },
    { cx: -(hx - c), cz: -(hz - c), a0: Math.PI },
    { cx: hx - c, cz: -(hz - c), a0: (Math.PI * 3) / 2 },
  ];
  const pts = [];
  for (const corner of corners) {
    for (let k = 0; k <= segments; k += 1) {
      const a = corner.a0 + (k / segments) * (Math.PI / 2);
      const nx = Math.cos(a);
      const nz = Math.sin(a);
      pts.push({ x: corner.cx + c * nx, z: corner.cz + c * nz, nx, nz });
    }
  }
  return pts;
}

function bevelRadius(minSpan, height) {
  const h = Math.max(height, 1e-4);
  let r = Math.min(minSpan * 0.14, h * 0.09);
  r = Math.min(r, minSpan * 0.22, h * 0.2);
  if (!(r > 1e-4)) r = Math.min(minSpan, h) * 0.08;
  return r;
}

/**
 * Tapered block with a small roundover on every edge.
 * Bottom sits on y=0, top on y=height. +Z is the front.
 * Two bevel segments trace a quarter circle; vertex normals follow that arc
 * so the edge shades as a rounded wooden corner. The flat faces stay flat.
 */
export function createFrustumGeometry(topWidth, bottomWidth, height, topDepth, bottomDepth) {
  const S = BLOCK_BEVEL_SEGMENTS;
  const hw0 = bottomWidth / 2;
  const hw1 = topWidth / 2;
  const hd0 = bottomDepth / 2;
  const hd1 = topDepth / 2;
  const h = Math.max(height, 1e-4);
  const minSpan = Math.min(topWidth, bottomWidth, topDepth, bottomDepth);
  const r = bevelRadius(minSpan, h);
  const rings = [];
  for (let i = 0; i <= S; i += 1) {
    const theta = (i / S) * (Math.PI / 2);
    rings.push({
      y: r * (1 - Math.cos(theta)),
      inset: r * (1 - Math.sin(theta)),
      ny: -Math.cos(theta),
      nh: Math.sin(theta),
    });
  }
  for (let i = 0; i <= S; i += 1) {
    const theta = (i / S) * (Math.PI / 2);
    rings.push({
      y: (h - r) + r * Math.sin(theta),
      inset: r * (1 - Math.cos(theta)),
      ny: Math.sin(theta),
      nh: Math.cos(theta),
    });
  }

  const positions = [];
  const normals = [];
  for (const ring of rings) {
    const wN = hw0 + (hw1 - hw0) * (ring.y / h);
    const dN = hd0 + (hd1 - hd0) * (ring.y / h);
    const hx = Math.max(wN - ring.inset, r);
    const hz = Math.max(dN - ring.inset, r);
    for (const p of roundedRectLoop(hx, hz, r, S)) {
      positions.push(p.x, ring.y, p.z);
      normals.push(p.nx * ring.nh, ring.ny, p.nz * ring.nh);
    }
  }

  const P = 4 * (S + 1);
  const indices = [];
  for (let ring = 0; ring < rings.length - 1; ring += 1) {
    const base = ring * P;
    for (let k = 0; k < P; k += 1) {
      const i = base + k;
      const j = base + ((k + 1) % P);
      const iu = i + P;
      const ju = j + P;
      indices.push(iu, ju, j, iu, j, i);
    }
  }
  const top = (rings.length - 1) * P;
  for (let k = 1; k < P - 1; k += 1) {
    indices.push(0, k, k + 1);
    indices.push(top, top + k + 1, top + k);
  }

  const geo = new BufferGeometry();
  geo.setAttribute('position', new Float32BufferAttribute(positions, 3));
  geo.setAttribute('normal', new Float32BufferAttribute(normals, 3));
  geo.setIndex(new Uint16BufferAttribute(indices, 1));
  geo.userData.topWidth = topWidth;
  geo.userData.bottomWidth = bottomWidth;
  geo.userData.topDepth = topDepth;
  geo.userData.bottomDepth = bottomDepth;
  geo.userData.height = height;
  geo.userData.bevelSegments = S;
  geo.userData.bevelRadius = r;
  return geo;
}

export function createFrustumMesh(topWidth, bottomWidth, height, topDepth, bottomDepth, material) {
  const mesh = new Mesh(
    createFrustumGeometry(topWidth, bottomWidth, height, topDepth, bottomDepth),
    material,
  );
  return shade(mesh, 'frustum');
}

/**
 * Tapered paddle along -Y. Six sides, a small base ring, a palm ring, and a point.
 * The base ring is meant to sit inside the wrist sphere.
 */
export function createPaddleGeometry(length, baseRx, baseRz, midRx, midRz) {
  const sides = 6;
  const yBase = -Math.min(length * 0.16, baseRx);
  const yMid = -length * 0.46;
  const positions = [];
  const rings = [
    { y: yBase, rx: baseRx, rz: baseRz },
    { y: yMid, rx: midRx, rz: midRz },
  ];
  for (const ring of rings) {
    for (let i = 0; i < sides; i += 1) {
      const a = (i / sides) * Math.PI * 2;
      positions.push(Math.cos(a) * ring.rx, ring.y, Math.sin(a) * ring.rz);
    }
  }
  positions.push(0, -length, 0);
  const tip = sides * 2;
  const indices = [];
  for (let i = 0; i < sides; i += 1) {
    const j = (i + 1) % sides;
    indices.push(i, j, j + sides, i, j + sides, i + sides);
    indices.push(i + sides, j + sides, tip);
  }
  const geo = new BufferGeometry();
  geo.setAttribute('position', new Float32BufferAttribute(positions, 3));
  geo.setIndex(new Uint16BufferAttribute(indices, 1));
  geo.computeVertexNormals();
  geo.userData.length = length;
  geo.userData.baseRx = baseRx;
  geo.userData.baseRz = baseRz;
  geo.userData.midRx = midRx;
  geo.userData.midRz = midRz;
  return geo;
}

export function createPaddleMesh(length, baseRx, baseRz, midRx, midRz, material) {
  const mesh = new Mesh(
    createPaddleGeometry(length, baseRx, baseRz, midRx, midRz),
    material,
  );
  return shade(mesh, 'paddle');
}

export function countStats(root) {
  let vertices = 0;
  let triangles = 0;
  let meshes = 0;
  const roles = { ball: 0, cylinder: 0, frustum: 0, paddle: 0, foot: 0, head: 0 };
  root.traverse((obj) => {
    if (!obj.isMesh) return;
    meshes += 1;
    const role = obj.userData.role;
    if (role && roles[role] != null) roles[role] += 1;
    const pos = obj.geometry.getAttribute('position');
    vertices += pos.count;
    const index = obj.geometry.index;
    triangles += index ? index.count / 3 : pos.count / 3;
  });
  return { vertices, triangles, meshes, roles };
}
