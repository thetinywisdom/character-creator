import * as THREE from 'three';
import { signTexture } from '../lib/textures.js';
import { box, cyl, face } from '../props/util.js';
import { FLOOR, WALLS, gable, windowRow } from './buildings.js';
import { between, chance, flatsAbove, frontExtras, roofTop, side } from './variety.js';
import { paperLantern } from '../props/japan.js';
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

// Every builder draws its look from rng (variety.js): floors of flats above,
// roof, which side the door / display goes, colours, awnings and things out
// front, so each seed is a different building of the same kind.

// --- 1. Coin laundromat (コインランドリー) ---------------------------------------
/** A laundromat: an open glass front onto a bright room with washers along the back, dryers stacked at one end, a bench; sometimes flats above. */
export function laundromat(style, rng, w, d) {
  const g = new THREE.Group();
  const s = side(rng);
  const floors = pick(rng, [0, 0, 1, 2, 3]);
  const G = 3.6, room = 2.6, H = G + floors * FLOOR;
  const wallM = style.material('building', floors ? pick(rng, WALLS) : pick(rng, [0xf2f2ee, 0xe8e6e0, 0xdfe6ec]));
  const bw = w - 0.4, bd = Math.min(d - 2.2, 7 + rng() * 3);
  const bz = -d / 2 + bd / 2 + 0.3, front = bz + bd / 2;
  const roomZ = front - room; // back wall of the room
  g.add(box(bw, G, bd - room, wallM, [0, G / 2, bz - room / 2]));                // the closed back part
  g.add(box(bw, 0.3, room, wallM, [0, G - 0.15, front - room / 2]));            // ceiling
  for (const sx of [-1, 1]) g.add(box(0.2, G, room, wallM, [sx * (bw / 2 - 0.1), G / 2, front - room / 2]));
  if (floors) g.add(box(bw, H - G, bd, wallM, [0, G + (H - G) / 2, bz]));
  g.add(box(bw - 0.4, 0.04, room, style.material('concrete', 0xd8dde2), [0, 0.02, front - room / 2]));
  // washers along the back wall; dryers stacked at one end (either end)
  const white = style.material('metal', pick(rng, [0xf4f4f0, 0xe8ecf0, 0xf0e8d8])), door = style.material('glass', 0x2c3a48);
  const n = Math.max(2, Math.floor((bw - 1.6) / 0.85));
  const dryers = between(rng, 1, 3);
  for (let i = 0; i < n; i++) {
    const x = s * (-((n - 1) * 0.85) / 2 + i * 0.85);
    const stacked = i < dryers;
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
  const bx = -s * (bw / 2 - 1.2);
  g.add(box(1.4, 0.08, 0.4, style.material('wood', 0x8a6a48), [bx, 0.45, front - 0.5]));
  g.add(box(1.4, 0.45, 0.06, style.material('darkMetal'), [bx, 0.22, front - 0.5]));
  // the window frame across the front, and signs (one of a few colour schemes)
  const fm = style.material('darkMetal', 0x3a3a40);
  const oh = G - 0.9, mull = Math.max(2, Math.round(bw / 2.5));
  g.add(box(bw - 0.3, 0.12, 0.12, fm, [0, oh, front]));
  for (let i = 0; i <= mull; i++) g.add(box(0.08, oh, 0.08, fm, [-(bw - 0.4) / 2 + (i * (bw - 0.4)) / mull, oh / 2, front]));
  const [bg, fg] = pick(rng, [['#1f6fd0', '#ffffff'], ['#2fa36b', '#ffffff'], ['#f08a2c', '#ffffff'], ['#ffffff', '#1f6fd0']]);
  signboard(g, style, 'コインランドリー', bg, fg, bw * 0.92, G - 0.45, front);
  projectingSign(g, style, '24h', fg === '#ffffff' ? '#ffffff' : '#1f6fd0', fg === '#ffffff' ? bg : '#ffffff', -s * (bw / 2 - 0.2), G - 1.4, front - 0.4, { round: true });
  flatsAbove(g, style, rng, bw, bd, bz, front, G, floors);
  roofTop(g, style, rng, bw, bd, bz, H, { pitched: floors ? 0.35 : 0 });
  const extras = frontExtras(g, style, rng, bw, front, { kinds: ['bike', 'bike', 'vending', 'planter'] });
  return { group: g, footprint: { w: bw, d: bd, z: bz }, colliders: [solid(bw, bd, bz), ...extras] };
}

// --- 2. Café (喫茶店) ------------------------------------------------------------
/** A retro kissaten: a wooden or tiled ground floor with small-paned windows, an awning, a round coffee sign, a table outside; 1–3 floors above. */
export function kissaten(style, rng, w, d) {
  const g = new THREE.Group();
  const s = side(rng);
  const floors = between(rng, 1, 3);
  const H = FLOOR * (1 + floors) + 0.4;
  const { bw, bd, bz, front } = body(g, style, w, d, H, pick(rng, [0xe8dcc6, 0xd8c3a5, 0xe6d2c8, 0xc9c4b8, 0xb9a48a]), { depth: 7 + rng() * 3 });
  // ground floor: dark wood, red brick or green tiles
  const groundM = style.material('wood', pick(rng, [0x5a3a28, 0x3a2418, 0x8a3a2a, 0x2f5a4a]));
  g.add(box(bw, FLOOR, 0.2, groundM, [0, FLOOR / 2, front + 0.05]));
  const winW = Math.min(bw * 0.5, 3.4);
  shopWindow(g, style, 'cafe', winW, 1.5, -s * bw * 0.18, 1.55, front + 0.19, { mullions: between(rng, 3, 5), frame: 0x3a2418 });
  g.add(box(0.95, 2.1, 0.06, style.material('glass', 0x8a6a48), [s * bw * 0.28, 1.05, front + 0.16])); // door
  if (chance(rng, 0.75)) awning(g, style, pick(rng, [[0x6a3e24, 0xf2e6cc], [0x2f6a4a, 0xf2e6cc], [0xa83a2a, 0xf2e6cc], [0x2c3652, 0xf2e6cc]]), bw * 0.9, 2.85, front + 0.15, 1.0);
  const name = pick(rng, ['喫茶', '珈琲', 'COFFEE', '喫茶 ポプラ']);
  signboard(g, style, name, '#3a2418', '#f2e6cc', bw * pick(rng, [0.5, 0.6, 0.8]), FLOOR + 0.5, front + 0.05, 0.6);
  projectingSign(g, style, 'COFFEE', '#f2e6cc', '#5a3a28', s * (bw / 2 - 0.1), FLOOR + 1.3, front - 0.4, { round: chance(rng, 0.6) });
  flatsAbove(g, style, rng, bw, bd, bz, front, FLOOR, floors);
  roofTop(g, style, rng, bw, bd, bz, H, { pitched: 0.4 });
  // a little table and two chairs outside (or a menu board)
  const colliders = [solid(bw, bd, bz)];
  const tx = -s * bw * 0.18, tz = front + 1.2;
  if (chance(rng, 0.65)) {
    const metal = style.material('darkMetal', 0x2a2a30);
    g.add(cyl(0.3, 0.3, 0.04, style.material('wood', 0xe8dcc6), [tx, 0.74, tz], { segments: 12 }));
    g.add(cyl(0.03, 0.03, 0.72, metal, [tx, 0.36, tz], { segments: 6 }));
    for (const sx of [-1, 1]) {
      g.add(box(0.36, 0.04, 0.36, metal, [tx + sx * 0.55, 0.45, tz]));
      g.add(box(0.04, 0.45, 0.36, metal, [tx + sx * 0.72, 0.68, tz]));
      for (const k of [-1, 1]) g.add(box(0.03, 0.45, 0.03, metal, [tx + sx * 0.55 + k * 0.15, 0.22, tz]));
    }
    colliders.push({ x: tx, z: tz, hw: 0.9, hd: 0.35 });
  } else colliders.push(...frontExtras(g, style, rng, bw, front, { kinds: ['board', 'planter'], max: 2, keepClear: [[s * bw * 0.28 - 0.6, s * bw * 0.28 + 0.6]] }));
  return { group: g, footprint: { w: bw, d: bd, z: bz }, colliders };
}

// --- 3. Pharmacy (薬局) ----------------------------------------------------------
/** A drugstore: wide glass front, a lit green cross, shelves of goods out front; single storey, or flats above. */
export function pharmacy(style, rng, w, d) {
  const g = new THREE.Group();
  const s = side(rng);
  const floors = pick(rng, [0, 0, 1, 2]);
  const G = 4.4, H = G + floors * FLOOR;
  const { bw, bd, bz, front } = body(g, style, w, d, H, floors ? pick(rng, WALLS) : pick(rng, [0xf6f6f2, 0xeef2ee, 0xf2eee4]), { depth: 8 + rng() * 2 });
  shopWindow(g, style, 'drugstore', bw * 0.86, 2.4, 0, 1.3, front + 0.04);
  g.add(box(1.6, 2.3, 0.08, style.material('window'), [s * bw * 0.28, 1.15, front + 0.05])); // automatic doors
  const [bg, name] = pick(rng, [['#2fa36b', '薬局 ドラッグ'], ['#1f6fd0', 'ドラッグストア'], ['#e8609a', '薬 くすり'], ['#f08a2c', '薬局']]);
  signboard(g, style, name, bg, '#ffffff', bw * 0.94, G - 0.75, front, 0.9);
  // a lit green cross on the corner
  const cross = style.material('light', 0x37c26a);
  const c = new THREE.Group();
  c.add(box(0.7, 0.22, 0.12, cross), box(0.22, 0.7, 0.12, cross));
  c.position.set(-s * (bw / 2 - 0.6), G - 1.7, front + 0.2);
  g.add(c);
  flatsAbove(g, style, rng, bw, bd, bz, front, G, floors);
  roofTop(g, style, rng, bw, bd, bz, H, { pitched: floors ? 0.3 : 0 });
  // shelves of goods out front (one or two stands), with yellow price cards
  const shelf = style.material('metal', 0xd8d8d0);
  const goods = [0xd8443c, 0x3f7fd6, 0xf2f2ee, 0x3fa65a, 0xf28cb8, 0xf2c230];
  const sw = Math.min(bw * 0.3, 2.4), sz = front + 0.5;
  const colliders = [solid(bw, bd, bz)];
  const stands = bw > 9 && chance(rng, 0.5) ? [-s, 0] : [-s];
  for (const sx of stands) {
    const x = sx === 0 ? -s * 0.2 * bw + s * 0.2 : sx * (bw / 2 - sw / 2 - 0.3);
    for (let lvl = 0; lvl < 3; lvl++) {
      const y = 0.25 + lvl * 0.42;
      g.add(box(sw, 0.04, 0.5 - lvl * 0.08, shelf, [x, y, sz - lvl * 0.04]));
      for (let k = 0; k < 6; k++) {
        g.add(box(sw / 7, 0.24, 0.22, style.material('signage', goods[Math.floor(rng() * goods.length)]), [x - sw / 2 + (k + 0.5) * (sw / 6), y + 0.14, sz - lvl * 0.04]));
      }
      g.add(box(sw, 0.1, 0.02, style.material('signage', 0xf2c230), [x, y - 0.04, sz + 0.24 - lvl * 0.04]));
    }
    colliders.push({ x, z: sz, hw: sw / 2, hd: 0.3 });
  }
  return { group: g, footprint: { w: bw, d: bd, z: bz }, colliders };
}

// --- 4. Sushi restaurant (寿司) --------------------------------------------------
/** A sushi shop: dark wooden front, a tiled eave, a lattice sliding door, a noren, a fish sign; 1–2 floors above. */
export function sushi(style, rng, w, d) {
  const g = new THREE.Group();
  const s = side(rng);
  const floors = between(rng, 1, 2);
  const H = FLOOR * (1 + floors) + 0.4;
  const { bw, bd, bz, front } = body(g, style, w, d, H, pick(rng, [0xe8dcc6, 0xd8c3a5, 0xc9c4b8, 0xa89a88]), { depth: 7 + rng() * 3 });
  const wood = style.material('wood', pick(rng, [0x4a3020, 0x2e241c, 0x6a4429]));
  g.add(box(bw, FLOOR, 0.2, wood, [0, FLOOR / 2, front + 0.05]));
  // lattice sliding door (格子戸) and a small window
  const light = style.material('wood', 0xc9a978);
  const dx = s * bw * 0.15;
  g.add(box(1.5, 2.1, 0.06, style.material('glass', 0xe8d8a8), [dx, 1.05, front + 0.16]));
  for (let i = 0; i < 6; i++) g.add(box(0.04, 2.1, 0.08, light, [dx - 0.75 + (i + 0.5) * 0.25, 1.05, front + 0.19]));
  shopWindow(g, style, 'sushi', 1.4, 0.9, -s * bw * 0.25, 1.4, front + 0.19, { mullions: 2, frame: 0x3a2418 });
  // a short tiled eave (庇) across the front
  const eave = gable(bw + 0.4, 1.6, 0.35, style.material('roof', pick(rng, [0x3a3f44, 0x4a5560, 0x5a4a3a])));
  eave.position.set(0, FLOOR - 0.15, front + 0.2);
  g.add(eave);
  const norenCol = pick(rng, [0x2c3652, 0x7a2a2a, 0x2a2a30, 0xf4ecd8]);
  noren(g, style, dx, 1.75, front + 0.32, norenCol, pick(rng, ['すし', '寿し', '鮨']), norenCol === 0xf4ecd8 ? '#2a2018' : '#ffffff');
  const name = pick(rng, ['寿司', '寿司 まる', 'すし処']);
  signboard(g, style, name, '#f4ecd8', '#2a2018', Math.min(bw * 0.55, 3.4), FLOOR + 0.55, front + 0.05, 0.7);
  // a fish on the sign: a flattened body and a tail
  const fish = new THREE.Group();
  const scale = style.material('signage', pick(rng, [0xd8443c, 0x3f7fd6, 0xf08a2c]));
  const fb = new THREE.Mesh(new THREE.SphereGeometry(0.32, 8, 6), scale);
  fb.scale.set(1.4, 0.6, 0.25);
  const tail = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.3, 3), scale);
  tail.rotation.z = Math.PI / 2;
  tail.position.x = 0.58;
  fish.add(fb, tail);
  fish.position.set(s * (Math.min(bw * 0.27, 1.7) + 0.7), FLOOR + 0.55, front + 0.3);
  g.add(fish);
  flatsAbove(g, style, rng, bw, bd, bz, front, FLOOR, floors);
  roofTop(g, style, rng, bw, bd, bz, H, { pitched: 0.5 });
  // a potted bamboo, or a paper lantern, by the door
  const px = dx + s * 1.1;
  if (chance(rng, 0.6)) {
    g.add(cyl(0.22, 0.18, 0.4, style.material('concrete', 0x6a6a64), [px, 0.2, front + 0.4], { segments: 8 }));
    for (let i = 0; i < 4; i++) g.add(cyl(0.025, 0.025, 1.6 + i * 0.15, style.material('leaf', 0x5c8a3a), [px - 0.05 + (i % 2) * 0.1, 1.0, front + 0.35 + (i > 1 ? 0.1 : 0)], { segments: 5 }));
  } else {
    const l = paperLantern.build({ variant: 'White' }, style);
    l.position.set(px, 0, front - 0.3);
    g.add(l);
  }
  return { group: g, footprint: { w: bw, d: bd, z: bz }, colliders: [solid(bw, bd, bz)] };
}

