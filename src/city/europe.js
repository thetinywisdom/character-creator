import * as THREE from 'three';
import { PALETTE } from '../styles/palette.js';
import { box, cyl, disc } from '../props/util.js';
import { gable } from './buildings.js';
import { paintedWindow } from './interiors.js';
import { between, chance, pick, side } from './variety.js';

// European houses for the catalogue. A different family from the Japanese
// town buildings: the silhouette does the work (steep roofs, gables, a
// mansard, a bell tower), not a shop sign or a concrete balcony.
//
// Each builder takes (style, rng, w, d). rng is mulberry32(seed) from the
// catalogue, so the same seed always rebuilds the same house. Every random
// choice is drawn from rng before the meshes go up.
//
// Wall, roof and trim colours are named swatches in PALETTE. Roles
// `building`, `roof`, `wood` and `concrete` snap to the neutral building
// palette, which would turn Scandinavian red / yellow and painted shutters
// into grey or brick. Those surfaces use the `paint` role so they keep the
// swatch. No new swatches.

const C = (name) => PALETTE[name];
const mat = (style, role, name) => style.material(role, C(name));

const PLASTER = ['Off white', 'Paper', 'Light gray'];
const STONE = ['Stone', 'Light gray', 'Gray', 'Tan'];
const TIMBER = ['Ink', 'Charcoal', 'Walnut'];
const TILE = ['Brick', 'Cocoa', 'Walnut', 'Tan'];
const SLATE = ['Slate', 'Charcoal', 'Ink', 'Gray', 'Walnut'];
const DOOR_WOOD = ['Walnut', 'Cocoa', 'Ink', 'Charcoal'];
const SHUTTER_PAINT = ['Denim', 'Navy', 'Sage', 'Dusty rose', 'Walnut', 'Charcoal', 'Lilac', 'Apricot'];
const FLOWER = ['Dusty rose', 'Blush', 'Butter', 'Lilac', 'Apricot'];
const CHIMNEY_CLR = ['Brick', 'Cocoa', 'Walnut', 'Tan'];

// Outward normal of a wall, and the horizontal axis along that wall.
const FACE = {
  z: { out: [0, 0, 1], along: [1, 0, 0], size: (w, h, t) => [w, h, t] },
  '-z': { out: [0, 0, -1], along: [-1, 0, 0], size: (w, h, t) => [w, h, t] },
  x: { out: [1, 0, 0], along: [0, 0, -1], size: (w, h, t) => [t, h, w] },
  '-x': { out: [-1, 0, 0], along: [0, 0, 1], size: (w, h, t) => [t, h, w] },
};

function meshOf(positions, material) {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.computeVertexNormals();
  return new THREE.Mesh(geo, material);
}

const add3 = (pos, a, b, c) => pos.push(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2]);

/** Hip (or pyramid) roof. Ridge runs along the longer of bw / bd. */
function hipRoof(bw, bd, rise, material) {
  const alongX = bw >= bd;
  const length = alongX ? bw : bd;
  const width = alongX ? bd : bw;
  const hl = length / 2, hw = width / 2;
  const rl = Math.max(0, (length - width) / 2);
  const pos = [];
  const bl = [-hl, 0, -hw], br = [hl, 0, -hw], fr = [hl, 0, hw], fl = [-hl, 0, hw];
  if (rl < 0.08) {
    const apex = [0, rise, 0];
    add3(pos, fl, fr, apex);
    add3(pos, br, bl, apex);
    add3(pos, bl, fl, apex);
    add3(pos, fr, br, apex);
  } else {
    const apexL = [-rl, rise, 0], apexR = [rl, rise, 0];
    add3(pos, fl, fr, apexR); add3(pos, fl, apexR, apexL);
    add3(pos, br, bl, apexL); add3(pos, br, apexL, apexR);
    add3(pos, bl, fl, apexL);
    add3(pos, fr, br, apexR);
  }
  const mesh = meshOf(pos, material);
  if (!alongX) mesh.rotation.y = Math.PI / 2;
  return mesh;
}

/** Mansard: a steep lower pitch and a shallow cap. */
function mansardRoof(bw, bd, steep, cap, inset, inset2, material) {
  const pos = [];
  const ring = (y, pull) => {
    const x = bw / 2 - pull, z = bd / 2 - pull;
    return [[-x, y, -z], [x, y, -z], [x, y, z], [-x, y, z]];
  };
  const B = ring(0, 0), M = ring(steep, inset), T = ring(steep + cap, inset + inset2);
  const quad = (a, b, c, d) => { add3(pos, a, b, c); add3(pos, a, c, d); };
  for (const [i, j] of [[3, 2], [1, 0], [0, 3], [2, 1]]) {
    quad(B[i], B[j], M[j], M[i]);
    quad(M[i], M[j], T[j], T[i]);
  }
  quad(T[3], T[2], T[1], T[0]);
  return meshOf(pos, material);
}

/** Half-disc in the XY plane, flat, normal +z, diameter on y = 0. */
function archFan(radius, material, segments = 5) {
  const pos = [];
  for (let i = 0; i < segments; i++) {
    const a0 = Math.PI * (1 - i / segments);
    const a1 = Math.PI * (1 - (i + 1) / segments);
    const p0 = [Math.cos(a0) * radius, Math.sin(a0) * radius, 0];
    const p1 = [Math.cos(a1) * radius, Math.sin(a1) * radius, 0];
    add3(pos, [0, 0, 0], p1, p0);
  }
  return meshOf(pos, material);
}

/** A pointed cap above a window, flat, normal +z, base on y = 0. */
function pointCap(w, point, material) {
  const hw = w / 2;
  const pos = [];
  add3(pos, [-hw, 0, 0], [hw, 0, 0], [0, point, 0]);
  return meshOf(pos, material);
}

/** Small pointed head for a chapel door, flat, normal +z, origin at the rect centre. */
function lancetPanel(w, h, point, material) {
  const hw = w / 2, hh = h / 2;
  const pos = [];
  add3(pos, [-hw, -hh, 0], [hw, -hh, 0], [hw, hh, 0]);
  add3(pos, [-hw, -hh, 0], [hw, hh, 0], [-hw, hh, 0]);
  add3(pos, [-hw, hh, 0], [hw, hh, 0], [0, hh + point, 0]);
  return meshOf(pos, material);
}

function pyramid(w, d, h, material) {
  const hw = w / 2, hd = d / 2, apex = [0, h, 0];
  const pos = [];
  const bl = [-hw, 0, -hd], br = [hw, 0, -hd], fr = [hw, 0, hd], fl = [-hw, 0, hd];
  add3(pos, fl, fr, apex);
  add3(pos, br, bl, apex);
  add3(pos, bl, fl, apex);
  add3(pos, fr, br, apex);
  return meshOf(pos, material);
}

function move(mesh, facing) {
  if (facing === '-z') mesh.rotation.y = Math.PI;
  else if (facing === 'x') mesh.rotation.y = Math.PI / 2;
  else if (facing === '-x') mesh.rotation.y = -Math.PI / 2;
  return mesh;
}

function at(x, y, z, dir, amt, along = 0, alongDir = null) {
  const a = alongDir ?? [0, 0, 0];
  return [x + dir[0] * amt + a[0] * along, y + dir[1] * amt + a[1] * along, z + dir[2] * amt + a[2] * along];
}

/**
 * A window on a wall. `facing` is the outward normal ('z', '-z', 'x', '-x').
 * arch: radius of a half-round top (0 = none). point: lancet height (0 = none).
 * Glass is either a painted curtain or plain dark glass (chapels, arches).
 */
