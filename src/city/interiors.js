import * as THREE from 'three';
import { paletteCanvas } from '../styles/palette.js';
import { box } from '../props/util.js';

// Painted interiors: what you see through a shop window is a small picture of
// the inside (shelves, counters, people, lights), drawn once per shop type on
// a canvas and shared by every shop of that type. It is meant to feel real,
// not be real: one flat panel per window, no modelled items, so a whole town
// costs almost nothing. Upper-floor windows get painted curtains the same way.

const W = 256, H = 128;
const cache = new Map();

function canvas(w = W, h = H) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return [c, c.getContext('2d')];
}
function texture(c, { mask = false } = {}) {
  if (!mask) paletteCanvas(c); // painted pictures use the palette (light masks don't)
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.magFilter = THREE.NearestFilter;
  t.minFilter = THREE.NearestFilter;
  t.generateMipmaps = false;
  return t;
}
// a fixed random sequence, so pictures look the same every visit
let seed = 7;
const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
const pick = (a) => a[Math.floor(rnd() * a.length)];
const GOODS = ['#d8302a', '#f0b818', '#2a62c8', '#279a4a', '#e8609a', '#ee7a18', '#7a3fbf', '#1fa3a0', '#c8302a'];
const TOPS = ['#2a62c8', '#d8302a', '#279a4a', '#f0b818', '#7a3fbf', '#e8609a', '#5a6068', '#f4f4f0'];
const HAIRS = ['#2a2018', '#1a1a1a', '#5a3a28', '#8a6a48'];

// --- painting pieces ----------------------------------------------------------------
function room(g, wall, floor, ceiling = null) {
  g.fillStyle = wall; g.fillRect(0, 0, W, H);
  g.fillStyle = floor; g.fillRect(0, H * 0.82, W, H * 0.18);
  if (ceiling) { g.fillStyle = ceiling; g.fillRect(0, 0, W, 10); }
}
function lights(g, color = '#fffbe6', n = 4, y = 4) {
  g.fillStyle = color;
  for (let i = 0; i < n; i++) g.fillRect(14 + i * ((W - 28) / n), y, (W - 28) / n - 18, 5);
}
function shelves(g, x, y, w, h, rows = 4, back = '#c8ccd0', edge = '#5a6068', colors = GOODS) {
  g.fillStyle = back; g.fillRect(x, y, w, h);
  const rh = h / rows;
  for (let r = 0; r < rows; r++) {
    g.fillStyle = edge; g.fillRect(x, y + r * rh + rh - 3, w, 3);
    let px = x + 1;
    while (px < x + w - 3) {
      const pw = 5 + Math.floor(rnd() * 6);
      g.fillStyle = pick(colors);
      g.fillRect(px, y + r * rh + 3 + Math.floor(rnd() * 3), Math.min(pw, x + w - px - 2), rh - 7);
      px += pw + 1;
    }
  }
}
function books(g, x, y, w, h, rows = 4) {
  shelves(g, x, y, w, h, rows, '#6a4429', '#3a2418', ['#8a2a22', '#2a4a7a', '#2f6a3a', '#c8a050', '#5a3a68', '#e8dcc0', '#3a3a40']);
}
function fridge(g, x, y, w, h) {
  g.fillStyle = '#bfe0f0'; g.fillRect(x, y, w, h);
  const doors = Math.max(2, Math.round(w / 26));
  for (let d = 0; d < doors; d++) {
    const dx = x + (d * w) / doors;
    g.fillStyle = '#4a5864'; g.fillRect(dx, y, 3, h);
    for (let r = 0; r < 5; r++) for (let b = 0; b < 4; b++) {
      g.fillStyle = pick(GOODS);
      g.fillRect(dx + 5 + b * ((w / doors - 7) / 4), y + 5 + r * ((h - 8) / 5), 4, (h - 8) / 5 - 3);
    }
  }
}
function counter(g, x, y, w, h, top = '#c9c4b8', front = '#a8a298') {
  g.fillStyle = front; g.fillRect(x, y, w, h);
  g.fillStyle = top; g.fillRect(x - 2, y - 4, w + 4, 5);
}
/** A person from the front, feet at y, h tall (seated hides the legs). */
function person(g, x, y, h, top = pick(TOPS), { hair = pick(HAIRS), seated = false, hat = null } = {}) {
  const u = h / 8;
  if (!seated) { g.fillStyle = '#2c3652'; g.fillRect(x - u * 0.9, y - u * 3.6, u * 1.8, u * 3.6); }
  const by = seated ? y : y - u * 3.5;
  g.fillStyle = top; g.fillRect(x - u * 1.2, by - u * 2.9, u * 2.4, u * 2.9);
  g.fillStyle = '#e0b48c'; g.fillRect(x - u * 0.7, by - u * 4.3, u * 1.4, u * 1.5);
  g.fillStyle = hat ?? hair; g.fillRect(x - u * 0.8, by - u * (hat ? 4.8 : 4.5), u * 1.6, u * (hat ? 1.0 : 0.6));
}
function table(g, x, y, w = 34) {
  g.fillStyle = '#6a4429'; g.fillRect(x - w / 2, y - 22, w, 4);
  g.fillRect(x - 2, y - 18, 4, 18);
}
function stools(g, x0, x1, y, n) {
  g.fillStyle = '#8a2a22';
  for (let i = 0; i < n; i++) g.fillRect(x0 + (i * (x1 - x0)) / (n - 1) - 5, y - 12, 10, 4);
  g.fillStyle = '#3a3a40';
  for (let i = 0; i < n; i++) g.fillRect(x0 + (i * (x1 - x0)) / (n - 1) - 1, y - 8, 2, 8);
}
function poster(g, x, y, w, h, bg, lines = 3, fg = '#ffffff') {
  g.fillStyle = bg; g.fillRect(x, y, w, h);
  g.fillStyle = fg;
  for (let i = 0; i < lines; i++) g.fillRect(x + 3, y + 4 + i * ((h - 6) / lines), w - 6, 2);
}

