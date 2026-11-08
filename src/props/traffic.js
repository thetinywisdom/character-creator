import * as THREE from 'three';
import { capsuleBetween } from '../lib/shapes.js';
import { signTexture } from '../lib/textures.js';
import { box, cyl, disc, face } from './util.js';

// Batch B – traffic and signs, Japanese style: horizontal car signals,
// inverted-triangle "止まれ" stop signs, red-ringed speed signs, blue street
// name plates, red-and-white cones, zebra crosswalks.

export const trafficLight = {
  id: 'trafficLight',
  label: 'Traffic light',
  variants: ['Car signal', 'Pedestrian signal'],
  build({ variant }, style) {
    const g = new THREE.Group();
    const metal = style.material('metal');
    const housing = style.material('darkMetal', 0x4a4f55);
    if (variant === 'Car signal') {
      const H = 5.2, reach = 2.6;
      g.add(cyl(0.08, 0.11, H, metal, [0, H / 2, 0]));
      g.add(capsuleBetween([0, H - 0.15, 0], [0, H - 0.05, reach], 0.05, metal, 6));
      // horizontal signal box hanging over the road (+z), lenses facing the driver (+x)
      const sig = new THREE.Group();
      sig.position.set(0, H - 0.35, reach);
      sig.add(box(0.3, 0.38, 1.25, housing));
      const lenses = [[0x2fbf8a, -0.4], [0xf2c230, 0], [0xe0402f, 0.4]];
      for (const [c, z] of lenses) {
        const lens = disc(0.13, 0.04, style.material('light', c), [0.16, 0, z]);
        lens.rotation.set(0, 0, Math.PI / 2);
        sig.add(lens);
        sig.add(box(0.12, 0.04, 0.32, housing, [0.22, 0.15, z])); // visor
      }
      g.add(sig);
      return g;
    }
    // pedestrian signal: two stacked boxes, red (stop) on top, green (walk) below
    const H = 3;
    g.add(cyl(0.06, 0.08, H, metal, [0, H / 2, 0]));
    const red = signTexture({ lines: ['■'], bg: '#1a1a1a', fg: '#e0402f', w: 32, h: 32 });
    const green = signTexture({ lines: ['▲'], bg: '#1a1a1a', fg: '#2fbf8a', w: 32, h: 32 });
    for (const [tex, y] of [[red, H - 0.15], [green, H - 0.6]]) {
      g.add(box(0.4, 0.42, 0.25, housing, [0, y, 0.18]));
      g.add(face(0.32, 0.32, style.material('light', 0xffffff, tex), [0, y, 0.31]));
    }
    return g;
  },
};

export const streetSign = {
  id: 'streetSign',
  label: 'Street sign',
  variants: ['Stop', 'Speed limit', 'Street name'],
  build({ variant }, style) {
    const g = new THREE.Group();
    const metal = style.material('metal');
    const H = 2.5;
    g.add(cyl(0.03, 0.03, H, metal, [0, H / 2, 0]));
    if (variant === 'Stop') {
      // red inverted triangle with "止まれ"
      const tex = signTexture({ lines: ['止まれ'], bg: '#d8302a', fg: '#ffffff', border: '#ffffff', shape: 'triangleDown', w: 64, h: 56 });
      const tri = new THREE.Mesh(new THREE.CircleGeometry(0.46, 3), style.material('signage', 0xffffff, tex));
      tri.rotation.z = -Math.PI / 2; // point down
      // remap UVs so the texture triangle lines up with the mesh triangle
      const uv = tri.geometry.attributes.uv;
      const pos = tri.geometry.attributes.position;
      for (let i = 0; i < uv.count; i++) {
        const v = new THREE.Vector3(pos.getX(i), pos.getY(i), 0).applyAxisAngle(new THREE.Vector3(0, 0, 1), -Math.PI / 2);
        uv.setXY(i, 0.5 + v.x / 0.8, 0.62 + v.y / 0.69);
      }
      tri.position.set(0, H - 0.1, 0.03);
      g.add(tri);
    } else if (variant === 'Speed limit') {
      const tex = signTexture({ lines: ['40'], bg: '#ffffff', fg: '#1f4fa8', border: '#d8302a', borderWidth: 0.12, shape: 'circle', w: 64, h: 64 });
      g.add(face(0.6, 0.6, style.material('signage', 0xffffff, tex), [0, H - 0.1, 0.03]));
      g.add(disc(0.3, 0.02, style.material('signage', 0xd8302a), [0, H - 0.1, 0.015]));
    } else {
      const tex = signTexture({ lines: ['中央通り', 'Chuo-dori'], bg: '#1f4fa8', fg: '#ffffff', border: '#ffffff', borderWidth: 0.04, w: 128, h: 48 });
      g.add(box(0.95, 0.36, 0.03, style.material('signage', 0x1f4fa8), [0, H - 0.1, 0.01]));
      g.add(face(0.92, 0.34, style.material('signage', 0xffffff, tex), [0, H - 0.1, 0.03]));
    }
    return g;
  },
};

export const cone = {
  id: 'cone',
  label: 'Cone / barrier',
  variants: ['Cone', 'Barrier'],
  build({ variant }, style) {
    const g = new THREE.Group();
    const red = style.material('signage', 0xe0402f);
    const white = style.material('signage', 0xf2f2ee);
    const one = (x) => {
      const c = new THREE.Group();
      c.add(box(0.36, 0.04, 0.36, style.material('tire'), [0, 0.02, 0]));
      c.add(cyl(0.035, 0.15, 0.68, red, [0, 0.38, 0], { segments: 10 }));
      c.add(cyl(0.085, 0.1, 0.14, white, [0, 0.42, 0], { segments: 10 }));
      c.position.x = x;
      return c;
    };
    if (variant === 'Cone') { g.add(one(0)); return g; }
    // two cones joined by a yellow-and-black striped bar
    g.add(one(-0.9), one(0.9));
    const n = 8;
    for (let i = 0; i < n; i++) {
      const c = i % 2 ? 0x1f1f22 : 0xf2c230;
      g.add(box(1.8 / n, 0.06, 0.05, style.material('signage', c), [-0.9 + (i + 0.5) * (1.8 / n), 0.66, 0]));
    }
    return g;
  },
};

export const crosswalk = {
  id: 'crosswalk',
  label: 'Crosswalk',
  variants: ['Zebra'],
  /** opts.length = road width to cross (default 6 m). Stripes run along z. */
  build(_, style, opts = {}) {
    const g = new THREE.Group();
    const white = style.material('signage', 0xf4f4f0);
    const width = 4, length = opts.length ?? 6;
    // stripes sit clearly above the road surface (they flickered when they overlapped it)
    for (let x = -width / 2 + 0.225; x < width / 2; x += 0.9) g.add(box(0.45, 0.02, length, white, [x, 0.024, 0]));
    if (!opts.length) g.add(box(width + 1, 0.01, length + 1, style.material('road'), [0, 0.005, 0])); // show it on a bit of road
    return g;
  },
};
