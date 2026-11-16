import * as THREE from 'three';
import { capsuleBetween } from '../lib/shapes.js';
import { frond, lobe, paintBands, shadeMaterial, tapered } from '../lib/foliage.js';
import { PALETTE } from '../styles/palette.js';
import { box, cyl } from './util.js';

// Batch D – extras: planters, drink vending machines, a public phone booth
// (instead of newspaper boxes, which are rare in Japan) and the concrete
// utility pole that is everywhere in Japanese streets.

/** A low-poly bush: two overlapping faceted lumps, lighter on top. */
export function bush(style, radius, rng = Math.random) {
  const g = new THREE.Group();
  const leaf = shadeMaterial(style.material('leaf'));
  g.add(lobe(leaf, radius * 0.78, rng, [0, radius * 0.36, 0], { scale: [1, 0.78, 1] }));
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2 + rng() * 0.6;
    g.add(lobe(leaf, radius * (0.4 + rng() * 0.08), rng, [
      Math.cos(a) * radius * 0.5,
      radius * (0.12 + rng() * 0.22),
      Math.sin(a) * radius * 0.5,
    ], { scale: [1.08, 0.7, 0.92], kind: 'oct' }));
  }
  g.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(g);
  if (box.min.y < 0) for (const c of g.children) c.position.y -= box.min.y;
  return g;
}

/** Sit a group on y = 0 when a lobe or frond dips under the ground. */
function sit(g) {
  g.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(g);
  if (box.min.y < 0) for (const c of g.children) c.position.y -= box.min.y;
  return g;
}

const leafOf = (style, name) => shadeMaterial(style.material('leaf', name ? PALETTE[name] : undefined));
const flowerOf = (style, name) => shadeMaterial(style.material('signage', PALETTE[name]));

/**
 * Bushes other than the plain mound (that one is `bush`, used by Small / Large
 * and by the planter). Each stays under about 150 triangles.
 */
export function bushKind(style, kind, rng = Math.random) {
  if (kind === 'Boxwood') return boxwood(style, rng);
  if (kind === 'Azalea') return azalea(style, rng);
  if (kind === 'Hydrangea') return hydrangea(style, rng);
  if (kind === 'Fern clump') return fernClump(style, rng, { spread: 0.55, fronds: 4, blades: 3 });
  return null;
}

/** A clipped ball. One icosahedron, barely wobbled, so it reads as trimmed. */
function boxwood(style, rng) {
  const geo = new THREE.IcosahedronGeometry(0.48, 1);
  const pos = geo.attributes.position;
  const wob = rng() * 6.28;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    const n = 1 + Math.sin(x * 6 + wob) * Math.cos(z * 5 - wob) * 0.03;
    pos.setXYZ(i, x * 1.06 * n, y * 0.9 * n, z * 1.06 * n);
  }
  pos.needsUpdate = true;
  const ball = new THREE.Mesh(paintBands(geo), leafOf(style));
  const g = new THREE.Group();
  g.add(ball);
  return sit(g);
}

/** Tsutsuji: a low rounded mound with pink blossoms over the top and sides. */
function azalea(style, rng) {
  const g = new THREE.Group();
  const leaf = leafOf(style);
  const pink = flowerOf(style, 'Dusty rose');
  const blush = flowerOf(style, 'Blush');
  g.add(lobe(leaf, 0.32, rng, [0, 0.2, 0], { scale: [1.35, 0.7, 1.2] }));
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2 + rng() * 0.3;
    g.add(lobe(leaf, 0.18, rng, [Math.cos(a) * 0.26, 0.12, Math.sin(a) * 0.22], { scale: [1.1, 0.65, 1], kind: 'oct' }));
  }
  // outside the mound, or the blossoms disappear inside the leaves
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2 + rng() * 0.25;
    const rad = 0.36 + (i % 3) * 0.07;
    const y = 0.34 + (i % 3) * 0.08;
    g.add(puff(i % 3 === 0 ? blush : pink, 0.085, [Math.cos(a) * rad, y, Math.sin(a) * rad * 0.9], rng));
  }
  return sit(g);
}

