import * as THREE from 'three';
import { PALETTE } from '../styles/palette.js';
import { mulberry32 } from '../lib/rng.js';
import { lobe, shadeMaterial } from '../lib/foliage.js';
import { mergeByMaterial } from '../lib/merge.js';
import manifest from '../../public/openoffice-kit/manifest.json';
import { openOfficePlan } from './arrange.js';

// An open-plan studio, separate from the private office kit (namespace
// `openoffice`, not `office`). Long shared benches, sled chairs and a lounge
// instead of pedestal desks, five-star chairs, a meeting room or cubicle
// dividers. Built here so createAsset stays synchronous. Every colour is
// `role:Swatch` through style.material.
//
// The sage accent wall, seafoam sofa and apricot pots use paint / cloth, so
// they are not flattened by the building-colour rule. The floor is large
// concrete tiles, not the office kit's small checker. Cylinder sides are the
// kit's own counts (already the PS1 0.3× detail).
//
// Room: 12 m wide (x) by 10 m deep (z), origin at the bottom centre, front
// facing +z. The floor sits 2 cm above y = 0. Cutaway hides the +z and +x
// walls: those two face the isometric catalogue camera.

const P = Math.PI;
const SLAB_TOP = 0.02;
const TILE_TOP = SLAB_TOP + 0.05;

