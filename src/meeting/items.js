import * as THREE from 'three';
import { PALETTE } from '../styles/palette.js';
import { mulberry32 } from '../lib/rng.js';
import { lobe, shadeMaterial } from '../lib/foliage.js';
import { mergeByMaterial } from '../lib/merge.js';
import manifest from '../../public/meeting-kit/manifest.json';
import layout from '../../public/meeting-kit/layout.json';
import { meetingPlan } from './layout.js';

// Meeting room, in the same boxes and cylinders as the office kit
// (src/office/items.js) and the diner kit. Built here, not loaded, so
// createAsset stays synchronous. Every colour is `role:Swatch` through
// style.material, so palette swaps, the PS1 wobble and the outline flag
// all apply.
//
// Navy, charcoal and wood use cloth / paint / wood. Walls use paint, not
// building, so Off white is not pulled onto the building greys. Cylinder
// sides are the kit's own counts (already the PS1 0.3× detail). They are
// not passed through seg(), which would cut them again.
//
// Room: 6 m wide (x) by 4 m deep (z), origin at the bottom centre, front
// facing +z. The floor sits 2 cm above y = 0 so it does not flicker against
// the catalogue ground. Cutaway hides the +z and +x walls: those two face
// the isometric catalogue camera. The glass partition is the far (−z) wall,
// so it stays visible in that view.

const P = Math.PI;
const SLAB_TOP = 0.02;
const TILE_TOP = SLAB_TOP + 0.05;

const glassOf = new WeakMap();

