import * as THREE from 'three';
import { PALETTE } from '../styles/palette.js';
import { mergeByMaterial } from '../lib/merge.js';
import manifest from '../../public/police-kit/manifest.json';
import { policeLayout } from './layout.js';

// A Japanese police post, koban colours scaled up to a small station.
// Same boxes and cylinders as the diner kit (src/diner/items.js). Built here,
// not loaded, so createAsset stays synchronous. Every colour is `role:Swatch`
// through style.material, so palette swaps and the PS1 pipeline apply.
//
// Navy, dusty rose and cream use paint / cloth / light, not concrete or wood,
// so the building-colour rule does not turn them grey. Cylinder sides are the
// kit's own counts (already the PS1 0.3× detail), not passed through seg().
//
// Room: 12 m wide (x) by 8 m deep (z), origin at the bottom centre, front
// facing +z. The floor sits 2 cm above y = 0. Cutaway hides the +z and +x
// walls, the two the isometric catalogue camera faces.

const P = Math.PI;
const SLAB_TOP = 0.02;
const TILE_TOP = SLAB_TOP + 0.05;

const WIN = { w: 2.05, h: 1.36, d: 0.12 };
const DOOR = { w: 1.28, h: 2.24, d: 0.12 };
const LIP = 0.05;

// Officer desk top, above the tile. Layout y for a prop on the desk.
const DESK_TOP = 0.74;