const WIN = { w: 2.4, h: 1.45, d: 0.1 };
const DOOR = { w: 1.4, h: 2.3, d: 0.1 };
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
  bench(g, style) {
    const top = mat(style, 'wood:Tan');
    const metal = mat(style, 'darkMetal:Ink');
    addBox(g, 3.4, 0.04, 0.78, top, [0, 0.72, 0]);
    addBox(g, 3.1, 0.06, 0.08, metal, [0, 0.66, -0.22]);
    for (const x of [-1.45, 0, 1.45]) {
      addBox(g, 0.04, 0.68, 0.04, metal, [x, 0.34, 0.3]);
      addBox(g, 0.04, 0.68, 0.04, metal, [x, 0.34, -0.3]);
      addBox(g, 0.04, 0.04, 0.64, metal, [x, 0.04, 0]);
    }
  },
  monitor(g, style) {
    const dark = mat(style, 'darkMetal:Ink');
    const glass = mat(style, 'glass:Navy');
    const metal = mat(style, 'metal:Light gray');
    addBox(g, 0.52, 0.32, 0.03, dark, [0, 0.28, 0]);
    addBox(g, 0.46, 0.26, 0.006, glass, [0, 0.28, 0.018]);
    addBox(g, 0.04, 0.1, 0.03, metal, [0, 0.08, -0.02]);
    addBox(g, 0.16, 0.015, 0.12, metal, [0, 0.02, 0]);
  },
  task_chair(g, style, look = {}) {
    const metal = mat(style, 'darkMetal:Ink');
    const seat = mat(style, 'cloth:' + (look.chair || 'Powder blue'));
    const back = mat(style, 'cloth:Denim');
    for (const sx of [-1, 1]) {
      addBox(g, 0.03, 0.03, 0.46, metal, [sx * 0.2, 0.045, 0.02]);
      addBox(g, 0.03, 0.4, 0.03, metal, [sx * 0.2, 0.24, 0.22]);
      addBox(g, 0.03, 0.48, 0.03, metal, [sx * 0.2, 0.48, -0.18]);
    }
    addBox(g, 0.46, 0.05, 0.42, seat, [0, 0.46, 0.02]);
    addBox(g, 0.44, 0.36, 0.045, back, [0, 0.72, -0.18], [-0.14, 0, 0]);
  },
  sofa(g, style, look = {}) {
    const cloth = mat(style, 'cloth:' + (look.sofa || 'Seafoam'));
    const dark = mat(style, 'cloth:Denim');
    const leg = mat(style, 'darkMetal:Ink');
    addBox(g, 1.7, 0.12, 0.72, dark, [0, 0.18, 0]);
    addBox(g, 1.56, 0.16, 0.64, cloth, [0, 0.32, 0.04]);
    addBox(g, 1.56, 0.36, 0.14, cloth, [0, 0.5, -0.26], [-0.08, 0, 0]);
    addBox(g, 0.28, 0.16, 0.28, mat(style, 'cloth:Blush'), [-0.4, 0.46, 0.08]);
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) addBox(g, 0.05, 0.1, 0.05, leg, [sx * 0.74, 0.05, sz * 0.28]);
    }
  },
  coffee_table(g, style) {
    const top = mat(style, 'wood:Tan');
    const leg = mat(style, 'darkMetal:Ink');
    addCyl(g, 0.42, 0.42, 0.035, top, [0, 0.36, 0], { seg: 8 });
    addCyl(g, 0.04, 0.04, 0.32, leg, [0, 0.17, 0], { seg: 6 });
    addCyl(g, 0.14, 0.14, 0.02, leg, [0, 0.015, 0], { seg: 6 });
  },
  rug(g, style) {
    addBox(g, 2.6, 0.012, 1.7, mat(style, 'cloth:Sand'), [0, 0.006, 0]);
    addBox(g, 2.3, 0.004, 1.4, mat(style, 'cloth:Sage'), [0, 0.014, 0]);
  },
  floor_lamp(g, style) {
    const metal = mat(style, 'darkMetal:Ink');
    addCyl(g, 0.12, 0.14, 0.03, metal, [0, 0.015, 0], { seg: 6 });
    addBox(g, 0.025, 1.35, 0.025, metal, [0, 0.7, 0]);
    addBox(g, 0.32, 0.025, 0.025, metal, [0.14, 1.36, 0]);
    addCyl(g, 0.1, 0.12, 0.09, mat(style, 'paint:Off white'), [0.28, 1.3, 0], { seg: 6 });
    addCyl(g, 0.06, 0.06, 0.012, mat(style, 'light:Butter'), [0.28, 1.25, 0], { seg: 6 });
  },
  printer(g, style) {
    const stand = mat(style, 'wood:Tan');
    const metal = mat(style, 'darkMetal:Ink');
    const body = mat(style, 'paint:Light gray');
    addBox(g, 0.7, 0.04, 0.5, stand, [0, 0.62, 0]);
    addBox(g, 0.66, 0.04, 0.46, stand, [0, 0.28, 0]);
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) addBox(g, 0.04, 0.64, 0.04, metal, [sx * 0.3, 0.32, sz * 0.2]);
    }
    addBox(g, 0.48, 0.22, 0.4, body, [0, 0.77, 0]);
    addBox(g, 0.44, 0.04, 0.28, mat(style, 'paint:Off white'), [0, 0.86, 0.04]);
    addBox(g, 0.28, 0.008, 0.2, mat(style, 'paint:Paper'), [0, 0.66, 0.08]);
    addBox(g, 0.22, 0.006, 0.16, mat(style, 'paint:Powder blue'), [0.06, 0.892, 0.12]);
  },
  pantry(g, style) {
    const cab = mat(style, 'paint:Off white');
    const top = mat(style, 'paint:Paper');
    const dark = mat(style, 'darkMetal:Charcoal');
    addBox(g, 1.7, 0.08, 0.56, dark, [0, 0.04, 0]);
    addBox(g, 1.7, 0.74, 0.56, cab, [0, 0.45, 0]);
    addBox(g, 1.78, 0.04, 0.62, top, [0, 0.84, 0.01]);
    addBox(g, 0.012, 0.6, 0.012, mat(style, 'paint:Stone'), [0, 0.42, 0.28]);
    addBox(g, 1.7, 0.28, 0.02, mat(style, 'paint:Sage'), [0, 1.02, -0.28]);
    addBox(g, 0.7, 0.02, 0.4, mat(style, 'wood:Tan'), [0, 0.4, 0]);
  },
  fridge(g, style) {
    const metal = mat(style, 'metal:Light gray');
    const dark = mat(style, 'darkMetal:Charcoal');
    addBox(g, 0.58, 0.86, 0.58, metal, [0, 0.43, 0]);
    addBox(g, 0.54, 0.7, 0.02, metal, [0, 0.46, 0.29]);
    addBox(g, 0.03, 0.36, 0.03, dark, [0.2, 0.5, 0.31]);
  },
  kettle(g, style) {
    const body = mat(style, 'paint:Butter');
    const dark = mat(style, 'darkMetal:Charcoal');
    addCyl(g, 0.07, 0.08, 0.12, body, [0, 0.08, 0], { seg: 6 });
    addCyl(g, 0.045, 0.05, 0.02, dark, [0, 0.15, 0], { seg: 6 });
    addBox(g, 0.06, 0.025, 0.025, dark, [0.07, 0.1, 0]);
    addBox(g, 0.02, 0.07, 0.02, dark, [-0.07, 0.1, 0]);
  },
  mug(g, style) {
    addCyl(g, 0.04, 0.036, 0.08, mat(style, 'paint:Off white'), [0, 0.04, 0], { seg: 6 });
    addBox(g, 0.014, 0.04, 0.03, mat(style, 'paint:Off white'), [0.048, 0.045, 0]);
    addCyl(g, 0.038, 0.038, 0.012, mat(style, 'paint:Seafoam'), [0, 0.055, 0], { seg: 6 });
  },
  plant(g, style, look = {}) {
    addCyl(g, 0.18, 0.14, 0.32, mat(style, 'paint:' + (look.pot || 'Apricot')), [0, 0.16, 0], { seg: 6 });
    addCyl(g, 0.15, 0.15, 0.02, mat(style, 'wood:Walnut'), [0, 0.33, 0], { seg: 6 });
    [[0, 0.62, 0, 0.18], [0.14, 0.48, 0.06, 0.14], [-0.12, 0.46, -0.05, 0.13], [0.04, 0.74, -0.08, 0.12]].forEach(
      ([x, y, z, r], i) => addLobe(g, style, r, i % 2 ? 'leaf:Moss' : 'leaf:Sage', [x, y, z], [1, 0.85, 1], 100 + i),
    );
  },
  plant_small(g, style) {
    addCyl(g, 0.06, 0.05, 0.09, mat(style, 'paint:Off white'), [0, 0.045, 0], { seg: 5 });
    [[0, 0.16, 0], [0.045, 0.13, 0.02], [-0.04, 0.12, -0.02]].forEach((pos, i) => {
      addLobe(g, style, 0.06, i ? 'leaf:Sage' : 'leaf:Moss', pos, [1, 0.8, 1], 110 + i);
    });
  },
  pinboard(g, style) {
    const frame = mat(style, 'wood:Walnut');
    addBox(g, 1.4, 0.9, 0.04, frame, [0, 0.45, 0.02]);
    addBox(g, 1.28, 0.78, 0.012, mat(style, 'cloth:Sand'), [0, 0.45, 0.044]);
    const notes = [
      [-0.38, 0.68, 0.22, 0.16, -0.08, 'paint:Butter'],
      [-0.05, 0.62, 0.18, 0.14, 0.12, 'paint:Blush'],
      [0.32, 0.7, 0.2, 0.15, -0.05, 'paint:Powder blue'],
      [-0.42, 0.32, 0.16, 0.18, 0.1, 'paint:Sage'],
      [0.05, 0.28, 0.24, 0.16, -0.12, 'paint:Off white'],
      [0.38, 0.3, 0.16, 0.2, 0.08, 'paint:Apricot'],
    ];
    for (const [x, y, w, h, rot, key] of notes) addBox(g, w, h, 0.008, mat(style, key), [x, y, 0.054], [0, 0, rot]);
  },
  pendant_bar(g, style) {
    const dark = mat(style, 'darkMetal:Ink');
    addBox(g, 2.2, 0.06, 0.08, dark, [0, 0.04, 0]);
    addBox(g, 2.0, 0.015, 0.045, mat(style, 'light:Butter'), [0, 0.008, 0]);
    addCyl(g, 0.006, 0.006, 0.7, dark, [-0.6, 0.42, 0], { seg: 4 });
    addCyl(g, 0.006, 0.006, 0.7, dark, [0.6, 0.42, 0], { seg: 4 });
  },
  notebook(g, style) {
    addBox(g, 0.24, 0.018, 0.18, mat(style, 'paint:Off white'), [0, 0.009, 0]);
    addBox(g, 0.22, 0.012, 0.16, mat(style, 'paint:Powder blue'), [0.008, 0.024, 0]);
    addBox(g, 0.2, 0.01, 0.15, mat(style, 'paint:Butter'), [-0.006, 0.034, 0.006]);
  },
  bin(g, style) {
    addBox(g, 0.28, 0.36, 0.28, mat(style, 'darkMetal:Charcoal'), [0, 0.18, 0]);
    addBox(g, 0.26, 0.02, 0.26, mat(style, 'darkMetal:Ink'), [0, 0.37, 0]);
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
    addBox(g, 0.035, h - b * 2, d * 0.55, frame, [0, h / 2, 0]);
    addBox(g, w - b * 2 + 0.02, h - b * 2 + 0.02, 0.012, glass, [0, h / 2, 0]);
    addBox(g, w + 0.08, 0.04, 0.08, frame, [0, 0.015, d / 2 + 0.015]);
  },
  door(g, style) {
    const metal = mat(style, 'darkMetal:Charcoal');
    const glass = mat(style, 'glass:Sky');
    const { w, h, d } = DOOR;
    const jb = 0.07;
    addBox(g, jb, h, d, metal, [-w / 2 + jb / 2, h / 2, 0]);
    addBox(g, jb, h, d, metal, [w / 2 - jb / 2, h / 2, 0]);
    addBox(g, w, jb, d, metal, [0, h - jb / 2, 0]);
    addBox(g, w, 0.08, d, metal, [0, 0.04, 0]);
    const dw = w - jb * 2;
    addBox(g, dw - 0.04, h - 0.28, 0.012, glass, [0, h / 2 + 0.02, 0]);
    addBox(g, 0.03, h - 0.3, 0.04, metal, [0, h / 2, 0]);
    addBox(g, 0.28, 0.03, 0.04, mat(style, 'metal:Light gray'), [dw / 2 - 0.18, 1.05, d / 2]);
  },
};

