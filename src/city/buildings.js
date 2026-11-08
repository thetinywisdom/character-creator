import * as THREE from 'three';
import { signTexture } from '../lib/textures.js';
import { box, cyl, face } from '../props/util.js';
import { paintedWindow, shopWindow } from './interiors.js';

// Japanese city buildings, procedurally built from boxes. Each builder fills
// a lot of width w (x) and depth d (z), stands on y = 0, is centred on the
// lot and faces +z (the street). Real-world sizes in metres.

export const WALLS = [0xe8dcc6, 0xf0efe8, 0xc9c4b8, 0xd8c3a5, 0xb9c3c9, 0xe6d2c8, 0xa89a88];
export const FLOOR = 3;

const pick = (rng, arr) => arr[Math.floor(rng() * arr.length)];

/** Triangular prism (a gable roof) along x: width across z, height up. */
export function gable(length, width, height, material) {
  const hw = width / 2, hl = length / 2;
  const v = [
    [-hl, 0, -hw], [hl, 0, -hw], [hl, 0, hw], [-hl, 0, hw], [-hl, height, 0], [hl, height, 0],
  ];
  const tris = [[0, 4, 1], [1, 4, 5], [3, 2, 5], [3, 5, 4], [0, 3, 4], [1, 5, 2], [0, 1, 2], [0, 2, 3]];
  const pos = [];
  for (const t of tris) for (const i of t) pos.push(...v[i]);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.computeVertexNormals();
  return new THREE.Mesh(geo, material);
}

/**
 * A row of windows on the front face of a floor. Homes and flats get painted
 * curtains (some lit, some dark); plain: true keeps plain dark glass.
 */
export function windowRow(g, style, w, y, z, { spacing = 2.2, ww = 1.2, wh = 1.3, plain = false } = {}) {
  const glass = style.material('window');
  const n = Math.max(1, Math.floor((w - 1) / spacing));
  for (let i = 0; i < n; i++) {
    const x = -((n - 1) * spacing) / 2 + i * spacing;
    if (plain) { g.add(box(ww, wh, 0.08, glass, [x, y, z])); continue; }
    // which painted window: varies with position, so neighbours differ
    const v = Math.abs(Math.round(x * 7 + y * 3 + z * 5)) % 4;
    g.add(paintedWindow(style, v, ww, wh, x, y, z + 0.02));
    g.add(box(ww + 0.12, 0.08, 0.1, style.material('concrete', 0xb8b4aa), [x, y - wh / 2 - 0.04, z + 0.05])); // sill
  }
}

/** Tall, narrow vertical signboard (縦看板) on a building corner. */
function verticalSign(style, rng, height) {
  const words = ['カラオケ', '居酒屋', '歯科', '美容室', '学習塾', 'ヨガ', '整体', 'BAR'];
  const colors = ['#d8302a', '#1f4fa8', '#2fa36b', '#f2c230', '#8a3fbf', '#f08a2c'];
  const word = pick(rng, words);
  const bg = pick(rng, colors);
  const tex = signTexture({ lines: [word], bg, fg: '#ffffff', w: 32, h: 32 * Math.max(word.length, 3), vertical: true });
  const g = new THREE.Group();
  g.add(box(0.7, height, 0.3, style.material('signage', parseInt(bg.slice(1), 16))));
  for (const z of [0.16, -0.16]) {
    const f = face(0.62, height * 0.95, style.material('light', 0xffffff, tex), [0, 0, z]);
    if (z < 0) f.rotation.y = Math.PI;
    g.add(f);
  }
  return g;
}

// ---------------------------------------------------------------------------
// Shop fronts (used on their own and as the ground floor of mixed buildings)

const SHOPS = {
  Konbini: { sign: 'コンビニ', bg: '#ffffff', fg: '#1f4fa8', stripes: [0x2fa36b, 0xf08a2c, 0x1f4fa8], glass: true, inside: 'konbini' },
  Ramen: { sign: 'ラーメン', bg: '#d8302a', fg: '#ffffff', noren: 0x2c3652, lantern: true, inside: 'ramen' },
  Cafe: { sign: 'CAFE', bg: '#5a3a28', fg: '#f4e6c8', awning: [0x2fa36b, 0xf2f2ee], glass: true, inside: 'cafe' },
  Bookshop: { sign: '本 BOOKS', bg: '#1f4fa8', fg: '#ffffff', glass: true, inside: 'books' },
  Bakery: { sign: 'パン', bg: '#f2c230', fg: '#5a3a28', awning: [0xd8443c, 0xf2f2ee], glass: true, inside: 'bakery' },
  Izakaya: { sign: '居酒屋', bg: '#2a2a30', fg: '#f2c230', noren: 0x5a3a28, lantern: true, inside: 'izakaya' },
};
export const SHOP_TYPES = Object.keys(SHOPS);