function euroWindow(g, style, o) {
  const { x, y, z, w, h, facing = 'z', frame, glass = 'curtain', variant = 0 } = o;
  const { arch = 0, point = 0, mullion = true, sill = true, shutters = null, flowers = null } = o;
  const f = FACE[facing];
  const put = (ww, hh, tt, material, extraY, out, along = 0) => {
    const [bw, bh, bd] = f.size(ww, hh, tt);
    g.add(box(bw, bh, bd, material, at(x, y + extraY, z, f.out, out, along, f.along)));
  };
  put(w + 0.16, h + 0.14, 0.07, frame, 0, 0.02);
  if (glass === 'curtain') {
    const p = paintedWindow(style, variant % 4, w, h, x, y, z);
    move(p, facing);
    const q = at(x, y, z, f.out, 0.07);
    p.position.set(q[0], q[1], q[2]);
    g.add(p);
  } else put(w, h, 0.04, style.material('window'), 0, 0.07);
  if (mullion) {
    put(0.05, h, 0.05, frame, 0, 0.09);
    put(w, 0.05, 0.05, frame, 0, 0.09);
  }
  if (sill) put(w + 0.28, 0.08, 0.16, frame, -h / 2 - 0.02, 0.1);
  if (arch > 0) {
    const spring = y + h / 2;
    for (const [rad, material, out] of [[arch + 0.1, frame, 0.03], [arch, glass === 'curtain' ? style.material('window') : style.material('window'), 0.08]]) {
      const fan = move(archFan(rad, material), facing);
      const q = at(x, spring, z, f.out, out);
      fan.position.set(q[0], q[1], q[2]);
      g.add(fan);
    }
  }
  if (point > 0) {
    // the point sits on the rectangular shaft, a little proud of it, so the two don't flicker
    for (const [grow, material, out] of [[0.12, frame, 0.045], [0, style.material('window'), 0.09]]) {
      const cap = move(pointCap(w + grow * 2, point + grow, material), facing);
      const q = at(x, y + h / 2, z, f.out, out);
      cap.position.set(q[0], q[1], q[2]);
      g.add(cap);
    }
  }
  if (shutters) {
    const sw = Math.min(w * 0.42, 0.42);
    put(sw, h, 0.06, shutters, 0, 0.08, -(w / 2 + sw / 2 + 0.04));
    put(sw, h, 0.06, shutters, 0, 0.08, w / 2 + sw / 2 + 0.04);
  }
  if (flowers) {
    put(w * 0.92, 0.16, 0.22, mat(style, 'wood', 'Walnut'), -h / 2 - 0.02, 0.2);
    const leaf = style.material('leaf', C('Moss'));
    const bloom = style.material('signage', C(flowers));
    put(w * 0.7, 0.12, 0.16, leaf, -h / 2 + 0.1, 0.24);
    put(w * 0.28, 0.16, 0.14, bloom, -h / 2 + 0.22, 0.26, -w * 0.18);
    put(w * 0.22, 0.14, 0.12, bloom, -h / 2 + 0.2, 0.28, w * 0.16);
  }
}

function euroDoor(g, style, { x, y = 0, z, facing = 'z', w = 0.96, h = 2.05, color, frame, arch = 0, point = 0, step = true }) {
  const f = FACE[facing];
  const door = mat(style, 'wood', color);
  const [bw, bh, bd] = f.size(w, h, 0.08);
  const q = at(x, y + h / 2, z, f.out, 0.05);
  g.add(box(bw, bh, bd, door, q));
  g.add(box(...f.size(0.08, 0.16, 0.04), mat(style, 'metal', 'Charcoal'), at(x, y + h * 0.45, z, f.out, 0.1, w * 0.32, f.along)));
  if (frame) {
    const fq = at(x, y + h / 2, z, f.out, 0.02);
    g.add(box(...f.size(w + 0.24, h + 0.12, 0.06), frame, fq));
  }
  if (arch > 0) {
    const fan = move(archFan(w / 2 + 0.02, door), facing);
    const p = at(x, y + h, z, f.out, 0.06);
    fan.position.set(p[0], p[1], p[2]);
    g.add(fan);
    const rim = move(archFan(w / 2 + 0.14, frame ?? door), facing);
    const r = at(x, y + h, z, f.out, 0.03);
    rim.position.set(r[0], r[1], r[2]);
    g.add(rim);
  }
  if (point > 0) {
    const panel = move(lancetPanel(w, 0.2, point, door), facing);
    const p = at(x, y + h - 0.1, z, f.out, 0.09);
    panel.position.set(p[0], p[1], p[2]);
    g.add(panel);
  }
  if (step) {
    const s = at(x, y + 0.04, z, f.out, 0.28);
    g.add(box(...f.size(w + 0.4, 0.08, 0.4), mat(style, 'concrete', 'Stone'), s));
  }
}

function addChimney(g, style, x, baseY, z, h, colorName) {
  const m = mat(style, 'building', colorName);
  g.add(box(0.64, h, 0.8, m, [x, baseY + h / 2, z]));
  g.add(box(0.8, 0.1, 0.96, mat(style, 'concrete', 'Stone'), [x, baseY + h + 0.02, z]));
  g.add(cyl(0.09, 0.12, 0.34, m, [x - 0.14, baseY + h + 0.22, z], { segments: 6 }));
  g.add(cyl(0.08, 0.11, 0.28, m, [x + 0.14, baseY + h + 0.2, z + 0.06], { segments: 6 }));
}

/** A beam from a to b (a box, its long axis turned onto the span). */
function beam(g, material, a, b, t = 0.1) {
  const dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2];
  const len = Math.hypot(dx, dy, dz) || 0.001;
  const m = box(len, t, t, material, [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2]);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(1, 0, 0), new THREE.Vector3(dx / len, dy / len, dz / len));
  g.add(m);
  return m;
}

function cornerBoards(g, material, bw, bd, h, t = 0.14) {
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    g.add(box(t, h, t, material, [sx * (bw / 2), h / 2, sz * (bd / 2)]));
  }
}

function plinth(g, style, bw, bd, color = 'Charcoal') {
  g.add(box(bw + 0.14, 0.42, bd + 0.14, mat(style, 'building', color), [0, 0.21, 0]));
}

function pitched(g, material, bw, bd, y, rise, endToStreet) {
  const roof = endToStreet ? gable(bd + 0.85, bw + 0.75, rise, material) : gable(bw + 0.85, bd + 0.75, rise, material);
  if (endToStreet) roof.rotation.y = Math.PI / 2;
  roof.position.y = y;
  g.add(roof);
  return roof;
}

/** White (or trim-coloured) boards along the two slopes of a gable end. */
function bargeBoards(g, material, bw, bd, y, rise, endToStreet) {
  if (endToStreet) {
    const zR = bd / 2 + 0.08;
    beam(g, material, [-bw / 2 - 0.06, y, zR], [0, y + rise + 0.05, zR], 0.12);
    beam(g, material, [bw / 2 + 0.06, y, zR], [0, y + rise + 0.05, zR], 0.12);
  } else {
    for (const sx of [-1, 1]) {
      const x = sx * (bw / 2 + 0.06);
      beam(g, material, [x, y, bd / 2 + 0.08], [x, y + rise + 0.05, 0], 0.12);
      beam(g, material, [x, y, -bd / 2 - 0.08], [x, y + rise + 0.05, 0], 0.12);
    }
  }
}

function chimneyOnRidge(g, style, bw, bd, y, rise, endToStreet, which, colorName, h) {
  // sunk into the ridge: a chimney that starts at the peak reads as floating behind the gable
  const base = y + rise - 0.9;
  if (which === 'both') {
    chimneyOnRidge(g, style, bw, bd, y, rise, endToStreet, 'left', colorName, h);
    chimneyOnRidge(g, style, bw, bd, y, rise, endToStreet, 'right', colorName, h * 0.86);
    return;
  }
  const s = which === 'left' ? -1 : 1;
  if (endToStreet) addChimney(g, style, 0, base, s * bd * 0.16, h, colorName);
  else addChimney(g, style, s * bw * 0.28, base, 0, h, colorName);
}

