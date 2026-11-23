import * as THREE from 'three';
import { PALETTE } from '../styles/palette.js';
import { mulberry32 } from '../lib/rng.js';
import { lobe, shadeMaterial } from '../lib/foliage.js';
import { mergeByMaterial } from '../lib/merge.js';
import manifest from '../../public/cafe-kit/manifest.json';
import { cafePlan } from './arrange.js';

// A small Japanese cafe (kissaten), in the same boxes and cylinders as the
// office kit. Built here, not loaded, so createAsset stays synchronous.
// Every colour is `role:Swatch` through style.material, so palette swaps,
// the PS1 wobble and the outline flag all apply.
//
// Wood browns use the wood role. Cream walls, the apricot lampshades and the
// chalk colours use paint / cloth / light, so the building-colour rule does
// not turn them grey. Cylinder sides are the kit's own counts (already the
// PS1 0.3× detail). They are not passed through seg().
//
// Room: 8 m wide (x) by 6 m deep (z), origin at the bottom centre, front
// facing +z. The floor sits 2 cm above y = 0 so it does not flicker against
// the catalogue ground. Cutaway hides the +z and +x walls: those two face
// the isometric catalogue camera.

const P = Math.PI;
const SLAB_TOP = 0.02;
const TILE_TOP = SLAB_TOP + 0.05;

const WIN = { w: 1.86, h: 1.32, d: 0.1 };
const DOOR = { w: 1.02, h: 2.18, d: 0.1 };
const LIP = 0.05;
const TH = 0.14;

const glassOf = new WeakMap();

