import * as THREE from 'three';
import { seg } from '../lib/shapes.js';
import { frond, lobe, paintBands, shadeMaterial, tapered, uprightTrunk } from '../lib/foliage.js';
import { mulberry32 } from '../lib/rng.js';
import { PALETTE } from '../styles/palette.js';

// Trees. Canopy families: cloud (broadleaf clumps), round (lollipop), pine
// (stacked cones), column (ginkgo), willow (a crown with hanging strips),
// pads (black pine) and bamboo (a clump of segmented culms). A thick cloud
// trunk (the old giant) is built gnarled instead: the trunk twists and splits
// into a few heavy limbs with a sparser crown. Catalogue-only shapes (not
// planted by the city): cedar (a narrow drooping spire), palm (fan fronds),
// dome (a dense round crown), umbrella (a flat broadleaf crown), bare (twigs,
// no leaves) and maple (flat orange layers). `seed` changes the lumps, the
// lean and the limb layout; colours stay palette swatches.

export const tree = {
  id: 'tree',
  label: 'Tree',
  schema: {
    canopyShape:    { value: 'cloud', options: ['cloud', 'round', 'pine', 'column', 'willow', 'pads', 'bamboo', 'cedar', 'palm', 'dome', 'umbrella', 'bare', 'maple'], label: 'Canopy shape' },
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
  // Catalogue only. city/park.js and the shrine grove plant `presets` and
  // nothing else, so these stay out of generated towns.
  more: {
    // sugi: a tall narrow spire of drooping tiers, not the pine's fat cones
    'Japanese cedar': { canopyShape: 'cedar', trunkHeight: 4.8, trunkThickness: 0.13, canopySize: 0.9, branches: 0, clusters: 9, seed: 2 },
    // shuro: a hemp / windmill palm, the fan palm of Japanese streets
    'Windmill palm': { canopyShape: 'palm', trunkHeight: 2.55, trunkThickness: 0.16, canopySize: 1.15, branches: 8, clusters: 4, seed: 3 },
    // kusunoki: a low, thick, very dense round evergreen
    Camphor: { canopyShape: 'dome', trunkHeight: 1.25, trunkThickness: 0.3, canopySize: 1.65, branches: 0, clusters: 8, seed: 4 },
    // enju: limbs holding one wide flat crown
    'Pagoda tree': { canopyShape: 'umbrella', trunkHeight: 2.05, trunkThickness: 0.18, canopySize: 1.55, branches: 5, clusters: 1, seed: 9 },
    // winter: the branching with the leaves gone
    'Winter tree': { canopyShape: 'bare', trunkHeight: 2.15, trunkThickness: 0.15, canopySize: 1.25, branches: 5, clusters: 3, seed: 6 },
    // a wider maple in orange and rust. The small red one stays "Japanese maple".
    'Autumn maple': { canopyShape: 'maple', trunkHeight: 1.15, trunkThickness: 0.11, canopySize: 1.4, branches: 0, clusters: 3, seed: 12 },
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
    const bark = shadeMaterial(M('bark'));
    const leaf = shadeMaterial(M('leaf'));

    if (p.canopyShape === 'bamboo') return bambooClump(root, p, M, rng, style);
    if (p.canopyShape === 'pads') return blackPine(root, p, bark, leaf, rng);
    if (p.canopyShape === 'cedar') return japaneseCedar(root, p, bark, leaf, rng);
    if (p.canopyShape === 'palm') return windmillPalm(root, p, bark, rng, style);
    if (p.canopyShape === 'dome') return camphorDome(root, p, bark, leaf, rng);
    if (p.canopyShape === 'umbrella') return pagodaTree(root, p, bark, rng, style);
    if (p.canopyShape === 'bare') return winterTree(root, p, bark, rng);
    if (p.canopyShape === 'maple') return autumnMaple(root, p, bark, rng, style);
    // the old giant: thick enough that a straight pole would look like a post
    if (p.canopyShape === 'cloud' && r >= 0.3) return gnarled(root, p, bark, leaf, rng);

    root.add(uprightTrunk(th, r * 1.28, r * 0.58, bark, rng));

    if (p.canopyShape === 'column') {
      const n = Math.max(3, Math.min(6, p.clusters));
      for (let k = 0; k < n; k++) {
        const f = k / (n - 1);
        const rad = cs * (0.64 - 0.24 * f) * (0.94 + rng() * 0.12);
        const y = th * 0.68 + cs * 0.22 + k * cs * 0.7;
        const x = (rng() - 0.5) * 0.1, z = (rng() - 0.5) * 0.1;
        root.add(lobe(leaf, rad, rng, [x, y, z], { scale: [1.15, 1.05, 1.15] }));
        root.add(lobe(leaf, rad * 0.55, rng, [x + (rng() - 0.5) * rad * 0.3, y + rad * 0.2, z + (rng() - 0.5) * rad * 0.3], { scale: [1.1, 1, 1.1] }));
      }
    } else if (p.canopyShape === 'willow') {
      const top = th + cs * 0.35;
      root.add(lobe(leaf, cs * 0.5, rng, [0, top + cs * 0.08, 0], { scale: [1, 0.85, 1] }));
      root.add(lobe(leaf, cs * 0.42, rng, [cs * 0.28, top, cs * 0.08], { scale: [1, 0.75, 1] }));
      root.add(lobe(leaf, cs * 0.4, rng, [-cs * 0.22, top - cs * 0.02, cs * 0.18], { scale: [1, 0.72, 1] }));
      root.add(lobe(leaf, cs * 0.36, rng, [cs * 0.05, top + cs * 0.02, -cs * 0.26], { scale: [1, 0.7, 1] }));
      const n = Math.max(10, p.clusters * 3);
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2 + rng() * 0.35;
        const rr = cs * (0.62 + rng() * 0.28);
        const x = Math.cos(a) * rr, z = Math.sin(a) * rr;
        const low = th * (0.22 + rng() * 0.32);
        const mid = [x * 0.94, top * 0.58 + low * 0.42, z * 0.94];
        const rad = cs * (0.032 + rng() * 0.018);
        root.add(tapered([x, top - cs * 0.02, z], mid, rad * 1.15, rad, leaf, 18));
        root.add(tapered(mid, [x * 1.08, low, z * 1.08], rad, rad * 0.55, leaf, 18));
      }
    } else if (p.canopyShape === 'pine') {
      const tiers = Math.max(3, Math.round(p.clusters / 2));
      const canopyH = cs * 2.4;
      const base = th * 0.55;
      for (let k = 0; k < tiers; k++) {
        const f = k / tiers;
        const h = (canopyH / tiers) * 1.7;
        const cone = roughCone(cs * (1 - f * 0.75) * (0.92 + rng() * 0.1), h, leaf, rng);
        cone.position.y = base + k * (canopyH / tiers) * 0.85 + h / 2;
        cone.rotation.y = rng() * Math.PI;
        root.add(cone);
      }
    } else if (p.canopyShape === 'round') {
      const y = th + cs * 0.72;
      root.add(lobe(leaf, cs * 0.92, rng, [0, y, 0], { scale: [1, 0.88, 1] }));
      const n = 5;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2 + rng() * 0.2;
        const el = (i % 2 ? 0.18 : -0.12) * cs;
        root.add(lobe(leaf, cs * (0.46 + rng() * 0.06), rng, [Math.cos(a) * cs * 0.5, y + el, Math.sin(a) * cs * 0.5], { scale: [1, 0.86, 1] }));
      }
    } else {
      const centre = [0, th + cs * 0.42, 0];
      const tips = [];
      const count = Math.max(0, p.branches);
      for (let b = 0; b < count; b++) {
        const ang = (b / count) * Math.PI * 2 + rng() * 0.6;
        const elev = 0.45 + rng() * 0.5;
        const sy = th * (0.48 + rng() * 0.35);
        const len = cs * (0.5 + rng() * 0.35);
        const tip = [
          Math.cos(ang) * Math.cos(elev) * len,
          sy + Math.sin(elev) * len,
          Math.sin(ang) * Math.cos(elev) * len,
        ];
        const mid = [
          tip[0] * 0.48 + (rng() - 0.5) * r,
          sy * 0.52 + tip[1] * 0.48,
          tip[2] * 0.48 + (rng() - 0.5) * r,
        ];
        root.add(tapered([0, sy, 0], mid, r * 0.55, r * 0.3, bark, 14));
        root.add(tapered(mid, tip, r * 0.3, r * 0.14, bark, 12));
        tips.push(tip);
      }
      clump(root, leaf, rng, centre, cs * 0.7, 3);
      for (let i = 0; i < p.clusters; i++) {
        let pos, rad;
        if (i < tips.length) {
          pos = [tips[i][0], tips[i][1] + cs * 0.06, tips[i][2]];
          rad = cs * (0.34 + rng() * 0.12);
          clump(root, leaf, rng, pos, rad, 3);
        } else {
          const phi = rng() * Math.PI * 2;
          const y = 0.05 + rng() * 0.75;
          const s = Math.sqrt(Math.max(0, 1 - y * y));
          const reach = cs * (0.48 + rng() * 0.22);
          pos = [centre[0] + Math.cos(phi) * s * reach, centre[1] + y * reach, centre[2] + Math.sin(phi) * s * reach];
          rad = cs * (0.28 + rng() * 0.14);
          clump(root, leaf, rng, pos, rad, 2);
        }
      }
    }

    return root;
  },
};

