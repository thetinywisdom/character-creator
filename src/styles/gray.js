import * as THREE from 'three';

// Milestone 2 style: neutral clay, for judging silhouettes and proportions
// before any colour or rendering tricks get involved. Each material "role"
// gets a slightly different value so parts still read apart.

const TONES = {
  skin: 0xd9d9d9,
  cloth: 0x9c9c9c,
  clothAlt: 0x6f6f6f,
  shoe: 0x4d4d4d,
  hair: 0x4a4a4a,
  eye: 0x161616,
  fur: 0xb5b5b5,
  furLight: 0xdedede,
  nose: 0x5a5a5a,
  bark: 0x6b6b6b,
  leaf: 0xa9a9a9,
  ground: 0x6a6d72,
};

const cache = new Map();

export const grayStyle = {
  id: 'gray',
  label: 'Gray-box',
  background: 0x2a2c30,

  material(role) {
    if (!cache.has(role)) {
      cache.set(role, new THREE.MeshStandardMaterial({
        color: TONES[role] ?? 0xaaaaaa,
        roughness: role === 'eye' ? 0.35 : 0.9,
        metalness: 0,
      }));
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
    return { objects: [hemi, key, key.target, rim], key };
  },
};
