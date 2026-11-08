import * as THREE from 'three';
import { capsuleBetween, ellipsoid, seg } from '../lib/shapes.js';
import { mulberry32 } from '../lib/rng.js';

// Tree gray-box with three canopy families: cloud (broadleaf clusters),
// round (lollipop) and pine (stacked cones). `seed` reshuffles the clusters.

export const tree = {
  id: 'tree',
  label: 'Tree',
  schema: {
    canopyShape:    { value: 'cloud', options: ['cloud', 'round', 'pine'], label: 'Canopy shape' },
    trunkHeight:    { value: 1.6,  min: 0.6,  max: 3.5, step: 0.05, label: 'Trunk height (m)' },
    trunkThickness: { value: 0.16, min: 0.06, max: 0.4, step: 0.01, label: 'Trunk thickness' },
    canopySize:     { value: 1.1,  min: 0.5,  max: 2.2, step: 0.05, label: 'Canopy size' },
    branches:       { value: 4,    min: 0,    max: 8,   step: 1,    label: 'Branches (cloud)' },
    clusters:       { value: 7,    min: 3,    max: 14,  step: 1,    label: 'Clusters / tiers' },
    seed:           { value: 1,    min: 1,    max: 99,  step: 1,    label: 'Seed' },
    leaves:         { value: 'Green', options: ['Green', 'Cherry blossom', 'Autumn'], label: 'Leaves' },
  },
  presets: {
    Oak:        { canopyShape: 'cloud', trunkHeight: 1.6, trunkThickness: 0.16, canopySize: 1.1, branches: 4, clusters: 7, seed: 1 },
    Lollipop:   { canopyShape: 'round', trunkHeight: 1.8, trunkThickness: 0.09, canopySize: 0.8, branches: 0, clusters: 5, seed: 1 },
    Pine:       { canopyShape: 'pine',  trunkHeight: 0.9, trunkThickness: 0.14, canopySize: 1.0, branches: 0, clusters: 8, seed: 1 },
    'Old giant': { canopyShape: 'cloud', trunkHeight: 2.2, trunkThickness: 0.34, canopySize: 1.8, branches: 6, clusters: 12, seed: 7 },
    // sakura: a low, wide, spreading crown of pink blossom on a dark trunk
    'Cherry blossom': { canopyShape: 'cloud', trunkHeight: 1.3, trunkThickness: 0.2, canopySize: 1.5, branches: 6, clusters: 11, seed: 3, leaves: 'Cherry blossom' },
  },

  build(p, style) {
    const LEAVES = { 'Cherry blossom': 0xf3b3c8, Autumn: 0xd9772e };
    const M = (role) => (role === 'leaf' && LEAVES[p.leaves] ? style.material('leaf', LEAVES[p.leaves]) : style.material(role));
    const root = new THREE.Group();
    root.name = 'tree';
    const rng = mulberry32(p.seed * 7919 + 13);
    const r = p.trunkThickness;
    const th = p.trunkHeight;
    const cs = p.canopySize;

    // --- trunk + root flare --------------------------------------------
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.6, r, th, seg(16)), M('bark'));
    trunk.position.y = th / 2;
    trunk.name = 'trunk';
    root.add(trunk);
    const flare = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.95, r * 1.45, th * 0.1, seg(16)), M('bark'));
    flare.position.y = th * 0.05;
    root.add(flare);

    const canopy = new THREE.Group();
    canopy.name = 'canopy';
    root.add(canopy);

    if (p.canopyShape === 'pine') {
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
