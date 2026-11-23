import * as THREE from 'three';
import { PALETTE } from '../styles/palette.js';
import { mulberry32 } from '../lib/rng.js';
import { lobe, shadeMaterial } from '../lib/foliage.js';
import { mergeByMaterial } from '../lib/merge.js';
import manifest from '../../public/ramen-kit/manifest.json';
import { ramenPlan } from './arrange.js';

// A small ramen shop / izakaya, in the same boxes and cylinders as the cafe.
// Built here, not loaded, so createAsset stays synchronous. Every colour is
// `role:Swatch` through style.material, so palette swaps, the PS1 wobble and
// the outline flag all apply. Cylinder sides are the kit's own counts
// (already the PS1 0.3× detail). They are not passed through seg().
//
// Room: 7 m wide (x) by 5 m deep (z), origin at the bottom centre, front
// facing +z. The floor sits 2 cm above y = 0. Cutaway hides the +z and +x
// walls, the two the isometric catalogue camera faces.

const P = Math.PI;
const SLAB_TOP = 0.02;
const TILE_TOP = SLAB_TOP + 0.05;
const WIN = { w: 1.7, h: 1.2, d: 0.1 };
const DOOR = { w: 1.02, h: 2.18, d: 0.1 };
const LIP = 0.05;
const TH = 0.14;
const RW = 7;
const RD = 5;
const RH = 3;

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

function counterBody(g, style, len, depth, along) {
  const wood = mat(style, 'wood:Walnut');
  const top = mat(style, 'paint:Paper');
  const kick = mat(style, 'darkMetal:Charcoal');
  const hx = along === 'x' ? len : depth;
  const hz = along === 'x' ? depth : len;
  addBox(g, hx - 0.06, 0.1, hz - 0.06, kick, [0, 0.05, 0]);
  addBox(g, hx - 0.04, 0.78, hz - 0.08, wood, [0, 0.5, 0]);
  addBox(g, hx, 0.05, hz, top, [0, 0.915, 0]);
  if (along === 'x') addBox(g, hx - 0.08, 0.42, 0.012, mat(style, 'wood:Tan'), [0, 0.48, hz / 2 - 0.01]);
  else addBox(g, 0.012, 0.42, hz - 0.08, mat(style, 'wood:Tan'), [hx / 2 - 0.01, 0.48, 0]);
}