function mat(style, key) {
  const i = key.indexOf(':');
  const role = key.slice(0, i);
  const swatch = key.slice(i + 1);
  // Window panes and the pastry glass stay see-through. Clone: the cached
  // style material is shared, and its opacity is an outline flag, not glass.
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
  bar(g, style) {
    const wood = mat(style, 'wood:Walnut');
    const top = mat(style, 'paint:Paper');
    const kick = mat(style, 'darkMetal:Charcoal');
    const rail = mat(style, 'metal:Stone');
    addBox(g, 2.36, 0.1, 0.58, kick, [0, 0.05, -0.02]);
    addBox(g, 2.4, 0.86, 0.62, wood, [0, 0.53, -0.01]);
    addBox(g, 2.2, 0.5, 0.012, mat(style, 'wood:Tan'), [0, 0.48, 0.3]);
    addBox(g, 2.52, 0.05, 0.7, top, [0, 1.025, 0.02]);
    addBox(g, 2.52, 0.025, 0.03, rail, [0, 0.99, 0.36]);
    addCyl(g, 0.018, 0.018, 2.2, rail, [0, 0.28, 0.36], { seg: 6, rot: [0, 0, P / 2] });
  },
  espresso_machine(g, style) {
    const body = mat(style, 'metal:Light gray');
    const dark = mat(style, 'darkMetal:Ink');
    const steel = mat(style, 'metal:Stone');
    addBox(g, 0.42, 0.06, 0.4, dark, [0, 0.03, 0]);
    addBox(g, 0.36, 0.42, 0.34, body, [0, 0.27, -0.01]);
    addBox(g, 0.22, 0.16, 0.16, steel, [0, 0.52, 0.02]);
    addBox(g, 0.08, 0.1, 0.1, dark, [0, 0.4, 0.18]);
    addBox(g, 0.1, 0.03, 0.08, dark, [0, 0.34, 0.22]);
    addBox(g, 0.02, 0.16, 0.02, steel, [0.16, 0.36, 0.12]);
    addBox(g, 0.08, 0.02, 0.02, steel, [0.2, 0.28, 0.12]);
    addCyl(g, 0.045, 0.045, 0.02, mat(style, 'paint:Charcoal'), [0.1, 0.4, 0.175], { seg: 8, rot: [P / 2, 0, 0] });
    addBox(g, 0.16, 0.04, 0.012, mat(style, 'darkMetal:Charcoal'), [0, 0.22, 0.175]);
    addCyl(g, 0.045, 0.04, 0.05, mat(style, 'paint:Off white'), [-0.08, 0.5, 0.02], { seg: 6 });
  },
  grinder(g, style) {
    const body = mat(style, 'metal:Light gray');
    const dark = mat(style, 'darkMetal:Charcoal');
    addBox(g, 0.16, 0.22, 0.18, body, [0, 0.11, 0]);
    addCyl(g, 0.07, 0.05, 0.14, mat(style, 'paint:Walnut'), [0, 0.29, 0], { seg: 6 });
    addCyl(g, 0.045, 0.045, 0.02, dark, [0, 0.37, 0], { seg: 6 });
    addBox(g, 0.08, 0.02, 0.02, dark, [0.08, 0.2, 0]);
  },
  pastry_case(g, style) {
    const wood = mat(style, 'wood:Walnut');
    const frame = mat(style, 'metal:Light gray');
    const glass = mat(style, 'glass:Sky');
    const cake = mat(style, 'paint:Apricot');
    addBox(g, 0.78, 0.5, 0.42, wood, [0, 0.25, 0]);
    addBox(g, 0.74, 0.02, 0.36, mat(style, 'paint:Paper'), [0, 0.51, 0]);
    for (const sx of [-1, 1]) addBox(g, 0.03, 0.72, 0.4, frame, [sx * 0.375, 0.88, 0]);
    addBox(g, 0.78, 0.03, 0.4, frame, [0, 1.225, 0]);
    addBox(g, 0.72, 0.66, 0.012, glass, [0, 0.86, 0.19]);
    addBox(g, 0.7, 0.012, 0.34, glass, [0, 1.2, 0]);
    addBox(g, 0.7, 0.015, 0.32, mat(style, 'paint:Off white'), [0, 0.7, 0]);
    addBox(g, 0.7, 0.015, 0.32, mat(style, 'paint:Off white'), [0, 0.98, 0]);
    addCyl(g, 0.08, 0.08, 0.07, cake, [-0.18, 0.75, 0], { seg: 6 });
    addCyl(g, 0.045, 0.045, 0.04, mat(style, 'paint:Dusty rose'), [-0.18, 0.8, 0], { seg: 6 });
    addBox(g, 0.14, 0.05, 0.08, mat(style, 'paint:Butter'), [0.08, 0.735, 0.04], [0, 0.4, 0]);
    addBox(g, 0.1, 0.04, 0.06, mat(style, 'paint:Sand'), [0.16, 0.73, -0.06], [0, -0.5, 0]);
    addCyl(g, 0.07, 0.07, 0.05, mat(style, 'paint:Blush'), [0.12, 1.02, 0.02], { seg: 6 });
    addBox(g, 0.12, 0.035, 0.07, cake, [-0.16, 1.01, -0.04], [0, 0.3, 0]);
  },
  register(g, style) {
    const body = mat(style, 'darkMetal:Charcoal');
    const pale = mat(style, 'paint:Off white');
    addBox(g, 0.28, 0.12, 0.3, body, [0, 0.06, 0]);
    addBox(g, 0.26, 0.08, 0.04, pale, [0, 0.16, 0.08], [-0.4, 0, 0]);
    addBox(g, 0.2, 0.05, 0.008, mat(style, 'glass:Navy'), [0, 0.165, 0.1], [-0.4, 0, 0]);
    addBox(g, 0.22, 0.012, 0.16, mat(style, 'paint:Charcoal'), [0, 0.126, 0.04]);
  },
  menu_board(g, style) {
    const W = 1.15;
    const H = 0.86;
    const frame = mat(style, 'wood:Walnut');
    addBox(g, W, H, 0.04, frame, [0, H / 2, 0.02]);
    addBox(g, W - 0.08, H - 0.08, 0.012, mat(style, 'darkMetal:Ink'), [0, H / 2, 0.044]);
    const rows = [
      [0.72, 0.62, 'paint:Butter'],
      [0.58, 0.5, 'paint:Off white'],
      [0.66, 0.38, 'paint:Blush'],
      [0.5, 0.26, 'paint:Sage'],
      [0.7, 0.14, 'paint:Apricot'],
    ];
    for (const [w, y, key] of rows) addBox(g, w, 0.035, 0.008, mat(style, key), [-0.08, y, 0.054]);
    addBox(g, 0.9, 0.04, 0.06, frame, [0, 0.02, 0.04]);
  },
  shelf(g, style) {
    const wood = mat(style, 'wood:Tan');
    addBox(g, 0.9, 0.04, 0.22, wood, [0, 0.02, 0.11]);
    for (const sx of [-1, 1]) addBox(g, 0.03, 0.16, 0.03, wood, [sx * 0.38, -0.06, 0.04]);
    const jars = [[-0.26, 'paint:Off white'], [0, 'paint:Butter'], [0.26, 'paint:Sage']];
    for (const [x, key] of jars) addCyl(g, 0.05, 0.055, 0.1, mat(style, key), [x, 0.09, 0.1], { seg: 6 });
  },
  table(g, style) {
    const top = mat(style, 'wood:Tan');
    const leg = mat(style, 'wood:Walnut');
    addCyl(g, 0.36, 0.36, 0.035, top, [0, 0.725, 0], { seg: 8 });
    addCyl(g, 0.04, 0.045, 0.66, leg, [0, 0.36, 0], { seg: 6 });
    addCyl(g, 0.16, 0.16, 0.03, leg, [0, 0.02, 0], { seg: 8 });
  },
  chair(g, style) {
    const wood = mat(style, 'wood:Tan');
    const dark = mat(style, 'wood:Walnut');
    for (const sx of [-1, 1]) {
      addBox(g, 0.035, 0.44, 0.035, dark, [sx * 0.16, 0.22, 0.15]);
      addBox(g, 0.035, 0.82, 0.035, dark, [sx * 0.16, 0.41, -0.15]);
    }
    addBox(g, 0.36, 0.04, 0.36, wood, [0, 0.46, 0.02]);
    addBox(g, 0.32, 0.28, 0.03, wood, [0, 0.68, -0.16]);
    addBox(g, 0.32, 0.03, 0.28, dark, [0, 0.16, 0]);
  },
  window_counter(g, style) {
    const top = mat(style, 'wood:Tan');
    const wood = mat(style, 'wood:Walnut');
    const metal = mat(style, 'metal:Stone');
    addBox(g, 2.5, 0.05, 0.42, top, [0, 1.02, 0]);
    addBox(g, 2.42, 0.72, 0.34, wood, [0, 0.62, -0.02]);
    for (const x of [-1.0, 0, 1.0]) addBox(g, 0.04, 0.55, 0.04, metal, [x, 0.28, 0.16]);
    addBox(g, 2.3, 0.03, 0.03, metal, [0, 0.22, 0.16]);
  },
  stool(g, style) {
    const wood = mat(style, 'wood:Tan');
    const dark = mat(style, 'wood:Walnut');
    for (const sx of [-1, 1]) {
      addBox(g, 0.035, 0.64, 0.035, dark, [sx * 0.14, 0.32, 0.12]);
      addBox(g, 0.035, 0.9, 0.035, dark, [sx * 0.14, 0.45, -0.12]);
    }
    addBox(g, 0.34, 0.04, 0.32, wood, [0, 0.66, 0]);
    addBox(g, 0.3, 0.16, 0.03, wood, [0, 0.82, -0.13]);
    addBox(g, 0.3, 0.025, 0.22, dark, [0, 0.22, 0]);
  },
  cup(g, style) {
    const cup = mat(style, 'paint:Off white');
    addCyl(g, 0.04, 0.034, 0.07, cup, [0, 0.05, 0], { seg: 6 });
    addBox(g, 0.012, 0.04, 0.028, cup, [0.046, 0.05, 0]);
    addCyl(g, 0.07, 0.07, 0.012, mat(style, 'paint:Paper'), [0, 0.006, 0], { seg: 6 });
    addBox(g, 0.06, 0.008, 0.012, mat(style, 'metal:Light gray'), [0.02, 0.016, 0.04], [0, 0.6, 0]);
  },
  cake(g, style) {
    addCyl(g, 0.1, 0.1, 0.015, mat(style, 'paint:Off white'), [0, 0.008, 0], { seg: 6 });
    addCyl(g, 0.07, 0.07, 0.05, mat(style, 'paint:Apricot'), [0, 0.04, 0], { seg: 6 });
    addCyl(g, 0.04, 0.04, 0.02, mat(style, 'paint:Dusty rose'), [0, 0.07, 0], { seg: 5 });
  },
  caddy(g, style) {
    const wood = mat(style, 'wood:Walnut');
    addBox(g, 0.2, 0.02, 0.1, wood, [0, 0.01, 0]);
    addCyl(g, 0.028, 0.032, 0.07, mat(style, 'paint:Off white'), [-0.05, 0.05, 0], { seg: 5 });
    addCyl(g, 0.026, 0.03, 0.06, mat(style, 'paint:Butter'), [0.02, 0.045, 0], { seg: 5 });
    addBox(g, 0.03, 0.07, 0.03, mat(style, 'paint:Paper'), [0.07, 0.05, 0]);
  },
  plant(g, style, look = {}) {
    addCyl(g, 0.16, 0.13, 0.28, mat(style, 'paint:' + (look.pot || 'Apricot')), [0, 0.14, 0], { seg: 6 });
    addCyl(g, 0.14, 0.14, 0.02, mat(style, 'wood:Walnut'), [0, 0.28, 0], { seg: 6 });
    [[0, 0.55, 0, 0.16], [0.12, 0.42, 0.06, 0.13], [-0.1, 0.4, -0.04, 0.12], [0.02, 0.62, -0.08, 0.11]].forEach(
      ([x, y, z, r], i) => addLobe(g, style, r, i % 2 ? 'leaf:Moss' : 'leaf:Sage', [x, y, z], [1, 0.85, 1], 70 + i),
    );
  },
  plant_small(g, style, look = {}) {
    addCyl(g, 0.07, 0.055, 0.1, mat(style, 'paint:' + (look.pot || 'Off white')), [0, 0.05, 0], { seg: 5 });
    [[0, 0.18, 0], [0.05, 0.15, 0.03], [-0.04, 0.14, -0.02]].forEach((pos, i) => {
      addLobe(g, style, 0.07, 'leaf:Moss', pos, [1, 0.8, 1], 80 + i);
    });
  },
  pendant(g, style, look = {}) {
    const shade = mat(style, 'paint:' + (look.shade || 'Apricot'));
    addCyl(g, 0.05, 0.16, 0.14, shade, [0, 0.08, 0], { seg: 6 });
    addCyl(g, 0.07, 0.07, 0.012, mat(style, 'light:Butter'), [0, 0.03, 0], { seg: 6 });
    addCyl(g, 0.006, 0.006, 0.72, mat(style, 'darkMetal:Ink'), [0, 0.5, 0], { seg: 4 });
    addCyl(g, 0.04, 0.04, 0.02, shade, [0, 0.87, 0], { seg: 5 });
  },
  noren(g, style, look = {}) {
    const cloth = mat(style, 'paint:' + (look.noren || 'Sage'));
    const band = mat(style, 'paint:Off white');
    const rod = mat(style, 'wood:Walnut');
    addCyl(g, 0.015, 0.015, 0.9, rod, [0, 0.78, 0], { seg: 5, rot: [0, 0, P / 2] });
    for (const sx of [-1, 1]) {
      addBox(g, 0.38, 0.7, 0.012, cloth, [sx * 0.21, 0.38, 0]);
      addBox(g, 0.38, 0.06, 0.014, band, [sx * 0.21, 0.62, 0.002]);
    }
  },
  mat(g, style) {
    addBox(g, 0.7, 0.012, 0.42, mat(style, 'cloth:Sand'), [0, 0.006, 0]);
    addBox(g, 0.5, 0.004, 0.06, mat(style, 'cloth:Sage'), [0, 0.014, 0]);
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
    addBox(g, w + 0.08, 0.04, 0.08, frame, [0, 0.02, d / 2 + 0.015]);
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
    addBox(g, 0.03, 0.16, 0.04, mat(style, 'metal:Stone'), [dw / 2 - 0.08, 1.0, d / 2]);
  },
};