/**
 * A ground-floor shop front on the +z face, w wide, h tall, at depth z. The
 * window shows the shop's painted interior (interiors.js); wooden fronts get
 * a smaller window beside the door.
 */
function shopFront(g, style, type, w, h, z) {
  const s = SHOPS[type];
  if (s.glass) shopWindow(g, style, s.inside, w * 0.86, h * 0.62, 0, h * 0.36, z + 0.03);
  else {
    g.add(box(w * 0.86, h * 0.62, 0.06, style.material('wood', 0x5a3a28), [0, h * 0.36, z]));
    shopWindow(g, style, s.inside, Math.min(w * 0.4, 2.6), 1.3, -w * 0.2, 1.45, z + 0.06, { mullions: 2, frame: 0x3a2418 });
  }
  g.add(box(1.0, 2.1, 0.08, style.material('window'), [w * 0.25, 1.05, z + 0.01])); // door
  // signboard across the top
  const tex = signTexture({ lines: [s.sign], bg: s.bg, fg: s.fg, w: 128, h: 32 });
  g.add(box(w * 0.9, 0.7, 0.2, style.material('signage', parseInt(s.bg.slice(1), 16)), [0, h * 0.84, z + 0.1]));
  g.add(face(w * 0.88, 0.66, style.material('light', 0xffffff, tex), [0, h * 0.84, z + 0.21]));
  if (s.stripes) {
    s.stripes.forEach((c, i) => g.add(box(w, 0.12, 0.05, style.material('signage', c), [0, h * 0.72 - i * 0.13, z + 0.04])));
  }
  if (s.awning) {
    // striped awning sloping out over the window
    const n = 8;
    for (let i = 0; i < n; i++) {
      const seg = box(w * 0.86 / n, 0.06, 1.1, style.material('signage', s.awning[i % 2]),
        [-w * 0.43 + (i + 0.5) * (w * 0.86 / n), h * 0.68, z + 0.5], [0.35, 0, 0]);
      g.add(seg);
    }
  }
  if (s.noren) {
    // noren: short cloth strips hanging over the door
    for (let i = 0; i < 4; i++) {
      g.add(box(0.24, 0.6, 0.02, style.material('signage', s.noren), [w * 0.25 - 0.39 + i * 0.26, 1.9, z + 0.12]));
    }
  }
  if (s.lantern) {
    // red paper lantern (akachochin) by the door
    g.add(cyl(0.2, 0.2, 0.55, style.material('light', 0xe0402f), [w * 0.25 + 0.8, 2.0, z + 0.35], { segments: 8 }));
  }
}

// ---------------------------------------------------------------------------
// Building types

export function house(style, rng, w, d) {
  const g = new THREE.Group();
  const wall = style.material('building', pick(rng, WALLS));
  const bw = Math.min(w - 1.5, 9), bd = Math.min(d - 3.5, 9);
  const bz = -d / 2 + 0.8 + bd / 2; // set back from the street, a small front yard
  const body = new THREE.Group();
  body.position.z = bz;
  body.add(box(bw, FLOOR * 2, bd, wall, [0, FLOOR, 0]));
  const roof = gable(bw + 0.8, bd + 1.0, 1.8, style.material('roof', pick(rng, [0x4a5560, 0x6a4a3a, 0x3c4a5a, 0x7a3a32])));
  roof.position.y = FLOOR * 2;
  body.add(roof);
  windowRow(body, style, bw, 1.5, bd / 2 + 0.01, { spacing: 2.6 });
  windowRow(body, style, bw, FLOOR + 1.5, bd / 2 + 0.01, { spacing: 2.6 });
  body.add(box(0.9, 2.0, 0.1, style.material('wood'), [-bw * 0.3, 1.0, bd / 2 + 0.02]));
  // small balcony on the upper floor
  body.add(box(bw * 0.5, 0.1, 0.9, style.material('concrete'), [bw * 0.15, FLOOR, bd / 2 + 0.45]));
  body.add(box(bw * 0.5, 0.9, 0.05, style.material('metal', 0xd8d8d0), [bw * 0.15, FLOOR + 0.5, bd / 2 + 0.88]));
  g.add(body);
  // low concrete block wall along the front, with a gate opening
  const blockWall = style.material('concrete', 0xb4b0a8);
  const fz = d / 2 - 0.15;
  g.add(box(w * 0.35, 1.1, 0.15, blockWall, [-w * 0.32, 0.55, fz]));
  g.add(box(w * 0.35, 1.1, 0.15, blockWall, [w * 0.32, 0.55, fz]));
  return { group: g, footprint: { w: bw, d: bd, z: bz } };
}