// --- the shop pictures ---------------------------------------------------------------
const PAINT = {
  konbini(g) {
    room(g, '#e8eae6', '#d0d2d0'); lights(g);
    fridge(g, 12, 16, W - 24, 52);
    shelves(g, 24, 70, 130, 36, 2);
    counter(g, 170, 76, 74, 30);
    person(g, 205, 76, 40, '#2a62c8');
    person(g, 80, 122, 58, pick(TOPS));
    poster(g, 172, 20, 30, 22, '#f0b818', 2, '#d8302a');
  },
  drugstore(g) {
    room(g, '#eef0ec', '#d4d6d2'); lights(g, '#ffffff', 5);
    shelves(g, 8, 14, 110, 92, 5); shelves(g, 130, 14, 80, 92, 5);
    g.fillStyle = '#279a4a'; g.fillRect(40, 8, 40, 10); g.fillRect(150, 8, 40, 10); // aisle signs
    counter(g, 214, 70, 40, 36, '#e8e8e4', '#279a4a');
    person(g, 70, 122, 58);
  },
  cafe(g) {
    room(g, '#c9a978', '#7a5232', '#5a3a28');
    g.fillStyle = '#ffd890'; for (let i = 0; i < 3; i++) g.fillRect(40 + i * 80, 10, 10, 10);  // pendant lights
    counter(g, 150, 62, 100, 44, '#3a2418', '#5a3a28');
    g.fillStyle = '#c8ccd0'; g.fillRect(180, 40, 22, 22);                                           // coffee machine
    shelves(g, 160, 18, 84, 18, 1, '#5a3a28', '#3a2418', ['#f4f4f0', '#e8dcc0', '#c8a050']);
    person(g, 214, 62, 34, '#f4f4f0');
    table(g, 50, 112); person(g, 34, 108, 40, pick(TOPS), { seated: true }); person(g, 68, 108, 40, pick(TOPS), { seated: true });
    table(g, 118, 112);
  },
  bakery(g) {
    room(g, '#f2e2c4', '#c8a878'); lights(g, '#fff2c8', 3);
    shelves(g, 10, 14, W - 20, 40, 2, '#a87a48', '#6a4429', ['#c88a40', '#a86a2a', '#e8c080', '#d8a050']);
    g.fillStyle = '#e8eef0'; g.fillRect(20, 72, 150, 34);                                            // display case
    g.fillStyle = '#c88a40'; for (let i = 0; i < 9; i++) g.fillRect(28 + i * 16, 82, 12, 8);
    g.fillStyle = '#a86a2a'; for (let i = 0; i < 9; i++) g.fillRect(30 + i * 16, 94, 10, 7);
    person(g, 200, 106, 54, '#f4f4f0', { hat: '#f4f4f0' });
  },
  books(g) {
    room(g, '#e8dcc6', '#8a6a48'); lights(g, '#fff2c8', 3);
    books(g, 6, 12, 120, 94, 5); books(g, 134, 12, 116, 94, 5);
    person(g, 120, 124, 60);
  },
  ramen(g) {
    room(g, '#e8d8b0', '#6a4429');
    for (let i = 0; i < 6; i++) poster(g, 10 + i * 40, 8, 32, 26, i % 2 ? '#f4ecd8' : '#d8302a', 3, i % 2 ? '#2a2018' : '#ffffff'); // menu boards
    g.fillStyle = '#c8ccd0'; g.fillRect(40, 44, 60, 18);                                              // pots
    person(g, 150, 76, 40, '#f4f4f0', { hat: '#f4f4f0' });
    counter(g, 0, 76, W, 30, '#a87a48', '#6a4429');
    stools(g, 30, 226, 122, 6);
    person(g, 70, 100, 40, pick(TOPS), { seated: true });
  },
  izakaya(g) {
    room(g, '#5a3a28', '#3a2418', '#2a1810');
    g.fillStyle = '#e0402f'; for (let i = 0; i < 4; i++) g.fillRect(30 + i * 60, 10, 14, 18);        // red lanterns
    shelves(g, 30, 34, 196, 26, 1, '#3a2418', '#2a1810', ['#2f6a3a', '#8a6a48', '#e8dcc0', '#3a5a8a']); // bottles
    counter(g, 0, 78, W, 28, '#a87a48', '#6a4429');
    person(g, 70, 102, 40, pick(TOPS), { seated: true }); person(g, 110, 102, 40, pick(TOPS), { seated: true });
    person(g, 190, 78, 40, '#2a2a30', { hat: '#f4f4f0' });
  },
  sushi(g) {
    room(g, '#efe4cc', '#8a6a48');
    g.fillStyle = '#e8eef0'; g.fillRect(20, 58, 216, 14);                                            // fish case
    g.fillStyle = '#d8302a'; for (let i = 0; i < 10; i++) g.fillRect(26 + i * 21, 61, 12, 7);
    person(g, 128, 58, 40, '#f4f4f0', { hat: '#f4f4f0' });
    counter(g, 0, 74, W, 32, '#d8c498', '#a87a48');
    person(g, 60, 100, 40, pick(TOPS), { seated: true }); person(g, 190, 100, 40, pick(TOPS), { seated: true });
  },
  udon(g) {
    room(g, '#efe4cc', '#a87a48');
    g.fillStyle = '#c8a050'; for (let i = 0; i < 9; i++) g.fillRect(12 + i * 27, 8, 20, 30);         // wooden menu tags
    g.fillStyle = '#2a2018'; for (let i = 0; i < 9; i++) g.fillRect(19 + i * 27, 12, 6, 22);
    table(g, 60, 112, 50); table(g, 170, 112, 50);
    person(g, 44, 108, 40, pick(TOPS), { seated: true }); person(g, 186, 108, 40, pick(TOPS), { seated: true });
  },
  family(g) {
    room(g, '#f2e6cc', '#c8b898'); lights(g, '#fff6d8', 5);
    for (let i = 0; i < 3; i++) {
      const x = 20 + i * 82;
      g.fillStyle = '#d8302a'; g.fillRect(x, 64, 60, 42);                                            // booth seats
      g.fillStyle = '#f4f4f0'; g.fillRect(x + 6, 82, 48, 5);                                          // table
      person(g, x + 18, 92, 40, pick(TOPS), { seated: true }); person(g, x + 42, 92, 40, pick(TOPS), { seated: true });
    }
  },
  takoyaki(g) {
    room(g, '#f2e2c4', '#a87a48');
    for (let i = 0; i < 4; i++) poster(g, 14 + i * 60, 8, 48, 24, i % 2 ? '#f0b818' : '#d8302a', 2);
    person(g, 128, 96, 60, '#d8302a', { hat: '#f4f4f0' });
    g.fillStyle = '#2a2a30'; g.fillRect(40, 96, 176, 14);                                            // the griddle
    g.fillStyle = '#c88a40'; for (let i = 0; i < 12; i++) g.fillRect(46 + i * 14, 99, 8, 6);
  },
  bank(g) {
    room(g, '#e4e6e8', '#b8bcc0'); lights(g);
    counter(g, 0, 70, W, 36, '#f4f4f0', '#8a99a8');
    for (let i = 0; i < 3; i++) person(g, 50 + i * 75, 70, 38, '#2c3652');
    g.fillStyle = '#2c3652'; for (let i = 0; i < 3; i++) g.fillRect(30 + i * 75, 18, 40, 10);         // window numbers
    g.fillStyle = '#6a7a8a'; g.fillRect(20, 110, 216, 8);                                             // waiting chairs
  },
  post(g) {
    room(g, '#f4f4f0', '#c8ccd0'); lights(g);
    for (let i = 0; i < 4; i++) poster(g, 16 + i * 60, 14, 44, 30, i % 2 ? '#e84a2a' : '#2a62c8', 3);
    counter(g, 0, 72, W, 34, '#f4f4f0', '#e84a2a');
    person(g, 70, 72, 38, '#2a62c8'); person(g, 170, 72, 38, '#2a62c8');
    person(g, 120, 124, 56);
  },
  clinic(g) {
    room(g, '#e8f2ec', '#c8d8cc'); lights(g, '#ffffff', 3);
    counter(g, 140, 68, 110, 38, '#f4f4f0', '#9ac8a8');
    person(g, 190, 68, 38, '#f4f4f0');
    g.fillStyle = '#6a9a7a'; g.fillRect(10, 100, 110, 8);                                            // waiting bench
    person(g, 40, 104, 40, pick(TOPS), { seated: true }); person(g, 90, 104, 40, pick(TOPS), { seated: true });
    poster(g, 30, 20, 40, 30, '#279a4a', 3);
  },
  koban(g) {
    room(g, '#eef0ec', '#b8bcc0');
    g.fillStyle = '#e8dcc0'; g.fillRect(150, 14, 90, 56);                                            // map on the wall
    g.fillStyle = '#9ab8d8'; g.fillRect(160, 30, 70, 6); g.fillRect(190, 14, 6, 56);
    g.fillStyle = '#8a8e94'; g.fillRect(30, 76, 120, 30);                                            // desk
    person(g, 90, 76, 42, '#2c3a5a', { hat: '#2c3a5a' });
  },
  florist(g) {
    room(g, '#dde8d0', '#8a7a5a');
    for (let r = 0; r < 3; r++) for (let i = 0; i < 12; i++) {
      g.fillStyle = '#3a7a3a'; g.fillRect(8 + i * 20, 20 + r * 30, 16, 12);
      g.fillStyle = pick(['#d8302a', '#f0b818', '#e8609a', '#f4f4f0', '#7a3fbf', '#ee7a18']);
      g.fillRect(10 + i * 20, 16 + r * 30, 12, 8);
    }
    person(g, 200, 122, 56, '#279a4a');
  },
  fish(g) {
    room(g, '#f4f8fa', '#b8c4cc'); lights(g, '#ffffff', 3);
    g.fillStyle = '#d8e4ea'; g.fillRect(0, 60, W, 46);
    g.fillStyle = '#8a99a8'; for (let i = 0; i < 14; i++) g.fillRect(8 + i * 18, 70 + (i % 2) * 14, 14, 6);
    person(g, 160, 60, 40, '#f4f4f0', { hat: '#2a62c8' });
  },
  karaoke(g) {
    room(g, '#2a1840', '#1a1028');
    g.fillStyle = '#e8609a'; g.fillRect(0, 12, W, 6);
    g.fillStyle = '#1fa3a0'; g.fillRect(0, 22, W, 4);
    for (let i = 0; i < 3; i++) poster(g, 20 + i * 76, 32, 56, 36, ['#e8609a', '#f0b818', '#1fa3a0'][i], 3);
    counter(g, 120, 78, 120, 28, '#e8609a', '#3a2858');
    person(g, 180, 78, 38, '#f4f4f0');
    person(g, 60, 122, 56);
  },
  lobby(g) {
    room(g, '#e8e2d6', '#b8b2a4'); lights(g, '#fff6d8', 3);
    g.fillStyle = '#9aa0a6'; g.fillRect(16, 20, 120, 70);                                          // mailbox wall
    g.fillStyle = '#c8ccd0'; for (let r = 0; r < 5; r++) for (let i = 0; i < 6; i++) g.fillRect(19 + i * 19.5, 23 + r * 13.5, 17, 11);
    g.fillStyle = '#5a6068'; for (let r = 0; r < 5; r++) for (let i = 0; i < 6; i++) g.fillRect(24 + i * 19.5, 28 + r * 13.5, 7, 2);
    g.fillStyle = '#d8d4cc'; g.fillRect(170, 18, 60, 88);                                          // lift doors
    g.fillStyle = '#a8acb0'; g.fillRect(199, 18, 2, 88);
    g.fillStyle = '#3fa65a'; g.fillRect(150, 70, 14, 36);                                          // a potted plant
  },
  office(g) {
    room(g, '#e4e6e8', '#b8bcc0'); lights(g);
    for (let i = 0; i < 4; i++) { g.fillStyle = '#8a8e94'; g.fillRect(14 + i * 60, 80, 46, 26); person(g, 37 + i * 60, 80, 34, '#f4f4f0'); }
  },
};
export const INTERIORS = Object.keys(PAINT);

