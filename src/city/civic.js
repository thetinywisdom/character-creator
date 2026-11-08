import * as THREE from 'three';
import { signTexture } from '../lib/textures.js';
import { box, cyl, face } from '../props/util.js';
import { bicycle, car } from '../props/vehicles.js';
import { postBox } from '../props/furniture.js';
import { FLOOR, gable, windowRow } from './buildings.js';
import { shopWindow, interiorPanel } from './interiors.js';
import { awning, body, noren, projectingSign, signboard, solid, upperFloors } from './shops.js';

// Batches 2 and 3: food places, public buildings and others. Same contract as
// shops.js: fill a lot w × d facing +z, stand on y = 0, return
// { group, footprint, colliders }. Windows show painted interiors.

const pick = (rng, arr) => arr[Math.floor(rng() * arr.length)];

// --- 11. Udon / soba shop (うどん・そば) ------------------------------------------------
/** A low wooden shop with a dark tiled roof sloping to the street and a noren. */
export function udonSoba(style, rng, w, d) {
  const g = new THREE.Group();
  const H = 3.4;
  const { bw, bd, bz, front } = body(g, style, w, d, H, 0xe8dcc6, { depth: 9 });
  const wood = style.material('wood', 0x6a4429);
  g.add(box(bw, H, 0.2, wood, [0, H / 2, front + 0.05]));
  const roof = gable(bw + 0.8, bd + 1.4, 1.6, style.material('roof', 0x3a3f44));
  roof.position.set(0, H, bz);
  g.add(roof);
  shopWindow(g, style, 'udon', Math.min(bw * 0.45, 3), 1.2, -bw * 0.2, 1.5, front + 0.18, { mullions: 3, frame: 0x3a2418 });
  g.add(box(1.4, 2.1, 0.06, style.material('wood', 0xb89a68), [bw * 0.22, 1.05, front + 0.16]));
  noren(g, style, bw * 0.22, 1.75, front + 0.3, 0xf4ecd8, 'うどん', '#2a2018');
  signboard(g, style, 'うどん・そば', '#f4ecd8', '#2a2018', Math.min(bw * 0.7, 4.5), H - 0.45, front + 0.05, 0.6);
  return { group: g, footprint: { w: bw, d: bd, z: bz }, colliders: [solid(bw, bd, bz)] };
}

// --- 12. Family restaurant (ファミレス) ---------------------------------------------------
/** A wide single-storey restaurant with big windows all along and a tall pole sign. */
export function familyRestaurant(style, rng, w, d) {
  const g = new THREE.Group();
  const H = 4.2;
  const { bw, bd, bz, front } = body(g, style, w, d, H, 0xf2e6cc, { depth: 9.5 });
  g.add(box(bw + 0.2, 0.5, bd + 0.2, style.material('signage', 0xd8302a), [0, H - 0.25, bz])); // red roof band
  const n = Math.max(1, Math.floor(bw / 3.2));
  for (let i = 0; i < n; i++) {
    const x = -bw / 2 + (i + 0.5) * (bw / n);
    if (i === n - 1 && n > 1) g.add(box(1.4, 2.3, 0.08, style.material('window'), [x, 1.15, front + 0.05])); // door
    else shopWindow(g, style, 'family', bw / n - 0.5, 2, x, 1.5, front + 0.04, { mullions: 2 });
  }
  // tall pole sign by the street
  const px = -bw / 2 + 0.6, pz = d / 2 - 0.6;
  g.add(cyl(0.12, 0.12, 6, style.material('metal', 0x9aa0a6), [px, 3, pz], { segments: 8 }));
  const tex = signTexture({ lines: ['ファミレス'], bg: '#d8302a', fg: '#ffffff', w: 96, h: 64 });
  g.add(box(1.8, 1.2, 0.3, style.material('signage', 0xd8302a), [px, 6.2, pz]));
  for (const s of [1, -1]) {
    const f = face(1.7, 1.1, style.material('light', 0xffffff, tex), [px, 6.2, pz + s * 0.16]);
    if (s < 0) f.rotation.y = Math.PI;
    g.add(f);
  }
  return { group: g, footprint: { w: bw, d: bd, z: bz }, colliders: [solid(bw, bd, bz), { x: px, z: pz, hw: 0.2, hd: 0.2 }] };
}

