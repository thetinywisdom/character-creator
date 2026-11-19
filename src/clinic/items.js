import * as THREE from 'three';
import { PALETTE } from '../styles/palette.js';
import { mulberry32 } from '../lib/rng.js';
import { lobe, shadeMaterial } from '../lib/foliage.js';
import { mergeByMaterial } from '../lib/merge.js';
import manifest from '../../public/clinic-kit/manifest.json';
import { clinicLayout } from './layout.js';

// A small Japanese clinic, in the same boxes and cylinders as the diner kit
// (src/diner/items.js) and the office kit. Built here, not loaded, so
// createAsset stays synchronous. Every colour is `role:Swatch` through
// style.material, so palette swaps, the PS1 wobble and the outline flag apply.
//
// Seafoam, sky and dusty rose use paint / cloth / light (not concrete or wood),
// so the building-colour rule does not turn them into greys and browns.
// Cylinder sides are the kit's own counts (already the PS1 0.3× detail).
// They are not passed through seg(), which would cut them again.
//
// Room: 10 m wide (x) by 8 m deep (z), origin at the bottom centre, front
// facing +z. The floor sits 2 cm above y = 0 so it does not flicker against
// the catalogue ground. Cutaway hides the +z and +x walls: those two face
// the isometric catalogue camera.

const P = Math.PI;
const SLAB_TOP = 0.02;
const TILE_TOP = SLAB_TOP + 0.05;

const WIN = { w: 1.9, h: 1.42, d: 0.12 };
const DOOR = { w: 1.46, h: 2.2, d: 0.12 };
const LIP = 0.05;

// Tops, so layout.json can sit a prop on them. Measured to the tile, the
// room adds TILE_TOP on top of layout y.
const RECEPTION_TOP = 1.06;

const glassOf = new WeakMap();

// Set for the duration of a seeded room build. Catalogue pieces leave it null
// so their own thumbnails stay the hand-made colours.
let roomTint = null;

