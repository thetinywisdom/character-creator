import * as THREE from 'three';
import { capsuleBetween, seg, softBox } from '../lib/shapes.js';
import { signTexture } from '../lib/textures.js';
import { box, cyl, disc, face } from './util.js';

// Batch A – street furniture, Japanese style. Real-world sizes in metres;
// every prop stands on y = 0 and faces +z.

export const bench = {
  id: 'bench',
  label: 'Bench',
  variants: ['Park bench', 'Backless'],
  build({ variant }, style) {
    const g = new THREE.Group();
    const wood = style.material('wood');
    const metal = style.material('darkMetal');
    const L = 1.6, seatH = 0.42, D = 0.45;
    // seat slats
    for (let i = 0; i < 3; i++) g.add(box(L, 0.04, D / 3 - 0.02, wood, [0, seatH, -D / 3 + i * (D / 3)]));
    // cast side frames
    for (const sx of [-1, 1]) {
      const x = sx * (L / 2 - 0.12);
      g.add(box(0.06, seatH, 0.06, metal, [x, seatH / 2, D / 2 - 0.05]));
      g.add(box(0.06, seatH, 0.06, metal, [x, seatH / 2, -D / 2 + 0.05]));
      g.add(box(0.06, 0.05, D, metal, [x, seatH - 0.04, 0]));
      if (variant === 'Park bench') g.add(box(0.06, 0.45, 0.06, metal, [x, seatH + 0.22, -D / 2 + 0.03], [-0.18, 0, 0]));
    }
    if (variant === 'Park bench') {
      for (let i = 0; i < 2; i++) g.add(box(L, 0.1, 0.035, wood, [0, seatH + 0.2 + i * 0.17, -D / 2 + 0.01 - i * 0.03], [-0.18, 0, 0]));
    }
    return g;
  },
};

export const streetLamp = {
  id: 'streetLamp',
  label: 'Street lamp',
  variants: ['Single', 'Double'],
  build({ variant }, style) {
    const g = new THREE.Group();
    const metal = style.material('metal');
    const light = style.material('light');
    const H = 6;
    g.add(cyl(0.06, 0.09, H, metal, [0, H / 2, 0]));
    g.add(cyl(0.14, 0.16, 0.5, metal, [0, 0.25, 0])); // base
    const sides = variant === 'Double' ? [-1, 1] : [1];
    for (const s of sides) {
      // arm reaching out over the road (+z), then a flat lamp head
      g.add(capsuleBetween([0, H - 0.3, 0], [0, H + 0.1, s * 0.6], 0.04, metal, 6));
      g.add(capsuleBetween([0, H + 0.1, s * 0.6], [0, H + 0.12, s * 1.3], 0.04, metal, 6));
      g.add(box(0.28, 0.12, 0.55, metal, [0, H + 0.08, s * 1.45]));
      g.add(box(0.22, 0.03, 0.45, light, [0, H + 0.01, s * 1.45]));
    }
    return g;
  },
};

export const trashBin = {
  id: 'trashBin',
  label: 'Trash bin',
  variants: ['Recycling station', 'Round bin'],
  build({ variant }, style) {
    const g = new THREE.Group();
    if (variant === 'Round bin') {
      const body = style.material('darkMetal');
      g.add(cyl(0.24, 0.22, 0.8, body, [0, 0.4, 0], { segments: 14 }));
      g.add(cyl(0.26, 0.26, 0.06, style.material('metal'), [0, 0.83, 0], { segments: 14 }));
      return g;
    }
    // three side-by-side bins: burnable / cans / PET bottles, colour-coded tops
    const body = style.material('metal', 0xc9ced4);
    const tops = [0xd8443c, 0x3f7fd6, 0x3fa65a];
    tops.forEach((c, i) => {
      const x = (i - 1) * 0.48;
      g.add(box(0.44, 0.9, 0.42, body, [x, 0.45, 0]));
      g.add(box(0.44, 0.08, 0.42, style.material('signage', c), [x, 0.94, 0]));
      g.add(disc(0.09, 0.02, style.material('tire'), [x, 0.72, 0.21]));
    });
    return g;
  },
};

export const bollard = {
  id: 'bollard',
  label: 'Bollard / guard rail',
  variants: ['Bollard', 'Guard rail'],
  build({ variant }, style) {
    const g = new THREE.Group();
    const white = style.material('metal', 0xf2f2ee);
    if (variant === 'Bollard') {
      g.add(cyl(0.06, 0.06, 0.8, white, [0, 0.4, 0]));
      g.add(cyl(0.065, 0.065, 0.08, style.material('signage', 0xf2c230), [0, 0.68, 0]));
      g.add(cyl(0.065, 0.02, 0.06, white, [0, 0.83, 0]));
      return g;
    }
    // white pedestrian guard rail: posts with two rounded rails
    const L = 2;
    for (const x of [-L / 2, L / 2]) g.add(cyl(0.035, 0.035, 0.85, white, [x, 0.425, 0]));
    for (const y of [0.45, 0.8]) g.add(capsuleBetween([-L / 2, y, 0], [L / 2, y, 0], 0.03, white, 6));
    return g;
  },
};

