// Tiny City office kit loader (three.js ES module).
//   import { loadOfficeKit, placeOfficeItem } from './loadOfficeKit.js';
//   await loadOfficeKit({ baseUrl: './' });                       // reads manifest.json, sets palette
//   await placeOfficeItem(scene, 'desk', { x: 0, z: 0, rotY: Math.PI / 2 });
//
// Every GLB material is named 'role:Swatch' (e.g. 'wood:Tan'), using the Tiny City
// palette names (src/styles/palette.js). On load each material is swapped for a flat
// MeshLambertMaterial in the chosen palette variant (default 'Golden hour', the town's
// default), or, inside the Tiny City repo, for style.material(role, hex) so the PS1
// vertex wobble, palette snapping and outline flags all apply.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const SWATCHES = ['Off white', 'Paper', 'Light gray', 'Stone', 'Gray', 'Slate', 'Charcoal', 'Ink',
  'Blush', 'Dusty rose', 'Peach', 'Apricot', 'Butter', 'Sand', 'Sage', 'Mint', 'Seafoam', 'Sky', 'Powder blue', 'Lavender', 'Lilac',
  'Moss', 'Denim', 'Navy', 'Tan', 'Cocoa', 'Walnut', 'Brick'];
const swap = (...h) => Object.fromEntries(SWATCHES.map((n, i) => [n, h[i]]));
/** Base palette ('Muted') + the repo's variants, copied from src/styles/palette.js. */
export const PALETTES = {
  Muted: swap(0xf2efe8, 0xe4e0d6, 0xcfccc4, 0xb3b0a8, 0x918f8a, 0x6f747a, 0x4a4d52, 0x2f3236,
    0xe8c8c4, 0xc99c98, 0xecccb0, 0xdcb08c, 0xece0aa, 0xd8caa8, 0xb6c6a6, 0xc4dccf, 0x9fbfb6, 0xbcd2e0, 0x9fb6cc, 0xc9c2dc, 0xa99dbf,
    0x8aa082, 0x7d93ab, 0x56647a, 0xb89e80, 0x8a7462, 0x66584c, 0x9e6c60),
  'Golden hour': swap(0xfff1dc, 0xf6e2c4, 0xe0cbb0, 0xc7ad90, 0xa08670, 0x75605a, 0x4f3e3e, 0x33272b,
    0xffb8a0, 0xe0705a, 0xffc290, 0xff9a4a, 0xffd36a, 0xf0c890, 0xb8c070, 0xc8d8a0, 0x88b098, 0xffc89a, 0x8aa0c8, 0xd0a8c0, 0xa07898,
    0x8a9a50, 0x6a7aa0, 0x4a4870, 0xd0a070, 0x9a6848, 0x6a4634, 0xc05a40),
  'Cool city': swap(0xeef4f8, 0xdde8ee, 0xc4d2dc, 0xa6b6c4, 0x8495a6, 0x5c6c80, 0x3a4658, 0x232c3a,
    0xf0b8c8, 0xd86a8a, 0xf0c8b0, 0xf0a070, 0xf0e08a, 0xd8d0b0, 0x8ed0a0, 0xa0f0e0, 0x40c0c0, 0x9ad8f0, 0x5aa0e0, 0xb8b0f0, 0x8070d0,
    0x4a9a80, 0x3a78b0, 0x24406a, 0xb0a090, 0x7a6a68, 0x504850, 0xb0605a),
  Vibrant: swap(0xfbf8f0, 0xf1ead8, 0xd9d6cf, 0xb9b5ad, 0x8f8c87, 0x5f6773, 0x3e424a, 0x23262b,
    0xff9fb2, 0xe0505a, 0xffb38a, 0xff8c3a, 0xffd93d, 0xe8c47a, 0x7ccf6a, 0x6fe0c0, 0x2fb3a0, 0x7cc7ff, 0x4a90e8, 0xb9a4ff, 0x8c63e0,
    0x4f9a3f, 0x3f6fb8, 0x2b3f75, 0xc99a62, 0x8a5a3a, 0x5a3b2a, 0xc0503c),
};

let KIT = null;