function mat(style, key) {
  const i = key.indexOf(':');
  const role = key.slice(0, i);
  const swatch = key.slice(i + 1);
  // Window panes and cabinet doors stay see-through. Clone: the cached style
  // material is shared, and its opacity is an outline flag, not glass.
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
  reception_desk(g, style) {
    const body = mat(style, 'paint:Off white');
    const face = mat(style, 'paint:Seafoam');
    const top = mat(style, 'paint:Off white');
    const edge = mat(style, 'metal:Light gray');
    const dark = mat(style, 'darkMetal:Charcoal');
    addBox(g, 2.36, 0.1, 0.74, dark, [0, 0.05, 0]);
    addBox(g, 2.32, 0.86, 0.7, body, [0, 0.53, 0]);
    addBox(g, 2.24, 0.42, 0.012, face, [0, 0.48, 0.356]);
    addBox(g, 2.4, 0.045, 0.78, top, [0, RECEPTION_TOP - 0.022, 0]);
    addBox(g, 2.4, 0.02, 0.028, edge, [0, RECEPTION_TOP - 0.05, 0.39]);
    // Patient-side lip, then a screen turned toward the room.
    addBox(g, 0.46, 0.28, 0.03, dark, [-0.72, RECEPTION_TOP + 0.16, 0.12], [-0.35, 0, 0]);
    addBox(g, 0.38, 0.2, 0.012, mat(style, 'glass:Navy'), [-0.72, RECEPTION_TOP + 0.17, 0.14], [-0.35, 0, 0]);
    addBox(g, 0.16, 0.02, 0.12, edge, [-0.72, RECEPTION_TOP + 0.01, 0.02]);
    addBox(g, 0.28, 0.012, 0.18, mat(style, 'paint:Paper'), [0.15, RECEPTION_TOP + 0.006, 0.08]);
    addBox(g, 0.22, 0.035, 0.16, mat(style, 'paint:Powder blue'), [0.55, RECEPTION_TOP + 0.02, 0.12]);
    addBox(g, 0.08, 0.06, 0.08, mat(style, 'paint:Seafoam'), [0.95, RECEPTION_TOP + 0.03, -0.08]);
  },
  waiting_chair(g, style) {
    const cloth = mat(style, roomTint?.chair ?? 'cloth:Powder blue');
    const metal = mat(style, 'metal:Light gray');
    const dark = mat(style, 'darkMetal:Charcoal');
    for (const x of [-0.18, 0.18]) {
      addBox(g, 0.04, 0.42, 0.36, metal, [x, 0.21, 0.02]);
      addBox(g, 0.05, 0.03, 0.4, dark, [x, 0.015, 0.02]);
    }
    addBox(g, 0.44, 0.05, 0.42, cloth, [0, 0.45, 0.02]);
    addBox(g, 0.44, 0.36, 0.05, cloth, [0, 0.68, -0.2]);
    addBox(g, 0.36, 0.03, 0.04, metal, [0, 0.52, 0.2]);
  },
  exam_bed(g, style) {
    const frame = mat(style, 'metal:Light gray');
    const dark = mat(style, 'darkMetal:Charcoal');
    const pad = mat(style, 'cloth:Off white');
    const sheet = mat(style, roomTint?.sheet ?? 'cloth:Sky');
    addBox(g, 0.7, 0.08, 1.88, frame, [0, 0.28, 0]);
    for (const [x, z] of [[-0.28, -0.78], [0.28, -0.78], [-0.28, 0.78], [0.28, 0.78]]) {
      addBox(g, 0.06, 0.24, 0.08, dark, [x, 0.12, z]);
    }
    addBox(g, 0.66, 0.1, 1.15, pad, [0, 0.37, 0.2]);
    addBox(g, 0.66, 0.1, 0.52, pad, [0, 0.42, -0.62], [0.18, 0, 0]);
    addBox(g, 0.4, 0.08, 0.28, sheet, [0, 0.5, -0.7]);
    addBox(g, 0.66, 0.025, 0.7, sheet, [0, 0.43, 0.35]);
    addBox(g, 0.74, 0.28, 0.04, frame, [0, 0.5, -0.92]);
    addCyl(g, 0.045, 0.045, 0.16, mat(style, 'paint:Paper'), [0, 0.4, 0.84], { seg: 6, rot: [0, 0, P / 2] });
    addBox(g, 0.04, 0.08, 0.5, frame, [-0.36, 0.46, 0.15]);
    addBox(g, 0.04, 0.08, 0.5, frame, [0.36, 0.46, 0.15]);
  },
  privacy_curtain(g, style) {
    const rail = mat(style, 'metal:Light gray');
    const cloth = mat(style, roomTint?.curtain ?? 'cloth:Sky');
    const band = mat(style, 'cloth:Seafoam');
    addBox(g, 1.52, 0.03, 0.04, rail, [0, 2.08, 0]);
    for (const x of [-0.72, 0.72]) addBox(g, 0.03, 0.08, 0.03, rail, [x, 2.02, 0]);
    // Gathered to the -x end, so the bay beside it stays readable.
    const panels = [-0.58, -0.46, -0.34];
    panels.forEach((x, i) => {
      addBox(g, 0.16, 1.9, 0.012, i === 1 ? band : cloth, [x, 1.08, 0.01 * (i - 1)]);
    });
    for (let i = 0; i < 5; i++) addBox(g, 0.03, 0.025, 0.025, rail, [-0.66 + i * 0.06, 2.05, 0.02]);
  },
  doctor_desk(g, style) {
    const top = mat(style, 'paint:Off white');
    const body = mat(style, 'paint:Seafoam');
    const metal = mat(style, 'metal:Light gray');
    addBox(g, 1.16, 0.04, 0.58, top, [0, 0.74, 0]);
    addBox(g, 0.34, 0.66, 0.5, body, [0.36, 0.36, -0.02]);
    addBox(g, 0.04, 0.64, 0.04, metal, [-0.48, 0.36, -0.22]);
    addBox(g, 0.04, 0.64, 0.04, metal, [-0.48, 0.36, 0.22]);
    addBox(g, 0.28, 0.012, 0.2, mat(style, 'paint:Paper'), [-0.15, 0.77, 0.02]);
    addBox(g, 0.16, 0.02, 0.12, mat(style, 'paint:Powder blue'), [-0.22, 0.782, -0.08]);
    addBox(g, 0.1, 0.05, 0.08, mat(style, 'darkMetal:Charcoal'), [0.42, 0.785, 0.12]);
    addCyl(g, 0.025, 0.03, 0.16, metal, [0.28, 0.86, -0.12], { seg: 5 });
    addCyl(g, 0.07, 0.09, 0.05, mat(style, 'paint:Off white'), [0.28, 0.96, -0.12], { seg: 6 });
    addCyl(g, 0.04, 0.04, 0.012, mat(style, 'light:Butter'), [0.28, 0.93, -0.12], { seg: 6 });
  },
  scale(g, style) {
    const body = mat(style, 'paint:Off white');
    const dark = mat(style, 'darkMetal:Charcoal');
    const metal = mat(style, 'metal:Light gray');
    addBox(g, 0.36, 0.06, 0.36, dark, [0, 0.03, 0]);
    addBox(g, 0.32, 0.025, 0.32, body, [0, 0.07, 0]);
    addBox(g, 0.06, 0.9, 0.06, metal, [0, 0.52, -0.12]);
    addBox(g, 0.16, 0.12, 0.06, body, [0, 0.72, -0.08]);
    addCyl(g, 0.055, 0.055, 0.02, mat(style, 'paint:Paper'), [0, 0.72, -0.04], { seg: 8, rot: [P / 2, 0, 0] });
    addBox(g, 0.012, 0.04, 0.008, dark, [0.01, 0.72, -0.026], [0, 0, 0.5]);
    addBox(g, 0.16, 0.02, 0.08, metal, [0, 1.02, -0.12]);
    addBox(g, 0.1, 0.08, 0.02, metal, [0, 1.0, -0.07]);
  },
  iv_stand(g, style) {
    const metal = mat(style, 'metal:Light gray');
    const dark = mat(style, 'darkMetal:Charcoal');
    // A round foot, not splayed legs: at thumbnail size the legs read as litter.
    addCyl(g, 0.1, 0.12, 0.04, dark, [0, 0.02, 0], { seg: 6 });
    addCyl(g, 0.016, 0.018, 1.48, metal, [0, 0.78, 0], { seg: 5 });
    addBox(g, 0.2, 0.02, 0.02, metal, [0, 1.52, 0]);
    addBox(g, 0.03, 0.05, 0.03, dark, [0.07, 1.48, 0.02]);
    addBox(g, 0.11, 0.18, 0.045, mat(style, 'cloth:Off white'), [0.07, 1.28, 0.04]);
    addBox(g, 0.11, 0.03, 0.012, mat(style, 'paint:Seafoam'), [0.07, 1.24, 0.064]);
    addBox(g, 0.012, 0.28, 0.012, mat(style, 'paint:Powder blue'), [0.07, 1.08, 0.04]);
  },
  medicine_cabinet(g, style) {
    const shell = mat(style, 'paint:Off white');
    const edge = mat(style, 'metal:Light gray');
    const W = 0.76;
    const H = 1.72;
    const D = 0.36;
    const t = 0.03;
    addBox(g, W, H, t, shell, [0, H / 2, -D / 2 + t / 2]);
    addBox(g, t, H, D, shell, [-W / 2 + t / 2, H / 2, 0]);
    addBox(g, t, H, D, shell, [W / 2 - t / 2, H / 2, 0]);
    addBox(g, W, t, D, shell, [0, t / 2, 0]);
    addBox(g, W, t, D, shell, [0, H - t / 2, 0]);
    addBox(g, W - 0.08, H - 0.16, 0.012, mat(style, 'glass:Sky'), [0, H / 2 + 0.02, D / 2]);
    addBox(g, 0.02, H - 0.2, 0.02, edge, [0, H / 2 + 0.02, D / 2 - 0.005]);
    addBox(g, 0.03, 0.14, 0.02, edge, [0.28, 0.95, D / 2 + 0.01]);
    const bottles = ['paint:Dusty rose', 'paint:Seafoam', 'paint:Butter', 'paint:Powder blue', 'paint:Lilac', 'paint:Apricot', 'paint:Sage', 'paint:Navy'];
    bottles.forEach((key, i) => {
      const col = i % 4;
      const row = Math.floor(i / 4);
      addBox(g, 0.12, 0.2, 0.12, mat(style, key), [-0.22 + col * 0.15, 0.48 + row * 0.62, 0]);
    });
    for (const y of [0.32, 0.9, 1.45]) addBox(g, W - 0.08, 0.02, D - 0.08, shell, [0, y, 0]);
  },
  exam_stool(g, style) {
    const metal = mat(style, 'metal:Light gray');
    const seat = mat(style, 'cloth:Seafoam');
    addCyl(g, 0.16, 0.17, 0.03, metal, [0, 0.015, 0], { seg: 6 });
    addCyl(g, 0.025, 0.03, 0.42, metal, [0, 0.24, 0], { seg: 5 });
    addCyl(g, 0.15, 0.15, 0.06, seat, [0, 0.48, 0], { seg: 6 });
    addBox(g, 0.16, 0.02, 0.04, metal, [0.12, 0.36, 0], [0, 0, 0.6]);
  },
  sink(g, style) {
    const body = mat(style, 'paint:Off white');
    const metal = mat(style, 'metal:Light gray');
    const dark = mat(style, 'darkMetal:Charcoal');
    addBox(g, 0.6, 0.78, 0.4, body, [0, 0.39, 0]);
    addBox(g, 0.4, 0.08, 0.26, dark, [0, 0.74, 0.02]);
    addBox(g, 0.62, 0.04, 0.42, body, [0, 0.8, 0]);
    addBox(g, 0.03, 0.16, 0.03, metal, [0, 0.9, -0.06]);
    addBox(g, 0.14, 0.025, 0.025, metal, [0, 0.98, 0.02]);
    addBox(g, 0.03, 0.08, 0.03, metal, [0.1, 0.93, 0.04]);
    addBox(g, 0.5, 0.28, 0.02, mat(style, 'glass:Sky'), [0, 1.15, -0.18]);
    addBox(g, 0.08, 0.04, 0.06, mat(style, 'paint:Seafoam'), [0.16, 0.84, 0.08]);
  },
  blood_pressure(g, style) {
    const metal = mat(style, 'metal:Light gray');
    const dark = mat(style, 'darkMetal:Charcoal');
    const body = mat(style, 'paint:Off white');
    addCyl(g, 0.12, 0.14, 0.03, dark, [0, 0.015, 0], { seg: 6 });
    addCyl(g, 0.018, 0.02, 0.85, metal, [0, 0.45, 0], { seg: 5 });
    addBox(g, 0.16, 0.1, 0.1, body, [0, 0.78, 0.04]);
    addBox(g, 0.1, 0.05, 0.012, mat(style, 'glass:Navy'), [0, 0.8, 0.092]);
    addCyl(g, 0.05, 0.05, 0.08, mat(style, 'cloth:Navy'), [0.1, 0.55, 0.04], { seg: 6, rot: [0, 0, P / 2] });
    addBox(g, 0.012, 0.16, 0.012, dark, [0.06, 0.62, 0.04]);
    addCyl(g, 0.025, 0.025, 0.04, dark, [0.02, 0.5, 0.05], { seg: 5 });
  },
  chart_rack(g, style) {
    const board = mat(style, 'paint:Off white');
    const edge = mat(style, 'metal:Light gray');
    addBox(g, 0.68, 0.5, 0.03, board, [0, 0.25, 0.015]);
    addBox(g, 0.68, 0.025, 0.04, edge, [0, 0.02, 0.02]);
    const files = ['paint:Powder blue', 'paint:Seafoam', 'paint:Butter', 'paint:Blush', 'paint:Lilac'];
    files.forEach((key, i) => addBox(g, 0.07, 0.32, 0.045, mat(style, key), [-0.24 + i * 0.12, 0.22, 0.04]));
  },
  waste_bin(g, style) {
    const body = mat(style, 'paint:Off white');
    const lid = mat(style, 'paint:Seafoam');
    addBox(g, 0.28, 0.38, 0.28, body, [0, 0.19, 0]);
    addBox(g, 0.3, 0.03, 0.3, lid, [0, 0.395, 0]);
    addBox(g, 0.16, 0.012, 0.012, mat(style, 'darkMetal:Charcoal'), [0, 0.22, 0.142]);
  },
  slipper_rack(g, style) {
    const wood = mat(style, 'wood:Tan');
    addBox(g, 0.78, 0.04, 0.3, wood, [0, 0.1, 0]);
    for (const x of [-0.34, 0.34]) addBox(g, 0.04, 0.12, 0.28, wood, [x, 0.06, 0]);
    const shoes = ['cloth:Powder blue', 'cloth:Off white', 'cloth:Seafoam', 'cloth:Dusty rose'];
    shoes.forEach((key, i) => addBox(g, 0.14, 0.05, 0.22, mat(style, key), [-0.24 + i * 0.16, 0.145, 0]));
  },
  coat_hooks(g, style) {
    const wood = mat(style, 'wood:Walnut');
    const metal = mat(style, 'metal:Light gray');
    addBox(g, 0.52, 0.08, 0.03, wood, [0, 0.16, 0.015]);
    for (const x of [-0.16, 0, 0.16]) addBox(g, 0.025, 0.06, 0.06, metal, [x, 0.12, 0.04]);
    addBox(g, 0.16, 0.28, 0.02, mat(style, 'cloth:Powder blue'), [0.16, -0.02, 0.05]);
  },
  clinic_cross(g, style) {
    const tile = mat(style, 'paint:Off white');
    const cross = mat(style, 'paint:Dusty rose');
    addBox(g, 0.42, 0.42, 0.025, tile, [0, 0.21, 0.012]);
    addBox(g, 0.12, 0.3, 0.02, cross, [0, 0.21, 0.03]);
    addBox(g, 0.3, 0.12, 0.02, cross, [0, 0.21, 0.034]);
  },
  plant(g, style) {
    addCyl(g, 0.09, 0.07, 0.12, mat(style, 'paint:Off white'), [0, 0.06, 0], { seg: 6 });
    addCyl(g, 0.1, 0.1, 0.02, mat(style, 'paint:Seafoam'), [0, 0.11, 0], { seg: 6 });
    const n = roomTint?.plantSeed ?? 3;
    addLobe(g, style, 0.1, 'leaf:Moss', [0, 0.24, 0], [1, 0.9, 1], n);
    addLobe(g, style, 0.07, 'leaf:Sage', [0.06, 0.2, 0.03], [1, 0.8, 1], n + 1);
    addLobe(g, style, 0.06, 'leaf:Moss', [-0.05, 0.18, -0.02], [1, 0.85, 1], n + 2);
  },
  clock(g, style) {
    const rim = mat(style, 'metal:Light gray');
    const face = mat(style, 'paint:Off white');
    const ink = mat(style, 'darkMetal:Ink');
    addCyl(g, 0.18, 0.18, 0.03, rim, [0, 0.18, 0.02], { seg: 8, rot: [P / 2, 0, 0] });
    addCyl(g, 0.15, 0.15, 0.012, face, [0, 0.18, 0.038], { seg: 8, rot: [P / 2, 0, 0] });
    addBox(g, 0.016, 0.09, 0.006, ink, [0.02, 0.21, 0.048], [0, 0, -0.6]);
    addBox(g, 0.012, 0.12, 0.006, ink, [-0.02, 0.2, 0.052], [0, 0, 0.9]);
  },
  ceiling_light(g, style) {
    const shade = mat(style, 'paint:Off white');
    const metal = mat(style, 'metal:Light gray');
    addCyl(g, 0.008, 0.008, 0.62, mat(style, 'darkMetal:Ink'), [0, 0.46, 0], { seg: 4 });
    addCyl(g, 0.1, 0.2, 0.08, shade, [0, 0.08, 0], { seg: 6 });
    addCyl(g, 0.2, 0.2, 0.012, metal, [0, 0.04, 0], { seg: 6 });
    addCyl(g, 0.08, 0.08, 0.012, mat(style, 'light:Butter'), [0, 0.07, 0], { seg: 6 });
  },
  floor_mat(g, style) {
    addBox(g, 1.05, 0.012, 0.66, mat(style, 'cloth:Seafoam'), [0, 0.01, 0]);
    addBox(g, 0.7, 0.004, 0.08, mat(style, 'paint:Off white'), [0, 0.018, 0]);
  },
  window_bay(g, style) {
    const frame = mat(style, 'paint:Off white');
    const mullion = mat(style, 'paint:Seafoam');
    const glass = mat(style, 'glass:Sky');
    const { w, h, d } = WIN;
    const b = 0.06;
    addBox(g, w, b, d, frame, [0, b / 2, 0]);
    addBox(g, w, b, d, frame, [0, h - b / 2, 0]);
    addBox(g, b, h, d, frame, [-w / 2 + b / 2, h / 2, 0]);
    addBox(g, b, h, d, frame, [w / 2 - b / 2, h / 2, 0]);
    addBox(g, 0.035, h - b * 2, d * 0.6, mullion, [0, h / 2, 0]);
    addBox(g, w - b * 2, 0.035, d * 0.6, mullion, [0, h * 0.55, 0]);
    addBox(g, w - b * 2 + 0.02, h - b * 2 + 0.02, 0.012, glass, [0, h / 2, 0]);
  },
  door(g, style) {
    const frame = mat(style, 'paint:Off white');
    const metal = mat(style, 'metal:Light gray');
    const glass = mat(style, 'glass:Sky');
    const band = mat(style, 'paint:Seafoam');
    const { w, h, d } = DOOR;
    const jb = 0.06;
    addBox(g, jb, h, d, frame, [-w / 2 + jb / 2, h / 2, 0]);
    addBox(g, jb, h, d, frame, [w / 2 - jb / 2, h / 2, 0]);
    addBox(g, w, jb, d, frame, [0, h - jb / 2, 0]);
    const dw = (w - jb * 2) / 2 - 0.02;
    for (const sx of [-1, 1]) {
      addBox(g, dw, 0.55, 0.04, frame, [sx * (dw / 2 + 0.015), 0.3, 0]);
      addBox(g, dw - 0.08, 1.15, 0.012, glass, [sx * (dw / 2 + 0.015), 1.25, 0]);
      addBox(g, dw, 0.05, 0.02, band, [sx * (dw / 2 + 0.015), 0.62, 0.02]);
    }
    addBox(g, 0.02, 1.2, 0.045, metal, [0, 1.2, 0]);
    addBox(g, 0.08, 0.03, 0.03, metal, [0.18, 1.05, d / 2]);
  },
};