const glassOf = new WeakMap();
let roomTint = null;

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
  front_counter(g, style) {
    const navy = mat(style, 'paint:Navy');
    const top = mat(style, 'paint:Off white');
    const edge = mat(style, 'metal:Light gray');
    const rose = mat(style, roomTint?.stripe ?? 'paint:Dusty rose');
    const dark = mat(style, 'darkMetal:Charcoal');
    addBox(g, 4.52, 0.1, 0.68, dark, [0, 0.05, -0.02]);
    addBox(g, 4.48, 0.92, 0.64, navy, [0, 0.56, -0.02]);
    addBox(g, 4.4, 0.06, 0.012, rose, [0, 0.86, 0.308]);
    addBox(g, 4.56, 0.045, 0.72, top, [0, 1.075, 0]);
    addBox(g, 4.56, 0.02, 0.03, edge, [0, 1.045, 0.36]);
    // Service glass, with a speaking gap in the middle. The koban window.
    for (const x of [-1.35, 1.35]) {
      addBox(g, 1.7, 0.5, 0.012, mat(style, 'glass:Sky'), [x, 1.36, 0.3]);
      addBox(g, 1.74, 0.03, 0.03, edge, [x, 1.12, 0.3]);
      addBox(g, 1.74, 0.03, 0.03, edge, [x, 1.6, 0.3]);
    }
    addBox(g, 0.04, 0.52, 0.03, edge, [-2.22, 1.36, 0.3]);
    addBox(g, 0.04, 0.52, 0.03, edge, [2.22, 1.36, 0.3]);
    addBox(g, 0.04, 0.52, 0.03, edge, [-0.48, 1.36, 0.3]);
    addBox(g, 0.04, 0.52, 0.03, edge, [0.48, 1.36, 0.3]);
    addBox(g, 0.36, 0.16, 0.04, dark, [1.7, 1.16, -0.12], [-0.4, 0, 0]);
    addBox(g, 0.28, 0.1, 0.012, mat(style, 'glass:Navy'), [1.7, 1.18, -0.09], [-0.4, 0, 0]);
  },
  officer_desk(g, style) {
    const top = mat(style, 'wood:Tan');
    const body = mat(style, 'paint:Navy');
    const metal = mat(style, 'metal:Light gray');
    addBox(g, 1.36, 0.04, 0.66, top, [0, DESK_TOP, 0]);
    addBox(g, 0.4, 0.66, 0.58, body, [0.42, 0.36, 0]);
    addBox(g, 0.04, 0.64, 0.04, metal, [-0.58, 0.36, -0.26]);
    addBox(g, 0.04, 0.64, 0.04, metal, [-0.58, 0.36, 0.26]);
    addBox(g, 0.36, 0.012, 0.008, mat(style, 'paint:Dusty rose'), [0.42, 0.4, 0.292]);
    addBox(g, 0.32, 0.008, 0.22, mat(style, 'paint:Paper'), [-0.15, DESK_TOP + 0.008, 0.04]);
    addBox(g, 0.14, 0.006, 0.1, mat(style, 'paint:Powder blue'), [-0.28, DESK_TOP + 0.014, -0.08]);
  },
  officer_chair(g, style) {
    const cloth = mat(style, roomTint?.chair ?? 'cloth:Navy');
    const metal = mat(style, 'metal:Light gray');
    const dark = mat(style, 'darkMetal:Charcoal');
    for (const [x, z] of [[-0.18, -0.18], [0.18, -0.18], [-0.18, 0.16], [0.18, 0.16]]) {
      addBox(g, 0.035, 0.42, 0.035, metal, [x, 0.21, z]);
    }
    addBox(g, 0.46, 0.05, 0.44, cloth, [0, 0.44, 0]);
    addBox(g, 0.46, 0.42, 0.05, cloth, [0, 0.7, -0.2]);
    addBox(g, 0.4, 0.03, 0.42, dark, [0, 0.2, 0]);
  },
  holding_cell(g, style) {
    const wall = mat(style, 'paint:Light gray');
    const bar = mat(style, 'darkMetal:Charcoal');
    const metal = mat(style, 'metal:Light gray');
    const pad = mat(style, 'concrete:Slate');
    const cloth = mat(style, 'cloth:Navy');
    const W = 2.5;
    const D = 2.15;
    const H = 2.15;
    const t = 0.07;
    addBox(g, W - 0.2, 0.02, D - 0.2, pad, [0, 0.012, 0]);
    addBox(g, t, H, D, wall, [-W / 2 + t / 2, H / 2, 0]);
    addBox(g, t, H, D, wall, [W / 2 - t / 2, H / 2, 0]);
    addBox(g, W, H, t, wall, [0, H / 2, -D / 2 + t / 2]);
    // Front bars. A wider gap with a lock reads as the cell door.
    const inner = W - t * 2;
    const x0 = -inner / 2;
    for (let i = 0; i <= 10; i++) {
      if (i === 5) continue;
      const x = x0 + (inner * i) / 10;
      addBox(g, 0.035, H - 0.2, 0.035, bar, [x, H / 2, D / 2 - 0.04]);
    }
    addBox(g, inner, 0.05, 0.05, bar, [0, 0.12, D / 2 - 0.04]);
    addBox(g, inner, 0.05, 0.05, bar, [0, H - 0.08, D / 2 - 0.04]);
    addBox(g, 0.08, 0.12, 0.06, metal, [0.02, 1.05, D / 2 - 0.02]);
    addBox(g, 1.15, 0.08, 0.4, wall, [-0.25, 0.42, -D / 2 + 0.36]);
    addBox(g, 1.15, 0.08, 0.4, cloth, [-0.25, 0.5, -D / 2 + 0.36]);
    addBox(g, 0.32, 0.38, 0.36, wall, [W / 2 - 0.32, 0.2, -D / 2 + 0.36]);
    addBox(g, 0.28, 0.12, 0.28, wall, [W / 2 - 0.32, 0.44, -D / 2 + 0.36]);
    addBox(g, 0.1, 0.16, 0.08, wall, [W / 2 - 0.48, 0.5, -D / 2 + 0.36]);
  },
  locker_bank(g, style) {
    const body = mat(style, 'paint:Slate');
    const door = mat(style, 'paint:Navy');
    const metal = mat(style, 'metal:Light gray');
    const rose = mat(style, 'paint:Dusty rose');
    addBox(g, 1.66, 0.08, 0.46, body, [0, 0.04, 0]);
    addBox(g, 1.62, 1.72, 0.42, body, [0, 0.94, 0]);
    addBox(g, 1.66, 0.05, 0.46, rose, [0, 1.78, 0]);
    for (let i = 0; i < 4; i++) {
      const x = -0.6 + i * 0.4;
      addBox(g, 0.36, 1.58, 0.02, door, [x, 0.96, 0.22]);
      addBox(g, 0.03, 0.1, 0.02, metal, [x + 0.12, 0.96, 0.236]);
      addBox(g, 0.22, 0.04, 0.012, mat(style, 'darkMetal:Ink'), [x, 1.45, 0.232]);
    }
  },
  notice_board(g, style) {
    const frame = mat(style, 'wood:Walnut');
    const board = mat(style, 'paint:Paper');
    addBox(g, 1.32, 0.86, 0.03, frame, [0, 0.43, 0.015]);
    addBox(g, 1.2, 0.74, 0.012, board, [0, 0.43, 0.032]);
    // Two portrait sheets with a head-and-shoulders block: a wanted board, no letters.
    const posters = [[-0.38, 'paint:Dusty rose'], [0.02, 'paint:Powder blue']];
    for (const [x, key] of posters) {
      addBox(g, 0.28, 0.4, 0.01, mat(style, key), [x, 0.52, 0.042]);
      addCyl(g, 0.05, 0.05, 0.012, mat(style, 'paint:Apricot'), [x, 0.64, 0.05], { seg: 6, rot: [P / 2, 0, 0] });
      addBox(g, 0.12, 0.08, 0.01, mat(style, 'paint:Navy'), [x, 0.5, 0.052]);
    }
    const notes = ['paint:Butter', 'paint:Sage', 'paint:Blush'];
    notes.forEach((key, i) => addBox(g, 0.42, 0.07, 0.008, mat(style, key), [0.28, 0.68 - i * 0.14, 0.044]));
  },
  filing_cabinet(g, style) {
    const body = mat(style, 'paint:Slate');
    const metal = mat(style, 'metal:Light gray');
    const paper = mat(style, 'paint:Paper');
    addBox(g, 0.46, 1.15, 0.54, body, [0, 0.575, 0]);
    for (let i = 0; i < 3; i++) {
      const y = 0.28 + i * 0.34;
      addBox(g, 0.4, 0.012, 0.012, metal, [0, y, 0.272]);
      addBox(g, 0.12, 0.03, 0.02, metal, [0, y + 0.08, 0.28]);
      addBox(g, 0.16, 0.025, 0.008, paper, [0, y + 0.14, 0.274]);
    }
  },
  water_cooler(g, style) {
    const body = mat(style, 'paint:Off white');
    const water = mat(style, 'paint:Powder blue');
    const metal = mat(style, 'metal:Light gray');
    addBox(g, 0.34, 0.72, 0.32, body, [0, 0.36, 0]);
    addBox(g, 0.28, 0.16, 0.02, water, [0, 0.48, 0.16]);
    addCyl(g, 0.11, 0.12, 0.32, water, [0, 0.96, 0], { seg: 6 });
    addCyl(g, 0.04, 0.05, 0.06, mat(style, 'paint:Navy'), [0, 1.14, 0], { seg: 5 });
    addBox(g, 0.06, 0.04, 0.08, metal, [0, 0.58, 0.18]);
    addCyl(g, 0.035, 0.03, 0.05, mat(style, 'paint:Paper'), [0.1, 0.16, 0.08], { seg: 5 });
    addBox(g, 0.22, 0.02, 0.14, metal, [0, 0.74, 0.08]);
  },
  waiting_bench(g, style) {
    const wood = mat(style, 'wood:Tan');
    const metal = mat(style, 'darkMetal:Charcoal');
    addBox(g, 1.45, 0.05, 0.4, wood, [0, 0.42, 0]);
    addBox(g, 1.45, 0.32, 0.05, wood, [0, 0.64, -0.18]);
    for (const x of [-0.58, 0.58]) {
      addBox(g, 0.05, 0.4, 0.36, metal, [x, 0.2, 0]);
    }
    addBox(g, 1.2, 0.03, 0.04, metal, [0, 0.18, 0]);
  },
  desk_lamp(g, style) {
    const dark = mat(style, 'darkMetal:Charcoal');
    const metal = mat(style, 'metal:Light gray');
    addCyl(g, 0.06, 0.07, 0.02, dark, [0, 0.01, 0], { seg: 6 });
    addBox(g, 0.02, 0.22, 0.02, metal, [0, 0.12, 0], [-0.4, 0, 0]);
    addCyl(g, 0.045, 0.07, 0.07, metal, [0.06, 0.24, 0], { seg: 6, rot: [0.7, 0, 0.4] });
    addCyl(g, 0.035, 0.035, 0.012, mat(style, 'light:Butter'), [0.07, 0.22, 0.03], { seg: 6, rot: [0.7, 0, 0.4] });
  },
  radio(g, style) {
    const body = mat(style, 'darkMetal:Charcoal');
    const metal = mat(style, 'metal:Light gray');
    addBox(g, 0.26, 0.1, 0.14, body, [0, 0.05, 0]);
    addBox(g, 0.1, 0.05, 0.012, mat(style, 'paint:Navy'), [0, 0.07, 0.072]);
    addCyl(g, 0.012, 0.012, 0.16, metal, [0.08, 0.16, 0], { seg: 4 });
    addBox(g, 0.04, 0.025, 0.02, metal, [-0.06, 0.06, 0.075]);
    addBox(g, 0.03, 0.02, 0.012, mat(style, 'light:Dusty rose'), [0.06, 0.045, 0.072]);
  },
  mug(g, style) {
    const cup = mat(style, 'paint:Off white');
    addCyl(g, 0.04, 0.038, 0.08, cup, [0, 0.04, 0], { seg: 6 });
    addBox(g, 0.014, 0.04, 0.03, cup, [0.048, 0.045, 0]);
    addBox(g, 0.03, 0.02, 0.012, mat(style, 'paint:Navy'), [0, 0.045, 0.04]);
  },
  key_board(g, style) {
    const board = mat(style, 'wood:Walnut');
    const metal = mat(style, 'metal:Light gray');
    addBox(g, 0.52, 0.4, 0.025, board, [0, 0.2, 0.012]);
    for (let i = 0; i < 8; i++) {
      const x = -0.18 + (i % 4) * 0.12;
      const y = 0.28 - Math.floor(i / 4) * 0.16;
      addBox(g, 0.015, 0.04, 0.03, metal, [x, y, 0.03]);
      addBox(g, 0.03, 0.045, 0.012, mat(style, i % 2 ? 'paint:Butter' : 'paint:Dusty rose'), [x, y - 0.03, 0.04]);
    }
  },
  beacon(g, style) {
    const metal = mat(style, 'metal:Light gray');
    const dark = mat(style, 'darkMetal:Ink');
    addCyl(g, 0.008, 0.008, 0.55, dark, [0, 0.42, 0], { seg: 4 });
    addCyl(g, 0.1, 0.12, 0.06, metal, [0, 0.1, 0], { seg: 6 });
    addCyl(g, 0.08, 0.08, 0.1, mat(style, 'light:Dusty rose'), [0, 0.16, 0], { seg: 6 });
    addCyl(g, 0.09, 0.06, 0.04, metal, [0, 0.22, 0], { seg: 6 });
  },
  coat_rack(g, style) {
    const metal = mat(style, 'metal:Light gray');
    const dark = mat(style, 'darkMetal:Charcoal');
    addCyl(g, 0.16, 0.18, 0.03, dark, [0, 0.015, 0], { seg: 6 });
    addCyl(g, 0.02, 0.024, 1.5, metal, [0, 0.78, 0], { seg: 5 });
    for (let i = 0; i < 3; i++) {
      const a = i * 2 * P / 3;
      addBox(g, 0.1, 0.02, 0.02, metal, [Math.sin(a) * 0.08, 1.52, Math.cos(a) * 0.08], [0, -a, 0.4]);
    }
    addCyl(g, 0.11, 0.11, 0.04, mat(style, 'cloth:Navy'), [0.02, 1.62, 0], { seg: 6 });
    addBox(g, 0.16, 0.015, 0.1, dark, [0.04, 1.6, 0.04]);
  },
  trash_bin(g, style) {
    addBox(g, 0.28, 0.4, 0.28, mat(style, 'paint:Slate'), [0, 0.2, 0]);
    addBox(g, 0.3, 0.03, 0.3, mat(style, 'darkMetal:Charcoal'), [0, 0.415, 0]);
    addBox(g, 0.08, 0.04, 0.012, mat(style, 'paint:Dusty rose'), [0, 0.28, 0.142]);
  },
  clock(g, style) {
    const rim = mat(style, 'metal:Light gray');
    const face = mat(style, 'paint:Off white');
    const ink = mat(style, 'darkMetal:Ink');
    addCyl(g, 0.18, 0.18, 0.03, rim, [0, 0.18, 0.02], { seg: 8, rot: [P / 2, 0, 0] });
    addCyl(g, 0.15, 0.15, 0.012, face, [0, 0.18, 0.038], { seg: 8, rot: [P / 2, 0, 0] });
    addBox(g, 0.016, 0.09, 0.006, ink, [0.02, 0.21, 0.048], [0, 0, -0.5]);
    addBox(g, 0.012, 0.12, 0.006, ink, [-0.015, 0.2, 0.052], [0, 0, 1.0]);
    addBox(g, 0.04, 0.04, 0.008, mat(style, 'paint:Dusty rose'), [0, 0.18, 0.05]);
  },
  ceiling_light(g, style) {
    addCyl(g, 0.008, 0.008, 0.62, mat(style, 'darkMetal:Ink'), [0, 0.46, 0], { seg: 4 });
    addCyl(g, 0.12, 0.2, 0.07, mat(style, 'paint:Off white'), [0, 0.08, 0], { seg: 6 });
    addCyl(g, 0.08, 0.08, 0.012, mat(style, 'light:Butter'), [0, 0.06, 0], { seg: 6 });
  },
  floor_mat(g, style) {
    addBox(g, 0.9, 0.012, 0.56, mat(style, 'cloth:Navy'), [0, 0.01, 0]);
    addBox(g, 0.55, 0.004, 0.08, mat(style, 'paint:Dusty rose'), [0, 0.018, 0]);
  },
  window_bay(g, style) {
    const frame = mat(style, 'paint:Navy');
    const mullion = mat(style, 'metal:Light gray');
    const glass = mat(style, 'glass:Sky');
    const { w, h, d } = WIN;
    const b = 0.06;
    addBox(g, w, b, d, frame, [0, b / 2, 0]);
    addBox(g, w, b, d, frame, [0, h - b / 2, 0]);
    addBox(g, b, h, d, frame, [-w / 2 + b / 2, h / 2, 0]);
    addBox(g, b, h, d, frame, [w / 2 - b / 2, h / 2, 0]);
    addBox(g, 0.035, h - b * 2, d * 0.55, mullion, [0, h / 2, 0]);
    addBox(g, w - b * 2 + 0.02, h - b * 2 + 0.02, 0.012, glass, [0, h / 2, 0]);
  },
  door(g, style) {
    const frame = mat(style, 'paint:Navy');
    const metal = mat(style, 'metal:Light gray');
    const glass = mat(style, 'glass:Sky');
    const rose = mat(style, 'paint:Dusty rose');
    const { w, h, d } = DOOR;
    const jb = 0.07;
    addBox(g, jb, h, d, frame, [-w / 2 + jb / 2, h / 2, 0]);
    addBox(g, jb, h, d, frame, [w / 2 - jb / 2, h / 2, 0]);
    addBox(g, w, jb, d, frame, [0, h - jb / 2, 0]);
    const dw = w - jb * 2;
    addBox(g, dw, 0.7, 0.045, frame, [0, 0.35, 0]);
    addBox(g, dw, 0.06, 0.02, rose, [0, 0.74, 0.02]);
    addBox(g, dw - 0.1, 1.15, 0.012, glass, [0, 1.45, 0]);
    addBox(g, 0.04, 1.2, 0.04, metal, [-(dw / 2 - 0.03), 1.45, 0]);
    addBox(g, 0.04, 1.2, 0.04, metal, [dw / 2 - 0.03, 1.45, 0]);
    addBox(g, dw - 0.06, 0.04, 0.04, metal, [0, 2.02, 0]);
    addBox(g, 0.08, 0.03, 0.03, metal, [0.12, 1.05, d / 2]);
  },
};

