import * as THREE from 'three';
import { PALETTE } from '../styles/palette.js';
import { mergeByMaterial } from '../lib/merge.js';
import manifest from '../../public/diner-kit/manifest.json';
import { dinerLayout } from './plan.js';

// American diner, in the same boxes and cylinders as the office kit
// (src/office/items.js). Built here, not loaded, so createAsset stays
// synchronous. Every colour is `role:Swatch` through style.material, so
// palette swaps, the PS1 wobble and the outline flag all apply.
//
// Reds, teals and creams use paint / cloth / light (not concrete or wood),
// so the building-colour rule does not turn them into greys and browns.
// Cylinder sides are the kit's own counts (already the PS1 0.3× detail).
// They are not passed through seg(), which would cut them again.
//
// Room: 12 m wide (x) by 8 m deep (z), origin at the bottom centre, front
// facing +z. The floor sits 2 cm above y = 0 so it does not flicker against
// the catalogue ground. Cutaway hides the +z and +x walls: those two face
// the isometric catalogue camera.

const P = Math.PI;
const SLAB_TOP = 0.02;
const TILE_TOP = SLAB_TOP + 0.05;

const WIN = { w: 2.2, h: 1.48, d: 0.12 };
const DOOR = { w: 1.22, h: 2.26, d: 0.12 };
const LIP = 0.05;

const glassOf = new WeakMap();

// Set for the duration of one room build. Individual catalogue items leave it null,
// so a stool on its own stays Dusty rose. Ketchup is not in the map.
let swatchSwap = null;

function tone(key) {
  return (swatchSwap && swatchSwap[key]) || key;
}

