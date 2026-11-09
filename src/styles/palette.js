import * as THREE from 'three';

// Base colours per material role. A model can also pass its own colour for a
// role (a red shirt, blonde hair); styles then apply their treatment to that
// colour (PS1 boosts character saturation, ink keeps it flat).
export const BASE = {
  skin: 0xefc39e,
  cloth: 0x3f7fd6,     // tops
  clothAlt: 0x2c3652,  // trousers, shorts, skirts
  accent: 0xf2f2ee,    // collars, plackets and other small trims
  shoe: 0x6a4029,
  hair: 0x3a2520,
  fur: 0xe8913f,       // orange cat
  furLight: 0xfff0db,  // muzzle, paws, inner ears
  bark: 0x7a5134,
  leaf: 0x5dab47,
  // city backdrop
  road: 0x4a4d55,
  sidewalk: 0xb9b2a6,
  building: 0xc98a62,
  buildingAlt: 0x8fa3b8,
  window: 0x3a4556,
  // props and city
  metal: 0x9aa0a6,      // poles, frames
  darkMetal: 0x3c4046,  // legs, housings
  wood: 0x9a6a3e,
  concrete: 0xb4b0a8,
  paint: 0xd8d8d8,      // vehicle bodies (colour passed per prop)
  glass: 0x2e3b4c,      // car and shop windows
  tire: 0x1f1f22,
  signage: 0xd83a34,    // signs, post box, hydrant (vivid, readable when small)
  light: 0xfff3c4,      // lamps and traffic-light lenses (glow at night)
  grass: 0x78a85a,
  roof: 0x4a5560,
};

// Character colour choices. Small, curated lists keep crowds harmonious.
export const SKIN_TONES = {
  Porcelain: 0xf6d7c3,
  Light: 0xefc39e,
  Tan: 0xd9a066,
  Olive: 0xb3844f,
  Brown: 0x8d5a3b,
  Deep: 0x5a3825,
};

export const HAIR_COLORS = {
  Black: 0x2f3236,        // Ink
  'Dark brown': 0x66584c, // Walnut
  Brown: 0x8a7462,        // Cocoa
  Blonde: 0xd8caa8,       // Sand
  Red: 0xc99c98,          // Dusty rose
  Gray: 0xb3b0a8,         // Stone
  White: 0xf2efe8,        // Off white
  Pink: 0xe8c8c4,         // Blush
  Blue: 0x9fb6cc,         // Powder blue
};

export const CLOTH_COLORS = {
  Blue: 0x9fb6cc,         // Powder blue
  'Light blue': 0xbcd2e0, // Sky
  Red: 0xc99c98,          // Dusty rose
  Yellow: 0xece0aa,       // Butter
  Green: 0xb6c6a6,        // Sage
  Orange: 0xdcb08c,       // Apricot
  Purple: 0xa99dbf,       // Lilac
  Pink: 0xe8c8c4,         // Blush
  Teal: 0x9fbfb6,         // Seafoam
  White: 0xf2efe8,        // Off white
  Black: 0x2f3236,        // Ink
  Gray: 0x918f8a,
  Navy: 0x56647a,
  Denim: 0x7d93ab,
  Khaki: 0xd8caa8,        // Sand
  Brown: 0x8a7462,        // Cocoa
};

