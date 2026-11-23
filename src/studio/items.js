import * as THREE from 'three';
import { PALETTE } from '../styles/palette.js';
import { mergeByMaterial } from '../lib/merge.js';
import manifest from '../../public/studio-kit/manifest.json';
import layout from '../../public/studio-kit/layout.json';
import { studioPlan } from './layout.js';

// Japanese 1R studio apartment, in the same boxes and cylinders as the
// office kit (src/office/items.js). Built here, not loaded, so createAsset
// stays synchronous. Every colour is `role:Swatch` through style.material,
// so palette swaps, the PS1 wobble and the outline flag all apply.
//
// The sofa, bedding and cushion use cloth, so sage, navy and apricot are
// not flattened by the building-colour rule. The floor is wood. Cylinder
// sides are the kit's own counts (already the PS1 0.3× detail). They are
// not passed through seg().
//
// Room: 6 m wide (x) by 4 m deep (z), origin at the bottom centre, front
// facing +z. The floor sits 2 cm above y = 0. Cutaway hides the +z and +x
// walls. The unit bath sits in the far corner with its door facing into
// the room, and the kitchen runs along the far wall, so both read in the
// isometric view. The bath has no roof: the catalogue camera looks in.

const P = Math.PI;
const SLAB_TOP = 0.02;
const TILE_TOP = SLAB_TOP + 0.05;

const WIN = { w: 0.84, h: 0.96 };

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

function cabinet(g, style, w, d, h = 0.84) {
  const body = mat(style, 'paint:Off white');
  const top = mat(style, 'paint:Light gray');
  const kick = mat(style, 'darkMetal:Charcoal');
  addBox(g, w - 0.04, h - 0.12, d - 0.04, body, [0, (h - 0.12) / 2 + 0.04, 0]);
  addBox(g, w, 0.03, d, top, [0, h - 0.015, 0]);
  addBox(g, w - 0.06, 0.06, d - 0.06, kick, [0, 0.03, 0]);
  addBox(g, w * 0.55, 0.012, 0.012, mat(style, 'paint:Stone'), [0, h * 0.48, d / 2 - 0.01]);
  addBox(g, 0.08, 0.018, 0.016, mat(style, 'metal:Stone'), [w * 0.18, h * 0.48, d / 2]);
}