const LABELS = {
  reception_desk: 'Reception desk',
  waiting_chair: 'Waiting chair',
  exam_bed: 'Exam bed',
  privacy_curtain: 'Privacy curtain',
  doctor_desk: 'Doctor desk',
  scale: 'Scale',
  iv_stand: 'IV stand',
  medicine_cabinet: 'Medicine cabinet',
  exam_stool: 'Exam stool',
  sink: 'Sink',
  blood_pressure: 'Blood pressure stand',
  chart_rack: 'Chart rack',
  waste_bin: 'Waste bin',
  slipper_rack: 'Slipper rack',
  coat_hooks: 'Coat hooks',
  clinic_cross: 'Clinic cross',
  plant: 'Pot plant',
  clock: 'Wall clock',
  ceiling_light: 'Ceiling light',
  floor_mat: 'Floor mat',
  window_bay: 'Window',
  door: 'Sliding door',
};

// The mat is walked on. The light hangs: no footprint on the floor.
const NO_HIT = new Set(['floor_mat', 'ceiling_light']);

// Wall pieces are measured from their back, not their middle.
const BACK = new Set(['chart_rack', 'coat_hooks', 'clinic_cross', 'clock']);

function hitFor(name, footprint) {
  if (NO_HIT.has(name)) return [];
  const [w, d] = footprint;
  if (BACK.has(name)) return [{ z: d / 2, hw: w / 2, hd: d / 2 }];
  return [{ hw: w / 2, hd: d / 2 }];
}

