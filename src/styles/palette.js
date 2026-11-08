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
};

// sRGB hex -> CIE Lab (for "nearest colour as the eye sees it")
function lab(hex) {
  const f = (c) => { c /= 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
  const r = f((hex >> 16) & 255), g = f((hex >> 8) & 255), b = f(hex & 255);
  const x = (r * 0.4124 + g * 0.3576 + b * 0.1805) / 0.95047, y = r * 0.2126 + g * 0.7152 + b * 0.0722, z = (r * 0.0193 + g * 0.1192 + b * 0.9505) / 1.08883;
  const k = (t) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  return [116 * k(y) - 16, 500 * (k(x) - k(y)), 200 * (k(y) - k(z))];
}
const PAL = Object.values(PALETTE).map((h) => [h, lab(h)]);
const snapCache = new Map();

/** The palette colour nearest to `hex` (bright colours are tamed first, so a red sign becomes dusty rose, not grey). */
export function snapColor(hex) {
  hex &= 0xffffff;
  if (snapCache.has(hex)) return snapCache.get(hex);
  let [L, a, b] = lab(hex);
  // tame: cut the colourfulness, keep the hue, so loud colours land on their pastel
  const c = Math.hypot(a, b), max = 22;
  if (c > max) { a *= max / c; b *= max / c; }
  L = Math.max(22, Math.min(95, L));
  let best = PAL[0][0], bd = Infinity;
  for (const [h, [l2, a2, b2]] of PAL) {
    const d = (L - l2) ** 2 * 0.6 + (a - a2) ** 2 + (b - b2) ** 2;
    if (d < bd) { bd = d; best = h; }
  }
  snapCache.set(hex, best);
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
