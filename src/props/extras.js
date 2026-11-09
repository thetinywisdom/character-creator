import * as THREE from 'three';
import { capsuleBetween, ellipsoid, seg } from '../lib/shapes.js';
import { box, cyl } from './util.js';

// Batch D – extras: planters, drink vending machines, a public phone booth
// (instead of newspaper boxes, which are rare in Japan) and the concrete
// utility pole that is everywhere in Japanese streets.

/** A low-poly bush: a few overlapping leaf balls. */
export function bush(style, radius, rng = Math.random) {
  const g = new THREE.Group();
  const leaf = style.material('leaf');
  g.add(ellipsoid(radius, [1, 0.8, 1], leaf, { segments: 10 }));
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + rng();
    g.add(ellipsoid(radius * 0.6, [1, 0.8, 1], leaf, {
      position: [Math.cos(a) * radius * 0.55, radius * 0.15, Math.sin(a) * radius * 0.55], segments: 8,
    }));
  }
  return g;
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