function xs(n, width) {
  if (n <= 1) return [0];
  const span = width * 0.78;
  return Array.from({ length: n }, (_, i) => -span / 2 + (span / (n - 1)) * i);
}

function variantAt(x, y) {
  return Math.abs(Math.round(x * 7 + y * 3)) % 4;
}

function ironBalcony(g, style, x, y, z, w) {
  const iron = mat(style, 'darkMetal', 'Ink');
  g.add(box(w, 0.05, 0.62, iron, [x, y, z + 0.28]));
  g.add(box(w, 0.06, 0.05, iron, [x, y + 0.9, z + 0.56]));
  g.add(box(0.05, 0.9, 0.05, iron, [x - w / 2, y + 0.45, z + 0.56]));
  g.add(box(0.05, 0.9, 0.05, iron, [x + w / 2, y + 0.45, z + 0.56]));
  const bars = Math.max(3, Math.round(w / 0.28));
  for (let i = 0; i < bars; i++) {
    g.add(box(0.035, 0.88, 0.035, iron, [x - w / 2 + ((i + 0.5) * w) / bars, y + 0.44, z + 0.56]));
  }
}

function flowerName(rng) {
  return pick(rng, FLOWER);
}

function finish(local, bw, bd, bz, extra = []) {
  const g = new THREE.Group();
  local.position.set(0, 0, bz);
  g.add(local);
  const colliders = [{ x: 0, z: bz, hw: bw / 2, hd: bd / 2 + 0.2 }];
  for (const c of extra) colliders.push({ x: c.x, z: c.z + bz, hw: c.hw, hd: c.hd });
  return { group: g, footprint: { w: bw, d: bd, z: bz }, colliders };
}

function lot(w, d, maxW, maxD, rx, rz) {
  const bw = Math.min(w - 1.4, maxW) * (0.78 + rx * 0.2);
  const bd = Math.min(d - 2.2, maxD) * (0.76 + rz * 0.22);
  const bz = -d / 2 + bd / 2 + 0.7;
  return { bw, bd, bz };
}

// --- 1. Tudor cottage -------------------------------------------------------

function designTudor(rng, w, d) {
  const storeys = pick(rng, [1, 2, 2, 2]);
  const { bw, bd, bz } = lot(w, d, 8.6, 7.2, rng(), rng());
  return {
    storeys, bw, bd, bz,
    jetty: storeys > 1 && chance(rng, 0.7),
    cross: chance(rng, 0.58),
    wall: pick(rng, PLASTER),
    timber: pick(rng, TIMBER),
    roof: pick(rng, ['Walnut', 'Charcoal', 'Ink', 'Slate', 'Cocoa']),
    pattern: pick(rng, ['studs', 'diamonds', 'herringbone', 'squares']),
    winN: between(rng, 2, Math.min(4, Math.max(2, Math.floor(bw / 1.7)))),
    doorSlot: between(rng, 0, Math.min(3, Math.max(1, Math.floor(bw / 1.7))) - 1),
    chimney: pick(rng, ['left', 'right', 'left', 'right', 'both', 'none']),
    chimneyClr: pick(rng, CHIMNEY_CLR),
    chimneyH: 1.8 + rng() * 1.3,
    dormer: storeys > 1 && chance(rng, 0.42),
    porch: chance(rng, 0.62),
    shutters: chance(rng, 0.2),
    boxes: chance(rng, 0.28),
    shutterClr: pick(rng, ['Walnut', 'Ink', 'Dusty rose', 'Sage']),
    gableWin: chance(rng, 0.5),
    doorClr: pick(rng, DOOR_WOOD),
    flower: flowerName(rng),
    endGable: chance(rng, 0.34),
  };
}

function timberPattern(g, material, x0, x1, y0, y1, z, pattern) {
  const t = 0.1;
  g.add(box(x1 - x0, t, t, material, [(x0 + x1) / 2, y0, z]));
  g.add(box(x1 - x0, t, t, material, [(x0 + x1) / 2, y1, z]));
  g.add(box(t, y1 - y0, t, material, [x0, (y0 + y1) / 2, z]));
  g.add(box(t, y1 - y0, t, material, [x1, (y0 + y1) / 2, z]));
  if (pattern === 'studs' || pattern === 'squares') {
    const n = pattern === 'squares' ? 3 : 4;
    for (let i = 1; i < n; i++) {
      const x = x0 + ((x1 - x0) * i) / n;
      g.add(box(t, y1 - y0, t, material, [x, (y0 + y1) / 2, z]));
    }
    if (pattern === 'squares') g.add(box(x1 - x0, t, t, material, [(x0 + x1) / 2, (y0 + y1) / 2, z]));
  } else if (pattern === 'diamonds') {
    beam(g, material, [x0, y0, z], [x1, y1, z], t);
    beam(g, material, [x1, y0, z], [x0, y1, z], t);
  } else {
    const n = 4;
    for (let i = 0; i < n; i++) {
      const a = x0 + ((x1 - x0) * i) / n;
      const b = x0 + ((x1 - x0) * (i + 1)) / n;
      beam(g, material, [a, y0, z], [b, y1, z], t);
    }
  }
}

