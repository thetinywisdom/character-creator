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
  Black: 0x1f1a1a,
  'Dark brown': 0x3a2520,
  Brown: 0x6b4226,
  Blonde: 0xe0b860,
  Red: 0xa8432a,
  Gray: 0xa0a0a0,
  White: 0xe8e6e0,
  Pink: 0xe66ea8,
  Blue: 0x3d6fd6,
};

export const CLOTH_COLORS = {
  Blue: 0x3f7fd6,
  'Light blue': 0x9cc4e8,
  Red: 0xd8443c,
  Yellow: 0xf2c230,
  Green: 0x3fa65a,
  Orange: 0xf08a2c,
  Purple: 0x8a55c9,
  Pink: 0xf28cb8,
  Teal: 0x2fb3b0,
  White: 0xf2f2ee,
  Black: 0x26262b,
  Gray: 0x8a8d93,
  Navy: 0x2c3652,
  Denim: 0x4a6f9e,
  Khaki: 0xbfa77a,
  Brown: 0x6a4029,
};

/** Base colour for a role, optionally mixed toward `toward` by `amount`. */
export function roleColor(role, { toward, amount = 0, color } = {}) {
  const c = new THREE.Color(color ?? BASE[role] ?? 0xaaaaaa);
  if (toward !== undefined) c.lerp(new THREE.Color(toward), amount);
  return c;
}
