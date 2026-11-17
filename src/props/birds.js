import * as THREE from 'three';
import { poseBird } from '../anim/props.js';
import { mulberry32 } from '../lib/rng.js';
import { vertexColorMaterial } from '../lib/skin.js';
import { paletteHex } from '../styles/palette.js';
import { box } from '../props/util.js';

// Pigeons and sparrows, built the way the cat is: one faceted body (a short
// loft, flat faces), a faceted head, a beak, and folded wings. No eyes, same
// as the cat's default. Colours are existing swatches only.
//
// A pigeon stands and, on a loop, bobs then pecks (anim/props.js). A sparrow
// is perched on a short wire, the kind that runs between utility poles; its
// feet stay put and the head looks along the wire. The seed picks the greys
// (or the sparrow's browns), the markings and the rest pose.

const pick = (rng, list) => list[Math.floor(rng() * list.length)];
const hex = (name) => paletteHex(name);
const GREY = ['Charcoal', 'Slate', 'Gray', 'Stone', 'Light gray', 'Paper'];

function loft(stations, sides) {
  const pos = [];
  const idx = [];
  for (const [z, y, w, h] of stations) {
    for (let k = 0; k < sides; k++) {
      const a = (k / sides) * Math.PI * 2;
      const sy = Math.sin(a);
      pos.push(Math.cos(a) * w, y + sy * h * (sy < 0 ? 0.88 : 1), z);
    }
  }
  const ring = (i, k) => i * sides + ((k % sides) + sides) % sides;
  for (let i = 0; i < stations.length - 1; i++) {
    for (let k = 0; k < sides; k++) {
      const a = ring(i, k), b = ring(i, k + 1), c = ring(i + 1, k), d = ring(i + 1, k + 1);
      idx.push(a, b, c, b, d, c);
    }
  }
  const first = stations[0], last = stations[stations.length - 1];
  const s0 = pos.length / 3;
  pos.push(0, first[1], first[0] - first[2] * 0.6);
  const s1 = pos.length / 3;
  pos.push(0, last[1], last[0] + last[2] * 0.8);
  const lastRing = stations.length - 1;
  for (let k = 0; k < sides; k++) {
    idx.push(s0, ring(0, k + 1), ring(0, k));
    idx.push(s1, ring(lastRing, k), ring(lastRing, k + 1));
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setIndex(idx);
  return geo;
}

function addWing(body, mat, side, y, reach, len) {
  // a thick slab along the flank, not a thin triangle: the outline pass eats paper-thin wings
  const wing = part(box(reach, 0.014, len, mat), 'wing');
  wing.position.set(side * (0.02 + reach * 0.42), y, -len * 0.12);
  wing.rotation.z = side * -0.12;
  body.add(wing);
}

function paint(root, colorOf, mat) {
  const v = new THREE.Vector3();
  const acc = new THREE.Vector3();
  const col = new THREE.Color();
  root.traverse((o) => {
    if (!o.isMesh || !o.userData.part) return;
    const src = o.geometry;
    const g = src.index ? src.toNonIndexed() : src;
    const pos = g.attributes.position;
    const n = pos.count;
    const colours = new Float32Array(n * 3);
    for (let i = 0; i < n; i += 3) {
      acc.set(0, 0, 0);
      for (let k = 0; k < 3; k++) acc.add(v.fromBufferAttribute(pos, i + k));
      acc.multiplyScalar(1 / 3);
      col.setHex(colorOf(o.userData.part, acc));
      for (let k = 0; k < 3; k++) colours.set([col.r, col.g, col.b], (i + k) * 3);
    }
    g.setAttribute('color', new THREE.BufferAttribute(colours, 3));
    g.computeVertexNormals();
    if (g !== src) src.dispose();
    o.geometry = g;
    o.material = mat;
  });
}

function part(mesh, name) {
  mesh.userData.part = name;
  return mesh;
}

function pigeonLook(rng) {
  const i = 1 + Math.floor(rng() * 4); // Charcoal .. Light gray, never one flat tone
  const base = GREY[i];
  return {
    base: hex(base),
    dark: hex(GREY[Math.max(0, i - 2)]),
    light: hex(GREY[Math.min(GREY.length - 1, i + 2)]),
    beak: hex(pick(rng, ['Tan', 'Apricot', 'Sand'])),
    foot: hex(pick(rng, ['Blush', 'Tan', 'Apricot'])),
    mark: pick(rng, ['plain', 'bar', 'speckle', 'neck']),
  };
}

function sparrowLook(rng) {
  return {
    back: hex(pick(rng, ['Cocoa', 'Walnut', 'Tan'])),
    belly: hex(pick(rng, ['Sand', 'Paper', 'Tan'])),
    dark: hex(pick(rng, ['Charcoal', 'Walnut', 'Ink'])),
    bar: hex(pick(rng, ['Butter', 'Sand', 'Apricot'])),
    beak: hex(pick(rng, ['Tan', 'Walnut', 'Apricot'])),
    foot: hex(pick(rng, ['Walnut', 'Tan', 'Cocoa'])),
    bib: rng() < 0.72,
  };
}

function addBird(root, style, { stations, sides, hr, headAt, wings, tail, legs, look, colorOf, pose }) {
  const mat = vertexColorMaterial(style);
  mat.side = THREE.DoubleSide;
  const body = new THREE.Group();
  body.name = 'body';
  root.add(body);
  body.add(part(new THREE.Mesh(loft(stations, sides), mat), 'body'));

  const head = new THREE.Group();
  head.name = 'head';
  head.position.set(headAt[0], headAt[1], headAt[2]);
  const skull = part(new THREE.Mesh(new THREE.IcosahedronGeometry(hr, 0), mat), 'head');
  skull.position.set(0, hr * 0.15, hr * 0.55);
  skull.scale.set(1.05, 0.92, 1.08);
  const beak = part(new THREE.Mesh(new THREE.ConeGeometry(hr * 0.32, hr * 1.7, 4), mat), 'beak');
  beak.rotation.x = Math.PI / 2;
  beak.position.set(0, -hr * 0.08, hr * 1.55);
  head.add(skull, beak);
  body.add(head);

  for (const s of [-1, 1]) addWing(body, mat, s, wings.y, wings.reach, wings.len);
  const tailPivot = new THREE.Group();
  tailPivot.position.set(0, tail.y, tail.z);
  tailPivot.add(part(box(tail.halfW * 2, 0.016, tail.len, mat, [0, -tail.drop * 0.3, -tail.len / 2]), 'tail'));
  body.add(tailPivot);

  for (const s of [-1, 1]) {
    const x = s * legs.span;
    body.add(part(new THREE.Mesh(
      new THREE.CylinderGeometry(legs.r * 0.7, legs.r, legs.h, 4, 1, true),
      mat,
    ), 'leg').translateX(x).translateY(legs.y).translateZ(legs.z));
    const foot = part(box(legs.footW, legs.footH, legs.footD, mat, [x, legs.footY, legs.z + legs.footD * 0.25]), 'foot');
    body.add(foot);
  }

  root.updateMatrixWorld(true);
  paint(root, (name, p) => colorOf(look, name, p), mat);
  root.userData.bird = {
    kind: pose.kind,
    phase: pose.phase,
    head,
    body,
    tail: tailPivot,
    headPitch: pose.headPitch,
    headYaw: pose.headYaw,
    headRoll: pose.headRoll,
    headX: head.position.x,
    headY: head.position.y,
    headZ: head.position.z,
    bodyPitch: 0,
    yaw: pose.yaw,
    roll: pose.roll,
  };
  return root;
}

/** A standing pigeon. Greys only, plus beak and feet. */
function pigeon(style, seed) {
  const rng = mulberry32((seed * 31 + 7) >>> 0);
  const look = pigeonLook(rng);
  const bulk = 0.88 + rng() * 0.28;
  const legH = 0.07 + rng() * 0.015;
  const root = new THREE.Group();
  root.name = 'bird';
  const y = (extra) => legH + extra;
  addBird(root, style, {
    stations: [
      [-0.1, y(0.05), 0.03 * bulk, 0.026 * bulk],
      [-0.04, y(0.072), 0.052 * bulk, 0.042 * bulk],
      [0.025, y(0.066), 0.058 * bulk, 0.048 * bulk],
      [0.075, y(0.078), 0.038 * bulk, 0.034 * bulk],
      [0.108, y(0.096), 0.018 * bulk, 0.016 * bulk],
    ],
    sides: 5,
    hr: 0.032 * Math.min(bulk, 1.15),
    headAt: [0, y(0.1), 0.1],
    wings: { reach: 0.055, len: 0.1, y: y(0.055) },
    tail: { y: y(0.055), z: -0.09, halfW: 0.045, len: 0.07 + rng() * 0.02, drop: 0.012 },
    legs: { span: 0.022, r: 0.008, h: legH, y: legH / 2, z: -0.005, footW: 0.02, footH: 0.01, footD: 0.032, footY: 0.006 },
    look,
    pose: {
      kind: 'pigeon',
      phase: rng() * Math.PI * 2,
      yaw: (rng() - 0.5) * 0.5,
      roll: (rng() - 0.5) * 0.08,
      headPitch: (rng() - 0.5) * 0.2,
      headYaw: (rng() - 0.5) * 0.25,
      headRoll: (rng() - 0.5) * 0.12,
    },
    colorOf(L, name, p) {
      if (name === 'beak') return L.beak;
      if (name === 'leg' || name === 'foot') return L.foot;
      if (name === 'tail') return p.z < -0.04 ? L.light : L.base;
      if (name === 'wing') return L.dark;
      if (name === 'head') return L.mark === 'neck' && p.y < 0.02 ? L.light : L.base;
      if (p.y < y(0.05)) return L.light;
      if (L.mark === 'speckle' && Math.sin(p.x * 90 + p.z * 70) > 0.45) return L.dark;
      if (L.mark === 'bar' && Math.abs(p.z) < 0.012) return L.dark;
      return L.base;
    },
  });
  return root;
}

/** A small sparrow gripping a short overhead wire. */
function sparrow(style, seed) {
  const rng = mulberry32((seed * 37 + 11) >>> 0);
  const look = sparrowLook(rng);
  const bulk = 0.9 + rng() * 0.2;
  const root = new THREE.Group();
  root.name = 'bird';
  const wire = box(0.24, 0.012, 0.012, style.material('tire'), [0, 0.03, 0]);
  root.add(wire);
  const y = (extra) => 0.055 + extra;
  addBird(root, style, {
    stations: [
      [-0.07, y(0.016), 0.018 * bulk, 0.015 * bulk],
      [-0.025, y(0.03), 0.034 * bulk, 0.026 * bulk],
      [0.028, y(0.028), 0.036 * bulk, 0.028 * bulk],
      [0.062, y(0.038), 0.016 * bulk, 0.014 * bulk],
    ],
    sides: 5,
    hr: 0.022 * bulk,
    headAt: [0, y(0.042), 0.058],
    wings: { reach: 0.03, len: 0.055, y: y(0.02) },
    tail: { y: y(0.02), z: -0.065, halfW: 0.028, len: 0.055 + rng() * 0.01, drop: 0.008 },
    legs: { span: 0.014, r: 0.0045, h: 0.028, y: 0.046, z: 0.008, footW: 0.014, footH: 0.014, footD: 0.02, footY: 0.034 },
    look,
    pose: {
      kind: 'sparrow',
      phase: rng() * Math.PI * 2,
      yaw: (rng() - 0.5) * 0.35,
      roll: (rng() - 0.5) * 0.1,
      headPitch: (rng() - 0.5) * 0.15,
      headYaw: (rng() - 0.5) * 0.4,
      headRoll: (rng() - 0.5) * 0.1,
    },
    colorOf(L, name, p) {
      if (name === 'beak') return L.beak;
      if (name === 'leg' || name === 'foot') return L.foot;
      if (name === 'tail') return p.z < -0.025 ? L.dark : L.back;
      if (name === 'wing') return Math.abs(p.x) > 0.008 ? L.bar : L.dark;
      if (name === 'head') return L.bib && p.y < 0.005 && p.z > 0 ? L.dark : L.back;
      if (p.y < y(0.012)) return L.belly;
      return L.back;
    },
  });
  return root;
}

/** `variant` is Pigeon or Sparrow. `seed` picks markings and the rest pose. */
export function bird(style, variant, seed = 1) {
  const n = seed >>> 0;
  const g = variant === 'Sparrow' ? sparrow(style, n) : pigeon(style, n);
  // time 0 still shows this seed's phase, so a still picture is not always the same pose
  poseBird(g, 0);
  return g;
}
