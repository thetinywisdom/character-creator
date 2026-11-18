import * as THREE from 'three';
import { PALETTE } from '../styles/palette.js';
import { mulberry32 } from '../lib/rng.js';
import { lobe, shadeMaterial } from '../lib/foliage.js';
import { mergeByMaterial } from '../lib/merge.js';
import manifest from '../../public/office-kit/manifest.json';
import { officeLayout } from './seedLayout.js';

// Office furniture, ported from src/office/build_office_kit.py (the same boxes
// and cylinders the GLBs were exported from). Built here, not loaded, so
// createAsset stays synchronous and the single-file page does not need the
// binaries. Every colour is `role:Swatch` through style.material, so palette
// swaps, the PS1 wobble and the outline flag all apply.
//
// Cylinder sides are the kit's own counts (already the PS1 0.3× detail).
// They are not passed through seg(), which would cut them again.

const P = Math.PI;
// The room's own floor sits 2 cm above y = 0 so it does not flicker against
// the catalogue ground (or a game floor on the same plane). Checker tiles are
// the kit's 5 cm on top of that slab. Placements shift up by the same amount.
const SLAB_TOP = 0.02;
const TILE_TOP = SLAB_TOP + 0.05;

const glassOf = new WeakMap();

function mat(style, key) {
  const i = key.indexOf(':');
  const role = key.slice(0, i);
  const swatch = key.slice(i + 1);
  // Window panes stay see-through. Clone: the cached style material is shared,
  // and its opacity is an outline flag, not glass.
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

function addCyl(g, rTop, rBottom, h, material, pos, { seg = 6, rot = null, scl = null } = {}) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(rTop, rBottom, h, seg), material);
  m.position.set(pos[0], pos[1], pos[2]);
  if (rot) m.rotation.set(rot[0] || 0, rot[1] || 0, rot[2] || 0);
  if (scl) m.scale.set(scl[0], scl[1], scl[2]);
  g.add(m);
}

// Foliage lobes are the town's (lib/foliage.js): faceted, lighter on top.
function addLobe(g, style, r, key, pos, scale, seed) {
  g.add(lobe(shadeMaterial(mat(style, key)), r, mulberry32(seed), pos, { scale }));
}

