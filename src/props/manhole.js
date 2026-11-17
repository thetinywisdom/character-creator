import * as THREE from 'three';
import { mulberry32 } from '../lib/rng.js';
import { paletteCanvas, paletteHex } from '../styles/palette.js';

// Flat manhole covers (マンホール). An octagon, like the vehicle wheels: a
// round cover would cost a lot of sides, and eight is the PS1 read of "round".
// The picture is a tiny hard-filtered texture, the same way shop signs are
// drawn, so the motif stays crisp without extra triangles.
//
// The variant is the motif family. The seed picks the colours (existing
// swatches only), the motif layout and the cover's size. No new swatches.

const SIDES = 8;
const cache = new Map();
const css = (name) => `#${paletteHex(name).toString(16).padStart(6, '0')}`;
const pick = (rng, list) => list[Math.floor(rng() * list.length)];

const METAL = ['Stone', 'Slate', 'Light gray', 'Gray'];
const INK = ['Ink', 'Charcoal', 'Slate'];
const FLOWER = ['Dusty rose', 'Blush', 'Sage', 'Butter', 'Apricot'];
const WAVE = ['Navy', 'Denim', 'Powder blue', 'Seafoam'];

function texture(pattern, seed) {
  const key = `${pattern}:${seed >>> 0}`;
  if (cache.has(key)) return cache.get(key);
  const rng = mulberry32((seed * 13 + (pattern === 'Wave' ? 5 : pattern === 'Grid' ? 9 : 1)) >>> 0);
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  g.beginPath();
  g.arc(32, 32, 31, 0, Math.PI * 2);
  g.clip();
  if (pattern === 'Wave') drawWave(g, rng);
  else if (pattern === 'Grid') drawGrid(g, rng);
  else drawFlower(g, rng);
  paletteCanvas(c);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  cache.set(key, tex);
  return tex;
}

function drawFlower(g, rng) {
  const field = css(pick(rng, METAL));
  const petal = css(pick(rng, FLOWER));
  const line = css(pick(rng, INK));
  g.fillStyle = field;
  g.fillRect(0, 0, 64, 64);
  // fat wedges, not thin ellipses: at 64px with nearest filtering a thin petal becomes a ring
  const n = [5, 6, 8][Math.floor(rng() * 3)];
  const rot = rng() * Math.PI * 2;
  const spread = 0.28 + rng() * 0.12;
  g.fillStyle = petal;
  for (let i = 0; i < n; i++) {
    const a = rot + (i / n) * Math.PI * 2;
    g.beginPath();
    g.moveTo(32, 32);
    g.arc(32, 32, 20 + (i % 2) * 3, a - spread, a + spread);
    g.closePath();
    g.fill();
  }
  g.fillStyle = css(pick(rng, ['Butter', 'Off white', 'Apricot']));
  g.beginPath();
  g.arc(32, 32, 7, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = line;
  g.beginPath();
  g.arc(32, 32, 3, 0, Math.PI * 2);
  g.fill();
  ring(g, line, rng);
}

function drawWave(g, rng) {
  const field = css(pick(rng, ['Stone', 'Powder blue', 'Sky', 'Light gray']));
  const line = css(pick(rng, WAVE.concat(['Ink', 'Charcoal'])));
  g.fillStyle = field;
  g.fillRect(0, 0, 64, 64);
  const rows = 3 + Math.floor(rng() * 2);
  const rad = 16 - rows;
  g.strokeStyle = line;
  g.lineWidth = 3;
  for (let row = 0; row < rows + 2; row++) {
    const y = 70 - row * rad * 0.95;
    const off = row % 2 ? rad : 0;
    for (let col = -1; col < 5; col++) {
      g.beginPath();
      g.arc(off + col * rad * 1.85, y, rad * 0.78, Math.PI * 1.08, Math.PI * 1.92);
      g.stroke();
    }
  }
  ring(g, css(pick(rng, INK)), rng);
}

function drawGrid(g, rng) {
  const field = css(pick(rng, ['Light gray', 'Stone', 'Paper']));
  const line = css(pick(rng, INK));
  g.fillStyle = field;
  g.fillRect(0, 0, 64, 64);
  const step = 8 + Math.floor(rng() * 3) * 2;
  const origin = rng() < 0.5 ? step / 2 : 4;
  g.strokeStyle = line;
  g.lineWidth = rng() < 0.4 ? 2 : 3;
  for (let x = origin; x < 64; x += step) {
    g.beginPath();
    g.moveTo(x, 0);
    g.lineTo(x, 64);
    g.stroke();
  }
  for (let y = origin; y < 64; y += step) {
    g.beginPath();
    g.moveTo(0, y);
    g.lineTo(64, y);
    g.stroke();
  }
  if (rng() < 0.6) {
    g.lineWidth = 2;
    g.beginPath();
    g.arc(32, 32, 8 + Math.floor(rng() * 6), 0, Math.PI * 2);
    g.stroke();
  }
  ring(g, line, rng);
}

/** A dark rim and a few bolt dots, so the disc reads as a cover. */
function ring(g, line, rng) {
  g.strokeStyle = line;
  g.lineWidth = 4;
  g.beginPath();
  g.arc(32, 32, 28, 0, Math.PI * 2);
  g.stroke();
  const bolts = 4 + Math.floor(rng() * 3) * 2;
  g.fillStyle = css(pick(rng, ['Charcoal', 'Ink', 'Slate']));
  for (let i = 0; i < bolts; i++) {
    const a = (i / bolts) * Math.PI * 2 + 0.2;
    g.fillRect(32 + Math.cos(a) * 23 - 1.5, 32 + Math.sin(a) * 23 - 1.5, 3, 3);
  }
}

/**
 * A manhole cover standing on y = 0. `pattern` is Flower, Wave or Grid.
 * `seed` is a number; the same seed always redraws the same cover.
 */
export function manholeCover(style, pattern, seed = 1) {
  const rng = mulberry32((seed * 17 + 3) >>> 0);
  const radius = 0.3 + rng() * 0.08;
  const g = new THREE.Group();
  const rimH = 0.02;
  // sit 2 cm off the ground: closer than that flickers against the pavement
  const y0 = 0.02;
  const rim = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius * 0.96, rimH, SIDES),
    style.material('metal', paletteHex(pick(rng, METAL))),
  );
  rim.position.y = y0 + rimH / 2;
  const face = new THREE.Mesh(
    new THREE.CircleGeometry(radius * 0.9, SIDES),
    style.material('metal', 0xffffff, texture(pattern, seed)),
  );
  face.rotation.x = -Math.PI / 2;
  face.position.y = y0 + rimH + 0.02;
  face.material.polygonOffset = true;
  face.material.polygonOffsetFactor = -2;
  face.material.polygonOffsetUnits = -2;
  g.add(rim, face);
  g.rotation.y = rng() * Math.PI * 2;
  return g;
}
