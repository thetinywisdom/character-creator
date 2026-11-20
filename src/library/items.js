import * as THREE from 'three';
import { PALETTE } from '../styles/palette.js';
import { mulberry32 } from '../lib/rng.js';
import { lobe, shadeMaterial } from '../lib/foliage.js';
import { mergeByMaterial } from '../lib/merge.js';
import manifest from '../../public/library-kit/manifest.json';
import { libraryPlan } from './arrange.js';

// A neighbourhood library, in the same boxes and cylinders as the cafe.
// Built here so createAsset stays synchronous. Every colour is `role:Swatch`
// through style.material. Cylinder sides use the kit's own counts (already
// the PS1 0.3× detail) and are not passed through seg(). Books are colour
// blocks, not letters.
//
// Room: 10 m wide (x) by 8 m deep (z), origin at the bottom centre, front
// facing +z. The floor sits 2 cm above y = 0. Cutaway hides the +z and +x walls.

const P = Math.PI;
const SLAB_TOP = 0.02;
const TILE_TOP = SLAB_TOP + 0.05;
const WIN = { w: 1.7, h: 1.35, d: 0.1 };
const DOOR = { w: 1.05, h: 2.2, d: 0.1 };
const LIP = 0.05;
const TH = 0.14;
const RW = 10;
const RD = 8;
const RH = 3.2;

const glassOf = new WeakMap();

function mat(style, key) {
  const i = key.indexOf(':');
  const role = key.slice(0, i);
  const swatch = key.slice(i + 1);
  if (role === 'glass' && swatch === 'Sky') {
    let m = glassOf.get(style);
    if (!m) {
      m = style.material('glass', PALETTE.Sky).clone();
      m.transparent = true;
      m.opacity = 0.28;
      m.depthWrite = false;
      m.userData.role = 'glass';
      glassOf.set(style, m);
    }
    return m;
  }
  return style.material(role, PALETTE[swatch]);
}

function addBox(g, w, h, d, material, pos, rot) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
  m.position.set(pos[0], pos[1], pos[2]);
  if (rot) m.rotation.set(rot[0] || 0, rot[1] || 0, rot[2] || 0);
  g.add(m);
}

function addCyl(g, rTop, rBottom, h, material, pos, { seg = 6, rot = null } = {}) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(rTop, rBottom, h, seg), material);
  m.position.set(pos[0], pos[1], pos[2]);
  if (rot) m.rotation.set(rot[0] || 0, rot[1] || 0, rot[2] || 0);
  g.add(m);
}

function addLobe(g, style, r, key, pos, scale, seed) {
  g.add(lobe(shadeMaterial(mat(style, key)), r, mulberry32(seed), pos, { scale }));
}

function bookRow(g, style, y, colours, span = 0.92) {
  const slice = span / colours.length;
  colours.forEach((key, i) => {
    const h = 0.2 + (i % 3) * 0.02;
    addBox(g, slice - 0.015, h, 0.16, mat(style, key), [-span / 2 + slice * (i + 0.5), y + h / 2, 0.06]);
  });
}