const BUILDERS = {
  bed(g, style, look) {
    const wood = mat(style, 'wood:Walnut');
    const sheet = mat(style, 'paint:Off white');
    const duvet = mat(style, look?.duvet ?? 'cloth:Navy');
    const pillow = mat(style, 'paint:Paper');
    addBox(g, 1.02, 0.1, 1.95, wood, [0, 0.08, 0]);
    addBox(g, 1.02, 0.22, 0.05, wood, [0, 0.24, -0.95]);
    addBox(g, 0.94, 0.1, 1.82, sheet, [0, 0.18, 0.02]);
    addBox(g, 0.96, 0.06, 1.3, duvet, [0, 0.25, 0.26]);
    addBox(g, 0.5, 0.08, 0.3, pillow, [0, 0.26, -0.68]);
  },
  sink(g, style) {
    cabinet(g, style, 0.78, 0.56, 0.86);
    const steel = mat(style, 'metal:Light gray');
    const basin = mat(style, 'paint:Sky');
    addBox(g, 0.46, 0.04, 0.34, steel, [0, 0.86, 0.02]);
    addBox(g, 0.34, 0.035, 0.24, basin, [0, 0.875, 0.02]);
    addBox(g, 0.03, 0.16, 0.03, steel, [0.12, 0.96, -0.08]);
    addBox(g, 0.1, 0.025, 0.025, steel, [0.06, 1.03, -0.02]);
    addCyl(g, 0.012, 0.012, 0.06, steel, [0.02, 0.98, 0.02], { seg: 5 });
  },
  hob(g, style) {
    cabinet(g, style, 0.7, 0.56, 0.86);
    const top = mat(style, 'darkMetal:Ink');
    const steel = mat(style, 'metal:Light gray');
    addBox(g, 0.64, 0.025, 0.5, top, [0, 0.87, 0]);
    for (const x of [-0.14, 0.14]) {
      addCyl(g, 0.09, 0.09, 0.012, steel, [x, 0.888, 0], { seg: 6 });
      addCyl(g, 0.04, 0.04, 0.012, mat(style, 'darkMetal:Charcoal'), [x, 0.896, 0], { seg: 6 });
      addBox(g, 0.16, 0.008, 0.012, steel, [x, 0.904, 0]);
      addBox(g, 0.012, 0.008, 0.16, steel, [x, 0.908, 0]);
    }
    for (const x of [-0.22, -0.08, 0.08, 0.22]) addBox(g, 0.028, 0.02, 0.018, steel, [x, 0.5, 0.285]);
    addCyl(g, 0.065, 0.065, 0.03, mat(style, 'metal:Stone'), [-0.14, 0.91, 0], { seg: 6 });
  },
  fridge(g, style) {
    const body = mat(style, 'paint:Off white');
    const line = mat(style, 'paint:Light gray');
    const metal = mat(style, 'metal:Light gray');
    addBox(g, 0.52, 1.42, 0.56, body, [0, 0.74, 0]);
    addBox(g, 0.48, 0.01, 0.012, line, [0, 0.48, 0.286]);
    addBox(g, 0.02, 0.7, 0.025, metal, [0.2, 0.95, 0.29]);
    addBox(g, 0.5, 0.04, 0.54, mat(style, 'darkMetal:Charcoal'), [0, 0.02, 0]);
  },
  counter(g, style) {
    cabinet(g, style, 0.58, 0.56, 0.86);
  },
  table(g, style) {
    const wood = mat(style, 'wood:Tan');
    const dark = mat(style, 'wood:Walnut');
    addBox(g, 0.72, 0.03, 0.72, wood, [0, 0.32, 0]);
    addBox(g, 0.66, 0.015, 0.66, dark, [0, 0.298, 0]);
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) addBox(g, 0.04, 0.3, 0.04, dark, [sx * 0.28, 0.15, sz * 0.28]);
    }
  },
  cushion(g, style, look) {
    addBox(g, 0.42, 0.08, 0.42, mat(style, look?.cushion ?? 'cloth:Apricot'), [0, 0.04, 0]);
    addBox(g, 0.22, 0.02, 0.22, mat(style, 'cloth:Dusty rose'), [0, 0.09, 0]);
  },
  sofa(g, style) {
    const cloth = mat(style, 'cloth:Sage');
    const dark = mat(style, 'cloth:Moss');
    const wood = mat(style, 'wood:Walnut');
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) addBox(g, 0.05, 0.08, 0.05, wood, [sx * 0.64, 0.04, sz * 0.28]);
    }
    addBox(g, 1.48, 0.16, 0.7, dark, [0, 0.16, 0]);
    addBox(g, 1.2, 0.12, 0.62, cloth, [0, 0.3, 0.02]);
    addBox(g, 1.48, 0.36, 0.12, cloth, [0, 0.5, -0.3]);
    addBox(g, 1.2, 0.16, 0.08, cloth, [0, 0.72, -0.3]);
    for (const sx of [-1, 1]) addBox(g, 0.1, 0.28, 0.62, cloth, [sx * 0.69, 0.4, 0.02]);
  },
  tv(g, style) {
    const wood = mat(style, 'wood:Walnut');
    const bezel = mat(style, 'darkMetal:Ink');
    const screen = mat(style, 'glass:Navy');
    addBox(g, 1.05, 0.28, 0.36, wood, [0, 0.18, 0]);
    addBox(g, 0.9, 0.02, 0.28, mat(style, 'wood:Tan'), [0, 0.33, 0]);
    for (const sx of [-1, 1]) addBox(g, 0.04, 0.08, 0.28, wood, [sx * 0.28, 0.38, 0]);
    addBox(g, 0.92, 0.54, 0.04, bezel, [0, 0.68, 0]);
    addBox(g, 0.82, 0.44, 0.008, screen, [0, 0.68, 0.024]);
    addBox(g, 0.74, 0.26, 0.006, mat(style, 'paint:Seafoam'), [0, 0.72, 0.03]);
    addBox(g, 0.2, 0.18, 0.006, mat(style, 'paint:Butter'), [-0.24, 0.66, 0.034]);
    addBox(g, 0.36, 0.06, 0.006, mat(style, 'paint:Dusty rose'), [0.12, 0.54, 0.034]);
  },
  unit_bath(g, style) {
    const W = 1.5;
    const D = 1.42;
    const H = 2.1;
    const T = 0.05;
    const wall = mat(style, 'paint:Off white');
    const tile = mat(style, 'concrete:Light gray');
    const white = mat(style, 'paint:Paper');
    const water = mat(style, 'paint:Sky');
    const steel = mat(style, 'metal:Light gray');
    const glass = mat(style, 'glass:Sky');
    addBox(g, W - T * 2, 0.04, D - T * 2, tile, [0, 0.02, 0]);
    addBox(g, W, H, T, wall, [0, H / 2, -D / 2 + T / 2]);
    addBox(g, T, H, D - T, wall, [-W / 2 + T / 2, H / 2, -T / 2]);
    addBox(g, T, H, D - T, wall, [W / 2 - T / 2, H / 2, -T / 2]);
    const doorW = 0.9;
    const doorH = 1.9;
    const frontZ = D / 2 - T / 2;
    const sideW = (W - doorW) / 2;
    addBox(g, sideW, H, T, wall, [-W / 2 + sideW / 2, H / 2, frontZ]);
    addBox(g, sideW, H, T, wall, [W / 2 - sideW / 2, H / 2, frontZ]);
    addBox(g, doorW, H - doorH, T, wall, [0, doorH + (H - doorH) / 2, frontZ]);
    addBox(g, 0.04, doorH - 0.06, 0.04, wall, [-doorW / 2 + 0.04, doorH / 2, frontZ]);
    addBox(g, 0.04, doorH - 0.06, 0.04, wall, [doorW / 2 - 0.04, doorH / 2, frontZ]);
    addBox(g, doorW - 0.12, 0.1, 0.04, wall, [0, 0.08, frontZ]);
    addBox(g, doorW - 0.16, doorH - 0.28, 0.01, glass, [0, doorH * 0.55, frontZ]);
    addBox(g, 0.02, 0.14, 0.03, steel, [-0.28, 0.95, frontZ + 0.02]);
    addBox(g, 1.02, 0.42, 0.58, white, [-0.05, 0.25, -0.32]);
    addBox(g, 0.86, 0.06, 0.42, water, [-0.05, 0.44, -0.32]);
    addBox(g, 0.02, 0.28, 0.02, steel, [-0.42, 1.45, -0.58]);
    addBox(g, 0.08, 0.025, 0.08, steel, [-0.42, 1.58, -0.54]);
    addBox(g, 0.2, 0.32, 0.12, white, [0.48, 0.4, 0.18]);
    addCyl(g, 0.14, 0.13, 0.28, white, [0.46, 0.18, 0.38], { seg: 6 });
    addBox(g, 0.3, 0.03, 0.28, white, [0.46, 0.33, 0.38]);
    addBox(g, 0.32, 0.06, 0.24, white, [-0.48, 0.78, 0.22]);
    addBox(g, 0.2, 0.03, 0.14, water, [-0.48, 0.81, 0.22]);
    addBox(g, 0.025, 0.1, 0.025, steel, [-0.48, 0.88, 0.14]);
    addBox(g, 0.22, 0.28, 0.01, mat(style, 'glass:Navy'), [-0.68, 1.2, 0.18]);
    addBox(g, 0.012, 0.22, 0.16, mat(style, 'cloth:Sky'), [0.67, 1.12, 0.05]);
  },
  window(g, style) {
    const frame = mat(style, 'metal:Light gray');
    const glass = mat(style, 'glass:Sky');
    const cloth = mat(style, 'cloth:Sky');
    const { w, h } = WIN;
    const b = 0.05;
    const d = 0.06;
    addBox(g, w, b, d, frame, [0, b / 2, 0]);
    addBox(g, w, b, d, frame, [0, h - b / 2, 0]);
    addBox(g, b, h, d, frame, [-w / 2 + b / 2, h / 2, 0]);
    addBox(g, b, h, d, frame, [w / 2 - b / 2, h / 2, 0]);
    addBox(g, w - b * 2 + 0.02, h - b * 2 + 0.02, 0.01, glass, [0, h / 2, 0]);
    addBox(g, w + 0.08, 0.035, 0.1, frame, [0, 0.015, 0.03]);
    addCyl(g, 0.01, 0.01, w + 0.12, mat(style, 'darkMetal:Charcoal'), [0, h + 0.04, 0.04], { seg: 5, rot: [0, 0, P / 2] });
    addBox(g, 0.12, h * 0.9, 0.02, cloth, [-w / 2 + 0.08, h * 0.45, 0.04]);
    addBox(g, 0.12, h * 0.9, 0.02, cloth, [w / 2 - 0.08, h * 0.45, 0.04]);
  },
  kettle(g, style) {
    const steel = mat(style, 'metal:Light gray');
    const dark = mat(style, 'darkMetal:Charcoal');
    addCyl(g, 0.07, 0.075, 0.1, steel, [0, 0.07, 0], { seg: 7 });
    addCyl(g, 0.04, 0.05, 0.02, steel, [0, 0.13, 0], { seg: 6 });
    addCyl(g, 0.045, 0.045, 0.012, dark, [0, 0.142, 0], { seg: 6 });
    addBox(g, 0.04, 0.025, 0.05, steel, [0, 0.08, 0.08]);
    addBox(g, 0.012, 0.07, 0.04, dark, [-0.07, 0.1, 0]);
  },
  rice_cooker(g, style) {
    const body = mat(style, 'paint:Off white');
    addCyl(g, 0.1, 0.105, 0.16, body, [0, 0.09, 0], { seg: 8 });
    addCyl(g, 0.1, 0.07, 0.04, body, [0, 0.18, 0], { seg: 8 });
    addCyl(g, 0.04, 0.04, 0.015, mat(style, 'darkMetal:Charcoal'), [0, 0.2, 0], { seg: 6 });
    addBox(g, 0.04, 0.025, 0.012, mat(style, 'light:Butter'), [0.06, 0.08, 0.09]);
  },
  ceiling_light(g, style) {
    const shade = mat(style, 'paint:Paper');
    const metal = mat(style, 'metal:Light gray');
    addCyl(g, 0.1, 0.18, 0.08, shade, [0, 0.05, 0], { seg: 7 });
    addCyl(g, 0.08, 0.08, 0.012, mat(style, 'light:Butter'), [0, 0.04, 0], { seg: 6 });
    addCyl(g, 0.006, 0.006, 0.55, mat(style, 'darkMetal:Ink'), [0, 0.36, 0], { seg: 4 });
    addCyl(g, 0.05, 0.05, 0.02, metal, [0, 0.64, 0], { seg: 6 });
  },
  shoe_tray(g, style) {
    const tray = mat(style, 'paint:Sand');
    const shoe = mat(style, 'cloth:Cocoa');
    addBox(g, 0.52, 0.025, 0.28, tray, [0, 0.012, 0]);
    addBox(g, 0.5, 0.02, 0.015, tray, [0, 0.03, 0.13]);
    addBox(g, 0.5, 0.02, 0.015, tray, [0, 0.03, -0.13]);
    addBox(g, 0.18, 0.05, 0.08, shoe, [-0.12, 0.05, 0.02], [0, 0.2, 0]);
    addBox(g, 0.16, 0.04, 0.07, shoe, [0.12, 0.045, -0.02], [0, -0.15, 0]);
  },
  door(g, style) {
    const wood = mat(style, 'wood:Walnut');
    const paint = mat(style, 'paint:Off white');
    const metal = mat(style, 'metal:Light gray');
    addBox(g, 0.06, 2.08, 0.07, wood, [-0.44, 1.04, 0]);
    addBox(g, 0.06, 2.08, 0.07, wood, [0.44, 1.04, 0]);
    addBox(g, 0.94, 0.08, 0.07, wood, [0, 2.04, 0]);
    addBox(g, 0.8, 1.96, 0.04, paint, [0, 0.98, 0]);
    addBox(g, 0.62, 0.7, 0.012, mat(style, 'paint:Paper'), [0, 0.55, 0.026]);
    addBox(g, 0.62, 0.62, 0.012, mat(style, 'paint:Paper'), [0, 1.45, 0.026]);
    addCyl(g, 0.016, 0.016, 0.04, metal, [0.3, 0.98, 0.04], { seg: 5, rot: [P / 2, 0, 0] });
    addBox(g, 0.09, 0.02, 0.02, metal, [0.25, 0.98, 0.05]);
  },
  teacup(g, style) {
    addCyl(g, 0.04, 0.032, 0.05, mat(style, 'paint:Off white'), [0, 0.03, 0], { seg: 6 });
    addCyl(g, 0.034, 0.034, 0.012, mat(style, 'paint:Sage'), [0, 0.045, 0], { seg: 6 });
    addBox(g, 0.012, 0.03, 0.028, mat(style, 'paint:Off white'), [0.046, 0.035, 0]);
  },
};

