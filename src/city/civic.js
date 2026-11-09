import * as THREE from 'three';
import { signTexture } from '../lib/textures.js';
import { box, cyl, face } from '../props/util.js';
import { bicycle, car } from '../props/vehicles.js';
import { postBox } from '../props/furniture.js';
import { paperLantern } from '../props/japan.js';
import { FLOOR, gable, windowRow } from './buildings.js';
import { shopWindow, interiorPanel } from './interiors.js';
import { awning, body, noren, projectingSign, signboard, solid } from './shops.js';
import { between, chance, flatsAbove, frontExtras, pick, roofTop, side } from './variety.js';

// Batches 2 and 3: food places, public buildings and others. Same contract as
// shops.js: fill a lot w × d facing +z, stand on y = 0, return
// { group, footprint, colliders }. Windows show painted interiors. Each
// builder draws its shape, layout and colours from rng (variety.js), so a new
// seed is a different building of the same kind.

const hexOf = (n) => `#${n.toString(16).padStart(6, '0')}`;

// --- 11. Udon / soba shop (うどん・そば) ------------------------------------------------
/** A wooden noodle shop under a dark tiled roof, with a noren; single storey or with a floor above. */
export function udonSoba(style, rng, w, d) {
  const g = new THREE.Group();
  const s = side(rng);
  const two = chance(rng, 0.4);
  const H = two ? FLOOR * 2 + 0.3 : 3.4;
  const { bw, bd, bz, front } = body(g, style, w, d, H, pick(rng, [0xe8dcc6, 0xd8c3a5, 0xf0e6d2]), { depth: 7 + rng() * 2.5 });
  const wood = style.material('wood', pick(rng, [0x6a4429, 0x4a3020, 0x8a6a48]));
  g.add(box(bw, two ? FLOOR : H, 0.2, wood, [0, (two ? FLOOR : H) / 2, front + 0.05]));
  const roofM = style.material('roof', pick(rng, [0x3a3f44, 0x4a5560, 0x5a4a3a]));
  if (two) {
    // a tiled eave over the shop, the upper floor above with a lattice window
    const eave = gable(bw + 0.4, 1.6, 0.4, roofM);
    eave.position.set(0, FLOOR - 0.1, front + 0.2);
    g.add(eave);
    windowRow(g, style, bw, FLOOR + 1.6, front + 0.01, { spacing: 2.6 });
  }
  const roof = gable(bw + 0.8, bd + 1.4, 1.6, roofM);
  roof.position.set(0, H, bz);
  g.add(roof);
  shopWindow(g, style, 'udon', Math.min(bw * 0.45, 3), 1.2, -s * bw * 0.2, 1.5, front + 0.18, { mullions: between(rng, 2, 4), frame: 0x3a2418 });
  g.add(box(1.4, 2.1, 0.06, style.material('wood', 0xb89a68), [s * bw * 0.22, 1.05, front + 0.16]));
  const norenCol = pick(rng, [0xf4ecd8, 0x2c3652, 0x6a2a2a]);
  const word = pick(rng, ['うどん', 'そば', '手打']);
  noren(g, style, s * bw * 0.22, 1.75, front + 0.3, norenCol, word, norenCol === 0xf4ecd8 ? '#2a2018' : '#ffffff');
  signboard(g, style, pick(rng, ['うどん・そば', '手打ちそば', 'うどん', 'そば処']), '#f4ecd8', '#2a2018', Math.min(bw * 0.7, 4.5), (two ? FLOOR : H) - 0.45 + (two ? 0.9 : 0), front + 0.05, 0.6);
  const extras = frontExtras(g, style, rng, bw, front, { kinds: ['board', 'lantern', 'planter'], max: 2, keepClear: [[s * bw * 0.22 - 0.8, s * bw * 0.22 + 0.8]] });
  return { group: g, footprint: { w: bw, d: bd, z: bz }, colliders: [solid(bw, bd, bz), ...extras] };
}

