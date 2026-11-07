import * as THREE from 'three';
import { roleColor } from './palette.js';

// B · PS1 low-poly – the look of 1990s console 3D:
//  - very few polygons (detail multiplier)
//  - vertices snapped to a coarse screen grid, so shapes "wobble" as they move
//  - rendered at a low resolution and scaled up with hard pixels
//  - reduced colour depth with ordered dithering
//  - distance fog
// The low-res render and dithering happen in main.js (see renderPixelated);
// this file supplies materials and the per-frame settings.

const snapRes = { value: new THREE.Vector2(320, 240) };
const cache = new Map();

const ROLE_OVERRIDES = {
  ground: 0x8a8a80,
};

export const ps1Style = {
  id: 'ps1',
  label: 'PS1 low-poly',
  background: 0x7a8794, // hazy sky; fog uses the same colour
  detail: 0.3,
  fog: true,

  options: {
    pixelSize: { value: 3, min: 1, max: 6, step: 1, label: 'Pixel size' },
    wobble:    { value: 0.7, min: 0, max: 1, step: 0.05, label: 'Vertex wobble' },
    dither:    { value: true, label: 'Dither + 15-bit colour' },
  },
  setOption() { /* read live from options in prepareRender / main */ },

  get pixelScale() { return this.options.pixelSize.value; },

  /** Called right before rendering a cell at low resolution w × h. */
  prepareRender(w, h) {
    // wobble 0 snaps to a grid 4x finer than the pixels (barely visible),
    // wobble 1 snaps to a grid at half the pixel resolution (very shaky)
    const k = 4 - 3.5 * this.options.wobble.value;
    snapRes.value.set(w * k, h * k);
  },

  material(role) {
    if (!cache.has(role)) {
      const color = ROLE_OVERRIDES[role] !== undefined
        ? new THREE.Color(ROLE_OVERRIDES[role])
        : roleColor(role, { toward: 0x808080, amount: 0.12 });
      // Lambert = simple diffuse lighting, close to the period's Gouraud shading
      const m = new THREE.MeshLambertMaterial({ color });
      m.onBeforeCompile = (shader) => {
        shader.uniforms.snapRes = snapRes;
        shader.vertexShader = 'uniform vec2 snapRes;\n' + shader.vertexShader.replace(
          '#include <project_vertex>',
          `#include <project_vertex>
           vec4 snapped = gl_Position;
           snapped.xy = floor( snapped.xy / snapped.w * snapRes * 0.5 + 0.5 ) / ( snapRes * 0.5 ) * snapped.w;
           gl_Position = snapped;`,
        );
      };
      m.customProgramCacheKey = () => 'ps1-snap';
      m.userData.role = role;
      cache.set(role, m);
    }
    return cache.get(role);
  },

  createLights() {
    const hemi = new THREE.HemisphereLight(0xdfe6ee, 0x55504a, 1.5);
    const key = new THREE.DirectionalLight(0xfff2dc, 2.0);
    key.castShadow = true;
    key.shadow.mapSize.set(512, 512); // chunky shadows suit the era
    return { objects: [hemi, key, key.target], key, hemi };
  },
};