const LABELS = {
  bench: 'Shared bench',
  monitor: 'Monitor',
  task_chair: 'Sled chair',
  sofa: 'Lounge sofa',
  coffee_table: 'Coffee table',
  rug: 'Lounge rug',
  floor_lamp: 'Floor lamp',
  printer: 'Printer station',
  pantry: 'Pantry counter',
  fridge: 'Mini fridge',
  kettle: 'Kettle',
  mug: 'Mug',
  plant: 'Floor plant',
  plant_small: 'Desk plant',
  pinboard: 'Pinboard',
  pendant_bar: 'Linear light',
  notebook: 'Notebooks',
  bin: 'Waste bin',
  window: 'Studio window',
  door: 'Glass door',
};

const NO_HIT = new Set(['rug', 'pendant_bar']);
const BACK = new Set(['pinboard']);

function hitFor(name, footprint) {
  if (NO_HIT.has(name)) return [];
  const [w, d] = footprint;
  if (BACK.has(name)) return [{ z: d / 2, hw: w / 2, hd: d / 2 }];
  return [{ hw: w / 2, hd: d / 2 }];
}

/** One catalogue row per kit item, in manifest order. */
export const OPEN_OFFICE_ITEMS = Object.entries(manifest.items).map(([name, item]) => ({
  name,
  id: `openoffice.${name}`,
  label: LABELS[name] ?? item.label,
  kitGroup: item.group,
  size: item.footprint,
  hit: hitFor(name, item.footprint),
}));