const BUILDERS = {
  shelf_bay(g, style) {
    const wood = mat(style, 'wood:Walnut');
    for (const sx of [-1, 1]) addBox(g, 0.04, 1.85, 0.36, wood, [sx * 0.54, 0.925, 0]);
    addBox(g, 1.12, 1.7, 0.02, wood, [0, 0.95, -0.16]);
    for (const y of [0.08, 0.5, 0.92, 1.34, 1.76]) addBox(g, 1.04, 0.03, 0.32, wood, [0, y, 0]);
    bookRow(g, style, 0.1, ['paint:Navy', 'paint:Dusty rose', 'paint:Sage', 'paint:Butter']);
    bookRow(g, style, 0.52, ['paint:Apricot', 'paint:Powder blue', 'paint:Cocoa', 'paint:Paper']);
    bookRow(g, style, 0.94, ['paint:Sage', 'paint:Brick', 'paint:Lilac', 'paint:Tan']);
    bookRow(g, style, 1.36, ['paint:Denim', 'paint:Blush', 'paint:Moss', 'paint:Sand']);
  },
  low_shelf(g, style) {
    const wood = mat(style, 'wood:Tan');
    for (const sx of [-1, 1]) addBox(g, 0.04, 0.72, 0.32, wood, [sx * 0.73, 0.36, 0]);
    addBox(g, 1.5, 0.03, 0.32, wood, [0, 0.16, 0]);
    addBox(g, 1.5, 0.03, 0.32, wood, [0, 0.46, 0]);
    addBox(g, 1.5, 0.03, 0.32, wood, [0, 0.7, 0]);
    bookRow(g, style, 0.18, ['paint:Butter', 'paint:Sky', 'paint:Dusty rose', 'paint:Sage', 'paint:Apricot'], 1.28);
    bookRow(g, style, 0.48, ['paint:Lilac', 'paint:Paper', 'paint:Mint', 'paint:Peach', 'paint:Powder blue'], 1.28);
  },
  table(g, style) {
    const top = mat(style, 'wood:Walnut');
    const leg = mat(style, 'wood:Tan');
    addBox(g, 1.1, 0.04, 0.68, top, [0, 0.74, 0]);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) addBox(g, 0.04, 0.72, 0.04, leg, [sx * 0.46, 0.36, sz * 0.26]);
  },
  chair(g, style) {
    const wood = mat(style, 'wood:Tan');
    const dark = mat(style, 'wood:Walnut');
    for (const sx of [-1, 1]) {
      addBox(g, 0.035, 0.42, 0.035, dark, [sx * 0.15, 0.21, 0.13]);
      addBox(g, 0.035, 0.8, 0.035, dark, [sx * 0.15, 0.4, -0.13]);
    }
    addBox(g, 0.34, 0.04, 0.34, wood, [0, 0.44, 0]);
    addBox(g, 0.3, 0.28, 0.03, wood, [0, 0.66, -0.14]);
  },
  lamp(g, style, look = {}) {
    const shade = mat(style, 'paint:' + (look.shade || 'Butter'));
    const dark = mat(style, 'darkMetal:Charcoal');
    addBox(g, 0.12, 0.02, 0.12, dark, [0, 0.01, 0]);
    addCyl(g, 0.015, 0.015, 0.28, dark, [0, 0.16, 0], { seg: 5 });
    addCyl(g, 0.08, 0.1, 0.1, shade, [0, 0.34, 0], { seg: 6 });
    addCyl(g, 0.04, 0.04, 0.02, mat(style, 'light:Butter'), [0, 0.3, 0], { seg: 5 });
  },
  desk(g, style) {
    const wood = mat(style, 'wood:Walnut');
    addBox(g, 1.5, 0.06, 0.66, wood, [0, 0.74, 0]);
    addBox(g, 1.42, 0.62, 0.58, mat(style, 'wood:Tan'), [0, 0.4, 0]);
    addBox(g, 0.7, 0.08, 0.5, wood, [-0.3, 0.55, 0]);
  },
  cart(g, style) {
    const steel = mat(style, 'metal:Light gray');
    const wood = mat(style, 'wood:Tan');
    for (const sx of [-1, 1]) addBox(g, 0.03, 0.85, 0.03, steel, [sx * 0.28, 0.42, 0]);
    addBox(g, 0.6, 0.03, 0.38, wood, [0, 0.32, 0]);
    addBox(g, 0.6, 0.03, 0.38, wood, [0, 0.62, 0]);
    addBox(g, 0.5, 0.1, 0.28, mat(style, 'paint:Navy'), [0, 0.4, 0]);
    addBox(g, 0.46, 0.08, 0.26, mat(style, 'paint:Sage'), [0, 0.7, 0]);
    addCyl(g, 0.04, 0.04, 0.03, mat(style, 'darkMetal:Ink'), [-0.2, 0.04, 0.12], { seg: 6 });
    addCyl(g, 0.04, 0.04, 0.03, mat(style, 'darkMetal:Ink'), [0.2, 0.04, -0.12], { seg: 6 });
  },
  magazine(g, style) {
    const wood = mat(style, 'wood:Walnut');
    addBox(g, 0.85, 0.08, 0.26, wood, [0, 0.04, 0]);
    addBox(g, 0.8, 0.7, 0.04, wood, [0, 0.45, -0.08]);
    const colours = ['paint:Dusty rose', 'paint:Sky', 'paint:Butter', 'paint:Sage', 'paint:Lilac'];
    colours.forEach((key, i) => addBox(g, 0.1, 0.42, 0.012, mat(style, key), [-0.28 + i * 0.14, 0.4, 0.02]));
  },
  cushion(g, style, look = {}) {
    addCyl(g, 0.2, 0.2, 0.08, mat(style, 'cloth:' + (look.cushion || 'Dusty rose')), [0, 0.06, 0], { seg: 6 });
    addCyl(g, 0.1, 0.1, 0.02, mat(style, 'cloth:Paper'), [0, 0.11, 0], { seg: 5 });
  },
  plant(g, style, look = {}) {
    addCyl(g, 0.13, 0.1, 0.22, mat(style, 'paint:' + (look.pot || 'Sage')), [0, 0.11, 0], { seg: 6 });
    [[0, 0.4, 0, 0.13], [0.08, 0.3, 0.04, 0.1], [-0.07, 0.28, -0.02, 0.09]].forEach(([x, y, z, r], i) => {
      addLobe(g, style, r, i % 2 ? 'leaf:Moss' : 'leaf:Sage', [x, y, z], [1, 0.85, 1], 21 + i);
    });
  },
  book(g, style) {
    addBox(g, 0.18, 0.03, 0.24, mat(style, 'paint:Navy'), [0, 0.015, 0]);
    addBox(g, 0.16, 0.025, 0.22, mat(style, 'paint:Paper'), [0.01, 0.04, 0]);
  },
  window(g, style) {
    const frame = mat(style, 'wood:Walnut');
    const glass = mat(style, 'glass:Sky');
    const { w, h, d } = WIN;
    const b = 0.06;
    addBox(g, w, b, d, frame, [0, b / 2, 0]);
    addBox(g, w, b, d, frame, [0, h - b / 2, 0]);
    addBox(g, b, h, d, frame, [-w / 2 + b / 2, h / 2, 0]);
    addBox(g, b, h, d, frame, [w / 2 - b / 2, h / 2, 0]);
    addBox(g, 0.035, h - b * 2, d * 0.5, frame, [0, h / 2, 0]);
    addBox(g, w - b * 2, h - b * 2, 0.012, glass, [0, h / 2, 0]);
  },
  door(g, style) {
    const wood = mat(style, 'wood:Walnut');
    const { w, h, d } = DOOR;
    const jb = 0.07;
    addBox(g, jb, h, d, wood, [-w / 2 + jb / 2, h / 2, 0]);
    addBox(g, jb, h, d, wood, [w / 2 - jb / 2, h / 2, 0]);
    addBox(g, w, jb, d, wood, [0, h - jb / 2, 0]);
    const dw = w - jb * 2;
    addBox(g, dw, 0.85, 0.045, wood, [0, 0.45, 0]);
    addBox(g, dw - 0.1, 1.05, 0.012, mat(style, 'glass:Sky'), [0, 1.5, 0]);
    addBox(g, dw, 0.05, 0.05, wood, [0, 0.95, 0]);
    addBox(g, 0.03, 0.12, 0.03, mat(style, 'metal:Stone'), [dw / 2 - 0.08, 1.0, d / 2]);
  },
};

