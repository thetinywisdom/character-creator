import * as THREE from 'three';

// Base colours per material role. Styles start from these and shift them
// (clay goes pastel, ink keeps them flat). Bright palette by default; the
// colour mood is still an open question for the review.
export const BASE = {
  skin: 0xefc39e,
  cloth: 0x3f7fd6,     // shirt
  clothAlt: 0x2c3652,  // trousers
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
};

/** Base colour for a role, optionally mixed toward `toward` by `amount`. */
export function roleColor(role, { toward, amount = 0 } = {}) {
  const c = new THREE.Color(BASE[role] ?? 0xaaaaaa);
  if (toward !== undefined) c.lerp(new THREE.Color(toward), amount);
  return c;
}
