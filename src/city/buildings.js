import * as THREE from 'three';
import { signTexture } from '../lib/textures.js';
import { box, cyl, face } from '../props/util.js';

// Japanese city buildings, procedurally built from boxes. Each builder fills
// a lot of width w (x) and depth d (z), stands on y = 0, is centred on the
// lot and faces +z (the street). Real-world sizes in metres.

const WALLS = [0xe8dcc6, 0xf0efe8, 0xc9c4b8, 0xd8c3a5, 0xb9c3c9, 0xe6d2c8, 0xa89a88];
const FLOOR = 3;

const pick = (rng, arr) => arr[Math.floor(rng() * arr.length)];

/** Triangular prism (a gable roof) along x: width across z, height up. */
function gable(length, width, height, material) {
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

/** A row of windows on the front face of a floor. */
function windowRow(g, style, w, y, z, { spacing = 2.2, ww = 1.2, wh = 1.3 } = {}) {
  const glass = style.material('window');
  const n = Math.max(1, Math.floor((w - 1) / spacing));
  for (let i = 0; i < n; i++) {
    const x = -((n - 1) * spacing) / 2 + i * spacing;
    g.add(box(ww, wh, 0.08, glass, [x, y, z]));
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
  Konbini: { sign: 'コンビニ', bg: '#ffffff', fg: '#1f4fa8', stripes: [0x2fa36b, 0xf08a2c, 0x1f4fa8], glass: true },
  Ramen: { sign: 'ラーメン', bg: '#d8302a', fg: '#ffffff', noren: 0x2c3652, lantern: true },
  Cafe: { sign: 'CAFE', bg: '#5a3a28', fg: '#f4e6c8', awning: [0x2fa36b, 0xf2f2ee], glass: true },
  Bookshop: { sign: '本 BOOKS', bg: '#1f4fa8', fg: '#ffffff', glass: true },
  Bakery: { sign: 'パン', bg: '#f2c230', fg: '#5a3a28', awning: [0xd8443c, 0xf2f2ee], glass: true },
  Izakaya: { sign: '居酒屋', bg: '#2a2a30', fg: '#f2c230', noren: 0x5a3a28, lantern: true },
};
export const SHOP_TYPES = Object.keys(SHOPS);

/** A ground-floor shop front on the +z face, w wide, h tall, at depth z. */
function shopFront(g, style, type, w, h, z) {
  const s = SHOPS[type];
  const glass = style.material('glass', 0x9fc0d8);
  if (s.glass) g.add(box(w * 0.86, h * 0.62, 0.06, glass, [0, h * 0.36, z]));
  else g.add(box(w * 0.86, h * 0.62, 0.06, style.material('wood', 0x5a3a28), [0, h * 0.36, z]));
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
