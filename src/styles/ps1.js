import * as THREE from 'three';
import { BUILDING_ROLES, roleColor, snapColor } from './palette.js';

// PS1 low-poly – the look of 1990s console 3D:
//  - very few polygons (detail multiplier)
//  - vertices snapped to a coarse screen grid, so shapes "wobble" as they move
//  - rendered at a low resolution and scaled up with hard pixels
//  - reduced colour depth with ordered dithering
//  - optional distance fog
// The low-res render, dithering and pixel outlines happen in main.js
// (renderCell); this file supplies materials, lights and per-frame settings.
//
// createPs1Style() builds variants so we can compare treatments that make
// tiny characters easier to see (brightness, fog, outlines, blob shadows...).

// Roles that belong to characters. "Colour priority" keeps these vivid while
// the environment is toned down, so characters pop against the city.
const CHARACTER_ROLES = new Set(['skin', 'cloth', 'clothAlt', 'accent', 'shoe', 'hair', 'fur', 'furLight']);
const CHARACTERS = new Set(['human', 'cat']);
// Small, important city items stay vivid too (signs, post boxes, lamps).
const VIVID_ROLES = new Set(['signage', 'light']);

function adjust(color, { saturate = 1, lighten = 0 }) {
  const hsl = color.getHSL({});
  color.setHSL(hsl.h, THREE.MathUtils.clamp(hsl.s * saturate, 0, 1), hsl.l + (1 - hsl.l) * lighten);
  return color;
}

export function createPs1Style({
  id,
  label,
  background,
  fog = false,
  groundColor = 0x8a8a80,
  muted = 0.12,                   // mix every colour toward grey by this much
  characterBoost = null,          // { saturate } for character roles
  environment = null,             // { saturate, lighten } for everything else
  hemi = [0xdfe6ee, 0x55504a, 1.5],
  key = [0xfff2dc, 2.0],
  pixelSize = 3,
  wobble = 0.7,
  dither = true,
  outline = false,
  blobShadows = false,
}) {
  const snapRes = { value: new THREE.Vector2(320, 240) };
  const cache = new Map();

  const blobMaterial = new THREE.MeshBasicMaterial({
    color: 0x000000, transparent: true, opacity: 0.45, depthWrite: false,
    polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
  });

  const style = {
    id,
    label,
    background,
    detail: 0.3,
    fog,

    options: {
      pixelSize: { value: pixelSize, min: 1, max: 6, step: 1, label: 'Pixel size' },
      wobble:    { value: wobble, min: 0, max: 1, step: 0.05, label: 'Vertex wobble' },
      dither:    { value: dither, label: 'Dither + 15-bit colour' },
      outline:   { value: outline, label: 'Pixel outlines' },
    },
    setOption() { /* read live from options */ },

    get pixelScale() { return this.options.pixelSize.value; },
    get outline() { return this.options.outline.value; },
    get dither() { return this.options.dither.value; },

    /** Called right before rendering a cell at low resolution w × h. */
    prepareRender(w, h) {
      // wobble 0 snaps to a grid 4x finer than the pixels (barely visible),
      // wobble 1 snaps to a grid at half the pixel resolution (very shaky)
      const k = 4 - 3.5 * this.options.wobble.value;
      snapRes.value.set(w * k, h * k);
    },

    /** map: optional texture (sign faces, shop signs); the colour then tints it. */
    material(role, baseColor, map = null) {
      const key = `${role}:${baseColor ?? ''}:${map?.uuid ?? ''}`;
      if (!cache.has(key)) {
        let color = role === 'ground'
          ? new THREE.Color(groundColor)
          : roleColor(role, { color: baseColor, toward: 0x808080, amount: muted });
        const vivid = CHARACTER_ROLES.has(role) || VIVID_ROLES.has(role);
        if (map) color = new THREE.Color(baseColor ?? 0xffffff); // textures keep their own colours (already on the palette)
        else if (vivid && characterBoost) adjust(color, characterBoost);
        else if (!vivid && environment) adjust(color, environment);
        // THE PALETTE: every colour snaps to it (skin keeps its natural tones)
        if (!map && role !== 'skin') color.setHex(snapColor(color.getHex(), { building: BUILDING_ROLES.has(role) }));
        // Lambert = simple diffuse lighting, close to the period's Gouraud shading
        const m = new THREE.MeshLambertMaterial({ color, map });
        // lamps glow a little by day; a sign face (a texture) barely, or its text washes out (full glow at night: atmosphere.js)
        if (role === 'light') { m.emissive = color.clone(); m.emissiveIntensity = map ? 0.12 : 0.55; }
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
        // stencil 0 = "no person visible here" (city/silhouette.js draws hidden people only there)
        m.stencilWrite = true;
        m.stencilRef = 0;
        m.stencilZPass = THREE.ReplaceStencilOp;
        m.userData.role = role;
        cache.set(key, m);
      }
      return cache.get(key);
    },

    /** Blob shadow: the dark disc PS1/N64 games put under characters. */
    decorate(root) {
      if (!blobShadows || !CHARACTERS.has(root.name)) return;
      const box = new THREE.Box3().setFromObject(root);
      const size = box.getSize(new THREE.Vector3());
      const blob = new THREE.Mesh(new THREE.CircleGeometry(1, 10), blobMaterial);
      blob.rotation.x = -Math.PI / 2;
      // the cat's tail would stretch the blob, so use its body length instead
      const depth = root.name === 'cat' ? size.z * 0.6 : size.z;
      blob.scale.set(Math.max(size.x, 0.12) * 0.65, Math.max(depth, 0.12) * 0.65, 1);
      const cz = root.name === 'cat' ? 0 : (box.min.z + box.max.z) / 2; // cat body is centred on z = 0
      blob.position.set((box.min.x + box.max.x) / 2, 0.01, cz);
      blob.renderOrder = 1;
      blob.userData.outline = true; // don't cast/receive real shadows
      root.add(blob);
    },

    createLights() {
      const h = new THREE.HemisphereLight(hemi[0], hemi[1], hemi[2]);
      const k = new THREE.DirectionalLight(key[0], key[1]);
      k.castShadow = true;
      k.shadow.mapSize.set(512, 512); // chunky shadows suit the era
      return { objects: [h, k, k.target], key: k, hemi: h };
    },
  };
  return style;
}

// Bright, plus every trick for spotting tiny characters: smaller pixels,
// pixel outlines, blob shadows, vivid characters against a calmer city.
export const ps1Clear = createPs1Style({
  id: 'ps1-clear',
  label: 'PS1 · Bright + clear',
  background: 0xbcd2e0, // the palette's Sky
  groundColor: 0xcfccc4,
  muted: 0,
  // no saturation boosts: everything snaps to the muted / pastel palette
  characterBoost: null,
  environment: null,
  hemi: [0xeaf6ff, 0x6b6456, 1.7],
  key: [0xfff6e6, 2.4],
  pixelSize: 2,
  wobble: 0.4,
  outline: true,
  blobShadows: false, // off: the real cast shadows are enough (owner, item 22)
});
