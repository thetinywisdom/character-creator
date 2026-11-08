import * as THREE from 'three';
import { signTexture } from '../lib/textures.js';
import { box, cyl, face } from '../props/util.js';
import { FLOOR, WALLS, gable, windowRow } from './buildings.js';
import { interiorPanel, shopWindow } from './interiors.js';

// Individual shops, each with its own shape and details rather than only a
// different sign. Every builder fills a lot of width w (x) and depth d (z),
// stands on y = 0, is centred on the lot and faces +z (the street), and
// returns { group, footprint, colliders }. Things set out on the pavement
// (tables, flower buckets, fish trays) sit in the strip in front of the shop.

const pick = (rng, arr) => arr[Math.floor(rng() * arr.length)];
const hex = (s) => parseInt(s.slice(1), 16);

// --- shared pieces --------------------------------------------------------------

/** The shop's box: body w × h × bd at the back of the lot. Returns its front z. */
export function body(g, style, w, d, h, wallHex, { depth = 10 } = {}) {
  const bw = w - 0.4, bd = Math.min(d - 2.2, depth);
  const bz = -d / 2 + bd / 2 + 0.3;
  g.add(box(bw, h, bd, style.material('building', wallHex), [0, h / 2, bz]));
  return { bw, bd, bz, front: bz + bd / 2 };
}

/** A lit signboard across the front at height y. */
export function signboard(g, style, text, bg, fg, w, y, z, h = 0.7) {
  const tex = signTexture({ lines: [text], bg, fg, w: 128, h: 32 });
  g.add(box(w, h, 0.2, style.material('signage', hex(bg)), [0, y, z + 0.1]));
  g.add(face(w * 0.98, h * 0.94, style.material('light', 0xffffff, tex), [0, y, z + 0.21]));
}

/** A small sign sticking out from the wall (seen from along the street). */
export function projectingSign(g, style, text, bg, fg, x, y, z, { round = false } = {}) {
  const tex = signTexture({ lines: [text], bg, fg, w: 64, h: 64, shape: round ? 'circle' : 'rect' });
  const s = new THREE.Group();
  s.add(box(0.05, 0.05, 0.5, style.material('darkMetal'), [0, 0.42, -0.25]));
  if (round) {
    const d = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 0.08, 16), style.material('signage', hex(bg)));
    d.rotation.z = Math.PI / 2;
    s.add(d);
  } else s.add(box(0.08, 0.8, 0.8, style.material('signage', hex(bg))));
  for (const sx of [1, -1]) {
    const f = face(0.72, 0.72, style.material('light', 0xffffff, tex), [sx * 0.05, 0, 0]);
    f.rotation.y = sx * Math.PI / 2;
    s.add(f);
  }
  s.position.set(x, y, z + 0.5);
  g.add(s);
}

/** A striped awning sloping out over the front. */
export function awning(g, style, colors, w, y, z, depth = 1.2) {
  const n = 8;
  for (let i = 0; i < n; i++) {
    g.add(box(w / n, 0.06, depth, style.material('signage', colors[i % colors.length]),
      [-w / 2 + (i + 0.5) * (w / n), y, z + depth / 2 - 0.05], [0.3, 0, 0]));
  }
}

/** Noren: cloth strips hanging over a door, with an optional word on them. */
export function noren(g, style, x, y, z, colorHex, text, fg = '#ffffff') {
  const n = 3, w = 0.36;
  const tex = text ? signTexture({ lines: [text], bg: `#${colorHex.toString(16).padStart(6, '0')}`, fg, w: 96, h: 48 }) : null;
  for (let i = 0; i < n; i++) {
    g.add(box(w - 0.03, 0.75, 0.02, style.material('signage', colorHex), [x + (i - 1) * w, y, z]));
  }
  if (tex) g.add(face(w * n - 0.06, 0.5, style.material('light', 0xffffff, tex), [x, y + 0.08, z + 0.015]));
}