export function tudorCottage(style, rng, w, d) {
  const spec = designTudor(rng, w, d);
  spec.doorSlot = Math.min(spec.doorSlot, spec.winN - 1);
  const { bw, bd, bz, storeys } = spec;
  const g = new THREE.Group();
  const FH = 2.9;
  const H = storeys * FH;
  const wall = mat(style, 'building', spec.wall);
  const timber = mat(style, 'wood', spec.timber);
  const roofM = mat(style, 'roof', spec.roof);
  const frame = mat(style, 'wood', spec.timber);
  const over = spec.jetty ? 0.32 : 0;
  g.add(box(bw, storeys === 1 ? H : FH, bd, wall, [0, (storeys === 1 ? H : FH) / 2, 0]));
  if (storeys > 1) {
    g.add(box(bw + over * 2, H - FH, bd + over, wall, [0, FH + (H - FH) / 2, over * 0.35]));
    if (spec.jetty) g.add(box(bw + over * 2, 0.12, over + 0.06, timber, [0, FH, bd / 2 + over * 0.45]));
  }
  plinth(g, style, bw, bd, 'Walnut');
  const rise = Math.max(bw, bd) * (spec.endGable ? 0.42 : 0.5);
  pitched(g, roofM, bw + over * 2, bd + over, H, rise, spec.endGable);
  const frontZ = bd / 2 + (storeys > 1 ? over : 0);
  // timber on the front, split into bays so the posts fall between windows
  const bays = spec.winN;
  const x0 = -(bw / 2) - (storeys > 1 ? over : 0);
  const x1 = (bw / 2) + (storeys > 1 ? over : 0);
  const span = x1 - x0;
  for (let i = 0; i < bays; i++) {
    const a = x0 + (span * i) / bays;
    const b = x0 + (span * (i + 1)) / bays;
    timberPattern(g, timber, a, b, 0.15, storeys > 1 ? FH - 0.08 : H - 0.15, bd / 2 + 0.05, 'studs');
    if (storeys > 1) timberPattern(g, timber, a - (spec.jetty ? over / bays : 0), b + (spec.jetty ? over / bays : 0), FH + 0.08, H - 0.12, frontZ + 0.05, spec.pattern);
  }
  // simpler studs on the sides so the orbit isn't a blank plaster wall
  for (const sx of [-1, 1]) {
    const x = sx * (bw / 2 + (storeys > 1 ? over : 0));
    g.add(box(0.1, H, bd * 0.92, timber, [x + sx * 0.05, H / 2, 0]));
    g.add(box(0.1, 0.1, bd, timber, [x + sx * 0.06, 0.2, 0]));
    g.add(box(0.1, 0.1, bd, timber, [x + sx * 0.06, H - 0.12, 0]));
    if (storeys > 1) g.add(box(0.1, 0.1, bd, timber, [x + sx * 0.06, FH, 0]));
  }
  const positions = xs(spec.winN, bw * 0.92);
  const shutterMat = spec.shutters ? mat(style, 'paint', spec.shutterClr) : null;
  const flowers = spec.boxes ? spec.flower : null;
  let cross = null;
  if (spec.cross) {
    const cw = Math.min(2.7, bw * 0.4), cd = 1.55;
    cross = { cw, cd, z: bd / 2 + cd / 2 - 0.08 };
    g.add(box(cw, H, cd, wall, [0, H / 2, cross.z]));
    const cr = gable(cd + 0.45, cw + 0.5, cw * 0.58, roofM);
    cr.rotation.y = Math.PI / 2;
    cr.position.set(0, H, cross.z);
    g.add(cr);
    timberPattern(g, timber, -cw / 2, cw / 2, 0.2, H - 0.15, cross.z + cd / 2 + 0.04, spec.pattern);
    euroWindow(g, style, { x: 0, y: storeys > 1 ? FH + 1.15 : H * 0.62, z: cross.z + cd / 2, w: 0.7, h: 0.9, frame, variant: 1, facing: 'z' });
  }
  positions.forEach((x, i) => {
    const isDoor = i === spec.doorSlot;
    if (cross && Math.abs(x) < cross.cw / 2 - 0.1) {
      // the centre bay is the projecting gable: the door, when it lands there, moves onto that face
      if (isDoor) euroDoor(g, style, { x: 0, z: cross.z + cross.cd / 2, color: spec.doorClr, frame: timber });
      return;
    }
    if (isDoor) {
      euroDoor(g, style, { x, z: bd / 2, color: spec.doorClr, frame: timber });
      if (spec.porch) {
        const hood = gable(1.15, 1.5, 0.5, roofM);
        hood.rotation.y = Math.PI / 2;
        hood.position.set(x, 2.2, bd / 2 + 0.45);
        g.add(hood);
      }
      return;
    }
    euroWindow(g, style, {
      x, y: 1.5, z: bd / 2, w: 0.78, h: 1.05, frame, variant: variantAt(x, 1.5),
      shutters: shutterMat, flowers, facing: 'z',
    });
  });
  if (storeys > 1) {
    xs(spec.winN, bw * 0.92 + over).forEach((x, i) => {
      if (cross && Math.abs(x) < cross.cw / 2 - 0.15) return;
      euroWindow(g, style, {
        x, y: FH + 1.35, z: frontZ, w: 0.72, h: 0.95, frame, variant: variantAt(x, FH),
        shutters: shutterMat, flowers: spec.boxes && i % 2 === 0 ? flowers : null, facing: 'z',
      });
    });
  }
  if (spec.gableWin && !cross) {
    const gy = H + rise * 0.38;
    if (spec.endGable) euroWindow(g, style, { x: 0, y: gy, z: bd / 2 + 0.4, w: 0.55, h: 0.7, frame, glass: 'plain', facing: 'z', sill: false });
  }
  // one window on each side
  euroWindow(g, style, { x: bw / 2, y: 1.55, z: 0.2, w: 0.7, h: 0.95, frame, variant: 2, facing: 'x' });
  euroWindow(g, style, { x: -bw / 2, y: 1.55, z: -0.4, w: 0.7, h: 0.95, frame, variant: 0, facing: '-x' });
  if (spec.chimney !== 'none') chimneyOnRidge(g, style, bw, bd, H, rise, spec.endGable, spec.chimney, spec.chimneyClr, spec.chimneyH);
  if (spec.dormer && !spec.endGable) {
    const dx = (spec.doorSlot % 2 === 0 ? -1 : 1) * bw * 0.22;
    const dz = bd * 0.2;
    const dy = H + rise * (1 - dz / (bd / 2)) - 0.15;
    g.add(box(1.15, 0.85, 0.7, wall, [dx, dy + 0.4, dz]));
    const dr = gable(0.85, 1.35, 0.55, roofM);
    dr.rotation.y = Math.PI / 2;
    dr.position.set(dx, dy + 0.85, dz);
    g.add(dr);
    euroWindow(g, style, { x: dx, y: dy + 0.42, z: dz + 0.35, w: 0.55, h: 0.6, frame, variant: 3, facing: 'z', sill: false });
  }
  const extra = [];
  if (cross) extra.push({ x: 0, z: cross.z, hw: cross.cw / 2, hd: cross.cd / 2 });
  return finish(g, bw, bd, bz, extra);
}

// --- 2. Mediterranean villa -------------------------------------------------

function designMed(rng, w, d) {
  const storeys = pick(rng, [1, 2, 2, 2]);
  const { bw, bd, bz } = lot(w, d, 10, 8.2, rng(), rng());
  const arches = between(rng, 2, Math.min(5, Math.max(2, Math.floor(bw / 1.6))));
  return {
    storeys, bw, bd, bz, arches,
    wing: chance(rng, 0.48),
    wall: pick(rng, PLASTER),
    roof: pick(rng, TILE),
    doorSlot: between(rng, 0, arches - 1),
    balcony: storeys > 1 && chance(rng, 0.72),
    balconySlot: between(rng, 0, arches - 1),
    chimney: chance(rng, 0.5) ? (chance(rng, 0.5) ? 'left' : 'right') : 'none',
    chimneyClr: pick(rng, CHIMNEY_CLR),
    shutters: chance(rng, 0.6),
    boxes: chance(rng, 0.55),
    shutterClr: pick(rng, SHUTTER_PAINT),
    doorClr: pick(rng, ['Walnut', 'Ink', 'Charcoal', 'Cocoa']),
    flower: flowerName(rng),
    pots: chance(rng, 0.7),
    upperN: storeys > 1 ? between(rng, 2, Math.min(4, arches)) : 0,
  };
}

