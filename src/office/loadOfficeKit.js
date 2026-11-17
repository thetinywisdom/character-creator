// GLB loader for the office kit. The catalogue does not use this: createAsset
// is synchronous, so src/office/items.js rebuilds the parts with style.material.
// Use this when a game wants the exported files (public/office-kit/models).
// Pass `style` and each `role:Swatch` material becomes style.material(role, hex).
//
//   import { loadOfficeKit, placeOfficeItem, placeOfficeRoom } from './src/office/loadOfficeKit.js';
//   await loadOfficeKit({ style });
//   await placeOfficeItem(scene, 'desk', { x: 0, z: 0 });
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { PALETTE } from '../styles/palette.js';

const SWATCHES = Object.keys(PALETTE);
const MUTED = Object.fromEntries(SWATCHES.map((n) => [n, PALETTE[n]]));

let KIT = null;

/** Load manifest.json and layout.json. baseUrl defaults to the Vite-served kit. */
export async function loadOfficeKit({ baseUrl = `${import.meta.env.BASE_URL}office-kit/`, palette = 'Golden hour', style = null } = {}) {
  const base = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
  const [man, layout] = await Promise.all(['manifest.json', 'layout.json'].map((f) => fetch(base + f).then((r) => r.json())));
  KIT = { base, manifest: man, layout, palette, style, loader: new GLTFLoader(), files: new Map(), mats: new Map() };
  return KIT;
}

function material(src) {
  const [role, swatch] = (src.name || '').split(':');
  const key = src.name;
  if (KIT.mats.has(key)) return KIT.mats.get(key);
  const base = MUTED[swatch];
  let m;
  if (KIT.style && base !== undefined) {
    m = KIT.style.material(role, base);
    if (role === 'glass' && swatch === 'Sky') {
      m = m.clone();
      m.transparent = true;
      m.opacity = 0.28;
      m.depthWrite = false;
    }
  } else m = src;
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

/** A new copy of one kit item. Geometry and materials are shared. */
export async function createOfficeItem(name) {
  if (!KIT) throw new Error('call loadOfficeKit() first');
  const entry = KIT.manifest.items[name];
  if (!entry) throw new Error(`unknown office item '${name}'`);
  const root = (await template(entry.file)).clone(true);
  root.name = name;
  root.userData.officeItem = name;
  root.userData.footprint = entry.footprint;
  return root;
}

/** Add an item at x / z (metres). y is height above the floor. Front faces +z at rotY 0. */
export async function placeOfficeItem(parent, name, { x = 0, y = 0, z = 0, rotY = 0 } = {}) {
  const o = await createOfficeItem(name);
  o.position.set(x, y, z);
  o.rotation.y = rotY;
  parent.add(o);
  return o;
}

/** The whole office. mode 'glb' loads office_room.glb; 'items' rebuilds it from layout.json. */
export async function placeOfficeRoom(parent, { mode = 'glb', cutaway = false, x = 0, z = 0, rotY = 0 } = {}) {
  let room;
  if (mode === 'glb') room = (await template(KIT.manifest.room.file)).clone(true);
  else {
    room = new THREE.Group();
    const shell = await template(KIT.manifest.room.file);
    room.add(shell.getObjectByName('room_shell').clone(true));
    room.add(shell.getObjectByName('room_wall_east').clone(true));
    await Promise.all(KIT.layout.placements.map((p) => placeOfficeItem(room, p.item, p)));
  }
  room.name = 'tiny_office';
  const wall = room.getObjectByName('room_wall_east');
  if (wall) wall.visible = !cutaway;
  room.position.set(x, 0, z);
  room.rotation.y = rotY;
  parent.add(room);
  return room;
}

export const officeItemNames = () => Object.keys(KIT?.manifest.items ?? {});