const LABELS = {
  front_counter: 'Front counter',
  officer_desk: 'Officer desk',
  officer_chair: 'Officer chair',
  holding_cell: 'Holding cell',
  locker_bank: 'Lockers',
  notice_board: 'Notice board',
  filing_cabinet: 'Filing cabinet',
  water_cooler: 'Water cooler',
  waiting_bench: 'Waiting bench',
  desk_lamp: 'Desk lamp',
  radio: 'Radio',
  mug: 'Mug',
  key_board: 'Key board',
  beacon: 'Koban lamp',
  coat_rack: 'Coat rack',
  trash_bin: 'Trash bin',
  clock: 'Wall clock',
  ceiling_light: 'Ceiling light',
  floor_mat: 'Floor mat',
  window_bay: 'Window',
  door: 'Station door',
};

const NO_HIT = new Set(['floor_mat', 'ceiling_light', 'beacon']);
const BACK = new Set(['notice_board', 'key_board', 'clock']);

function hitFor(name, footprint) {
  if (NO_HIT.has(name)) return [];
  const [w, d] = footprint;
  if (BACK.has(name)) return [{ z: d / 2, hw: w / 2, hd: d / 2 }];
  return [{ hw: w / 2, hd: d / 2 }];
}

/** One catalogue row per kit item, in manifest order. */
export const POLICE_ITEMS = Object.entries(manifest.items).map(([name, item]) => ({
  name,
  id: `police.${name}`,
  label: LABELS[name] ?? item.label,
  kitGroup: item.group,
  size: item.footprint,
  hit: hitFor(name, item.footprint),
}));