/** Two or three overlapping lobes, so a canopy reads as clumps rather than one ball. */
function clump(root, leaf, rng, center, radius, n) {
  root.add(lobe(leaf, radius, rng, center, { scale: [1, 0.78, 1] }));
  for (let i = 1; i < n; i++) {
    const a = rng() * Math.PI * 2;
    const up = (rng() - 0.35) * radius * 0.4;
    root.add(lobe(leaf, radius * (0.55 + rng() * 0.18), rng, [
      center[0] + Math.cos(a) * radius * 0.4,
      center[1] + up,
      center[2] + Math.sin(a) * radius * 0.4,
    ], { scale: [1.05, 0.72, 0.95] }));
  }
}

/** A pine tier with a slightly uneven skirt and the tip pulled off centre. */
function roughCone(radius, height, material, rng) {
  const geo = new THREE.ConeGeometry(radius, height, seg(18, 5));
  const pos = geo.attributes.position;
  const twist = rng() * Math.PI * 2;
  const lean = (rng() - 0.5) * radius * 0.16;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    const rad = Math.hypot(x, z);
    if (rad < 1e-5) { pos.setXYZ(i, lean, y, lean * 0.5); continue; }
    const ang = Math.atan2(z, x);
    const k = 1 + Math.sin(ang * 3 + twist) * 0.09;
    pos.setXYZ(i, x * k, y, z * k);
  }
  pos.needsUpdate = true;
  return new THREE.Mesh(paintBands(geo), material);
}