// ---------------------------------------------------------------------------
// THE PALETTE (the owner's rule): muted greys and off-whites, soft pastels,
// a few muted darks for contrast. No bright or shocking colours. Every
// material colour and every painted texture is snapped to the nearest entry
// (snapColor / paletteCanvas), so nothing can step outside it. Skin tones
// are the one exception (kept natural).
export const PALETTE = {
  // greyscale: muted, monotone, grey and off-white
  'Off white': 0xf2efe8,
  Paper: 0xe4e0d6,
  'Light gray': 0xcfccc4,
  Stone: 0xb3b0a8,
  Gray: 0x918f8a,
  Slate: 0x6f747a,
  Charcoal: 0x4a4d52,
  Ink: 0x2f3236,
  // pastels
  Blush: 0xe8c8c4,
  'Dusty rose': 0xc99c98,
  Peach: 0xecccb0,
  Apricot: 0xdcb08c,
  Butter: 0xece0aa,
  Sand: 0xd8caa8,
  Sage: 0xb6c6a6,
  Mint: 0xc4dccf,
  Seafoam: 0x9fbfb6,
  Sky: 0xbcd2e0,
  'Powder blue': 0x9fb6cc,
  Lavender: 0xc9c2dc,
  Lilac: 0xa99dbf,
  // muted darks (for contrast: roads, trousers, leaves, wood)
  Moss: 0x8aa082,
  Denim: 0x7d93ab,
  Navy: 0x56647a,
  Tan: 0xb89e80,
  Cocoa: 0x8a7462,
  Walnut: 0x66584c,
  // building exception: brick
  Brick: 0x9e6c60,
};

// Buildings follow a stricter rule (as Japanese townscape guidelines keep
// colours natural): greys and off-whites only, plus brick and wood browns.
// No yellow, pink, blue or green walls or roofs.
export const BUILDING_PALETTE = ['Off white', 'Paper', 'Light gray', 'Stone', 'Gray', 'Slate', 'Charcoal', 'Ink', 'Brick', 'Tan', 'Cocoa', 'Walnut'];
/** Material roles that count as "the building" (walls, roofs, wood, concrete). */
export const BUILDING_ROLES = new Set(['building', 'buildingAlt', 'roof', 'concrete', 'wood']);

