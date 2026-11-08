import * as THREE from 'three';
import { signTexture } from '../lib/textures.js';
import { box, cyl, face } from '../props/util.js';
import { paintedWindow } from './interiors.js';

// Painted facades and roof clutter for big buildings. Like shop interiors,
// the many windows of a tower are painted, not modelled: one shared texture
// per facade style, repeated across each wall (4 bays × 4 floors per tile,
// every bay slightly different: lit office, blinds down, dark), with the
// repeat offset per building so neighbours don't match.

const cache = new Map();
let seed = 11;
const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
const pickR = (a) => a[Math.floor(rnd() * a.length)];

const STYLES = {
  // blue-green glass curtain wall
  glass: { wall: '#5a7088', spandrel: '#3a4a5a', mullion: '#c8d0d8', dark: ['#2a3e58', '#34506a', '#2e4660'], win: 0.82 },
  // concrete with punched windows
  concrete: { wall: '#c9c4b8', spandrel: '#b8b2a4', mullion: '#8a8a84', dark: ['#3a4654', '#46525e'], win: 0.56 },
  // horizontal bands: white spandrels, dark ribbon windows
  band: { wall: '#e8e6e0', spandrel: '#e8e6e0', mullion: '#9aa0a6', dark: ['#2e3a48', '#3a4858'], win: 0.62 },
};
export const FACADES = Object.keys(STYLES);