/** The shared painted texture of an interior kind. */
export function interiorTexture(kind) {
  if (!cache.has(kind)) {
    const [c, g] = canvas();
    seed = 7 + kind.length * 131; // each kind always paints the same
    (PAINT[kind] ?? PAINT.office)(g);
    cache.set(kind, texture(c));
  }
  return cache.get(kind);
}

/**
 * A painted interior behind a window: a w × h panel at (x, y-centre, z),
 * facing +z. Set it just behind the window frame.
 */
export function interiorPanel(style, kind, w, h, x, y, z) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), style.material('signage', 0xffffff, interiorTexture(kind)));
  m.position.set(x, y, z);
  return m;
}

/** A shop window: the painted inside plus a thin frame with mullions. */
export function shopWindow(g, style, kind, w, h, x, y, z, { mullions = 3, frame = 0x6a6e74 } = {}) {
  g.add(interiorPanel(style, kind, w, h, x, y, z - 0.015)); // keep it clear of the wall behind
  const fm = style.material('darkMetal', frame);
  g.add(box(w + 0.1, 0.09, 0.09, fm, [x, y + h / 2, z]), box(w + 0.1, 0.09, 0.09, fm, [x, y - h / 2, z]));
  for (let i = 0; i <= mullions; i++) g.add(box(0.07, h, 0.07, fm, [x - w / 2 + (i * w) / mullions, y, z]));
}