// sRGB hex -> CIE Lab (for "nearest colour as the eye sees it")
function lab(hex) {
  const f = (c) => { c /= 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
  const r = f((hex >> 16) & 255), g = f((hex >> 8) & 255), b = f(hex & 255);
  const x = (r * 0.4124 + g * 0.3576 + b * 0.1805) / 0.95047, y = r * 0.2126 + g * 0.7152 + b * 0.0722, z = (r * 0.0193 + g * 0.1192 + b * 0.9505) / 1.08883;
  const k = (t) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  return [116 * k(y) - 16, 500 * (k(x) - k(y)), 200 * (k(y) - k(z))];
}
const PAL = Object.values(PALETTE).map((h) => [h, lab(h)]);
const PAL_BUILDING = BUILDING_PALETTE.map((n) => [PALETTE[n], lab(PALETTE[n])]);
const snapCache = new Map(), snapBuildingCache = new Map();

// ---------------------------------------------------------------------------
// PALETTE VARIANTS (owner: "I want more vibrant, and other variants"): a
// palette swap, the retro way. Every colour still snaps to one of the 28
// named swatches above; a variant then says what each swatch looks like.
// So the whole game (buildings, clothes, signs, cars, the cat, the sky)
// changes together and stays harmonious. Chosen with the 🎨 button (main.js),
// kept in localStorage 'tinycity.palette'; the page reloads to rebuild.
const N = Object.keys(PALETTE); // swatch order, as in PALETTE
const swap = (...hexes) => Object.fromEntries(N.map((n, i) => [n, hexes[i]]));
export const PALETTES = {
  Muted: { label: 'Muted pastels (the first look)', map: null },
  Vibrant: {
    label: 'Bright, saturated toy town',
    map: swap(0xfbf8f0, 0xf1ead8, 0xd9d6cf, 0xb9b5ad, 0x8f8c87, 0x5f6773, 0x3e424a, 0x23262b,
      0xff9fb2, 0xe0505a, 0xffb38a, 0xff8c3a, 0xffd93d, 0xe8c47a, 0x7ccf6a, 0x6fe0c0, 0x2fb3a0, 0x7cc7ff, 0x4a90e8, 0xb9a4ff, 0x8c63e0,
      0x4f9a3f, 0x3f6fb8, 0x2b3f75, 0xc99a62, 0x8a5a3a, 0x5a3b2a, 0xc0503c),
    skin: { saturate: 1.15 },
  },
  'Candy pop': {
    label: 'Sweet, bright pastels',
    map: swap(0xfffaf4, 0xfff1e2, 0xe6e2f0, 0xcbc6da, 0xa39fb8, 0x7c7898, 0x514c6e, 0x35304a,
      0xffc2d6, 0xff7aa2, 0xffd0b0, 0xffad7a, 0xfff07a, 0xffe0a8, 0xb4f08c, 0xa8f5dc, 0x6ee0c8, 0xa8dcff, 0x7ab4ff, 0xdcc8ff, 0xb28cff,
      0x7ccf6a, 0x6a8cf0, 0x4a4fa8, 0xe8b88a, 0xb07a5a, 0x7a5040, 0xe8746a),
    skin: { saturate: 1.1, lighten: 0.08 },
  },
  'Golden hour': {
    label: 'Warm sunset light (default)',
    map: swap(0xfff1dc, 0xf6e2c4, 0xe0cbb0, 0xc7ad90, 0xa08670, 0x75605a, 0x4f3e3e, 0x33272b,
      0xffb8a0, 0xe0705a, 0xffc290, 0xff9a4a, 0xffd36a, 0xf0c890, 0xb8c070, 0xc8d8a0, 0x88b098, 0xffc89a, 0x8aa0c8, 0xd0a8c0, 0xa07898,
      0x8a9a50, 0x6a7aa0, 0x4a4870, 0xd0a070, 0x9a6848, 0x6a4634, 0xc05a40),
    skin: { saturate: 1.1, warm: 0.08 },
  },
  'Cool city': {
    label: 'Blue hour: cool blues and teals',
    map: swap(0xeef4f8, 0xdde8ee, 0xc4d2dc, 0xa6b6c4, 0x8495a6, 0x5c6c80, 0x3a4658, 0x232c3a,
      0xf0b8c8, 0xd86a8a, 0xf0c8b0, 0xf0a070, 0xf0e08a, 0xd8d0b0, 0x8ed0a0, 0xa0f0e0, 0x40c0c0, 0x9ad8f0, 0x5aa0e0, 0xb8b0f0, 0x8070d0,
      0x4a9a80, 0x3a78b0, 0x24406a, 0xb0a090, 0x7a6a68, 0x504850, 0xb0605a),
  },
  'Retro 16': {
    label: 'A 16-colour console palette',
    // each swatch -> the nearest of the 16 (fixed by hand where nearest looked wrong)
    map: swap(0xfff1e8, 0xfff1e8, 0xc2c3c7, 0xc2c3c7, 0x83769c, 0x5f574f, 0x5f574f, 0x1d2b53,
      0xffccaa, 0xff77a8, 0xffccaa, 0xffa300, 0xffec27, 0xffccaa, 0x00e436, 0xc2c3c7, 0x008751, 0x29adff, 0x29adff, 0xc2c3c7, 0x83769c,
      0x008751, 0x29adff, 0x1d2b53, 0xab5236, 0xab5236, 0x5f574f, 0x7e2553),
    skin: { snap: [0xffccaa, 0xab5236] },
  },
  'Manga ink': {
    label: 'Black and white, one red: a printed comic',
    map: swap(0xffffff, 0xf2f2f2, 0xdcdcdc, 0xc4c4c4, 0x9a9a9a, 0x6e6e6e, 0x444444, 0x111111,
      0xe8e8e8, 0xd83a34, 0xe2e2e2, 0xbdbdbd, 0xf0f0f0, 0xd6d6d6, 0xcfcfcf, 0xe6e6e6, 0xaaaaaa, 0xf7f7f7, 0xb4b4b4, 0xdedede, 0x9e9e9e,
      0x8a8a8a, 0x8c8c8c, 0x555555, 0xb0b0b0, 0x7a7a7a, 0x4e4e4e, 0xd83a34),
    skin: { grey: 0.94 },
  },
};
let ACTIVE = 'Golden hour'; // the default (owner's pick)
try { const v = localStorage.getItem('tinycity.palette'); if (PALETTES[v]) ACTIVE = v; } catch { /* no storage: the default */ }
const MAP = () => PALETTES[ACTIVE].map;
const OUT = new Set(Object.values(MAP() ?? {})); // colours of the active variant (already snapped)
const NAME_OF = new Map(Object.entries(PALETTE).map(([n, h]) => [h, n]));
/** The palette in use ('Muted', 'Vibrant', ...). */
export function activePalette() { return ACTIVE; }
/** Choose a palette for the next page load (main.js reloads). */
export function choosePalette(name) { try { localStorage.setItem('tinycity.palette', PALETTES[name] ? name : 'Golden hour'); } catch { /* fine */ } }
/** What a named swatch looks like in the active palette. */
export function paletteHex(name) { return MAP()?.[name] ?? PALETTE[name]; }
/** A palette's swatch as it looks (for previews of palettes not in use). */
export function swatchOf(palette, name) { return PALETTES[palette]?.map?.[name] ?? PALETTE[name]; }
/** Skin keeps natural tones, but follows the palette's mood a little (manga: grey). */
export function skinTone(hex) {
  const t = PALETTES[ACTIVE].skin;
  if (!t) return hex;
  const c = new THREE.Color(hex);
  if (t.grey !== undefined) { const l = c.getHSL({}).l; return new THREE.Color().setHSL(0, 0, Math.max(t.grey, l)).getHex(); }
  if (t.snap) { const [light, dark] = t.snap; return c.getHSL({}).l > 0.55 ? light : dark; }
  const hsl = c.getHSL({});
  c.setHSL(hsl.h - (t.warm ?? 0) * 0.1, Math.min(1, hsl.s * (t.saturate ?? 1)), hsl.l + (1 - hsl.l) * (t.lighten ?? 0));
  return c.getHex();
}

/**
 * The palette colour nearest to `hex` (bright colours are tamed first, so a
 * red sign becomes dusty rose, not grey), as the active palette variant shows
 * it. building: true snaps to the building palette (greys, brick, wood browns).
 */
export function snapColor(hex, { building = false } = {}) {
  hex &= 0xffffff;
  if (OUT.has(hex)) return hex; // already a colour of the active variant (snapping twice changes nothing)
  const cache = building ? snapBuildingCache : snapCache;
  if (cache.has(hex)) return cache.get(hex);
  let [L, a, b] = lab(hex);
  // tame: cut the colourfulness, keep the hue, so loud colours land on their pastel
  const c = Math.hypot(a, b), max = 22;
  if (c > max) { a *= max / c; b *= max / c; }
  L = Math.max(22, Math.min(95, L));
  let best = PAL[0][0], bd = Infinity;
  for (const [h, [l2, a2, b2]] of building ? PAL_BUILDING : PAL) {
    const d = (L - l2) ** 2 * 0.6 + (a - a2) ** 2 + (b - b2) ** 2;
    if (d < bd) { bd = d; best = h; }
  }
  if (MAP()) best = MAP()[NAME_OF.get(best)] ?? best; // the variant's colour for that swatch
  cache.set(hex, best);
  return best;
}

/** Snap every pixel of a painted canvas to the palette (signs, interiors, facades). */
export function paletteCanvas(canvas) {
  const ctx = canvas.getContext('2d');
  const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] === 0) continue;
    const h = snapColor((d[i] << 16) | (d[i + 1] << 8) | d[i + 2]);
    d[i] = (h >> 16) & 255; d[i + 1] = (h >> 8) & 255; d[i + 2] = h & 255;
  }
  ctx.putImageData(img, 0, 0);
  return canvas;
}

/** Base colour for a role, optionally mixed toward `toward` by `amount`. */
export function roleColor(role, { toward, amount = 0, color } = {}) {
  const c = new THREE.Color(color ?? BASE[role] ?? 0xaaaaaa);
  if (toward !== undefined) c.lerp(new THREE.Color(toward), amount);
  return c;
}