// --- 12. Family restaurant (ファミレス) ---------------------------------------------------
/** A wide single-storey restaurant with big windows all along and a tall pole sign; colour scheme, roof and sign side vary. */
export function familyRestaurant(style, rng, w, d) {
  const g = new THREE.Group();
  const s = side(rng);
  const H = 4 + rng() * 0.6;
  const [brand, name] = pick(rng, [[0xd8302a, 'ファミレス'], [0xf08a2c, 'レストラン'], [0x2fa36b, 'ダイニング'], [0x1f4fa8, 'ファミリー'], [0xf2c230, 'グリル']]);
  const { bw, bd, bz, front } = body(g, style, w, d, H, pick(rng, [0xf2e6cc, 0xf4f1e6, 0xe8dcc6, 0xd8c3a5]), { depth: 8.5 + rng() * 1.5 });
  const brandM = style.material('signage', brand);
  // a band in the brand colour round the top edge (a ring, so nothing lies flush on the roof)
  const bandH = 0.5, by = H - bandH / 2 + 0.05;
  g.add(box(bw + 0.2, bandH, 0.2, brandM, [0, by, bz + bd / 2]));
  g.add(box(bw + 0.2, bandH, 0.2, brandM, [0, by, bz - bd / 2]));
  for (const sx of [-1, 1]) g.add(box(0.2, bandH, bd + 0.2, brandM, [sx * (bw / 2), by, bz]));
  if (chance(rng, 0.45)) {
    // a low pitched roof above the band
    const roof = gable(bw + 0.6, bd + 0.8, 1.4, style.material('roof', pick(rng, [0x4a5560, 0x6a4a3a, 0x7a3a32, 0x3a3f44])));
    roof.position.set(0, H + 0.1, bz);
    g.add(roof);
  } else smallTop(g, style, rng, bw, bd, bz, H);
  const n = Math.max(1, Math.floor(bw / pick(rng, [2.6, 3.2, 4])));
  const doorAt = s > 0 ? n - 1 : 0;
  for (let i = 0; i < n; i++) {
    const x = -bw / 2 + (i + 0.5) * (bw / n);
    if (i === doorAt && n > 1) g.add(box(1.4, 2.3, 0.08, style.material('window'), [x, 1.15, front + 0.05])); // door
    else shopWindow(g, style, 'family', bw / n - 0.5, 2, x, 1.5, front + 0.04, { mullions: 2 });
  }
  // tall pole sign by the street, on either side
  const px = -s * (bw / 2 - 0.6), pz = d / 2 - 0.6, ph = 5 + rng() * 2;
  g.add(cyl(0.12, 0.12, ph, style.material('metal', 0x9aa0a6), [px, ph / 2, pz], { segments: 8 }));
  const tex = signTexture({ lines: [name], bg: hexOf(brand), fg: '#ffffff', w: 96, h: 64 });
  g.add(box(1.8, 1.2, 0.3, brandM, [px, ph + 0.2, pz]));
  for (const sd of [1, -1]) {
    const f = face(1.7, 1.1, style.material('light', 0xffffff, tex), [px, ph + 0.2, pz + sd * 0.16]);
    if (sd < 0) f.rotation.y = Math.PI;
    g.add(f);
  }
  const extras = frontExtras(g, style, rng, bw * 0.6, front, { kinds: ['planter', 'planter', 'board'], max: 2 });
  return { group: g, footprint: { w: bw, d: bd, z: bz }, colliders: [solid(bw, bd, bz), { x: px, z: pz, hw: 0.2, hd: 0.2 }, ...extras] };
}

/** A low restaurant's flat roof: a few AC units. */
function smallTop(g, style, rng, bw, bd, bz, H) {
  for (let i = between(rng, 1, 3); i > 0; i--) g.add(box(0.9, 0.6, 0.5, style.material('metal', 0xe8e8e4), [(rng() - 0.5) * (bw - 2), H + 0.3, bz + (rng() - 0.5) * (bd - 2)]));
}

// --- 13. Takoyaki stand (たこ焼き) ---------------------------------------------------------
/** A small street-food kiosk with an open counter and a big sign: takoyaki, taiyaki or yakisoba, in its own colours. */
export function takoyaki(style, rng, w, d) {
  const g = new THREE.Group();
  const kw = Math.min(w - 1, 3 + rng() * 1.6), kd = 2.6 + rng() * 0.8, H = 2.6 + rng() * 0.4;
  const kz = -d / 2 + kd / 2 + 2;
  const [word, col, kind] = pick(rng, [['たこ焼き', 0xd8302a, 'takoyaki'], ['たい焼き', 0x1f4fa8, 'takoyaki'], ['焼きそば', 0xf08a2c, 'takoyaki'], ['たこ焼き', 0xf2c230, 'takoyaki']]);
  const wall = style.material('building', pick(rng, [0xf2e2c4, 0xf4f1e6, 0xe8dcc6]));
  g.add(box(kw, H, kd, wall, [0, H / 2, kz]));
  const front = kz + kd / 2;
  // open counter: the painted inside above a counter shelf
  g.add(interiorPanel(style, kind, kw - 0.4, 1.2, 0, 1.75, front - 0.02));
  g.add(box(kw - 0.2, 0.1, 0.5, style.material('wood', 0x8a5a36), [0, 1.1, front + 0.2]));
  g.add(box(kw - 0.2, 1.05, 0.08, style.material('wood', pick(rng, [0x6a4429, 0x8a5a36, 0x3a2418])), [0, 0.53, front + 0.02]));
  awning(g, style, [col, 0xf2f2ee], kw, H - 0.2, front, 0.9);
  const tex = signTexture({ lines: [word], bg: hexOf(col), fg: '#ffffff', w: 64, h: 64, shape: 'circle' });
  if (chance(rng, 0.6)) {
    // a round sign on the roof
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.75, 0.12, 16), style.material('signage', col));
    disc.rotation.x = Math.PI / 2;
    disc.position.set(0, H + 0.8, front - 0.3);
    g.add(disc, face(1.3, 1.3, style.material('light', 0xffffff, tex), [0, H + 0.8, front - 0.23]));
  } else signboard(g, style, word, hexOf(col), '#ffffff', kw * 0.9, H + 0.35, front - 0.1, 0.6);
  const colliders = [solid(kw, kd, kz)];
  if (chance(rng, 0.7)) {
    // a bench to eat at, on either side
    const bx = side(rng) * (kw / 2 - 0.8);
    g.add(box(1.6, 0.08, 0.45, style.material('signage', col), [bx, 0.45, front + 1.6]));
    for (const sx of [-1, 1]) g.add(box(0.08, 0.45, 0.4, style.material('darkMetal'), [bx + sx * 0.7, 0.22, front + 1.6]));
    colliders.push({ x: bx, z: front + 1.6, hw: 0.8, hd: 0.25 });
  }
  if (chance(rng, 0.5)) {
    const lantern = paperLantern.build({ variant: pick(rng, ['Red', 'White']) }, style);
    lantern.position.set(-kw / 2 + 0.2, 0, front - 0.3);
    g.add(lantern);
  }
  return { group: g, footprint: { w: kw, d: kd, z: kz }, colliders };
}