const BUILDERS = {
  counter(g, style) { counterBody(g, style, 4.2, 0.56, 'x'); },
  counter_return(g, style) { counterBody(g, style, 1.5, 0.56, 'z'); },
  stool(g, style) {
    const wood = mat(style, 'wood:Tan');
    const dark = mat(style, 'wood:Walnut');
    for (const sx of [-1, 1]) {
      addBox(g, 0.035, 0.62, 0.035, dark, [sx * 0.13, 0.31, 0.1]);
      addBox(g, 0.035, 0.78, 0.035, dark, [sx * 0.13, 0.39, -0.1]);
    }
    addBox(g, 0.32, 0.04, 0.3, wood, [0, 0.64, 0]);
    addBox(g, 0.28, 0.14, 0.03, wood, [0, 0.74, -0.12]);
  },
  prep(g, style) {
    const steel = mat(style, 'metal:Light gray');
    const dark = mat(style, 'darkMetal:Charcoal');
    addBox(g, 2.4, 0.08, 0.48, dark, [0, 0.04, 0]);
    addBox(g, 2.32, 0.78, 0.4, steel, [0, 0.47, 0]);
    addBox(g, 2.4, 0.04, 0.5, mat(style, 'metal:Stone'), [0, 0.88, 0]);
  },
  boiler(g, style) {
    const steel = mat(style, 'metal:Light gray');
    const dark = mat(style, 'darkMetal:Ink');
    addBox(g, 0.68, 0.7, 0.55, steel, [0, 0.4, 0]);
    addBox(g, 0.7, 0.05, 0.57, dark, [0, 0.77, 0]);
    addCyl(g, 0.12, 0.12, 0.08, dark, [-0.14, 0.82, 0], { seg: 6 });
    addCyl(g, 0.12, 0.12, 0.08, dark, [0.14, 0.82, 0], { seg: 6 });
    addBox(g, 0.16, 0.28, 0.08, mat(style, 'paint:Brick'), [0.22, 0.4, 0.24]);
  },
  pot(g, style, look = {}) {
    const body = mat(style, 'paint:' + (look.pot || 'Off white'));
    const dark = mat(style, 'darkMetal:Charcoal');
    addCyl(g, 0.16, 0.14, 0.22, body, [0, 0.14, 0], { seg: 6 });
    addCyl(g, 0.15, 0.15, 0.03, dark, [0, 0.26, 0], { seg: 6 });
    addBox(g, 0.06, 0.04, 0.08, dark, [0.18, 0.16, 0]);
    addBox(g, 0.06, 0.04, 0.08, dark, [-0.18, 0.16, 0]);
  },
  ticket(g, style) {
    const body = mat(style, 'paint:Off white');
    const dark = mat(style, 'darkMetal:Ink');
    addBox(g, 0.48, 0.08, 0.4, dark, [0, 0.04, 0]);
    addBox(g, 0.42, 1.45, 0.32, body, [0, 0.82, 0]);
    addBox(g, 0.32, 0.28, 0.02, mat(style, 'glass:Navy'), [0, 1.25, 0.16]);
    addBox(g, 0.28, 0.06, 0.02, mat(style, 'paint:Brick'), [0, 1.48, 0.16]);
    for (const [x, y] of [[-0.08, 0.95], [0.08, 0.95], [-0.08, 0.78], [0.08, 0.78]]) {
      addBox(g, 0.06, 0.05, 0.02, mat(style, 'paint:Butter'), [x, y, 0.17]);
    }
    addBox(g, 0.22, 0.03, 0.04, dark, [0, 0.55, 0.18]);
  },
  lantern(g, style, look = {}) {
    const paper = mat(style, 'paint:' + (look.lantern || 'Brick'));
    const dark = mat(style, 'darkMetal:Ink');
    addCyl(g, 0.004, 0.004, 0.7, dark, [0, 0.55, 0], { seg: 4 });
    addCyl(g, 0.09, 0.11, 0.22, paper, [0, 0.12, 0], { seg: 6 });
    addCyl(g, 0.1, 0.1, 0.02, dark, [0, 0.24, 0], { seg: 6 });
    addCyl(g, 0.07, 0.07, 0.02, dark, [0, 0.01, 0], { seg: 6 });
    addBox(g, 0.012, 0.16, 0.012, dark, [0, 0.12, 0.1]);
  },
  menu_strip(g, style) {
    const wood = mat(style, 'wood:Walnut');
    addBox(g, 0.9, 0.42, 0.04, wood, [0, 0.21, 0]);
    const rows = [[0.72, 0.32, 'paint:Paper'], [0.6, 0.22, 'paint:Butter'], [0.68, 0.12, 'paint:Dusty rose']];
    for (const [w, y, key] of rows) addBox(g, w, 0.035, 0.012, mat(style, key), [-0.04, y, 0.026]);
  },
  shelf(g, style) {
    const wood = mat(style, 'wood:Walnut');
    addBox(g, 1.15, 0.9, 0.04, wood, [0, 0.55, 0]);
    for (const y of [0.28, 0.55, 0.82]) addBox(g, 1.08, 0.03, 0.26, wood, [0, y, 0.12]);
    const bottles = [[-0.38, 0.34, 'paint:Sage'], [-0.14, 0.36, 'paint:Off white'], [0.12, 0.33, 'paint:Butter'], [0.34, 0.35, 'glass:Navy']];
    for (const [x, y, key] of bottles) addCyl(g, 0.035, 0.04, 0.16, mat(style, key), [x, y, 0.12], { seg: 5 });
    addCyl(g, 0.04, 0.045, 0.18, mat(style, 'paint:Apricot'), [-0.2, 0.64, 0.12], { seg: 5 });
    addCyl(g, 0.035, 0.04, 0.14, mat(style, 'paint:Paper'), [0.18, 0.62, 0.12], { seg: 5 });
  },
  bottle(g, style) {
    addCyl(g, 0.035, 0.04, 0.18, mat(style, 'paint:Sage'), [0, 0.1, 0], { seg: 5 });
    addCyl(g, 0.018, 0.018, 0.05, mat(style, 'darkMetal:Ink'), [0, 0.21, 0], { seg: 5 });
  },
  condiment(g, style) {
    const wood = mat(style, 'wood:Tan');
    addBox(g, 0.2, 0.03, 0.14, wood, [0, 0.015, 0]);
    addCyl(g, 0.03, 0.034, 0.08, mat(style, 'paint:Brick'), [-0.05, 0.07, 0], { seg: 5 });
    addCyl(g, 0.028, 0.03, 0.07, mat(style, 'paint:Butter'), [0.05, 0.065, 0], { seg: 5 });
  },
  noren(g, style, look = {}) {
    const cloth = mat(style, 'paint:' + (look.noren || 'Brick'));
    const band = mat(style, 'paint:Off white');
    addCyl(g, 0.015, 0.015, 0.92, mat(style, 'wood:Walnut'), [0, 0.72, 0], { seg: 5, rot: [0, 0, P / 2] });
    for (const sx of [-1, 1]) {
      addBox(g, 0.4, 0.62, 0.012, cloth, [sx * 0.22, 0.36, 0]);
      addBox(g, 0.4, 0.05, 0.014, band, [sx * 0.22, 0.58, 0.002]);
      addCyl(g, 0.05, 0.05, 0.014, mat(style, 'paint:Paper'), [sx * 0.22, 0.4, 0.012], { seg: 6 });
    }
  },
  mat(g, style) {
    addBox(g, 0.6, 0.012, 0.4, mat(style, 'cloth:Sand'), [0, 0.006, 0]);
    addBox(g, 0.4, 0.004, 0.06, mat(style, 'cloth:Brick'), [0, 0.014, 0]);
  },
  plant(g, style, look = {}) {
    addCyl(g, 0.14, 0.11, 0.24, mat(style, 'paint:' + (look.pot || 'Off white')), [0, 0.12, 0], { seg: 6 });
    [[0, 0.42, 0, 0.14], [0.1, 0.32, 0.04, 0.1], [-0.08, 0.3, -0.03, 0.09]].forEach(([x, y, z, r], i) => {
      addLobe(g, style, r, i % 2 ? 'leaf:Moss' : 'leaf:Sage', [x, y, z], [1, 0.85, 1], 40 + i);
    });
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
    addBox(g, 0.035, h - b * 2, d * 0.6, frame, [0, h / 2, 0]);
    addBox(g, w - b * 2, 0.035, d * 0.6, frame, [0, h * 0.55, 0]);
    addBox(g, w - b * 2 + 0.02, h - b * 2 + 0.02, 0.012, glass, [0, h / 2, 0]);
  },
  door(g, style) {
    const wood = mat(style, 'wood:Walnut');
    const glass = mat(style, 'glass:Sky');
    const { w, h, d } = DOOR;
    const jb = 0.07;
    addBox(g, jb, h, d, wood, [-w / 2 + jb / 2, h / 2, 0]);
    addBox(g, jb, h, d, wood, [w / 2 - jb / 2, h / 2, 0]);
    addBox(g, w, jb, d, wood, [0, h - jb / 2, 0]);
    const dw = w - jb * 2;
    addBox(g, dw, 0.9, 0.05, wood, [0, 0.45, 0]);
    addBox(g, dw - 0.08, 1.05, 0.012, glass, [0, 1.5, 0]);
    addBox(g, dw, 0.05, 0.055, wood, [0, 0.95, 0]);
    addBox(g, 0.03, 0.14, 0.04, mat(style, 'metal:Stone'), [dw / 2 - 0.08, 1.0, d / 2]);
  },
};

