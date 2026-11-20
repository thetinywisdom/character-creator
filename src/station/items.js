import * as THREE from 'three';
import { PALETTE } from '../styles/palette.js';
import { mergeByMaterial } from '../lib/merge.js';
import manifest from '../../public/station-kit/manifest.json';
import { stationPlan } from './arrange.js';

// A 16 × 6 m train platform with ticket gates. Built here, not loaded, so
// createAsset stays synchronous. Every colour is `role:Swatch` through
// style.material. The floor is one solid concrete colour. The yellow edge
// is a single raised strip, not a tiled pattern. Departure boards and signs
// are blocks of colour, with no text.
//
// Origin at the bottom centre, the platform edge toward +z. Cutaway hides
// the +x end wall and the right-hand roof deck. Beams, pillars and the
// left-hand canopy stay, so the cutaway still shows the concourse.

const P = Math.PI;
const SLAB_TOP = 0.02;
const TILE_TOP = SLAB_TOP + 0.05;

const WIN = { w: 1.7, h: 0.95, d: 0.08 };
const DOOR = { w: 1.15, h: 2.2, d: 0.08 };
const LIP = 0.05;
const TH = 0.14;
const ROOF_Y = 3.16;

const glassOf = new WeakMap();

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

const BUILDERS = {
  ticket_gate(g, style) {
    const body = mat(style, 'metal:Light gray');
    const dark = mat(style, 'darkMetal:Ink');
    addBox(g, 0.46, 0.88, 0.4, body, [0, 0.44, 0]);
    addBox(g, 0.5, 0.05, 0.44, dark, [0, 0.9, 0]);
    addBox(g, 0.22, 0.12, 0.012, mat(style, 'glass:Navy'), [0, 0.68, 0.208]);
    addBox(g, 0.28, 0.035, 0.016, mat(style, 'paint:Sage'), [0, 0.48, 0.208]);
    addBox(g, 0.08, 0.035, 0.08, mat(style, 'light:Butter'), [0, 0.95, 0]);
    addBox(g, 0.02, 0.26, 0.2, dark, [0.24, 0.52, 0.02]);
  },
  ticket_machine(g, style) {
    const body = mat(style, 'paint:Off white');
    const dark = mat(style, 'darkMetal:Charcoal');
    addBox(g, 0.64, 0.08, 0.46, dark, [0, 0.04, 0]);
    addBox(g, 0.58, 1.42, 0.4, body, [0, 0.78, 0]);
    addBox(g, 0.36, 0.26, 0.016, mat(style, 'glass:Navy'), [0, 1.22, 0.208]);
    addBox(g, 0.32, 0.07, 0.016, mat(style, 'paint:Powder blue'), [0, 0.92, 0.208]);
    addBox(g, 0.18, 0.03, 0.02, dark, [0, 0.7, 0.21]);
    for (const x of [-0.12, 0, 0.12]) addBox(g, 0.055, 0.035, 0.016, mat(style, 'paint:Butter'), [x, 0.56, 0.208]);
  },
  bench(g, style) {
    const wood = mat(style, 'wood:Walnut');
    const metal = mat(style, 'darkMetal:Charcoal');
    addBox(g, 1.4, 0.06, 0.34, wood, [0, 0.46, 0]);
    addBox(g, 1.4, 0.26, 0.04, wood, [0, 0.62, -0.14]);
    for (const x of [-0.56, 0.56]) {
      addBox(g, 0.05, 0.44, 0.05, metal, [x, 0.22, 0.1]);
      addBox(g, 0.05, 0.44, 0.05, metal, [x, 0.22, -0.1]);
    }
    addBox(g, 1.16, 0.03, 0.03, metal, [0, 0.14, 0]);
  },
  departure_board(g, style) {
    const frame = mat(style, 'darkMetal:Ink');
    const rod = mat(style, 'darkMetal:Charcoal');
    addBox(g, 3.2, 0.86, 0.08, frame, [0, 0.43, 0]);
    addBox(g, 0.06, 0.22, 0.06, rod, [0, 0.97, 0]);
    const rows = [
      [0.66, ['paint:Butter', 'paint:Sage', 'paint:Butter', 'paint:Powder blue']],
      [0.42, ['paint:Off white', 'paint:Butter', 'paint:Sage', 'paint:Off white']],
      [0.2, ['paint:Sage', 'paint:Powder blue', 'paint:Butter', 'paint:Sage']],
    ];
    for (const [y, keys] of rows) {
      keys.forEach((key, i) => {
        const w = 0.62 - (i % 2) * 0.12;
        addBox(g, w, 0.1, 0.012, mat(style, key), [-1.15 + i * 0.76, y, 0.05]);
      });
    }
  },
  vending(g, style, look = {}) {
    const body = mat(style, 'paint:' + (look.vend || 'Navy'));
    const dark = mat(style, 'darkMetal:Ink');
    const glass = mat(style, 'glass:Sky');
    addBox(g, 0.72, 0.08, 0.48, dark, [0, 0.04, 0]);
    addBox(g, 0.68, 1.7, 0.42, body, [0, 0.92, 0]);
    addBox(g, 0.5, 0.9, 0.012, glass, [0, 1.15, 0.216]);
    const cans = ['paint:Butter', 'paint:Sage', 'paint:Dusty rose', 'paint:Powder blue'];
    cans.forEach((key, i) => {
      const x = -0.18 + (i % 2) * 0.22;
      const y = 1.38 - Math.floor(i / 2) * 0.28;
      addBox(g, 0.1, 0.16, 0.08, mat(style, key), [x, y, 0.12]);
    });
    addBox(g, 0.28, 0.08, 0.02, dark, [0, 0.52, 0.22]);
    addBox(g, 0.1, 0.06, 0.02, mat(style, 'paint:Butter'), [0.16, 0.62, 0.22]);
  },
  pillar_clock(g, style) {
    pillar(g, style);
    const frame = mat(style, 'darkMetal:Charcoal');
    const face = mat(style, 'paint:Off white');
    const ink = mat(style, 'darkMetal:Ink');
    addCyl(g, 0.2, 0.2, 0.04, frame, [0, 2.25, 0.16], { seg: 8, rot: [P / 2, 0, 0] });
    addCyl(g, 0.16, 0.16, 0.012, face, [0, 2.25, 0.182], { seg: 8, rot: [P / 2, 0, 0] });
    addBox(g, 0.016, 0.1, 0.008, ink, [0.02, 2.28, 0.192]);
    addBox(g, 0.012, 0.07, 0.008, ink, [-0.02, 2.23, 0.196]);
  },
  platform_sign(g, style) {
    const rod = mat(style, 'darkMetal:Charcoal');
    addBox(g, 0.04, 0.5, 0.04, rod, [0, 0.72, 0]);
    addBox(g, 0.78, 0.4, 0.045, mat(style, 'paint:Navy'), [0, 0.42, 0]);
    addBox(g, 0.46, 0.09, 0.012, mat(style, 'paint:Butter'), [0, 0.5, 0.03]);
    addBox(g, 0.34, 0.06, 0.012, mat(style, 'paint:Off white'), [0, 0.34, 0.03]);
  },
  pillar(g, style) {
    pillar(g, style);
  },
  window(g, style) {
    const frame = mat(style, 'metal:Light gray');
    const glass = mat(style, 'glass:Sky');
    const { w, h, d } = WIN;
    const b = 0.055;
    addBox(g, w, b, d, frame, [0, b / 2, 0]);
    addBox(g, w, b, d, frame, [0, h - b / 2, 0]);
    addBox(g, b, h, d, frame, [-w / 2 + b / 2, h / 2, 0]);
    addBox(g, b, h, d, frame, [w / 2 - b / 2, h / 2, 0]);
    addBox(g, 0.035, h - b * 2, d * 0.5, frame, [0, h / 2, 0]);
    addBox(g, w - b * 2 + 0.02, h - b * 2 + 0.02, 0.012, glass, [0, h / 2, 0]);
  },
  door(g, style) {
    const frame = mat(style, 'metal:Light gray');
    const glass = mat(style, 'glass:Sky');
    const { w, h, d } = DOOR;
    const jb = 0.06;
    addBox(g, jb, h, d, frame, [-w / 2 + jb / 2, h / 2, 0]);
    addBox(g, jb, h, d, frame, [w / 2 - jb / 2, h / 2, 0]);
    addBox(g, w, jb, d, frame, [0, h - jb / 2, 0]);
    const dw = w - jb * 2;
    addBox(g, dw, 0.7, 0.04, mat(style, 'paint:Off white'), [0, 0.38, 0]);
    addBox(g, dw - 0.06, 1.15, 0.012, glass, [0, 1.45, 0]);
    addBox(g, 0.08, 0.03, 0.04, mat(style, 'metal:Stone'), [dw / 2 - 0.1, 1.05, d / 2]);
  },
  tactile(g, style) {
    // A short run of the platform edge. One butter colour, bumps included.
    const yellow = mat(style, 'paint:Butter');
    addBox(g, 1.6, 0.02, 0.3, yellow, [0, 0.01, 0]);
    for (const x of [-0.5, 0, 0.5]) addBox(g, 0.1, 0.012, 0.1, yellow, [x, 0.026, 0]);
  },
};