// --- 5. Flower shop (花屋) -------------------------------------------------------
/** An open-fronted flower shop under an awning, with tiered stands of flower buckets out front; 0–3 floors above. */
export function florist(style, rng, w, d) {
  const g = new THREE.Group();
  const floors = pick(rng, [0, 1, 1, 2, 3]);
  const G = floors ? FLOOR : 3.6, H = G + floors * FLOOR + 0.4;
  const { bw, bd, bz, front } = body(g, style, w, d, H, pick(rng, [0xf0efe8, 0xe6d2c8, 0xe8dcc6, 0xdfe6ec, 0xc9c4b8]), { depth: 7 + rng() * 3 });
  openFront(g, style, bw * 0.84, 2.6, front + 0.01, { interior: pick(rng, [0x6a7a5a, 0x5a6a5a, 0x7a6a5a]), mullions: between(rng, 1, 3), inside: 'florist' });
  awning(g, style, pick(rng, [[0x3fa65a, 0xf2f2ee], [0xe8609a, 0xf2f2ee], [0xf2c230, 0xf2f2ee], [0x2c3652, 0xf2f2ee]]), bw * 0.92, 2.9, front + 0.1, 1.2);
  const name = pick(rng, ['Flower 花', '花屋', 'はな', 'FLOWERS']);
  signboard(g, style, name, pick(rng, ['#2f7d4f', '#e8609a', '#ffffff']), name === 'はな' ? '#2f7d4f' : '#ffffff', bw * pick(rng, [0.55, 0.7, 0.85]), G + 0.55 - (floors ? 0 : 0.5), front, 0.7);
  flatsAbove(g, style, rng, bw, bd, bz, front, G, floors);
  roofTop(g, style, rng, bw, bd, bz, H, { pitched: floors ? 0.4 : 0.1 });
  // tiered stands of buckets with flowers, out front (2–3 tiers)
  const colours = [0xd8443c, 0xf2c230, 0xf28cb8, 0xf4f4f0, 0x8a55c9, 0xf08a2c];
  const stand = style.material('wood', pick(rng, [0x8a6a48, 0x5a4a3a, 0xc9a978]));
  const bucket = style.material('metal', 0x9aa0a6);
  const leaf = style.material('leaf');
  const sw = Math.min(bw * (0.5 + rng() * 0.3), 6);
  const sx0 = (rng() - 0.5) * (bw - sw) * 0.8;
  const tiers = between(rng, 2, 3);
  for (let tier = 0; tier < tiers; tier++) {
    const y = 0.15 + tier * 0.3, z = front + 1.0 - tier * 0.3;
    g.add(box(sw, 0.05, 0.32, stand, [sx0, y, z]));
    const n = Math.floor(sw / 0.42);
    for (let k = 0; k < n; k++) {
      const x = sx0 - sw / 2 + (k + 0.5) * (sw / n);
      g.add(cyl(0.13, 0.1, 0.24, bucket, [x, y + 0.14, z], { segments: 8 }));
      g.add(new THREE.Mesh(new THREE.SphereGeometry(0.12, 6, 4), leaf).translateX(x).translateY(y + 0.32).translateZ(z));
      const c = style.material('signage', colours[Math.floor(rng() * colours.length)]);
      for (let j = 0; j < 3; j++) g.add(new THREE.Mesh(new THREE.SphereGeometry(0.06, 5, 4), c).translateX(x + (j - 1) * 0.06).translateY(y + 0.42 + (j % 2) * 0.04).translateZ(z + (j - 1) * 0.03));
    }
  }
  for (const sx of [-1, 1]) g.add(box(0.05, 0.75, 0.05, stand, [sx0 + sx * sw / 2, 0.37, front + 0.7]));
  return { group: g, footprint: { w: bw, d: bd, z: bz }, colliders: [solid(bw, bd, bz), { x: sx0, z: front + 0.7, hw: sw / 2, hd: 0.5 }] };
}