function mat(style, key) {
  const i = key.indexOf(':');
  const role = key.slice(0, i);
  const swatch = key.slice(i + 1);
  // Window panes and the pie dome stay see-through. Clone: the cached style
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

function addDome(g, r, material, pos, w = 7, h = 4) {
  const m = new THREE.Mesh(new THREE.SphereGeometry(r, w, h, 0, P * 2, 0, P / 2), material);
  m.position.set(pos[0], pos[1], pos[2]);
  g.add(m);
}

function bottle(g, style, bodyKey, capKey) {
  const body = mat(style, bodyKey);
  addCyl(g, 0.03, 0.036, 0.12, body, [0, 0.07, 0], { seg: 6 });
  addCyl(g, 0.014, 0.02, 0.04, body, [0, 0.145, 0], { seg: 5 });
  addCyl(g, 0.016, 0.016, 0.022, mat(style, capKey), [0, 0.174, 0], { seg: 5 });
  addBox(g, 0.046, 0.05, 0.006, mat(style, 'paint:Off white'), [0, 0.075, 0.037]);
}

const BUILDERS = {
  counter(g, style) {
    const red = mat(style, tone('paint:Dusty rose'));
    const top = mat(style, 'paint:Off white');
    const chrome = mat(style, 'metal:Light gray');
    const kick = mat(style, 'darkMetal:Charcoal');
    addBox(g, 3.12, 0.1, 0.62, kick, [0, 0.05, -0.02]);
    addBox(g, 3.16, 0.84, 0.66, red, [0, 0.52, -0.01]);
    addBox(g, 3.04, 0.5, 0.012, kick, [0, 0.48, 0.328]);
    addBox(g, 3.2, 0.05, 0.74, top, [0, 1.025, 0]);
    addBox(g, 3.2, 0.025, 0.03, chrome, [0, 0.995, 0.355]);
    addBox(g, 0.03, 0.025, 0.74, chrome, [-1.585, 0.995, 0]);
    addBox(g, 0.03, 0.025, 0.74, chrome, [1.585, 0.995, 0]);
    addCyl(g, 0.016, 0.016, 3.05, chrome, [0, 1.07, 0.39], { seg: 6, rot: [0, 0, P / 2] });
  },
  stool(g, style) {
    const chrome = mat(style, 'metal:Light gray');
    const seat = mat(style, tone('cloth:Dusty rose'));
    addCyl(g, 0.16, 0.17, 0.03, chrome, [0, 0.015, 0], { seg: 6 });
    addCyl(g, 0.028, 0.032, 0.62, chrome, [0, 0.34, 0], { seg: 6 });
    addCyl(g, 0.13, 0.13, 0.02, chrome, [0, 0.28, 0], { seg: 6 });
    addCyl(g, 0.175, 0.175, 0.018, chrome, [0, 0.66, 0], { seg: 6 });
    addCyl(g, 0.168, 0.168, 0.07, seat, [0, 0.71, 0], { seg: 6 });
  },
  booth(g, style) {
    const vinyl = mat(style, tone('cloth:Dusty rose'));
    const chrome = mat(style, 'metal:Light gray');
    const top = mat(style, 'paint:Off white');
    for (const sx of [-1, 1]) {
      const x = sx * 0.52;
      addBox(g, 0.4, 0.1, 1.12, vinyl, [x, 0.48, 0]);
      addBox(g, 0.09, 0.52, 1.12, vinyl, [sx * 0.76, 0.78, 0]);
      for (const sz of [-1, 1]) {
        addBox(g, 0.05, 0.43, 0.05, chrome, [x, 0.215, sz * 0.5]);
        addBox(g, 0.46, 0.26, 0.06, vinyl, [x, 0.64, sz * 0.56]);
      }
    }
    addBox(g, 0.62, 0.04, 0.7, top, [0, 0.74, 0]);
    addBox(g, 0.66, 0.018, 0.74, chrome, [0, 0.71, 0]);
    addCyl(g, 0.045, 0.05, 0.66, chrome, [0, 0.35, 0], { seg: 6 });
    addCyl(g, 0.16, 0.18, 0.03, chrome, [0, 0.015, 0], { seg: 8 });
  },
  napkin_dispenser(g, style) {
    addBox(g, 0.15, 0.07, 0.07, mat(style, 'metal:Light gray'), [0, 0.045, 0]);
    addBox(g, 0.1, 0.012, 0.008, mat(style, 'darkMetal:Ink'), [0, 0.06, 0.036]);
    addBox(g, 0.09, 0.012, 0.02, mat(style, 'paint:Paper'), [0, 0.078, 0.01]);
  },
  ketchup(g, style) { bottle(g, style, 'paint:Dusty rose', 'paint:Off white'); },
  mustard(g, style) { bottle(g, style, 'paint:Butter', 'paint:Dusty rose'); },
  salt_pepper(g, style) {
    const chrome = mat(style, 'metal:Light gray');
    addBox(g, 0.1, 0.012, 0.05, chrome, [0, 0.006, 0]);
    for (const [x, key, cap] of [[-0.026, 'paint:Off white', 'darkMetal:Ink'], [0.026, 'paint:Charcoal', 'paint:Off white']]) {
      addCyl(g, 0.016, 0.018, 0.07, mat(style, key), [x, 0.046, 0], { seg: 5 });
      addCyl(g, 0.017, 0.017, 0.012, mat(style, cap), [x, 0.086, 0], { seg: 5 });
    }
  },
  straw_holder(g, style) {
    addCyl(g, 0.036, 0.042, 0.07, mat(style, 'metal:Light gray'), [0, 0.035, 0], { seg: 6 });
    const colors = ['paint:Dusty rose', 'paint:Off white', 'paint:Butter', 'paint:Dusty rose'];
    colors.forEach((key, i) => {
      const a = (i - 1.5) * 0.4;
      addBox(g, 0.012, 0.13, 0.012, mat(style, key), [Math.sin(a) * 0.018, 0.12, Math.cos(a) * 0.012], [0.2, a, 0.15]);
    });
  },
  cup_stack(g, style) {
    const cup = mat(style, 'paint:Off white');
    const band = mat(style, tone('paint:Seafoam'));
    for (let i = 0; i < 3; i++) addCyl(g, 0.048, 0.04, 0.055, cup, [0, 0.04 + i * 0.045, 0], { seg: 6 });
    addCyl(g, 0.05, 0.05, 0.012, band, [0, 0.12, 0], { seg: 6 });
    addCyl(g, 0.06, 0.06, 0.012, cup, [0, 0.006, 0], { seg: 6 });
  },
  service_bell(g, style) {
    addCyl(g, 0.046, 0.05, 0.012, mat(style, 'darkMetal:Ink'), [0, 0.006, 0], { seg: 8 });
    addDome(g, 0.038, mat(style, 'metal:Light gray'), [0, 0.012, 0], 6, 3);
    addCyl(g, 0.008, 0.008, 0.012, mat(style, 'darkMetal:Ink'), [0, 0.05, 0], { seg: 5 });
  },
  jukebox(g, style) {
    const ink = mat(style, 'darkMetal:Ink');
    const chrome = mat(style, 'metal:Light gray');
    const glass = mat(style, 'glass:Sky');
    const glow = mat(style, 'light:Butter');
    addBox(g, 0.74, 0.12, 0.5, ink, [0, 0.06, 0]);
    addBox(g, 0.68, 0.42, 0.44, ink, [0, 0.33, 0]);
    addBox(g, 0.66, 0.7, 0.4, chrome, [0, 0.86, 0.01]);
    const bars = ['paint:Dusty rose', 'paint:Butter', 'paint:Seafoam', 'paint:Powder blue', 'paint:Lilac'];
    bars.forEach((key, i) => addBox(g, 0.07, 0.46, 0.012, mat(style, key), [-0.22 + i * 0.11, 0.78, 0.21]));
    addBox(g, 0.58, 0.52, 0.012, glass, [0, 0.8, 0.222]);
    addBox(g, 0.62, 0.04, 0.42, chrome, [0, 1.2, 0]);
    addBox(g, 0.5, 0.16, 0.32, ink, [0, 1.32, -0.02], [-0.35, 0, 0]);
    addBox(g, 0.42, 0.03, 0.08, glow, [0, 1.38, 0.1], [-0.35, 0, 0]);
    addBox(g, 0.08, 0.05, 0.02, chrome, [0.22, 0.42, 0.23]);
    for (const sx of [-1, 1]) addBox(g, 0.03, 1.28, 0.03, chrome, [sx * 0.34, 0.74, 0.22]);
  },
  milkshake_mixer(g, style) {
    const chrome = mat(style, 'metal:Light gray');
    const steel = mat(style, 'metal:Stone');
    addBox(g, 0.36, 0.04, 0.24, steel, [0, 0.02, 0]);
    addBox(g, 0.06, 0.32, 0.06, chrome, [0, 0.2, -0.06]);
    addBox(g, 0.3, 0.08, 0.12, chrome, [0, 0.38, -0.02]);
    for (const x of [-0.08, 0.08]) {
      addCyl(g, 0.012, 0.012, 0.1, steel, [x, 0.29, 0.04], { seg: 5 });
      addCyl(g, 0.038, 0.032, 0.1, chrome, [x, 0.1, 0.05], { seg: 6 });
      addCyl(g, 0.04, 0.04, 0.012, mat(style, x < 0 ? 'paint:Off white' : tone('paint:Dusty rose')), [x, 0.155, 0.05], { seg: 6 });
    }
  },
  coffee_maker(g, style) {
    const chrome = mat(style, 'metal:Light gray');
    const steel = mat(style, 'metal:Stone');
    addBox(g, 0.26, 0.04, 0.22, steel, [0, 0.02, 0]);
    addCyl(g, 0.07, 0.07, 0.008, mat(style, 'light:Butter'), [0, 0.044, 0.02], { seg: 8 });
    addCyl(g, 0.055, 0.06, 0.14, mat(style, 'glass:Sky'), [0, 0.12, 0.02], { seg: 7 });
    addCyl(g, 0.045, 0.048, 0.1, mat(style, 'paint:Walnut'), [0, 0.11, 0.02], { seg: 6 });
    addBox(g, 0.02, 0.08, 0.03, chrome, [0.07, 0.12, 0.02]);
    addBox(g, 0.2, 0.12, 0.16, chrome, [0, 0.28, -0.02]);
    addBox(g, 0.1, 0.02, 0.08, mat(style, 'darkMetal:Charcoal'), [0, 0.22, 0.02]);
  },
  pie_case(g, style) {
    const chrome = mat(style, 'metal:Light gray');
    addCyl(g, 0.08, 0.1, 0.16, chrome, [0, 0.08, 0], { seg: 6 });
    addCyl(g, 0.2, 0.2, 0.025, mat(style, 'paint:Off white'), [0, 0.17, 0], { seg: 8 });
    addCyl(g, 0.21, 0.21, 0.015, chrome, [0, 0.185, 0], { seg: 8 });
    const pies = [[-0.07, 0.04, 'paint:Dusty rose'], [0.07, -0.02, 'paint:Apricot'], [0.01, 0.07, 'paint:Butter']];
    for (const [x, z, key] of pies) addCyl(g, 0.055, 0.055, 0.04, mat(style, key), [x, 0.2, z], { seg: 6 });
    addCyl(g, 0.03, 0.03, 0.025, mat(style, 'paint:Cocoa'), [0.06, 0.21, -0.06], { seg: 6 });
    addDome(g, 0.2, mat(style, 'glass:Sky'), [0, 0.19, 0], 7, 4);
  },
  register(g, style) {
    const chrome = mat(style, 'metal:Light gray');
    const steel = mat(style, 'metal:Stone');
    const ink = mat(style, 'darkMetal:Ink');
    addBox(g, 0.34, 0.16, 0.32, chrome, [0, 0.08, 0]);
    addBox(g, 0.3, 0.04, 0.02, steel, [0, 0.08, 0.17]);
    addBox(g, 0.08, 0.016, 0.02, ink, [0, 0.08, 0.185]);
    addBox(g, 0.28, 0.1, 0.26, chrome, [0, 0.2, -0.02], [-0.4, 0, 0]);
    addBox(g, 0.22, 0.06, 0.008, mat(style, 'glass:Navy'), [0, 0.22, 0.04], [-0.4, 0, 0]);
    addBox(g, 0.24, 0.035, 0.16, mat(style, 'paint:Charcoal'), [0, 0.175, 0.08]);
    for (let i = 0; i < 6; i++) addBox(g, 0.028, 0.012, 0.028, ink, [-0.09 + (i % 3) * 0.07, 0.186, 0.04 + Math.floor(i / 3) * 0.06]);
  },
  soda_fountain(g, style) {
    const chrome = mat(style, 'metal:Light gray');
    const steel = mat(style, 'metal:Stone');
    addBox(g, 0.7, 0.5, 0.32, chrome, [0, 0.32, -0.02]);
    addBox(g, 0.66, 0.08, 0.34, steel, [0, 0.08, 0]);
    addBox(g, 0.62, 0.02, 0.16, mat(style, 'darkMetal:Charcoal'), [0, 0.13, 0.1]);
    const taps = ['paint:Dusty rose', 'paint:Butter', 'paint:Seafoam', 'paint:Cocoa'];
    taps.forEach((key, i) => {
      const x = -0.18 + i * 0.12;
      addBox(g, 0.04, 0.16, 0.04, chrome, [x, 0.42, 0.12]);
      addBox(g, 0.035, 0.06, 0.02, mat(style, key), [x, 0.52, 0.15], [0.5, 0, 0]);
    });
    for (const x of [-0.22, 0, 0.22]) addCyl(g, 0.02, 0.02, 0.08, steel, [x, 0.2, 0.16], { seg: 5, rot: [P / 2, 0, 0] });
  },
  grill(g, style) {
    const dark = mat(style, 'darkMetal:Charcoal');
    const top = mat(style, 'darkMetal:Ink');
    const steel = mat(style, 'metal:Stone');
    addBox(g, 1.1, 0.18, 0.6, dark, [0, 0.09, 0]);
    addBox(g, 1.16, 0.04, 0.66, top, [0, 0.2, 0]);
    addBox(g, 1.16, 0.03, 0.04, steel, [0, 0.16, 0.34]);
    for (const x of [-0.36, -0.12, 0.12, 0.36]) addCyl(g, 0.028, 0.028, 0.03, mat(style, 'metal:Light gray'), [x, 0.1, 0.32], { seg: 6, rot: [P / 2, 0, 0] });
    addBox(g, 0.16, 0.025, 0.1, mat(style, 'paint:Cocoa'), [-0.18, 0.23, 0.02]);
    addBox(g, 0.14, 0.03, 0.1, mat(style, 'paint:Apricot'), [-0.18, 0.255, 0.02]);
    addBox(g, 0.1, 0.02, 0.1, mat(style, 'paint:Sand'), [-0.16, 0.275, 0]);
    addBox(g, 0.05, 0.012, 0.16, steel, [0.28, 0.23, 0.08], [0, 0.4, 0]);
  },
  work_counter(g, style) {
    const dark = mat(style, 'darkMetal:Charcoal');
    const top = mat(style, 'metal:Light gray');
    addBox(g, 2.32, 0.82, 0.6, dark, [0, 0.41, -0.01]);
    addBox(g, 2.4, 0.04, 0.66, top, [0, 0.86, 0]);
    addBox(g, 2.4, 0.02, 0.025, mat(style, 'metal:Stone'), [0, 0.83, 0.32]);
    for (let i = 0; i < 4; i++) addBox(g, 0.5, 0.012, 0.012, dark, [-0.9 + i * 0.6, 0.5, 0.3]);
  },
  pass_window(g, style) {
    const chrome = mat(style, 'metal:Light gray');
    const dark = mat(style, 'darkMetal:Charcoal');
    const W = 1.58;
    const H = 1.62;
    for (const sx of [-1, 1]) addBox(g, 0.055, H, 0.08, chrome, [sx * (W / 2 - 0.028), H / 2, 0]);
    addBox(g, W, 0.07, 0.08, chrome, [0, H - 0.035, 0]);
    addBox(g, W - 0.08, 0.04, 0.16, chrome, [0, 1.08, 0.03]);
    addCyl(g, 0.012, 0.012, W - 0.16, dark, [0, 1.2, 0.1], { seg: 6, rot: [0, 0, P / 2] });
    const tickets = [[-0.48, 'paint:Paper'], [-0.16, 'paint:Butter'], [0.16, 'paint:Blush'], [0.48, 'paint:Powder blue']];
    for (const [x, key] of tickets) addBox(g, 0.11, 0.07, 0.008, mat(style, key), [x, 1.15, 0.11]);
    addCyl(g, 0.11, 0.11, 0.02, dark, [W / 2 - 0.01, 1.34, 0.09], { seg: 8, rot: [P / 2, 0, 0] });
    addCyl(g, 0.028, 0.028, 0.028, chrome, [W / 2 - 0.01, 1.34, 0.1], { seg: 6, rot: [P / 2, 0, 0] });
    for (let i = 0; i < 4; i++) {
      const a = i * P / 2 + 0.5;
      addBox(g, 0.04, 0.016, 0.01, mat(style, 'paint:Paper'), [W / 2 - 0.01 + Math.cos(a) * 0.07, 1.34 + Math.sin(a) * 0.07, 0.105]);
    }
  },
  menu_board(g, style) {
    const W = 1.7;
    const H = 1.04;
    addBox(g, W, H, 0.04, mat(style, 'darkMetal:Ink'), [0, H / 2, 0.02]);
    addBox(g, W - 0.08, H - 0.08, 0.012, mat(style, 'paint:Off white'), [0, H / 2, 0.044]);
    addBox(g, W - 0.16, 0.1, 0.012, mat(style, tone('light:Dusty rose')), [0, H - 0.16, 0.052]);
    const rows = ['paint:Dusty rose', 'paint:Butter', 'paint:Seafoam', 'paint:Sand', 'paint:Powder blue'];
    rows.forEach((key, i) => addBox(g, W - 0.28, 0.07, 0.008, mat(style, key), [-0.08, H - 0.36 - i * 0.12, 0.052]));
    rows.forEach((_, i) => addBox(g, 0.28, 0.045, 0.006, mat(style, 'paint:Charcoal'), [0.5, H - 0.36 - i * 0.12, 0.056]));
  },
  neon_sign(g, style) {
    const W = 1.18;
    const H = 0.6;
    addBox(g, W, H, 0.04, mat(style, 'darkMetal:Ink'), [0, H / 2, 0.02]);
    addBox(g, W + 0.04, 0.035, 0.02, mat(style, tone('light:Dusty rose')), [0, H - 0.04, 0.05]);
    addBox(g, W + 0.04, 0.035, 0.02, mat(style, tone('light:Dusty rose')), [0, 0.04, 0.05]);
    addBox(g, 0.035, H, 0.02, mat(style, tone('light:Seafoam')), [-W / 2, H / 2, 0.05]);
    addBox(g, 0.035, H, 0.02, mat(style, tone('light:Seafoam')), [W / 2, H / 2, 0.05]);
    addBox(g, 0.22, 0.035, 0.016, mat(style, 'light:Butter'), [0, H / 2, 0.06], [0, 0, 0.8]);
    addBox(g, 0.22, 0.035, 0.016, mat(style, 'light:Butter'), [0, H / 2, 0.065], [0, 0, -0.8]);
    addCyl(g, 0.07, 0.05, 0.1, mat(style, 'light:Seafoam'), [-0.28, H / 2 - 0.02, 0.07], { seg: 6 });
    addBox(g, 0.04, 0.08, 0.02, mat(style, 'light:Butter'), [-0.2, H / 2 - 0.02, 0.07]);
    addBox(g, 0.28, 0.045, 0.02, mat(style, tone('light:Dusty rose')), [0.22, H / 2 + 0.06, 0.06], [0, 0, -0.5]);
    addBox(g, 0.28, 0.045, 0.02, mat(style, tone('light:Dusty rose')), [0.22, H / 2 - 0.08, 0.06], [0, 0, 0.5]);
  },
  pendant(g, style) {
    const shade = mat(style, 'paint:Off white');
    const chrome = mat(style, 'metal:Light gray');
    addCyl(g, 0.06, 0.2, 0.16, shade, [0, 0.1, 0], { seg: 6 });
    addCyl(g, 0.2, 0.2, 0.015, chrome, [0, 0.02, 0], { seg: 6 });
    addCyl(g, 0.1, 0.1, 0.012, mat(style, 'light:Butter'), [0, 0.05, 0], { seg: 6 });
    addCyl(g, 0.008, 0.008, 0.78, mat(style, 'darkMetal:Ink'), [0, 0.57, 0], { seg: 4 });
    addCyl(g, 0.05, 0.05, 0.03, chrome, [0, 0.97, 0], { seg: 6 });
  },
  clock(g, style) {
    const chrome = mat(style, 'metal:Light gray');
    const face = mat(style, 'paint:Off white');
    const ink = mat(style, 'darkMetal:Ink');
    addCyl(g, 0.22, 0.22, 0.04, chrome, [0, 0.22, 0.03], { seg: 10, rot: [P / 2, 0, 0] });
    addCyl(g, 0.185, 0.185, 0.012, face, [0, 0.22, 0.052], { seg: 10, rot: [P / 2, 0, 0] });
    addCyl(g, 0.02, 0.02, 0.012, ink, [0, 0.22, 0.062], { seg: 6, rot: [P / 2, 0, 0] });
    // 10:10, so the hands are not a cross. ang 0 points up; positive swings toward -x.
    const hand = (len, ang, z, w) => {
      addBox(g, w, len, 0.006, ink, [-Math.sin(ang) * len / 2, 0.22 + Math.cos(ang) * len / 2, z], [0, 0, ang]);
    };
    hand(0.1, 1.05, 0.066, 0.016);
    hand(0.15, -1.05, 0.072, 0.012);
  },
  poster(g, style) {
    addBox(g, 0.58, 0.74, 0.03, mat(style, 'wood:Walnut'), [0, 0.37, 0.015]);
    addBox(g, 0.48, 0.64, 0.008, mat(style, 'paint:Off white'), [0, 0.37, 0.032]);
    addCyl(g, 0.16, 0.16, 0.012, mat(style, 'paint:Apricot'), [0, 0.38, 0.042], { seg: 8, rot: [P / 2, 0, 0] });
    addBox(g, 0.14, 0.14, 0.01, mat(style, 'paint:Cocoa'), [0.04, 0.42, 0.05], [0, 0, 0.6]);
    addCyl(g, 0.04, 0.04, 0.01, mat(style, 'paint:Dusty rose'), [0.02, 0.4, 0.056], { seg: 6, rot: [P / 2, 0, 0] });
  },
  window_bay(g, style) {
    const frame = mat(style, 'metal:Light gray');
    const mullion = mat(style, 'darkMetal:Charcoal');
    const glass = mat(style, 'glass:Sky');
    const { w, h, d } = WIN;
    const b = 0.07;
    addBox(g, w, b, d, frame, [0, b / 2, 0]);
    addBox(g, w, b, d, frame, [0, h - b / 2, 0]);
    addBox(g, b, h, d, frame, [-w / 2 + b / 2, h / 2, 0]);
    addBox(g, b, h, d, frame, [w / 2 - b / 2, h / 2, 0]);
    addBox(g, 0.04, h - b * 2, d * 0.7, mullion, [0, h / 2, 0]);
    addBox(g, w - b * 2, 0.04, d * 0.7, mullion, [0, h * 0.58, 0]);
    addBox(g, w - b * 2 + 0.02, h - b * 2 + 0.02, 0.012, glass, [0, h / 2, 0]);
    addBox(g, w + 0.06, 0.045, 0.08, frame, [0, 0.02, d / 2 + 0.02]);
  },
  door(g, style) {
    const metal = mat(style, 'metal:Light gray');
    const red = mat(style, tone('paint:Dusty rose'));
    const glass = mat(style, 'glass:Sky');
    const kick = mat(style, 'darkMetal:Charcoal');
    const { w, h, d } = DOOR;
    const jb = 0.07;
    addBox(g, jb, h, d, metal, [-w / 2 + jb / 2, h / 2, 0]);
    addBox(g, jb, h, d, metal, [w / 2 - jb / 2, h / 2, 0]);
    addBox(g, w, jb, d, metal, [0, h - jb / 2, 0]);
    const dw = w - jb * 2;
    addBox(g, dw, 0.78, 0.05, red, [0, 0.39, 0]);
    addBox(g, dw, 0.08, 0.055, red, [0, 0.82, 0]);
    addBox(g, dw - 0.1, 1.1, 0.012, glass, [0, 1.48, 0]);
    addBox(g, 0.045, 1.16, 0.05, metal, [-(dw / 2 - 0.03), 1.48, 0]);
    addBox(g, 0.045, 1.16, 0.05, metal, [dw / 2 - 0.03, 1.48, 0]);
    addBox(g, dw - 0.04, 0.045, 0.05, metal, [0, 2.04, 0]);
    addBox(g, dw - 0.04, 0.045, 0.05, metal, [0, 0.92, 0]);
    addBox(g, dw * 0.62, 0.035, 0.04, metal, [0, 1.05, d / 2 + 0.01]);
    addBox(g, dw * 0.9, 0.18, 0.012, kick, [0, 0.12, d / 2 + 0.005]);
  },
  coat_rack(g, style) {
    const chrome = mat(style, 'metal:Light gray');
    const dark = mat(style, 'darkMetal:Charcoal');
    addCyl(g, 0.18, 0.2, 0.03, dark, [0, 0.015, 0], { seg: 8 });
    addCyl(g, 0.025, 0.028, 1.55, chrome, [0, 0.8, 0], { seg: 6 });
    for (let i = 0; i < 4; i++) {
      const a = i * P / 2 + 0.4;
      addBox(g, 0.1, 0.025, 0.025, chrome, [Math.sin(a) * 0.1, 1.58, Math.cos(a) * 0.1], [0, -a, 0.3]);
    }
    addCyl(g, 0.1, 0.11, 0.04, mat(style, 'cloth:Sand'), [0.02, 1.66, 0], { seg: 8 });
    addCyl(g, 0.16, 0.16, 0.012, mat(style, 'cloth:Cocoa'), [0.02, 1.64, 0], { seg: 8 });
  },
  welcome_mat(g, style) {
    addBox(g, 0.9, 0.012, 0.56, mat(style, tone('cloth:Dusty rose')), [0, 0.006, 0]);
    addBox(g, 0.7, 0.004, 0.08, mat(style, 'paint:Off white'), [0, 0.014, 0]);
  },
};

const LABELS = {
  counter: 'Counter',
  stool: 'Swivel stool',
  booth: 'Booth',
  napkin_dispenser: 'Napkin dispenser',
  ketchup: 'Ketchup',
  mustard: 'Mustard',
  salt_pepper: 'Salt and pepper',
  straw_holder: 'Straw holder',
  cup_stack: 'Stacked cups',
  service_bell: 'Service bell',
  jukebox: 'Jukebox',
  milkshake_mixer: 'Milkshake mixer',
  coffee_maker: 'Coffee maker',
  pie_case: 'Pie case',
  register: 'Cash register',
  soda_fountain: 'Soda fountain',
  grill: 'Flat-top grill',
  work_counter: 'Kitchen counter',
  pass_window: 'Pass window',
  menu_board: 'Menu board',
  neon_sign: 'Neon sign',
  pendant: 'Pendant lamp',
  clock: 'Wall clock',
  poster: 'Pie poster',
  window_bay: 'Front window',
  door: 'Entrance door',
  coat_rack: 'Coat rack',
  welcome_mat: 'Floor mat',
};

// The mat is walked on. The pendant hangs: no footprint on the floor.
const NO_HIT = new Set(['welcome_mat', 'pendant']);

// Wall signs are measured from their back, not their middle.
const BACK = new Set(['menu_board', 'neon_sign', 'clock', 'poster']);

function hitFor(name, footprint) {
  if (NO_HIT.has(name)) return [];
  const [w, d] = footprint;
  if (BACK.has(name)) return [{ z: d / 2, hw: w / 2, hd: d / 2 }];
  return [{ hw: w / 2, hd: d / 2 }];
}

/** One catalogue row per kit item, in manifest order. */
export const DINER_ITEMS = Object.entries(manifest.items).map(([name, item]) => ({
  name,
  id: `diner.${name}`,
  label: LABELS[name] ?? item.label,
  kitGroup: item.group,
  size: item.footprint,
  hit: hitFor(name, item.footprint),
}));

/** A kit item standing on y = 0, facing +z. Geometry is its own (safe to dispose). */
export function buildDinerItem(name, style) {
  const build = BUILDERS[name];
  if (!build) throw new Error(`Unknown diner item "${name}"`);
  const g = new THREE.Group();
  g.name = name;
  build(g, style);
  g.userData.dinerItem = name;
  return g;
}

// Room shell. X is the 12 m frontage, Z the 8 m depth. +z is the street.
const RH = 3;
const BAND = 1.02;
const TH = 0.14;

function splitWall(g, style, { axis, a0, a1, fix, y1, holes, hits, inward }) {
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
      const low = Math.min(yEnd, BAND);
      if (low > y0) put(a, b, y0, low, TH, fix, tone('paint:Seafoam'), true);
      if (yEnd > BAND) put(a, b, Math.max(y0, BAND), yEnd, TH, fix, 'paint:Off white', true);
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
    trim(BAND, 0.035, 'metal:Light gray', BAND - 0.016, BAND + 0.016);
    trim(0.05, 0.028, 'darkMetal:Charcoal', 0, 0.1);
  }
}

