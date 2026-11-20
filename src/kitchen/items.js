import * as THREE from 'three';
import { PALETTE } from '../styles/palette.js';
import { mergeByMaterial } from '../lib/merge.js';
import manifest from '../../public/kitchen-kit/manifest.json';
import { kitchenPlan } from './arrange.js';

// A home kitchen with a dining nook, in the same boxes and cylinders as the
// cafe. Built here so createAsset stays synchronous. Every colour is
// `role:Swatch` through style.material. Cylinder sides use the kit's own
// counts (already the PS1 0.3× detail) and are not passed through seg().
//
// Room: 5 m wide (x) by 4 m deep (z), origin at the bottom centre, front
// facing +z. The floor sits 2 cm above y = 0. Cutaway hides the +z and +x walls.

const P = Math.PI;
const SLAB_TOP = 0.02;
const TILE_TOP = SLAB_TOP + 0.05;
const WIN = { w: 1.46, h: 1.05, d: 0.1 };
const DOOR = { w: 0.92, h: 2.1, d: 0.1 };
const LIP = 0.05;
const TH = 0.14;
const RW = 5;
const RD = 4;
const RH = 2.7;

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

const BUILDERS = {
  run(g, style) {
    const wood = mat(style, 'wood:Tan');
    const top = mat(style, 'paint:Paper');
    addBox(g, 2.62, 0.78, 0.5, wood, [0, 0.44, 0]);
    addBox(g, 2.7, 0.05, 0.56, top, [0, 0.855, 0]);
    addBox(g, 2.62, 0.08, 0.52, mat(style, 'darkMetal:Charcoal'), [0, 0.04, 0]);
    for (const x of [-0.9, 0, 0.9]) addBox(g, 0.02, 0.5, 0.012, mat(style, 'wood:Walnut'), [x, 0.4, 0.25]);
  },
  fridge(g, style) {
    const body = mat(style, 'paint:Off white');
    const dark = mat(style, 'darkMetal:Charcoal');
    addBox(g, 0.62, 1.55, 0.66, body, [0, 0.8, 0]);
    addBox(g, 0.5, 0.02, 0.02, dark, [0, 1.05, 0.34]);
    addBox(g, 0.04, 0.28, 0.03, dark, [0.22, 1.15, 0.34]);
    addBox(g, 0.04, 0.16, 0.03, dark, [0.22, 0.55, 0.34]);
  },
  microwave(g, style) {
    const wood = mat(style, 'wood:Tan');
    const steel = mat(style, 'metal:Light gray');
    for (const sx of [-1, 1]) addBox(g, 0.04, 1.15, 0.04, wood, [sx * 0.2, 0.58, 0]);
    addBox(g, 0.46, 0.03, 0.38, wood, [0, 0.55, 0]);
    addBox(g, 0.46, 0.03, 0.38, wood, [0, 1.12, 0]);
    addBox(g, 0.4, 0.26, 0.3, steel, [0, 0.86, 0]);
    addBox(g, 0.22, 0.16, 0.012, mat(style, 'glass:Navy'), [0.06, 0.86, 0.15]);
    addBox(g, 0.03, 0.08, 0.02, mat(style, 'darkMetal:Ink'), [0.16, 0.84, 0.16]);
  },
  sink(g, style) {
    const steel = mat(style, 'metal:Light gray');
    addBox(g, 0.55, 0.08, 0.42, steel, [0, 0.04, 0]);
    addBox(g, 0.4, 0.08, 0.28, mat(style, 'metal:Stone'), [0, 0.06, 0]);
    addCyl(g, 0.02, 0.02, 0.22, steel, [0.12, 0.18, -0.1], { seg: 5 });
    addBox(g, 0.14, 0.02, 0.04, steel, [0.12, 0.28, -0.02]);
  },
  hob(g, style) {
    const dark = mat(style, 'darkMetal:Ink');
    const steel = mat(style, 'metal:Stone');
    addBox(g, 0.6, 0.06, 0.5, dark, [0, 0.03, 0]);
    addCyl(g, 0.07, 0.07, 0.02, steel, [-0.14, 0.07, -0.06], { seg: 6 });
    addCyl(g, 0.09, 0.09, 0.02, steel, [0.12, 0.07, 0.04], { seg: 6 });
    addBox(g, 0.08, 0.04, 0.08, mat(style, 'darkMetal:Charcoal'), [0.22, 0.08, -0.16]);
  },
  grill(g, style) {
    const dark = mat(style, 'darkMetal:Charcoal');
    addBox(g, 0.42, 0.08, 0.36, dark, [0, 0.04, 0]);
    for (const z of [-0.08, 0, 0.08]) addBox(g, 0.32, 0.015, 0.02, mat(style, 'metal:Stone'), [0, 0.09, z]);
    addBox(g, 0.16, 0.03, 0.08, mat(style, 'paint:Apricot'), [0.04, 0.11, 0]);
  },
  rice(g, style) {
    addCyl(g, 0.13, 0.14, 0.16, mat(style, 'paint:Off white'), [0, 0.1, 0], { seg: 6 });
    addCyl(g, 0.12, 0.12, 0.04, mat(style, 'paint:Paper'), [0, 0.2, 0], { seg: 6 });
    addBox(g, 0.06, 0.02, 0.03, mat(style, 'darkMetal:Charcoal'), [0.08, 0.12, 0.12]);
  },
  dish(g, style) {
    const steel = mat(style, 'metal:Light gray');
    addBox(g, 0.36, 0.16, 0.04, steel, [0, 0.12, -0.1]);
    addBox(g, 0.36, 0.02, 0.26, steel, [0, 0.04, 0]);
    for (const x of [-0.1, 0, 0.1]) addBox(g, 0.012, 0.14, 0.2, mat(style, 'paint:Sky'), [x, 0.12, 0.02]);
  },
  jar(g, style) {
    addCyl(g, 0.05, 0.055, 0.1, mat(style, 'paint:Sage'), [0, 0.06, 0], { seg: 5 });
    addCyl(g, 0.04, 0.04, 0.02, mat(style, 'paint:Walnut'), [0, 0.12, 0], { seg: 5 });
  },
  board(g, style) {
    addBox(g, 0.36, 0.02, 0.24, mat(style, 'wood:Tan'), [0, 0.01, 0]);
  },
  table(g, style) {
    const top = mat(style, 'wood:Walnut');
    const leg = mat(style, 'wood:Walnut');
    addBox(g, 1.1, 0.04, 0.7, top, [0, 0.74, 0]);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) addBox(g, 0.04, 0.72, 0.04, leg, [sx * 0.46, 0.36, sz * 0.28]);
  },
  chair(g, style, look = {}) {
    const wood = mat(style, 'wood:Tan');
    const dark = mat(style, 'wood:Walnut');
    const seat = look.chair === 'cushion' ? mat(style, 'cloth:Dusty rose') : dark;
    for (const sx of [-1, 1]) {
      addBox(g, 0.035, 0.42, 0.035, dark, [sx * 0.16, 0.21, 0.14]);
      addBox(g, 0.035, 0.78, 0.035, dark, [sx * 0.16, 0.39, -0.14]);
    }
    addBox(g, 0.36, 0.04, 0.36, seat, [0, 0.44, 0]);
    addBox(g, 0.32, 0.22, 0.03, wood, [0, 0.64, -0.15]);
  },
  pendant(g, style, look = {}) {
    const shade = mat(style, 'paint:' + (look.shade || 'Butter'));
    addCyl(g, 0.006, 0.006, 0.55, mat(style, 'darkMetal:Ink'), [0, 0.42, 0], { seg: 4 });
    addCyl(g, 0.06, 0.16, 0.12, shade, [0, 0.08, 0], { seg: 6 });
    addCyl(g, 0.06, 0.06, 0.015, mat(style, 'light:Butter'), [0, 0.03, 0], { seg: 6 });
  },
  window(g, style) {
    const frame = mat(style, 'wood:Tan');
    const glass = mat(style, 'glass:Sky');
    const { w, h, d } = WIN;
    const b = 0.05;
    addBox(g, w, b, d, frame, [0, b / 2, 0]);
    addBox(g, w, b, d, frame, [0, h - b / 2, 0]);
    addBox(g, b, h, d, frame, [-w / 2 + b / 2, h / 2, 0]);
    addBox(g, b, h, d, frame, [w / 2 - b / 2, h / 2, 0]);
    addBox(g, w - b * 2, h - b * 2, 0.012, glass, [0, h / 2, 0]);
    addBox(g, 0.03, h - b * 2, d * 0.5, frame, [0, h / 2, 0]);
  },
  door(g, style) {
    const wood = mat(style, 'wood:Tan');
    const { w, h, d } = DOOR;
    const jb = 0.06;
    addBox(g, jb, h, d, wood, [-w / 2 + jb / 2, h / 2, 0]);
    addBox(g, jb, h, d, wood, [w / 2 - jb / 2, h / 2, 0]);
    addBox(g, w, jb, d, wood, [0, h - jb / 2, 0]);
    addBox(g, w - jb * 2, h - jb - 0.04, 0.04, wood, [0, (h - jb) / 2, 0]);
    addBox(g, 0.08, 0.16, 0.012, mat(style, 'glass:Sky'), [0, 1.45, 0.03]);
    addBox(g, 0.025, 0.1, 0.03, mat(style, 'metal:Stone'), [(w - jb * 2) / 2 - 0.08, 1.0, d / 2]);
  },
};