/** A kit item standing on y = 0, facing +z. Geometry is its own (safe to dispose). */
export function buildPoliceItem(name, style) {
  const build = BUILDERS[name];
  if (!build) throw new Error(`Unknown police item "${name}"`);
  const g = new THREE.Group();
  g.name = name;
  build(g, style);
  g.userData.policeItem = name;
  return g;
}

const RH = 3;
const BAND = 0.95;
const TH = 0.14;

function splitWall(g, style, { axis, a0, a1, fix, y1, holes, hits, inward, low, high, trimKey }) {
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
    if (hit && hits && y0 < 0.3) {
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
      const lowY = Math.min(yEnd, BAND);
      if (lowY > y0) put(a, b, y0, lowY, TH, fix, low, true);
      if (yEnd > BAND) put(a, b, Math.max(y0, BAND), yEnd, TH, fix, high, true);
    };
    let y = 0;
    for (const [hy0, hy1] of spans) {
      emit(y, Math.min(hy0, y1));
      y = Math.max(y, hy1);
    }
    emit(y, y1);
    const openAt = (level) => spans.some(([hy0, hy1]) => hy0 < level && hy1 > level);
    const trim = (level, depth, key, y0, y) => {
      if (openAt(level)) return;
      const fixPos = fix + inward * (TH / 2 - 0.004 + depth / 2);
      put(a, b, y0, y, depth, fixPos, key, false);
    };
    trim(BAND, 0.035, trimKey, BAND - 0.02, BAND + 0.02);
    trim(0.05, 0.025, 'darkMetal:Charcoal', 0, 0.08);
  }
}

