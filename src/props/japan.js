import * as THREE from 'three';
import { signTexture } from '../lib/textures.js';
import { bicycle } from './vehicles.js';
import { box, cyl } from './util.js';

// Batch E – Japanese street details: stone lanterns, red paper lanterns,
// sandwich-board signs, bike racks. Real-world sizes in metres; every prop
// stands on y = 0 and faces +z.

/** 石灯籠: a stone lantern (base, post, light box, roof, finial). */
export const stoneLantern = {
  id: 'stoneLantern',
  label: 'Stone lantern',
  variants: ['Standard'],
  build(_, style) {
    const g = new THREE.Group();
    const stone = style.material('concrete', 0x9a978d);
    g.add(cyl(0.32, 0.38, 0.22, stone, [0, 0.11, 0], { segments: 6 }));      // base
    g.add(cyl(0.12, 0.15, 0.62, stone, [0, 0.53, 0], { segments: 8 }));      // post
    g.add(cyl(0.3, 0.24, 0.12, stone, [0, 0.9, 0], { segments: 6 }));        // platform
    g.add(box(0.36, 0.3, 0.36, stone, [0, 1.11, 0]));                        // light box
    g.add(box(0.2, 0.16, 0.38, style.material('light', 0xf6dc8a), [0, 1.11, 0])); // the lit opening
    g.add(cyl(0.02, 0.42, 0.24, stone, [0, 1.38, 0], { segments: 6 }));      // roof
    g.add(cyl(0.05, 0.07, 0.12, stone, [0, 1.55, 0], { segments: 6 }));      // finial
    return g;
  },
};

/** 提灯: a paper lantern hanging from a short bracket post. */
export const paperLantern = {
  id: 'paperLantern',
  label: 'Paper lantern',
  variants: ['Red', 'White'],
  build({ variant }, style) {
    const g = new THREE.Group();
    const dark = style.material('darkMetal');
    g.add(cyl(0.05, 0.06, 2.4, style.material('wood', 0x5a3f2a), [0, 1.2, -0.05], { segments: 6 }));
    g.add(box(0.06, 0.06, 0.6, dark, [0, 2.3, 0.22]));                        // bracket arm
    const paper = style.material('signage', variant === 'White' ? 0xf4efe2 : 0xd8402f);
    const lantern = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 8), paper);
    lantern.scale.set(1, 1.35, 1);
    lantern.position.set(0, 1.86, 0.45);
    g.add(lantern);
    g.add(cyl(0.12, 0.12, 0.06, dark, [0, 2.15, 0.45], { segments: 10 }));   // black top
    g.add(cyl(0.12, 0.12, 0.06, dark, [0, 1.57, 0.45], { segments: 10 }));   // and bottom
    g.add(box(0.015, 0.12, 0.015, dark, [0, 2.24, 0.45]));
    return g;
  },
};

/** A-frame sandwich board (立て看板) outside a shop. */
export const sandwichBoard = {
  id: 'sandwichBoard',
  label: 'Sandwich board',
  variants: ['Menu', 'Open'],
  build({ variant }, style) {
    const g = new THREE.Group();
    const frame = style.material('wood', 0x7a5232);
    const text = variant === 'Open' ? ['OPEN', '営業中'] : ['本日の', 'ランチ', '¥800'];
    const face = style.material('signage', 0xffffff, signTexture({ lines: text, bg: '#2a3a30', fg: '#f4f1e6', w: 64, h: 96 }));
    for (const s of [1, -1]) {
      const panel = new THREE.Group();
      panel.rotation.x = s * 0.2;
      panel.position.z = s * 0.12;
      panel.add(box(0.5, 0.8, 0.03, frame, [0, 0.42, 0]));
      const f = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.68), face);
      f.position.set(0, 0.44, s * 0.017);
      if (s < 0) f.rotation.y = Math.PI;
      panel.add(f);
      g.add(panel);
    }
    return g;
  },
};

/** A bike rack (駐輪場) with bicycles parked in it. */
export const bikeRack = {
  id: 'bikeRack',
  label: 'Bike rack',
  variants: ['3 bikes', 'Empty'],
  build({ variant }, style) {
    const g = new THREE.Group();
    const metal = style.material('metal', 0x9aa0a6);
    const n = 4, step = 0.65;
    g.add(box(n * step, 0.05, 0.05, metal, [0, 0.3, -0.55]));
    for (let i = 0; i < n; i++) {
      const x = -((n - 1) * step) / 2 + i * step;
      g.add(box(0.04, 0.3, 0.04, metal, [x, 0.15, -0.55]));
      g.add(box(0.04, 0.04, 0.5, metal, [x, 0.06, -0.3]));
      if (variant !== 'Empty' && i < 3) {
        const b = bicycle.build({ color: ['White', 'Gray', 'Blue', 'Red'][i % 4] }, style);
        b.position.set(x, 0, 0);
        g.add(b);
      }
    }
    return g;
  },
};