/** Ajisai: a low mound and a few round flower heads in blue and purple. */
function hydrangea(style, rng) {
  const g = new THREE.Group();
  const leaf = leafOf(style, 'Sage');
  const colours = ['Powder blue', 'Lilac', 'Denim'].map((n) => flowerOf(style, n));
  g.add(lobe(leaf, 0.28, rng, [0, 0.16, 0], { scale: [1.3, 0.62, 1.15] }));
  for (let i = 0; i < 5; i++) {
    const a = (i / 4) * Math.PI * 2 + rng() * 0.15;
    const centre = i === 4;
    const x = centre ? 0 : Math.cos(a) * 0.16;
    const z = centre ? 0.02 : Math.sin(a) * 0.14;
    const y = centre ? 0.5 : 0.4;
    const geo = new THREE.IcosahedronGeometry(centre ? 0.12 : 0.145, 0);
    const head = new THREE.Mesh(paintBands(geo, { hi: 1, mid: 0.9, lo: 0.74, height: 0.35 }), colours[i % colours.length]);
    head.position.set(x, y, z);
    g.add(head);
  }
  return sit(g);
}

/**
 * A low clump of arching ferns with a few grass blades. Used as a bush and,
 * smaller, in a doorstep pot.
 */
export function fernClump(style, rng, { spread = 0.5, fronds = 6, blades = 4 } = {}) {
  const g = new THREE.Group();
  const fern = leafOf(style);
  const grass = leafOf(style, 'Sage');
  for (let i = 0; i < fronds; i++) {
    const a = (i / fronds) * Math.PI * 2 + rng() * 0.2;
    const len = spread * (0.8 + rng() * 0.28);
    addFern(g, fern, a, len);
  }
  for (let i = 0; i < blades; i++) {
    const a = rng() * Math.PI * 2;
    const len = spread * (0.55 + rng() * 0.4);
    g.add(frond(grass, [Math.cos(a) * 0.03, 0, Math.sin(a) * 0.03], [Math.cos(a) * len * 0.25, len * 0.85, Math.sin(a) * len * 0.25], 0.055));
  }
  return sit(g);
}

/** One arching fern frond: two wide segments and a pair of side leaves. Kept chunky so the outline does not eat it. */
function addFern(g, material, a, len) {
  const mid = [Math.cos(a) * len * 0.42, len * 0.62, Math.sin(a) * len * 0.42];
  const tip = [Math.cos(a) * len, len * 0.16, Math.sin(a) * len];
  g.add(frond(material, [0, 0, 0], mid, len * 0.26));
  g.add(frond(material, mid, tip, len * 0.16));
  const side = [-Math.sin(a), 0, Math.cos(a)];
  const w = len * 0.32;
  g.add(frond(material, mid, [mid[0] + side[0] * w, mid[1] * 0.55, mid[2] + side[2] * w], len * 0.12));
  g.add(frond(material, mid, [mid[0] - side[0] * w, mid[1] * 0.55, mid[2] - side[2] * w], len * 0.12));
}

/** A small blossom puff. Round enough to read as a flower, not a spike. */
function puff(material, radius, position, rng) {
  const geo = new THREE.OctahedronGeometry(radius, 0);
  const mesh = new THREE.Mesh(geo, material);
  mesh.position.set(position[0], position[1], position[2]);
  mesh.rotation.y = rng() * Math.PI * 2;
  mesh.scale.set(1, 0.88, 1);
  mesh.updateMatrix();
  geo.applyMatrix4(mesh.matrix);
  return new THREE.Mesh(paintBands(geo, { hi: 1, mid: 0.9, lo: 0.76, height: 0.2 }), material);
}

/**
 * A doorstep pot. The lip is the top of the same pot, flared, so there is no
 * second rim to flicker or float. Fern, a few stemmed leaves, a snake plant,
 * or a cactus.
 */
