import * as THREE from 'three';
import { capsuleBetween, ellipsoid, seg } from '../lib/shapes.js';
import { mulberry32 } from '../lib/rng.js';

// Tree gray-box with canopy families: cloud (broadleaf clusters), round
// (lollipop), pine (stacked cones), column (narrow and tall: ginkgo, poplar),
// willow (a crown with hanging curtains), pads (Japanese black pine: a
// leaning trunk with flat cloud pads) and bamboo (a clump of tall canes).
// `seed` reshuffles the clusters.

export const tree = {
  id: 'tree',
  label: 'Tree',
  schema: {
    canopyShape:    { value: 'cloud', options: ['cloud', 'round', 'pine', 'column', 'willow', 'pads', 'bamboo'], label: 'Canopy shape' },
    trunkHeight:    { value: 1.6,  min: 0.6,  max: 3.5, step: 0.05, label: 'Trunk height (m)' },
    trunkThickness: { value: 0.16, min: 0.06, max: 0.4, step: 0.01, label: 'Trunk thickness' },
    canopySize:     { value: 1.1,  min: 0.5,  max: 2.2, step: 0.05, label: 'Canopy size' },
    branches:       { value: 4,    min: 0,    max: 8,   step: 1,    label: 'Branches (cloud)' },
    clusters:       { value: 7,    min: 3,    max: 14,  step: 1,    label: 'Clusters / tiers' },
    seed:           { value: 1,    min: 1,    max: 99,  step: 1,    label: 'Seed' },
    leaves:         { value: 'Green', options: ['Green', 'Cherry blossom', 'Autumn', 'Red', 'Yellow', 'Dark green', 'Light green'], label: 'Leaves' },
  },
  presets: {
    Oak:        { canopyShape: 'cloud', trunkHeight: 1.6, trunkThickness: 0.16, canopySize: 1.1, branches: 4, clusters: 7, seed: 1 },
    Lollipop:   { canopyShape: 'round', trunkHeight: 1.8, trunkThickness: 0.09, canopySize: 0.8, branches: 0, clusters: 5, seed: 1 },
    Pine:       { canopyShape: 'pine',  trunkHeight: 0.9, trunkThickness: 0.14, canopySize: 1.0, branches: 0, clusters: 8, seed: 1 },
    'Old giant': { canopyShape: 'cloud', trunkHeight: 2.2, trunkThickness: 0.34, canopySize: 1.8, branches: 6, clusters: 12, seed: 7 },
    // sakura: a low, wide, spreading crown of pink blossom on a dark trunk
    'Cherry blossom': { canopyShape: 'cloud', trunkHeight: 1.3, trunkThickness: 0.2, canopySize: 1.5, branches: 6, clusters: 11, seed: 3, leaves: 'Cherry blossom' },
    // Japanese maple (momiji) in autumn red: small, layered, wide
    'Japanese maple': { canopyShape: 'cloud', trunkHeight: 1.1, trunkThickness: 0.12, canopySize: 1.0, branches: 5, clusters: 9, seed: 5, leaves: 'Red' },
    // ginkgo street tree in autumn gold: tall and narrow
    Ginkgo:     { canopyShape: 'column', trunkHeight: 1.6, trunkThickness: 0.16, canopySize: 1.0, branches: 0, clusters: 5, seed: 2, leaves: 'Yellow' },
    // zelkova (keyaki): the big vase-shaped street and shrine tree
    Zelkova:    { canopyShape: 'cloud', trunkHeight: 2.6, trunkThickness: 0.24, canopySize: 1.9, branches: 7, clusters: 13, seed: 11, leaves: 'Green' },
    'Black pine': { canopyShape: 'pads', trunkHeight: 2.2, trunkThickness: 0.16, canopySize: 1.0, branches: 4, clusters: 5, seed: 4, leaves: 'Dark green' },
    'Weeping willow': { canopyShape: 'willow', trunkHeight: 2.2, trunkThickness: 0.2, canopySize: 1.5, branches: 0, clusters: 9, seed: 6, leaves: 'Light green' },
    Bamboo:     { canopyShape: 'bamboo', trunkHeight: 3.5, trunkThickness: 0.06, canopySize: 0.6, branches: 0, clusters: 9, seed: 8, leaves: 'Light green' },
  },

  build(p, style) {
    const LEAVES = { 'Cherry blossom': 0xf3b3c8, Autumn: 0xd9772e, Red: 0xc8402e, Yellow: 0xe8c040, 'Dark green': 0x3b6a3a, 'Light green': 0x8ab84e };
    const M = (role) => (role === 'leaf' && LEAVES[p.leaves] ? style.material('leaf', LEAVES[p.leaves]) : style.material(role));
    const root = new THREE.Group();
    root.name = 'tree';
    const rng = mulberry32(p.seed * 7919 + 13);
    const r = p.trunkThickness;
    const th = p.trunkHeight;
    const cs = p.canopySize;

    const canopy = new THREE.Group();
    canopy.name = 'canopy';
    if (p.canopyShape === 'bamboo') return bambooClump(root, canopy, p, M, rng, style);
    if (p.canopyShape === 'pads') return blackPine(root, canopy, p, M, rng);

    // --- trunk + root flare --------------------------------------------
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.6, r, th, seg(16)), M('bark'));
    trunk.position.y = th / 2;
    trunk.name = 'trunk';
    root.add(trunk);
    const flare = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.95, r * 1.45, th * 0.1, seg(16)), M('bark'));
    flare.position.y = th * 0.05;
    root.add(flare);

    root.add(canopy);

    if (p.canopyShape === 'column') {
      // stacked, narrowing ellipsoids: a tall, slim crown
      const n = Math.max(3, Math.min(6, p.clusters));
      for (let k = 0; k < n; k++) {
        const f = k / (n - 1);
        const rad = cs * (0.62 - 0.3 * f) * (0.9 + rng() * 0.2);
        canopy.add(ellipsoid(rad, [1, 1.25, 1], M('leaf'), { position: [(rng() - 0.5) * 0.15, th * 0.8 + cs * 0.4 + k * cs * 0.6, (rng() - 0.5) * 0.15] }));
      }
    } else if (p.canopyShape === 'willow') {
      // a rounded crown with long curtains of leaves hanging almost to the ground
      const top = th + cs * 0.35;
      canopy.add(ellipsoid(cs * 0.85, [1, 0.6, 1], M('leaf'), { position: [0, top, 0] }));
      const n = Math.max(10, p.clusters * 3);
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2 + rng() * 0.3;
        const rr = cs * (0.65 + rng() * 0.25);
        const x = Math.cos(a) * rr, z = Math.sin(a) * rr;
        const low = th * (0.25 + rng() * 0.3);
        canopy.add(capsuleBetween([x, top, z], [x * 1.12, low, z * 1.12], cs * (0.07 + rng() * 0.04), M('leaf'), 5));
      }
    } else if (p.canopyShape === 'pine') {
      const tiers = Math.max(3, Math.round(p.clusters / 2));
      const canopyH = cs * 2.4;
      const base = th * 0.55;
      for (let k = 0; k < tiers; k++) {
        const f = k / tiers;
        const h = (canopyH / tiers) * 1.7;
        const cone = new THREE.Mesh(new THREE.ConeGeometry(cs * (1 - f * 0.75), h, seg(20)), M('leaf'));
        cone.position.y = base + k * (canopyH / tiers) * 0.85 + h / 2;
        cone.rotation.y = rng() * Math.PI;
        canopy.add(cone);
      }
    } else if (p.canopyShape === 'round') {
      canopy.add(ellipsoid(cs, [1, 0.92, 1], M('leaf'), { position: [0, th + cs * 0.7, 0] }));
    } else {
      const centre = new THREE.Vector3(0, th + cs * 0.45, 0);
      const tips = [];
      for (let b = 0; b < p.branches; b++) {
        const ang = (b / p.branches) * Math.PI * 2 + rng() * 0.6;
        const elev = 0.5 + rng() * 0.5;
        const sy = th * (0.55 + rng() * 0.4);
        const len = cs * (0.55 + rng() * 0.35);
        const tip = new THREE.Vector3(
          Math.cos(ang) * Math.cos(elev) * len,
          sy + Math.sin(elev) * len,
          Math.sin(ang) * Math.cos(elev) * len,
        );
        root.add(capsuleBetween([0, sy, 0], tip.toArray(), r * 0.3, M('bark'), 10));
        tips.push(tip);
      }
      canopy.add(ellipsoid(cs * 0.7, [1, 0.85, 1], M('leaf'), { position: centre.toArray() }));
      for (let i = 0; i < p.clusters; i++) {
        let pos, rad;
        if (i < tips.length) {
          pos = tips[i].clone().add(new THREE.Vector3(0, cs * 0.1, 0));
          rad = cs * (0.38 + rng() * 0.15);
        } else {
          const phi = rng() * Math.PI * 2;
          const y = rng() * 0.8 - 0.1;
          const s = Math.sqrt(1 - y * y);
          const dir = new THREE.Vector3(Math.cos(phi) * s, y, Math.sin(phi) * s);
          pos = centre.clone().addScaledVector(dir, cs * (0.5 + rng() * 0.25));
          rad = cs * (0.32 + rng() * 0.2);
        }
        canopy.add(ellipsoid(rad, [1, 0.85, 1], M('leaf'), { position: pos.toArray() }));
      }
    }

    return root;
  },
};