function mat(style, key) {
  const i = key.indexOf(':');
  const role = key.slice(0, i);
  const swatch = key.slice(i + 1);
  // Partition panes stay see-through. Clone: the cached style material is
  // shared, and its opacity is an outline flag, not glass.
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

function addLobe(g, style, r, key, pos, scale, seed) {
  g.add(lobe(shadeMaterial(mat(style, key)), r, mulberry32(seed), pos, { scale }));
}

const BUILDERS = {
  table(g, style) {
    const wood = mat(style, 'wood:Walnut');
    const apron = mat(style, 'wood:Cocoa');
    const metal = mat(style, 'darkMetal:Charcoal');
    addBox(g, 3.08, 0.07, 0.92, apron, [0, 0.668, 0]);
    addBox(g, 3.2, 0.04, 1.05, wood, [0, 0.72, 0]);
    addBox(g, 3.2, 0.012, 0.02, metal, [0, 0.694, 0.515]);
    addBox(g, 3.2, 0.012, 0.02, metal, [0, 0.694, -0.515]);
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) addBox(g, 0.06, 0.66, 0.06, metal, [sx * 1.46, 0.33, sz * 0.4]);
      addBox(g, 0.04, 0.05, 0.78, metal, [sx * 1.46, 0.64, 0]);
    }
    addBox(g, 2.84, 0.04, 0.04, metal, [0, 0.64, 0]);
    addCyl(g, 0.045, 0.045, 0.012, metal, [0, 0.746, 0], { seg: 6 });
    addCyl(g, 0.02, 0.02, 0.008, mat(style, 'darkMetal:Ink'), [0, 0.752, 0], { seg: 5 });
  },
  chair(g, style) {
    const metal = mat(style, 'metal:Light gray');
    const seat = mat(style, 'cloth:Navy');
    const back = mat(style, 'cloth:Charcoal');
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        addBox(g, 0.035, 0.44, 0.035, metal, [sx * 0.18, 0.22, sz * 0.16], [sz * 0.06, 0, -sx * 0.06]);
      }
      addBox(g, 0.03, 0.2, 0.03, metal, [sx * 0.2, 0.56, -0.16]);
      addBox(g, 0.05, 0.025, 0.22, metal, [sx * 0.2, 0.66, -0.02]);
    }
    addBox(g, 0.46, 0.07, 0.44, seat, [0, 0.46, 0.02]);
    addBox(g, 0.44, 0.36, 0.05, back, [0, 0.74, -0.2], [-0.08, 0, 0]);
    addBox(g, 0.4, 0.06, 0.04, back, [0, 0.96, -0.22], [-0.08, 0, 0]);
  },
  wall_tv(g, style) {
    const bezel = mat(style, 'darkMetal:Ink');
    const screen = mat(style, 'glass:Navy');
    const metal = mat(style, 'metal:Light gray');
    addBox(g, 0.16, 0.1, 0.04, metal, [0, 0.28, 0.02]);
    addBox(g, 1.16, 0.68, 0.04, bezel, [0, 0.52, 0.04]);
    addBox(g, 1.04, 0.56, 0.008, screen, [0, 0.52, 0.064]);
    addBox(g, 0.96, 0.34, 0.006, mat(style, 'paint:Powder blue'), [0, 0.58, 0.07]);
    addBox(g, 0.22, 0.28, 0.006, mat(style, 'paint:Dusty rose'), [-0.36, 0.5, 0.074]);
    addBox(g, 0.7, 0.08, 0.006, mat(style, 'paint:Butter'), [0.1, 0.36, 0.074]);
    addBox(g, 0.7, 0.035, 0.05, metal, [0, 0.14, 0.05]);
  },
  whiteboard(g, style) {
    const frame = mat(style, 'metal:Light gray');
    const board = mat(style, 'paint:Off white');
    const tray = mat(style, 'darkMetal:Charcoal');
    addBox(g, 1.72, 1.08, 0.03, frame, [0, 0.56, 0.015]);
    addBox(g, 1.6, 0.96, 0.012, board, [0, 0.58, 0.034]);
    addBox(g, 0.46, 0.28, 0.006, mat(style, 'paint:Sage'), [-0.4, 0.7, 0.044]);
    addBox(g, 0.34, 0.18, 0.006, mat(style, 'paint:Powder blue'), [0.28, 0.52, 0.044]);
    addCyl(g, 0.1, 0.1, 0.006, mat(style, 'paint:Lilac'), [0.15, 0.78, 0.046], { seg: 8, rot: [P / 2, 0, 0] });
    addBox(g, 1.5, 0.035, 0.06, tray, [0, 0.04, 0.04]);
    addCyl(g, 0.012, 0.012, 0.14, mat(style, 'paint:Dusty rose'), [-0.2, 0.07, 0.05], { seg: 5, rot: [0, 0, P / 2] });
    addCyl(g, 0.012, 0.012, 0.14, mat(style, 'paint:Navy'), [0.05, 0.07, 0.05], { seg: 5, rot: [0, 0, P / 2] });
    addCyl(g, 0.014, 0.014, 0.05, mat(style, 'darkMetal:Ink'), [0.22, 0.055, 0.045], { seg: 5 });
  },
  partition(g, style) {
    const frame = mat(style, 'metal:Light gray');
    const kick = mat(style, 'paint:Off white');
    const glass = mat(style, 'glass:Sky');
    const w = 0.92;
    const h = 2.2;
    const t = 0.045;
    addBox(g, 0.04, h, t, frame, [-w / 2 + 0.02, h / 2, 0]);
    addBox(g, 0.04, h, t, frame, [w / 2 - 0.02, h / 2, 0]);
    addBox(g, w, 0.05, t, frame, [0, h - 0.025, 0]);
    addBox(g, w - 0.06, 0.16, t, kick, [0, 0.08, 0]);
    addBox(g, w - 0.08, 0.035, t, frame, [0, 0.18, 0]);
    addBox(g, w - 0.08, h - 0.28, 0.01, glass, [0, 1.2, 0]);
  },
  partition_door(g, style) {
    const frame = mat(style, 'metal:Light gray');
    const kick = mat(style, 'paint:Off white');
    const glass = mat(style, 'glass:Sky');
    const metal = mat(style, 'darkMetal:Charcoal');
    const w = 0.86;
    const h = 2.12;
    const t = 0.05;
    addBox(g, 0.05, h, t, frame, [-w / 2 + 0.025, h / 2, 0]);
    addBox(g, 0.05, h, t, frame, [w / 2 - 0.025, h / 2, 0]);
    addBox(g, w, 0.06, t, frame, [0, h - 0.03, 0]);
    addBox(g, w - 0.08, 0.28, 0.04, kick, [0, 0.16, 0]);
    addBox(g, w - 0.1, h - 0.42, 0.01, glass, [0, 1.18, 0]);
    addBox(g, 0.025, 0.16, 0.04, metal, [0.28, 1.0, 0.04]);
    addBox(g, 0.08, 0.025, 0.025, metal, [0.24, 1.05, 0.045]);
  },
  credenza(g, style) {
    const body = mat(style, 'paint:Off white');
    const top = mat(style, 'wood:Walnut');
    const line = mat(style, 'paint:Light gray');
    const metal = mat(style, 'metal:Stone');
    addBox(g, 1.15, 0.64, 0.4, body, [0, 0.36, 0]);
    addBox(g, 1.2, 0.035, 0.44, top, [0, 0.697, 0]);
    addBox(g, 0.008, 0.5, 0.012, line, [0, 0.38, 0.206]);
    for (const sx of [-1, 1]) addBox(g, 0.08, 0.02, 0.02, metal, [sx * 0.28, 0.4, 0.21]);
    addBox(g, 1.12, 0.04, 0.38, mat(style, 'darkMetal:Charcoal'), [0, 0.02, 0]);
  },
  carafe(g, style) {
    const glass = mat(style, 'glass:Sky');
    const water = mat(style, 'paint:Powder blue');
    const metal = mat(style, 'metal:Light gray');
    addCyl(g, 0.055, 0.06, 0.16, glass, [0, 0.1, 0], { seg: 7 });
    addCyl(g, 0.045, 0.048, 0.1, water, [0, 0.09, 0], { seg: 6 });
    addCyl(g, 0.03, 0.04, 0.04, glass, [0, 0.19, 0], { seg: 6 });
    addCyl(g, 0.032, 0.032, 0.012, metal, [0, 0.214, 0], { seg: 6 });
    addCyl(g, 0.028, 0.032, 0.07, glass, [0.1, 0.045, 0.02], { seg: 6 });
    addCyl(g, 0.026, 0.026, 0.04, water, [0.1, 0.04, 0.02], { seg: 5 });
  },
  notepad(g, style) {
    addBox(g, 0.2, 0.012, 0.15, mat(style, 'paint:Paper'), [0, 0.012, 0]);
    addBox(g, 0.2, 0.008, 0.15, mat(style, 'paint:Off white'), [0, 0.02, 0]);
    addBox(g, 0.012, 0.014, 0.15, mat(style, 'paint:Navy'), [-0.09, 0.016, 0]);
    addBox(g, 0.14, 0.004, 0.008, mat(style, 'paint:Powder blue'), [0.01, 0.026, -0.02]);
    addBox(g, 0.1, 0.004, 0.008, mat(style, 'paint:Sage'), [0.01, 0.026, 0.01]);
  },
  pen_cup(g, style) {
    const cup = mat(style, 'paint:Off white');
    addCyl(g, 0.038, 0.034, 0.08, cup, [0, 0.04, 0], { seg: 6 });
    const pens = ['paint:Navy', 'paint:Dusty rose', 'paint:Sage', 'darkMetal:Ink'];
    pens.forEach((key, i) => {
      const a = (i - 1.5) * 0.45;
      addBox(g, 0.01, 0.12, 0.01, mat(style, key), [Math.sin(a) * 0.012, 0.1, Math.cos(a) * 0.012], [0.15, a, 0.1]);
    });
  },
  conference_phone(g, style) {
    const body = mat(style, 'darkMetal:Charcoal');
    const face = mat(style, 'paint:Off white');
    addBox(g, 0.28, 0.035, 0.16, body, [0, 0.02, 0]);
    addBox(g, 0.1, 0.008, 0.07, mat(style, 'glass:Navy'), [0, 0.04, -0.02]);
    for (const x of [-0.08, 0, 0.08]) addBox(g, 0.028, 0.008, 0.028, face, [x, 0.04, 0.04]);
    addBox(g, 0.06, 0.012, 0.025, mat(style, 'paint:Dusty rose'), [0.09, 0.042, -0.04]);
  },
  pendant(g, style) {
    const shade = mat(style, 'paint:Off white');
    const metal = mat(style, 'metal:Light gray');
    addCyl(g, 0.05, 0.16, 0.12, shade, [0, 0.08, 0], { seg: 6 });
    addCyl(g, 0.16, 0.16, 0.012, metal, [0, 0.02, 0], { seg: 6 });
    addCyl(g, 0.08, 0.08, 0.01, mat(style, 'light:Butter'), [0, 0.05, 0], { seg: 6 });
    addCyl(g, 0.006, 0.006, 0.7, mat(style, 'darkMetal:Ink'), [0, 0.48, 0], { seg: 4 });
    addCyl(g, 0.04, 0.04, 0.02, metal, [0, 0.84, 0], { seg: 6 });
  },
  trash_can(g, style) {
    const body = mat(style, 'darkMetal:Charcoal');
    const rim = mat(style, 'metal:Light gray');
    addCyl(g, 0.14, 0.12, 0.32, body, [0, 0.16, 0], { seg: 7 });
    addCyl(g, 0.15, 0.15, 0.02, rim, [0, 0.32, 0], { seg: 7 });
    addCyl(g, 0.1, 0.1, 0.012, mat(style, 'paint:Paper'), [0, 0.3, 0], { seg: 6 });
  },
  plant(g, style) {
    addCyl(g, 0.07, 0.06, 0.1, mat(style, 'concrete:Off white'), [0, 0.05, 0], { seg: 6 });
    addCyl(g, 0.055, 0.055, 0.02, mat(style, 'concrete:Stone'), [0, 0.09, 0], { seg: 6 });
    [[0, 0.22, 0], [0.05, 0.16, 0.03], [-0.04, 0.15, -0.02]].forEach((pos, i) => {
      addLobe(g, style, 0.07, i === 1 ? 'leaf:Sage' : 'leaf:Moss', pos, [1, 0.85, 1], 11 + i);
    });
  },
};