const LABELS = {
  shelf_bay: 'Bookshelf bay',
  low_shelf: 'Low shelf',
  table: 'Reading table',
  chair: 'Reading chair',
  lamp: 'Table lamp',
  desk: 'Front desk',
  cart: 'Return cart',
  magazine: 'Magazine rack',
  cushion: 'Floor cushion',
  plant: 'Floor plant',
  book: 'Book',
  window: 'Library window',
  door: 'Library door',
};

const NO_HIT = new Set(['lamp', 'book']);

function hitFor(name, footprint) {
  if (NO_HIT.has(name)) return [];
  const [w, d] = footprint;
  return [{ hw: w / 2, hd: d / 2 }];
}

/** One catalogue row per kit item, in manifest order. */
export const LIBRARY_ITEMS = Object.entries(manifest.items).map(([name, item]) => ({
  name,
  id: `library.${name}`,
  label: LABELS[name] ?? item.label,
  kitGroup: item.group,
  size: item.footprint,
  hit: hitFor(name, item.footprint),
}));

/** A kit item standing on y = 0, facing +z. */
export function buildLibraryItem(name, style, look) {
  const build = BUILDERS[name];
  if (!build) throw new Error(`Unknown library item "${name}"`);
  const g = new THREE.Group();
  g.name = name;
  build(g, style, look || {});
  g.userData.libraryItem = name;
  return g;
}