/**
 * Old giant: a thick trunk that kinks, then splits into a few heavy limbs.
 * The crown is separate clumps on those limbs, with sky between them.
 */
function gnarled(root, p, bark, leaf, rng) {
  const r = p.trunkThickness, th = p.trunkHeight, cs = p.canopySize;
  const sign = rng() < 0.5 ? -1 : 1;
  const j1 = [sign * r * (0.7 + rng() * 0.45), th * 0.32, (rng() - 0.5) * r * 0.45];
  const j2 = [-sign * r * (0.4 + rng() * 0.4), th * 0.6, (rng() - 0.5) * r * 0.4];
  const j3 = [j2[0] * 0.5 + (rng() - 0.5) * r * 0.4, th * 0.92, j2[2] * 0.5 + (rng() - 0.5) * r * 0.35];
  root.add(tapered([0, 0, 0], j1, r * 1.62, r * 1.02, bark, 16));
  root.add(tapered(j1, j2, r * 1.02, r * 0.74, bark, 14));
  root.add(tapered(j2, j3, r * 0.68, r * 0.34, bark, 12));

  // the leader keeps going up into the highest clump
  const leader = [j3[0] + (rng() - 0.5) * cs * 0.12, th + cs * 0.98, j3[2] + (rng() - 0.5) * cs * 0.12];
  root.add(tapered(j3, leader, r * 0.34, r * 0.14, bark, 12));
  const tips = [leader];

  const nLimbs = 3;
  for (let i = 0; i < nLimbs; i++) {
    const ang = (i / nLimbs) * Math.PI * 2 + rng() * 0.5 + 0.35;
    // uneven: one limb reaches higher, one stays lower and a little wider
    const liftK = i === 0 ? 1.15 : i === 1 ? 0.78 : 0.95;
    const spread = cs * (0.52 + rng() * 0.22) * (i === 1 ? 1.12 : 1);
    const lift = cs * (0.88 + rng() * 0.22) * liftK;
    const from = j2;
    const mid = [
      from[0] + Math.cos(ang) * spread * 0.46,
      from[1] + lift * 0.48,
      from[2] + Math.sin(ang) * spread * 0.46,
    ];
    const tip = [
      from[0] + Math.cos(ang) * spread,
      from[1] + lift,
      from[2] + Math.sin(ang) * spread,
    ];
    const thick = r * (0.48 - i * 0.05);
    root.add(tapered(from, mid, thick, thick * 0.62, bark, 12));
    root.add(tapered(mid, tip, thick * 0.62, thick * 0.26, bark, 12));
    tips.push(tip);
    if (i === 0) {
      const fang = ang + (rng() < 0.5 ? -1 : 1) * (0.55 + rng() * 0.3);
      const fork = [
        mid[0] + Math.cos(fang) * spread * 0.42,
        mid[1] + lift * 0.22,
        mid[2] + Math.sin(fang) * spread * 0.42,
      ];
      root.add(tapered(mid, fork, thick * 0.38, thick * 0.16, bark, 12));
      tips.push(fork);
    }
  }

  tips.forEach((tip, i) => {
    const rad = cs * (i === 0 ? 0.34 : 0.26 + rng() * 0.1);
    clump(root, leaf, rng, [tip[0], tip[1] + rad * 0.25, tip[2]], rad, i < 2 ? 3 : 2);
  });
  // a few smaller clumps in the gaps, still not enough to close the crown
  const extra = Math.max(0, p.clusters - tips.length);
  for (let i = 0; i < extra; i++) {
    const tip = tips[i % tips.length];
    const ang = rng() * Math.PI * 2;
    const d = cs * (0.18 + rng() * 0.28);
    clump(root, leaf, rng, [
      tip[0] + Math.cos(ang) * d,
      tip[1] + (rng() - 0.45) * cs * 0.35,
      tip[2] + Math.sin(ang) * d,
    ], cs * (0.16 + rng() * 0.08), 2);
  }
  sitOnGround(root);
  return root;
}