/** Upper floors of a shop house: a wall band with a row of windows per floor. */
export function upperFloors(g, style, bw, from, floors, front) {
  for (let f = 0; f < floors; f++) windowRow(g, style, bw, from + f * FLOOR + 1.6, front + 0.01, { spacing: 2.4, ww: 1.3, wh: 1.2 });
}

/** An opening in the front: a dark interior box behind a frame, so the inside shows. */
export function openFront(g, style, w, h, z, { frame = 0x3a3a40, interior = 0x4a4c52, mullions = 3, inside = null } = {}) {
  const depth = 2.4;
  g.add(box(w, h, depth, style.material('concrete', interior), [0, h / 2 + 0.05, z - depth / 2 - 0.02]));
  // the painted inside on the back wall of the opening
  if (inside) g.add(interiorPanel(style, inside, w - 0.1, h - 0.1, 0, h / 2 + 0.05, z - depth + 0.01));
  const fm = style.material('darkMetal', frame);
  g.add(box(w + 0.1, 0.12, 0.12, fm, [0, h + 0.06, z]));
  for (let i = 0; i <= mullions; i++) g.add(box(0.08, h, 0.08, fm, [-w / 2 + (i * w) / mullions, h / 2, z]));
  return { depth };
}

export const solid = (bw, bd, bz) => ({ x: 0, z: bz, hw: bw / 2, hd: bd / 2 });

// --- 1. Coin laundromat (コインランドリー) ---------------------------------------
/** A single-storey laundromat: an open glass front onto a bright room with washers along the back, dryers stacked at one end, a bench. */
export function laundromat(style, rng, w, d) {
  const g = new THREE.Group();
  const H = 3.6, room = 2.6;
  const wallM = style.material('building', 0xf2f2ee);
  const bw = w - 0.4, bd = Math.min(d - 2.2, 9);
  const bz = -d / 2 + bd / 2 + 0.3, front = bz + bd / 2;
  const roomZ = front - room; // back wall of the room
  g.add(box(bw, H, bd - room, wallM, [0, H / 2, bz - room / 2]));                // the closed back part
  g.add(box(bw, 0.3, room, wallM, [0, H - 0.15, front - room / 2]));            // ceiling
  for (const sx of [-1, 1]) g.add(box(0.2, H, room, wallM, [sx * (bw / 2 - 0.1), H / 2, front - room / 2]));
  g.add(box(bw - 0.4, 0.04, room, style.material('concrete', 0xd8dde2), [0, 0.02, front - room / 2]));
  // washers along the back wall (white, dark round doors); dryers stacked at one end
  const white = style.material('metal', 0xf4f4f0), door = style.material('glass', 0x2c3a48);
  const n = Math.max(2, Math.floor((bw - 1.6) / 0.85));
  for (let i = 0; i < n; i++) {
    const x = -((n - 1) * 0.85) / 2 + i * 0.85;
    const stacked = i < 2;
    const h = stacked ? 1.9 : 1.0;
    g.add(box(0.78, h, 0.7, white, [x, h / 2, roomZ + 0.36]));
    for (const yy of stacked ? [0.5, 1.45] : [0.55]) {
      const c = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.04, 14), door);
      c.rotation.x = Math.PI / 2;
      c.position.set(x, yy, roomZ + 0.72);
      g.add(c);
    }
  }
  // a bench by the window
  g.add(box(1.4, 0.08, 0.4, style.material('wood', 0x8a6a48), [bw / 2 - 1.2, 0.45, front - 0.5]));
  g.add(box(1.4, 0.45, 0.06, style.material('darkMetal'), [bw / 2 - 1.2, 0.22, front - 0.5]));
  // the window frame across the front, and signs
  const fm = style.material('darkMetal', 0x3a3a40);
  const oh = H - 0.9, mull = Math.max(2, Math.round(bw / 2.5));
  g.add(box(bw - 0.3, 0.12, 0.12, fm, [0, oh, front]));
  for (let i = 0; i <= mull; i++) g.add(box(0.08, oh, 0.08, fm, [-(bw - 0.4) / 2 + (i * (bw - 0.4)) / mull, oh / 2, front]));
  signboard(g, style, 'コインランドリー', '#1f6fd0', '#ffffff', bw * 0.92, H - 0.45, front);
  projectingSign(g, style, '24h', '#ffffff', '#1f6fd0', bw / 2 - 0.2, H - 1.4, front - 0.4, { round: true });
  return { group: g, footprint: { w: bw, d: bd, z: bz }, colliders: [solid(bw, bd, bz)] };
}