// --- 7. Fishmonger (鮮魚) ---------------------------------------------------------
/** An open fish shop: a striped awning, a sloping table of ice and fish, stacked white boxes, hanging bulbs; 0–2 floors above. */
export function fishmonger(style, rng, w, d) {
  const g = new THREE.Group();
  const s = side(rng);
  const floors = pick(rng, [0, 1, 1, 2]);
  const G = floors ? FLOOR : 3.6, H = G + floors * FLOOR + 0.4;
  const { bw, bd, bz, front } = body(g, style, w, d, H, pick(rng, [0xd8d4c8, 0xc9c4b8, 0xe8dcc6, 0xb9c3c9]), { depth: 7 + rng() * 3 });
  openFront(g, style, bw * 0.88, 2.7, front + 0.01, { interior: 0x5a6068, mullions: between(rng, 1, 3), inside: 'fish' });
  awning(g, style, pick(rng, [[0x1f6fd0, 0xf2f2ee], [0xd8302a, 0xf2f2ee], [0x2fa36b, 0xf2f2ee]]), bw * 0.94, 2.95, front + 0.1, 1.3);
  signboard(g, style, pick(rng, ['鮮魚 さかな', '魚屋', '鮮魚店', 'さかな']), pick(rng, ['#1f4fa8', '#d8302a', '#2a2a30']), '#ffffff', bw * pick(rng, [0.6, 0.8]), G + 0.55 - (floors ? 0 : 0.4), front, 0.75);
  flatsAbove(g, style, rng, bw, bd, bz, front, G, floors);
  roofTop(g, style, rng, bw, bd, bz, H, { pitched: floors ? 0.4 : 0.2 });
  // the sloping display table: ice, with rows of fish on it
  const tw = Math.min(bw * (0.55 + rng() * 0.25), 6), tx = -s * (bw - tw) * 0.25, tz = front + 0.7;
  g.add(box(tw, 0.8, 1.0, style.material('metal', 0xb8bcc0), [tx, 0.4, tz]));
  g.add(box(tw - 0.1, 0.08, 1.1, style.material('signage', 0xeef4f8), [tx, 0.86, tz], [0.25, 0, 0]));
  const fishCols = [0x8a99a8, 0x6f8090, 0xd8443c, 0xc9b28a];
  for (let row = 0; row < 3; row++) {
    for (let k = 0; k < Math.floor(tw / 0.42); k++) {
      const f = new THREE.Mesh(new THREE.SphereGeometry(0.16, 6, 4), style.material('signage', fishCols[Math.floor(rng() * fishCols.length)]));
      f.scale.set(1.3, 0.35, 0.5);
      f.position.set(tx - tw / 2 + 0.25 + k * 0.42, 0.84 + (1 - row) * 0.12, tz - 0.3 + row * 0.3);
      g.add(f);
    }
  }
  // stacked white boxes (styrofoam) on the other side, and bulbs from the awning
  const stack = between(rng, 2, 4);
  for (let i = 0; i < stack; i++) g.add(box(0.6, 0.3, 0.4, style.material('signage', 0xf6f6f2), [s * (bw / 2 - 0.5), 0.15 + i * 0.31, front + 0.4]));
  for (let i = 0; i < 3; i++) {
    const x = tx - tw / 2 + (i + 0.5) * (tw / 3);
    g.add(box(0.01, 0.5, 0.01, style.material('darkMetal'), [x, 2.55, tz]));
    g.add(new THREE.Mesh(new THREE.SphereGeometry(0.08, 6, 4), style.material('light', 0xffe6a0)).translateX(x).translateY(2.27).translateZ(tz));
  }
  return { group: g, footprint: { w: bw, d: bd, z: bz }, colliders: [solid(bw, bd, bz), { x: tx, z: tz, hw: tw / 2, hd: 0.55 }] };
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