const BUILDERS = {
  desk(g, style) {
    const wood = mat(style, 'wood:Tan');
    const metal = mat(style, 'darkMetal:Charcoal');
    addBox(g, 1.6, 0.035, 0.8, wood, [0, 0.7125, 0]);
    for (const sx of [-1, 1]) {
      addBox(g, 0.07, 0.66, 0.07, metal, [sx * 0.66, 0.36, 0]);
      addBox(g, 0.07, 0.03, 0.72, metal, [sx * 0.66, 0.015, 0]);
    }
    addBox(g, 1.32, 0.05, 0.06, metal, [0, 0.67, 0]);
  },
  office_chair(g, style, look) {
    const dark = mat(style, 'darkMetal:Ink');
    const metal = mat(style, 'metal:Stone');
    const cloth = mat(style, `cloth:${look?.chair?.[0] ?? 'Ink'}`);
    const back = mat(style, `cloth:${look?.chair?.[1] ?? 'Charcoal'}`);
    for (let i = 0; i < 5; i++) {
      const a = i * 2 * P / 5;
      addBox(g, 0.05, 0.035, 0.3, dark, [Math.sin(a) * 0.15, 0.06, Math.cos(a) * 0.15], [0, a, 0]);
      addBox(g, 0.04, 0.05, 0.04, dark, [Math.sin(a) * 0.29, 0.025, Math.cos(a) * 0.29]);
    }
    addCyl(g, 0.03, 0.03, 0.32, metal, [0, 0.24, 0]);
    addBox(g, 0.52, 0.08, 0.5, cloth, [0, 0.45, 0.03]);
    addBox(g, 0.48, 0.66, 0.07, back, [0, 0.87, -0.25], [-0.12, 0, 0]);
    addBox(g, 0.34, 0.14, 0.07, cloth, [0, 1.24, -0.30], [-0.12, 0, 0]);
    for (const sx of [-1, 1]) {
      addBox(g, 0.05, 0.2, 0.05, dark, [sx * 0.27, 0.55, 0.02]);
      addBox(g, 0.07, 0.03, 0.26, dark, [sx * 0.27, 0.66, 0.02]);
    }
  },
  monitor(g, style) {
    const dark = mat(style, 'darkMetal:Ink');
    const glass = mat(style, 'glass:Navy');
    const metal = mat(style, 'metal:Light gray');
    addBox(g, 0.62, 0.36, 0.035, dark, [0, 0.29, 0]);
    addBox(g, 0.57, 0.31, 0.006, glass, [0, 0.29, 0.019]);
    addBox(g, 0.07, 0.22, 0.025, metal, [0, 0.11, -0.035], [0.12, 0, 0]);
    addBox(g, 0.2, 0.012, 0.16, metal, [0, 0.006, -0.03]);
  },
  laptop(g, style) {
    const metal = mat(style, 'metal:Stone');
    const dark = mat(style, 'darkMetal:Charcoal');
    const glass = mat(style, 'glass:Navy');
    addBox(g, 0.31, 0.016, 0.22, metal, [0, 0.008, 0]);
    addBox(g, 0.26, 0.003, 0.09, dark, [0, 0.017, -0.03]);
    addBox(g, 0.31, 0.21, 0.008, metal, [0, 0.115, -0.125], [-0.22, 0, 0]);
    addBox(g, 0.28, 0.18, 0.002, glass, [0, 0.117, -0.119], [-0.22, 0, 0]);
  },
  keyboard(g, style) {
    const paint = mat(style, 'paint:Off white');
    addBox(g, 0.36, 0.02, 0.12, paint, [0, 0.01, 0]);
    addBox(g, 0.06, 0.025, 0.1, paint, [0.26, 0.0125, 0]);
  },
  desk_lamp(g, style) {
    const dark = mat(style, 'darkMetal:Charcoal');
    const light = mat(style, 'light:Butter');
    addCyl(g, 0.07, 0.08, 0.025, dark, [0, 0.0125, 0]);
    addBox(g, 0.02, 0.32, 0.02, dark, [0, 0.17, -0.04], [-0.35, 0, 0]);
    addBox(g, 0.02, 0.26, 0.02, dark, [0, 0.40, 0], [0.75, 0, 0]);
    addCyl(g, 0.035, 0.075, 0.11, dark, [0, 0.43, 0.13], { rot: [0.5, 0, 0] });
    addCyl(g, 0.06, 0.06, 0.01, light, [0, 0.39, 0.155], { rot: [0.5, 0, 0] });
  },
  mug(g, style, look) {
    const paint = mat(style, `paint:${look?.mug ?? 'Off white'}`);
    addCyl(g, 0.042, 0.04, 0.095, paint, [0, 0.0475, 0]);
    addBox(g, 0.015, 0.05, 0.04, paint, [0.05, 0.05, 0]);
  },
  bookcase(g, style, look) {
    const W = mat(style, 'paint:Off white');
    const D = 0.28;
    const H = 2.02;
    for (const sx of [-1, 1]) addBox(g, 0.02, H, D, W, [sx * 0.39, H / 2, 0]);
    addBox(g, 0.8, 0.02, 0.01, W, [0, H - 0.01, -0.135]);
    addBox(g, 0.76, H, 0.01, W, [0, H / 2, -0.135]);
    for (const y of [0.06, 0.42, 0.80, 1.18, 1.56, 2.01]) addBox(g, 0.76, 0.02, D, W, [0, y, 0]);
    // Book sizes from the kit's random.Random(7), so the shelf matches the GLB.
    const books = [
      [0.114, 0.27, -0.31, 0.215, 'paint:Powder blue'],
      [0.074, 0.24, -0.21, 0.2, 'paint:Powder blue'],
      [0.154, 0.24, 0.01, 0.2, 'paint:Lilac'],
      [0.074, 0.24, 0.13, 0.2, 'paint:Powder blue'],
      [0.154, 0.24, 0.25, 0.2, 'paint:Powder blue'],
      [0.094, 0.3, -0.32, 0.59, 'paint:Dusty rose'],
      [0.074, 0.24, -0.01, 0.56, 'paint:Slate'],
      [0.154, 0.3, 0.11, 0.59, 'paint:Slate'],
      [0.114, 0.3, 0.25, 0.59, 'paint:Sage'],
      [0.114, 0.22, -0.31, 0.93, 'paint:Slate'],
      [0.154, 0.27, -0.05, 0.955, 'paint:Sage'],
      [0.074, 0.3, 0.23, 0.97, 'paint:Sand'],
      [0.074, 0.24, -0.33, 1.32, 'paint:Slate'],
      [0.074, 0.24, -0.25, 1.32, 'paint:Navy'],
      [0.154, 0.3, -0.13, 1.35, 'paint:Sand'],
      [0.074, 0.22, -0.01, 1.31, 'paint:Dusty rose'],
      [0.154, 0.24, 0.11, 1.32, 'paint:Navy'],
      [0.094, 0.27, 0.24, 1.335, 'paint:Slate'],
      [0.154, 0.2, -0.29, 1.68, 'paint:Navy'],
      [0.094, 0.2, -0.16, 1.68, 'paint:Navy'],
      [0.154, 0.2, -0.03, 1.68, 'paint:Lilac'],
    ];
    books.forEach(([w, h, x, y, key], i) => {
      const colour = look?.books ? `paint:${look.books[i % look.books.length]}` : key;
      addBox(g, w, h, 0.2, mat(style, colour), [x, y, -0.01]);
    });
  },
  copier(g, style) {
    const gray = mat(style, 'paint:Light gray');
    const dark = mat(style, 'darkMetal:Charcoal');
    const white = mat(style, 'paint:Off white');
    const ink = mat(style, 'darkMetal:Ink');
    const paper = mat(style, 'paint:Paper');
    addBox(g, 0.6, 0.6, 0.5, gray, [0, 0.3, 0]);
    addBox(g, 0.58, 0.004, 0.004, dark, [0, 0.3, 0.25]);
    addBox(g, 0.5, 0.36, 0.45, white, [0, 0.78, 0]);
    addBox(g, 0.5, 0.08, 0.42, dark, [0, 1.0, -0.01]);
    addBox(g, 0.16, 0.04, 0.1, ink, [0.15, 1.03, 0.17], [0.3, 0, 0]);
    addBox(g, 0.36, 0.01, 0.2, paper, [0, 0.83, 0.27]);
  },
  flat_file(g, style) {
    const white = mat(style, 'paint:Off white');
    const gray = mat(style, 'paint:Light gray');
    const metal = mat(style, 'metal:Stone');
    addBox(g, 1.65, 0.75, 0.42, white, [0, 0.375, 0]);
    for (let i = 0; i < 5; i++) {
      const y = 0.15 + i * 0.125;
      addBox(g, 1.6, 0.004, 0.005, gray, [0, y - 0.06, 0.211]);
      addBox(g, 0.3, 0.02, 0.025, metal, [0, y, 0.22]);
    }
  },
  wall_shelf(g, style) {
    const wood = mat(style, 'wood:Tan');
    const metal = mat(style, 'darkMetal:Charcoal');
    addBox(g, 1.0, 0.04, 0.2, wood, [0, 0.02, 0.1]);
    for (const sx of [-1, 1]) addBox(g, 0.02, 0.12, 0.02, metal, [sx * 0.38, -0.04, 0.01]);
  },
  sofa(g, style, look) {
    const metal = mat(style, 'metal:Light gray');
    const walnut = mat(style, `cloth:${look?.sofa?.[0] ?? 'Walnut'}`);
    const cocoa = mat(style, `cloth:${look?.sofa?.[1] ?? 'Cocoa'}`);
    for (const sx of [-1, 1]) {
      addBox(g, 0.04, 0.04, 0.86, metal, [sx * 1.0, 0.02, 0]);
      addBox(g, 0.04, 0.3, 0.04, metal, [sx * 1.0, 0.17, 0.38]);
      addBox(g, 0.04, 0.3, 0.04, metal, [sx * 1.0, 0.17, -0.38]);
    }
    addBox(g, 2.1, 0.12, 0.82, walnut, [0, 0.36, 0]);
    for (const i of [-1, 0, 1]) addBox(g, 0.64, 0.14, 0.62, cocoa, [i * 0.67, 0.49, 0.07]);
    for (const i of [-1, 0, 1]) addBox(g, 0.64, 0.36, 0.18, cocoa, [i * 0.67, 0.64, -0.31], [-0.12, 0, 0]);
    for (const sx of [-1, 1]) addBox(g, 0.12, 0.28, 0.84, walnut, [sx * 1.03, 0.52, 0]);
  },
  coffee_table(g, style) {
    const wood = mat(style, 'wood:Tan');
    addBox(g, 1.4, 0.04, 0.6, wood, [0, 0.35, 0]);
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) addBox(g, 0.05, 0.33, 0.05, wood, [sx * 0.64, 0.165, sz * 0.24]);
    }
    addBox(g, 1.28, 0.02, 0.48, wood, [0, 0.12, 0]);
  },
  side_table(g, style) {
    const dark = mat(style, 'darkMetal:Ink');
    addCyl(g, 0.225, 0.225, 0.05, dark, [0, 0.505, 0], { seg: 8 });
    for (let i = 0; i < 3; i++) {
      const a = i * 2 * P / 3;
      addBox(g, 0.02, 0.52, 0.02, dark, [Math.sin(a) * 0.13, 0.25, Math.cos(a) * 0.13], [Math.cos(a) * 0.18, 0, -Math.sin(a) * 0.18]);
    }
  },
  rug(g, style, look) {
    addBox(g, 3.0, 0.01, 2.0, mat(style, `cloth:${look?.rug?.[0] ?? 'Sand'}`), [0, 0.005, 0]);
    addBox(g, 2.8, 0.002, 1.8, mat(style, `cloth:${look?.rug?.[1] ?? 'Tan'}`), [0, 0.011, 0]);
  },
  rug_large(g, style, look) {
    addBox(g, 3.5, 0.01, 2.4, mat(style, `cloth:${look?.rug?.[0] ?? 'Sand'}`), [0, 0.005, 0]);
    addBox(g, 3.3, 0.002, 2.2, mat(style, `cloth:${look?.rug?.[1] ?? 'Tan'}`), [0, 0.011, 0]);
  },
  whiteboard_mobile(g, style) {
    const metal = mat(style, 'metal:Stone');
    const gray = mat(style, 'metal:Light gray');
    const dark = mat(style, 'darkMetal:Ink');
    const white = mat(style, 'paint:Off white');
    for (const sx of [-1, 1]) {
      addBox(g, 0.04, 1.72, 0.04, metal, [sx * 0.66, 0.9, 0]);
      addBox(g, 0.05, 0.04, 0.56, metal, [sx * 0.66, 0.07, 0]);
      for (const sz of [-1, 1]) addBox(g, 0.04, 0.05, 0.04, dark, [sx * 0.66, 0.025, sz * 0.25]);
    }
    addBox(g, 1.26, 0.94, 0.03, gray, [0, 1.22, 0]);
    addBox(g, 1.2, 0.88, 0.012, white, [0, 1.22, 0.016]);
    addBox(g, 1.0, 0.03, 0.06, metal, [0, 0.76, 0.04]);
  },
  whiteboard_wall(g, style) {
    addBox(g, 1.84, 1.24, 0.03, mat(style, 'metal:Light gray'), [0, 0.62, 0.015]);
    addBox(g, 1.78, 1.18, 0.01, mat(style, 'paint:Off white'), [0, 0.62, 0.032]);
    addBox(g, 0.6, 0.025, 0.06, mat(style, 'metal:Stone'), [0, 0.01, 0.04]);
  },
  meeting_table(g, style) {
    const wood = mat(style, 'wood:Tan');
    addCyl(g, 0.5, 0.5, 0.04, wood, [0, 0.73, 0], { seg: 12, scl: [2, 1, 1] });
    for (const sx of [-1, 1]) addBox(g, 0.06, 0.71, 0.55, wood, [sx * 0.55, 0.355, 0]);
    addBox(g, 1.1, 0.06, 0.06, wood, [0, 0.12, 0]);
  },
  meeting_chair(g, style, look) {
    const metal = mat(style, 'metal:Light gray');
    const cloth = mat(style, `cloth:${look?.meeting ?? 'Ink'}`);
    for (const sx of [-1, 1]) {
      const x = sx * 0.25;
      addBox(g, 0.025, 0.03, 0.5, metal, [x, 0.015, -0.02]);
      addBox(g, 0.025, 0.42, 0.03, metal, [x, 0.22, 0.22], [-0.25, 0, 0]);
      addBox(g, 0.025, 0.03, 0.42, metal, [x, 0.62, 0.02]);
      addBox(g, 0.025, 0.3, 0.03, metal, [x, 0.48, -0.25], [0.3, 0, 0]);
    }
    addBox(g, 0.5, 0.08, 0.46, cloth, [0, 0.45, 0.02]);
    addBox(g, 0.5, 0.32, 0.07, cloth, [0, 0.65, -0.22], [-0.15, 0, 0]);
  },
  kitchen_run(g, style) {
    const L = 3.24;
    const dark = mat(style, 'darkMetal:Charcoal');
    const sage = mat(style, 'paint:Sage');
    const moss = mat(style, 'paint:Moss');
    const seam = mat(style, 'paint:Seafoam');
    const metal = mat(style, 'metal:Stone');
    addBox(g, L, 0.1, 0.55, dark, [0, 0.05, -0.03]);
    addBox(g, L, 0.77, 0.6, sage, [0, 0.485, -0.02]);
    addBox(g, L, 0.04, 0.64, moss, [0, 0.89, 0]);
    addBox(g, L, 0.19, 0.02, moss, [0, 1.005, -0.31]);
    const n = 8;
    for (let i = 0; i <= n; i++) addBox(g, 0.006, 0.74, 0.005, seam, [-L / 2 + i * L / n, 0.49, 0.281]);
    for (let i = 0; i < n; i++) addBox(g, 0.14, 0.015, 0.02, metal, [-L / 2 + (i + 0.5) * L / n, 0.8, 0.29]);
    addBox(g, 0.46, 0.012, 0.3, metal, [-1.15, 0.906, 0]);
    addBox(g, 0.03, 0.26, 0.03, metal, [-1.15, 1.04, -0.24]);
    addBox(g, 0.03, 0.03, 0.16, metal, [-1.15, 1.16, -0.17]);
  },
  fridge(g, style) {
    const metal = mat(style, 'metal:Light gray');
    const dark = mat(style, 'darkMetal:Charcoal');
    const handle = mat(style, 'metal:Stone');
    addBox(g, 0.76, 1.69, 0.72, metal, [0, 0.845, -0.025]);
    addBox(g, 0.76, 1.66, 0.05, metal, [0, 0.845, 0.36]);
    addBox(g, 0.74, 0.006, 0.006, dark, [0, 1.2, 0.386]);
    for (const y of [1.44, 0.75]) addBox(g, 0.03, 0.36, 0.04, handle, [-0.3, y, 0.41]);
  },
  trash_can(g, style) {
    addBox(g, 0.47, 0.6, 0.33, mat(style, 'darkMetal:Ink'), [0, 0.3, 0]);
    addBox(g, 0.47, 0.03, 0.33, mat(style, 'darkMetal:Charcoal'), [0, 0.615, 0]);
  },
  coffee_machine(g, style) {
    const metal = mat(style, 'metal:Stone');
    const glass = mat(style, 'glass:Charcoal');
    const ink = mat(style, 'darkMetal:Ink');
    const dark = mat(style, 'darkMetal:Charcoal');
    addBox(g, 0.34, 0.36, 0.32, metal, [0, 0.22, -0.02]);
    addBox(g, 0.34, 0.04, 0.4, metal, [0, 0.02, 0.02]);
    addCyl(g, 0.06, 0.04, 0.12, glass, [0, 0.46, -0.06]);
    addBox(g, 0.05, 0.03, 0.12, ink, [0, 0.2, 0.17]);
    addBox(g, 0.16, 0.06, 0.005, dark, [0, 0.33, 0.141]);
  },
  microwave(g, style) {
    addBox(g, 0.46, 0.28, 0.37, mat(style, 'paint:Off white'), [0, 0.14, 0]);
    addBox(g, 0.3, 0.2, 0.005, mat(style, 'glass:Ink'), [-0.05, 0.14, 0.186]);
    addBox(g, 0.08, 0.22, 0.005, mat(style, 'paint:Light gray'), [0.17, 0.14, 0.186]);
  },
  bar_table(g, style) {
    addBox(g, 2.1, 0.97, 0.5, mat(style, 'paint:Dusty rose'), [0, 0.485, 0]);
    addBox(g, 2.2, 0.07, 0.65, mat(style, 'concrete:Paper'), [0, 1.0, 0]);
    // Chips use paint, not concrete: concrete snaps to the building palette
    // and Peach / Dusty rose would turn into wood browns.
    const chips = [
      [-0.5503, 0.0248, 1.1099, 'paint:Dusty rose'],
      [-0.0545, 0.0453, 1.8168, 'paint:Stone'],
      [-0.5054, -0.1488, 2.9869, 'paint:Stone'],
      [0.086, 0.0278, 1.1914, 'paint:Peach'],
      [-0.563, -0.1951, 2.7775, 'paint:Stone'],
      [0.5066, 0.096, 0.1921, 'paint:Dusty rose'],
      [-0.9601, 0.1568, 2.4707, 'paint:Stone'],
      [-0.0572, 0.1225, 2.6364, 'paint:Dusty rose'],
      [0.605, -0.0409, 2.1844, 'paint:Dusty rose'],
      [-0.1163, 0.2439, 2.6366, 'paint:Peach'],
      [-0.9746, -0.0029, 0.7739, 'paint:Dusty rose'],
      [-0.1341, 0.0709, 0.9031, 'paint:Dusty rose'],
      [0.7003, 0.0415, 1.6023, 'paint:Stone'],
      [0.1769, 0.2264, 2.0459, 'paint:Peach'],
      [0.7484, 0.275, 2.0138, 'paint:Peach'],
      [0.4171, -0.0972, 1.6253, 'paint:Dusty rose'],
      [0.1451, 0.1197, 0.6334, 'paint:Dusty rose'],
      [-0.4891, -0.2103, 1.446, 'paint:Dusty rose'],
    ];
    for (const [x, z, rot, key] of chips) addBox(g, 0.05, 0.004, 0.04, mat(style, key), [x, 1.036, z], [0, rot, 0]);
  },
  bar_stool(g, style) {
    const wood = mat(style, 'wood:Walnut');
    // cloth keeps Sand. The wood role would snap it to a building brown.
    const cane = mat(style, 'cloth:Sand');
    for (let i = 0; i < 4; i++) {
      const a = P / 4 + i * P / 2;
      addBox(g, 0.03, 0.78, 0.03, wood, [Math.sin(a) * 0.17, 0.38, Math.cos(a) * 0.17], [Math.cos(a) * 0.1, 0, -Math.sin(a) * 0.1]);
    }
    addCyl(g, 0.2, 0.2, 0.02, wood, [0, 0.3, 0], { seg: 8 });
    addCyl(g, 0.19, 0.19, 0.04, cane, [0, 0.76, 0], { seg: 8 });
  },
  pendant_lamp(g, style) {
    const coral = mat(style, 'paint:Dusty rose');
    const light = mat(style, 'light:Butter');
    const cord = mat(style, 'darkMetal:Ink');
    addCyl(g, 0.11, 0.11, 0.22, coral, [0, 0.11, 0], { seg: 8 });
    addCyl(g, 0.09, 0.09, 0.005, light, [0, 0.002, 0], { seg: 8 });
    addCyl(g, 0.006, 0.006, 1.0, cord, [0, 0.72, 0], { seg: 4 });
    addCyl(g, 0.05, 0.05, 0.02, coral, [0, 1.22, 0], { seg: 6 });
  },
  plant_fig(g, style, look) {
    addCyl(g, 0.17, 0.13, 0.34, mat(style, `concrete:${look?.pot ?? 'Off white'}`), [0, 0.17, 0]);
    addCyl(g, 0.15, 0.15, 0.01, mat(style, 'wood:Walnut'), [0, 0.335, 0]);
    addCyl(g, 0.02, 0.03, 1.0, mat(style, 'wood:Walnut'), [0, 0.8, 0], { seg: 5 });
    const crowns = [[0, 1.55, 0, 0.22], [0.15, 1.3, 0.08, 0.2], [-0.14, 1.2, -0.05, 0.2], [0.05, 1.05, -0.15, 0.18], [-0.06, 1.45, 0.14, 0.17]];
    crowns.forEach(([x, y, z, r], i) => addLobe(g, style, r, i % 2 ? 'leaf:Moss' : 'leaf:Sage', [x, y, z], [1, 0.8, 1], i + 1));
  },
  plant_monstera(g, style, look) {
    // Woven basket stays Sand (cloth). wood:Sand would snap to a building brown.
    addCyl(g, 0.21, 0.17, 0.32, mat(style, `cloth:${look?.basket ?? 'Sand'}`), [0, 0.16, 0], { seg: 8 });
    for (let i = 0; i < 6; i++) {
      const a = i * 2 * P / 6;
      addLobe(g, style, 0.2, i % 2 ? 'leaf:Moss' : 'leaf:Sage', [Math.sin(a) * 0.2, 0.62 + 0.12 * (i % 3), Math.cos(a) * 0.2], [1.2, 0.45, 1.2], 10 + i);
    }
    addLobe(g, style, 0.2, 'leaf:Moss', [0, 1.0, 0], [1.1, 0.5, 1.1], 20);
  },
  plant_snake(g, style) {
    addCyl(g, 0.13, 0.11, 0.28, mat(style, 'concrete:Charcoal'), [0, 0.14, 0]);
    // Blade heights from the kit's random.Random(5).
    const blades = [
      [0, 0.6869, 0, 0.6234, 0.05, 0.12, 0],
      [0.7854, 0.7225, 0.0354, 0.6413, 0.0354, 0.0849, -0.0566],
      [1.5708, 0.7386, 0.05, 0.6493, 0, 0, -0.08],
      [2.3562, 0.7827, 0.0354, 0.6714, -0.0354, -0.0849, -0.0566],
      [3.1416, 0.722, 0, 0.641, -0.05, -0.12, 0],
      [3.927, 0.7767, -0.0354, 0.6683, -0.0354, -0.0849, 0.0566],
      [4.7124, 0.5087, -0.05, 0.5344, 0, 0, 0.08],
      [5.4978, 0.6397, -0.0354, 0.5998, 0.0354, 0.0849, 0.0566],
    ];
    blades.forEach(([a, h, x, y, z, rx, rz], i) => {
      addBox(g, 0.06, h, 0.012, mat(style, i % 3 ? 'leaf:Moss' : 'leaf:Sage'), [x, y, z], [rx, a, rz]);
    });
  },
  plant_small(g, style, look) {
    addCyl(g, 0.07, 0.055, 0.11, mat(style, `concrete:${look?.pot ?? 'Off white'}`), [0, 0.055, 0]);
    [[0, 0.2, 0], [0.06, 0.16, 0.03], [-0.05, 0.15, -0.03]].forEach((pos, i) => {
      addLobe(g, style, 0.08, 'leaf:Moss', pos, [1, 0.8, 1], 30 + i);
    });
  },
  planter_divider(g, style) {
    addBox(g, 2.4, 0.5, 0.46, mat(style, 'paint:Off white'), [0, 0.25, 0]);
    const clumps = [
      [-1.08, 0.2317, 0.9459, 0.0509, 'leaf:Sage'],
      [-0.9138, 0.2316, 1.0493, -0.0372, 'leaf:Moss'],
      [-0.7477, 0.2333, 0.9649, -0.0377, 'leaf:Sage'],
      [-0.5815, 0.2212, 0.7817, 0.0372, 'leaf:Moss'],
      [-0.4154, 0.2444, 0.9584, -0.0125, 'leaf:Sage'],
      [-0.2492, 0.2458, 0.9654, -0.0411, 'leaf:Moss'],
      [-0.0831, 0.2582, 0.7721, -0.0557, 'leaf:Moss'],
      [0.0831, 0.242, 1.0223, -0.0208, 'leaf:Moss'],
      [0.2492, 0.259, 0.9317, 0.0168, 'leaf:Sage'],
      [0.4154, 0.2003, 0.7797, 0.0186, 'leaf:Sage'],
      [0.5815, 0.2698, 1.0985, 0.0408, 'leaf:Moss'],
      [0.7477, 0.2178, 1.0153, 0.0015, 'leaf:Moss'],
      [0.9138, 0.2049, 1.0182, -0.012, 'leaf:Sage'],
      [1.08, 0.2271, 1.0853, 0.0417, 'leaf:Moss'],
    ];
    clumps.forEach(([x, r, y, z, key], i) => addLobe(g, style, r, key, [x, y, z], [1, 1.3, 0.9], 40 + i));
    const moss = mat(style, 'leaf:Moss');
    for (let i = 0; i < 6; i++) addBox(g, 0.05, 0.5, 0.012, moss, [-1.0 + i * 0.4, 1.2, 0], [0, i, 0.15 * (i % 2 ? -1 : 1)]);
  },
};