export function mediterraneanVilla(style, rng, w, d) {
  const spec = designMed(rng, w, d);
  const { bw, bd, bz, storeys } = spec;
  const g = new THREE.Group();
  const FH = 3.05;
  const H = storeys * FH;
  const wall = mat(style, 'building', spec.wall);
  const roofM = mat(style, 'roof', spec.roof);
  const frame = mat(style, 'building', 'Off white');
  g.add(box(bw, H, bd, wall, [0, H / 2, 0]));
  plinth(g, style, bw, bd, 'Tan');
  const rise = Math.min(bw, bd) * 0.28 + 0.35;
  const hip = hipRoof(bw + 1.15, bd + 1.15, rise, roofM);
  hip.position.y = H;
  g.add(hip);
  // deep eaves: a thin tile shadow under the overhang
  g.add(box(bw + 1.2, 0.1, bd + 1.2, roofM, [0, H - 0.02, 0]));
  const shutterMat = spec.shutters ? mat(style, 'paint', spec.shutterClr) : null;
  const flowers = spec.boxes ? spec.flower : null;
  const cols = xs(spec.arches, bw);
  cols.forEach((x, i) => {
    if (i === spec.doorSlot) {
      euroDoor(g, style, { x, z: bd / 2, color: spec.doorClr, frame, arch: 0.5, h: 2.15 });
      return;
    }
    euroWindow(g, style, {
      x, y: 1.35, z: bd / 2, w: 0.78, h: 1.15, frame, arch: 0.39, glass: 'plain',
      shutters: shutterMat, flowers, facing: 'z', mullion: true,
    });
  });
  if (storeys > 1) {
    xs(spec.upperN, bw).forEach((x, i) => {
      const juliet = spec.balcony && i === spec.balconySlot % spec.upperN;
      euroWindow(g, style, {
        x, y: FH + 1.4, z: bd / 2, w: 0.74, h: juliet ? 1.7 : 1.2, frame, arch: 0.37, glass: 'plain',
        shutters: juliet ? null : shutterMat, flowers: juliet ? null : flowers, facing: 'z',
      });
      if (juliet) ironBalcony(g, style, x, FH + 0.15, bd / 2, 1.15);
    });
  }
  euroWindow(g, style, { x: bw / 2, y: 1.45, z: 0.3, w: 0.7, h: 1.15, frame, arch: 0.35, glass: 'plain', facing: 'x' });
  euroWindow(g, style, { x: -bw / 2, y: 1.45, z: -0.5, w: 0.7, h: 1.15, frame, arch: 0.35, glass: 'plain', facing: '-x' });
  const extra = [];
  if (spec.wing) {
    const ww = Math.min(bw * 0.55, 4.2), wd = bd * 0.72;
    const wx = bw / 2 + ww / 2 - 0.2, wz = -bd * 0.08;
    g.add(box(ww, FH * 0.92, wd, wall, [wx, FH * 0.46, wz]));
    const whip = hipRoof(ww + 0.7, wd + 0.7, 0.7, roofM);
    whip.position.set(wx, FH * 0.92, wz);
    g.add(whip);
    euroWindow(g, style, { x: wx, y: 1.3, z: wz + wd / 2, w: 0.7, h: 1.05, frame, arch: 0.35, glass: 'plain', facing: 'z' });
    extra.push({ x: wx, z: wz, hw: ww / 2, hd: wd / 2 });
  }
  if (spec.chimney !== 'none') {
    const s = spec.chimney === 'left' ? -1 : 1;
    addChimney(g, style, s * bw * 0.28, H + rise * 0.35, s * bd * 0.08, 1.15 + (spec.doorSlot % 2) * 0.3, spec.chimneyClr);
  }
  if (spec.pots) {
    const leaf = mat(style, 'leaf', 'Moss');
    const potM = mat(style, 'building', 'Brick');
    for (const s of [-1, 1]) {
      const px = cols[spec.doorSlot] + s * 0.85;
      g.add(cyl(0.2, 0.15, 0.32, potM, [px, 0.16, bd / 2 + 0.55], { segments: 6 }));
      g.add(box(0.32, 0.22, 0.32, leaf, [px, 0.42, bd / 2 + 0.55]));
      g.add(box(0.2, 0.16, 0.2, mat(style, 'leaf', 'Sage'), [px, 0.58, bd / 2 + 0.55]));
    }
  }
  return finish(g, bw, bd, bz, extra);
}

// --- 3. Dutch canal house ---------------------------------------------------

function designDutch(rng, w, d) {
  const gable = pick(rng, ['stepped', 'bell']);
  const storeys = pick(rng, [3, 3, 4, 4, 5]);
  const bw = Math.min(w - 2.1, 4.15 + rng() * 1.2);
  const bd = Math.min(d - 1.6, 6.4 + rng() * 2.6);
  const bz = -d / 2 + bd / 2 + 0.55;
  const wall = pick(rng, [
    ['building', 'Brick'], ['building', 'Cocoa'], ['building', 'Walnut'], ['building', 'Tan'],
    ['building', 'Charcoal'], ['building', 'Off white'],
    ['paint', 'Dusty rose'], ['paint', 'Denim'], ['paint', 'Navy'], ['paint', 'Butter'],
    ['paint', 'Sage'], ['paint', 'Lilac'],
  ]);
  const cols = bw > 4.85 ? pick(rng, [2, 3]) : 2;
  return {
    gable, storeys, bw, bd, bz, wall, cols,
    steps: between(rng, 3, 6),
    bell: pick(rng, ['round', 'neck']),
    trim: pick(rng, ['Off white', 'Paper', 'Stone']),
    roof: pick(rng, SLATE),
    doorSlot: between(rng, 0, cols - 1),
    hoist: chance(rng, 0.78),
    stoop: pick(rng, [0, 2, 3, 3, 4]),
    chimney: chance(rng, 0.32),
    chimneyClr: pick(rng, CHIMNEY_CLR),
    shutters: chance(rng, 0.34),
    boxes: chance(rng, 0.3),
    shutterClr: pick(rng, SHUTTER_PAINT),
    doorClr: pick(rng, DOOR_WOOD),
    flower: flowerName(rng),
    gableH: 2.1 + rng() * 1.15,
    dormer: chance(rng, 0.24),
  };
}

function gableSteps(g, material, bw, baseY, z, n, totalH, topW) {
  const stepH = totalH / n;
  for (let i = 0; i < n; i++) {
    const t = n === 1 ? 1 : i / (n - 1);
    const ww = bw * (1 - t) + topW * t;
    g.add(box(ww, stepH + 0.04, 0.46, material, [0, baseY + (i + 0.5) * stepH, z]));
  }
}

function gableBell(g, material, bw, baseY, z, totalH, kind) {
  const slices = kind === 'neck'
    ? [[1, 0.2], [0.84, 0.14], [0.52, 0.12], [0.46, 0.1], [0.62, 0.14], [0.4, 0.12], [0.2, 0.1], [0.1, 0.08]]
    : [[1, 0.18], [0.86, 0.12], [0.7, 0.12], [0.78, 0.14], [0.56, 0.14], [0.34, 0.14], [0.16, 0.16]];
  const sum = slices.reduce((s, p) => s + p[1], 0);
  let y = 0;
  for (const [scale, frac] of slices) {
    const hh = totalH * (frac / sum);
    g.add(box(bw * scale, hh + 0.03, 0.46, material, [0, baseY + y + hh / 2, z]));
    y += hh;
  }
}

