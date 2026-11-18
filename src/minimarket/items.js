import * as THREE from 'three';
import { PALETTE } from '../styles/palette.js';
import { mergeByMaterial } from '../lib/merge.js';
import manifest from '../../public/minimarket-kit/manifest.json';
import { minimarketLayout } from './layout.js';

// A Japanese convenience store (konbini), in the same boxes and cylinders as
// the diner kit (src/diner/items.js). Built here, not loaded, so createAsset
// stays synchronous. Every colour is `role:Swatch` through style.material.
//
// Navy, seafoam, butter and the goods colours use paint / cloth / light, not
// concrete or wood, so the building-colour rule does not flatten them.
// Cylinder sides are the kit's own counts (already the PS1 0.3× detail).
// No readable lettering: goods are colour blocks, the noren is a circle.
//
// Room: 10 m wide (x) by 8 m deep (z), origin at the bottom centre, front
// facing +z. The floor sits 2 cm above y = 0. Cutaway hides the +z and +x
// walls, the two the isometric catalogue camera faces.

const P = Math.PI;
const SLAB_TOP = 0.02;
const TILE_TOP = SLAB_TOP + 0.05;

const WIN = { w: 2.15, h: 1.7, d: 0.12 };
const DOOR = { w: 1.7, h: 2.25, d: 0.12 };
const LIP = 0.05;

// Register top, above the tile. Layout y for a prop standing on it.
const REGISTER_TOP = 0.96;

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

const GOODS = ['paint:Dusty rose', 'paint:Butter', 'paint:Seafoam', 'paint:Powder blue', 'paint:Apricot', 'paint:Lilac', 'paint:Sage', 'paint:Navy', 'paint:Blush', 'paint:Mint', 'paint:Sand', 'paint:Cocoa'];