const LABELS = {
  desk: 'Desk',
  office_chair: 'Office chair',
  monitor: 'Monitor',
  laptop: 'Laptop',
  keyboard: 'Keyboard',
  desk_lamp: 'Desk lamp',
  mug: 'Mug',
  bookcase: 'Bookcase',
  copier: 'Copier',
  flat_file: 'Flat-file cabinet',
  wall_shelf: 'Wall shelf',
  sofa: 'Sofa',
  coffee_table: 'Coffee table',
  side_table: 'Side table',
  rug: 'Rug',
  rug_large: 'Large rug',
  whiteboard_mobile: 'Mobile whiteboard',
  whiteboard_wall: 'Wall whiteboard',
  meeting_table: 'Meeting table',
  meeting_chair: 'Meeting chair',
  kitchen_run: 'Kitchen',
  fridge: 'Fridge',
  trash_can: 'Trash can',
  coffee_machine: 'Espresso machine',
  microwave: 'Microwave',
  bar_table: 'Bar table',
  bar_stool: 'Bar stool',
  pendant_lamp: 'Pendant lamp',
  plant_fig: 'Fiddle-leaf fig',
  plant_monstera: 'Monstera',
  plant_snake: 'Snake plant',
  plant_small: 'Small plant',
  planter_divider: 'Planter divider',
};