function splitWall(g, style, { axis, a0, a1, fix, y1, holes, hits, inward, low, high, band, rail }) {
  const cuts = [a0, a1];
  for (const h of holes) cuts.push(Math.max(a0, Math.min(a1, h.a0)), Math.max(a0, Math.min(a1, h.a1)));
  cuts.sort((p, q) => p - q);
  const edges = [];
  for (const v of cuts) if (!edges.length || v - edges.at(-1) > 1e-3) edges.push(v);
  const put = (a, b, y0, y, depth, fixPos, key, hit) => {
    const span = b - a;
    const height = y - y0;
    if (span < 1e-3 || height < 1e-3) return;
    const mid = (a + b) / 2;
    const ym = (y0 + y) / 2;
    const pos = axis === 'x' ? [mid, ym, fixPos] : [fixPos, ym, mid];
    const size = axis === 'x' ? [span, height, depth] : [depth, height, span];
    addBox(g, size[0], size[1], size[2], mat(style, key), pos);
    if (hit && hits && y0 < 0.35) {
      hits.push(axis === 'x'
        ? { x: mid, z: fixPos, hw: span / 2, hd: depth / 2 }
        : { x: fixPos, z: mid, hw: depth / 2, hd: span / 2 });
    }
  };
  for (let i = 0; i < edges.length - 1; i++) {
    const a = edges[i];
    const b = edges[i + 1];
    const mid = (a + b) / 2;
    const spans = holes.filter((h) => mid > h.a0 + 1e-4 && mid < h.a1 - 1e-4).map((h) => [h.y0, h.y1]).sort((p, q) => p[0] - q[0]);
    const emit = (y0, yEnd) => {
      if (yEnd <= y0 + 1e-4) return;
      const lowY = Math.min(yEnd, band);
      if (lowY > y0) put(a, b, y0, lowY, TH, fix, low, true);
      if (yEnd > band) put(a, b, Math.max(y0, band), yEnd, TH, fix, high, true);
    };
    let y = 0;
    for (const [hy0, hy1] of spans) { emit(y, Math.min(hy0, y1)); y = Math.max(y, hy1); }
    emit(y, y1);
    const openAt = (level) => spans.some(([hy0, hy1]) => hy0 < level && hy1 > level);
    if (rail && !openAt(band)) {
      const fixPos = fix + inward * (TH / 2 - 0.004 + 0.012);
      put(a, b, band - 0.012, band + 0.012, 0.024, fixPos, rail, false);
    }
  }
}

/**
 * The whole library (10 × 8 m). `cutaway` hides the front (+z) and side (+x)
 * walls. The floor is one solid colour.
 */