// --- 2. Café (喫茶店) ------------------------------------------------------------
/** A retro two-storey kissaten: dark wooden front with small-paned windows, a striped awning, a round coffee sign, a table outside. */
export function kissaten(style, rng, w, d) {
  const g = new THREE.Group();
  const H = FLOOR * 2 + 0.4;
  const upper = pick(rng, [0xe8dcc6, 0xd8c3a5, 0xe6d2c8]);
  const { bw, bd, bz, front } = body(g, style, w, d, H, upper, { depth: 9 });
  // wooden ground floor front with small window panes
  const wood = style.material('wood', 0x5a3a28);
  g.add(box(bw, FLOOR, 0.2, wood, [0, FLOOR / 2, front + 0.05]));
  const winW = Math.min(bw * 0.5, 3.4);
  shopWindow(g, style, 'cafe', winW, 1.5, -bw * 0.18, 1.55, front + 0.19, { mullions: 4, frame: 0x3a2418 });
  g.add(box(0.95, 2.1, 0.06, style.material('glass', 0x8a6a48), [bw * 0.28, 1.05, front + 0.16])); // door
  awning(g, style, [0x6a3e24, 0xf2e6cc], bw * 0.9, 2.85, front + 0.15, 1.0);
  signboard(g, style, '喫茶', '#3a2418', '#f2e6cc', bw * 0.6, FLOOR + 0.5, front + 0.05, 0.6);
  projectingSign(g, style, 'COFFEE', '#f2e6cc', '#5a3a28', bw / 2 - 0.1, FLOOR + 1.3, front - 0.4, { round: true });
  upperFloors(g, style, bw, FLOOR, 1, front);
  // a little table and two chairs outside
  const metal = style.material('darkMetal', 0x2a2a30);
  const tz = front + 1.2, tx = -bw * 0.18;
  g.add(cyl(0.3, 0.3, 0.04, style.material('wood', 0xe8dcc6), [tx, 0.74, tz], { segments: 12 }));
  g.add(cyl(0.03, 0.03, 0.72, metal, [tx, 0.36, tz], { segments: 6 }));
  for (const sx of [-1, 1]) {
    g.add(box(0.36, 0.04, 0.36, metal, [tx + sx * 0.55, 0.45, tz]));
    g.add(box(0.04, 0.45, 0.36, metal, [tx + sx * 0.72, 0.68, tz]));
    for (const k of [-1, 1]) g.add(box(0.03, 0.45, 0.03, metal, [tx + sx * 0.55 + k * 0.15, 0.22, tz]));
  }
  return { group: g, footprint: { w: bw, d: bd, z: bz }, colliders: [solid(bw, bd, bz), { x: tx, z: tz, hw: 0.9, hd: 0.35 }] };
}