const LABELS = {
  bar: 'Espresso bar',
  espresso_machine: 'Espresso machine',
  grinder: 'Coffee grinder',
  pastry_case: 'Pastry case',
  register: 'Cash register',
  menu_board: 'Chalk menu',
  shelf: 'Wall shelf',
  table: 'Cafe table',
  chair: 'Cafe chair',
  window_counter: 'Window counter',
  stool: 'Counter stool',
  cup: 'Coffee cup',
  cake: 'Cake plate',
  caddy: 'Sugar caddy',
  plant: 'Floor plant',
  plant_small: 'Small plant',
  pendant: 'Pendant lamp',
  noren: 'Noren curtain',
  mat: 'Floor mat',
  window: 'Cafe window',
  door: 'Cafe door',
};

const NO_HIT = new Set(['pendant', 'noren', 'mat']);
const BACK = new Set(['menu_board', 'shelf']);

function hitFor(name, footprint) {
  if (NO_HIT.has(name)) return [];
  const [w, d] = footprint;
  if (BACK.has(name)) return [{ z: d / 2, hw: w / 2, hd: d / 2 }];
  return [{ hw: w / 2, hd: d / 2 }];
}

/** One catalogue row per kit item, in manifest order. */
export const CAFE_ITEMS = Object.entries(manifest.items).map(([name, item]) => ({
  name,
  id: `cafe.${name}`,
  label: LABELS[name] ?? item.label,
  kitGroup: item.group,
  size: item.footprint,
  hit: hitFor(name, item.footprint),
}));