/** A tilted trunk cap can dip under y = 0. Slide the tree up so it stands on the ground. */
function sitOnGround(root) {
  root.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(root);
  if (box.min.y < -0.001) for (const c of root.children) c.position.y -= box.min.y;
}

/** Bamboo: thin culms in a clump, a ring at each node, leaf sprays only near the top. */
function bambooClump(root, p, M, rng, style) {
  const caneMat = shadeMaterial(style.material('leaf', 0x6f9a3e));
  const leafMat = shadeMaterial(M('leaf'));
  const n = Math.max(4, p.clusters);
  const H = p.trunkHeight * 1.6;
  const cs = p.canopySize;
  for (let i = 0; i < n; i++) {
    const baseAng = rng() * Math.PI * 2;
    const baseR = cs * rng() * 0.42;
    const base = [Math.cos(baseAng) * baseR, 0, Math.sin(baseAng) * baseR];
    const h = H * (0.86 + rng() * 0.14);
    const leanAng = rng() * Math.PI * 2;
    const reach = cs * (0.55 + rng() * 0.95);
    const tip = [Math.cos(leanAng) * reach, h, Math.sin(leanAng) * reach];
    const bowAng = rng() * Math.PI * 2;
    const bow = (rng() - 0.5) * 0.22;
    const radius = p.trunkThickness * (0.42 + rng() * 0.2);
    const segs = 4;
    let prev = base;
    for (let s = 1; s <= segs; s++) {
      const t = s / segs;
      const bowAmt = Math.sin(t * Math.PI) * bow;
      const pos = [
        base[0] + (tip[0] - base[0]) * t + Math.cos(bowAng) * bowAmt,
        h * t,
        base[2] + (tip[2] - base[2]) * t + Math.sin(bowAng) * bowAmt,
      ];
      const rHere = radius * (1.05 - t * 0.35);
      const rPrev = radius * (1.05 - (t - 1 / segs) * 0.35);
      root.add(tapered(prev, pos, rPrev, rHere, caneMat, 12, { open: true }));
      // a short wider ring so the node reads at street size
      const ringH = 0.07 + rng() * 0.02;
      const dir = [pos[0] - prev[0], pos[1] - prev[1], pos[2] - prev[2]];
      const dl = Math.hypot(...dir) || 1;
      const at = pos.map((v, k) => v - (dir[k] / dl) * ringH * 0.5);
      const at2 = pos.map((v, k) => v + (dir[k] / dl) * ringH * 0.15);
      root.add(tapered(at, at2, rHere * 1.65, rHere * 1.65, caneMat, 12, { flat: 1 }));
      prev = pos;
    }
    const sprays = 1 + (rng() < 0.8 ? 1 : 0);
    for (let k = 0; k < sprays; k++) {
      const t = 0.84 + k * 0.1;
      const origin = [
        base[0] + (tip[0] - base[0]) * t,
        h * t,
        base[2] + (tip[2] - base[2]) * t,
      ];
      root.add(leafSpray(origin, leafMat, rng, cs));
    }
  }
  return root;
}