// --- 13. Takoyaki stand (たこ焼き) ---------------------------------------------------------
/** A small kiosk with an open counter, a griddle, an octopus sign and a bench. */
export function takoyaki(style, rng, w, d) {
  const g = new THREE.Group();
  const kw = Math.min(w - 1, 4.5), kd = 3, H = 2.8;
  const kz = -d / 2 + kd / 2 + 2;
  const wall = style.material('building', 0xf2e2c4);
  g.add(box(kw, H, kd, wall, [0, H / 2, kz]));
  const front = kz + kd / 2;
  // open counter: the painted inside above a counter shelf
  g.add(interiorPanel(style, 'takoyaki', kw - 0.4, 1.2, 0, 1.75, front - 0.02));
  g.add(box(kw - 0.2, 0.1, 0.5, style.material('wood', 0x8a5a36), [0, 1.1, front + 0.2]));
  g.add(box(kw - 0.2, 1.05, 0.08, style.material('wood', 0x6a4429), [0, 0.53, front + 0.02]));
  awning(g, style, [0xd8302a, 0xf2f2ee], kw, H - 0.2, front, 0.9);
  // the octopus sign on the roof: a round red sign with text
  const tex = signTexture({ lines: ['たこ焼き'], bg: '#d8302a', fg: '#ffffff', w: 64, h: 64, shape: 'circle' });
  const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.75, 0.12, 16), style.material('signage', 0xd8302a));
  disc.rotation.x = Math.PI / 2;
  disc.position.set(0, H + 0.8, front - 0.3);
  g.add(disc, face(1.3, 1.3, style.material('light', 0xffffff, tex), [0, H + 0.8, front - 0.23]));
  // a red bench to eat at
  g.add(box(1.6, 0.08, 0.45, style.material('signage', 0xd8302a), [kw / 2 - 0.8, 0.45, front + 1.6]));
  for (const sx of [-1, 1]) g.add(box(0.08, 0.45, 0.4, style.material('darkMetal'), [kw / 2 - 0.8 + sx * 0.7, 0.22, front + 1.6]));
  return { group: g, footprint: { w: kw, d: kd, z: kz }, colliders: [solid(kw, kd, kz)] };
}

// --- 14. Koban (交番) ---------------------------------------------------------------------
/** A small police box: white walls, a peaked roof, the red lamp over the door, a bicycle. */
export function koban(style, rng, w, d) {
  const g = new THREE.Group();
  const kw = Math.min(w - 1, 6), kd = 5, H = 3.2;
  const kz = -d / 2 + kd / 2 + 2.5;
  g.add(box(kw, H, kd, style.material('building', 0xf2f2ee), [0, H / 2, kz]));
  const front = kz + kd / 2;
  const roof = gable(kd + 0.8, kw + 0.6, 1.2, style.material('roof', 0x5a6068));
  roof.rotation.y = Math.PI / 2; // ridge runs front to back, gable end to the street
  roof.position.set(0, H, kz);
  g.add(roof);
  shopWindow(g, style, 'koban', kw * 0.4, 1.3, -kw * 0.22, 1.55, front + 0.03, { mullions: 2 });
  g.add(box(1.1, 2.2, 0.08, style.material('glass', 0x8a99a8), [kw * 0.25, 1.1, front + 0.03]));
  // the red lamp over the door and the KOBAN sign
  const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 8), style.material('light', 0xe0402f));
  lamp.position.set(kw * 0.25, 2.65, front + 0.25);
  g.add(lamp, box(0.06, 0.06, 0.25, style.material('darkMetal'), [kw * 0.25, 2.65, front + 0.1]));
  signboard(g, style, '交番 KOBAN', '#2c3a5a', '#ffffff', kw * 0.8, H - 0.3, front, 0.45);
  // a white police bicycle parked out front
  const bike = bicycle.build({ color: 'White' }, style);
  bike.position.set(-kw / 2 - 0.2, 0, front + 1.2);
  bike.rotation.y = Math.PI / 2;
  g.add(bike);
  return { group: g, footprint: { w: kw, d: kd, z: kz }, colliders: [solid(kw, kd, kz)] };
}