export function dutchCanalHouse(style, rng, w, d) {
  const spec = designDutch(rng, w, d);
  const { bw, bd, bz, storeys } = spec;
  const g = new THREE.Group();
  const FH = 2.8;
  const H = storeys * FH;
  const wall = mat(style, spec.wall[0], spec.wall[1]);
  const trim = mat(style, 'building', spec.trim);
  const roofM = mat(style, 'roof', spec.roof);
  g.add(box(bw, H, bd, wall, [0, H / 2, 0]));
  plinth(g, style, bw, bd, 'Charcoal');
  // roof sits behind the gable parapet, sloping to the sides
  const roofRise = Math.min(bw * 0.32, spec.gableH * 0.55);
  const roof = gable(bd - 0.4, bw + 0.2, roofRise, roofM);
  roof.rotation.y = Math.PI / 2;
  roof.position.set(0, H, -0.2);
  g.add(roof);
  const gz = bd / 2 + 0.02;
  if (spec.gable === 'stepped') {
    gableSteps(g, trim, bw + 0.36, H, gz - 0.12, spec.steps, spec.gableH + 0.16, 0.85);
    gableSteps(g, wall, bw, H, gz + 0.12, spec.steps, spec.gableH, 0.62);
  } else {
    gableBell(g, trim, bw + 0.32, H, gz - 0.12, spec.gableH + 0.12, spec.bell);
    gableBell(g, wall, bw - 0.08, H, gz + 0.12, spec.gableH, spec.bell);
  }
  // white cornice at every floor, the canal-house banding
  for (let f = 1; f <= storeys; f++) g.add(box(bw + 0.12, 0.12, 0.12, trim, [0, f * FH, bd / 2 + 0.06]));
  const cols = xs(spec.cols, bw * 0.86);
  const doorLift = spec.stoop * 0.12;
  const shutterMat = spec.shutters ? mat(style, 'paint', spec.shutterClr) : null;
  for (let f = 0; f < storeys; f++) {
    cols.forEach((x, i) => {
      if (f === 0 && i === spec.doorSlot) {
        euroDoor(g, style, { x, y: doorLift, z: bd / 2, color: spec.doorClr, frame: trim, h: 2.15 });
        return;
      }
      const tall = f === storeys - 1 ? 1.35 : 1.55;
      euroWindow(g, style, {
        x, y: f * FH + 1.45, z: bd / 2, w: spec.cols === 3 ? 0.58 : 0.7, h: tall, frame: trim,
        variant: variantAt(x, f + 1), shutters: f === 0 ? shutterMat : null,
        flowers: spec.boxes && f === 1 ? spec.flower : null, facing: 'z',
      });
    });
  }
  for (let s = 0; s < spec.stoop; s++) {
    g.add(box(1.35 + s * 0.18, 0.12, 0.32, mat(style, 'concrete', 'Stone'), [cols[spec.doorSlot], 0.06 + s * 0.12, bd / 2 + 0.28 + s * 0.26]));
  }
  if (spec.hoist) {
    // the beam that stuck out over the canal, oversized so it reads at street distance
    const hy = H + spec.gableH * 0.58;
    beam(g, mat(style, 'wood', 'Walnut'), [0, hy, gz - 0.1], [0, hy, gz + 1.55], 0.22);
    g.add(box(0.1, 0.5, 0.1, mat(style, 'darkMetal', 'Ink'), [0, hy - 0.35, gz + 1.4]));
  }
  // narrow side windows, one per floor, so the flank isn't a blank slab
  for (let f = 0; f < storeys; f += spec.storeys > 4 ? 2 : 1) {
    euroWindow(g, style, { x: bw / 2, y: f * FH + 1.45, z: 0, w: 0.55, h: 1.2, frame: trim, variant: f % 4, facing: 'x', flowers: null });
  }
  if (spec.chimney) addChimney(g, style, 0, H + roofRise - 0.2, -bd * 0.15, 1.1, spec.chimneyClr);
  if (spec.dormer) {
    // a small dormer on the side slope, behind the gable parapet
    const x = bw * 0.22;
    const y = H + roofRise * (1 - x / (bw / 2)) - 0.05;
    g.add(box(0.55, 0.7, 0.85, wall, [x, y + 0.3, -0.15]));
    euroWindow(g, style, { x: x + 0.28, y: y + 0.32, z: -0.15, w: 0.42, h: 0.5, frame: trim, variant: 1, facing: 'x', sill: false });
  }
  return finish(g, bw, bd, bz);
}

// --- 4. French country house ------------------------------------------------

function designFrench(rng, w, d) {
  const storeys = pick(rng, [1, 2, 2, 2]);
  const { bw, bd, bz } = lot(w, d, 9.6, 7.6, rng(), rng());
  const winN = pick(rng, [3, 3, 4, 5, 3]);
  return {
    storeys, bw, bd, bz,
    winN: Math.min(winN, Math.max(3, Math.floor(bw / 1.45))),
    wall: pick(rng, ['Off white', 'Paper', 'Stone', 'Light gray', 'Tan']),
    roof: pick(rng, ['Slate', 'Charcoal', 'Ink', 'Gray']),
    steep: 1.45 + rng() * 1.05,
    cap: 0.35 + rng() * 0.35,
    dormers: pick(rng, [2, 2, 3, 3, 1, 4, 0]),
    doorMode: pick(rng, ['center', 'center', 'center', 'left', 'right']),
    shutters: chance(rng, 0.88),
    boxes: chance(rng, 0.78),
    shutterClr: pick(rng, SHUTTER_PAINT),
    chimneys: pick(rng, [1, 1, 2, 2, 0]),
    chimneyClr: pick(rng, CHIMNEY_CLR),
    balcony: storeys > 1 && chance(rng, 0.38),
    doorClr: pick(rng, DOOR_WOOD),
    flower: flowerName(rng),
    quoin: chance(rng, 0.55),
  };
}

export function frenchCountryHouse(style, rng, w, d) {
  const spec = designFrench(rng, w, d);
  const { bw, bd, bz, storeys } = spec;
  const g = new THREE.Group();
  const FH = 3.0;
  const H = storeys * FH;
  const wall = mat(style, 'building', spec.wall);
  const roofM = mat(style, 'roof', spec.roof);
  const frame = mat(style, 'building', spec.wall === 'Tan' ? 'Off white' : 'Paper');
  const shutterMat = spec.shutters ? mat(style, 'paint', spec.shutterClr) : null;
  g.add(box(bw, H, bd, wall, [0, H / 2, 0]));
  plinth(g, style, bw, bd, 'Stone');
  if (spec.quoin) cornerBoards(g, mat(style, 'building', 'Off white'), bw, bd, H, 0.16);
  const inset = Math.min(bw, bd) * 0.2;
  const inset2 = Math.min(bw, bd) * 0.07;
  const mansard = mansardRoof(bw + 0.4, bd + 0.4, spec.steep, spec.cap, inset, inset2, roofM);
  mansard.position.y = H;
  g.add(mansard);
  const n = spec.winN;
  const cols = xs(n, bw);
  const mid = (n - 1) / 2;
  const doorIndex = spec.doorMode === 'left' ? 0 : spec.doorMode === 'right' ? n - 1 : Math.round(mid);
  cols.forEach((x, i) => {
    if (i === doorIndex) {
      euroDoor(g, style, { x, z: bd / 2, color: spec.doorClr, frame, h: 2.2 });
      return;
    }
    euroWindow(g, style, {
      x, y: 1.45, z: bd / 2, w: 0.78, h: 1.25, frame, variant: variantAt(x, 1),
      shutters: shutterMat, flowers: spec.boxes ? spec.flower : null, facing: 'z',
    });
  });
  if (storeys > 1) {
    cols.forEach((x, i) => {
      const frenchDoor = spec.balcony && i === doorIndex;
      euroWindow(g, style, {
        x, y: FH + 1.45, z: bd / 2, w: 0.74, h: frenchDoor ? 1.85 : 1.2, frame, variant: variantAt(x, 4),
        shutters: frenchDoor ? null : shutterMat,
        flowers: spec.boxes && !frenchDoor && i % 2 === 0 ? spec.flower : null,
        facing: 'z',
      });
      if (frenchDoor) ironBalcony(g, style, x, FH + 0.12, bd / 2, 1.05);
    });
  }
  euroWindow(g, style, { x: bw / 2, y: 1.5, z: -0.2, w: 0.7, h: 1.15, frame, variant: 1, shutters: shutterMat, facing: 'x' });
  euroWindow(g, style, { x: -bw / 2, y: 1.5, z: 0.4, w: 0.7, h: 1.15, frame, variant: 2, shutters: shutterMat, facing: '-x' });
  const dormerN = Math.min(spec.dormers, Math.max(0, n - 1));
  xs(Math.max(dormerN, 1), bw * 0.72).forEach((x, i) => {
    if (i >= dormerN) return;
    const t = 0.48;
    const dy = H + spec.steep * t;
    const dz = bd / 2 + 0.2 - inset * t;
    g.add(box(0.95, 0.85, 0.75, wall, [x, dy + 0.15, dz]));
    const dr = gable(0.9, 1.15, 0.48, roofM);
    dr.rotation.y = Math.PI / 2;
    dr.position.set(x, dy + 0.55, dz);
    g.add(dr);
    euroWindow(g, style, { x, y: dy + 0.18, z: dz + 0.38, w: 0.5, h: 0.62, frame, variant: i % 4, facing: 'z', sill: false });
  });
  if (spec.chimneys >= 1) addChimney(g, style, -bw * 0.32, H + spec.steep + spec.cap - 0.45, 0, 1.35, spec.chimneyClr);
  if (spec.chimneys >= 2) addChimney(g, style, bw * 0.32, H + spec.steep + spec.cap - 0.5, 0.2, 1.15, spec.chimneyClr);
  return finish(g, bw, bd, bz);
}

