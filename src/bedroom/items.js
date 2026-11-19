import * as THREE from 'three';
import { PALETTE } from '../styles/palette.js';
import { mulberry32 } from '../lib/rng.js';
import { lobe, shadeMaterial } from '../lib/foliage.js';
import { mergeByMaterial } from '../lib/merge.js';
import manifest from '../../public/bedroom-kit/manifest.json';
import layout from '../../public/bedroom-kit/layout.json';
import { bedroomPlan } from './layout.js';

// Small bedroom, in the same boxes and cylinders as the office kit
// (src/office/items.js). Built here, not loaded, so createAsset stays
// synchronous. Every colour is `role:Swatch` through style.material, so
// palette swaps, the PS1 wobble and the outline flag all apply.
//
// Bedding, the rug and the curtains use cloth / paint, so powder blue and
// dusty rose are not flattened by the building-colour rule. The floor is
// wood. Cylinder sides are the kit's own counts (already the PS1 0.3×
// detail). They are not passed through seg().
//
// Room: 3.5 m wide (x) by 3 m deep (z), origin at the bottom centre, front
// facing +z. One single bed. The floor sits 2 cm above y = 0. Cutaway hides
// the +z and +x walls, the two the isometric catalogue camera faces. The
// window is on the far (−z) wall so it stays in that view.

const P = Math.PI;
const SLAB_TOP = 0.02;
const TILE_TOP = SLAB_TOP + 0.05;