const LABELS = {
  counter: 'Ramen counter',
  counter_return: 'Counter return',
  stool: 'Counter stool',
  prep: 'Prep counter',
  boiler: 'Noodle boiler',
  pot: 'Stock pot',
  ticket: 'Ticket machine',
  lantern: 'Chouchin lantern',
  menu_strip: 'Menu strip',
  shelf: 'Sake shelf',
  bottle: 'Sake bottle',
  condiment: 'Condiment set',
  noren: 'Noren curtain',
  mat: 'Floor mat',
  plant: 'Floor plant',
  window: 'Shop window',
  door: 'Shop door',
};

const NO_HIT = new Set(['lantern', 'noren', 'mat', 'condiment', 'bottle']);

function hitFor(name, footprint) {
  if (NO_HIT.has(name)) return [];
  const [w, d] = footprint;
  return [{ hw: w / 2, hd: d / 2 }];
}

/** One catalogue row per kit item, in manifest order. */
export const RAMEN_ITEMS = Object.entries(manifest.items).map(([name, item]) => ({
  name,
  id: `ramen.${name}`,
  label: LABELS[name] ?? item.label,
  kitGroup: item.group,
  size: item.footprint,
  hit: hitFor(name, item.footprint),
}));

/** A kit item standing on y = 0, facing +z. */
export function buildRamenItem(name, style, look) {
  const build = BUILDERS[name];
  if (!build) throw new Error(`Unknown ramen item "${name}"`);
  const g = new THREE.Group();
  g.name = name;
  build(g, style, look || {});
  g.userData.ramenItem = name;
  return g;
}

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
    trim(0.05, 0.025, 'darkMetal:Charcoal', 0, 0.08);
  }
}