function pillar(g, style) {
  const c = mat(style, 'concrete:Stone');
  addBox(g, 0.32, 0.08, 0.32, c, [0, 0.04, 0]);
  addBox(g, 0.24, 2.92, 0.24, c, [0, 1.52, 0]);
  addBox(g, 0.36, 0.08, 0.36, c, [0, 3.02, 0]);
}

const LABELS = {
  ticket_gate: 'Ticket gate',
  ticket_machine: 'Ticket machine',
  bench: 'Platform bench',
  departure_board: 'Departure board',
  vending: 'Vending machine',
  pillar_clock: 'Pillar clock',
  platform_sign: 'Platform sign',
  pillar: 'Platform pillar',
  window: 'Station window',
  door: 'Station door',
  tactile: 'Tactile strip',
};

const NO_HIT = new Set(['departure_board', 'platform_sign']);
const BACK = new Set();

function hitFor(name, footprint) {
  if (NO_HIT.has(name)) return [];
  const [w, d] = footprint;
  if (BACK.has(name)) return [{ z: d / 2, hw: w / 2, hd: d / 2 }];
  return [{ hw: w / 2, hd: d / 2 }];
}

/** One catalogue row per kit item, in manifest order. */
export const STATION_ITEMS = Object.entries(manifest.items).map(([name, item]) => ({
  name,
  id: `station.${name}`,
  label: LABELS[name] ?? item.label,
  kitGroup: item.group,
  size: item.footprint,
  hit: hitFor(name, item.footprint),
}));

