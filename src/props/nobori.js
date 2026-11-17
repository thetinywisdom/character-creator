import * as THREE from 'three';
import { mulberry32 } from '../lib/rng.js';
import { paletteCanvas, paletteHex } from '../styles/palette.js';
import { box, cyl } from './util.js';

// Nobori (のぼり): a tall shop banner on a pole with a water-weight base.
// No readable writing. Stripes, or a stack of abstract blocks that only
// suggest kana. The seed picks the colours, the stripe count and the size.
//
// The cloth is one plane with a handful of rows. swayNobori (anim/props.js)
// bends those vertices. The pole and the base stay still.

const DARK = ['Ink', 'Navy', 'Charcoal', 'Brick', 'Denim', 'Walnut'];
const LIGHT = ['Off white', 'Butter', 'Paper', 'Sky', 'Blush', 'Sand', 'Apricot'];
const cache = new Map();
const css = (name) => `#${paletteHex(name).toString(16).padStart(6, '0')}`;
const pick = (rng, list) => list[Math.floor(rng() * list.length)];

function bannerTexture(variant, seed) {
  const key = `${variant}:${seed >>> 0}`;
  if (cache.has(key)) return cache.get(key);
  const rng = mulberry32((seed * 29 + (variant === 'Blocks' ? 8 : 2)) >>> 0);
  const c = document.createElement('canvas');
  c.width = 32;
  c.height = 128;
  const g = c.getContext('2d');
  const flip = rng() < 0.45;
  const ground = css(pick(rng, flip ? LIGHT : DARK));
  const ink = css(pick(rng, flip ? DARK : LIGHT));
  const alt = css(pick(rng, flip ? DARK : LIGHT));
  g.fillStyle = ground;
  g.fillRect(0, 0, 32, 128);
  if (variant === 'Blocks') drawBlocks(g, rng, ground, ink, alt);
  else drawStripes(g, rng, ground, ink, alt);
  // a hem, so the weighted bottom of the cloth reads when it swings
  g.fillStyle = ink;
  g.fillRect(0, 120, 32, 8);
  g.fillRect(0, 0, 32, 3);
  paletteCanvas(c);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  cache.set(key, tex);
  return tex;
}

function drawStripes(g, rng, ground, ink, alt) {
  const n = 4 + Math.floor(rng() * 3);
  const h = 116 / n;
  const colours = [ink, ground, alt, ink, ground, alt, ink];
  for (let i = 0; i < n; i++) {
    g.fillStyle = colours[i % colours.length];
    g.fillRect(0, 4 + i * h, 32, Math.ceil(h));
  }
}

/** Stacked rectangles and bars. They are not letters. */
function drawBlocks(g, rng, ground, ink, alt) {
  g.fillStyle = alt;
  g.fillRect(3, 8, 26, 108);
  g.fillStyle = ground;
  g.fillRect(6, 12, 20, 100);
  const glyphs = 4 + Math.floor(rng() * 3);
  const slot = 96 / glyphs;
  for (let i = 0; i < glyphs; i++) {
    const y = 16 + i * slot;
    const kind = Math.floor(rng() * 4);
    g.fillStyle = i % 2 ? ink : alt;
    if (kind === 0) g.fillRect(9, y, 14, slot * 0.62);
    else if (kind === 1) {
      g.fillRect(9, y, 14, 3);
      g.fillRect(9, y + slot * 0.35, 14, 3);
    } else if (kind === 2) {
      g.fillRect(14, y, 4, slot * 0.7);
      g.fillRect(10, y + slot * 0.28, 12, 3);
    } else {
      g.strokeStyle = i % 2 ? ink : alt;
      g.lineWidth = 3;
      g.strokeRect(9, y, 14, slot * 0.6);
    }
  }
}

/**
 * A nobori standing on y = 0, cloth facing +z, pole on the left of the cloth.
 * The banner mesh carries userData.sway for swayNobori.
 */
export function nobori(style, variant, seed = 1) {
  const rng = mulberry32((seed * 23 + 5) >>> 0);
  const g = new THREE.Group();
  const tall = 1.65 + rng() * 0.55;
  const wide = 0.34 + rng() * 0.12;
  const baseCol = style.material('concrete', paletteHex(pick(rng, ['Charcoal', 'Navy', 'Ink', 'Slate'])));
  const pole = style.material('darkMetal');
  // weighted base: a low slab, wider than the pole, like a water tank
  g.add(box(0.36, 0.08, 0.28, baseCol, [0, 0.04, 0]));
  g.add(box(0.1, 0.06, 0.1, pole, [0, 0.1, 0]));
  g.add(cyl(0.014, 0.016, tall, pole, [0, tall / 2 + 0.06, 0], { segments: 6 }));

  const clothH = tall - 0.28;
  const clothY = 0.22;
  // a few columns as well as rows, so the free edge can ripple, not just tilt
  const geo = new THREE.PlaneGeometry(wide, clothH, 3, 8);
  geo.translate(wide / 2, clothH / 2, 0);
  const tex = bannerTexture(variant === 'Blocks' ? 'Blocks' : 'Stripes', seed);
  const mat = style.material('signage', 0xffffff, tex);
  // this material is cached per texture, and only this banner uses it
  mat.side = THREE.DoubleSide;
  const cloth = new THREE.Mesh(geo, mat);
  cloth.position.set(0.02, clothY, 0.012);
  cloth.userData.sway = {
    amp: 0.09 + rng() * 0.04,
    speed: 1.05 + rng() * 0.45,
    phase: rng() * Math.PI * 2,
  };
  g.add(cloth);
  g.rotation.y = (rng() - 0.5) * 0.25;
  g.userData.hit = [{ x: 0.02, z: 0, hw: 0.18, hd: 0.14 }];
  return g;
}