// Rugs are walked on. The pendant hangs: no footprint on the floor.
const NO_HIT = new Set(['rug', 'rug_large', 'pendant_lamp']);

function hitFor(name, footprint) {
  if (NO_HIT.has(name)) return [];
  const [w, d] = footprint;
  // Wall shelf and wall board are measured from their back, not their middle.
  if (name === 'wall_shelf') return [{ z: 0.1, hw: w / 2, hd: d / 2 }];
  if (name === 'whiteboard_wall') return [{ z: 0.035, hw: w / 2, hd: d / 2 }];
  return [{ hw: w / 2, hd: d / 2 }];
}

/** One catalogue row per kit item, in manifest order (work, lounge, meeting, kitchen, plants). */
export const OFFICE_ITEMS = Object.entries(manifest.items).map(([name, item]) => ({
  name,
  id: `office.${name}`,
  label: LABELS[name] ?? item.label,
  kitGroup: item.group,
  size: item.footprint,
  hit: hitFor(name, item.footprint),
}));

/** A kit item standing on y = 0, facing +z. Geometry is its own (safe to dispose). */
export function buildOfficeItem(name, style, look = null) {
  const build = BUILDERS[name];
  if (!build) throw new Error(`Unknown office item "${name}"`);
  const g = new THREE.Group();
  g.name = name;
  build(g, style, look);
  g.userData.officeItem = name;
  return g;
}