// --- 3. Pharmacy (薬局) ----------------------------------------------------------
/** A bright drugstore: wide glass front, a green cross, shelves of goods out on the pavement with yellow price tags. */
export function pharmacy(style, rng, w, d) {
  const g = new THREE.Group();
  const H = 4.4;
  const { bw, bd, bz, front } = body(g, style, w, d, H, 0xf6f6f2, { depth: 10 });
  shopWindow(g, style, 'drugstore', bw * 0.86, 2.4, 0, 1.3, front + 0.04);
  g.add(box(1.6, 2.3, 0.08, style.material('window'), [bw * 0.28, 1.15, front + 0.05])); // automatic doors
  signboard(g, style, '薬局 ドラッグ', '#2fa36b', '#ffffff', bw * 0.94, H - 0.75, front, 0.9);
  // a lit green cross on the corner
  const cross = style.material('light', 0x37c26a);
  const c = new THREE.Group();
  c.add(box(0.7, 0.22, 0.12, cross), box(0.22, 0.7, 0.12, cross));
  c.position.set(-bw / 2 + 0.6, H - 1.7, front + 0.2);
  g.add(c);
  // shelves of goods out front, with yellow price cards
  const shelf = style.material('metal', 0xd8d8d0);
  const goods = [0xd8443c, 0x3f7fd6, 0xf2f2ee, 0x3fa65a, 0xf28cb8, 0xf2c230];
  const sw = Math.min(bw * 0.36, 2.4), sz = front + 0.5;
  for (const sx of [-1]) {
    const x = sx * (bw / 2 - sw / 2 - 0.3);
    for (let lvl = 0; lvl < 3; lvl++) {
      const y = 0.25 + lvl * 0.42;
      g.add(box(sw, 0.04, 0.5 - lvl * 0.08, shelf, [x, y, sz - lvl * 0.04]));
      for (let k = 0; k < 6; k++) {
        g.add(box(sw / 7, 0.24, 0.22, style.material('signage', goods[Math.floor(rng() * goods.length)]), [x - sw / 2 + (k + 0.5) * (sw / 6), y + 0.14, sz - lvl * 0.04]));
      }
      g.add(box(sw, 0.1, 0.02, style.material('signage', 0xf2c230), [x, y - 0.04, sz + 0.24 - lvl * 0.04]));
    }
  }
  return { group: g, footprint: { w: bw, d: bd, z: bz }, colliders: [solid(bw, bd, bz), { x: -(bw / 2 - sw / 2 - 0.3), z: sz, hw: sw / 2, hd: 0.3 }] };
}

// --- 4. Sushi restaurant (寿司) --------------------------------------------------
/** A two-storey sushi shop: dark wooden front, a tiled eave, a lattice sliding door, a noren with すし, a fish sign. */
export function sushi(style, rng, w, d) {
  const g = new THREE.Group();
  const H = FLOOR * 2 + 0.4;
  const { bw, bd, bz, front } = body(g, style, w, d, H, pick(rng, [0xe8dcc6, 0xd8c3a5]), { depth: 9 });
  const wood = style.material('wood', 0x4a3020);
  g.add(box(bw, FLOOR, 0.2, wood, [0, FLOOR / 2, front + 0.05]));
  // lattice sliding door (格子戸) and a small window with bamboo blind
  const light = style.material('wood', 0xc9a978);
  const dx = bw * 0.15;
  g.add(box(1.5, 2.1, 0.06, style.material('glass', 0xe8d8a8), [dx, 1.05, front + 0.16]));
  for (let i = 0; i < 6; i++) g.add(box(0.04, 2.1, 0.08, light, [dx - 0.75 + (i + 0.5) * 0.25, 1.05, front + 0.19]));
  shopWindow(g, style, 'sushi', 1.4, 0.9, -bw * 0.25, 1.4, front + 0.19, { mullions: 2, frame: 0x3a2418 });
  // a short tiled eave (庇) across the front
  const eave = gable(bw + 0.4, 1.6, 0.35, style.material('roof', 0x3a3f44));
  eave.position.set(0, FLOOR - 0.15, front + 0.2);
  g.add(eave);
  noren(g, style, dx, 1.75, front + 0.32, 0x2c3652, 'すし');
  signboard(g, style, '寿司', '#f4ecd8', '#2a2018', Math.min(bw * 0.5, 3), FLOOR + 0.55, front + 0.05, 0.7);
  // a fish on the sign: a flattened body and a tail
  const fish = new THREE.Group();
  const scale = style.material('signage', 0xd8443c);
  const fb = new THREE.Mesh(new THREE.SphereGeometry(0.32, 8, 6), scale);
  fb.scale.set(1.4, 0.6, 0.25);
  const tail = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.3, 3), scale);
  tail.rotation.z = Math.PI / 2;
  tail.position.x = 0.58;
  fish.add(fb, tail);
  fish.position.set(Math.min(bw * 0.25, 1.5) + 0.7, FLOOR + 0.55, front + 0.3);
  g.add(fish);
  upperFloors(g, style, bw, FLOOR, 1, front);
  // a potted bamboo by the door
  g.add(cyl(0.22, 0.18, 0.4, style.material('concrete', 0x6a6a64), [dx + 1.1, 0.2, front + 0.4], { segments: 8 }));
  for (let i = 0; i < 4; i++) g.add(cyl(0.025, 0.025, 1.6 + i * 0.15, style.material('leaf', 0x5c8a3a), [dx + 1.05 + (i % 2) * 0.1, 1.0, front + 0.35 + (i > 1 ? 0.1 : 0)], { segments: 5 }));
  return { group: g, footprint: { w: bw, d: bd, z: bz }, colliders: [solid(bw, bd, bz)] };
}