// --- 5. Scandinavian house --------------------------------------------------

function designScandi(rng, w, d) {
  const storeys = pick(rng, [1, 1, 2, 2, 2]);
  const { bw, bd, bz } = lot(w, d, 9, 7.2, rng(), rng());
  const winN = between(rng, 2, Math.min(4, Math.max(2, Math.floor(bw / 1.75))));
  return {
    storeys, bw, bd, bz, winN,
    wall: pick(rng, [
      ['paint', 'Dusty rose'], ['paint', 'Dusty rose'], ['paint', 'Butter'], ['paint', 'Butter'],
      ['paint', 'Apricot'], ['building', 'Brick'],
    ]),
    trim: pick(rng, ['Off white', 'Paper']),
    roof: pick(rng, ['Charcoal', 'Slate', 'Ink', 'Walnut']),
    endGable: chance(rng, 0.62),
    doorSlot: between(rng, 0, winN - 1),
    porch: chance(rng, 0.58),
    chimney: chance(rng, 0.66) ? (chance(rng, 0.5) ? 'left' : 'right') : 'none',
    chimneyClr: pick(rng, CHIMNEY_CLR),
    gableWin: chance(rng, 0.64),
    wing: storeys === 1 && chance(rng, 0.36),
    shutters: chance(rng, 0.3),
    boxes: chance(rng, 0.42),
    shutterClr: pick(rng, ['Off white', 'Paper', 'Charcoal', 'Denim']),
    doorClr: pick(rng, ['Off white', 'Charcoal', 'Walnut', 'Ink']),
    flower: flowerName(rng),
    riseK: 0.4 + rng() * 0.18,
  };
}

export function scandinavianHouse(style, rng, w, d) {
  const spec = designScandi(rng, w, d);
  const { bw, bd, bz, storeys } = spec;
  const g = new THREE.Group();
  const FH = 2.85;
  const H = storeys * FH;
  const wall = mat(style, spec.wall[0], spec.wall[1]);
  const trim = mat(style, 'building', spec.trim);
  const roofM = mat(style, 'roof', spec.roof);
  g.add(box(bw, H, bd, wall, [0, H / 2, 0]));
  plinth(g, style, bw, bd, 'Charcoal');
  cornerBoards(g, trim, bw, bd, H, 0.16);
  const rise = (spec.endGable ? bw : bd) * spec.riseK;
  pitched(g, roofM, bw, bd, H, rise, spec.endGable);
  bargeBoards(g, trim, bw, bd, H, rise, spec.endGable);
  // fascia under the eaves
  if (spec.endGable) {
    g.add(box(0.12, 0.14, bd + 0.9, trim, [-bw / 2 - 0.02, H + 0.02, 0]));
    g.add(box(0.12, 0.14, bd + 0.9, trim, [bw / 2 + 0.02, H + 0.02, 0]));
  } else {
    g.add(box(bw + 0.95, 0.14, 0.12, trim, [0, H + 0.02, bd / 2 + 0.32]));
    g.add(box(bw + 0.95, 0.14, 0.12, trim, [0, H + 0.02, -bd / 2 - 0.32]));
  }
  const cols = xs(spec.winN, bw * 0.9);
  const shutterMat = spec.shutters ? mat(style, 'paint', spec.shutterClr) : null;
  const flowers = spec.boxes ? spec.flower : null;
  cols.forEach((x, i) => {
    if (i === spec.doorSlot) {
      euroDoor(g, style, { x, z: bd / 2, color: spec.doorClr, frame: trim, h: 2.1 });
      if (spec.porch) {
        g.add(box(0.1, 2.15, 0.1, trim, [x - 0.85, 1.08, bd / 2 + 0.7]));
        g.add(box(0.1, 2.15, 0.1, trim, [x + 0.85, 1.08, bd / 2 + 0.7]));
        const hood = gable(1.5, 2.05, 0.55, roofM);
        hood.rotation.y = Math.PI / 2;
        hood.position.set(x, 2.15, bd / 2 + 0.7);
        g.add(hood);
        beam(g, trim, [x - 1.05, 2.15, bd / 2 + 1.15], [x, 2.68, bd / 2 + 0.7], 0.1);
        beam(g, trim, [x + 1.05, 2.15, bd / 2 + 1.15], [x, 2.68, bd / 2 + 0.7], 0.1);
      }
      return;
    }
    euroWindow(g, style, {
      x, y: 1.45, z: bd / 2, w: 0.85, h: 1.15, frame: trim, variant: variantAt(x, 2),
      shutters: shutterMat, flowers, facing: 'z',
    });
  });
  if (storeys > 1) {
    cols.forEach((x, i) => {
      if (i === spec.doorSlot && spec.porch) return;
      euroWindow(g, style, {
        x, y: FH + 1.35, z: bd / 2, w: 0.8, h: 1.05, frame: trim, variant: variantAt(x, 5),
        shutters: shutterMat, flowers: spec.boxes && i % 2 === 0 ? flowers : null, facing: 'z',
      });
    });
  }
  if (spec.gableWin) {
    if (spec.endGable) euroWindow(g, style, { x: 0, y: H + rise * 0.42, z: bd / 2 + 0.42, w: 0.7, h: 0.8, frame: trim, glass: 'plain', facing: 'z' });
    else euroWindow(g, style, { x: bw / 2 + 0.02, y: H + rise * 0.4, z: 0, w: 0.6, h: 0.7, frame: trim, glass: 'plain', facing: 'x', sill: false });
  }
  euroWindow(g, style, { x: bw / 2, y: 1.45, z: bd * 0.12, w: 0.75, h: 1.05, frame: trim, variant: 1, facing: 'x' });
  euroWindow(g, style, { x: -bw / 2, y: 1.45, z: -bd * 0.1, w: 0.75, h: 1.05, frame: trim, variant: 3, facing: '-x' });
  const extra = [];
  if (spec.wing) {
    const ww = Math.min(3.2, bw * 0.4), wd = bd * 0.55, wh = FH * 0.85;
    const wx = -bw / 2 - ww / 2 + 0.15, wz = -bd * 0.12;
    g.add(box(ww, wh, wd, wall, [wx, wh / 2, wz]));
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      g.add(box(0.1, wh, 0.1, trim, [wx + sx * ww / 2, wh / 2, wz + sz * wd / 2]));
    }
    const wr = gable(ww + 0.4, wd + 0.45, 0.85, roofM);
    wr.position.set(wx, wh, wz);
    g.add(wr);
    euroWindow(g, style, { x: wx, y: 1.2, z: wz + wd / 2, w: 0.6, h: 0.8, frame: trim, variant: 0, facing: 'z' });
    extra.push({ x: wx, z: wz, hw: ww / 2, hd: wd / 2 });
  }
  if (spec.chimney !== 'none') chimneyOnRidge(g, style, bw, bd, H, rise, spec.endGable, spec.chimney, spec.chimneyClr, 1.5);
  return finish(g, bw, bd, bz, extra);
}

// --- 6. Stone chapel --------------------------------------------------------