/** A kit item standing on y = 0, facing +z. */
export function buildStationItem(name, style, look) {
  const build = BUILDERS[name];
  if (!build) throw new Error(`Unknown station item "${name}"`);
  const g = new THREE.Group();
  g.name = name;
  build(g, style, look || {});
  g.userData.stationItem = name;
  return g;
}

const RH = 3.22;

function splitWall(g, style, { axis, a0, a1, fix, y1, holes, hits, inward, low, high, band, rail }) {
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
    if (hit && hits && y0 < 0.35) {
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
      const lowY = Math.min(yEnd, band);
      if (lowY > y0) put(a, b, y0, lowY, TH, fix, low, true);
      if (yEnd > band) put(a, b, Math.max(y0, band), yEnd, TH, fix, high, true);
    };
    let y = 0;
    for (const [hy0, hy1] of spans) {
      emit(y, Math.min(hy0, y1));
      y = Math.max(y, hy1);
    }
    emit(y, y1);
    const openAt = (level) => spans.some(([hy0, hy1]) => hy0 < level && hy1 > level);
    const trim = (level, depth, key, y0, y) => {
      if (!key || openAt(level)) return;
      const fixPos = fix + inward * (TH / 2 - 0.004 + depth / 2);
      put(a, b, y0, y, depth, fixPos, key, false);
    };
    trim(band, 0.028, rail, band - 0.014, band + 0.014);
  }
}

/**
 * The platform (16 × 6 m). `cutaway` hides the +x end wall and the roof
 * deck on that half. Beams and the far canopy stay so the interior reads.
 */