// --- 14. Koban (交番) ---------------------------------------------------------------------
/** A small police box: a classic gabled one, or a modern flat-roofed one in brick or concrete; red lamp, sign, a white bicycle. */
export function koban(style, rng, w, d) {
  const g = new THREE.Group();
  const s = side(rng);
  const modern = chance(rng, 0.5);
  const kw = Math.min(w - 1, 4.5 + rng() * 1.5), kd = 4.2 + rng() * 1.2, H = modern ? 3.6 : 3.2;
  const kz = -d / 2 + kd / 2 + 2.5;
  const wallHex = modern ? pick(rng, [0x9a5a48, 0xc9c4b8, 0xd8c3a5]) : pick(rng, [0xf2f2ee, 0xe8e6e0]);
  g.add(box(kw, H, kd, style.material('building', wallHex), [0, H / 2, kz]));
  const front = kz + kd / 2;
  if (modern) {
    g.add(box(kw + 0.6, 0.3, kd + 0.6, style.material('concrete', 0xd8d4cc), [0, H + 0.15, kz]));   // flat roof slab
    g.add(box(1.8, 0.15, 1.4, style.material('concrete', 0xd8d4cc), [s * kw * 0.25, 2.5, front + 0.7])); // canopy
  } else {
    const roof = gable(kd + 0.8, kw + 0.6, 1.2, style.material('roof', pick(rng, [0x5a6068, 0x3c4a5a, 0x6a4a3a])));
    roof.rotation.y = Math.PI / 2; // ridge runs front to back, gable end to the street
    roof.position.set(0, H, kz);
    g.add(roof);
  }
  shopWindow(g, style, 'koban', kw * 0.4, 1.3, -s * kw * 0.22, 1.55, front + 0.03, { mullions: 2 });
  g.add(box(1.1, 2.2, 0.08, style.material('glass', 0x8a99a8), [s * kw * 0.25, 1.1, front + 0.03]));
  // the red lamp over the door and the KOBAN sign
  const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 8), style.material('light', 0xe0402f));
  lamp.position.set(s * kw * 0.25, modern ? 2.95 : 2.65, front + 0.25);
  g.add(lamp, box(0.06, 0.06, 0.25, style.material('darkMetal'), [s * kw * 0.25, modern ? 2.95 : 2.65, front + 0.1]));
  signboard(g, style, pick(rng, ['交番 KOBAN', 'KOBAN', '交番']), '#2c3a5a', '#ffffff', kw * 0.8, H - 0.3, front, 0.45);
  // white police bicycles parked out front
  const bikes = between(rng, 1, 2);
  for (let i = 0; i < bikes; i++) {
    const bike = bicycle.build({ color: 'White' }, style);
    bike.position.set(-s * (kw / 2 + 0.2), 0, front + 1.0 + i * 0.7);
    bike.rotation.y = Math.PI / 2;
    bike.userData.knock = true;
    g.add(bike);
  }
  return { group: g, footprint: { w: kw, d: kd, z: kz }, colliders: [solid(kw, kd, kz)] };
}

