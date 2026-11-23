import * as THREE from 'three';
import { PALETTE } from '../styles/palette.js';
import { mulberry32 } from '../lib/rng.js';
import { lobe, shadeMaterial } from '../lib/foliage.js';
import { mergeByMaterial } from '../lib/merge.js';
import manifest from '../../public/classroom-kit/manifest.json';
import { classroomPlan } from './arrange.js';

// A Japanese classroom, in the same boxes and cylinders as the office kit.
// Built here, not loaded, so createAsset stays synchronous. Every colour is
// `role:Swatch` through style.material, so palette swaps, the PS1 wobble and
// the outline flag all apply.
//
// The green board uses paint:Moss so it stays a colour when the building
// rule snaps wood and concrete to greys and browns. No readable lettering:
// the board is chalk strokes, the cubbies hold plain bags. Cylinder sides
// are the kit's own counts (already the PS1 0.3× detail).
//
// Room: 9 m wide (x) by 7 m deep (z), origin at the bottom centre, front
// facing +z. The teaching wall is -z, so the blackboard reads in the
// isometric view. The floor sits 2 cm above y = 0. Cutaway hides the +z and
// +x walls.

const P = Math.PI;
const SLAB_TOP = 0.02;
const TILE_TOP = SLAB_TOP + 0.05;

const WIN = { w: 2.15, h: 1.4, d: 0.1 };
const DOOR = { w: 1.16, h: 2.2, d: 0.1 };
const LIP = 0.05;
const TH = 0.14;

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