/** A kit item standing on y = 0, facing +z. Geometry is its own (safe to dispose). */
export function buildCafeItem(name, style, look) {
  const build = BUILDERS[name];
  if (!build) throw new Error(`Unknown cafe item "${name}"`);
  const g = new THREE.Group();
  g.name = name;
  build(g, style, look || {});
  g.userData.cafeItem = name;
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
    trim(band, 0.03, rail, band - 0.015, band + 0.015);
    trim(0.05, 0.025, 'darkMetal:Charcoal', 0, 0.08);
  }
}

/**
 * The whole cafe (8 × 6 m). `cutaway` hides the front (+z) and side (+x)
 * walls so the inside reads from the isometric catalogue camera.
 * Meshes are merged per material.
 */
export function buildCafeRoom(style, { cutaway = false, seed = 0 } = {}) {
  const plan = cafePlan(seed);
  const body = new THREE.Group();
  const front = new THREE.Group();
  const side = new THREE.Group();
  const hits = [];

  // One solid wood floor. No planks.
  const floorH = TILE_TOP - SLAB_TOP;
  addBox(body, 8, floorH, 6, mat(style, 'wood:Walnut'), [0, (SLAB_TOP + TILE_TOP) / 2, 0]);
  addBox(body, 8, 0.22, 6, mat(style, 'concrete:Gray'), [0, SLAB_TOP - 0.11, 0]);

  const hole = (a0, a1, y0, h) => ({ a0: a0 + LIP, a1: a1 - LIP, y0: y0 + LIP, y1: y0 + h - LIP });
  const frontWins = [[-3.55, -3.55 + WIN.w], [-0.85, -0.85 + WIN.w]];
  const doorSpan = [2.15, 2.15 + DOOR.w];
  const frontHoles = [
    ...frontWins.map(([a0, a1]) => hole(a0, a1, 0.95, WIN.h)),
    { a0: doorSpan[0], a1: doorSpan[1], y0: 0, y1: DOOR.h - LIP },
  ];
  const leftWin = [-0.2, -0.2 + WIN.w];
  const leftHoles = [hole(leftWin[0], leftWin[1], 0.95, WIN.h)];

  const wallColors = { low: 'wood:Tan', high: 'paint:Off white', band: 0.95, rail: 'wood:Walnut' };
  splitWall(body, style, { axis: 'x', a0: -4, a1: 4, fix: -2.93, y1: RH, holes: [], hits, inward: 1, ...wallColors });
  splitWall(body, style, { axis: 'z', a0: -3, a1: 3, fix: -3.93, y1: RH, holes: leftHoles, hits, inward: 1, ...wallColors });
  splitWall(front, style, { axis: 'x', a0: -4, a1: 4, fix: 2.93, y1: RH, holes: frontHoles, hits: cutaway ? null : hits, inward: -1, ...wallColors });
  splitWall(side, style, { axis: 'z', a0: -3, a1: 3, fix: 3.93, y1: RH, holes: [], hits: cutaway ? null : hits, inward: -1, ...wallColors });

  const place = (group, name, x, y, z, rotY) => {
    const item = buildCafeItem(name, style);
    item.position.set(x, y, z);
    item.rotation.y = rotY;
    group.add(item);
  };
  frontWins.forEach(([a0, a1]) => place(front, 'window', (a0 + a1) / 2, 0.95, 2.93, 0));
  const doorX = (doorSpan[0] + doorSpan[1]) / 2;
  place(front, 'door', doorX, 0, 2.93, 0);
  place(body, 'window', -3.93, 0.95, (leftWin[0] + leftWin[1]) / 2, P / 2);
  if (!cutaway) hits.push({ x: doorX, z: 2.93, hw: DOOR.w / 2, hd: DOOR.d / 2 });

  for (const p of plan.placements) {
    const item = buildCafeItem(p.item, style, plan.look);
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
  room.name = 'tiny_cafe';
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