const LABELS = {
  table: 'Meeting table',
  chair: 'Meeting chair',
  wall_tv: 'Wall TV',
  whiteboard: 'Whiteboard',
  partition: 'Glass panel',
  partition_door: 'Glass door',
  credenza: 'Credenza',
  carafe: 'Water carafe',
  notepad: 'Notepad',
  pen_cup: 'Pen cup',
  conference_phone: 'Conference phone',
  pendant: 'Pendant lamp',
  trash_can: 'Trash can',
  plant: 'Pot plant',
};

const NO_HIT = new Set(['pendant']);
const BACK = new Set(['wall_tv', 'whiteboard']);

function hitFor(name, footprint) {
  if (NO_HIT.has(name)) return [];
  const [w, d] = footprint;
  if (BACK.has(name)) return [{ z: d / 2, hw: w / 2, hd: d / 2 }];
  return [{ hw: w / 2, hd: d / 2 }];
}

/** One catalogue row per kit item, in manifest order. */
export const MEETING_ITEMS = Object.entries(manifest.items).map(([name, item]) => ({
  name,
  id: `meeting.${name}`,
  label: LABELS[name] ?? item.label,
  kitGroup: item.group,
  size: item.footprint,
  hit: hitFor(name, item.footprint),
}));

/** A kit item standing on y = 0, facing +z. Geometry is its own (safe to dispose). */
export function buildMeetingItem(name, style) {
  const build = BUILDERS[name];
  if (!build) throw new Error(`Unknown meeting item "${name}"`);
  const g = new THREE.Group();
  g.name = name;
  build(g, style);
  g.userData.meetingItem = name;
  return g;
}