// --- 15. Post office (郵便局) ---------------------------------------------------------------
/** A post office with the red 〒 mark, a glass front and a post box outside; 1–3 storeys, white, cream or brick. */
export function postOffice(style, rng, w, d) {
  const g = new THREE.Group();
  const s = side(rng);
  const floors = between(rng, 0, 2);
  const G = FLOOR + 0.6, H = G + floors * FLOOR;
  const { bw, bd, bz, front } = body(g, style, w, d, H, pick(rng, [0xf2f2ee, 0xf0e6d2, 0x9a5a48, 0xc9c4b8]), { depth: 8 + rng() * 2 });
  shopWindow(g, style, 'post', bw * (0.6 + rng() * 0.2), 2.3, -s * bw * 0.08, 1.3, front + 0.04);
  g.add(box(1.4, 2.3, 0.08, style.material('window'), [s * (bw / 2 - 1.1), 1.15, front + 0.05])); // door
  g.add(box(bw + 0.1, 0.3, 0.3, style.material('signage', 0xe84a2a), [0, G - 0.5, front + 0.1])); // red band
  signboard(g, style, '〒 郵便局', '#ffffff', '#e84a2a', bw * pick(rng, [0.5, 0.6, 0.75]), G + (floors ? 0.3 : -0.3), front, 0.7);
  flatsAbove(g, style, rng, bw, bd, bz, front, G, floors);
  roofTop(g, style, rng, bw, bd, bz, H, { pitched: 0.3 });
  const pb = postBox.build({}, style);
  const px = -s * (bw / 2 - 0.6);
  pb.position.set(px, 0, front + 1.2);
  g.add(pb);
  return { group: g, footprint: { w: bw, d: bd, z: bz }, colliders: [solid(bw, bd, bz), { x: px, z: front + 1.2, hw: 0.25, hd: 0.25 }] };
}

// --- 16. Bank (銀行) ----------------------------------------------------------------------
/** A stone-look bank: pillars at the entrance, a corporate sign, an ATM corner; 3–6 storeys, sign colour and layout vary. */
export function bank(style, rng, w, d) {
  const g = new THREE.Group();
  const s = side(rng);
  const floors = between(rng, 3, 6), H = floors * FLOOR + 0.6;
  const stone = pick(rng, [0xc9c4b8, 0xb0aa9e, 0x8a8680, 0xd8d0c0]);
  const [brand, name] = pick(rng, [['#1f3a6a', '銀行 BANK'], ['#2f7d4f', '銀行'], ['#a8302a', 'BANK 銀行'], ['#d86a1a', '信用金庫']]);
  const { bw, bd, bz, front } = body(g, style, w, d, H, stone, { depth: 9 + rng() * 2 });
  shopWindow(g, style, 'bank', bw * 0.6, 2.3, -s * bw * 0.12, 1.4, front + 0.04);
  const pillars = between(rng, 2, 4);
  for (let i = 0; i < pillars; i++) {
    const x = -s * (bw * 0.45 - i * (bw * 0.6) / Math.max(1, pillars - 1));
    g.add(box(0.5, FLOOR, 0.5, style.material('concrete', 0xb0aa9e), [x, FLOOR / 2, front + 0.25]));
  }
  // ATM corner: a lit booth with a sign
  const ax = s * (bw / 2 - 0.9);
  g.add(box(1.2, 2.2, 0.5, style.material('metal', 0xd8d8d0), [ax, 1.1, front + 0.1]));
  g.add(box(0.6, 0.45, 0.05, style.material('light', 0x6ab8e8), [ax, 1.35, front + 0.37]));
  signboard(g, style, 'ATM', brand, '#ffffff', 1.1, 2.45, front + 0.1, 0.35);
  signboard(g, style, name, brand, '#ffffff', bw * pick(rng, [0.55, 0.7]), FLOOR + 0.6, front, 0.8);
  // upper floors: plain office windows (banks keep the blinds down)
  for (let f = 1; f < floors; f++) windowRow(g, style, bw, f * FLOOR + 1.7, front + 0.01, { spacing: pick(rng, [1.8, 2.4]), plain: true });
  roofTop(g, style, rng, bw, bd, bz, H, { pitched: 0 });
  return { group: g, footprint: { w: bw, d: bd, z: bz }, colliders: [solid(bw, bd, bz)] };
}

// --- 17. Clinic (クリニック) ----------------------------------------------------------------
/** A clean clinic (general, dental, orthopaedic) with a cross, an entrance canopy and a waiting room behind the glass; 2–4 storeys. */
export function clinic(style, rng, w, d) {
  const g = new THREE.Group();
  const s = side(rng);
  const floors = between(rng, 2, 4), H = floors * FLOOR + 0.6;
  const [name, col] = pick(rng, [['クリニック', '#279a4a'], ['内科 クリニック', '#1f6fd0'], ['歯科 DENTAL', '#2fb3b0'], ['整形外科', '#279a4a']]);
  const { bw, bd, bz, front } = body(g, style, w, d, H, pick(rng, [0xf4f6f4, 0xf2eee4, 0xdfe6ec]), { depth: 8 + rng() * 2 });
  shopWindow(g, style, 'clinic', bw * 0.55, 2.2, -s * bw * 0.15, 1.35, front + 0.04);
  g.add(box(1.4, 2.2, 0.08, style.material('glass', 0x9ab8c8), [s * bw * 0.28, 1.1, front + 0.04]));
  g.add(box(2.4, 0.15, 1.4, style.material('concrete', 0xd8dad8), [s * bw * 0.28, 2.6, front + 0.7])); // canopy
  const cross = style.material('light', parseInt(col.slice(1), 16));
  const c = new THREE.Group();
  c.add(box(0.8, 0.26, 0.14, cross), box(0.26, 0.8, 0.14, cross));
  c.position.set(-s * (bw / 2 - 0.8), FLOOR + 1.3, front + 0.12);
  g.add(c);
  signboard(g, style, name, '#ffffff', col, bw * 0.55, FLOOR + 0.5, front, 0.6);
  for (let f = 1; f < floors; f++) windowRow(g, style, bw, f * FLOOR + 1.6, front + 0.01, { spacing: 2.4, plain: f === 1 });
  roofTop(g, style, rng, bw, bd, bz, H, { pitched: 0.15 });
  const extras = frontExtras(g, style, rng, bw, front, { kinds: ['planter', 'bike'], max: 2, keepClear: [[s * bw * 0.28 - 1.3, s * bw * 0.28 + 1.3]] });
  return { group: g, footprint: { w: bw, d: bd, z: bz }, colliders: [solid(bw, bd, bz), ...extras] };
}