const WIN = { w: 0.96, h: 1.16 };

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
  bed(g, style, look) {
    const wood = mat(style, 'wood:Walnut');
    const sheet = mat(style, 'paint:Off white');
    const duvet = mat(style, look?.duvet ?? 'cloth:Powder blue');
    const pillow = mat(style, 'paint:Paper');
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) addBox(g, 0.06, 0.14, 0.06, wood, [sx * 0.4, 0.07, sz * 0.9]);
    }
    addBox(g, 0.96, 0.1, 1.96, wood, [0, 0.19, 0]);
    addBox(g, 0.96, 0.55, 0.06, wood, [0, 0.5, -0.97]);
    addBox(g, 0.88, 0.14, 1.82, sheet, [0, 0.31, 0.02]);
    addBox(g, 0.9, 0.08, 1.28, duvet, [0, 0.4, 0.28]);
    addBox(g, 0.9, 0.04, 0.22, duvet, [0, 0.44, -0.28]);
    addBox(g, 0.52, 0.1, 0.3, pillow, [0, 0.42, -0.68]);
    addBox(g, 0.28, 0.08, 0.2, pillow, [0.22, 0.46, -0.62]);
  },
  side_table(g, style) {
    const wood = mat(style, 'wood:Walnut');
    const metal = mat(style, 'metal:Stone');
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) addBox(g, 0.035, 0.48, 0.035, wood, [sx * 0.16, 0.24, sz * 0.16]);
    }
    addBox(g, 0.4, 0.03, 0.4, wood, [0, 0.5, 0]);
    addBox(g, 0.32, 0.1, 0.32, wood, [0, 0.36, 0]);
    addBox(g, 0.08, 0.016, 0.016, metal, [0, 0.36, 0.17]);
    addBox(g, 0.34, 0.02, 0.34, wood, [0, 0.12, 0]);
  },
  lamp(g, style) {
    const metal = mat(style, 'metal:Light gray');
    const shade = mat(style, 'paint:Paper');
    addCyl(g, 0.07, 0.08, 0.02, metal, [0, 0.01, 0], { seg: 7 });
    addCyl(g, 0.012, 0.012, 0.22, metal, [0, 0.13, 0], { seg: 5 });
    addCyl(g, 0.09, 0.12, 0.12, shade, [0, 0.3, 0], { seg: 6 });
    addCyl(g, 0.05, 0.05, 0.012, mat(style, 'light:Butter'), [0, 0.26, 0], { seg: 6 });
    addCyl(g, 0.1, 0.1, 0.012, metal, [0, 0.36, 0], { seg: 6 });
  },
  wardrobe(g, style) {
    const body = mat(style, 'paint:Off white');
    const trim = mat(style, 'wood:Walnut');
    const metal = mat(style, 'metal:Stone');
    addBox(g, 0.92, 1.78, 0.52, body, [0, 0.93, 0]);
    addBox(g, 0.96, 0.04, 0.56, trim, [0, 1.84, 0]);
    addBox(g, 0.9, 0.06, 0.5, mat(style, 'paint:Light gray'), [0, 0.03, 0]);
    addBox(g, 0.4, 1.5, 0.02, body, [-0.21, 0.96, 0.26]);
    addBox(g, 0.4, 1.5, 0.02, body, [0.21, 0.96, 0.26]);
    addBox(g, 0.012, 1.46, 0.008, mat(style, 'paint:Stone'), [0, 0.96, 0.274]);
    for (const sx of [-1, 1]) addBox(g, 0.02, 0.1, 0.02, metal, [sx * 0.06, 0.96, 0.28]);
  },
  desk(g, style) {
    const wood = mat(style, 'wood:Tan');
    const dark = mat(style, 'wood:Walnut');
    const metal = mat(style, 'metal:Stone');
    addBox(g, 0.9, 0.035, 0.48, wood, [0, 0.72, 0]);
    addBox(g, 0.28, 0.58, 0.42, dark, [-0.28, 0.32, -0.01]);
    for (let i = 0; i < 3; i++) addBox(g, 0.22, 0.008, 0.01, metal, [-0.28, 0.18 + i * 0.16, 0.21]);
    addBox(g, 0.04, 0.66, 0.4, dark, [0.38, 0.35, 0]);
    addBox(g, 0.5, 0.04, 0.04, dark, [0.08, 0.68, -0.2]);
  },
  chair(g, style) {
    const wood = mat(style, 'wood:Walnut');
    const seat = mat(style, 'cloth:Sand');
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        const back = sz < 0;
        addBox(g, 0.035, back ? 0.82 : 0.44, 0.035, wood, [sx * 0.16, back ? 0.41 : 0.22, sz * 0.16]);
      }
    }
    addBox(g, 0.4, 0.04, 0.4, seat, [0, 0.44, 0]);
    addBox(g, 0.36, 0.06, 0.03, wood, [0, 0.62, -0.16]);
    addBox(g, 0.36, 0.06, 0.03, wood, [0, 0.76, -0.16]);
  },
  window(g, style) {
    const frame = mat(style, 'wood:Walnut');
    const glass = mat(style, 'glass:Sky');
    const cloth = mat(style, 'cloth:Blush');
    const { w, h } = WIN;
    const b = 0.06;
    const d = 0.07;
    addBox(g, w, b, d, frame, [0, b / 2, 0]);
    addBox(g, w, b, d, frame, [0, h - b / 2, 0]);
    addBox(g, b, h, d, frame, [-w / 2 + b / 2, h / 2, 0]);
    addBox(g, b, h, d, frame, [w / 2 - b / 2, h / 2, 0]);
    addBox(g, 0.035, h - b * 2, d * 0.5, frame, [0, h / 2, 0]);
    addBox(g, w - b * 2 + 0.02, h - b * 2 + 0.02, 0.01, glass, [0, h / 2, 0]);
    addBox(g, w + 0.1, 0.04, 0.12, frame, [0, 0.02, 0.04]);
    addCyl(g, 0.012, 0.012, w + 0.18, mat(style, 'darkMetal:Charcoal'), [0, h + 0.05, 0.05], { seg: 5, rot: [0, 0, P / 2] });
    addBox(g, 0.16, h * 0.92, 0.025, cloth, [-w / 2 + 0.1, h * 0.46, 0.05]);
    addBox(g, 0.16, h * 0.92, 0.025, cloth, [w / 2 - 0.1, h * 0.46, 0.05]);
  },
  rug(g, style, look) {
    addBox(g, 1.55, 0.015, 1.85, mat(style, look?.rug ?? 'cloth:Dusty rose'), [0, 0.008, 0]);
    addBox(g, 1.25, 0.006, 1.5, mat(style, look?.rugBand ?? 'cloth:Sand'), [0, 0.016, 0]);
  },
  books(g, style) {
    const spines = ['paint:Navy', 'paint:Dusty rose', 'paint:Sage'];
    spines.forEach((key, i) => {
      addBox(g, 0.16, 0.022, 0.22, mat(style, key), [0, 0.012 + i * 0.024, 0]);
      addBox(g, 0.012, 0.02, 0.2, mat(style, 'paint:Paper'), [0.07, 0.012 + i * 0.024, 0]);
    });
  },
  plant(g, style) {
    addCyl(g, 0.06, 0.05, 0.08, mat(style, 'concrete:Stone'), [0, 0.04, 0], { seg: 6 });
    [[0, 0.16, 0], [0.04, 0.12, 0.02], [-0.035, 0.13, -0.015]].forEach((pos, i) => {
      addLobe(g, style, 0.055, 'leaf:Moss', pos, [1, 0.8, 1], 21 + i);
    });
  },
  basket(g, style) {
    addCyl(g, 0.12, 0.1, 0.22, mat(style, 'paint:Sand'), [0, 0.11, 0], { seg: 7 });
    addCyl(g, 0.125, 0.125, 0.015, mat(style, 'wood:Tan'), [0, 0.22, 0], { seg: 7 });
    addCyl(g, 0.07, 0.07, 0.012, mat(style, 'paint:Paper'), [0, 0.2, 0], { seg: 6 });
  },
  clock(g, style) {
    const body = mat(style, 'paint:Off white');
    const ink = mat(style, 'darkMetal:Ink');
    addBox(g, 0.1, 0.07, 0.05, body, [0, 0.045, 0]);
    addCyl(g, 0.028, 0.028, 0.012, mat(style, 'paint:Paper'), [0, 0.05, 0.028], { seg: 7, rot: [P / 2, 0, 0] });
    addBox(g, 0.008, 0.02, 0.006, ink, [0.004, 0.055, 0.036]);
    addBox(g, 0.016, 0.006, 0.006, ink, [0.008, 0.048, 0.036]);
    for (const sx of [-1, 1]) addCyl(g, 0.01, 0.01, 0.012, mat(style, 'darkMetal:Charcoal'), [sx * 0.04, 0.07, 0], { seg: 5 });
  },
  picture(g, style) {
    addBox(g, 0.46, 0.36, 0.025, mat(style, 'wood:Walnut'), [0, 0.18, 0.012]);
    addBox(g, 0.38, 0.28, 0.008, mat(style, 'paint:Powder blue'), [0, 0.18, 0.028]);
    addCyl(g, 0.07, 0.07, 0.006, mat(style, 'paint:Butter'), [-0.06, 0.2, 0.034], { seg: 7, rot: [P / 2, 0, 0] });
    addBox(g, 0.1, 0.14, 0.006, mat(style, 'paint:Sage'), [0.08, 0.16, 0.034]);
  },
};