export function apartment(style, rng, w, d) {
  const g = new THREE.Group();
  const floors = 4 + Math.floor(rng() * 4);
  const H = floors * FLOOR;
  const bw = w - 0.6, bd = d - 2;
  const bz = -1;
  g.add(box(bw, H, bd, style.material('building', pick(rng, WALLS)), [0, H / 2, bz]));
  g.add(box(bw + 0.2, 0.5, bd + 0.2, style.material('concrete'), [0, H + 0.25, bz])); // parapet
  const front = bz + bd / 2;
  for (let f = 0; f < floors; f++) {
    const y = f * FLOOR;
    windowRow(g, style, bw, y + 1.4, front + 0.01, { spacing: 3, ww: 1.6, wh: 2 });
    if (f > 0) {
      // balcony slab and railing across the front
      g.add(box(bw, 0.15, 1.1, style.material('concrete'), [0, y, front + 0.55]));
      g.add(box(bw, 1.0, 0.06, style.material('metal', 0xc8ccd0), [0, y + 0.55, front + 1.08]));
    }
  }
  g.add(box(2.0, 2.4, 0.1, style.material('glass', 0x9fc0d8), [0, 1.2, front + 0.02])); // entrance
  return { group: g, footprint: { w: bw, d: bd, z: bz } };
}

export function mixedUse(style, rng, w, d, shopType = pick(rng, SHOP_TYPES)) {
  const g = new THREE.Group();
  const floors = 3 + Math.floor(rng() * 3);
  const H = floors * FLOOR + 1;
  const bw = w - 0.4, bd = d - 1;
  const bz = -0.5;
  g.add(box(bw, H, bd, style.material('building', pick(rng, WALLS)), [0, H / 2, bz]));
  const front = bz + bd / 2;
  shopFront(g, style, shopType, bw, FLOOR + 1, front + 0.01);
  for (let f = 1; f < floors; f++) windowRow(g, style, bw, f * FLOOR + 2.4, front + 0.01, { spacing: 2.4, ww: 1.4, wh: 1.4 });
  // vertical signboard on the front corner
  const sign = verticalSign(style, rng, Math.min(H - 4, 6));
  sign.position.set(bw / 2 - 0.4, FLOOR + 1.2 + Math.min(H - 4, 6) / 2, front + 0.4);
  g.add(sign);
  return { group: g, footprint: { w: bw, d: bd, z: bz } };
}

export function shop(style, rng, w, d, shopType = pick(rng, SHOP_TYPES)) {
  const g = new THREE.Group();
  const two = shopType === 'Ramen' || shopType === 'Izakaya';
  const H = two ? FLOOR * 2 + 0.5 : 4.5;
  const bw = w - 0.4, bd = Math.min(d - 1, 12);
  const bz = -d / 2 + bd / 2 + 0.2;
  const wallHex = shopType === 'Konbini' ? 0xf4f4f0 : pick(rng, WALLS);
  g.add(box(bw, H, bd, style.material('building', wallHex), [0, H / 2, bz]));
  const front = bz + bd / 2;
  shopFront(g, style, shopType, bw, Math.min(H, 4.5), front + 0.01);
  if (two) windowRow(g, style, bw, FLOOR + 2, front + 0.01, { spacing: 2.4 });
  return { group: g, footprint: { w: bw, d: bd, z: bz } };
}

export function office(style, rng, w, d) {
  const g = new THREE.Group();
  const floors = 7 + Math.floor(rng() * 6);
  const H = floors * 3.6;
  const bw = w - 0.6, bd = d - 1.5;
  const bz = -0.75;
  // glass body with a concrete band at every floor
  g.add(box(bw, H, bd, style.material('glass', pick(rng, [0x7d9db8, 0x8fa6a0, 0x6f8aa8])), [0, H / 2, bz]));
  const band = style.material('concrete', 0xd8d8d0);
  for (let f = 0; f <= floors; f++) g.add(box(bw + 0.1, 0.35, bd + 0.1, band, [0, f * 3.6, bz]));
  for (const sx of [-1, 1]) g.add(box(0.6, H, 0.6, band, [sx * (bw / 2 - 0.3), H / 2, bz + bd / 2 - 0.3]));
  return { group: g, footprint: { w: bw, d: bd, z: bz } };
}

// ---------------------------------------------------------------------------
// Shrine (神社) and school (学校)