// --- 18. Fire station (消防署) ---------------------------------------------------------------
/** Big garage doors (some open, a red fire engine inside) and a hose tower with a siren; 2–3 storeys, tower on either side. */
export function fireStation(style, rng, w, d) {
  const g = new THREE.Group();
  const s = side(rng);
  const floors = between(rng, 2, 3), H = FLOOR * floors + 1;
  const wallHex = pick(rng, [0xe8e4dc, 0xd8d4cc, 0xc9c4b8, 0xe8dcc6]);
  const { bw, bd, bz, front } = body(g, style, w, d, H, wallHex, { depth: 10 + rng() * 1.5 });
  const red = style.material('signage', 0xd8302a);
  g.add(box(bw + 0.1, 0.5, 0.2, red, [0, FLOOR + 0.6, front + 0.06]));       // red band over the doors
  const bays = Math.max(1, Math.min(3, Math.floor(bw / 4.2)));
  const open = new Set([Math.floor(rng() * bays)]);
  if (bays > 1 && chance(rng, 0.4)) open.add(Math.floor(rng() * bays));
  for (let i = 0; i < bays; i++) {
    const x = -bw / 2 + (i + 0.5) * (bw / bays);
    const dw = bw / bays - 0.8;
    if (open.has(i)) {
      // an open bay: dark inside with the engine's nose showing
      g.add(box(dw, 3.4, 0.05, style.material('concrete', 0x3a3c40), [x, 1.7, front - 0.6]));
      const engine = new THREE.Group();
      engine.add(box(dw - 0.6, 2.4, 2.2, red, [0, 1.4, 0]));
      engine.add(box(dw - 0.8, 0.9, 0.05, style.material('glass', 0x9ab8c8), [0, 2.0, 1.11]));
      engine.add(box(dw - 0.6, 0.3, 0.05, style.material('light', 0xffffff), [0, 0.7, 1.11]));
      engine.position.set(x, 0, front - 0.2);
      g.add(engine);
    } else {
      g.add(box(dw, 3.4, 0.08, style.material('metal', 0xc8ccd0), [x, 1.7, front + 0.04]));
      for (let k = 1; k < 8; k++) g.add(box(dw, 0.04, 0.1, style.material('metal', 0xa8acb0), [x, k * 0.42, front + 0.06]));
    }
  }
  signboard(g, style, '消防署', '#ffffff', '#d8302a', Math.min(bw * 0.5, 5), FLOOR + 1.5, front, 0.7);
  for (let f = 1; f < floors; f++) windowRow(g, style, bw, f * FLOOR + 2.5, front + 0.01, { spacing: 2.6, plain: true });
  // hose tower with a siren on top, at the back on either side
  const th = H + 4 + rng() * 4;
  const tx = s * (bw / 2 - 1), tz = bz - bd / 2 + 1;
  g.add(box(2, th, 2, style.material('building', wallHex), [tx, th / 2, tz]));
  g.add(box(2.2, 0.3, 2.2, red, [tx, th, tz]));
  g.add(cyl(0.25, 0.25, 0.5, red, [tx, th + 0.5, tz], { segments: 8 }));
  roofTop(g, style, rng, bw, bd, bz, H, { pitched: 0, clutter: false });
  return { group: g, footprint: { w: bw, d: bd, z: bz }, colliders: [solid(bw, bd, bz)] };
}