const BUILDERS = {
  student_desk(g, style) {
    const wood = mat(style, 'wood:Tan');
    const metal = mat(style, 'darkMetal:Charcoal');
    addBox(g, 0.62, 0.035, 0.42, wood, [0, 0.722, 0]);
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) addBox(g, 0.03, 0.7, 0.03, metal, [sx * 0.27, 0.35, sz * 0.17]);
    }
    addBox(g, 0.5, 0.14, 0.025, wood, [0, 0.58, -0.16]);
    addBox(g, 0.025, 0.14, 0.3, wood, [-0.24, 0.58, -0.02]);
    addBox(g, 0.025, 0.14, 0.3, wood, [0.24, 0.58, -0.02]);
    addBox(g, 0.5, 0.02, 0.3, wood, [0, 0.5, -0.02]);
  },
  student_chair(g, style) {
    const wood = mat(style, 'wood:Tan');
    const metal = mat(style, 'darkMetal:Charcoal');
    for (const sx of [-1, 1]) {
      addBox(g, 0.028, 0.42, 0.028, metal, [sx * 0.15, 0.21, 0.13]);
      addBox(g, 0.028, 0.74, 0.028, metal, [sx * 0.15, 0.37, -0.13]);
    }
    addBox(g, 0.34, 0.03, 0.32, wood, [0, 0.43, 0.01]);
    addBox(g, 0.32, 0.14, 0.025, wood, [0, 0.66, -0.14]);
    addBox(g, 0.3, 0.025, 0.24, metal, [0, 0.16, 0]);
  },
  podium(g, style) {
    const wood = mat(style, 'wood:Walnut');
    const top = mat(style, 'wood:Tan');
    addBox(g, 0.58, 1.0, 0.4, wood, [0, 0.5, 0]);
    addBox(g, 0.64, 0.04, 0.46, top, [0, 1.02, 0.02]);
    addBox(g, 0.36, 0.012, 0.2, mat(style, 'paint:Off white'), [0, 1.046, 0.05]);
  },
  teacher_desk(g, style) {
    const wood = mat(style, 'wood:Tan');
    const dark = mat(style, 'wood:Walnut');
    addBox(g, 1.4, 0.04, 0.7, wood, [0, 0.74, 0]);
    addBox(g, 1.28, 0.62, 0.58, dark, [0, 0.4, -0.02]);
    addBox(g, 1.2, 0.012, 0.012, mat(style, 'paint:Paper'), [0, 0.4, 0.275]);
    for (const sx of [-1, 1]) addBox(g, 0.04, 0.08, 0.04, dark, [sx * 0.62, 0.04, 0.28]);
  },
  teacher_chair(g, style) {
    const wood = mat(style, 'wood:Walnut');
    const seat = mat(style, 'wood:Tan');
    for (const sx of [-1, 1]) {
      addBox(g, 0.04, 0.46, 0.04, wood, [sx * 0.2, 0.23, 0.16]);
      addBox(g, 0.04, 0.9, 0.04, wood, [sx * 0.2, 0.45, -0.16]);
      addBox(g, 0.04, 0.16, 0.32, wood, [sx * 0.22, 0.52, 0]);
    }
    addBox(g, 0.42, 0.05, 0.4, seat, [0, 0.48, 0]);
    addBox(g, 0.4, 0.32, 0.04, wood, [0, 0.74, -0.17]);
  },
  blackboard(g, style) {
    const frame = mat(style, 'wood:Walnut');
    const board = mat(style, 'paint:Moss');
    const chalk = mat(style, 'paint:Off white');
    addBox(g, 3.2, 1.22, 0.05, frame, [0, 0.7, 0.025]);
    addBox(g, 3.02, 1.02, 0.012, board, [0, 0.74, 0.052]);
    addBox(g, 3.1, 0.06, 0.1, frame, [0, 0.06, 0.06]);
    addBox(g, 0.9, 0.02, 0.008, chalk, [-0.7, 0.95, 0.064]);
    addBox(g, 0.55, 0.02, 0.008, chalk, [0.15, 0.7, 0.064]);
    addBox(g, 0.4, 0.018, 0.008, mat(style, 'paint:Butter'), [-0.2, 0.55, 0.064]);
    addBox(g, 0.12, 0.025, 0.025, chalk, [-1.15, 0.075, 0.1]);
    addBox(g, 0.1, 0.025, 0.025, mat(style, 'paint:Butter'), [-1.0, 0.075, 0.1]);
    addBox(g, 0.16, 0.04, 0.05, mat(style, 'paint:Charcoal'), [1.2, 0.1, 0.09]);
  },
  cubbies(g, style, look = {}) {
    const wood = mat(style, 'wood:Tan');
    const dark = mat(style, 'wood:Walnut');
    const W = 1.7;
    const H = 1.18;
    const D = 0.36;
    addBox(g, W, H, 0.025, dark, [0, H / 2, -0.155]);
    addBox(g, W, 0.03, D, wood, [0, 0.015, 0.01]);
    addBox(g, W, 0.03, D, wood, [0, H - 0.015, 0.01]);
    addBox(g, W, 0.03, D, wood, [0, H / 2, 0.01]);
    addBox(g, 0.03, H, D, wood, [-W / 2 + 0.015, H / 2, 0.01]);
    addBox(g, 0.03, H, D, wood, [W / 2 - 0.015, H / 2, 0.01]);
    for (const x of [-0.42, 0, 0.42]) addBox(g, 0.025, H - 0.06, D - 0.04, wood, [x, H / 2, 0.01]);
    const colors = look.bags || ['cloth:Navy', 'cloth:Dusty rose', 'cloth:Sage', 'paint:Butter', 'cloth:Denim'];
    const bags = [[-0.63, 0.32], [-0.2, 0.3], [0.63, 0.34], [-0.62, 0.86], [0.2, 0.88]];
    bags.forEach(([x, y], i) => addBox(g, 0.26, 0.28, 0.2, mat(style, colors[i]), [x, y, 0.03]));
  },
  clock(g, style) {
    const frame = mat(style, 'wood:Walnut');
    const face = mat(style, 'paint:Off white');
    const ink = mat(style, 'darkMetal:Ink');
    addCyl(g, 0.2, 0.2, 0.04, frame, [0, 0.2, 0.03], { seg: 8, rot: [P / 2, 0, 0] });
    addCyl(g, 0.16, 0.16, 0.012, face, [0, 0.2, 0.052], { seg: 8, rot: [P / 2, 0, 0] });
    addCyl(g, 0.018, 0.018, 0.012, ink, [0, 0.2, 0.062], { seg: 5, rot: [P / 2, 0, 0] });
    const hand = (len, ang, z, w) => {
      addBox(g, w, len, 0.006, ink, [-Math.sin(ang) * len / 2, 0.2 + Math.cos(ang) * len / 2, z], [0, 0, ang]);
    };
    hand(0.09, 1.0, 0.066, 0.016);
    hand(0.13, -1.05, 0.072, 0.012);
  },
  sliding_door(g, style) {
    const wood = mat(style, 'wood:Walnut');
    const paper = mat(style, 'paint:Paper');
    const glass = mat(style, 'glass:Sky');
    const { w, h, d } = DOOR;
    const jb = 0.06;
    addBox(g, jb, h, d, wood, [-w / 2 + jb / 2, h / 2, 0]);
    addBox(g, jb, h, d, wood, [w / 2 - jb / 2, h / 2, 0]);
    addBox(g, w, jb, d, wood, [0, h - jb / 2, 0]);
    addBox(g, w, 0.08, d, wood, [0, 0.04, 0]);
    const dw = w - jb * 2;
    addBox(g, dw, h - 0.2, 0.04, paper, [0, h / 2, 0]);
    addBox(g, dw, 0.08, 0.05, wood, [0, 0.7, 0]);
    addBox(g, dw, 0.08, 0.05, wood, [0, 1.55, 0]);
    addBox(g, dw * 0.7, 0.42, 0.012, glass, [0, 1.85, 0.01]);
    addBox(g, 0.16, 0.03, 0.04, mat(style, 'metal:Stone'), [0.12, 1.05, d / 2]);
  },
  window(g, style) {
    const frame = mat(style, 'metal:Light gray');
    const glass = mat(style, 'glass:Sky');
    const { w, h, d } = WIN;
    const b = 0.06;
    addBox(g, w, b, d, frame, [0, b / 2, 0]);
    addBox(g, w, b, d, frame, [0, h - b / 2, 0]);
    addBox(g, b, h, d, frame, [-w / 2 + b / 2, h / 2, 0]);
    addBox(g, b, h, d, frame, [w / 2 - b / 2, h / 2, 0]);
    addBox(g, 0.04, h - b * 2, d * 0.55, frame, [-w * 0.18, h / 2, 0]);
    addBox(g, 0.04, h - b * 2, d * 0.55, frame, [w * 0.18, h / 2, 0]);
    addBox(g, w - b * 2 + 0.02, h - b * 2 + 0.02, 0.012, glass, [0, h / 2, 0]);
    addBox(g, w + 0.06, 0.045, 0.1, frame, [0, 0.02, d / 2 + 0.02]);
  },
  globe(g, style) {
    const stand = mat(style, 'wood:Walnut');
    addCyl(g, 0.1, 0.12, 0.03, stand, [0, 0.015, 0], { seg: 6 });
    addBox(g, 0.025, 0.22, 0.025, stand, [0, 0.14, 0]);
    addBox(g, 0.02, 0.22, 0.02, stand, [0, 0.26, 0]);
    const ball = new THREE.Mesh(new THREE.IcosahedronGeometry(0.1, 0), mat(style, 'paint:Powder blue'));
    ball.position.set(0, 0.28, 0);
    g.add(ball);
    addBox(g, 0.012, 0.2, 0.012, mat(style, 'paint:Sage'), [0.04, 0.28, 0.02]);
  },
  books(g, style) {
    const stack = [
      [0.22, 0.03, 0.16, 0.015, 'paint:Navy'],
      [0.2, 0.028, 0.15, 0.044, 'paint:Dusty rose'],
      [0.21, 0.025, 0.155, 0.07, 'paint:Sage'],
      [0.18, 0.02, 0.14, 0.092, 'paint:Butter'],
    ];
    for (const [w, h, d, y, key] of stack) addBox(g, w, h, d, mat(style, key), [0, y, 0]);
  },
  pencil_cup(g, style) {
    addCyl(g, 0.04, 0.045, 0.08, mat(style, 'paint:Off white'), [0, 0.04, 0], { seg: 6 });
    const pens = [[-0.012, 'paint:Navy'], [0.008, 'paint:Dusty rose'], [0.0, 'paint:Butter']];
    pens.forEach(([x, key], i) => addBox(g, 0.012, 0.1, 0.012, mat(style, key), [x, 0.1, (i - 1) * 0.012]));
  },
  bin(g, style) {
    addBox(g, 0.32, 0.4, 0.26, mat(style, 'paint:Light gray'), [0, 0.2, 0]);
    addBox(g, 0.3, 0.02, 0.24, mat(style, 'darkMetal:Charcoal'), [0, 0.41, 0]);
  },
  broom(g, style) {
    addCyl(g, 0.012, 0.012, 1.15, mat(style, 'wood:Tan'), [0, 0.7, 0], { seg: 5 });
    addBox(g, 0.28, 0.06, 0.04, mat(style, 'wood:Walnut'), [0, 0.12, 0]);
    addBox(g, 0.26, 0.1, 0.025, mat(style, 'paint:Sand'), [0, 0.05, 0.01]);
  },
  plant(g, style, look = {}) {
    addCyl(g, 0.14, 0.11, 0.24, mat(style, 'paint:' + (look.pot || 'Apricot')), [0, 0.12, 0], { seg: 6 });
    addCyl(g, 0.12, 0.12, 0.02, mat(style, 'wood:Walnut'), [0, 0.24, 0], { seg: 6 });
    [[0, 0.46, 0, 0.14], [0.1, 0.36, 0.05, 0.11], [-0.08, 0.34, -0.04, 0.1]].forEach(
      ([x, y, z, r], i) => addLobe(g, style, r, i % 2 ? 'leaf:Moss' : 'leaf:Sage', [x, y, z], [1, 0.8, 1], 90 + i),
    );
  },
};

