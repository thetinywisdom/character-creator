import * as THREE from 'three';
import { roleColor } from './palette.js';

// A · Ink & Cel – flat colour bands and bold ink outlines, like a comic panel.
// Shading: MeshToonMaterial with a 3-step ramp (shadow / mid / light).
// Outlines: "inverted hull" – a black back-face copy of every mesh, pushed out
// along its normals in view space. Up close the line keeps a constant width on
// screen; far away it is capped in metres, so tiny figures don't turn to ink blobs.

const RAMP = (() => {
  const tex = new THREE.DataTexture(new Uint8Array([90, 175, 255]), 3, 1, THREE.RedFormat);
  tex.minFilter = tex.magFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  tex.needsUpdate = true;
  return tex;
})();

const INK = 0x1c1a24;
const lineWidth = { value: 0.0032 }; // fraction of distance to camera (screen-constant)
const lineMax = { value: 0.012 };     // metres: lines thin out once objects are far away

const outline = (() => {
  const m = new THREE.MeshBasicMaterial({ color: INK, side: THREE.BackSide });
  m.onBeforeCompile = (shader) => {
    shader.uniforms.lineWidth = lineWidth;
    shader.uniforms.lineMax = lineMax;
    shader.vertexShader = 'uniform float lineWidth;\nuniform float lineMax;\n' + shader.vertexShader.replace(
      '#include <project_vertex>',
      `vec4 mvPosition = modelViewMatrix * vec4( transformed, 1.0 );
       vec3 nView = normalize( normalMatrix * normal );
       mvPosition.xyz += nView * min( lineWidth * -mvPosition.z, lineMax );
       gl_Position = projectionMatrix * mvPosition;`,
    );
  };
  m.customProgramCacheKey = () => 'ink-outline';
  return m;
})();

const cache = new Map();

export const inkCelStyle = {
  id: 'ink',
  label: 'Ink & Cel',
  background: 0xf3eee3, // paper
  detail: 1,

  // tweakable from the controls panel
  options: {
    lineWidth: { value: 3.2, min: 0, max: 10, step: 0.1, label: 'Ink line width' },
    lineMax:   { value: 1.2, min: 0, max: 5, step: 0.1, label: 'Max line width (cm)' },
  },
  setOption(key, v) {
    if (key === 'lineWidth') lineWidth.value = v / 1000;
    if (key === 'lineMax') lineMax.value = v / 100;
  },

  material(role, color, map = null) {
    const key = `${role}:${color ?? ''}:${map?.uuid ?? ''}`;
    if (!cache.has(key)) {
      const c = map ? new THREE.Color(0xffffff) : role === 'ground' ? new THREE.Color(0xe2d8c3) : roleColor(role, { color });
      const m = new THREE.MeshToonMaterial({ color: c, gradientMap: RAMP, map });
      m.userData.role = role;
      cache.set(key, m);
    }
    return cache.get(key);
  },

  /** Add an ink outline shell to every mesh of a freshly built object. */
  decorate(root) {
    const meshes = [];
    root.traverse((o) => { if (o.isMesh) meshes.push(o); });
    for (const mesh of meshes) {
      const shell = new THREE.Mesh(mesh.geometry, outline);
      shell.castShadow = false;
      shell.receiveShadow = false;
      shell.userData.outline = true;
      mesh.add(shell);
    }
  },

  createLights() {
    const hemi = new THREE.HemisphereLight(0xffffff, 0xb8a98f, 0.9);
    const key = new THREE.DirectionalLight(0xffffff, 2.4);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    return { objects: [hemi, key, key.target], key, hemi };
  },
};