/**
 * The whole shop (7 × 5 m). `cutaway` hides the front (+z) and side (+x)
 * walls. Meshes are merged per material. The floor is one solid colour.
 */
export function buildRamenRoom(style, { cutaway = false, seed = 0 } = {}) {
  const plan = ramenPlan(seed);
  const body = new THREE.Group();
  const front = new THREE.Group();
  const side = new THREE.Group();
  const hits = [];

  const floorH = TILE_TOP - SLAB_TOP;
  addBox(body, RW, floorH, RD, mat(style, 'wood:Walnut'), [0, (SLAB_TOP + TILE_TOP) / 2, 0]);
  addBox(body, RW, 0.22, RD, mat(style, 'concrete:Gray'), [0, SLAB_TOP - 0.11, 0]);

  const hole = (a0, a1, y0, h) => ({ a0: a0 + LIP, a1: a1 - LIP, y0: y0 + LIP, y1: y0 + h - LIP });
  const frontWin = [-2.55, -2.55 + WIN.w];
  const doorSpan = [1.49, 1.49 + DOOR.w];
  const frontHoles = [hole(frontWin[0], frontWin[1], 0.95, WIN.h), { a0: doorSpan[0], a1: doorSpan[1], y0: 0, y1: DOOR.h - LIP }];
  const leftWin = [-0.4, -0.4 + WIN.w];
  const leftHoles = [hole(leftWin[0], leftWin[1], 0.95, WIN.h)];
  const wallColors = { low: 'wood:Walnut', high: 'paint:Off white', band: 0.95, rail: 'wood:Tan' };
  const fixX = RW / 2 - TH / 2;
  const fixZ = RD / 2 - TH / 2;

  splitWall(body, style, { axis: 'x', a0: -RW / 2, a1: RW / 2, fix: -fixZ, y1: RH, holes: [], hits, inward: 1, ...wallColors });
  splitWall(body, style, { axis: 'z', a0: -RD / 2, a1: RD / 2, fix: -fixX, y1: RH, holes: leftHoles, hits, inward: 1, ...wallColors });
  splitWall(front, style, { axis: 'x', a0: -RW / 2, a1: RW / 2, fix: fixZ, y1: RH, holes: frontHoles, hits: cutaway ? null : hits, inward: -1, ...wallColors });
  splitWall(side, style, { axis: 'z', a0: -RD / 2, a1: RD / 2, fix: fixX, y1: RH, holes: [], hits: cutaway ? null : hits, inward: -1, ...wallColors });

  const place = (group, name, x, y, z, rotY) => {
    const item = buildRamenItem(name, style);
    item.position.set(x, y, z);
    item.rotation.y = rotY;
    group.add(item);
  };
  place(front, 'window', (frontWin[0] + frontWin[1]) / 2, 0.95, fixZ, 0);
  const doorX = (doorSpan[0] + doorSpan[1]) / 2;
  place(front, 'door', doorX, 0, fixZ, 0);
  place(body, 'window', -fixX, 0.95, (leftWin[0] + leftWin[1]) / 2, P / 2);
  if (!cutaway) hits.push({ x: doorX, z: fixZ, hw: DOOR.w / 2, hd: DOOR.d / 2 });

  for (const p of plan.placements) {
    const item = buildRamenItem(p.item, style, plan.look);
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
  room.name = 'tiny_ramen';
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
