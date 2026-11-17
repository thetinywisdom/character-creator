import * as THREE from 'three';
import { mulberry32 } from '../lib/rng.js';
import { PALETTE } from '../styles/palette.js';
import { box, cyl } from './util.js';

// Back-of-house clutter: a propane pair, a gas meter and a drainpipe.
// Outdoor AC units are not here. The town already places them on bare backs
// (city/backs.js), balconies (city/buildings.js), shop fronts (city/variety.js)
// and roofs (city/facades.js, city/civic.js).
//
// Each piece is its own variant. Cluster stands the three together.
// Colours are existing swatches. The same seed rebuilds the same pieces,
// including inside a cluster (each piece has its own salted seed).

const pick = (rng, list) => list[Math.floor(rng() * list.length)];
const rngFor = (seed, salt) => mulberry32((Math.imul(seed >>> 0, 997) + salt) >>> 0);

const TANKS = ['Sage', 'Moss', 'Stone', 'Slate', 'Light gray'];
const METERS = ['Paper', 'Sand', 'Stone', 'Light gray'];
const PIPES = ['Light gray', 'Stone', 'Slate', 'Gray'];

function chain(g, material, from, to, sag) {
  const n = 5;
  for (let i = 0; i < n; i++) {
    const t = (i + 0.5) / n;
    const x = from[0] + (to[0] - from[0]) * t;
    const y = from[1] + (to[1] - from[1]) * t - Math.sin(t * Math.PI) * sag;
    const z = from[2] + (to[2] - from[2]) * t;
    // axis-aligned links: a flat one facing the street, then a tall one, so the chain
    // is readable from the catalogue's front view (a rotated link was edge-on)
    const link = i % 2 === 0
      ? box(0.02, 0.014, 0.07, material, [x, y, z])
      : box(0.018, 0.055, 0.02, material, [x, y, z]);
    g.add(link);
  }
}

/** Two propane cylinders with collars, valves and a chain between the collars. */
export function propanePair(style, seed) {
  const rng = rngFor(seed, 11);
  const g = new THREE.Group();
  const i = Math.floor(rng() * TANKS.length);
  const colours = [TANKS[i], TANKS[(i + (rng() < 0.5 ? 0 : 1)) % TANKS.length]];
  const dark = style.material('darkMetal');
  const r = 0.1 + rng() * 0.02;
  const gap = r * 2 + 0.14 + rng() * 0.05;
  const h0 = 0.56 + rng() * 0.12;
  const heights = [h0, h0 * (0.9 + rng() * 0.12)];
  const sag = 0.1 + rng() * 0.04;
  const tops = [];
  g.add(box(gap + r * 2.2, 0.025, r * 2.3, style.material('concrete', PALETTE.Stone), [0, 0.012, 0]));
  for (let k = 0; k < 2; k++) {
    const x = (k === 0 ? -1 : 1) * gap / 2;
    const h = heights[k];
    const body = style.material('metal', PALETTE[colours[k]]);
    g.add(cyl(r, r, h, body, [x, 0.025 + h / 2, 0], { segments: 8 }));
    const collarY = 0.025 + h - 0.02;
    g.add(cyl(r * 1.12, r * 1.12, 0.07, dark, [x, collarY, 0], { segments: 8, open: true }));
    g.add(box(0.04, 0.05, 0.04, dark, [x, 0.025 + h + 0.04, 0]));
    // inner face, and in front of the cylinder, so the chain is not hidden inside the tank
    const side = k === 0 ? 1 : -1;
    tops.push([x + side * (r + 0.01), collarY - 0.03, r * 0.62]);
  }
  chain(g, style.material('metal', PALETTE['Light gray']), tops[0], tops[1], sag);
  g.userData.hit = [{ hw: gap / 2 + r + 0.04, hd: r + 0.06 }];
  return g;
}