// --- 5. Flower shop (花屋) -------------------------------------------------------
/** An open-fronted flower shop under a green awning, with tiered stands of flower buckets out on the pavement. */
export function florist(style, rng, w, d) {
  const g = new THREE.Group();
  const H = FLOOR * 2 + 0.4;
  const { bw, bd, bz, front } = body(g, style, w, d, H, pick(rng, [0xf0efe8, 0xe6d2c8, 0xe8dcc6]), { depth: 9 });
  openFront(g, style, bw * 0.84, 2.6, front + 0.01, { interior: 0x6a7a5a, mullions: 2, inside: 'florist' });
  awning(g, style, [0x3fa65a, 0xf2f2ee], bw * 0.92, 2.9, front + 0.1, 1.2);
  signboard(g, style, 'Flower 花', '#2f7d4f', '#ffffff', bw * 0.7, FLOOR + 0.55, front, 0.7);
  upperFloors(g, style, bw, FLOOR, 1, front);
  // tiered stands of buckets with flowers, out front
  const colours = [0xd8443c, 0xf2c230, 0xf28cb8, 0xf4f4f0, 0x8a55c9, 0xf08a2c];
  const stand = style.material('wood', 0x8a6a48);
  const bucket = style.material('metal', 0x9aa0a6);
  const leaf = style.material('leaf');
  const sw = Math.min(bw * 0.8, 6);
  for (let tier = 0; tier < 3; tier++) {
    const y = 0.15 + tier * 0.3, z = front + 1.0 - tier * 0.3;
    g.add(box(sw, 0.05, 0.32, stand, [0, y, z]));
    const n = Math.floor(sw / 0.42);
    for (let k = 0; k < n; k++) {
      const x = -sw / 2 + (k + 0.5) * (sw / n);
      g.add(cyl(0.13, 0.1, 0.24, bucket, [x, y + 0.14, z], { segments: 8 }));
      g.add(new THREE.Mesh(new THREE.SphereGeometry(0.12, 6, 4), leaf).translateX(x).translateY(y + 0.32).translateZ(z));
      const c = style.material('signage', colours[Math.floor(rng() * colours.length)]);
      for (let j = 0; j < 3; j++) g.add(new THREE.Mesh(new THREE.SphereGeometry(0.06, 5, 4), c).translateX(x + (j - 1) * 0.06).translateY(y + 0.42 + (j % 2) * 0.04).translateZ(z + (j - 1) * 0.03));
    }
  }
  for (const sx of [-1, 1]) g.add(box(0.05, 0.75, 0.05, stand, [sx * sw / 2, 0.37, front + 0.7]));
  return { group: g, footprint: { w: bw, d: bd, z: bz }, colliders: [solid(bw, bd, bz), { x: 0, z: front + 0.7, hw: sw / 2, hd: 0.5 }] };
}