/** A few flat leaves sticking out of a culm. Not a ball. */
function leafSpray(origin, material, rng, cs) {
  const geo = new THREE.BufferGeometry();
  const pos = [];
  const col = [];
  const leaves = 3;
  for (let i = 0; i < leaves; i++) {
    const ang = rng() * Math.PI * 2;
    const lift = 0.45 + rng() * 0.7;
    const len = cs * (0.38 + rng() * 0.22);
    const width = cs * (0.16 + rng() * 0.08);
    const dir = new THREE.Vector3(Math.cos(ang), lift, Math.sin(ang)).normalize();
    const side = new THREE.Vector3(-dir.z, 0, dir.x).normalize();
    const O = new THREE.Vector3(...origin);
    const tip = O.clone().addScaledVector(dir, len);
    const mid = O.clone().addScaledVector(dir, len * 0.42);
    const left = mid.clone().addScaledVector(side, width);
    const right = mid.clone().addScaledVector(side, -width);
    // front and back, so the leaf reads from either side
    for (const tri of [[O, left, tip], [O, tip, right], [O, tip, left], [O, right, tip]]) {
      for (const p of tri) pos.push(p.x, p.y, p.z);
      const along = [0.72, 0.84, 1];
      col.push(along[0], along[0], along[0], along[1], along[1], along[1], along[2], along[2], along[2]);
    }
  }
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  geo.computeVertexNormals();
  return new THREE.Mesh(geo, material);
}