export function doorstepPot(style, variant, rng = Math.random) {
  const g = new THREE.Group();
  if (variant === 'Snake plant') {
    addPot(g, style, { bot: 0.1, top: 0.12, h: 0.26, color: PALETTE.Charcoal });
    snakeLeaves(g, style, rng, 0.24);
  } else if (variant === 'Cactus') {
    addPot(g, style, { bot: 0.12, top: 0.15, h: 0.18, color: PALETTE.Tan });
    cactus(g, style, rng, 0.16);
  } else if (variant === 'Leafy') {
    addPot(g, style, { bot: 0.11, top: 0.14, h: 0.22, color: PALETTE.Stone });
    leafy(g, style, rng, 0.2);
  } else {
    addPot(g, style, { bot: 0.13, top: 0.17, h: 0.16, color: PALETTE.Cocoa });
    const plant = fernClump(style, rng, { spread: 0.32, fronds: 4, blades: 2 });
    plant.position.y = 0.14;
    g.add(plant);
  }
  return g;
}

/** One pot: tapered body, the top ring pushed out into a lip. */
function addPot(g, style, { bot, top, h, color }) {
  const sides = 6;
  const geo = new THREE.CylinderGeometry(top, bot, h, sides, 3, false);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i);
    const t = (y + h / 2) / h;
    if (t > 0.78) {
      const k = 1 + ((t - 0.78) / 0.22) * 0.22;
      pos.setX(i, pos.getX(i) * k);
      pos.setZ(i, pos.getZ(i) * k);
    }
  }
  pos.needsUpdate = true;
  geo.computeVertexNormals();
  const mesh = new THREE.Mesh(geo, style.material('concrete', color));
  mesh.position.y = h / 2;
  g.add(mesh);
}

function leafy(g, style, rng, rim) {
  const sage = leafOf(style, 'Sage');
  const moss = leafOf(style);
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2 + rng() * 0.4;
    const h = 0.18 + rng() * 0.1;
    const lean = 0.06 + rng() * 0.05;
    const top = [Math.cos(a) * lean, rim + h, Math.sin(a) * lean];
    const base = [Math.cos(a) * 0.03, rim + 0.02, Math.sin(a) * 0.03];
    g.add(tapered(base, top, 0.012, 0.008, moss, 6));
    g.add(lobe(i % 2 ? sage : moss, 0.09, rng, top, { scale: [1.15, 0.8, 1] }));
    g.add(lobe(sage, 0.055, rng, [top[0] + 0.04, top[1] - 0.03, top[2] - 0.02], { scale: [1, 0.7, 0.9], kind: 'oct' }));
  }
}

/** A fan of blades. Moss in front, a narrower butter stripe 2.5 cm behind it. */
function snakeLeaves(g, style, rng, rim) {
  const moss = leafOf(style);
  const edge = leafOf(style, 'Butter');
  const n = 7;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + 0.2;
    const h = 0.34 + (i % 3) * 0.14 + rng() * 0.04;
    const lean = 0.1 + (i % 2) * 0.08;
    const base = [Math.cos(a) * 0.04, rim, Math.sin(a) * 0.04];
    const tip = [Math.cos(a) * lean, rim + h, Math.sin(a) * lean];
    const side = [-Math.sin(a) * 0.025, 0, Math.cos(a) * 0.025];
    g.add(frond(
      edge,
      [base[0] - side[0], base[1], base[2] - side[2]],
      [tip[0] - side[0], tip[1], tip[2] - side[2]],
      0.045,
    ));
    g.add(frond(moss, base, tip, 0.07));
  }
}