// --- 7. Fishmonger (鮮魚) ---------------------------------------------------------
/** An open fish shop: a blue-and-white awning, a sloping table of ice and fish, stacked white boxes, hanging bulbs. */
export function fishmonger(style, rng, w, d) {
  const g = new THREE.Group();
  const H = FLOOR * 2 + 0.4;
  const { bw, bd, bz, front } = body(g, style, w, d, H, pick(rng, [0xd8d4c8, 0xc9c4b8, 0xe8dcc6]), { depth: 9 });
  openFront(g, style, bw * 0.88, 2.7, front + 0.01, { interior: 0x5a6068, mullions: 2, inside: 'fish' });
  awning(g, style, [0x1f6fd0, 0xf2f2ee], bw * 0.94, 2.95, front + 0.1, 1.3);
  signboard(g, style, '鮮魚 さかな', '#1f4fa8', '#ffffff', bw * 0.8, FLOOR + 0.55, front, 0.75);
  upperFloors(g, style, bw, FLOOR, 1, front);
  // the sloping display table: ice, with rows of fish on it
  const tw = Math.min(bw * 0.8, 6), tz = front + 0.7;
  g.add(box(tw, 0.8, 1.0, style.material('metal', 0xb8bcc0), [0, 0.4, tz]));
  const ice = box(tw - 0.1, 0.08, 1.1, style.material('signage', 0xeef4f8), [0, 0.86, tz], [0.25, 0, 0]);
  g.add(ice);
  const fishCols = [0x8a99a8, 0x6f8090, 0xd8443c, 0xc9b28a];
  for (let row = 0; row < 3; row++) {
    for (let k = 0; k < Math.floor(tw / 0.42); k++) {
      const f = new THREE.Mesh(new THREE.SphereGeometry(0.16, 6, 4), style.material('signage', fishCols[(row + k) % fishCols.length]));
      f.scale.set(1.3, 0.35, 0.5);
      f.position.set(-tw / 2 + 0.25 + k * 0.42, 0.84 + (1 - row) * 0.12, tz - 0.3 + row * 0.3);
      g.add(f);
    }
  }
  // stacked white boxes (styrofoam) to one side, and bulbs hanging from the awning
  for (let i = 0; i < 3; i++) g.add(box(0.6, 0.3, 0.4, style.material('signage', 0xf6f6f2), [bw / 2 - 0.5, 0.15 + i * 0.31, front + 0.4]));
  for (let i = 0; i < 3; i++) {
    const x = -tw / 2 + (i + 0.5) * (tw / 3);
    g.add(box(0.01, 0.5, 0.01, style.material('darkMetal'), [x, 2.55, tz]));
    g.add(new THREE.Mesh(new THREE.SphereGeometry(0.08, 6, 4), style.material('light', 0xffe6a0)).translateX(x).translateY(2.27).translateZ(tz));
  }
  return { group: g, footprint: { w: bw, d: bd, z: bz }, colliders: [solid(bw, bd, bz), { x: 0, z: tz, hw: tw / 2, hd: 0.55 }] };
}

/** The shops above, for the catalogue: id -> [builder, label, typical lot width, depth]. */
export const SHOP_BUILDINGS = {
  laundromat: [laundromat, 'Coin laundromat', 9, 12],
  kissaten: [kissaten, 'Café (kissaten)', 8, 12],
  pharmacy: [pharmacy, 'Pharmacy', 11, 12],
  sushi: [sushi, 'Sushi restaurant', 9, 12],
  florist: [florist, 'Flower shop', 8, 12],
  fishmonger: [fishmonger, 'Fishmonger', 9, 12],
};