const LABELS = {
  bed: 'Platform bed',
  sink: 'Kitchen sink',
  hob: 'Two-burner hob',
  fridge: 'Small fridge',
  counter: 'Prep counter',
  table: 'Low table',
  cushion: 'Floor cushion',
  sofa: 'Sofa',
  tv: 'Television',
  unit_bath: 'Unit bath',
  window: 'Window',
  kettle: 'Kettle',
  rice_cooker: 'Rice cooker',
  ceiling_light: 'Ceiling light',
  shoe_tray: 'Shoe tray',
  door: 'Entrance door',
  teacup: 'Teacup',
};

const NO_HIT = new Set(['cushion', 'ceiling_light']);

function hitFor(name, footprint) {
  if (NO_HIT.has(name)) return [];
  const [w, d] = footprint;
  return [{ hw: w / 2, hd: d / 2 }];
}

/** One catalogue row per kit item, in manifest order. */
export const STUDIO_ITEMS = Object.entries(manifest.items).map(([name, item]) => ({
  name,
  id: `studio.${name}`,
  label: LABELS[name] ?? item.label,
  kitGroup: item.group,
  size: item.footprint,
  hit: hitFor(name, item.footprint),
}));

/** A kit item standing on y = 0, facing +z. Geometry is its own (safe to dispose). */
export function buildStudioItem(name, style, look) {
  const build = BUILDERS[name];
  if (!build) throw new Error(`Unknown studio item "${name}"`);
  const g = new THREE.Group();
  g.name = name;
  build(g, style, look);
  g.userData.studioItem = name;
  return g;
}