const LABELS = {
  run: 'Cabinet run',
  fridge: 'Fridge',
  microwave: 'Microwave rack',
  sink: 'Sink',
  hob: 'Gas hob',
  grill: 'Fish grill',
  rice: 'Rice cooker',
  dish: 'Dish rack',
  jar: 'Jar',
  board: 'Cutting board',
  table: 'Dining table',
  chair: 'Dining chair',
  pendant: 'Pendant lamp',
  window: 'Kitchen window',
  door: 'Kitchen door',
};

const NO_HIT = new Set(['pendant', 'jar', 'board']);

function hitFor(name, footprint) {
  if (NO_HIT.has(name)) return [];
  const [w, d] = footprint;
  return [{ hw: w / 2, hd: d / 2 }];
}

/** One catalogue row per kit item, in manifest order. */
export const KITCHEN_ITEMS = Object.entries(manifest.items).map(([name, item]) => ({
  name,
  id: `kitchen.${name}`,
  label: LABELS[name] ?? item.label,
  kitGroup: item.group,
  size: item.footprint,
  hit: hitFor(name, item.footprint),
}));

/** A kit item standing on y = 0, facing +z. */
export function buildKitchenItem(name, style, look) {
  const build = BUILDERS[name];
  if (!build) throw new Error(`Unknown kitchen item "${name}"`);
  const g = new THREE.Group();
  g.name = name;
  build(g, style, look || {});
  g.userData.kitchenItem = name;
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
 * The whole kitchen (5 × 4 m). `cutaway` hides the front (+z) and side (+x)
 * walls. The floor is one solid colour.
 */
export function buildKitchenRoom(style, { cutaway = false, seed = 0 } = {}) {
  const plan = kitchenPlan(seed);
  const body = new THREE.Group();
  const front = new THREE.Group();
  const side = new THREE.Group();
  const hits = [];
  const floorH = TILE_TOP - SLAB_TOP;
  addBox(body, RW, floorH, RD, mat(style, 'wood:Tan'), [0, (SLAB_TOP + TILE_TOP) / 2, 0]);
  addBox(body, RW, 0.22, RD, mat(style, 'concrete:Gray'), [0, SLAB_TOP - 0.11, 0]);

  const hole = (a0, a1, y0, h) => ({ a0: a0 + LIP, a1: a1 - LIP, y0: y0 + LIP, y1: y0 + h - LIP });
  const backWin = [-1.85, -1.85 + WIN.w];
  const leftWin = [-0.15, -0.15 + WIN.w];
  const doorSpan = [1.15, 1.15 + DOOR.w];
  const backHoles = [hole(backWin[0], backWin[1], 1.15, WIN.h)];
  const leftHoles = [hole(leftWin[0], leftWin[1], 1.05, WIN.h)];
  const frontHoles = [{ a0: doorSpan[0], a1: doorSpan[1], y0: 0, y1: DOOR.h - LIP }];
  const wallColors = { low: 'wood:Tan', high: 'paint:Paper', band: 0.9, rail: 'wood:Walnut' };
  const fixX = RW / 2 - TH / 2;
  const fixZ = RD / 2 - TH / 2;

  splitWall(body, style, { axis: 'x', a0: -RW / 2, a1: RW / 2, fix: -fixZ, y1: RH, holes: backHoles, hits, inward: 1, ...wallColors });
  splitWall(body, style, { axis: 'z', a0: -RD / 2, a1: RD / 2, fix: -fixX, y1: RH, holes: leftHoles, hits, inward: 1, ...wallColors });
  splitWall(front, style, { axis: 'x', a0: -RW / 2, a1: RW / 2, fix: fixZ, y1: RH, holes: frontHoles, hits: cutaway ? null : hits, inward: -1, ...wallColors });
  splitWall(side, style, { axis: 'z', a0: -RD / 2, a1: RD / 2, fix: fixX, y1: RH, holes: [], hits: cutaway ? null : hits, inward: -1, ...wallColors });

  const place = (group, name, x, y, z, rotY) => {
    const item = buildKitchenItem(name, style);
    item.position.set(x, y, z);
    item.rotation.y = rotY;
    group.add(item);
  };
  place(body, 'window', (backWin[0] + backWin[1]) / 2, 1.15, -fixZ, P);
  place(body, 'window', -fixX, 1.05, (leftWin[0] + leftWin[1]) / 2, P / 2);
  const doorX = (doorSpan[0] + doorSpan[1]) / 2;
  place(front, 'door', doorX, 0, fixZ, 0);
  if (!cutaway) hits.push({ x: doorX, z: fixZ, hw: DOOR.w / 2, hd: DOOR.d / 2 });

  for (const p of plan.placements) {
    const item = buildKitchenItem(p.item, style, plan.look);
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
  room.name = 'tiny_kitchen';
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