/** Japanese black pine: a leaning kinked trunk and flat pads of needles. */
function blackPine(root, p, bark, leaf, rng) {
  const th = p.trunkHeight, r = p.trunkThickness, cs = p.canopySize;
  const lean = (rng() < 0.5 ? -1 : 1) * 0.35;
  const mid = [lean * th * 0.4, th * 0.55, 0.1];
  const top = [lean * th * 0.15, th, -0.05];
  root.add(tapered([0, 0, 0], mid, r * 1.15, r * 0.85, bark, 14));
  root.add(tapered(mid, top, r * 0.85, r * 0.5, bark, 12));
  flatPad(root, leaf, rng, [top[0], th + cs * 0.12, top[2]], cs * 0.68);
  const n = Math.max(2, p.branches);
  for (let i = 0; i < n; i++) {
    const t = 0.45 + (i / n) * 0.5;
    const from = [mid[0] * t, th * t, 0];
    const a = (i / n) * Math.PI * 2 + rng() * 0.8;
    const len = cs * (0.8 + rng() * 0.5);
    const to = [from[0] + Math.cos(a) * len, from[1] + 0.12, Math.sin(a) * len];
    root.add(tapered(from, to, r * 0.36, r * 0.14, bark, 12));
    flatPad(root, leaf, rng, [to[0], to[1] + cs * 0.06, to[2]], cs * (0.46 + rng() * 0.12));
  }
  sitOnGround(root);
  return root;
}

function flatPad(root, leaf, rng, center, radius) {
  root.add(lobe(leaf, radius, rng, center, { scale: [1.3, 0.32, 1.08] }));
  root.add(lobe(leaf, radius * 0.7, rng, [
    center[0] + (rng() - 0.5) * radius * 0.45,
    center[1] + radius * 0.03,
    center[2] + (rng() - 0.5) * radius * 0.4,
  ], { scale: [1.2, 0.28, 1.05] }));
}

const swatchLeaf = (style, name) => shadeMaterial(style.material('leaf', PALETTE[name]));

/**
 * Japanese cedar (sugi). A tall narrow spire: many short tiers that droop,
 * so it is not the pine's few fat cones or the black pine's flat pads.
 */
function japaneseCedar(root, p, bark, leaf, rng) {
  const H = p.trunkHeight;
  const r = p.trunkThickness;
  const cs = p.canopySize;
  // only the base shows; above that the tiers overlap into one narrow spire
  root.add(uprightTrunk(H * 0.12, r * 1.5, r * 0.95, bark, rng));
  const tiers = 12;
  for (let k = 0; k < tiers; k++) {
    const f = k / (tiers - 1);
    const y = H * (0.1 + f * 0.86);
    // the top stays wide enough that its droop still reaches the tier below
    const reach = cs * (1.15 - f * 0.48) * (0.96 + rng() * 0.06);
    const droop = reach * 0.82;
    const spin = k * 0.38;
    for (let i = 0; i < 8; i++) {
      const a = spin + (i / 8) * Math.PI * 2;
      root.add(frond(
        leaf,
        [0, y, 0],
        [Math.cos(a) * reach, y - droop, Math.sin(a) * reach],
        reach * 0.5,
      ));
    }
  }
  return root;
}

/**
 * Windmill palm (shuro): a ringed trunk, a skirt of dead fronds, and fans
 * of stiff leaflets. Not a feather palm.
 */
