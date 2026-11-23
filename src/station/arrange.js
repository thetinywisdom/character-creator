import { mulberry32 } from '../lib/rng.js';
import layout from '../../public/station-kit/layout.json';
import { aabb } from '../lib/roomPlan.js';

// Seeded train platform. Seed 0 is the hand layout in layout.json.
//
// Fixed: walls, door, windows, the row of ticket gates, the platform edge
// (the yellow strip is part of the shell, not a placement), pillars, the
// pillar clock, the vending machine, the departure board and the hanging
// signs. The seed only shuffles benches and ticket machines through four
// slots that sit between the gate walk and the edge walk.
// A 0.9 m walk runs in front of the gates, along the platform edge, and
// from the end door that joins them. Benches stay off that edge.

const BOUNDS = { x0: -7.86, x1: 7.86, z0: -2.86, z1: 2.02 };
const GATE_WALK = { x0: -7.55, x1: 7.55, z0: -1.72, z1: -0.82 };
const EDGE_WALK = { x0: -7.55, x1: 7.55, z0: 1.08, z1: 2.02 };
const DOOR_PATH = { x0: -7.78, x1: -6.5, z0: -1.72, z1: 2.02 };

const GATES = [-5.4, -3.6, -1.8, 0, 1.8, 3.6, 5.4];
const PILLARS = [-4.4, -1.5, 5.2];
const SLOTS = [-5.5, -2.8, 0.3, 3.4];

const FOOT = {
  ticket_gate: [0.5, 0.44],
  ticket_machine: [0.68, 0.48],
  bench: [1.46, 0.46],
  vending: [0.76, 0.5],
  pillar: [0.32, 0.32],
  pillar_clock: [0.32, 0.32],
};

const NO_BLOCK = new Set(['departure_board', 'platform_sign']);

const q = (n) => Math.round(n * 1000) / 1000;

export function stationFloorBoxes(plan) {
  const boxes = [];
  for (const p of plan.placements) {
    if ((p.y || 0) >= 0.25 || NO_BLOCK.has(p.item)) continue;
    const fp = FOOT[p.item];
    if (!fp) throw new Error(`station footprint missing for ${p.item}`);
    boxes.push({ item: p.item, ...aabb(p.x, p.z, fp[0], fp[1], p.rotY || 0) });
  }
  return boxes;
}

function shuffle(rng, arr) {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export function stationPlan(seed) {
  const n = Number(seed) || 0;
  if (!n) {
    return { placements: layout.placements, look: {}, keepOut: null, goals: null, door: null, bounds: BOUNDS };
  }
  const rng = mulberry32(n >>> 0);
  const look = { vend: pickColour(rng) };
  const out = [];
  const add = (item, x, z, rotY = 0, y = 0) => {
    out.push({ item, x: q(x), y, z: q(z), rotY: q(rotY) });
  };

  for (const x of GATES) add('ticket_gate', x, -2.28);
  for (const x of PILLARS) add('pillar', x, 0.18);
  add('pillar_clock', 1.6, 0.18);
  add('vending', 6.65, -0.3);
  add('departure_board', 0, -1.35, 0, 2.05);
  add('platform_sign', -3.3, 0.42, 0, 2.15);
  add('platform_sign', 3.5, 0.42, 0, 2.15);

  const order = shuffle(rng, SLOTS);
  const nBench = 2 + Math.floor(rng() * 2);
  let nMachine = 1 + Math.floor(rng() * 2);
  if (nBench + nMachine > order.length) nMachine = order.length - nBench;
  for (let i = 0; i < nBench; i++) add('bench', order[i], 0.7);
  for (let i = 0; i < nMachine; i++) add('ticket_machine', order[nBench + i], -0.3);

  return {
    placements: out,
    look,
    keepOut: [GATE_WALK, EDGE_WALK, DOOR_PATH],
    goals: [
      { name: 'gates', x: 0, z: -1.25 },
      { name: 'edge', x: 1, z: 1.5 },
      { name: 'door', x: -7.2, z: 1.5 },
    ],
    door: { x: -7.2, z: 1.5 },
    bounds: BOUNDS,
  };
}

function pickColour(rng) {
  const list = ['Navy', 'Sage', 'Denim'];
  return list[Math.floor(rng() * list.length)];
}