// --- 21. Karaoke (カラオケ) -----------------------------------------------------------------
/** A tall narrow building with a big vertical sign and coloured windows; height, colours and sign side vary. */
export function karaoke(style, rng, w, d) {
  const g = new THREE.Group();
  const s = side(rng);
  const floors = between(rng, 4, 8), H = floors * FLOOR + 0.6;
  const { bw, bd, bz, front } = body(g, style, w, d, H, pick(rng, [0x3a2858, 0x2a3a58, 0x4a2a3a, 0x2a2a30, 0xe8e4dc]), { depth: 9 + rng() * 2 });
  const scheme = pick(rng, [[0xe8609a, 0x1fa3a0, 0xf0b818, 0x7a3fbf], [0xd8302a, 0xf2c230], [0x1f6fd0, 0x2fb3b0, 0xf2f2ee], [0xf08a2c, 0xe8609a]]);
  const main = scheme[0];
  shopWindow(g, style, 'karaoke', bw * 0.7, 2.2, -s * bw * 0.1, 1.4, front + 0.04, { frame: main });
  // coloured window panels up the building (rooms with the lights on)
  const n = Math.max(1, Math.floor((bw - 2) / pick(rng, [1.8, 2.4, 3.2])));
  for (let f = 1; f < floors; f++) {
    for (let i = 0; i < n; i++) {
      g.add(box(1.5, 1.2, 0.06, style.material('light', scheme[(f + i) % scheme.length]), [-bw / 2 + 1 + (i + 0.5) * ((bw - 2) / n), f * FLOOR + 1.7, front + 0.02]));
    }
  }
  // the big vertical sign
  const sh = Math.min(H - 4, 12);
  const word = pick(rng, ['カラオケ', 'KARAOKE', 'カラオケ館']);
  const tex = signTexture({ lines: [word], bg: hexOf(main), fg: '#ffffff', w: 32, h: 128, vertical: true });
  const sx = s * (bw / 2 - 0.2), sy = FLOOR + 1 + sh / 2;
  g.add(box(1.2, sh, 0.4, style.material('signage', main), [sx, sy, front + 0.5]));
  for (const sd of [1, -1]) {
    const f = face(1.1, sh * 0.96, style.material('light', 0xffffff, tex), [sx, sy, front + 0.5 + sd * 0.21]);
    if (sd < 0) f.rotation.y = Math.PI;
    g.add(f);
  }
  signboard(g, style, 'KARAOKE', hexOf(scheme[1] ?? main), '#ffffff', bw * 0.6, FLOOR + 0.5, front, 0.6);
  roofTop(g, style, rng, bw, bd, bz, H, { pitched: 0 });
  return { group: g, footprint: { w: bw, d: bd, z: bz }, colliders: [solid(bw, bd, bz)] };
}

// --- 22. Wooden apartment (アパート) ---------------------------------------------------------
/** The classic apartment: outside steel stairs, a walkway with railing, a row of doors; 2–3 storeys, stairs on either end. */
export function woodApartment(style, rng, w, d) {
  const g = new THREE.Group();
  const s = side(rng);
  const floors = pick(rng, [2, 2, 3]);
  const H = FLOOR * floors + 0.3;
  const wall = pick(rng, [0xd8c3a5, 0xc9c4b8, 0xe6d2c8, 0xb9c3c9, 0xe8e6e0]);
  const { bw, bd, bz, front } = body(g, style, w, d, H, wall, { depth: 7 + rng() * 1.5 });
  if (chance(rng, 0.7)) {
    const roof = gable(bw + 0.6, bd + 0.8, 1.2, style.material('roof', pick(rng, [0x4a5560, 0x6a4a3a, 0x3c4a5a, 0x7a3a32])));
    roof.position.set(0, H, bz);
    g.add(roof);
  } else roofTop(g, style, rng, bw, bd, bz, H, { pitched: 0 });
  const steel = style.material('metal', pick(rng, [0x8a8e94, 0x5a6a7a, 0x9a6a5a, 0xd8d8d0]));
  const doorM = style.material('wood', pick(rng, [0x8a6a48, 0x5a6a7a, 0xa8a49a, 0x4a5a4a]));
  const n = Math.max(2, Math.floor((bw - 2.5) / pick(rng, [2.4, 2.6, 3])));
  for (let fl = 0; fl < floors; fl++) {
    for (let i = 0; i < n; i++) {
      const x = -bw / 2 + 0.8 + (i + 0.5) * ((bw - 2.5) / n);
      g.add(box(0.85, 2.0, 0.06, doorM, [x, fl * FLOOR + 1.0, front + 0.03]));          // door
      g.add(box(0.6, 0.5, 0.06, style.material('window'), [x + 0.75, fl * FLOOR + 1.6, front + 0.03])); // small kitchen window
      g.add(box(0.25, 0.3, 0.2, style.material('metal', 0xb8bcc0), [x - 0.6, fl * FLOOR + 1.9, front + 0.1])); // meter box
    }
  }
  // walkways with railings along the front, held up by posts
  for (let fl = 1; fl < floors; fl++) {
    g.add(box(bw, 0.15, 1.1, steel, [0, fl * FLOOR, front + 0.55]));
    g.add(box(bw, 0.9, 0.05, steel, [0, fl * FLOOR + 0.5, front + 1.08]));
  }
  for (let i = 0; i <= n; i++) g.add(box(0.1, FLOOR * (floors - 1), 0.1, steel, [-bw / 2 + 0.1 + (i * (bw - 0.2)) / n, (FLOOR * (floors - 1)) / 2, front + 1.05]));
  // the outside staircase: straight flights along the front, just outside the railing
  const run = Math.min(4.4, bw * 0.45), sz = front + 1.6, top = s * (bw / 2 - 0.3);
  const steps = 10;
  for (let fl = 0; fl < floors - 1; fl++) {
    const dir = fl % 2 ? -1 : 1; // switch back on the next flight
    for (let k = 0; k < steps; k++) {
      const t = (k + 0.5) / steps;
      const x = dir > 0 ? top - s * run * (1 - t) : top - s * run * t;
      g.add(box(run / steps + 0.02, 0.06, 0.9, steel, [x, fl * FLOOR + FLOOR * t, sz]));
    }
  }
  const nameBoard = pick(rng, ['コーポ', 'ハイツ', '荘', 'メゾン']);
  signboard(g, style, nameBoard, '#f4f1e6', '#5a3a28', 1.6, FLOOR - 0.5, front + 0.04, 0.35);
  return { group: g, footprint: { w: bw, d: bd, z: bz }, colliders: [solid(bw, bd + 1.2, bz + 0.6), { x: top - s * run / 2, z: sz, hw: run / 2, hd: 0.5 }] };
}