/** One catalogue row per kit item, in manifest order. */
export const CLINIC_ITEMS = Object.entries(manifest.items).map(([name, item]) => ({
  name,
  id: `clinic.${name}`,
  label: LABELS[name] ?? item.label,
  kitGroup: item.group,
  size: item.footprint,
  hit: hitFor(name, item.footprint),
}));

/** A kit item standing on y = 0, facing +z. Geometry is its own (safe to dispose). */
export function buildClinicItem(name, style) {
  const build = BUILDERS[name];
  if (!build) throw new Error(`Unknown clinic item "${name}"`);
  const g = new THREE.Group();
  g.name = name;
  build(g, style);
  g.userData.clinicItem = name;
  return g;
}

const RH = 3;
const BAND = 1.05;
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
    trim(BAND, 0.03, trimKey, BAND - 0.015, BAND + 0.015);
    trim(0.05, 0.025, 'darkMetal:Charcoal', 0, 0.08);
  }
}

/**
 * The whole clinic (10 × 8 m). `cutaway` hides the front (+z) and side (+x)
 * walls so the inside reads from the isometric catalogue camera.
 * Meshes are merged per material.
 */
export function buildClinicRoom(style, { cutaway = false, seed = 0 } = {}) {
  const plan = clinicLayout(seed);
  roomTint = plan.accent;
  const body = new THREE.Group();
  const front = new THREE.Group();
  const side = new THREE.Group();
  const hits = [];
  const W = 10;
  const D = 8;

  const tile = TILE_TOP - SLAB_TOP;
  for (let i = 0; i < W; i++) {
    for (let j = 0; j < D; j++) {
      addBox(body, 1, tile, 1, mat(style, (i + j) % 2 ? 'concrete:Light gray' : 'concrete:Off white'),
        [-W / 2 + i + 0.5, (SLAB_TOP + TILE_TOP) / 2, -D / 2 + j + 0.5]);
    }
  }
  addBox(body, W, 0.22, D, mat(style, 'concrete:Gray'), [0, SLAB_TOP - 0.11, 0]);
  // Pale floors mark the two exam bays. Seed 0 keeps the hand-placed bays.
  const wainscot = roomTint?.wainscot ?? 'paint:Seafoam';
  const bay = roomTint?.bay ?? 'paint:Sky';
  if (plan.divider) {
    const { x, z } = plan.divider;
    for (const bed of plan.placements.filter((p) => p.item === 'exam_bed')) {
      addBox(body, 2.3, 0.01, 2.05, mat(style, bay), [bed.x, TILE_TOP + 0.006, bed.z]);
    }
    addBox(body, 0.08, 1.15, 1.7, mat(style, 'paint:Off white'), [x, 0.575, z]);
    addBox(body, 0.1, 0.04, 1.74, mat(style, wainscot), [x, 1.15, z]);
    hits.push({ x, z, hw: 0.05, hd: 0.85 });
  } else {
    addBox(body, 2.5, 0.01, 2.15, mat(style, 'paint:Sky'), [-2.35, TILE_TOP + 0.006, -2.55]);
    addBox(body, 2.5, 0.01, 2.15, mat(style, 'paint:Sky'), [1.7, TILE_TOP + 0.006, -2.55]);
    addBox(body, 0.08, 1.15, 1.7, mat(style, 'paint:Off white'), [0, 0.575, -2.7]);
    addBox(body, 0.1, 0.04, 1.74, mat(style, 'paint:Seafoam'), [0, 1.15, -2.7]);
    hits.push({ x: 0, z: -2.7, hw: 0.05, hd: 0.85 });
  }

  const winHoles = (spans, y0) => spans.map(([a0, a1]) => ({
    a0: a0 + LIP, a1: a1 - LIP, y0: y0 + LIP, y1: y0 + WIN.h - LIP,
  }));
  const frontWins = [[-4.3, -2.4], [2.3, 4.2]];
  const doorHole = [-0.75, 0.71];
  const frontHoles = [
    ...winHoles(frontWins, 0.95),
    { a0: doorHole[0], a1: doorHole[1], y0: 0, y1: DOOR.h - 0.1 },
  ];
  const sideWins = [[-0.95, 0.95]];
  const sideHoles = winHoles(sideWins, 0.95);
  const paint = { low: wainscot, high: 'paint:Off white', trimKey: 'metal:Light gray' };

  splitWall(body, style, { axis: 'x', a0: -5, a1: 5, fix: -3.93, y1: RH, holes: [], hits, inward: 1, ...paint });
  splitWall(body, style, { axis: 'z', a0: -4, a1: 4, fix: -4.93, y1: RH, holes: [], hits, inward: 1, ...paint });
  splitWall(front, style, { axis: 'x', a0: -5, a1: 5, fix: 3.93, y1: RH, holes: frontHoles, hits: cutaway ? null : hits, inward: -1, ...paint });
  splitWall(side, style, { axis: 'z', a0: -4, a1: 4, fix: 4.93, y1: RH, holes: sideHoles, hits: cutaway ? null : hits, inward: -1, ...paint });

  const placeItem = (group, name, x, y, z, rotY) => {
    const item = buildClinicItem(name, style);
    item.position.set(x, y, z);
    item.rotation.y = rotY;
    group.add(item);
  };
  frontWins.forEach(([a0, a1]) => placeItem(front, 'window_bay', (a0 + a1) / 2, 0.95, 3.93, 0));
  const doorX = (doorHole[0] + doorHole[1]) / 2;
  placeItem(front, 'door', doorX, 0, 3.93, 0);
  sideWins.forEach(([a0, a1]) => placeItem(side, 'window_bay', 4.93, 0.95, (a0 + a1) / 2, P / 2));
  if (!cutaway) hits.push({ x: doorX, z: 3.93, hw: DOOR.w / 2, hd: DOOR.d / 2 });

  for (const p of plan.placements) {
    const item = buildClinicItem(p.item, style);
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
  room.name = 'tiny_clinic';
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