const RW = 6;
const RD = 4;
const RH = 2.55;
const TH = 0.12;

function splitWall(g, style, { axis, a0, a1, fix, y1, holes, hits, inward }) {
  const cuts = [a0, a1];
  for (const h of holes) cuts.push(Math.max(a0, Math.min(a1, h.a0)), Math.max(a0, Math.min(a1, h.a1)));
  cuts.sort((p, q) => p - q);
  const edges = [];
  for (const v of cuts) if (!edges.length || v - edges.at(-1) > 1e-3) edges.push(v);
  const put = (a, b, y0, y, kind) => {
    const span = b - a;
    const height = y - y0;
    if (span < 1e-3 || height < 1e-3) return;
    const mid = (a + b) / 2;
    const base = kind === 'base';
    const depth = base ? 0.018 : TH;
    const fixPos = base ? fix + inward * (TH / 2 + 0.005) : fix;
    const pos = axis === 'x' ? [mid, (y0 + y) / 2, fixPos] : [fixPos, (y0 + y) / 2, mid];
    const size = axis === 'x' ? [span, height, depth] : [depth, height, span];
    addBox(g, size[0], size[1], size[2], mat(style, base ? 'paint:Light gray' : 'paint:Off white'), pos);
    if (!base && hits && y0 < 0.4) {
      hits.push(axis === 'x'
        ? { x: mid, z: fix, hw: span / 2, hd: TH / 2 }
        : { x: fix, z: mid, hw: TH / 2, hd: span / 2 });
    }
  };
  for (let i = 0; i < edges.length - 1; i++) {
    const a = edges[i];
    const b = edges[i + 1];
    const mid = (a + b) / 2;
    const spans = holes.filter((h) => mid > h.a0 + 1e-4 && mid < h.a1 - 1e-4).map((h) => [h.y0, h.y1]).sort((p, q) => p[0] - q[0]);
    let y = 0;
    const emit = (y0, yEnd) => { if (yEnd > y0 + 1e-4) put(a, b, y0, yEnd, 'wall'); };
    for (const [hy0, hy1] of spans) {
      emit(y, Math.min(hy0, y1));
      y = Math.max(y, hy1);
    }
    emit(y, y1);
    if (!spans.some(([hy0, hy1]) => hy0 < 0.05 && hy1 > 0.05)) put(a, b, 0, 0.1, 'base');
  }
}

