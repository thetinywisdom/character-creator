import {
  BufferGeometry,
  CylinderGeometry,
  Float32BufferAttribute,
  LatheGeometry,
  Mesh,
  SphereGeometry,
  Uint16BufferAttribute,
  Vector2,
} from 'three';

/** Open 8-sided limbs. Faceted on purpose; the joint spheres carry the roundness. */
export const CYLINDER_SIDES = 8;

/**
 * Low joint balls. Width matches the 8-sided tubes. Height is even so a
 * vertex ring sits on the equator. Normals stay smooth.
 */
export const JOINT_WIDTH = 8;
export const JOINT_HEIGHT = 6;
/**
 * Cylinder theta 0 lies on +Z. Sphere phi 0 lies on -X, so the ball starts
 * a quarter turn around and its longitudes land on the tube vertices.
 */
export const JOINT_PHI_START = Math.PI / 2;

/** Small rounded feet. Smooth-shaded, still only a handful of rings. */
export const FOOT_WIDTH = 8;
export const FOOT_HEIGHT = 6;

/**
 * Bald head from iso-city `characters/characters.js` (`HEAD`, `HEAD_Z`).
 * Faceless: the lathe only. Ears, the nose, and the ink lines stay out.
 * Points are [radius, y]. The chin ring is radius 0.06 at y -0.145.
 * The crown is y 0.163. Sections are 1.08× deeper than they are wide.
 */
export const ISO_HEAD_PROFILE = [
  [0, -0.15],
  [0.06, -0.145],
  [0.093, -0.108],
  [0.106, -0.045],
  [0.11, 0.03],
  [0.103, 0.09],
  [0.08, 0.135],
  [0.042, 0.158],
  [0, 0.163],
];
export const ISO_HEAD_SEGMENTS = 8;
export const ISO_HEAD_DEPTH = 1.08;
export const ISO_HEAD_CROWN = 0.163;
export const ISO_HEAD_NECK_RADIUS = 0.06;
export const ISO_HEAD_NECK_Y = -0.145;

function shade(mesh, role) {
  mesh.castShadow = true;
  mesh.userData.role = role;
  return mesh;
}

/**
 * Faceted lathe of the iso-city bald head, uniformly scaled.
 * `scale` multiplies the profile. Depth stays 1.08× the width, as in iso-city.
 * The chin ring (radius 0.06 in profile units) is the neck socket.
 */
export function createHeadGeometry(scale) {
  const k = scale;
  const points = ISO_HEAD_PROFILE.map(([r, y]) => new Vector2(Math.max(r, 0.0001) * k, y * k));
  const geo = new LatheGeometry(points, ISO_HEAD_SEGMENTS);
  geo.scale(1, 1, ISO_HEAD_DEPTH);
  geo.userData.scale = k;
  geo.userData.crown = ISO_HEAD_CROWN * k;
  geo.userData.neckY = ISO_HEAD_NECK_Y * k;
  geo.userData.neckRadius = ISO_HEAD_NECK_RADIUS * k;
  geo.userData.depthScale = ISO_HEAD_DEPTH;
  return geo;
}

export function createHeadMesh(scale, material) {
  const mesh = new Mesh(createHeadGeometry(scale), material);
  return shade(mesh, 'head');
}

export function createJointMesh(radius, material) {
  const geo = new SphereGeometry(radius, JOINT_WIDTH, JOINT_HEIGHT, JOINT_PHI_START);
  const mesh = new Mesh(geo, material);
  return shade(mesh, 'ball');
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