// --- 15. Post office (郵便局) ---------------------------------------------------------------
/** A two-storey post office with the red 〒 mark, a glass front and a post box outside. */
export function postOffice(style, rng, w, d) {
  const g = new THREE.Group();
  const H = FLOOR * 2 + 0.6;
  const { bw, bd, bz, front } = body(g, style, w, d, H, 0xf2f2ee, { depth: 10 });
  shopWindow(g, style, 'post', bw * 0.8, 2.3, 0, 1.3, front + 0.04);
  g.add(box(bw + 0.1, 0.3, 0.3, style.material('signage', 0xe84a2a), [0, FLOOR - 0.2, front + 0.1])); // red band
  signboard(g, style, '〒 郵便局', '#ffffff', '#e84a2a', bw * 0.6, FLOOR + 0.6, front, 0.7);
  upperFloors(g, style, bw, FLOOR, 1, front);
  const pb = postBox.build({}, style);
  pb.position.set(bw / 2 - 0.6, 0, front + 1.2);
  g.add(pb);
  return { group: g, footprint: { w: bw, d: bd, z: bz }, colliders: [solid(bw, bd, bz), { x: bw / 2 - 0.6, z: front + 1.2, hw: 0.25, hd: 0.25 }] };
}

// --- 16. Bank (銀行) ----------------------------------------------------------------------
/** A three-storey stone-look bank: pillars at the entrance, a corporate sign, an ATM corner. */
export function bank(style, rng, w, d) {
  const g = new THREE.Group();
  const floors = 3, H = floors * FLOOR + 0.6;
  const stone = 0xc9c4b8;
  const { bw, bd, bz, front } = body(g, style, w, d, H, stone, { depth: 10 });
  shopWindow(g, style, 'bank', bw * 0.6, 2.3, -bw * 0.12, 1.4, front + 0.04);
  for (const x of [-bw * 0.45, bw * 0.2]) g.add(box(0.5, FLOOR, 0.5, style.material('concrete', 0xb0aa9e), [x, FLOOR / 2, front + 0.25]));
  // ATM corner: a lit booth with a blue sign
  g.add(box(1.2, 2.2, 0.5, style.material('metal', 0xd8d8d0), [bw / 2 - 0.9, 1.1, front + 0.1]));
  g.add(box(0.6, 0.45, 0.05, style.material('light', 0x6ab8e8), [bw / 2 - 0.9, 1.35, front + 0.37]));
  signboard(g, style, 'ATM', '#1f4fa8', '#ffffff', 1.1, 2.45, front + 0.1, 0.35);
  signboard(g, style, '銀行 BANK', '#1f3a6a', '#ffffff', bw * 0.7, FLOOR + 0.6, front, 0.8);
  upperFloors(g, style, bw, FLOOR, floors - 1, front);
  return { group: g, footprint: { w: bw, d: bd, z: bz }, colliders: [solid(bw, bd, bz)] };
}

// --- 17. Clinic (クリニック) ----------------------------------------------------------------
/** A clean white clinic with a green cross, an entrance canopy and a waiting room behind the glass. */
export function clinic(style, rng, w, d) {
  const g = new THREE.Group();
  const floors = 2, H = floors * FLOOR + 0.6;
  const { bw, bd, bz, front } = body(g, style, w, d, H, 0xf4f6f4, { depth: 10 });
  shopWindow(g, style, 'clinic', bw * 0.55, 2.2, -bw * 0.15, 1.35, front + 0.04);
  g.add(box(1.4, 2.2, 0.08, style.material('glass', 0x9ab8c8), [bw * 0.28, 1.1, front + 0.04]));
  g.add(box(2.4, 0.15, 1.4, style.material('concrete', 0xd8dad8), [bw * 0.28, 2.6, front + 0.7])); // canopy
  const cross = style.material('light', 0x37c26a);
  const c = new THREE.Group();
  c.add(box(0.8, 0.26, 0.14, cross), box(0.26, 0.8, 0.14, cross));
  c.position.set(-bw / 2 + 0.8, FLOOR + 1.3, front + 0.12);
  g.add(c);
  signboard(g, style, 'クリニック', '#ffffff', '#279a4a', bw * 0.55, FLOOR + 0.5, front, 0.6);
  upperFloors(g, style, bw, FLOOR, floors - 1, front);
  return { group: g, footprint: { w: bw, d: bd, z: bz }, colliders: [solid(bw, bd, bz)] };
}