export const hydrant = {
  id: 'hydrant',
  label: 'Fire hydrant',
  variants: ['Standard'],
  build(_, style) {
    const g = new THREE.Group();
    const red = style.material('signage', 0xd8302a);
    g.add(cyl(0.12, 0.14, 0.6, red, [0, 0.3, 0]));
    g.add(cyl(0.16, 0.16, 0.05, red, [0, 0.62, 0]));
    g.add(new THREE.Mesh(new THREE.SphereGeometry(0.12, seg(10, 6), seg(6, 4), 0, Math.PI * 2, 0, Math.PI / 2), red));
    g.children.at(-1).position.y = 0.64;
    for (const sx of [-1, 1]) g.add(cyl(0.05, 0.05, 0.12, red, [sx * 0.16, 0.42, 0], { rot: [0, 0, Math.PI / 2] }));
    // the red "消火栓" sign on a pole, as seen on Japanese streets
    g.add(cyl(0.025, 0.025, 2.2, style.material('metal'), [0.35, 1.1, 0]));
    const tex = signTexture({ lines: ['消火栓'], bg: '#d8302a', fg: '#ffffff', shape: 'circle', w: 64, h: 64 });
    g.add(face(0.45, 0.45, style.material('signage', 0xffffff, tex), [0.35, 2.05, 0.03]));
    g.add(disc(0.23, 0.02, red, [0.35, 2.05, 0.01]));
    return g;
  },
};

export const postBox = {
  id: 'postBox',
  label: 'Post box',
  variants: ['Standard'],
  build(_, style) {
    const g = new THREE.Group();
    const red = style.material('signage', 0xd8302a);
    g.add(box(0.12, 0.35, 0.12, style.material('darkMetal'), [0, 0.175, 0]));
    const body = softBox(0.42, 0.85, 0.4, red, { round: 0.12, topRound: 0.5 });
    body.position.y = 0.35 + 0.425;
    g.add(body);
    // two mail slots and a white label
    for (const x of [-0.1, 0.1]) g.add(box(0.14, 0.03, 0.02, style.material('tire'), [x, 1.0, 0.205]));
    const tex = signTexture({ lines: ['〒'], bg: '#ffffff', fg: '#d8302a', w: 32, h: 32 });
    g.add(face(0.12, 0.12, style.material('signage', 0xffffff, tex), [0, 0.8, 0.205]));
    return g;
  },
};

export const busStop = {
  id: 'busStop',
  label: 'Bus stop',
  variants: ['Pole', 'Shelter'],
  build({ variant }, style) {
    const g = new THREE.Group();
    const metal = style.material('metal');
    const pole = new THREE.Group();
    // round sign on a pole, with a timetable box
    pole.add(cyl(0.035, 0.035, 2.4, metal, [0, 1.2, 0]));
    pole.add(cyl(0.2, 0.22, 0.12, style.material('concrete'), [0, 0.06, 0]));
    const tex = signTexture({ lines: ['バス', 'のりば'], bg: '#ffffff', fg: '#1f4fa8', border: '#1f4fa8', shape: 'circle', w: 64, h: 64 });
    pole.add(face(0.5, 0.5, style.material('signage', 0xffffff, tex), [0, 2.35, 0.025]));
    pole.add(disc(0.25, 0.03, style.material('signage', 0x1f4fa8), [0, 2.35, 0]));
    pole.add(box(0.32, 0.45, 0.05, style.material('metal', 0xf2f2ee), [0, 1.35, 0.04]));
    if (variant === 'Pole') { g.add(pole); return g; }
    // shelter: roof, glass back panel, bench, with the pole at one end
    const W = 3, H = 2.4, D = 1.2;
    for (const x of [-W / 2 + 0.05, W / 2 - 0.05]) g.add(box(0.06, H, 0.06, metal, [x, H / 2, -D / 2 + 0.05]));
    g.add(box(W + 0.2, 0.08, D + 0.2, style.material('roof'), [0, H + 0.04, -0.05]));
    g.add(box(W, 1.6, 0.03, style.material('glass', 0x7a99b3), [0, 1.1, -D / 2 + 0.03]));
    const b = bench.build({ variant: 'Backless' }, style);
    b.scale.set(1.4, 1, 0.8);
    b.position.z = -D / 2 + 0.35;
    g.add(b);
    pole.position.x = W / 2 + 0.5;
    g.add(pole);
    return g;
  },
};