/** A kit item standing on y = 0, facing +z. Geometry is its own (safe to dispose). */
export function buildOpenOfficeItem(name, style, look) {
  const build = BUILDERS[name];
  if (!build) throw new Error(`Unknown open office item "${name}"`);
  const g = new THREE.Group();
  g.name = name;
  build(g, style, look || {});
  g.userData.openOfficeItem = name;
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
    trim(band, 0.025, rail, band - 0.012, band + 0.012);
  }
}

/**
 * The whole open office (12 × 10 m). `cutaway` hides the front (+z) and
 * side (+x) walls so the inside reads from the isometric catalogue camera.
 * Meshes are merged per material.
 */
export function buildOpenOfficeRoom(style, { cutaway = false, seed = 0 } = {}) {
  const plan = openOfficePlan(seed);
  const body = new THREE.Group();
  const front = new THREE.Group();
  const side = new THREE.Group();
  const hits = [];

  const tileH = TILE_TOP - SLAB_TOP;
  const nx = 6;
  const nz = 5;
  for (let i = 0; i < nx; i++) {
    for (let j = 0; j < nz; j++) {
      addBox(body, 12 / nx, tileH, 10 / nz, mat(style, (i + j) % 2 ? 'concrete:Stone' : 'concrete:Light gray'),
        [-6 + (i + 0.5) * (12 / nx), (SLAB_TOP + TILE_TOP) / 2, -5 + (j + 0.5) * (10 / nz)]);
    }
  }
  addBox(body, 12, 0.22, 10, mat(style, 'concrete:Gray'), [0, SLAB_TOP - 0.11, 0]);

  const hole = (a0, a1, y0, h) => ({ a0: a0 + LIP, a1: a1 - LIP, y0: y0 + LIP, y1: y0 + h - LIP });
  const doorSpan = [-0.7, -0.7 + DOOR.w];
  const frontHoles = [{ a0: doorSpan[0], a1: doorSpan[1], y0: 0, y1: DOOR.h - LIP }];
  const sideWins = [[-3.4, -3.4 + WIN.w], [-0.4, -0.4 + WIN.w], [2.6, 2.6 + WIN.w]];
  const sideHoles = sideWins.map(([a0, a1]) => hole(a0, a1, 0.85, WIN.h));

  const plain = { low: 'darkMetal:Charcoal', high: 'paint:Off white', band: 0.1, rail: null };
  const accent = { low: 'darkMetal:Charcoal', high: 'paint:Sage', band: 0.1, rail: null };
  splitWall(body, style, { axis: 'x', a0: -6, a1: 6, fix: -4.93, y1: RH, holes: [], hits, inward: 1, ...accent });
  splitWall(body, style, { axis: 'z', a0: -5, a1: 5, fix: -5.93, y1: RH, holes: [], hits, inward: 1, ...plain });
  splitWall(front, style, { axis: 'x', a0: -6, a1: 6, fix: 4.93, y1: RH, holes: frontHoles, hits: cutaway ? null : hits, inward: -1, ...plain });
  splitWall(side, style, { axis: 'z', a0: -5, a1: 5, fix: 5.93, y1: RH, holes: sideHoles, hits: cutaway ? null : hits, inward: -1, ...plain });

  const place = (group, name, x, y, z, rotY) => {
    const item = buildOpenOfficeItem(name, style);
    item.position.set(x, y, z);
    item.rotation.y = rotY;
    group.add(item);
  };
  const doorX = (doorSpan[0] + doorSpan[1]) / 2;
  place(front, 'door', doorX, 0, 4.93, 0);
  if (!cutaway) hits.push({ x: doorX, z: 4.93, hw: DOOR.w / 2, hd: DOOR.d / 2 });
  sideWins.forEach(([a0, a1]) => place(side, 'window', 5.93, 0.85, (a0 + a1) / 2, P / 2));

  for (const p of plan.placements) {
    const item = buildOpenOfficeItem(p.item, style, plan.look);
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
  room.name = 'tiny_open_office';
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
