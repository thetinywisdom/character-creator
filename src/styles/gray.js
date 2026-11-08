import * as THREE from 'three';

// Neutral clay for judging silhouettes and proportions without colour.
// Each material role gets a slightly different value so parts still read apart.

const TONES = {
  skin: 0xd9d9d9, cloth: 0x9c9c9c, accent: 0xc4c4c4, clothAlt: 0x6f6f6f, shoe: 0x4d4d4d,
  hair: 0x4a4a4a, fur: 0xb5b5b5, furLight: 0xdedede,
  bark: 0x6b6b6b, leaf: 0xa9a9a9, ground: 0x6a6d72,
  road: 0x505257, sidewalk: 0x8f9196, building: 0x7c7e83, buildingAlt: 0x67696e, window: 0x3d3f44,
  metal: 0xa0a0a0, darkMetal: 0x55575a, wood: 0x8a8a8a, concrete: 0xb0b0b0, paint: 0xc8c8c8,
  glass: 0x404248, tire: 0x2a2a2a, signage: 0x9a9a9a, light: 0xe8e8e8, grass: 0x8f8f8f, roof: 0x5a5a5a,
};

const cache = new Map();

export const grayStyle = {
  id: 'gray',
  label: 'Gray-box',
  background: 0x2a2c30,

  // ignores per-item colours on purpose: gray-box is for judging shapes only
  material(role) {
    if (!cache.has(role)) {
      const m = new THREE.MeshStandardMaterial({
        color: TONES[role] ?? 0xaaaaaa,
        roughness: 0.9,
      });
      m.userData.role = role;
      cache.set(role, m);
    }
    return cache.get(role);
  },

  createLights() {
    const hemi = new THREE.HemisphereLight(0xffffff, 0x3a3a3a, 1.4);
    const key = new THREE.DirectionalLight(0xffffff, 2.2);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    const rim = new THREE.DirectionalLight(0xffffff, 0.6);
    rim.position.set(-3, 2, -4);
    return { objects: [hemi, key, key.target, rim], key, hemi };
  },
};