const RW = 6;
const RD = 4;
const RH = 2.7;
const TH = 0.12;

function plainWall(g, style, { axis, a0, a1, fix, y1, hits, inward }) {
  const span = a1 - a0;
  const mid = (a0 + a1) / 2;
  const wall = mat(style, 'paint:Off white');
  const base = mat(style, 'paint:Light gray');
  if (axis === 'x') {
    addBox(g, span, y1, TH, wall, [mid, y1 / 2, fix]);
    addBox(g, span, 0.1, 0.02, base, [mid, 0.05, fix + inward * (TH / 2 + 0.006)]);
    if (hits) hits.push({ x: mid, z: fix, hw: span / 2, hd: TH / 2 });
  } else {
    addBox(g, TH, y1, span, wall, [fix, y1 / 2, mid]);
    addBox(g, 0.02, 0.1, span, base, [fix + inward * (TH / 2 + 0.006), 0.05, mid]);
    if (hits) hits.push({ x: fix, z: mid, hw: TH / 2, hd: span / 2 });
  }
}

/**
 * The whole meeting room (6 × 4 m). `cutaway` hides the front (+z) and side
 * (+x) walls so the inside reads from the isometric catalogue camera.
 * Meshes are merged per material.
 */
export function buildMeetingRoom(style, { cutaway = false, seed = 0 } = {}) {
  const body = new THREE.Group();
  const front = new THREE.Group();
  const side = new THREE.Group();
  const hits = [];

  // One solid carpet. No checker.
  const floorH = TILE_TOP - SLAB_TOP;
  addBox(body, RW, floorH, RD, mat(style, 'cloth:Navy'), [0, (SLAB_TOP + TILE_TOP) / 2, 0]);
  addBox(body, RW, 0.2, RD, mat(style, 'concrete:Gray'), [0, SLAB_TOP - 0.1, 0]);

  const west = -RW / 2 + TH / 2;
  const east = RW / 2 - TH / 2;
  const south = RD / 2 - TH / 2;
  const north = -RD / 2 + TH / 2;
  plainWall(body, style, { axis: 'z', a0: -RD / 2, a1: RD / 2, fix: west, y1: RH, hits, inward: 1 });
  plainWall(side, style, { axis: 'z', a0: -RD / 2, a1: RD / 2, fix: east, y1: RH, hits: cutaway ? null : hits, inward: -1 });
  plainWall(front, style, { axis: 'x', a0: -RW / 2, a1: RW / 2, fix: south, y1: RH, hits: cutaway ? null : hits, inward: -1 });

  // Glass partition is the far wall: a run of panels, a door, a pier, a header.
  const panelW = 0.92;
  const doorW = 0.86;
  const run0 = west + TH / 2;
  for (let i = 0; i < 5; i++) {
    const item = buildMeetingItem('partition', style);
    item.position.set(run0 + panelW * (i + 0.5), 0, north);
    body.add(item);
  }
  const runEnd = run0 + panelW * 5;
  hits.push({ x: (run0 + runEnd) / 2, z: north, hw: (runEnd - run0) / 2, hd: TH / 2 });
  const doorX = runEnd + doorW / 2;
  const door = buildMeetingItem('partition_door', style);
  door.position.set(doorX, 0, north);
  body.add(door);
  hits.push({ x: doorX, z: north, hw: doorW / 2, hd: TH / 2 });
  const pier0 = doorX + doorW / 2;
  addBox(body, RW / 2 - pier0, 2.16, TH, mat(style, 'paint:Off white'), [(pier0 + RW / 2) / 2, 1.08, north]);
  hits.push({ x: (pier0 + RW / 2) / 2, z: north, hw: (RW / 2 - pier0) / 2, hd: TH / 2 });
  addBox(body, RW, RH - 2.14, TH, mat(style, 'paint:Off white'), [0, (2.14 + RH) / 2, north]);

  // Seed 0 keeps the hand-made layout. Any other integer is deterministic.
  const placements = meetingPlan(seed)?.placements ?? layout.placements;
  for (const p of placements) {
    const item = buildMeetingItem(p.item, style);
    item.position.set(p.x, p.y + TILE_TOP, p.z);
    item.rotation.y = p.rotY || 0;
    body.add(item);
    if (p.y < 0.05 && !NO_HIT.has(p.item) && !BACK.has(p.item)) {
      const [w, d] = manifest.items[p.item].footprint;
      const c = Math.abs(Math.cos(p.rotY || 0));
      const s = Math.abs(Math.sin(p.rotY || 0));
      hits.push({ x: p.x, z: p.z, hw: (w / 2) * c + (d / 2) * s, hd: (w / 2) * s + (d / 2) * c });
    }
  }

  const room = new THREE.Group();
  room.name = 'tiny_meeting';
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