function place(group, style, name, x, y, z, rotY) {
  const item = buildStudioItem(name, style);
  item.position.set(x, y, z);
  item.rotation.y = rotY;
  group.add(item);
  return item;
}

/**
 * The whole studio (6 × 4 m). `cutaway` hides the front (+z) and side (+x)
 * walls so the inside reads from the isometric catalogue camera.
 */
export function buildStudioRoom(style, { cutaway = false, seed = 0 } = {}) {
  const body = new THREE.Group();
  const front = new THREE.Group();
  const side = new THREE.Group();
  const hits = [];

  // One solid wood floor. No planks.
  const floorH = TILE_TOP - SLAB_TOP;
  addBox(body, RW, floorH, RD, mat(style, 'wood:Tan'), [0, (SLAB_TOP + TILE_TOP) / 2, 0]);
  addBox(body, RW, 0.18, RD, mat(style, 'concrete:Gray'), [0, SLAB_TOP - 0.09, 0]);

  const west = -RW / 2 + TH / 2;
  const east = RW / 2 - TH / 2;
  const south = RD / 2 - TH / 2;
  const north = -RD / 2 + TH / 2;

  const sinkWin = { x: -0.55, sill: 1.18 };
  const bedWin = { z: 0.85, sill: 1.12 };
  const holeOf = (center, sill, along) => ({
    a0: center - along / 2 + 0.03,
    a1: center + along / 2 - 0.03,
    y0: sill + 0.03,
    y1: sill + WIN.h - 0.03,
  });
  const doorX = 2.05;
  const doorHole = { a0: doorX - 0.4, a1: doorX + 0.4, y0: 0, y1: 2.02 };

  splitWall(body, style, {
    axis: 'z', a0: -RD / 2, a1: RD / 2, fix: west, y1: RH,
    holes: [holeOf(bedWin.z, bedWin.sill, WIN.w)], hits, inward: 1,
  });
  splitWall(body, style, {
    axis: 'x', a0: -RW / 2, a1: RW / 2, fix: north, y1: RH,
    holes: [holeOf(sinkWin.x, sinkWin.sill, WIN.w)], hits, inward: 1,
  });
  splitWall(side, style, { axis: 'z', a0: -RD / 2, a1: RD / 2, fix: east, y1: RH, holes: [], hits: cutaway ? null : hits, inward: -1 });
  splitWall(front, style, {
    axis: 'x', a0: -RW / 2, a1: RW / 2, fix: south, y1: RH,
    holes: [doorHole], hits: cutaway ? null : hits, inward: -1,
  });

  place(body, style, 'window', sinkWin.x, sinkWin.sill, north, 0);
  place(body, style, 'window', west, bedWin.sill, bedWin.z, P / 2);
  place(front, style, 'door', doorX, 0, south, 0);
  if (!cutaway) hits.push({ x: doorX, z: south, hw: 0.47, hd: TH / 2 });

  // Unit bath in the far corner. rotY = π/2 turns its door (+z) toward +x.
  const bath = place(body, style, 'unit_bath', -2.15, TILE_TOP, -1.11, P / 2);
  const bw = 1.5;
  const bd = 1.42;
  hits.push({ x: bath.position.x, z: bath.position.z, hw: bd / 2, hd: bw / 2 });

  const plan = studioPlan(seed);
  const placements = plan?.placements ?? layout.placements;
  for (const p of placements) {
    const item = buildStudioItem(p.item, style, plan?.look);
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
  room.name = 'tiny_studio';
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