/** A red torii gate, centred on the origin, spanning x (path along z). */
export function torii(style, span = 3.4, height = 3.6) {
  const g = new THREE.Group();
  const red = style.material('signage', 0xd2452e);
  const black = style.material('darkMetal', 0x222222);
  for (const sx of [-1, 1]) {
    g.add(cyl(0.16, 0.19, height, red, [sx * span / 2, height / 2, 0], { segments: 10 }));
    g.add(cyl(0.24, 0.24, 0.3, black, [sx * span / 2, 0.15, 0], { segments: 10 })); // black feet
  }
  g.add(box(span + 0.6, 0.2, 0.2, red, [0, height - 0.75, 0]));              // nuki (lower beam)
  g.add(box(span + 1.0, 0.24, 0.32, red, [0, height - 0.1, 0]));             // shimaki
  g.add(box(span + 1.6, 0.22, 0.42, black, [0, height + 0.12, 0]));          // kasagi (top beam)
  for (const sx of [-1, 1]) {                                                 // its upturned ends
    g.add(box(0.5, 0.2, 0.42, black, [sx * (span / 2 + 0.95), height + 0.2, 0], [0, 0, sx * 0.28]));
  }
  g.add(box(0.12, 0.6, 0.12, red, [0, height - 0.42, 0]));                   // gakuzuka (centre post)
  return g;
}

/**
 * A neighbourhood shrine on a lot w × d facing +z: gravel, a stone path in
 * through a torii, stone lanterns, and a raised wooden hall at the back with
 * a deep roof, a straw rope and an offering box.
 */
export function shrine(style, rng, w, d) {
  const g = new THREE.Group();
  const colliders = [];
  g.add(box(w, 0.04, d, style.material('concrete', 0xc9c4b6), [0, 0.02, 0]));          // gravel
  const pathMat = style.material('concrete', 0x9b978c);
  const hallD = 4.2, hallZ = -d / 2 + 1 + hallD / 2;
  const pathLen = d / 2 - (hallZ + hallD / 2);
  for (let z = hallZ + hallD / 2 + 0.6; z < d / 2 - 0.3; z += 0.9) g.add(box(1.4, 0.06, 0.75, pathMat, [0, 0.05, z]));
  // the torii near the street
  const tz = d / 2 - 2;
  const t = torii(style);
  t.position.z = tz;
  g.add(t);
  for (const sx of [-1, 1]) colliders.push({ x: sx * 1.7, z: tz, hw: 0.25, hd: 0.25 });
  // a pair of stone lanterns half way along the path
  const lz = hallZ + hallD / 2 + pathLen * 0.45;
  for (const sx of [-1, 1]) {
    const l = new THREE.Group();
    const stone = style.material('concrete', 0x9a978d);
    l.add(cyl(0.32, 0.38, 0.22, stone, [0, 0.11, 0], { segments: 6 }));
    l.add(cyl(0.12, 0.15, 0.62, stone, [0, 0.53, 0], { segments: 8 }));
    l.add(box(0.36, 0.3, 0.36, stone, [0, 1.0, 0]));
    l.add(cyl(0.02, 0.42, 0.24, stone, [0, 1.27, 0], { segments: 6 }));
    l.position.set(sx * 1.8, 0, lz);
    g.add(l);
    colliders.push({ x: sx * 1.8, z: lz, hw: 0.35, hd: 0.35 });
  }
  // the hall: raised platform, wooden body, vermilion corner posts, deep roof
  const hallW = Math.min(w - 4, 6);
  const wood = style.material('wood', 0x8a5a36);
  const red = style.material('signage', 0xc9442e);
  g.add(box(hallW + 1.2, 0.7, hallD + 1.2, style.material('concrete', 0xa29c90), [0, 0.35, hallZ]));
  g.add(box(hallW, 2.3, hallD, wood, [0, 0.7 + 1.15, hallZ]));
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    g.add(box(0.22, 2.3, 0.22, red, [sx * hallW / 2, 0.7 + 1.15, hallZ + sz * hallD / 2]));
  }
  const roof = gable(hallW + 2.4, hallD + 2.6, 1.9, style.material('roof', 0x3e4a42));
  roof.position.set(0, 0.7 + 2.3, hallZ);
  g.add(roof);
  g.add(box(hallW + 2.6, 0.18, 0.3, style.material('roof', 0x2e3832), [0, 0.7 + 2.3 + 1.9, hallZ]));   // ridge
  // front steps, offering box, and the straw rope with paper streamers
  const front = hallZ + hallD / 2;
  g.add(box(2.2, 0.35, 0.8, style.material('concrete', 0xa29c90), [0, 0.18, front + 1.0]));
  g.add(box(1.2, 0.6, 0.6, style.material('wood', 0x6a4429), [0, 1.0, front + 0.45]));          // saisen-bako
  const rope = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, hallW * 0.8, 8), style.material('wood', 0xd9c27a));
  rope.rotation.z = Math.PI / 2;
  rope.position.set(0, 2.75, front + 0.15);
  g.add(rope);
  for (let i = -2; i <= 2; i++) g.add(box(0.12, 0.4, 0.02, style.material('signage', 0xf6f4ee), [i * hallW * 0.17, 2.45, front + 0.28]));
  colliders.push({ x: 0, z: hallZ, hw: (hallW + 1.2) / 2, hd: (hallD + 1.2) / 2 });
  return { group: g, footprint: { w: hallW + 1.2, d: hallD + 1.2, z: hallZ }, colliders };
}