function windmillPalm(root, p, bark, rng, style) {
  const H = p.trunkHeight;
  const r = p.trunkThickness;
  const cs = p.canopySize;
  const leaf = swatchLeaf(style, 'Sage');
  const dead = shadeMaterial(style.material('bark', PALETTE.Walnut));
  const segs = 5;
  const lean = (rng() - 0.5) * 0.16;
  let prev = [0, 0, 0];
  for (let s = 1; s <= segs; s++) {
    const t = s / segs;
    const pos = [lean * t, H * t, lean * 0.35 * t];
    const rb = r * (1.2 - (t - 1 / segs) * 0.28);
    const rt = r * (1.2 - t * 0.28);
    root.add(tapered(prev, pos, rb, rt, bark, 12));
    // a shallow ring, not a bamboo node
    root.add(tapered(
      [pos[0], pos[1] - 0.04, pos[2]],
      pos,
      rt * 1.12,
      rt * 1.12,
      bark,
      12,
      { flat: 0.9 },
    ));
    prev = pos;
  }
  const crown = [prev[0], H + 0.02, prev[2]];
  const fans = Math.max(6, Math.min(8, p.branches));
  for (let i = 0; i < fans; i++) {
    const a = (i / fans) * Math.PI * 2 + rng() * 0.08;
    const lift = 0.35 + (i % 3) * 0.32 + rng() * 0.06;
    const dir = new THREE.Vector3(Math.cos(a), lift, Math.sin(a)).normalize();
    // a short petiole, then a fan that is most of the leaf
    const stem = cs * 0.38;
    const petiole = dir.clone().multiplyScalar(stem).add(new THREE.Vector3(...crown));
    root.add(tapered(crown, [petiole.x, petiole.y, petiole.z], 0.03, 0.016, bark, 8));
    const side = new THREE.Vector3(-dir.z, 0, dir.x).normalize();
    const up = new THREE.Vector3().crossVectors(dir, side).normalize();
    const leaflets = 5;
    for (let k = 0; k < leaflets; k++) {
      const u = k / (leaflets - 1) - 0.5;
      const base = new THREE.Vector3(...crown).lerp(petiole, 0.45);
      const leafTip = petiole.clone()
        .addScaledVector(dir, cs * 0.62)
        .addScaledVector(side, u * cs * 0.7)
        .addScaledVector(up, (0.15 - Math.abs(u)) * cs * 0.25);
      root.add(frond(leaf, [base.x, base.y, base.z], [leafTip.x, leafTip.y, leafTip.z], cs * (0.2 - Math.abs(u) * 0.06)));
    }
  }
  // the brown skirt under the crown, which is how a shuro reads at a glance
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2 + 0.2;
    const out = cs * 0.55;
    root.add(frond(
      dead,
      [crown[0], crown[1] - 0.05, crown[2]],
      [crown[0] + Math.cos(a) * out, crown[1] - cs * 0.72, crown[2] + Math.sin(a) * out],
      cs * 0.16,
    ));
  }
  sitOnGround(root);
  return root;
}

/** Camphor (kusunoki): a thick short trunk under one heavy round crown. */
function camphorDome(root, p, bark, leaf, rng) {
  const th = p.trunkHeight;
  const r = p.trunkThickness;
  const cs = p.canopySize;
  root.add(uprightTrunk(th, r * 1.15, r * 0.78, bark, rng));
  clump(root, leaf, rng, [0, th + cs * 0.58, 0], cs * 0.7, 3);
  const n = Math.max(6, p.clusters);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + rng() * 0.12;
    const band = i % 3;
    const y = th + cs * (0.22 + band * 0.26);
    const dist = cs * (band === 1 ? 0.58 : 0.4);
    const rad = cs * (band === 2 ? 0.4 : 0.5);
    clump(root, leaf, rng, [Math.cos(a) * dist, y, Math.sin(a) * dist], rad, 2);
  }
  sitOnGround(root);
  return root;
}

/** Pagoda tree (enju): a few limbs and one wide, flat crown. */
function pagodaTree(root, p, bark, rng, style) {
  const th = p.trunkHeight;
  const r = p.trunkThickness;
  const cs = p.canopySize;
  const leaf = swatchLeaf(style, 'Sage');
  const top = [(rng() - 0.5) * r, th, (rng() - 0.5) * r];
  root.add(tapered([0, 0, 0], top, r * 1.3, r * 0.42, bark, 12));
  const n = Math.max(4, p.branches);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + rng() * 0.25;
    const len = cs * (0.72 + rng() * 0.22);
    const tip = [Math.cos(a) * len, th + cs * 0.12, Math.sin(a) * len];
    const mid = [top[0] * 0.4 + tip[0] * 0.42, th * 0.78, top[2] * 0.4 + tip[2] * 0.42];
    root.add(tapered(top, mid, r * 0.3, r * 0.14, bark, 8));
    root.add(tapered(mid, tip, r * 0.14, r * 0.06, bark, 8));
    root.add(lobe(leaf, cs * 0.52, rng, [tip[0] * 0.78, th + cs * 0.28, tip[2] * 0.78], { scale: [1.3, 0.32, 1.12] }));
  }
  root.add(lobe(leaf, cs * 0.66, rng, [0, th + cs * 0.34, 0], { scale: [1.35, 0.28, 1.35] }));
  sitOnGround(root);
  return root;
}