// --- 23. Parking garage (駐車場) -------------------------------------------------------------
/** An open-sided concrete car park on 2–4 levels, cars inside, a big P on either corner. */
export function parkingGarage(style, rng, w, d) {
  const g = new THREE.Group();
  const s = side(rng);
  const levels = between(rng, 2, 4), LH = 2.8;
  const bw = w - 0.4, bd = Math.min(d - 1.5, 11), bz = -d / 2 + bd / 2 + 0.3, front = bz + bd / 2;
  const concrete = style.material('concrete', pick(rng, [0xb8b4aa, 0xc8c4bc, 0xa8a49a]));
  const trim = style.material('signage', pick(rng, [0x1f4fa8, 0x2fa36b, 0xf2c230, 0xd8302a]));
  for (let l = 0; l <= levels; l++) g.add(box(bw, 0.3, bd, concrete, [0, l * LH + 0.15, bz]));
  for (let l = 1; l <= levels; l++) {
    g.add(box(bw, 0.9, 0.2, concrete, [0, l * LH + 0.6, front - 0.1])); // parapets
    if (chance(rng, 0.5)) g.add(box(bw, 0.12, 0.22, trim, [0, l * LH + 1.0, front - 0.1])); // coloured edge
  }
  const cols = Math.max(2, Math.round(bw / (4 + rng() * 2)));
  for (let i = 0; i <= cols; i++) for (const zz of [front - 0.3, bz - bd / 2 + 0.3]) {
    g.add(box(0.4, levels * LH, 0.4, concrete, [-bw / 2 + 0.2 + (i * (bw - 0.4)) / cols, (levels * LH) / 2, zz]));
  }
  // parked cars on each level, side by side facing the street
  const colors = ['White', 'Gray', 'Black', 'Blue', 'Red'];
  const full = 0.4 + rng() * 0.5;
  for (let l = 0; l < levels; l++) {
    for (let i = 0; i < Math.floor(bw / 2.6); i++) {
      if (rng() > full) continue;
      const c = car.build({ variant: pick(rng, ['Kei car', 'Sedan', 'Minivan']), color: pick(rng, colors) }, style);
      c.position.set(-bw / 2 + 1.3 + i * 2.6, l * LH + 0.3, front - 3);
      g.add(c);
    }
  }
  // the big P
  const tex = signTexture({ lines: ['P'], bg: '#1f4fa8', fg: '#ffffff', w: 64, h: 64 });
  const px = s * (bw / 2 - 1);
  g.add(box(1.6, 1.6, 0.2, style.material('signage', 0x1f4fa8), [px, levels * LH + 1.2, front]));
  g.add(face(1.5, 1.5, style.material('light', 0xffffff, tex), [px, levels * LH + 1.2, front + 0.11]));
  signboard(g, style, pick(rng, ['駐車場', 'PARKING', '月極駐車場']), '#1f4fa8', '#ffffff', 2.6, LH - 0.5, front + 0.05, 0.5);
  return { group: g, footprint: { w: bw, d: bd, z: bz }, colliders: [solid(bw, bd, bz)] };
}