const LABELS = {
  bed: 'Single bed',
  side_table: 'Side table',
  lamp: 'Table lamp',
  wardrobe: 'Wardrobe',
  desk: 'Desk',
  chair: 'Desk chair',
  window: 'Window',
  rug: 'Rug',
  books: 'Book stack',
  plant: 'Pot plant',
  basket: 'Wastebasket',
  clock: 'Alarm clock',
  picture: 'Picture',
};

const NO_HIT = new Set(['rug']);
const BACK = new Set(['picture']);

function hitFor(name, footprint) {
  if (NO_HIT.has(name)) return [];
  const [w, d] = footprint;
  if (BACK.has(name)) return [{ z: d / 2, hw: w / 2, hd: d / 2 }];
  return [{ hw: w / 2, hd: d / 2 }];
}

/** One catalogue row per kit item, in manifest order. */
export const BEDROOM_ITEMS = Object.entries(manifest.items).map(([name, item]) => ({
  name,
  id: `bedroom.${name}`,
  label: LABELS[name] ?? item.label,
  kitGroup: item.group,
  size: item.footprint,
  hit: hitFor(name, item.footprint),
}));

/** A kit item standing on y = 0, facing +z. Geometry is its own (safe to dispose). */
export function buildBedroomItem(name, style, look) {
  const build = BUILDERS[name];
  if (!build) throw new Error(`Unknown bedroom item "${name}"`);
  const g = new THREE.Group();
  g.name = name;
  build(g, style, look);
  g.userData.bedroomItem = name;
  return g;
}

const RW = 3.5;
const RD = 3;
const RH = 2.5;
const TH = 0.1;

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

/**
 * The whole bedroom (3.5 × 3 m). `cutaway` hides the front (+z) and side
 * (+x) walls so the inside reads from the isometric catalogue camera.
 */
export function buildBedroomRoom(style, { cutaway = false, seed = 0 } = {}) {
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
  const winX = 0.95;
  const sill = 0.92;
  const hole = {
    a0: winX - WIN.w / 2 + 0.03,
    a1: winX + WIN.w / 2 - 0.03,
    y0: sill + 0.03,
    y1: sill + WIN.h - 0.03,
  };
  splitWall(body, style, { axis: 'z', a0: -RD / 2, a1: RD / 2, fix: west, y1: RH, holes: [], hits, inward: 1 });
  splitWall(body, style, { axis: 'x', a0: -RW / 2, a1: RW / 2, fix: north, y1: RH, holes: [hole], hits, inward: 1 });
  splitWall(side, style, { axis: 'z', a0: -RD / 2, a1: RD / 2, fix: east, y1: RH, holes: [], hits: cutaway ? null : hits, inward: -1 });
  splitWall(front, style, { axis: 'x', a0: -RW / 2, a1: RW / 2, fix: south, y1: RH, holes: [], hits: cutaway ? null : hits, inward: -1 });

  const window = buildBedroomItem('window', style);
  window.position.set(winX, sill, north);
  body.add(window);

  const plan = bedroomPlan(seed);
  const placements = plan?.placements ?? layout.placements;
  for (const p of placements) {
    const item = buildBedroomItem(p.item, style, plan?.look);
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
  room.name = 'tiny_bedroom';
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