/** A leafless winter tree: the trunk splits, and the limbs fork into twigs. */
function winterTree(root, p, bark, rng) {
  const th = p.trunkHeight;
  const r = p.trunkThickness;
  const cs = p.canopySize;
  const j1 = [(rng() - 0.5) * r * 0.8, th * 0.42, (rng() - 0.5) * r * 0.5];
  const j2 = [j1[0] * 0.4 + (rng() - 0.5) * r, th * 0.78, j1[2] * 0.4 + (rng() - 0.5) * r];
  root.add(tapered([0, 0, 0], j1, r * 1.45, r * 0.95, bark, 12));
  root.add(tapered(j1, j2, r * 0.95, r * 0.42, bark, 10));
  const limbs = Math.max(4, p.branches);
  const twigs = Math.max(2, p.clusters);
  for (let i = 0; i < limbs; i++) {
    const from = i < 2 ? j1 : j2;
    const ang = (i / limbs) * Math.PI * 2 + rng() * 0.45;
    const elev = 0.25 + rng() * 0.85;
    const len = cs * (0.7 + rng() * 0.45);
    const tip = [
      from[0] + Math.cos(ang) * Math.cos(elev) * len,
      from[1] + Math.sin(elev) * len * 0.75,
      from[2] + Math.sin(ang) * Math.cos(elev) * len,
    ];
    const mid = [
      (from[0] + tip[0]) * 0.5 + (rng() - 0.5) * 0.1,
      (from[1] + tip[1]) * 0.55,
      (from[2] + tip[2]) * 0.5 + (rng() - 0.5) * 0.1,
    ];
    const thick = r * (i < 2 ? 0.42 : 0.3);
    root.add(tapered(from, mid, thick, thick * 0.55, bark, 8));
    root.add(tapered(mid, tip, thick * 0.55, thick * 0.28, bark, 8));
    for (let t = 0; t < twigs; t++) {
      const u = 0.4 + (t / twigs) * 0.55;
      const base = mid.map((v, k) => v + (tip[k] - mid[k]) * u);
      const spread = (t - (twigs - 1) / 2) * 0.7;
      const ta = ang + spread;
      const te = 0.15 + rng() * 0.7;
      const tl = cs * (0.28 + rng() * 0.22);
      const tw = [
        base[0] + Math.cos(ta) * tl,
        base[1] + Math.sin(te) * tl * 0.65,
        base[2] + Math.sin(ta) * tl,
      ];
      root.add(tapered(base, tw, thick * 0.22, Math.max(0.035, thick * 0.1), bark, 6));
    }
  }
  sitOnGround(root);
  return root;
}

/**
 * Autumn maple: flat layered lobes in Apricot and Brick, so it reads orange
 * and rust. The existing Japanese maple stays the small all-red one.
 */
function autumnMaple(root, p, bark, rng, style) {
  const apricot = swatchLeaf(style, 'Apricot');
  const brick = swatchLeaf(style, 'Brick');
  const th = p.trunkHeight;
  const r = p.trunkThickness;
  const cs = p.canopySize;
  root.add(uprightTrunk(th, r * 1.35, r * 0.48, bark, rng));
  const layers = Math.max(2, Math.min(4, p.clusters));
  for (let L = 0; L < layers; L++) {
    const y = th + cs * (0.12 + L * 0.3);
    const n = 5;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + L * 0.5 + rng() * 0.08;
      const dist = cs * (0.22 + L * 0.24);
      const pos = [Math.cos(a) * dist, y, Math.sin(a) * dist];
      if (L > 0) root.add(tapered([0, th * 0.82, 0], pos, r * 0.32, r * 0.08, bark, 8));
      const mat = (i + L) % 3 === 0 ? brick : apricot;
      root.add(lobe(mat, cs * (0.48 - L * 0.05), rng, pos, { scale: [1.45, 0.36, 1.15] }));
    }
  }
  sitOnGround(root);
  return root;
}