/** A wall gas meter: a box, a dial, pipes in from the wall and up. */
export function gasMeter(style, seed) {
  const rng = rngFor(seed, 29);
  const g = new THREE.Group();
  const w = 0.22 + rng() * 0.06;
  const h = 0.32 + rng() * 0.12;
  const d = 0.13 + rng() * 0.04;
  const y0 = 0.08 + rng() * 0.12;
  const body = style.material('metal', PALETTE[pick(rng, METERS)]);
  const dark = style.material('darkMetal');
  const pipe = style.material('metal', PALETTE[pick(rng, PIPES)]);
  g.add(box(w, h, d, body, [0, y0 + h / 2, 0]));
  // round dial on the face, and a small counter window under it
  const dial = new THREE.Mesh(new THREE.CircleGeometry(0.048, 8), style.material('darkMetal', PALETTE.Charcoal));
  dial.position.set(0, y0 + h * 0.62, d / 2 + 0.012);
  g.add(dial);
  g.add(box(w * 0.42, 0.045, 0.012, dark, [0, y0 + h * 0.36, d / 2 + 0.01]));
  // from the wall (-z) into the side, and a short riser on top
  g.add(cyl(0.018, 0.018, 0.16, pipe, [-w / 2 - 0.04, y0 + h * 0.72, -0.04], { segments: 6, rot: [0, 0, Math.PI / 2], open: true }));
  g.add(cyl(0.02, 0.02, 0.14, pipe, [w * 0.2, y0 + h + 0.06, 0], { segments: 6, open: true }));
  g.add(box(w * 0.4, 0.03, d * 0.7, style.material('metal', PALETTE[pick(rng, ['Charcoal', 'Navy', 'Slate'])]), [0, y0 + h + 0.015, 0]));
  g.userData.hit = [{ x: -0.02, z: -0.02, hw: w / 2 + 0.08, hd: d / 2 + 0.08 }];
  return g;
}

/** A downpipe with an elbow at the top (into the wall) and a shoe at the bottom. */
export function drainPipe(style, seed) {
  const rng = rngFor(seed, 47);
  const g = new THREE.Group();
  const h = 1.35 + rng() * 0.75;
  const r = 0.028 + rng() * 0.01;
  const metal = style.material('metal', PALETTE[pick(rng, PIPES)]);
  const dark = style.material('darkMetal');
  const side = rng() < 0.5 ? -1 : 1;
  g.add(cyl(r, r, h - 0.12, metal, [0, (h - 0.12) / 2 + 0.08, 0], { segments: 6, open: true }));
  g.add(cyl(r, r, 0.2, metal, [0, h - r, -0.1], { segments: 6, rot: [Math.PI / 2, 0, 0], open: true }));
  g.add(box(r * 2.4, r * 2.4, r * 2.4, metal, [0, h - r, 0]));
  g.add(box(0.08, 0.1, 0.04, dark, [0, h - r, -0.2]));
  // the shoe kicks out toward the street (+z), to one side
  g.add(cyl(r, r * 1.15, 0.16, metal, [side * 0.04, 0.07, 0.06], { segments: 6, rot: [1.15, 0, side * 0.4], open: true }));
  for (const y of [h * 0.35, h * 0.72]) g.add(box(r * 3.2, 0.03, 0.04, dark, [0, y, -r - 0.01]));
  g.userData.hit = [{ x: 0, z: -0.04, hw: 0.1, hd: 0.16 }];
  return g;
}

const BUILD = {
  'Propane tanks': propanePair,
  'Gas meter': gasMeter,
  Drainpipe: drainPipe,
};

/**
 * One clutter piece, or Cluster (all three on a pad). Stands on y = 0, faces +z.
 * `seed` drives colours and proportions. AC units are intentionally absent.
 */
export function backClutter(style, variant, seed = 1) {
  const n = seed >>> 0;
  if (variant !== 'Cluster') {
    const fn = BUILD[variant] ?? propanePair;
    return fn(style, n);
  }
  const g = new THREE.Group();
  const j = rngFor(n, 71);
  const tanks = propanePair(style, n);
  const meter = gasMeter(style, n);
  const pipe = drainPipe(style, n);
  tanks.position.set(0.5 + (j() - 0.5) * 0.06, 0, 0.04);
  meter.position.set(-0.08 + (j() - 0.5) * 0.05, 0, 0.08);
  pipe.position.set(-0.62 + (j() - 0.5) * 0.04, 0, -0.02);
  g.add(box(1.7, 0.03, 0.62, style.material('concrete', PALETTE.Stone), [0, 0.015, 0.02]));
  g.add(tanks, meter, pipe);
  g.userData.hit = [
    { x: 0.5, z: 0.04, hw: 0.42, hd: 0.22 },
    { x: -0.08, z: 0.06, hw: 0.22, hd: 0.18 },
    { x: -0.62, z: -0.04, hw: 0.1, hd: 0.16 },
  ];
  return g;
}