const BUILDERS = {
  register_counter(g, style) {
    const body = mat(style, 'paint:Navy');
    const top = mat(style, 'paint:Off white');
    const edge = mat(style, 'metal:Light gray');
    const stripe = mat(style, roomTint?.stripe ?? 'paint:Butter');
    const dark = mat(style, 'darkMetal:Charcoal');
    addBox(g, 2.16, 0.1, 0.74, dark, [0, 0.05, 0]);
    addBox(g, 2.12, 0.78, 0.7, body, [0, 0.49, 0]);
    addBox(g, 2.04, 0.06, 0.012, stripe, [0, 0.72, 0.356]);
    addBox(g, 2.2, 0.04, 0.78, top, [0, REGISTER_TOP - 0.02, 0]);
    addBox(g, 1.3, 0.012, 0.16, mat(style, 'darkMetal:Ink'), [ -0.2, REGISTER_TOP + 0.002, 0.22]);
    // Till, screen toward the room, a bag and a gum tray on the customer lip.
    addBox(g, 0.32, 0.14, 0.26, dark, [0.7, REGISTER_TOP + 0.07, -0.08]);
    addBox(g, 0.26, 0.12, 0.02, mat(style, 'glass:Navy'), [0.7, REGISTER_TOP + 0.16, 0.04], [-0.45, 0, 0]);
    addBox(g, 0.22, 0.1, 0.16, mat(style, 'paint:Paper'), [-0.7, REGISTER_TOP + 0.05, 0.18]);
    addBox(g, 0.18, 0.06, 0.1, mat(style, 'paint:Dusty rose'), [0.15, REGISTER_TOP + 0.03, 0.28]);
    addBox(g, 0.12, 0.05, 0.08, mat(style, 'paint:Mint'), [0.32, REGISTER_TOP + 0.025, 0.26]);
    addBox(g, 0.04, 0.02, 0.04, edge, [0.7, REGISTER_TOP + 0.15, -0.18]);
  },
  shelf_aisle(g, style) {
    const metal = mat(style, 'metal:Light gray');
    const dark = mat(style, 'darkMetal:Charcoal');
    const band = mat(style, roomTint?.band ?? 'paint:Navy');
    addBox(g, 2.6, 0.08, 0.6, dark, [0, 0.04, 0]);
    addBox(g, 0.04, 1.45, 0.58, metal, [-1.26, 0.78, 0]);
    addBox(g, 0.04, 1.45, 0.58, metal, [1.26, 0.78, 0]);
    addBox(g, 2.5, 1.15, 0.02, metal, [0, 0.85, 0]);
    for (const y of [0.32, 0.72, 1.12]) addBox(g, 2.5, 0.03, 0.58, metal, [0, y, 0]);
    addBox(g, 2.4, 0.06, 0.08, band, [0, 1.48, 0]);
    // Two packs a side, three shelves. The block's colour is the product.
    for (let level = 0; level < 3; level++) {
      for (let side = -1; side <= 1; side += 2) {
        for (let col = 0; col < 2; col++) {
          const key = GOODS[(level * 4 + (side < 0 ? 0 : 2) + col + (roomTint?.goods ?? 0)) % GOODS.length];
          addBox(g, 1.05, 0.28, 0.2, mat(style, key), [-0.58 + col * 1.16, 0.48 + level * 0.4, side * 0.16]);
        }
      }
    }
  },
  drinks_fridge(g, style) {
    const shell = mat(style, 'paint:Off white');
    const dark = mat(style, 'darkMetal:Charcoal');
    const edge = mat(style, 'metal:Light gray');
    const W = 1.08;
    const H = 1.9;
    const D = 0.58;
    const t = 0.04;
    addBox(g, W, 0.08, D, dark, [0, 0.04, 0]);
    addBox(g, W, t, D, shell, [0, H - t / 2, 0]);
    addBox(g, t, H - 0.1, D, shell, [-W / 2 + t / 2, H / 2, 0]);
    // +x side is glass. The isometric camera sits on that corner, and a solid
    // panel hid the drinks on the fridge nearest the camera.
    addBox(g, 0.03, 0.08, D, shell, [W / 2 - 0.02, 0.18, 0]);
    addBox(g, 0.03, 0.08, D, shell, [W / 2 - 0.02, H - 0.12, 0]);
    addBox(g, 0.012, 1.42, D - 0.1, mat(style, 'glass:Sky'), [W / 2 - 0.008, 1.0, 0]);
    addBox(g, W, H - 0.12, t, shell, [0, H / 2, -D / 2 + t / 2]);
    addBox(g, W - 0.1, 1.5, 0.012, mat(style, 'glass:Sky'), [0, 1.0, D / 2]);
    addBox(g, 0.025, 1.5, 0.02, edge, [0, 1.0, D / 2 - 0.006]);
    addBox(g, 0.9, 0.08, 0.02, mat(style, 'paint:Navy'), [0, 1.72, D / 2 + 0.004]);
    for (let row = 0; row < 3; row++) {
      for (let col = 0; col < 4; col++) {
        const key = GOODS[(row * 4 + col + (roomTint?.goods ?? 0)) % GOODS.length];
        addBox(g, 0.16, 0.32, 0.26, mat(style, key), [-0.33 + col * 0.22, 0.42 + row * 0.42, 0.02]);
      }
    }
  },
  hot_food(g, style) {
    const body = mat(style, 'paint:Off white');
    const metal = mat(style, 'metal:Light gray');
    const dark = mat(style, 'darkMetal:Charcoal');
    addBox(g, 0.82, 0.5, 0.46, body, [0, 0.25, 0]);
    addBox(g, 0.78, 0.03, 0.42, metal, [0, 0.515, 0]);
    addBox(g, 0.74, 0.28, 0.012, mat(style, 'glass:Sky'), [0, 0.68, 0.2]);
    addBox(g, 0.74, 0.012, 0.36, mat(style, 'glass:Sky'), [0, 0.82, 0.02]);
    addBox(g, 0.8, 0.03, 0.03, metal, [0, 0.54, 0.2]);
    addBox(g, 0.7, 0.015, 0.08, mat(style, 'light:Butter'), [0, 0.54, 0]);
    const foods = [[-0.22, 'paint:Apricot'], [-0.02, 'paint:Butter'], [0.18, 'paint:Sage']];
    for (const [x, key] of foods) addCyl(g, 0.07, 0.08, 0.06, mat(style, key), [x, 0.58, 0.02], { seg: 6 });
    addBox(g, 0.16, 0.05, 0.1, mat(style, 'paint:Sand'), [0.18, 0.56, -0.08]);
    addBox(g, 0.1, 0.04, 0.012, dark, [0.3, 0.35, 0.232]);
  },
  magazine_rack(g, style) {
    const metal = mat(style, 'metal:Light gray');
    const dark = mat(style, 'darkMetal:Charcoal');
    addBox(g, 0.68, 0.08, 0.32, dark, [0, 0.04, 0]);
    addBox(g, 0.04, 1.15, 0.3, metal, [-0.3, 0.6, 0]);
    addBox(g, 0.04, 1.15, 0.3, metal, [0.3, 0.6, 0]);
    const covers = ['paint:Dusty rose', 'paint:Powder blue', 'paint:Butter', 'paint:Lilac', 'paint:Seafoam', 'paint:Apricot', 'paint:Navy', 'paint:Blush'];
    for (let row = 0; row < 4; row++) {
      const y = 0.28 + row * 0.24;
      addBox(g, 0.6, 0.02, 0.22, metal, [0, y, 0.02], [0.55, 0, 0]);
      for (let col = 0; col < 2; col++) {
        addBox(g, 0.24, 0.18, 0.012, mat(style, covers[row * 2 + col]), [-0.14 + col * 0.28, y + 0.1, 0.1], [0.55, 0, 0]);
      }
    }
  },
  atm(g, style) {
    const body = mat(style, 'paint:Off white');
    const dark = mat(style, 'darkMetal:Charcoal');
    const navy = mat(style, 'paint:Navy');
    addBox(g, 0.54, 1.45, 0.42, body, [0, 0.725, 0]);
    addBox(g, 0.56, 0.06, 0.44, navy, [0, 1.42, 0]);
    addBox(g, 0.36, 0.28, 0.015, mat(style, 'glass:Navy'), [0, 1.12, 0.215]);
    addBox(g, 0.22, 0.16, 0.02, dark, [0, 0.72, 0.22]);
    for (let i = 0; i < 6; i++) {
      const x = -0.06 + (i % 3) * 0.06;
      const y = 0.76 - Math.floor(i / 3) * 0.06;
      addBox(g, 0.035, 0.03, 0.012, mat(style, i === 5 ? 'paint:Butter' : 'paint:Light gray'), [x, y, 0.234]);
    }
    addBox(g, 0.16, 0.015, 0.04, dark, [0, 0.5, 0.22]);
    addBox(g, 0.18, 0.05, 0.06, navy, [0, 0.38, 0.2]);
  },
  copier(g, style) {
    const body = mat(style, 'paint:Light gray');
    const top = mat(style, 'paint:Off white');
    const dark = mat(style, 'darkMetal:Charcoal');
    addBox(g, 0.66, 0.55, 0.5, body, [0, 0.275, 0]);
    addBox(g, 0.62, 0.28, 0.46, top, [0, 0.69, -0.01]);
    addBox(g, 0.4, 0.16, 0.012, mat(style, 'glass:Navy'), [0, 0.78, 0.22]);
    addBox(g, 0.5, 0.012, 0.28, mat(style, 'paint:Paper'), [0, 0.86, 0.04]);
    addBox(g, 0.1, 0.04, 0.08, dark, [0.2, 0.88, 0.16]);
    addBox(g, 0.22, 0.08, 0.16, mat(style, 'paint:Paper'), [0, 0.2, 0.28]);
    addBox(g, 0.5, 0.02, 0.012, dark, [0, 0.4, 0.252]);
  },
  basket(g, style) {
    const red = mat(style, roomTint?.basketA ?? 'paint:Dusty rose');
    const blue = mat(style, roomTint?.basketB ?? 'paint:Powder blue');
    const handle = mat(style, 'metal:Light gray');
    // A stack of two. Open tops: four walls and a floor, no lid.
    [[0, red], [0.11, blue]].forEach(([y, color], i) => {
      const s = 1 - i * 0.08;
      addBox(g, 0.36 * s, 0.025, 0.26 * s, color, [0, y + 0.02, 0]);
      addBox(g, 0.36 * s, 0.1, 0.02, color, [0, y + 0.07, 0.12 * s]);
      addBox(g, 0.36 * s, 0.1, 0.02, color, [0, y + 0.07, -0.12 * s]);
      addBox(g, 0.02, 0.1, 0.24 * s, color, [0.17 * s, y + 0.07, 0]);
      addBox(g, 0.02, 0.1, 0.24 * s, color, [-0.17 * s, y + 0.07, 0]);
      addBox(g, 0.14, 0.02, 0.02, handle, [0, y + 0.14, 0]);
    });
  },
  coffee_machine(g, style) {
    const body = mat(style, 'paint:Off white');
    const dark = mat(style, 'darkMetal:Charcoal');
    const metal = mat(style, 'metal:Light gray');
    addBox(g, 0.3, 0.36, 0.32, body, [0, 0.18, 0]);
    addBox(g, 0.26, 0.08, 0.28, dark, [0, 0.4, 0]);
    addBox(g, 0.16, 0.1, 0.012, mat(style, 'glass:Navy'), [0, 0.28, 0.162]);
    addCyl(g, 0.04, 0.035, 0.07, mat(style, 'paint:Paper'), [0, 0.08, 0.1], { seg: 6 });
    addBox(g, 0.04, 0.06, 0.04, metal, [0, 0.16, 0.12]);
    addCyl(g, 0.05, 0.05, 0.012, mat(style, 'light:Butter'), [0.08, 0.42, 0.04], { seg: 6 });
    addBox(g, 0.06, 0.03, 0.012, mat(style, 'paint:Navy'), [-0.08, 0.22, 0.162]);
  },
  microwave(g, style) {
    const body = mat(style, 'paint:Off white');
    const dark = mat(style, 'darkMetal:Charcoal');
    addBox(g, 0.46, 0.28, 0.34, body, [0, 0.14, 0]);
    addBox(g, 0.28, 0.18, 0.012, mat(style, 'glass:Navy'), [-0.04, 0.15, 0.172]);
    addBox(g, 0.06, 0.16, 0.02, dark, [0.16, 0.15, 0.175]);
    addBox(g, 0.04, 0.08, 0.02, mat(style, 'metal:Light gray'), [0.2, 0.16, 0.18]);
  },
  ice_chest(g, style) {
    const body = mat(style, 'paint:Off white');
    const navy = mat(style, 'paint:Navy');
    addBox(g, 1.02, 0.08, 0.58, navy, [0, 0.04, 0]);
    addBox(g, 0.98, 0.42, 0.06, body, [0, 0.29, -0.26]);
    addBox(g, 0.98, 0.42, 0.06, body, [0, 0.29, 0.26]);
    addBox(g, 0.06, 0.42, 0.5, body, [-0.48, 0.29, 0]);
    addBox(g, 0.06, 0.42, 0.5, body, [0.48, 0.29, 0]);
    addBox(g, 0.9, 0.015, 0.46, mat(style, 'glass:Sky'), [0, 0.52, 0]);
    const tubs = ['paint:Mint', 'paint:Butter', 'paint:Dusty rose', 'paint:Powder blue'];
    tubs.forEach((key, i) => {
      const x = -0.3 + (i % 2) * 0.3;
      const z = i < 2 ? -0.1 : 0.1;
      addCyl(g, 0.09, 0.1, 0.12, mat(style, key), [x, 0.4, z], { seg: 6 });
    });
  },
  umbrella_stand(g, style) {
    const body = mat(style, 'paint:Off white');
    addCyl(g, 0.12, 0.14, 0.4, body, [0, 0.2, 0], { seg: 6 });
    const colors = ['paint:Navy', 'paint:Dusty rose', 'paint:Powder blue'];
    colors.forEach((key, i) => {
      const a = (i - 1) * 0.45;
      addBox(g, 0.025, 0.55, 0.025, mat(style, key), [Math.sin(a) * 0.04, 0.48, Math.cos(a) * 0.03], [0.15, a, 0.2]);
    });
  },
  noren(g, style) {
    const rod = mat(style, 'wood:Walnut');
    addBox(g, 1.35, 0.04, 0.04, rod, [0, 2.15, 0]);
    addBox(g, 0.58, 0.7, 0.015, mat(style, roomTint?.norenA ?? 'cloth:Seafoam'), [-0.34, 1.76, 0]);
    addBox(g, 0.58, 0.7, 0.015, mat(style, roomTint?.norenB ?? 'cloth:Off white'), [0.34, 1.76, 0]);
    addCyl(g, 0.1, 0.1, 0.012, mat(style, 'paint:Navy'), [-0.34, 1.9, 0.014], { seg: 6, rot: [P / 2, 0, 0] });
    addCyl(g, 0.1, 0.1, 0.012, mat(style, 'paint:Navy'), [0.34, 1.9, 0.014], { seg: 6, rot: [P / 2, 0, 0] });
  },
  poster(g, style) {
    addBox(g, 0.5, 0.7, 0.02, mat(style, 'paint:Navy'), [0, 0.35, 0.01]);
    addBox(g, 0.4, 0.42, 0.01, mat(style, 'paint:Butter'), [0, 0.42, 0.022]);
    addBox(g, 0.28, 0.08, 0.01, mat(style, 'paint:Dusty rose'), [0, 0.22, 0.028]);
    addCyl(g, 0.08, 0.08, 0.012, mat(style, 'paint:Off white'), [0, 0.48, 0.032], { seg: 6, rot: [P / 2, 0, 0] });
  },
  trash_bin(g, style) {
    addBox(g, 0.32, 0.5, 0.32, mat(style, 'paint:Light gray'), [0, 0.25, 0]);
    addBox(g, 0.34, 0.04, 0.34, mat(style, 'paint:Navy'), [0, 0.52, 0]);
    addBox(g, 0.1, 0.08, 0.012, mat(style, 'darkMetal:Charcoal'), [0, 0.32, 0.162]);
  },
  clock(g, style) {
    const rim = mat(style, 'paint:Navy');
    const face = mat(style, 'paint:Off white');
    const ink = mat(style, 'darkMetal:Ink');
    addCyl(g, 0.18, 0.18, 0.03, rim, [0, 0.18, 0.02], { seg: 8, rot: [P / 2, 0, 0] });
    addCyl(g, 0.15, 0.15, 0.012, face, [0, 0.18, 0.038], { seg: 8, rot: [P / 2, 0, 0] });
    addBox(g, 0.016, 0.09, 0.006, ink, [0.02, 0.21, 0.048], [0, 0, -0.7]);
    addBox(g, 0.012, 0.12, 0.006, ink, [-0.02, 0.22, 0.052], [0, 0, 0.4]);
  },
  ceiling_light(g, style) {
    addCyl(g, 0.008, 0.008, 0.5, mat(style, 'darkMetal:Ink'), [0, 0.4, 0], { seg: 4 });
    addBox(g, 0.7, 0.05, 0.28, mat(style, 'paint:Off white'), [0, 0.08, 0]);
    addBox(g, 0.6, 0.012, 0.16, mat(style, 'light:Butter'), [0, 0.05, 0]);
  },
  floor_mat(g, style) {
    addBox(g, 1.15, 0.012, 0.66, mat(style, 'cloth:Navy'), [0, 0.01, 0]);
    addBox(g, 0.7, 0.004, 0.1, mat(style, 'paint:Butter'), [0, 0.018, 0]);
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
    addBox(g, w - b * 2, 0.035, d * 0.55, mullion, [0, h * 0.45, 0]);
    addBox(g, w - b * 2 + 0.02, h - b * 2 + 0.02, 0.012, glass, [0, h / 2, 0]);
  },
  door(g, style) {
    const frame = mat(style, 'paint:Navy');
    const metal = mat(style, 'metal:Light gray');
    const glass = mat(style, 'glass:Sky');
    const stripe = mat(style, 'paint:Butter');
    const { w, h, d } = DOOR;
    const jb = 0.06;
    addBox(g, jb, h, d, frame, [-w / 2 + jb / 2, h / 2, 0]);
    addBox(g, jb, h, d, frame, [w / 2 - jb / 2, h / 2, 0]);
    addBox(g, w, jb, d, frame, [0, h - jb / 2, 0]);
    const dw = (w - jb * 2) / 2 - 0.015;
    for (const sx of [-1, 1]) {
      const x = sx * (dw / 2 + 0.012);
      addBox(g, dw, 0.35, 0.04, frame, [x, 0.2, 0]);
      addBox(g, dw - 0.06, 1.45, 0.012, glass, [x, 1.2, 0]);
      addBox(g, dw, 0.05, 0.02, stripe, [x, 0.42, 0.02]);
    }
    addBox(g, 0.02, 1.5, 0.04, metal, [0, 1.2, 0]);
    addBox(g, 0.35, 0.03, 0.03, metal, [0.15, 1.1, d / 2]);
  },
};