/** One tile of an office facade (4 bays × 4 floors), shared by every building of that style. */
function officeTexture(kind) {
  if (cache.has(kind)) return cache.get(kind);
  const S = STYLES[kind];
  const c = document.createElement('canvas');
  c.width = 128; c.height = 128;
  const g = c.getContext('2d');
  seed = 11 + kind.length * 97;
  g.fillStyle = S.wall; g.fillRect(0, 0, 128, 128);
  // night light mask (atmosphere.js): lit offices glow, plus some with blinds
  const mc = document.createElement('canvas');
  mc.width = 128; mc.height = 128;
  const m = mc.getContext('2d');
  m.fillStyle = '#000'; m.fillRect(0, 0, 128, 128);
  const bw = 32, fh = 32;
  for (let f = 0; f < 4; f++) {
    const floorLit = rnd() < 0.6;
    for (let b = 0; b < 4; b++) {
      const x = b * bw, y = f * fh;
      g.fillStyle = S.spandrel; g.fillRect(x, y + fh * S.win, bw, fh * (1 - S.win));     // spandrel under the window
      const wx = x + (kind === 'concrete' ? 6 : 1), ww = bw - (kind === 'concrete' ? 12 : 2), wy = y + 2, wh = fh * S.win - 3;
      const r = rnd();
      if (floorLit && r < 0.75) {
        // a lit office: ceiling light strip, a desk row, a person or two
        g.fillStyle = '#f2ecd8'; g.fillRect(wx, wy, ww, wh);
        m.fillStyle = '#fff4d8'; m.fillRect(wx, wy, ww, wh);
        g.fillStyle = '#fffbe6'; g.fillRect(wx + 2, wy + 1, ww - 4, 2);
        g.fillStyle = '#8a8e94'; g.fillRect(wx, wy + wh - 6, ww, 3);
        if (rnd() < 0.6) { g.fillStyle = pickR(['#2a62c8', '#f4f4f0', '#2c3652', '#7a3fbf']); g.fillRect(wx + 4 + rnd() * (ww - 10), wy + wh - 13, 4, 7); g.fillStyle = '#e0b48c'; g.fillRect(wx + 5 + rnd() * (ww - 10), wy + wh - 16, 3, 3); }
      } else if (r < 0.88) {
        // blinds down
        g.fillStyle = '#d8d8d0'; g.fillRect(wx, wy, ww, wh);
        if (rnd() < 0.5) { m.fillStyle = '#806c48'; m.fillRect(wx, wy, ww, wh); }
        g.fillStyle = '#b8b8b0'; for (let k = 2; k < wh; k += 3) g.fillRect(wx, wy + k, ww, 1);
      } else {
        // dark, with a sky reflection
        g.fillStyle = pickR(S.dark); g.fillRect(wx, wy, ww, wh);
        g.fillStyle = 'rgba(255,255,255,0.12)'; g.fillRect(wx, wy, ww * 0.4, wh * 0.5);
      }
      g.fillStyle = S.mullion;
      g.fillRect(x, y, 1, fh * S.win);                                                        // mullion
      if (kind !== 'concrete') g.fillRect(x + bw / 2, y, 1, fh * S.win);
    }
    g.fillStyle = 'rgba(0,0,0,0.15)'; g.fillRect(0, f * fh + fh - 1, 128, 1);                // floor line
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.magFilter = THREE.NearestFilter;
  t.minFilter = THREE.NearestFilter;
  t.generateMipmaps = false;
  const glow = new THREE.CanvasTexture(mc);
  glow.colorSpace = THREE.SRGBColorSpace;
  glow.wrapS = glow.wrapT = THREE.RepeatWrapping;
  glow.magFilter = glow.minFilter = THREE.NearestFilter;
  glow.generateMipmaps = false;
  t.userData.glowMap = glow;
  cache.set(kind, t);
  return t;
}

/**
 * A painted facade: a wall w × h whose texture repeats one bay every bayW
 * metres and one floor every floorH metres. (x, y) is the bottom centre;
 * rotY turns it (0 faces +z). offset shifts the pattern per building.
 */
export function facadePlane(style, kind, w, h, bayW, floorH, x, y, z, rotY = 0, offset = [0, 0]) {
  const geo = new THREE.PlaneGeometry(w, h);
  const uv = geo.attributes.uv;
  const ru = w / (bayW * 4), rv = h / (floorH * 4);
  for (let i = 0; i < uv.count; i++) uv.setXY(i, offset[0] + uv.getX(i) * ru, offset[1] + uv.getY(i) * rv);
  const m = new THREE.Mesh(geo, style.material('building', 0xffffff, officeTexture(kind))); // lit like a wall, so sides shade
  m.position.set(x, y + h / 2, z);
  m.rotation.y = rotY;
  return m;
}

/** Painted facades on all four sides of a box bw × bd, from y0 up h. */
export function wrapFacades(g, style, kind, bw, bd, bz, y0, h, { bayW = 2.4, floorH = 3.6, offset = [0, 0] } = {}) {
  const e = 0.03;
  g.add(facadePlane(style, kind, bw, h, bayW, floorH, 0, y0, bz + bd / 2 + e, 0, offset));
  g.add(facadePlane(style, kind, bw, h, bayW, floorH, 0, y0, bz - bd / 2 - e, Math.PI, [offset[0] + 0.5, offset[1]]));
  g.add(facadePlane(style, kind, bd, h, bayW, floorH, bw / 2 + e, y0, bz, Math.PI / 2, [offset[0] + 0.25, offset[1] + 0.5]));
  g.add(facadePlane(style, kind, bd, h, bayW, floorH, -bw / 2 - e, y0, bz, -Math.PI / 2, [offset[0] + 0.75, offset[1] + 0.25]));
}

/** Small painted windows (curtains) in columns on the side walls of a box. */
export function sideWindows(g, style, bd, bz, bw, floors, y0, floorH, { every = 4 } = {}) {
  const n = Math.max(1, Math.floor(bd / every));
  for (const sx of [-1, 1]) {
    for (let f = 0; f < floors; f++) {
      for (let i = 0; i < n; i++) {
        const z = bz - bd / 2 + (i + 0.5) * (bd / n);
        const v = Math.abs(Math.round(z * 3 + f * 5 + sx * 7)) % 4;
        const w = paintedWindow(style, v, 0.9, 1.0, sx * (bw / 2 + 0.02), y0 + f * floorH + 1.6, z);
        w.rotation.y = sx * Math.PI / 2;
        g.add(w);
      }
    }
  }
}

/** Roof clutter: a machine room, a water tank on legs, AC units, maybe an antenna. */
export function roofClutter(g, style, rng, bw, bd, bz, y, { tank = true, antenna = false, units = 4 } = {}) {
  const grey = style.material('concrete', 0xb8b4aa);
  const metal = style.material('metal', 0xc8ccd0);
  const mw = Math.min(bw * 0.35, 5), md = Math.min(bd * 0.35, 4);
  const mx = (rng() - 0.5) * (bw - mw) * 0.6, mz = bz + (rng() - 0.5) * (bd - md) * 0.6;
  g.add(box(mw, 2.6, md, grey, [mx, y + 1.3, mz]));                                        // lift / machine room
  if (tank) {
    const tx = mx + (mx > 0 ? -1 : 1) * (mw / 2 + 1.4), tz = mz;
    g.add(cyl(0.9, 0.9, 1.8, style.material('metal', 0xd8d8d0), [tx, y + 1.8, tz], { segments: 10 }));
    for (const sx of [-0.6, 0.6]) for (const sz of [-0.6, 0.6]) g.add(box(0.1, 0.9, 0.1, metal, [tx + sx, y + 0.45, tz + sz]));
  }
  for (let i = 0; i < units; i++) {
    const ux = (rng() - 0.5) * (bw - 2), uz = bz + (rng() - 0.5) * (bd - 2);
    if (Math.abs(ux - mx) < mw / 2 + 0.8 && Math.abs(uz - mz) < md / 2 + 0.8) continue;
    g.add(box(1.0, 0.7, 0.6, style.material('metal', 0xe8e8e4), [ux, y + 0.35, uz]));
    const fan = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.04, 10), style.material('darkMetal'));
    fan.position.set(ux, y + 0.72, uz);
    g.add(fan);
  }
  if (antenna) g.add(cyl(0.05, 0.08, 6, metal, [mx, y + 2.6 + 3, mz], { segments: 6 }));
  // a low railing round the roof edge
  const rail = style.material('metal', 0x9aa0a6);
  g.add(box(bw, 0.06, 0.06, rail, [0, y + 1.0, bz + bd / 2 - 0.15]), box(bw, 0.06, 0.06, rail, [0, y + 1.0, bz - bd / 2 + 0.15]));
  g.add(box(0.06, 0.06, bd, rail, [bw / 2 - 0.15, y + 1.0, bz]), box(0.06, 0.06, bd, rail, [-bw / 2 + 0.15, y + 1.0, bz]));
}

/** A lit company sign standing on a roof, facing +z. */
export function roofSign(g, style, rng, bw, y, z) {
  const names = ['東和商事', '山田ビル', 'HIKARI', '大和生命', 'SAKURA', '日の出', 'MIRAI', '中央ビル'];
  const colors = ['#d8302a', '#1f4fa8', '#279a4a', '#2a2a30', '#ee7a18'];
  const name = names[Math.floor(rng() * names.length)];
  const bg = colors[Math.floor(rng() * colors.length)];
  const w = Math.min(bw * 0.7, 9), h = 1.4;
  const tex = signTexture({ lines: [name], bg, fg: '#ffffff', w: 128, h: 24 });
  const metal = style.material('darkMetal');
  for (const sx of [-1, 1]) g.add(box(0.12, 1.2, 0.12, metal, [sx * w * 0.4, y + 0.6, z - 0.4]));
  g.add(box(w, h, 0.25, style.material('signage', parseInt(bg.slice(1), 16)), [0, y + 1.2 + h / 2, z - 0.4]));
  g.add(face(w * 0.98, h * 0.92, style.material('light', 0xffffff, tex), [0, y + 1.2 + h / 2, z - 0.26]));
}