// --- 24. Gas station (ガソリンスタンド) ---------------------------------------------------------
/** A canopy over 1–3 pump islands, a tall price sign, a small shop at the back on either side, sometimes a car filling up. */
export function gasStation(style, rng, w, d) {
  const g = new THREE.Group();
  const s = side(rng);
  const colliders = [];
  const brand = pick(rng, [[0xd8302a, '#d8302a'], [0x1f4fa8, '#1f4fa8'], [0x279a4a, '#279a4a'], [0xf08a2c, '#f08a2c']]);
  const red = style.material('signage', brand[0]);
  g.add(box(w, 0.05, d, style.material('concrete', 0xc8c4bc), [0, 0.03, 0]));            // forecourt
  // the shop at the back, to one side
  const kw = Math.min(w - 2, 5 + rng() * 4), kd = 4, kz = -d / 2 + kd / 2 + 0.3;
  const kx = s * (w - kw) * 0.3;
  g.add(box(kw, 3.2, kd, style.material('building', pick(rng, [0xf2f2ee, 0xe8e6e0, 0xdfe6ec])), [kx, 1.6, kz]));
  shopWindow(g, style, 'konbini', kw * 0.6, 1.8, kx - kw * 0.12, 1.2, kz + kd / 2 + 0.03);
  g.add(box(kw + 0.1, 0.4, 0.2, red, [kx, 3.0, kz + kd / 2 + 0.1]));
  colliders.push({ x: kx, z: kz, hw: kw / 2, hd: kd / 2 });
  // the canopy on four posts over the pump islands
  const islands = w > 13 ? between(rng, 2, 3) : between(rng, 1, 2);
  const cz = kz + kd / 2 + 3.6, cw = Math.min(w - 1.5, 4 + islands * 3.2), cd = 5;
  g.add(box(cw, 0.6, cd, style.material('metal', 0xf2f2ee), [0, 4.6, cz]));
  g.add(box(cw + 0.05, 0.35, cd + 0.05, red, [0, 4.55, cz]));
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    g.add(box(0.3, 4.3, 0.3, style.material('metal', 0xd8d8d0), [sx * (cw / 2 - 0.6), 2.15, cz + sz * (cd / 2 - 0.6)]));
    colliders.push({ x: sx * (cw / 2 - 0.6), z: cz + sz * (cd / 2 - 0.6), hw: 0.2, hd: 0.2 });
  }
  const xs = [];
  for (let i = 0; i < islands; i++) {
    const x = -cw / 2 + (i + 0.5) * (cw / islands);
    xs.push(x);
    g.add(box(0.8, 0.2, 2.4, style.material('concrete', 0xb8b4aa), [x, 0.1, cz]));       // island
    g.add(box(0.6, 1.6, 0.5, style.material('metal', 0xf2f2ee), [x, 1.0, cz]));           // pump
    g.add(box(0.62, 0.35, 0.52, red, [x, 1.6, cz]));
    g.add(box(0.35, 0.25, 0.04, style.material('light', 0x9ad8f0), [x, 1.2, cz + 0.27]));
    colliders.push({ x, z: cz, hw: 0.45, hd: 1.2 });
  }
  if (chance(rng, 0.5)) {
    // a car filling up beside an island
    const x = xs[Math.floor(rng() * xs.length)] + 1.5;
    const c = car.build({ variant: pick(rng, ['Kei car', 'Sedan', 'Minivan', 'Taxi']), color: pick(rng, ['White', 'Gray', 'Black', 'Blue', 'Red']) }, style);
    c.position.set(x, 0, cz);
    g.add(c);
    colliders.push({ x, z: cz, hw: 0.9, hd: 2.2 });
  }
  // tall price sign at the street corner
  const px = -s * (w / 2 - 0.8), pz = d / 2 - 0.6;
  g.add(box(0.25, 5, 0.25, style.material('metal', 0x9aa0a6), [px, 2.5, pz]));
  const price = 160 + Math.floor(rng() * 25);
  const tex = signTexture({ lines: ['レギュラー', `¥${price}`], bg: '#ffffff', fg: brand[1], w: 64, h: 96 });
  g.add(box(1.3, 2.0, 0.25, red, [px, 5.6, pz]));
  g.add(face(1.2, 1.8, style.material('light', 0xffffff, tex), [px, 5.6, pz + 0.13]));
  colliders.push({ x: px, z: pz, hw: 0.2, hd: 0.2 });
  return { group: g, footprint: { w: kw, d: kd, z: kz }, colliders };
}

/** For the catalogue: id -> [builder, label, typical lot width, depth]. */
export const CIVIC_BUILDINGS = {
  udonSoba: [udonSoba, 'Udon / soba shop', 9, 12],
  familyRestaurant: [familyRestaurant, 'Family restaurant', 14, 12],
  takoyaki: [takoyaki, 'Takoyaki stand', 6, 8],
  koban: [koban, 'Koban (police box)', 8, 10],
  postOffice: [postOffice, 'Post office', 12, 12],
  bank: [bank, 'Bank', 12, 12],
  clinic: [clinic, 'Clinic', 10, 12],
  fireStation: [fireStation, 'Fire station', 14, 14],
  karaoke: [karaoke, 'Karaoke', 9, 12],
  woodApartment: [woodApartment, 'Wooden apartment', 12, 11],
  parkingGarage: [parkingGarage, 'Parking garage', 14, 12],
  gasStation: [gasStation, 'Gas station', 16, 16],
};