export function buildLibraryRoom(style, { cutaway = false, seed = 0 } = {}) {
  const plan = libraryPlan(seed);
  const body = new THREE.Group();
  const front = new THREE.Group();
  const side = new THREE.Group();
  const hits = [];
  const floorH = TILE_TOP - SLAB_TOP;
  addBox(body, RW, floorH, RD, mat(style, 'wood:Tan'), [0, (SLAB_TOP + TILE_TOP) / 2, 0]);
  addBox(body, RW, 0.22, RD, mat(style, 'concrete:Gray'), [0, SLAB_TOP - 0.11, 0]);

  const hole = (a0, a1, y0, h) => ({ a0: a0 + LIP, a1: a1 - LIP, y0: y0 + LIP, y1: y0 + h - LIP });
  const frontWins = [[-3.4, -3.4 + WIN.w], [-1.2, -1.2 + WIN.w]];
  const doorSpan = [0.78, 0.78 + DOOR.w];
  const frontHoles = [
    ...frontWins.map(([a0, a1]) => hole(a0, a1, 0.95, WIN.h)),
    { a0: doorSpan[0], a1: doorSpan[1], y0: 0, y1: DOOR.h - LIP },
  ];
  const leftWins = [[-2.7, -2.7 + WIN.w], [1.3, 1.3 + WIN.w]];
  const leftHoles = leftWins.map(([a0, a1]) => hole(a0, a1, 0.95, WIN.h));
  const wallColors = { low: 'wood:Walnut', high: 'paint:Paper', band: 0.9, rail: 'wood:Tan' };
  const fixX = RW / 2 - TH / 2;
  const fixZ = RD / 2 - TH / 2;

  splitWall(body, style, { axis: 'x', a0: -RW / 2, a1: RW / 2, fix: -fixZ, y1: RH, holes: [], hits, inward: 1, ...wallColors });
  splitWall(body, style, { axis: 'z', a0: -RD / 2, a1: RD / 2, fix: -fixX, y1: RH, holes: leftHoles, hits, inward: 1, ...wallColors });
  splitWall(front, style, { axis: 'x', a0: -RW / 2, a1: RW / 2, fix: fixZ, y1: RH, holes: frontHoles, hits: cutaway ? null : hits, inward: -1, ...wallColors });
  splitWall(side, style, { axis: 'z', a0: -RD / 2, a1: RD / 2, fix: fixX, y1: RH, holes: [], hits: cutaway ? null : hits, inward: -1, ...wallColors });

  const place = (group, name, x, y, z, rotY) => {
    const item = buildLibraryItem(name, style);
    item.position.set(x, y, z);
    item.rotation.y = rotY;
    group.add(item);
  };
  frontWins.forEach(([a0, a1]) => place(front, 'window', (a0 + a1) / 2, 0.95, fixZ, 0));
  const doorX = (doorSpan[0] + doorSpan[1]) / 2;
  place(front, 'door', doorX, 0, fixZ, 0);
  leftWins.forEach(([a0, a1]) => place(body, 'window', -fixX, 0.95, (a0 + a1) / 2, P / 2));
  if (!cutaway) hits.push({ x: doorX, z: fixZ, hw: DOOR.w / 2, hd: DOOR.d / 2 });

  for (const p of plan.placements) {
    const item = buildLibraryItem(p.item, style, plan.look);
    item.position.set(p.x, p.y + TILE_TOP, p.z);
    item.rotation.y = p.rotY || 0;
    body.add(item);
    if (p.y < 0.05 && !NO_HIT.has(p.item)) {
      const [w, d] = manifest.items[p.item].footprint;
      const c = Math.abs(Math.cos(p.rotY || 0));
      const s = Math.abs(Math.sin(p.rotY || 0));
      hits.push({ x: p.x, z: p.z, hw: (w / 2) * c + (d / 2) * s, hd: (w / 2) * s + (d / 2) * c });
    }
  }

  const room = new THREE.Group();
  room.name = 'tiny_library';
  const shell = mergeByMaterial(body);
  shell.name = 'room_shell';
  room.add(shell);
  const frontWall = mergeByMaterial(front);
  frontWall.name = 'room_wall_front';
  frontWall.visible = !cutaway;
  room.add(frontWall);
  const sideWall = mergeByMaterial(side);
  sideWall.name = 'room_wall_side';
  sideWall.visible = !cutaway;
  room.add(sideWall);
  return { group: room, colliders: hits };
}