const LABELS = {
  student_desk: 'Student desk',
  student_chair: 'Student chair',
  podium: 'Teacher podium',
  teacher_desk: 'Teacher desk',
  teacher_chair: 'Teacher chair',
  blackboard: 'Blackboard',
  cubbies: 'Cubby lockers',
  clock: 'Wall clock',
  sliding_door: 'Sliding door',
  window: 'Classroom window',
  globe: 'Globe',
  books: 'Book stack',
  pencil_cup: 'Pencil cup',
  bin: 'Waste bin',
  broom: 'Broom',
  plant: 'Corner plant',
};

const NO_HIT = new Set();
const BACK = new Set(['blackboard', 'clock']);

function hitFor(name, footprint) {
  if (NO_HIT.has(name)) return [];
  const [w, d] = footprint;
  if (BACK.has(name)) return [{ z: d / 2, hw: w / 2, hd: d / 2 }];
  return [{ hw: w / 2, hd: d / 2 }];
}

/** One catalogue row per kit item, in manifest order. */
export const CLASSROOM_ITEMS = Object.entries(manifest.items).map(([name, item]) => ({
  name,
  id: `classroom.${name}`,
  label: LABELS[name] ?? item.label,
  kitGroup: item.group,
  size: item.footprint,
  hit: hitFor(name, item.footprint),
}));