/** A short ribbed column. Sides stay fixed: fewer than 10 and the ribs vanish. */
function ribbedColumn(material, height, radius, yCentre, x = 0, z = 0) {
  const geo = new THREE.CylinderGeometry(radius * 0.92, radius, height, 10, 1, false);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const px = pos.getX(i), pz = pos.getZ(i);
    if (Math.hypot(px, pz) < 1e-5) continue;
    const k = 1 + Math.cos(Math.atan2(pz, px) * 5) * 0.3;
    pos.setX(i, px * k);
    pos.setZ(i, pz * k);
  }
  pos.needsUpdate = true;
  const mesh = new THREE.Mesh(paintBands(geo, { hi: 1, mid: 0.84, lo: 0.68, height: 0.25 }), material);
  mesh.position.set(x, yCentre, z);
  return mesh;
}

/** Columnar cactus with two arms. The arms are what make it read as a cactus. */
function cactus(g, style, rng, rim) {
  const body = leafOf(style, 'Sage');
  const h = 0.36;
  g.add(ribbedColumn(body, h, 0.09, rim + 0.04 + h / 2));
  const armY = rim + 0.18;
  for (const s of [-1, 1]) {
    const up = 0.15 + rng() * 0.04;
    g.add(tapered([s * 0.07, armY, 0], [s * 0.16, armY + 0.02, 0], 0.04, 0.038, body, 8));
    g.add(ribbedColumn(body, up, 0.042, armY + 0.02 + up / 2, s * 0.16, 0));
  }
}

export const planter = {
  id: 'planter',
  label: 'Planter',
  variants: ['Planter box', 'Potted plant'],
  build({ variant }, style) {
    const g = new THREE.Group();
    if (variant === 'Planter box') {
      g.add(box(1.4, 0.5, 0.5, style.material('concrete'), [0, 0.25, 0]));
      const b = bush(style, 0.32);
      b.scale.set(2, 1, 0.9);
      b.position.y = 0.6;
      g.add(b);
    } else {
      g.add(cyl(0.22, 0.16, 0.4, style.material('wood', 0xb5653a), [0, 0.2, 0], { segments: 10 }));
      const b = bush(style, 0.28);
      b.position.y = 0.6;
      g.add(b);
    }
    return g;
  },
};

export const vendingMachine = {
  id: 'vendingMachine',
  label: 'Vending machine',
  variants: ['White', 'Red', 'Blue'],
  build({ variant }, style) {
    const g = new THREE.Group();
    const bodyHex = { White: 0xf2f2ee, Red: 0xd8302a, Blue: 0x2f6fd0 }[variant] ?? 0xf2f2ee;
    const body = style.material('signage', bodyHex);
    const W = 1.0, H = 1.83, D = 0.75;
    g.add(box(W, H, D, body, [0, H / 2, 0]));
    // lit display window with three rows of drinks
    const zf = D / 2 + 0.01;
    g.add(box(W * 0.86, H * 0.42, 0.02, style.material('light', 0xeaf4ff), [0, H * 0.7, zf]));
    const drinks = [0xd8443c, 0x3f7fd6, 0xf2c230, 0x3fa65a, 0xf08a2c, 0x8a55c9, 0xf2f2ee];
    for (let row = 0; row < 3; row++) {
      for (let i = 0; i < 7; i++) {
        const c = drinks[(i + row * 2) % drinks.length];
        g.add(cyl(0.038, 0.038, 0.16, style.material('signage', c), [-0.36 + i * 0.12, H * 0.55 + row * 0.24, zf + 0.04], { segments: 6 }));
      }
      g.add(box(W * 0.86, 0.02, 0.06, style.material('darkMetal'), [0, H * 0.55 + row * 0.24 - 0.1, zf + 0.03])); // button strip
    }
    // coin panel and the dispenser slot at the bottom
    g.add(box(0.2, 0.3, 0.02, style.material('darkMetal'), [W * 0.3, H * 0.33, zf]));
    g.add(box(W * 0.6, 0.18, 0.03, style.material('tire'), [-W * 0.1, H * 0.12, zf]));
    return g;
  },
};

