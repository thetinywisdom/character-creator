import * as THREE from 'three';
import { PALETTE } from '../styles/palette.js';
import { mergeByMaterial } from '../lib/merge.js';
import manifest from '../../public/dojo-kit/manifest.json';
import { dojoPlan } from './arrange.js';

// A 9 × 9 m dojo that can lean toward a gym. Built here, not loaded, so
// createAsset stays synchronous. Every colour is `role:Swatch` through
// style.material, so palette swaps, the PS1 wobble and the outline flag
// all apply. Cylinder sides use the kit's own low segment counts.
//
// Origin at the bottom centre, front facing +z. The floor sits 2 cm above
// y = 0. Cutaway hides the +z and +x walls. The wood floor is one solid
// colour. The tatami is one solid sage slab, with no seams inside it.

const P = Math.PI;
const SLAB_TOP = 0.02;
const TILE_TOP = SLAB_TOP + 0.05;

const WIN = { w: 1.46, h: 1.12, d: 0.1 };
const DOOR = { w: 1.2, h: 2.16, d: 0.08 };
const LIP = 0.05;
const TH = 0.14;

const glassOf = new WeakMap();
const mirrorOf = new WeakMap();

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
  if (role === 'glass' && swatch === 'Powder blue') {
    let m = mirrorOf.get(style);
    if (!m) {
      m = style.material('glass', PALETTE['Powder blue']).clone();
      m.transparent = true;
      m.opacity = 0.55;
      m.depthWrite = false;
      m.userData.role = 'glass';
      mirrorOf.set(style, m);
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

const BUILDERS = {
  tatami(g, style) {
    // Catalogue sample: one solid mat. The room itself is a single slab.
    addBox(g, 1.8, 0.028, 0.9, mat(style, 'paint:Sage'), [0, 0.016, 0]);
  },
  dummy(g, style) {
    const wood = mat(style, 'wood:Walnut');
    const pad = mat(style, 'cloth:Navy');
    const sand = mat(style, 'cloth:Sand');
    addBox(g, 0.32, 0.04, 0.32, wood, [0, 0.02, 0]);
    addBox(g, 0.08, 1.05, 0.08, wood, [0, 0.56, 0]);
    addBox(g, 0.28, 0.36, 0.16, pad, [0, 1.05, 0.02]);
    addBox(g, 0.14, 0.14, 0.14, sand, [0, 1.32, 0.02]);
    addBox(g, 0.22, 0.05, 0.05, wood, [-0.16, 1.08, 0]);
    addBox(g, 0.22, 0.05, 0.05, wood, [0.16, 1.08, 0]);
  },
  scroll(g, style) {
    const wood = mat(style, 'wood:Walnut');
    const paper = mat(style, 'paint:Paper');
    const ink = mat(style, 'paint:Navy');
    addBox(g, 0.66, 0.04, 0.04, wood, [0, 1.02, 0.02]);
    addBox(g, 0.56, 0.92, 0.012, paper, [0, 0.52, 0.02]);
    addBox(g, 0.36, 0.42, 0.012, ink, [0, 0.58, 0.028]);
    addBox(g, 0.62, 0.035, 0.035, wood, [0, 0.04, 0.02]);
  },
  mat_stack(g, style) {
    // Folded mats in a corner. One sage colour; the steps are the stack, not floor seams.
    const sage = mat(style, 'paint:Sage');
    const tie = mat(style, 'cloth:Sand');
    addBox(g, 0.7, 0.045, 0.46, sage, [0, 0.025, 0]);
    addBox(g, 0.66, 0.045, 0.44, sage, [0.02, 0.07, 0]);
    addBox(g, 0.62, 0.045, 0.42, sage, [-0.015, 0.115, 0]);
    addBox(g, 0.58, 0.04, 0.4, sage, [0.01, 0.155, 0]);
    addBox(g, 0.04, 0.16, 0.42, tie, [0, 0.09, 0]);
  },
  kamidana(g, style) {
    const wood = mat(style, 'wood:Walnut');
    const paper = mat(style, 'paint:Off white');
    const gold = mat(style, 'paint:Butter');
    const leaf = mat(style, 'paint:Moss');
    addBox(g, 1.15, 0.05, 0.32, wood, [0, 0.025, 0.16]);
    addBox(g, 1.05, 0.5, 0.03, wood, [0, 0.3, 0.02]);
    addBox(g, 1.25, 0.04, 0.38, wood, [0, 0.58, 0.16]);
    for (const x of [-0.48, 0.48]) addBox(g, 0.045, 0.42, 0.045, wood, [x, 0.24, 0.26]);
    addBox(g, 0.28, 0.3, 0.14, wood, [0, 0.22, 0.12]);
    addBox(g, 0.14, 0.1, 0.012, gold, [0, 0.22, 0.195]);
    addBox(g, 0.1, 0.06, 0.08, paper, [-0.28, 0.08, 0.18]);
    addBox(g, 0.08, 0.1, 0.08, leaf, [0.28, 0.1, 0.16]);
    for (const x of [-0.16, 0, 0.16]) addBox(g, 0.045, 0.12, 0.012, paper, [x, 0.46, 0.18]);
  },
  bokken_rack(g, style) {
    const wood = mat(style, 'wood:Walnut');
    const blade = mat(style, 'wood:Tan');
    addBox(g, 1.12, 0.05, 0.24, wood, [0, 0.025, 0]);
    for (const x of [-0.5, 0.5]) addBox(g, 0.045, 1.02, 0.045, wood, [x, 0.53, 0]);
    addBox(g, 1.02, 0.04, 0.04, wood, [0, 0.96, 0]);
    addBox(g, 1.02, 0.035, 0.035, wood, [0, 0.42, 0]);
    for (const x of [-0.3, -0.1, 0.12, 0.32]) {
      addBox(g, 0.035, 0.78, 0.016, blade, [x, 0.52, 0.03], [0.08, 0, 0]);
      addBox(g, 0.05, 0.1, 0.02, wood, [x, 0.14, 0.01]);
    }
  },
  punching_bag(g, style, look = {}) {
    const bag = mat(style, 'cloth:' + (look.bag || 'Navy'));
    const band = mat(style, 'paint:Sand');
    const metal = mat(style, 'darkMetal:Charcoal');
    addBox(g, 0.34, 0.04, 0.12, metal, [0, 2.98, 0]);
    addCyl(g, 0.012, 0.012, 0.62, metal, [0, 2.64, 0], { seg: 4 });
    addCyl(g, 0.2, 0.2, 1.05, bag, [0, 1.72, 0], { seg: 8 });
    addCyl(g, 0.21, 0.21, 0.07, band, [0, 2.05, 0], { seg: 8 });
    addCyl(g, 0.14, 0.1, 0.1, bag, [0, 1.14, 0], { seg: 8 });
  },
  weight_bench(g, style) {
    const pad = mat(style, 'cloth:Navy');
    const metal = mat(style, 'darkMetal:Charcoal');
    const iron = mat(style, 'metal:Slate');
    addBox(g, 1.16, 0.07, 0.32, pad, [-0.02, 0.46, 0]);
    addBox(g, 0.22, 0.06, 0.22, pad, [0.52, 0.5, 0]);
    for (const x of [-0.42, 0.28]) {
      for (const z of [-0.12, 0.12]) addBox(g, 0.04, 0.44, 0.04, metal, [x, 0.22, z]);
    }
    for (const z of [-0.14, 0.14]) addBox(g, 0.04, 0.42, 0.04, metal, [0.52, 0.68, z]);
    addBox(g, 0.04, 0.04, 0.32, metal, [0.52, 0.88, 0]);
    addBox(g, 0.7, 0.035, 0.035, metal, [0.1, 0.9, 0]);
    for (const x of [-0.22, 0.42]) addBox(g, 0.06, 0.16, 0.16, iron, [x, 0.9, 0]);
  },
  dumbbell_rack(g, style) {
    const metal = mat(style, 'darkMetal:Charcoal');
    const iron = mat(style, 'metal:Slate');
    const grip = mat(style, 'darkMetal:Ink');
    for (const x of [-0.38, 0.38]) addBox(g, 0.04, 0.86, 0.04, metal, [x, 0.43, 0]);
    for (const y of [0.28, 0.55, 0.8]) addBox(g, 0.8, 0.03, 0.26, metal, [0, y, 0]);
    for (const [x, y] of [[-0.18, 0.36], [0.18, 0.36], [-0.18, 0.64], [0.18, 0.64]]) {
      addBox(g, 0.14, 0.045, 0.045, grip, [x, y, 0]);
      addBox(g, 0.045, 0.08, 0.08, iron, [x - 0.07, y, 0]);
      addBox(g, 0.045, 0.08, 0.08, iron, [x + 0.07, y, 0]);
    }
  },
  shoe_shelf(g, style) {
    const wood = mat(style, 'wood:Walnut');
    const shoe = mat(style, 'paint:Ink');
    const sole = mat(style, 'paint:Charcoal');
    addBox(g, 1.04, 0.035, 0.3, wood, [0, 0.18, 0]);
    addBox(g, 1.04, 0.035, 0.3, wood, [0, 0.46, 0]);
    for (const x of [-0.48, 0.48]) addBox(g, 0.04, 0.5, 0.28, wood, [x, 0.25, 0]);
    for (const [x, y] of [[-0.26, 0.22], [0.05, 0.22], [0.28, 0.5]]) {
      addBox(g, 0.16, 0.05, 0.07, shoe, [x, y, 0.04]);
      addBox(g, 0.16, 0.05, 0.07, sole, [x, y, -0.05]);
    }
  },
  mirror(g, style) {
    const frame = mat(style, 'wood:Walnut');
    const glass = mat(style, 'glass:Powder blue');
    const w = 2.4;
    const h = 1.7;
    addBox(g, w, 0.06, 0.04, frame, [0, 0.03, 0.02]);
    addBox(g, w, 0.06, 0.04, frame, [0, h - 0.03, 0.02]);
    addBox(g, 0.06, h, 0.04, frame, [-w / 2 + 0.03, h / 2, 0.02]);
    addBox(g, 0.06, h, 0.04, frame, [w / 2 - 0.03, h / 2, 0.02]);
    addBox(g, w - 0.1, h - 0.1, 0.012, glass, [0, h / 2, 0.028]);
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
    addBox(g, 0.04, h - b * 2, d * 0.55, frame, [0, h / 2, 0]);
    addBox(g, w - b * 2 + 0.02, h - b * 2 + 0.02, 0.012, glass, [0, h / 2, 0]);
    addBox(g, w + 0.08, 0.04, 0.08, frame, [0, 0.02, d / 2 + 0.02]);
  },
  sliding_door(g, style) {
    const wood = mat(style, 'wood:Walnut');
    const paper = mat(style, 'paint:Paper');
    const { w, h, d } = DOOR;
    const jb = 0.06;
    addBox(g, jb, h, d, wood, [-w / 2 + jb / 2, h / 2, 0]);
    addBox(g, jb, h, d, wood, [w / 2 - jb / 2, h / 2, 0]);
    addBox(g, w, jb, d, wood, [0, h - jb / 2, 0]);
    addBox(g, w, 0.08, d, wood, [0, 0.04, 0]);
    const dw = w - jb * 2;
    addBox(g, dw / 2 - 0.02, h - 0.2, 0.04, paper, [-dw / 4, h / 2, 0]);
    addBox(g, dw / 2 - 0.02, h - 0.2, 0.04, paper, [dw / 4, h / 2, 0]);
    addBox(g, 0.04, h - 0.18, 0.05, wood, [0, h / 2, 0]);
    addBox(g, dw, 0.05, 0.05, wood, [0, 0.72, 0]);
    addBox(g, 0.1, 0.03, 0.04, mat(style, 'metal:Stone'), [0.16, 1.0, d / 2]);
  },
};

const LABELS = {
  tatami: 'Tatami mat',
  kamidana: 'Kamidana shrine',
  bokken_rack: 'Bokken rack',
  punching_bag: 'Punching bag',
  weight_bench: 'Weight bench',
  dumbbell_rack: 'Dumbbell rack',
  shoe_shelf: 'Shoe shelf',
  mirror: 'Mirror wall',
  window: 'Dojo window',
  sliding_door: 'Sliding door',
  dummy: 'Training dummy',
  scroll: 'Wall scroll',
  mat_stack: 'Stacked mats',
};

const NO_HIT = new Set(['scroll']);
const BACK = new Set(['kamidana', 'mirror', 'scroll']);

function hitFor(name, footprint) {
  if (NO_HIT.has(name)) return [];
  const [w, d] = footprint;
  if (BACK.has(name)) return [{ z: d / 2, hw: w / 2, hd: d / 2 }];
  return [{ hw: w / 2, hd: d / 2 }];
}

/** One catalogue row per kit item, in manifest order. */
export const DOJO_ITEMS = Object.entries(manifest.items).map(([name, item]) => ({
  name,
  id: `dojo.${name}`,
  label: LABELS[name] ?? item.label,
  kitGroup: item.group,
  size: item.footprint,
  hit: hitFor(name, item.footprint),
}));

/** A kit item standing on y = 0, facing +z. */
export function buildDojoItem(name, style, look) {
  const build = BUILDERS[name];
  if (!build) throw new Error(`Unknown dojo item "${name}"`);
  const g = new THREE.Group();
  g.name = name;
  build(g, style, look || {});
  g.userData.dojoItem = name;
  return g;
}

const RH = 3.15;

function splitWall(g, style, { axis, a0, a1, fix, y1, holes, hits, inward, low, high, band, rail }) {
  const cuts = [a0, a1];
  for (const h of holes) {
    cuts.push(Math.max(a0, Math.min(a1, h.a0)), Math.max(a0, Math.min(a1, h.a1)));
  }
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
    const spans = holes
      .filter((h) => mid > h.a0 + 1e-4 && mid < h.a1 - 1e-4)
      .map((h) => [h.y0, h.y1])
      .sort((p, q) => p[0] - q[0]);
    const emit = (y0, yEnd) => {
      if (yEnd <= y0 + 1e-4) return;
      const lowY = Math.min(yEnd, band);
      if (lowY > y0) put(a, b, y0, lowY, TH, fix, low, true);
      if (yEnd > band) put(a, b, Math.max(y0, band), yEnd, TH, fix, high, true);
    };
    let y = 0;
    for (const [hy0, hy1] of spans) {
      emit(y, Math.min(hy0, y1));
      y = Math.max(y, hy1);
    }
    emit(y, y1);
    const openAt = (level) => spans.some(([hy0, hy1]) => hy0 < level && hy1 > level);
    const trim = (level, depth, key, y0, y) => {
      if (!key || openAt(level)) return;
      const fixPos = fix + inward * (TH / 2 - 0.004 + depth / 2);
      put(a, b, y0, y, depth, fixPos, key, false);
    };
    trim(band, 0.03, rail, band - 0.015, band + 0.015);
  }
}

/**
 * The whole dojo (9 × 9 m). `cutaway` hides the front (+z) and side (+x)
 * walls so the inside reads from the isometric catalogue camera.
 */
export function buildDojoRoom(style, { cutaway = false, seed = 0 } = {}) {
  const plan = dojoPlan(seed);
  const body = new THREE.Group();
  const front = new THREE.Group();
  const side = new THREE.Group();
  const hits = [];

  // Wood border, then one solid tatami slab. No seams inside the mat.
  const floorH = TILE_TOP - SLAB_TOP;
  addBox(body, 9, floorH, 9, mat(style, 'wood:Tan'), [0, (SLAB_TOP + TILE_TOP) / 2, 0]);
  addBox(body, 9, 0.22, 9, mat(style, 'concrete:Gray'), [0, SLAB_TOP - 0.11, 0]);
  if (plan.mat) {
    const { x, z, w, d } = plan.mat;
    addBox(body, w, 0.028, d, mat(style, 'paint:Sage'), [x, TILE_TOP + 0.016, z]);
  }

  const hole = (a0, a1, y0, h) => ({ a0: a0 + LIP, a1: a1 - LIP, y0: y0 + LIP, y1: y0 + h - LIP });
  const backWin = [-4.28, -4.28 + WIN.w];
  const backHoles = [hole(backWin[0], backWin[1], 1.2, WIN.h)];
  const doorZ = 3.15;
  const doorSpan = [doorZ - DOOR.w / 2, doorZ + DOOR.w / 2];
  const leftWin = [-2.35, -2.35 + WIN.w];
  const leftHoles = [
    hole(leftWin[0], leftWin[1], 1.15, WIN.h),
    { a0: doorSpan[0], a1: doorSpan[1], y0: 0, y1: DOOR.h - LIP },
  ];
  const rightWins = [[-2.15, -2.15 + WIN.w], [0.85, 0.85 + WIN.w]];
  const rightHoles = rightWins.map(([a0, a1]) => hole(a0, a1, 1.15, WIN.h));
  const frontWins = [[-1.7, -1.7 + WIN.w], [1.55, 1.55 + WIN.w]];
  const frontHoles = frontWins.map(([a0, a1]) => hole(a0, a1, 1.15, WIN.h));

  const wallColors = { low: 'wood:Walnut', high: 'paint:Off white', band: 0.95, rail: 'wood:Tan' };
  splitWall(body, style, { axis: 'x', a0: -4.5, a1: 4.5, fix: -4.43, y1: RH, holes: backHoles, hits, inward: 1, ...wallColors });
  splitWall(body, style, { axis: 'z', a0: -4.5, a1: 4.5, fix: -4.43, y1: RH, holes: leftHoles, hits, inward: 1, ...wallColors });
  splitWall(front, style, { axis: 'x', a0: -4.5, a1: 4.5, fix: 4.43, y1: RH, holes: frontHoles, hits: cutaway ? null : hits, inward: -1, ...wallColors });
  splitWall(side, style, { axis: 'z', a0: -4.5, a1: 4.5, fix: 4.43, y1: RH, holes: rightHoles, hits: cutaway ? null : hits, inward: -1, ...wallColors });

  const place = (group, name, x, y, z, rotY) => {
    const item = buildDojoItem(name, style);
    item.position.set(x, y, z);
    item.rotation.y = rotY;
    group.add(item);
  };
  place(body, 'window', (backWin[0] + backWin[1]) / 2, 1.2, -4.43, 0);
  place(body, 'window', -4.43, 1.15, (leftWin[0] + leftWin[1]) / 2, P / 2);
  place(body, 'sliding_door', -4.43, 0, doorZ, P / 2);
  hits.push({ x: -4.43, z: doorZ, hw: DOOR.d / 2, hd: DOOR.w / 2 });
  place(body, 'kamidana', -1.45, 1.58, -4.36, 0);
  place(body, 'mirror', 1.7, 0.42, -4.36, 0);
  rightWins.forEach(([a0, a1]) => place(side, 'window', 4.43, 1.15, (a0 + a1) / 2, P / 2));
  frontWins.forEach(([a0, a1]) => place(front, 'window', (a0 + a1) / 2, 1.15, 4.43, 0));

  for (const p of plan.placements) {
    const item = buildDojoItem(p.item, style, plan.look);
    item.position.set(p.x, p.y + TILE_TOP, p.z);
    item.rotation.y = p.rotY || 0;
    body.add(item);
    if (p.y < 0.05 && !NO_HIT.has(p.item) && !BACK.has(p.item)) {
      const [w, d] = manifest.items[p.item].footprint;
      const c = Math.abs(Math.cos(p.rotY || 0));
      const s = Math.abs(Math.sin(p.rotY || 0));
      hits.push({ x: p.x, z: p.z, hw: (w / 2) * c + (d / 2) * s, hd: (w / 2) * s + (d / 2) * c });
    }
  }

  const room = new THREE.Group();
  room.name = 'tiny_dojo';
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