/** Load manifest.json (+ layout.json). Options: baseUrl, palette ('Golden hour' | 'Muted' | ... | null = GLB colours as exported), style (a Tiny City style object). */
export async function loadOfficeKit({ baseUrl = './', palette = 'Golden hour', style = null } = {}) {
  const base = baseUrl.endsWith('/') ? baseUrl : baseUrl + '/';
  const [manifest, layout] = await Promise.all(['manifest.json', 'layout.json'].map((f) => fetch(base + f).then((r) => r.json())));
  KIT = { base, manifest, layout, palette, style, loader: new GLTFLoader(), files: new Map(), mats: new Map() };
  return KIT;
}

function material(src) {
  const [role, swatch] = (src.name || '').split(':');
  const key = src.name;
  if (KIT.mats.has(key)) return KIT.mats.get(key);
  const base = PALETTES.Muted[swatch];
  let m;
  if (KIT.style && base !== undefined) {                                           // inside the Tiny City repo
    m = KIT.style.material(role, base);
    if (role === 'glass' && swatch === 'Sky') { m = m.clone(); m.transparent = true; m.opacity = 0.28; m.depthWrite = false; }
  }
  else if (base === undefined || !KIT.palette) m = src;                            // unknown name: keep the GLB material
  else {
    const hex = PALETTES[KIT.palette]?.[swatch] ?? base;
    m = new THREE.MeshLambertMaterial({ color: hex, flatShading: true, name: key });
    if (role === 'light') { m.emissive = new THREE.Color(hex); m.emissiveIntensity = 0.55; }
    if (role === 'glass' && swatch === 'Sky') { m.transparent = true; m.opacity = 0.28; m.depthWrite = false; } // window panes: see-through
  }
  KIT.mats.set(key, m);
  return m;
}

async function template(file) {
  if (!KIT.files.has(file)) {
    KIT.files.set(file, KIT.loader.loadAsync(KIT.base + file).then((g) => {
      g.scene.traverse((o) => {
        if (!o.isMesh) return;
        o.material = Array.isArray(o.material) ? o.material.map(material) : material(o.material);
        o.castShadow = o.receiveShadow = true;
      });
      return g.scene;
    }));
  }
  return KIT.files.get(file);
}

/** A new copy of one kit item (geometry and materials are shared, so copies are cheap). */
export async function createOfficeItem(name) {
  if (!KIT) throw new Error('call loadOfficeKit() first');
  const entry = KIT.manifest.items[name];
  if (!entry) throw new Error(`unknown office item '${name}'. Items: ${Object.keys(KIT.manifest.items).join(', ')}`);
  const root = (await template(entry.file)).clone(true);
  root.name = name;
  root.userData.officeItem = name;
  root.userData.footprint = entry.footprint; // [width x, depth z] in metres, for colliders / grid snapping
  return root;
}

/** Add an item to `parent` at x / z (metres, y = height above the floor), turned rotY radians. Front faces +z at rotY 0. */
export async function placeOfficeItem(parent, name, { x = 0, y = 0, z = 0, rotY = 0 } = {}) {
  const o = await createOfficeItem(name);
  o.position.set(x, y, z);
  o.rotation.y = rotY;
  parent.add(o);
  return o;
}

/** The whole office. mode 'glb' loads office_room.glb (one file); 'items' rebuilds it from layout.json (each piece movable). */
export async function placeOfficeRoom(parent, { mode = 'glb', cutaway = false, x = 0, z = 0, rotY = 0 } = {}) {
  let room;
  if (mode === 'glb') room = (await template(KIT.manifest.room.file)).clone(true);
  else {
    room = new THREE.Group();
    room.add((await template(KIT.manifest.room.file)).getObjectByName('room_shell').clone(true));
    room.add((await template(KIT.manifest.room.file)).getObjectByName('room_wall_east').clone(true));
    await Promise.all(KIT.layout.placements.map((p) => placeOfficeItem(room, p.item, p)));
  }
  room.name = 'tiny_office';
  const east = room.getObjectByName('room_wall_east');
  if (east) east.visible = !cutaway;
  room.position.set(x, 0, z);
  room.rotation.y = rotY;
  parent.add(room);
  return room;
}

export const officeItemNames = () => Object.keys(KIT?.manifest.items ?? {});