export const phoneBooth = {
  id: 'phoneBooth',
  label: 'Phone booth',
  variants: ['Standard'],
  build(_, style) {
    const g = new THREE.Group();
    const frame = style.material('metal', 0xd8dce0);
    const W = 0.9, H = 2.2;
    for (const x of [-W / 2, W / 2]) for (const z of [-W / 2, W / 2]) g.add(box(0.05, H, 0.05, frame, [x, H / 2, z]));
    g.add(box(W + 0.1, 0.12, W + 0.1, style.material('signage', 0x3fa65a), [0, H + 0.06, 0]));
    // glass walls (front one with a door gap) and the green public phone inside
    const glass = style.material('glass', 0x9fc0d8);
    g.add(box(W, H - 0.3, 0.02, glass, [0, H / 2 + 0.1, -W / 2]));
    for (const sx of [-1, 1]) g.add(box(0.02, H - 0.3, W, glass, [sx * W / 2, H / 2 + 0.1, 0]));
    g.add(box(0.3, 0.4, 0.2, style.material('signage', 0x3fa65a), [0, 1.2, -W / 2 + 0.12]));
    g.add(box(0.5, 0.04, 0.3, style.material('metal'), [0, 0.95, -W / 2 + 0.15]));
    return g;
  },
};

export const utilityPole = {
  id: 'utilityPole',
  label: 'Utility pole',
  variants: ['With transformer', 'Plain'],
  build({ variant }, style) {
    const g = new THREE.Group();
    const concrete = style.material('concrete', 0xa8a69e);
    const H = 9;
    g.add(cyl(0.12, 0.17, H, concrete, [0, H / 2, 0], { segments: 10 }));
    // cross arms with insulators
    const metal = style.material('darkMetal');
    for (const y of [H - 0.4, H - 1.2]) {
      g.add(box(1.4, 0.08, 0.08, metal, [0, y, 0]));
      for (const x of [-0.6, 0, 0.6]) g.add(cyl(0.04, 0.05, 0.14, style.material('signage', 0xf2f2ee), [x, y + 0.1, 0], { segments: 6 }));
    }
    if (variant === 'With transformer') {
      g.add(cyl(0.22, 0.22, 0.7, style.material('metal', 0x8f969c), [0, H - 2.6, 0.32], { segments: 10 }));
      g.add(box(0.1, 0.1, 0.3, metal, [0, H - 2.3, 0.15]));
    }
    // yellow-and-black guard stripes at the bottom
    for (let i = 0; i < 4; i++) {
      g.add(cyl(0.175, 0.175, 0.25, style.material('signage', i % 2 ? 0x1f1f22 : 0xf2c230), [0, 0.6 + i * 0.25, 0], { segments: 10 }));
    }
    return g;
  },
};

/** Sagging wire between two points (for the overhead lines between poles). */
export function wire(a, b, style, sag = 0.5) {
  const mid = new THREE.Vector3(...a).add(new THREE.Vector3(...b)).multiplyScalar(0.5);
  mid.y -= sag;
  const g = new THREE.Group();
  const m = style.material('tire');
  g.add(capsuleBetween(a, mid.toArray(), 0.012, m, 3));
  g.add(capsuleBetween(mid.toArray(), b, 0.012, m, 3));
  return g;
}

/** A banana peel (the one you drop in the City with B), oversized so it reads when tiny. */
export const bananaPeel = {
  id: 'bananaPeel',
  label: 'Banana peel',
  variants: ['Peel'],
  build(_p, style) {
    const g = new THREE.Group();
    const yellow = style.material('signage', 0xece0aa), tip = style.material('wood', 0x8a7462);
    for (let k = 0; k < 4; k++) {
      const a = (k * Math.PI) / 2 + 0.4;
      g.add(box(0.06, 0.02, 0.16, yellow, [Math.sin(a) * 0.08, 0.015, Math.cos(a) * 0.08], [0, a, 0]));
    }
    g.add(box(0.05, 0.05, 0.05, tip, [0, 0.03, 0]));
    g.scale.setScalar(1.6);
    return g;
  },
};