// --- painted upper-floor windows ---------------------------------------------------------
let curtains = null;
function curtainTexture() {
  if (curtains) return curtains;
  const [c, w] = canvas(W, 64);
  // night light mask (atmosphere.js): the room glows between the curtains;
  // at night the dark rooms light up too (people come home), the curtains glow dimly
  const [mc, m] = canvas(W, 64);
  m.fillStyle = '#000'; m.fillRect(0, 0, W, 64);
  const VARIANTS = [['#e8d8a8', true], ['#a8c4d8', false], ['#e6b8b8', true], ['#c8d8b0', false]];
  VARIANTS.forEach(([col, lit], i) => {
    const x = i * 64;
    w.fillStyle = lit ? '#fff2c8' : '#4a5664'; w.fillRect(x, 0, 64, 64);
    w.fillStyle = col; w.fillRect(x, 0, 20, 64); w.fillRect(x + 44, 0, 20, 64);
    w.fillStyle = 'rgba(0,0,0,0.3)'; w.fillRect(x, 0, 64, 3); w.fillRect(x + 31, 0, 2, 64);
    m.fillStyle = '#5a4a30'; m.fillRect(x, 0, 64, 64);
    m.fillStyle = i === 3 ? '#000' : '#ffd890'; m.fillRect(x + 20, 3, 24, 61); // one variant stays dark
  });
  curtains = texture(c);
  curtains.userData.glowMap = texture(mc, { mask: true });
  return curtains;
}

/** One painted window (variant 0..3: curtain colour, lit or dark) of ww × wh at (x, y, z). */
export function paintedWindow(style, variant, ww, wh, x, y, z) {
  const geo = new THREE.PlaneGeometry(ww, wh);
  const uv = geo.attributes.uv;
  for (let k = 0; k < uv.count; k++) uv.setX(k, (variant + uv.getX(k)) / 4);
  const m = new THREE.Mesh(geo, style.material('signage', 0xffffff, curtainTexture()));
  m.position.set(x, y, z);
  return m;
}