export function buildStationRoom(style, { cutaway = false, seed = 0 } = {}) {
  const plan = stationPlan(seed);
  const body = new THREE.Group();
  const front = new THREE.Group();
  const side = new THREE.Group();
  const hits = [];

  // One solid concrete floor. The yellow strip is a separate solid piece.
  const floorH = TILE_TOP - SLAB_TOP;
  addBox(body, 16, floorH, 6, mat(style, 'concrete:Stone'), [0, (SLAB_TOP + TILE_TOP) / 2, 0]);
  addBox(body, 16, 0.22, 6, mat(style, 'concrete:Gray'), [0, SLAB_TOP - 0.11, 0]);
  const yellow = mat(style, 'paint:Butter');
  addBox(body, 15.4, 0.018, 0.28, yellow, [0, TILE_TOP + 0.009, 2.42]);
  for (let i = -10; i <= 10; i++) {
    addBox(body, 0.1, 0.012, 0.1, yellow, [i * 0.7, TILE_TOP + 0.024, 2.42]);
  }
  addBox(body, 15.6, 0.05, 0.08, mat(style, 'darkMetal:Charcoal'), [0, TILE_TOP + 0.03, 2.9]);

  const hole = (a0, a1, y0, h) => ({ a0: a0 + LIP, a1: a1 - LIP, y0: y0 + LIP, y1: y0 + h - LIP });
  const backWins = [[-4.3, -4.3 + WIN.w], [1.6, 1.6 + WIN.w]];
  const backHoles = backWins.map(([a0, a1]) => hole(a0, a1, 1.65, WIN.h));
  const doorZ = 1.5;
  const doorSpan = [doorZ - DOOR.w / 2, doorZ + DOOR.w / 2];
  const leftWin = [-2.4, -2.4 + WIN.w];
  const leftHoles = [
    hole(leftWin[0], leftWin[1], 1.35, WIN.h),
    { a0: doorSpan[0], a1: doorSpan[1], y0: 0, y1: DOOR.h - LIP },
  ];
  const rightWin = [-0.7, -0.7 + WIN.w];
  const rightHoles = [hole(rightWin[0], rightWin[1], 1.35, WIN.h)];

  const wallColors = { low: 'concrete:Stone', high: 'paint:Off white', band: 1.05, rail: 'metal:Light gray' };
  splitWall(body, style, { axis: 'x', a0: -8, a1: 8, fix: -2.93, y1: RH, holes: backHoles, hits, inward: 1, ...wallColors });
  splitWall(body, style, { axis: 'z', a0: -3, a1: 3, fix: -7.93, y1: RH, holes: leftHoles, hits, inward: 1, ...wallColors });
  splitWall(side, style, { axis: 'z', a0: -3, a1: 3, fix: 7.93, y1: RH, holes: rightHoles, hits: cutaway ? null : hits, inward: -1, ...wallColors });

  const deck = mat(style, 'metal:Light gray');
  const beam = mat(style, 'darkMetal:Charcoal');
  // Back awning stops behind the gates, so the iso camera still sees them.
  addBox(body, 16.15, 0.08, 0.42, deck, [0, ROOF_Y, -2.78]);
  // Far half of the canopy (away from the +x camera) stays in cutaway.
  addBox(body, 7.7, 0.08, 2.05, deck, [-4.05, ROOF_Y, -0.85]);
  // Near half hides with the +x wall. Full mode shows the whole roof.
  addBox(side, 7.7, 0.08, 2.05, deck, [4.05, ROOF_Y, -0.85]);
  for (const z of [-2.35, -1.15, 0.05]) addBox(body, 16.05, 0.07, 0.09, beam, [0, ROOF_Y - 0.07, z]);
  addBox(body, 16.05, 0.1, 0.12, mat(style, 'metal:Stone'), [0, ROOF_Y, 0.18]);

  const place = (group, name, x, y, z, rotY) => {
    const item = buildStationItem(name, style);
    item.position.set(x, y, z);
    item.rotation.y = rotY;
    group.add(item);
  };
  backWins.forEach(([a0, a1]) => place(body, 'window', (a0 + a1) / 2, 1.65, -2.93, 0));
  place(body, 'window', -7.93, 1.35, (leftWin[0] + leftWin[1]) / 2, P / 2);
  place(body, 'door', -7.93, 0, doorZ, P / 2);
  hits.push({ x: -7.93, z: doorZ, hw: DOOR.d / 2, hd: DOOR.w / 2 });
  place(side, 'window', 7.93, 1.35, (rightWin[0] + rightWin[1]) / 2, -P / 2);

  const NO_FLOOR = new Set(['departure_board', 'platform_sign']);
  for (const p of plan.placements) {
    const item = buildStationItem(p.item, style, plan.look);
    item.position.set(p.x, (p.y || 0) + TILE_TOP, p.z);
    item.rotation.y = p.rotY || 0;
    body.add(item);
    if ((p.y || 0) < 0.05 && !NO_FLOOR.has(p.item)) {
      const [w, d] = manifest.items[p.item].footprint;
      const c = Math.abs(Math.cos(p.rotY || 0));
      const s = Math.abs(Math.sin(p.rotY || 0));
      hits.push({ x: p.x, z: p.z, hw: (w / 2) * c + (d / 2) * s, hd: (w / 2) * s + (d / 2) * c });
    }
  }

  const room = new THREE.Group();
  room.name = 'tiny_station';
  const shell = mergeByMaterial(body);
  shell.name = 'room_shell';
  room.add(shell);
  // No +z wall: that side is the open platform edge. The group stays so
  // cutaway still has a front wall to hide, matching the other kits.
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
