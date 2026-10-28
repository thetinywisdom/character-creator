import {
  BoxGeometry,
  BufferGeometry,
  CylinderGeometry,
  Float32BufferAttribute,
  IcosahedronGeometry,
  Mesh,
  Uint16BufferAttribute,
  Vector3,
} from 'three';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';

/** Detail-1 icosphere: faceted, but even enough to read as a ball. */
export const SPHERE_DETAIL = 1;

/** Octagonal limbs. Low, and still reads as round next to the joint balls. */
export const CYLINDER_SIDES = 8;

/**
 * Circumradius / connected-limb radius.
 * The icosphere's inscribed sphere still clears the limb, so a bend never opens a gap.
 */
export const BALL_VISUAL = 1.46;

const _a = new Vector3();
const _b = new Vector3();
const _c = new Vector3();
const _ab = new Vector3();
const _ac = new Vector3();
const _n = new Vector3();

let ratioCache = null;

function triangleInradius(pos, ia, ib, ic) {
  _a.fromBufferAttribute(pos, ia);
  _b.fromBufferAttribute(pos, ib);
  _c.fromBufferAttribute(pos, ic);
  _ab.subVectors(_b, _a);
  _ac.subVectors(_c, _a);
  _n.crossVectors(_ab, _ac);
  const len = _n.length();
  if (len < 1e-8) return Infinity;
  return Math.abs(_a.dot(_n)) / len;
}

/** Min distance from the origin to a face, for a unit-circumradius icosphere. */
export function sphereInradiusRatio(detail = SPHERE_DETAIL) {
  if (ratioCache && ratioCache.detail === detail) return ratioCache.ratio;
  const geo = new IcosahedronGeometry(1, detail);
  const pos = geo.attributes.position;
  const index = geo.index;
  let min = Infinity;
  if (index) {
    for (let i = 0; i < index.count; i += 3) {
      min = Math.min(min, triangleInradius(pos, index.getX(i), index.getX(i + 1), index.getX(i + 2)));
    }
  } else {
    for (let i = 0; i < pos.count; i += 3) {
      min = Math.min(min, triangleInradius(pos, i, i + 1, i + 2));
    }
  }
  geo.dispose();
  ratioCache = { detail, ratio: min };
  return min;
}

/** Weld the duplicated corners Three leaves on a non-indexed icosphere. */
function weldedSphere(radius, detail) {
  const geo = new IcosahedronGeometry(radius, detail);
  geo.deleteAttribute('uv');
  geo.deleteAttribute('normal');
  const welded = mergeVertices(geo, 1e-4);
  geo.dispose();
  welded.computeVertexNormals();
  welded.parameters = { radius, detail };
  return welded;
}

export function ballCircumradius(coverRadius, ratio = sphereInradiusRatio()) {
  const circum = coverRadius * BALL_VISUAL;
  const inscribed = circum * ratio;
  if (!(inscribed > coverRadius)) {
    throw new Error('Joint ball does not cover its limb. Increase BALL_VISUAL or sphere detail.');
  }
  return circum;
}

function shade(mesh, role) {
  mesh.castShadow = true;
  mesh.userData.role = role;
  return mesh;
}

export function createSphereMesh(radius, material) {
  const mesh = new Mesh(weldedSphere(radius, SPHERE_DETAIL), material);
  return shade(mesh, 'ball');
}

/** Open cylinder along Y, centered on the origin. Ends are hidden inside joint balls. */
export function createCylinderMesh(radius, length, material) {
  const mesh = new Mesh(
    new CylinderGeometry(radius, radius, length, CYLINDER_SIDES, 1, true),
    material,
  );
  return shade(mesh, 'cylinder');
}

export function createBoxMesh(width, height, depth, material) {
  const mesh = new Mesh(new BoxGeometry(width, height, depth), material);
  return shade(mesh, 'box');
}

/**
 * Right prism whose front face is a trapezoid (wider top or bottom).
 * Bottom sits on y=0, top on y=height. Depth is centered on z=0.
 */
export function createTrapezoidGeometry(topWidth, bottomWidth, height, depth) {
  const tw = topWidth / 2;
  const bw = bottomWidth / 2;
  const d = depth / 2;
  const h = height;
  const positions = new Float32Array([
    -tw, h, d,
    tw, h, d,
    tw, h, -d,
    -tw, h, -d,
    -bw, 0, d,
    bw, 0, d,
    bw, 0, -d,
    -bw, 0, -d,
  ]);
  const indices = [
    0, 1, 2, 0, 2, 3, // top
    4, 7, 6, 4, 6, 5, // bottom
    4, 5, 1, 4, 1, 0, // front
    6, 7, 3, 6, 3, 2, // back
    1, 5, 6, 1, 6, 2, // right
    0, 3, 7, 0, 7, 4, // left
  ];
  const geo = new BufferGeometry();
  geo.setAttribute('position', new Float32BufferAttribute(positions, 3));
  geo.setIndex(new Uint16BufferAttribute(indices, 1));
  geo.computeVertexNormals();
  geo.userData.topWidth = topWidth;
  geo.userData.bottomWidth = bottomWidth;
  geo.userData.height = height;
  geo.userData.depth = depth;
  return geo;
}

export function createTrapezoidMesh(topWidth, bottomWidth, height, depth, material) {
  const mesh = new Mesh(
    createTrapezoidGeometry(topWidth, bottomWidth, height, depth),
    material,
  );
  return shade(mesh, 'trapezoid');
}

export function countStats(root) {
  let vertices = 0;
  let triangles = 0;
  let meshes = 0;
  const roles = { ball: 0, cylinder: 0, box: 0, trapezoid: 0 };
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