/**
 * A school on a lot w × d facing +z: a long three-storey building across the
 * back with a clock, an entrance canopy and a roof fence, a sports ground in
 * front, and a low fence along the street with a gate.
 */
export function school(style, rng, w, d) {
  const g = new THREE.Group();
  const colliders = [];
  const bw = Math.min(w - 2, 32), bd = 9, floors = 3;
  const H = floors * FLOOR + 0.6;
  const bz = -d / 2 + 0.5 + bd / 2;
  const wall = style.material('building', pick(rng, [0xece6d8, 0xe4e2da, 0xd9d4c4]));
  g.add(box(bw, H, bd, wall, [0, H / 2, bz]));
  const front = bz + bd / 2;
  for (let f = 0; f < floors; f++) windowRow(g, style, bw, f * FLOOR + 1.7, front + 0.01, { spacing: 2.0, ww: 1.5, wh: 1.4, plain: true });
  // clock on a raised centre section
  g.add(box(5, H + 1.6, bd + 0.4, wall, [0, (H + 1.6) / 2, bz]));
  const clock = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.8, 0.12, 16), style.material('signage', 0xf6f4ee));
  clock.rotation.x = Math.PI / 2;
  clock.position.set(0, H + 0.6, front + 0.28);
  g.add(clock);
  g.add(box(0.08, 0.55, 0.05, style.material('darkMetal'), [0, H + 0.82, front + 0.36]));
  g.add(box(0.4, 0.08, 0.05, style.material('darkMetal'), [0.18, H + 0.6, front + 0.36]));
  // entrance canopy
  g.add(box(6, 0.25, 2.4, style.material('concrete', 0xb8b4aa), [0, 3.0, front + 1.2]));
  for (const sx of [-1, 1]) g.add(box(0.2, 3.0, 0.2, style.material('concrete', 0xb8b4aa), [sx * 2.8, 1.5, front + 2.2]));
  // roof fence
  const fence = style.material('metal', 0x7f9a8a);
  g.add(box(bw, 0.9, 0.05, fence, [0, H + 0.45, front - 0.1]));
  colliders.push({ x: 0, z: bz, hw: bw / 2, hd: bd / 2 });
  // sports ground with a white running track outline
  const gz0 = front + 3, gz1 = d / 2 - 1;
  const gd = gz1 - gz0;
  if (gd > 4) {
    g.add(box(w - 2, 0.04, gd, style.material('concrete', 0xc9a978), [0, 0.03, (gz0 + gz1) / 2]));
    const line = style.material('signage', 0xf4f2ea);
    const tw = Math.min(w - 8, 24), td = Math.max(2, gd - 4), tz = (gz0 + gz1) / 2;
    g.add(box(tw, 0.02, 0.12, line, [0, 0.06, tz - td / 2]));
    g.add(box(tw, 0.02, 0.12, line, [0, 0.06, tz + td / 2]));
    g.add(box(0.12, 0.02, td, line, [-tw / 2, 0.06, tz]));
    g.add(box(0.12, 0.02, td, line, [tw / 2, 0.06, tz]));
  }
  // low fence along the street, open in the middle for the gate
  const fenceZ = d / 2 - 0.3, gap = 3;
  for (const sx of [-1, 1]) {
    const len = w / 2 - gap / 2 - 0.5;
    g.add(box(len, 1.4, 0.05, fence, [sx * (gap / 2 + len / 2), 0.7, fenceZ]));
    colliders.push({ x: sx * (gap / 2 + len / 2), z: fenceZ, hw: len / 2, hd: 0.1 });
  }
  for (const sx of [-1, 1]) g.add(box(0.4, 1.6, 0.4, style.material('concrete', 0xb8b4aa), [sx * gap / 2, 0.8, fenceZ]));
  return { group: g, footprint: { w: bw, d: bd, z: bz }, colliders };
}