/**
 * The whole diner (12 × 8 m). `cutaway` hides the front (+z) and side (+x)
 * walls so the inside reads from the isometric catalogue camera.
 * Meshes are merged per material.
 */
export function buildDinerRoom(style, { cutaway = false, seed = 0 } = {}) {
  const plan = dinerLayout(seed);
  swatchSwap = plan.theme;
  try {
  const body = new THREE.Group();
  const front = new THREE.Group();
  const side = new THREE.Group();
  const hits = [];

  // 1 m squares: a diner checker that stays inside the room's triangle budget.
  const tile = TILE_TOP - SLAB_TOP;
  for (let i = 0; i < 12; i++) {
    for (let j = 0; j < 8; j++) {
      addBox(body, 1, tile, 1, mat(style, (i + j) % 2 ? 'concrete:Ink' : 'concrete:Off white'),
        [-6 + (i + 0.5), (SLAB_TOP + TILE_TOP) / 2, -4 + (j + 0.5)]);
    }
  }
  addBox(body, 12, 0.22, 8, mat(style, 'concrete:Gray'), [0, SLAB_TOP - 0.11, 0]);

  const winHoles = (spans, y0) => spans.map(([a0, a1]) => ({
    a0: a0 + LIP, a1: a1 - LIP, y0: y0 + LIP, y1: y0 + WIN.h - LIP,
  }));
  const frontWins = [[-5.52, -3.32], [-3.12, -0.92], [-0.72, 1.48], [1.68, 3.88]];
  const doorHole = [4.08, 5.22];
  const frontHoles = [
    ...winHoles(frontWins, 0.9),
    { a0: doorHole[0], a1: doorHole[1], y0: 0, y1: 2.16 },
  ];
  const sideWins = [[-2.55, -0.35], [0.55, 2.75]];
  const sideHoles = winHoles(sideWins, 0.9);

  splitWall(body, style, { axis: 'x', a0: -6, a1: 6, fix: -3.93, y1: RH, holes: [], hits, inward: 1 });
  splitWall(body, style, { axis: 'z', a0: -4, a1: 4, fix: -5.93, y1: RH, holes: [], hits, inward: 1 });
  splitWall(front, style, { axis: 'x', a0: -6, a1: 6, fix: 3.93, y1: RH, holes: frontHoles, hits: cutaway ? null : hits, inward: -1 });
  splitWall(side, style, { axis: 'z', a0: -4, a1: 4, fix: 5.93, y1: RH, holes: sideHoles, hits: cutaway ? null : hits, inward: -1 });

  // Steel backsplash over the kitchen line.
  addBox(body, 9.8, 0.62, 0.02, mat(style, 'metal:Light gray'), [0, 1.24, -3.84]);

  const placeItem = (group, name, x, y, z, rotY) => {
    const item = buildDinerItem(name, style);
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
    const item = buildDinerItem(p.item, style);
    item.position.set(p.x, p.y + TILE_TOP, p.z);
    item.rotation.y = p.rotY || 0;
    body.add(item);
    if (p.y < 0.05 && !NO_HIT.has(p.item)) {
      const [w, d] = manifest.items[p.item].footprint;
      const c = Math.abs(Math.cos(p.rotY || 0));
      const s = Math.abs(Math.sin(p.rotY || 0));
      const hx = (w / 2) * c + (d / 2) * s;
      const hz = (w / 2) * s + (d / 2) * c;
      // Back-mounted signs sit on a wall that already blocks the walk.
      if (!BACK.has(p.item)) hits.push({ x: p.x, z: p.z, hw: hx, hd: hz });
    }
  }

  const room = new THREE.Group();
  room.name = 'tiny_diner';
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
  room.userData.seed = plan.seed;
  return { group: room, colliders: hits };
  } finally {
    swatchSwap = null;
  }
}