const LABELS = {
  register_counter: 'Register counter',
  shelf_aisle: 'Shelf aisle',
  drinks_fridge: 'Drinks fridge',
  hot_food: 'Hot food warmer',
  magazine_rack: 'Magazine rack',
  atm: 'ATM',
  copier: 'Copier',
  basket: 'Baskets',
  coffee_machine: 'Coffee machine',
  microwave: 'Microwave',
  ice_chest: 'Ice cream chest',
  umbrella_stand: 'Umbrella stand',
  noren: 'Noren',
  poster: 'Poster',
  trash_bin: 'Trash bin',
  clock: 'Wall clock',
  ceiling_light: 'Ceiling light',
  floor_mat: 'Floor mat',
  window_bay: 'Storefront window',
  door: 'Automatic door',
};

const NO_HIT = new Set(['floor_mat', 'ceiling_light', 'noren']);
const BACK = new Set(['poster', 'clock']);

function hitFor(name, footprint) {
  if (NO_HIT.has(name)) return [];
  const [w, d] = footprint;
  if (BACK.has(name)) return [{ z: d / 2, hw: w / 2, hd: d / 2 }];
  return [{ hw: w / 2, hd: d / 2 }];
}

/** One catalogue row per kit item, in manifest order. */
export const MINIMARKET_ITEMS = Object.entries(manifest.items).map(([name, item]) => ({
  name,
  id: `minimarket.${name}`,
  label: LABELS[name] ?? item.label,
  kitGroup: item.group,
  size: item.footprint,
  hit: hitFor(name, item.footprint),
}));