/** Bamboo: a clump of tall, thin, slightly leaning canes with leaf tufts near the top. */
function bambooClump(root, canopy, p, M, rng, style) {
  root.add(canopy);
  const cane = style.material('leaf', 0x6f9a3e); // green canes
  const n = Math.max(4, p.clusters);
  const H = p.trunkHeight * 1.6;
  for (let i = 0; i < n; i++) {
    const x = (rng() - 0.5) * p.canopySize, z = (rng() - 0.5) * p.canopySize;
    const h = H * (0.75 + rng() * 0.3);
    const tip = [x * 2.2 + (rng() - 0.5) * 0.4, h, z * 2.2 + (rng() - 0.5) * 0.4];
    root.add(capsuleBetween([x, 0, z], tip, p.trunkThickness * 0.5, cane, 6));
    for (let k = 0; k < 3; k++) {
      const t = 0.6 + k * 0.17;
      const pos = [x + (tip[0] - x) * t, h * t, z + (tip[2] - z) * t];
      canopy.add(ellipsoid(p.canopySize * (0.35 + rng() * 0.15), [1.4, 0.45, 1.4], M('leaf'), { position: pos }));
    }
  }
  return root;
}

/** Japanese black pine: a leaning, kinked trunk and flat pads of needles on side branches. */
function blackPine(root, canopy, p, M, rng) {
  root.add(canopy);
  const th = p.trunkHeight, r = p.trunkThickness, cs = p.canopySize;
  const lean = (rng() < 0.5 ? -1 : 1) * 0.35;
  const mid = [lean * th * 0.4, th * 0.55, 0.1], top = [lean * th * 0.15, th, -0.05];
  root.add(capsuleBetween([0, 0, 0], mid, r, M('bark'), 8));
  root.add(capsuleBetween(mid, top, r * 0.8, M('bark'), 8));
  // a pad on top and pads on branches stepping out to the sides
  canopy.add(ellipsoid(cs * 0.75, [1.3, 0.38, 1.1], M('leaf'), { position: [top[0], th + cs * 0.15, top[2]] }));
  const n = Math.max(2, p.branches);
  for (let i = 0; i < n; i++) {
    const t = 0.45 + (i / n) * 0.5;
    const from = [mid[0] * t, th * t, 0];
    const a = (i / n) * Math.PI * 2 + rng() * 0.8;
    const len = cs * (0.8 + rng() * 0.5);
    const to = [from[0] + Math.cos(a) * len, from[1] + 0.1, Math.sin(a) * len];
    root.add(capsuleBetween(from, to, r * 0.35, M('bark'), 6));
    canopy.add(ellipsoid(cs * (0.5 + rng() * 0.15), [1.4, 0.4, 1.2], M('leaf'), { position: [to[0], to[1] + cs * 0.1, to[2]] }));
  }
  return root;
}