/** A kit item standing on y = 0, facing +z. Geometry is its own (safe to dispose). */
export function buildClassroomItem(name, style, look) {
  const build = BUILDERS[name];
  if (!build) throw new Error(`Unknown classroom item "${name}"`);
  const g = new THREE.Group();
  g.name = name;
  build(g, style, look || {});
  g.userData.classroomItem = name;
  return g;
}

const RH = 3;

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
    trim(band, 0.028, rail, band - 0.014, band + 0.014);
  }
}

/**
 * The whole classroom (9 × 7 m). `cutaway` hides the front (+z) and side (+x)
 * walls so the inside reads from the isometric catalogue camera.
 * Meshes are merged per material.
 */
export function buildClassroomRoom(style, { cutaway = false, seed = 0 } = {}) {
  const plan = classroomPlan(seed);
  const body = new THREE.Group();
  const front = new THREE.Group();
  const side = new THREE.Group();
  const hits = [];

  // One solid wood floor. No planks.
  const floorH = TILE_TOP - SLAB_TOP;
  addBox(body, 9, floorH, 7, mat(style, 'wood:Tan'), [0, (SLAB_TOP + TILE_TOP) / 2, 0]);
  addBox(body, 9, 0.22, 7, mat(style, 'concrete:Gray'), [0, SLAB_TOP - 0.11, 0]);
  // Low teaching platform along the blackboard wall.
  addBox(body, 5.6, 0.08, 1.45, mat(style, 'wood:Tan'), [0.35, TILE_TOP + 0.04, -2.55]);

  const hole = (a0, a1, y0, h) => ({ a0: a0 + LIP, a1: a1 - LIP, y0: y0 + LIP, y1: y0 + h - LIP });
  const doorZ = 2.45;
  const doorSpan = [doorZ - DOOR.w / 2, doorZ + DOOR.w / 2];
  const leftHoles = [{ a0: doorSpan[0], a1: doorSpan[1], y0: 0, y1: DOOR.h - LIP }];
  const sideWins = [[-2.55, -2.55 + WIN.w], [0.55, 0.55 + WIN.w]];
  const sideHoles = sideWins.map(([a0, a1]) => hole(a0, a1, 0.9, WIN.h));

  const wallColors = { low: 'wood:Walnut', high: 'paint:Off white', band: 0.14, rail: 'wood:Tan' };
  splitWall(body, style, { axis: 'x', a0: -4.5, a1: 4.5, fix: -3.43, y1: RH, holes: [], hits, inward: 1, ...wallColors });
  splitWall(body, style, { axis: 'z', a0: -3.5, a1: 3.5, fix: -4.43, y1: RH, holes: leftHoles, hits, inward: 1, ...wallColors });
  splitWall(front, style, { axis: 'x', a0: -4.5, a1: 4.5, fix: 3.43, y1: RH, holes: [], hits: cutaway ? null : hits, inward: -1, ...wallColors });
  splitWall(side, style, { axis: 'z', a0: -3.5, a1: 3.5, fix: 4.43, y1: RH, holes: sideHoles, hits: cutaway ? null : hits, inward: -1, ...wallColors });

  const place = (group, name, x, y, z, rotY) => {
    const item = buildClassroomItem(name, style);
    item.position.set(x, y, z);
    item.rotation.y = rotY;
    group.add(item);
  };
  place(body, 'sliding_door', -4.43, 0, doorZ, P / 2);
  hits.push({ x: -4.43, z: doorZ, hw: DOOR.d / 2, hd: DOOR.w / 2 });
  sideWins.forEach(([a0, a1]) => place(side, 'window', 4.43, 0.9, (a0 + a1) / 2, P / 2));

  for (const p of plan.placements) {
    const item = buildClassroomItem(p.item, style, plan.look);
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
  room.name = 'tiny_classroom';
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