// Office plan: X east 0..6.5, Y north 0..14.5. three.js x = X - 3.25, z = 7.25 - Y.
function wall(g, style, x0, x1, y0, y1, z0, z1, key, hits) {
  const w = x1 - x0;
  const h = z1 - z0;
  const d = y1 - y0;
  const x = (x0 + x1) / 2 - 3.25;
  const y = (z0 + z1) / 2;
  const z = 7.25 - (y0 + y1) / 2;
  addBox(g, w, h, d, mat(style, key), [x, y, z]);
  // Solid from the knees up. Floors and the high window head are skipped.
  if (hits && !key.startsWith('concrete') && z0 < 0.8 && z1 > 0.35) {
    hits.push({ x, z, hw: Math.abs(w) / 2, hd: Math.abs(d) / 2 });
  }
}

/**
 * The whole office (6.5 × 14.5 m). `cutaway` hides the east wall so the
 * inside reads from the catalogue camera. Meshes are merged per material.
 */
export function buildOfficeRoom(style, { cutaway = false, seed = 0 } = {}) {
  const plan = officeLayout(seed);
  const body = new THREE.Group();
  const east = new THREE.Group();
  const hits = [];
  const W = 'building:Off white';

  // Checker over the main floor, then the slab under the whole plan.
  for (let i = 0; i < 4; i++) {
    for (let j = 0; j < 8; j++) {
      wall(body, style, 1.25 + i * 1.275, 1.25 + (i + 1) * 1.275, 0.15 + j * 1.775, 0.15 + (j + 1) * 1.775, SLAB_TOP, TILE_TOP, (i + j) % 2 ? 'concrete:Light gray' : 'concrete:Stone', null);
    }
  }
  wall(body, style, 0, 6.5, 0, 14.5, SLAB_TOP - 0.25, SLAB_TOP, 'concrete:Gray', null);

  wall(body, style, 0, 6.5, 0, 0.15, 0, 3, W, hits);
  wall(body, style, 0, 0.15, 0.15, 14.35, 0, 3, W, hits);
  wall(body, style, 1.1, 1.25, 0.15, 5.0, 0, 3, W, hits);
  wall(body, style, 1.1, 1.25, 5.9, 14.35, 0, 3, W, hits);
  wall(body, style, 1.1, 1.25, 5.0, 5.9, 2.1, 3, W, hits);
  wall(body, style, 1.25, 2.4, 2.65, 2.8, 0, 3, W, hits);
  wall(body, style, 4.8, 6.35, 2.65, 2.8, 0, 3, W, hits);
  wall(body, style, 2.4, 4.8, 2.65, 2.8, 0, 1.1, W, hits);
  wall(body, style, 2.4, 4.8, 2.65, 2.8, 2.1, 3, W, hits);
  wall(body, style, 2.4, 4.8, 2.7, 2.75, 1.1, 1.14, 'darkMetal:Charcoal', hits);
  wall(body, style, 2.4, 4.8, 2.7, 2.75, 2.06, 2.1, 'darkMetal:Charcoal', null);
  wall(body, style, 2.44, 4.76, 2.72, 2.73, 1.14, 2.06, 'glass:Sky', hits);
  wall(body, style, 1.16, 1.22, 5.04, 5.86, 0, 2.05, 'glass:Sky', hits);
  wall(body, style, 0, 6.5, 14.35, 14.5, 2.8, 3, W, null);
  wall(body, style, 0, 1.25, 14.35, 14.5, 0, 2.8, W, hits);
  for (let k = 0; k < 5; k++) {
    const x = 1.25 + k * 1.275;
    wall(body, style, x, x + 0.06, 14.33, 14.47, 0, 2.8, 'darkMetal:Charcoal', hits);
  }
  wall(body, style, 1.25, 6.35, 14.33, 14.47, 0, 0.4, 'darkMetal:Charcoal', hits);
  wall(body, style, 1.25, 6.35, 14.33, 14.47, 2.74, 2.8, 'darkMetal:Charcoal', null);
  wall(body, style, 1.25, 6.35, 14.42, 14.44, 0.4, 2.74, 'glass:Sky', hits);
  for (let s = 0; s < 16; s++) {
    wall(body, style, 0.15, 1.1, 0.15 + s * 0.297, 0.15 + (s + 1) * 0.297, 0, 0.19 * (s + 1), 'concrete:Stone', null);
  }
  // One box for the whole stair, so a person cannot walk up through the treads.
  hits.push({ x: (0.15 + 1.1) / 2 - 3.25, z: 7.25 - (0.15 + 0.15 + 16 * 0.297) / 2, hw: (1.1 - 0.15) / 2, hd: (16 * 0.297) / 2 });

  wall(east, style, 6.35, 6.5, 0.15, 14.35, 0, 3, W, cutaway ? null : hits);

  for (const p of plan.placements) {
    const item = buildOfficeItem(p.item, style, plan.look);
    item.position.set(p.x, p.y + TILE_TOP, p.z);
    item.rotation.y = p.rotY;
    body.add(item);
    // Things on a desk or a shelf are not a second obstacle on the floor.
    if (p.y < 0.05 && !NO_HIT.has(p.item)) {
      const [w, d] = manifest.items[p.item].footprint;
      const c = Math.abs(Math.cos(p.rotY));
      const s = Math.abs(Math.sin(p.rotY));
      hits.push({ x: p.x, z: p.z, hw: (w / 2) * c + (d / 2) * s, hd: (w / 2) * s + (d / 2) * c });
    }
  }

  const room = new THREE.Group();
  room.name = 'tiny_office';
  const shell = mergeByMaterial(body);
  shell.name = 'room_shell';
  room.add(shell);
  const eastWall = mergeByMaterial(east);
  eastWall.name = 'room_wall_east';
  eastWall.visible = !cutaway;
  room.add(eastWall);
  return { group: room, colliders: hits };
}