// --- 18. Fire station (消防署) ---------------------------------------------------------------
/** Big garage doors, one open with a red fire engine inside, and a hose tower with a siren. */
export function fireStation(style, rng, w, d) {
  const g = new THREE.Group();
  const H = FLOOR * 2 + 1;
  const { bw, bd, bz, front } = body(g, style, w, d, H, 0xe8e4dc, { depth: 11 });
  const red = style.material('signage', 0xd8302a);
  g.add(box(bw + 0.1, 0.5, 0.2, red, [0, FLOOR + 0.6, front + 0.06]));       // red band over the doors
  const bays = Math.max(1, Math.min(3, Math.floor(bw / 4.2)));
  for (let i = 0; i < bays; i++) {
    const x = -bw / 2 + (i + 0.5) * (bw / bays);
    const dw = bw / bays - 0.8;
    if (i === 0) {
      // the open bay: dark inside with the engine's nose showing
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
  windowRow(g, style, bw, FLOOR + 2.5, front + 0.01, { spacing: 2.6, plain: true });
  // hose tower with a siren on top
  const tx = bw / 2 - 1, tz = bz - bd / 2 + 1;
  g.add(box(2, H + 6, 2, style.material('building', 0xe8e4dc), [tx, (H + 6) / 2, tz]));
  g.add(box(2.2, 0.3, 2.2, red, [tx, H + 6, tz]));
  g.add(cyl(0.25, 0.25, 0.5, red, [tx, H + 6.5, tz], { segments: 8 }));
  return { group: g, footprint: { w: bw, d: bd, z: bz }, colliders: [solid(bw, bd, bz)] };
}

// --- 21. Karaoke (カラオケ) -----------------------------------------------------------------
/** A tall narrow building with a big colourful vertical sign and coloured windows. */
export function karaoke(style, rng, w, d) {
  const g = new THREE.Group();
  const floors = 5 + Math.floor(rng() * 2), H = floors * FLOOR + 0.6;
  const { bw, bd, bz, front } = body(g, style, w, d, H, pick(rng, [0x3a2858, 0x2a3a58, 0x4a2a3a]), { depth: 10 });
  shopWindow(g, style, 'karaoke', bw * 0.7, 2.2, -bw * 0.1, 1.4, front + 0.04, { frame: 0xe8609a });
  // coloured window panels up the building (rooms with the lights on)
  const COLS = [0xe8609a, 0x1fa3a0, 0xf0b818, 0x7a3fbf];
  for (let f = 1; f < floors; f++) {
    const n = Math.max(1, Math.floor((bw - 2) / 2.4));
    for (let i = 0; i < n; i++) {
      g.add(box(1.5, 1.2, 0.06, style.material('light', COLS[(f + i) % COLS.length]), [-bw / 2 + 1 + (i + 0.5) * ((bw - 2) / n), f * FLOOR + 1.7, front + 0.02]));
    }
  }
  // the big vertical sign
  const sh = Math.min(H - 4, 12);
  const tex = signTexture({ lines: ['カラオケ'], bg: '#e8609a', fg: '#ffffff', w: 32, h: 128, vertical: true });
  const sx = bw / 2 - 0.2, sy = FLOOR + 1 + sh / 2;
  g.add(box(1.2, sh, 0.4, style.material('signage', 0xe8609a), [sx, sy, front + 0.5]));
  for (const s of [1, -1]) {
    const f = face(1.1, sh * 0.96, style.material('light', 0xffffff, tex), [sx, sy, front + 0.5 + s * 0.21]);
    if (s < 0) f.rotation.y = Math.PI;
    g.add(f);
  }
  signboard(g, style, 'KARAOKE', '#1fa3a0', '#ffffff', bw * 0.6, FLOOR + 0.5, front, 0.6);
  return { group: g, footprint: { w: bw, d: bd, z: bz }, colliders: [solid(bw, bd, bz)] };
}

// --- 22. Wooden apartment (アパート) ---------------------------------------------------------
/** The classic two-storey apartment: outside steel stairs, a walkway with railing, a row of doors. */
export function woodApartment(style, rng, w, d) {
  const g = new THREE.Group();
  const H = FLOOR * 2 + 0.3;
  const wall = pick(rng, [0xd8c3a5, 0xc9c4b8, 0xe6d2c8, 0xb9c3c9]);
  const { bw, bd, bz, front } = body(g, style, w, d, H, wall, { depth: 8 });
  const roof = gable(bw + 0.6, bd + 0.8, 1.2, style.material('roof', pick(rng, [0x4a5560, 0x6a4a3a, 0x3c4a5a])));
  roof.position.set(0, H, bz);
  g.add(roof);
  const steel = style.material('metal', 0x8a8e94);
  const doorM = style.material('wood', pick(rng, [0x8a6a48, 0x5a6a7a, 0xa8a49a]));
  const n = Math.max(2, Math.floor((bw - 2.5) / 2.6));
  for (let fl = 0; fl < 2; fl++) {
    for (let i = 0; i < n; i++) {
      const x = -bw / 2 + 0.8 + (i + 0.5) * ((bw - 2.5) / n);
      g.add(box(0.85, 2.0, 0.06, doorM, [x, fl * FLOOR + 1.0, front + 0.03]));          // door
      g.add(box(0.6, 0.5, 0.06, style.material('window'), [x + 0.75, fl * FLOOR + 1.6, front + 0.03])); // small kitchen window
      g.add(box(0.25, 0.3, 0.2, style.material('metal', 0xb8bcc0), [x - 0.6, fl * FLOOR + 1.9, front + 0.1])); // meter box
    }
  }
  // upper walkway with railing along the whole front, held up by posts
  g.add(box(bw, 0.15, 1.1, steel, [0, FLOOR, front + 0.55]));
  g.add(box(bw, 0.9, 0.05, steel, [0, FLOOR + 0.5, front + 1.08]));
  for (let i = 0; i <= n; i++) g.add(box(0.1, FLOOR, 0.1, steel, [-bw / 2 + 0.1 + (i * (bw - 0.2)) / n, FLOOR / 2, front + 1.05]));
  // the outside staircase: a straight flight down along the front, from the
  // walkway's end toward the middle, just outside the railing
  const run = Math.min(4.4, bw * 0.45), sz = front + 1.6, top = bw / 2 - 0.3;
  const steps = 10;
  for (let k = 0; k < steps; k++) {
    const t = (k + 0.5) / steps;
    g.add(box(run / steps + 0.02, 0.06, 0.9, steel, [top - run * (1 - t), FLOOR * t, sz]));
  }
  for (const side of [-1, 1]) { // the two stringers
    const str = box(Math.hypot(run, FLOOR), 0.16, 0.06, steel, [top - run / 2, FLOOR / 2, sz + side * 0.47]);
    str.rotation.z = Math.atan2(FLOOR, run);
    g.add(str);
  }
  signboard(g, style, 'コーポ', '#f4f1e6', '#5a3a28', 1.6, FLOOR - 0.5, front - 0.08 + 0.12, 0.35);
  return { group: g, footprint: { w: bw, d: bd, z: bz }, colliders: [solid(bw, bd + 1.2, bz + 0.6), { x: top - run / 2, z: sz, hw: run / 2, hd: 0.5 }] };
}

// --- 23. Parking garage (駐車場) -------------------------------------------------------------
/** An open-sided concrete car park on three levels, cars inside, a big blue P. */
export function parkingGarage(style, rng, w, d) {
  const g = new THREE.Group();
  const levels = 3, LH = 2.8;
  const bw = w - 0.4, bd = Math.min(d - 1.5, 11), bz = -d / 2 + bd / 2 + 0.3, front = bz + bd / 2;
  const concrete = style.material('concrete', 0xb8b4aa);
  for (let l = 0; l <= levels; l++) g.add(box(bw, 0.3, bd, concrete, [0, l * LH + 0.15, bz]));
  for (let l = 1; l <= levels; l++) g.add(box(bw, 0.9, 0.2, concrete, [0, l * LH + 0.6, front - 0.1])); // parapets
  const cols = Math.max(2, Math.round(bw / 5));
  for (let i = 0; i <= cols; i++) for (const zz of [front - 0.3, bz - bd / 2 + 0.3]) {
    g.add(box(0.4, levels * LH, 0.4, concrete, [-bw / 2 + 0.2 + (i * (bw - 0.4)) / cols, (levels * LH) / 2, zz]));
  }
  // parked cars on each level, side by side facing the street
  const colors = ['White', 'Gray', 'Black', 'Blue', 'Red'];
  for (let l = 0; l < levels; l++) {
    for (let i = 0; i < Math.floor(bw / 2.6); i++) {
      if (rng() < 0.35) continue;
      const c = car.build({ variant: pick(rng, ['Kei car', 'Sedan', 'Minivan']), color: pick(rng, colors) }, style);
      c.position.set(-bw / 2 + 1.3 + i * 2.6, l * LH + 0.3, front - 3);
      g.add(c);
    }
  }
  // the big P
  const tex = signTexture({ lines: ['P'], bg: '#1f4fa8', fg: '#ffffff', w: 64, h: 64 });
  g.add(box(1.6, 1.6, 0.2, style.material('signage', 0x1f4fa8), [bw / 2 - 1, levels * LH + 1.2, front]));
  g.add(face(1.5, 1.5, style.material('light', 0xffffff, tex), [bw / 2 - 1, levels * LH + 1.2, front + 0.11]));
  signboard(g, style, '駐車場', '#1f4fa8', '#ffffff', 2.6, LH - 0.5, front + 0.05, 0.5);
  return { group: g, footprint: { w: bw, d: bd, z: bz }, colliders: [solid(bw, bd, bz)] };
}

// --- 24. Gas station (ガソリンスタンド) ---------------------------------------------------------
/** A canopy over two pump islands, a tall price sign, and a small shop at the back. */
export function gasStation(style, rng, w, d) {
  const g = new THREE.Group();
  const colliders = [];
  const brand = pick(rng, [[0xd8302a, '#d8302a'], [0x1f4fa8, '#1f4fa8'], [0x279a4a, '#279a4a']]);
  const red = style.material('signage', brand[0]);
  g.add(box(w, 0.05, d, style.material('concrete', 0xc8c4bc), [0, 0.03, 0]));            // forecourt
  // the shop at the back
  const kw = Math.min(w - 2, 8), kd = 4, kz = -d / 2 + kd / 2 + 0.3;
  g.add(box(kw, 3.2, kd, style.material('building', 0xf2f2ee), [0, 1.6, kz]));
  shopWindow(g, style, 'konbini', kw * 0.6, 1.8, -kw * 0.12, 1.2, kz + kd / 2 + 0.03);
  g.add(box(kw + 0.1, 0.4, 0.2, red, [0, 3.0, kz + kd / 2 + 0.1]));
  colliders.push(solid(kw, kd, kz));
  // the canopy on four posts over two pump islands
  const cz = kz + kd / 2 + 3.6, cw = Math.min(w - 1.5, 10), cd = 5;
  g.add(box(cw, 0.6, cd, style.material('metal', 0xf2f2ee), [0, 4.6, cz]));
  g.add(box(cw + 0.05, 0.35, cd + 0.05, red, [0, 4.55, cz]));
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    g.add(box(0.3, 4.3, 0.3, style.material('metal', 0xd8d8d0), [sx * (cw / 2 - 0.6), 2.15, cz + sz * (cd / 2 - 0.6)]));
    colliders.push({ x: sx * (cw / 2 - 0.6), z: cz + sz * (cd / 2 - 0.6), hw: 0.2, hd: 0.2 });
  }
  for (const sx of [-1, 1]) {
    const x = sx * cw * 0.22;
    g.add(box(0.8, 0.2, 2.4, style.material('concrete', 0xb8b4aa), [x, 0.1, cz]));       // island
    g.add(box(0.6, 1.6, 0.5, style.material('metal', 0xf2f2ee), [x, 1.0, cz]));           // pump
    g.add(box(0.62, 0.35, 0.52, red, [x, 1.6, cz]));
    g.add(box(0.35, 0.25, 0.04, style.material('light', 0x9ad8f0), [x, 1.2, cz + 0.27]));
    colliders.push({ x, z: cz, hw: 0.45, hd: 1.2 });
  }
  // tall price sign at the street corner
  const px = w / 2 - 0.8, pz = d / 2 - 0.6;
  g.add(box(0.25, 5, 0.25, style.material('metal', 0x9aa0a6), [px, 2.5, pz]));
  const tex = signTexture({ lines: ['レギュラー', '¥172'], bg: '#ffffff', fg: brand[1], w: 64, h: 96 });
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