function designChapel(rng, w, d) {
  const bw = Math.min(w - 2, 4.8 + rng() * 1.7);
  const bd = Math.min(d - 1.5, 7.6 + rng() * 3.2);
  const bz = -d / 2 + bd / 2 + 0.6;
  return {
    bw, bd, bz,
    stone: pick(rng, STONE),
    trim: pick(rng, ['Off white', 'Paper', 'Light gray']),
    roof: pick(rng, ['Slate', 'Charcoal', 'Walnut', 'Ink']),
    tower: pick(rng, ['bellcote', 'bellcote', 'west', 'west']),
    towerSide: side(rng),
    sideN: between(rng, 2, 4),
    frontN: pick(rng, [1, 1, 2]),
    buttress: chance(rng, 0.72),
    door: chance(rng, 0.82) ? 'center' : (chance(rng, 0.5) ? 'left' : 'right'),
    rose: chance(rng, 0.4),
    doorClr: pick(rng, ['Walnut', 'Charcoal', 'Ink']),
  };
}

function bellcote(g, style, x, y, z, stone, roofM) {
  const pier = 0.38, gap = 0.72, h = 1.85, t = 0.48;
  const span = gap + pier * 2;
  for (const s of [-1, 1]) g.add(box(pier, h, t, stone, [x + s * (gap / 2 + pier / 2), y + h / 2, z]));
  g.add(box(span, 0.28, t, stone, [x, y + h + 0.08, z]));
  g.add(cyl(0.16, 0.22, 0.32, mat(style, 'darkMetal', 'Charcoal'), [x, y + h * 0.5, z], { segments: 6 }));
  const cap = gable(t + 0.25, span + 0.35, 0.6, roofM);
  cap.rotation.y = Math.PI / 2;
  cap.position.set(x, y + h + 0.2, z);
  g.add(cap);
  g.add(box(0.08, 0.5, 0.08, mat(style, 'metal', 'Stone'), [x, y + h + 0.95, z]));
  g.add(box(0.32, 0.08, 0.08, mat(style, 'metal', 'Stone'), [x, y + h + 1.05, z]));
}

function cross(g, style, x, y, z) {
  const m = mat(style, 'metal', 'Light gray');
  g.add(box(0.08, 0.55, 0.08, m, [x, y, z]));
  g.add(box(0.32, 0.08, 0.08, m, [x, y + 0.1, z]));
}

export function stoneChapel(style, rng, w, d) {
  const spec = designChapel(rng, w, d);
  const { bw, bd, bz } = spec;
  const g = new THREE.Group();
  const H = 4.3 + (spec.frontN === 2 ? 0.4 : 0);
  const stone = mat(style, 'building', spec.stone);
  const trim = mat(style, 'building', spec.trim);
  const roofM = mat(style, 'roof', spec.roof);
  g.add(box(bw, H, bd, stone, [0, H / 2, 0]));
  plinth(g, style, bw, bd, 'Charcoal');
  const rise = bw * 0.62;
  pitched(g, roofM, bw, bd, H, rise, true);
  const doorX = spec.door === 'center' ? 0 : spec.door === 'left' ? -bw * 0.22 : bw * 0.22;
  let towerZ = null;
  // the door and the big window stay on the nave, so a tower never eats the front
  euroDoor(g, style, { x: doorX, z: bd / 2, color: spec.doorClr, frame: trim, point: 0.65, h: 2.2 });
  if (spec.tower === 'west') {
    // a solid corner tower. The nave roof runs into the shaft (a real chapel does this);
    // an open cage of posts read as a broken frame stuck through the roof.
    const tw = 2.15, td = 2.15;
    // mostly beside the front corner, so the door and the pointed window stay visible
    const tx = spec.towerSide * (bw / 2 + 0.45);
    const tz = bd / 2 - 0.15;
    const tH = H + rise + 1.7;
    towerZ = { tw, td, tz, tx };
    g.add(box(tw, tH, td, stone, [tx, tH / 2, tz]));
    const bellY = H + rise + 0.35;
    euroWindow(g, style, { x: tx, y: bellY, z: tz + td / 2, w: 0.5, h: 0.7, point: 0.4, frame: trim, glass: 'plain', mullion: false, sill: false, facing: 'z' });
    euroWindow(g, style, { x: tx + spec.towerSide * (tw / 2), y: bellY, z: tz, w: 0.46, h: 0.65, point: 0.35, frame: trim, glass: 'plain', mullion: false, sill: false, facing: spec.towerSide > 0 ? 'x' : '-x' });
    g.add(cyl(0.14, 0.2, 0.28, mat(style, 'darkMetal', 'Charcoal'), [tx, bellY, tz + td / 2 + 0.16], { segments: 6 }));
    const cap = pyramid(tw + 0.4, td + 0.4, 1.15, roofM);
    cap.position.set(tx, tH, tz);
    g.add(cap);
    cross(g, style, tx, tH + 1.35, tz);
  } else {
    bellcote(g, style, 0, H + rise - 0.15, 0, stone, roofM);
    cross(g, style, 0, H + rise + 0.15, bd / 2 + 0.15);
  }
  const lancetY = 3.55;
  if (spec.frontN === 1) {
    euroWindow(g, style, { x: doorX === 0 ? 0 : -doorX, y: lancetY, z: bd / 2, w: 0.72, h: 1.15, point: 0.85, frame: trim, glass: 'plain', mullion: false, sill: false, facing: 'z' });
  } else {
    for (const s of [-1, 1]) {
      euroWindow(g, style, { x: s * bw * 0.22, y: lancetY, z: bd / 2, w: 0.48, h: 1.15, point: 0.75, frame: trim, glass: 'plain', mullion: false, sill: false, facing: 'z' });
    }
  }
  if (spec.rose && spec.tower !== 'west') {
    const ry = H + rise * 0.42;
    g.add(disc(0.42, 0.08, trim, [0, ry, bd / 2 + 0.05], 8));
    g.add(disc(0.28, 0.06, style.material('window'), [0, ry, bd / 2 + 0.1], 8));
  }
  const sideXs = xs(spec.sideN, bd * 0.7);
  sideXs.forEach((z, i) => {
    euroWindow(g, style, { x: bw / 2, y: 2.15, z, w: 0.48, h: 1.15, point: 0.7, frame: trim, glass: 'plain', mullion: false, sill: false, facing: 'x' });
    if (i % 2 === 0) euroWindow(g, style, { x: -bw / 2, y: 2.15, z, w: 0.48, h: 1.15, point: 0.7, frame: trim, glass: 'plain', mullion: false, sill: false, facing: '-x' });
  });
  if (spec.buttress) {
    const zs = [-bd * 0.28, bd * 0.18];
    for (const z of zs) for (const sx of [-1, 1]) {
      const b = box(0.55, 2.3, 0.7, stone, [sx * (bw / 2 + 0.12), 1.05, z]);
      b.rotation.z = sx * -0.22;
      g.add(b);
    }
  }
  // a small pointed window in the back gable, so the far end reads too
  euroWindow(g, style, { x: 0, y: 2.4, z: -bd / 2, w: 0.55, h: 1.1, point: 0.75, frame: trim, glass: 'plain', mullion: false, sill: false, facing: '-z' });
  const extra = [];
  if (towerZ) extra.push({ x: towerZ.tx, z: towerZ.tz, hw: towerZ.tw / 2, hd: towerZ.td / 2 });
  return finish(g, bw, bd, bz, extra);
}

/** Catalogue entries: [builder, label, lot width, lot depth]. Not placed in the town. */
export const EUROPE_BUILDINGS = {
  tudorCottage: [tudorCottage, 'Tudor cottage', 10, 11],
  mediterraneanVilla: [mediterraneanVilla, 'Mediterranean villa', 12, 12],
  dutchCanalHouse: [dutchCanalHouse, 'Dutch canal house', 8, 13],
  frenchCountryHouse: [frenchCountryHouse, 'French country house', 12, 12],
  scandinavianHouse: [scandinavianHouse, 'Scandinavian house', 11, 11],
  stoneChapel: [stoneChapel, 'Stone chapel', 10, 14],
};