/** A kit item standing on y = 0, facing +z. Geometry is its own (safe to dispose). */
export function buildMinimarketItem(name, style) {
  const build = BUILDERS[name];
  if (!build) throw new Error(`Unknown minimarket item "${name}"`);
  const g = new THREE.Group();
  g.name = name;
  build(g, style);
  g.userData.minimarketItem = name;
  return g;
}

const RH = 3;
const BAND = 2.35;
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
    trim(BAND, 0.04, trimKey, BAND - 0.02, BAND + 0.015);
    trim(0.05, 0.025, 'darkMetal:Charcoal', 0, 0.08);
  }
}

/**
 * The whole minimarket (10 × 8 m). `cutaway` hides the front (+z) and side
 * (+x) walls so the inside reads from the isometric catalogue camera.
 */
export function buildMinimarketRoom(style, { cutaway = false, seed = 0 } = {}) {
  const plan = minimarketLayout(seed);
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
  // Aisle guides. Seed 0 keeps the hand-placed stripes; a seeded room follows its shelves.
  if (plan.stripes) {
    for (const s of plan.stripes) {
      addBox(body, 0.08, 0.008, s.len, mat(style, s.key), [s.x, TILE_TOP + 0.005, s.z]);
    }
  } else {
    addBox(body, 0.08, 0.008, 2.4, mat(style, 'paint:Navy'), [-2.55, TILE_TOP + 0.005, -1.1]);
    addBox(body, 0.08, 0.008, 2.4, mat(style, 'paint:Butter'), [0.55, TILE_TOP + 0.005, -1.1]);
  }

  const winHoles = (spans, y0) => spans.map(([a0, a1]) => ({
    a0: a0 + LIP, a1: a1 - LIP, y0: y0 + LIP, y1: y0 + WIN.h - LIP,
  }));
  const frontWins = [[-4.7, -2.55], [-2.35, -0.2], [2.15, 4.3]];
  const doorHole = [0.15, 1.85];
  const frontHoles = [
    ...winHoles(frontWins, 0.4),
    { a0: doorHole[0], a1: doorHole[1], y0: 0, y1: DOOR.h - 0.08 },
  ];
  const sideWins = [[-2.4, -0.25]];
  const sideHoles = winHoles(sideWins, 0.4);
  const paint = { low: 'paint:Off white', high: 'paint:Navy', trimKey: 'paint:Dusty rose' };

  splitWall(body, style, { axis: 'x', a0: -5, a1: 5, fix: -3.93, y1: RH, holes: [], hits, inward: 1, ...paint });
  splitWall(body, style, { axis: 'z', a0: -4, a1: 4, fix: -4.93, y1: RH, holes: [], hits, inward: 1, ...paint });
  splitWall(front, style, { axis: 'x', a0: -5, a1: 5, fix: 3.93, y1: RH, holes: frontHoles, hits: cutaway ? null : hits, inward: -1, ...paint });
  splitWall(side, style, { axis: 'z', a0: -4, a1: 4, fix: 4.93, y1: RH, holes: sideHoles, hits: cutaway ? null : hits, inward: -1, ...paint });

  const placeItem = (group, name, x, y, z, rotY) => {
    const item = buildMinimarketItem(name, style);
    item.position.set(x, y, z);
    item.rotation.y = rotY;
    group.add(item);
  };
  frontWins.forEach(([a0, a1]) => placeItem(front, 'window_bay', (a0 + a1) / 2, 0.4, 3.93, 0));
  const doorX = (doorHole[0] + doorHole[1]) / 2;
  placeItem(front, 'door', doorX, 0, 3.93, 0);
  sideWins.forEach(([a0, a1]) => placeItem(side, 'window_bay', 4.93, 0.4, (a0 + a1) / 2, P / 2));
  if (!cutaway) hits.push({ x: doorX, z: 3.93, hw: DOOR.w / 2, hd: DOOR.d / 2 });

  for (const p of plan.placements) {
    const item = buildMinimarketItem(p.item, style);
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
  room.name = 'tiny_minimarket';
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