/**
 * The whole station (12 × 8 m). `cutaway` hides the front (+z) and side (+x)
 * walls so the inside reads from the isometric catalogue camera.
 */
export function buildPoliceRoom(style, { cutaway = false, seed = 0 } = {}) {
  const plan = policeLayout(seed);
  roomTint = plan.accent;
  const body = new THREE.Group();
  const front = new THREE.Group();
  const side = new THREE.Group();
  const hits = [];
  const W = 12;
  const D = 8;

  const tile = TILE_TOP - SLAB_TOP;
  for (let i = 0; i < W; i++) {
    for (let j = 0; j < D; j++) {
      addBox(body, 1, tile, 1, mat(style, (i + j) % 2 ? 'concrete:Gray' : 'concrete:Stone'),
        [-W / 2 + i + 0.5, (SLAB_TOP + TILE_TOP) / 2, -D / 2 + j + 0.5]);
    }
  }
  addBox(body, W, 0.22, D, mat(style, 'concrete:Charcoal'), [0, SLAB_TOP - 0.11, 0]);

  const winHoles = (spans, y0) => spans.map(([a0, a1]) => ({
    a0: a0 + LIP, a1: a1 - LIP, y0: y0 + LIP, y1: y0 + WIN.h - LIP,
  }));
  const frontWins = [[-5.3, -3.25], [-2.85, -0.8], [0.55, 2.6]];
  const doorHole = [3.75, 5.03];
  const frontHoles = [
    ...winHoles(frontWins, 0.9),
    { a0: doorHole[0], a1: doorHole[1], y0: 0, y1: DOOR.h - 0.1 },
  ];
  const sideWins = [[-1.0, 1.05]];
  const sideHoles = winHoles(sideWins, 0.9);
  const paint = { low: 'paint:Navy', high: 'paint:Off white', trimKey: 'paint:Dusty rose' };

  splitWall(body, style, { axis: 'x', a0: -6, a1: 6, fix: -3.93, y1: RH, holes: [], hits, inward: 1, ...paint });
  splitWall(body, style, { axis: 'z', a0: -4, a1: 4, fix: -5.93, y1: RH, holes: [], hits, inward: 1, ...paint });
  splitWall(front, style, { axis: 'x', a0: -6, a1: 6, fix: 3.93, y1: RH, holes: frontHoles, hits: cutaway ? null : hits, inward: -1, ...paint });
  splitWall(side, style, { axis: 'z', a0: -4, a1: 4, fix: 5.93, y1: RH, holes: sideHoles, hits: cutaway ? null : hits, inward: -1, ...paint });

  const placeItem = (group, name, x, y, z, rotY) => {
    const item = buildPoliceItem(name, style);
    item.position.set(x, y, z);
    item.rotation.y = rotY;
    group.add(item);
  };
  frontWins.forEach(([a0, a1]) => placeItem(front, 'window_bay', (a0 + a1) / 2, 0.9, 3.93, 0));
  const doorX = (doorHole[0] + doorHole[1]) / 2;
  placeItem(front, 'door', doorX, 0, 3.93, 0);
  sideWins.forEach(([a0, a1]) => placeItem(side, 'window_bay', 5.93, 0.9, (a0 + a1) / 2, P / 2));
  if (!cutaway) hits.push({ x: doorX, z: 3.93, hw: DOOR.w / 2, hd: DOOR.d / 2 });

  for (const p of plan.placements) {
    const item = buildPoliceItem(p.item, style);
    item.position.set(p.x, p.y + TILE_TOP, p.z);
    item.rotation.y = p.rotY || 0;
    body.add(item);
    if (p.y < 0.05 && !NO_HIT.has(p.item)) {
      const [w, d] = manifest.items[p.item].footprint;
      const c = Math.abs(Math.cos(p.rotY || 0));
      const s = Math.abs(Math.sin(p.rotY || 0));
      if (!BACK.has(p.item)) hits.push({ x: p.x, z: p.z, hw: (w / 2) * c + (d / 2) * s, hd: (w / 2) * s + (d / 2) * c });
    }
  }
  roomTint = null;

  const room = new THREE.Group();
  room.name = 'tiny_police';
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
