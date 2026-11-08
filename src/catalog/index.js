import * as THREE from 'three';
import { mulberry32 } from '../lib/rng.js';
import { apartment, house, mixedUse, office, school, shop, shrine } from '../city/buildings.js';
import { SHOP_BUILDINGS } from '../city/shops.js';
import { CIVIC_BUILDINGS } from '../city/civic.js';
const EXTRA_BUILDINGS = { ...SHOP_BUILDINGS, ...CIVIC_BUILDINGS };
import { tree } from '../subjects/tree.js';
import { CAT_FUR, cat } from '../subjects/cat.js';
import { dressBacks } from '../city/backs.js';
import { bush } from '../props/extras.js';
import { park } from '../city/park.js';
import { PROP_GROUPS } from '../props/index.js';
import { wire } from '../props/extras.js';
import { tiledBox } from '../props/util.js';

// The asset catalogue: everything that can be placed in a city, behind one
// interface, so a city file, the generator, the editor and future games can
// all create any asset the same way.
//
// Each asset:
//   id        'building.house', 'prop.bench', 'vehicle.car', ...
//   label     name for menus
//   category  'building' | 'area' | 'nature' | 'animal' | 'prop' | 'vehicle' | 'ground' | 'line'
//   group     catalogue tab: 'buildings' | 'street' | 'traffic' | 'extras' |
//             'vehicles' | 'nature' | 'animals' | 'areas' (none = not listed)
//   params    default settings (a city object's params override these)
//   variants  optional list of variant names (params.variant)
//   colors    optional list of colour names (params.color)
//   swatches  optional { colour name: hex } when the names are not cloth colours
//   animated  optional: 'cat' = the object has joints for poseCat (anim/catGait.js)
//   size      rough [width, depth] in metres, for editor previews and snapping
//   build(params, style) -> THREE.Object3D, standing on y = 0, facing +z.
//             Its userData.colliders lists solid boxes in its own local space:
//             { x, z, hw, hd } (centre and half sizes on the ground plane).
//
// Placement (position, rotation) is not part of the asset: a city object
// places it (see city/format.js).

/** Solid boxes for props, by prop id (half width, half depth, centre z). */
const PROP_COLLIDERS = {
  bench: { hw: 0.8, hd: 0.25 },
  stoneLantern: { hw: 0.35, hd: 0.35 },
  paperLantern: { hw: 0.1, hd: 0.1 },
  sandwichBoard: { hw: 0.28, hd: 0.25 },
  bikeRack: { hw: 1.3, hd: 0.6 },
  streetLamp: { hw: 0.15, hd: 0.15 },
  trashBin: { hw: 0.4, hd: 0.3 },
  hydrant: { hw: 0.15, hd: 0.15 },
  postBox: { hw: 0.25, hd: 0.25 },
  busStop: { Shelter: { hw: 1.6, hd: 0.7, z: -0.4 }, Pole: { hw: 0.15, hd: 0.15 } },
  trafficLight: { hw: 0.2, hd: 0.2 },
  streetSign: { hw: 0.1, hd: 0.1 },
  vendingMachine: { hw: 0.55, hd: 0.45 },
  phoneBooth: { hw: 0.5, hd: 0.5 },
  utilityPole: { hw: 0.2, hd: 0.2 },
  car: { 'Kei car': { hw: 0.74, hd: 1.7 }, Sedan: { hw: 0.89, hd: 2.35 }, Hatchback: { hw: 0.86, hd: 2.0 }, Minivan: { hw: 0.86, hd: 2.35 }, Taxi: { hw: 0.85, hd: 2.2 }, 'Sports car': { hw: 0.79, hd: 1.98 }, Bus: { hw: 1.25, hd: 5.25 } },
  bicycle: { hw: 0.3, hd: 0.85 },
  scooter: { hw: 0.35, hd: 1.0 },
  planter: { 'Planter box': { hw: 0.7, hd: 0.25 }, 'Potted plant': { hw: 0.22, hd: 0.22 } },
  cone: { Cone: { hw: 0.18, hd: 0.18 }, Barrier: { hw: 1.1, hd: 0.18 } },
  bollard: { Bollard: { hw: 0.08, hd: 0.08 }, 'Guard rail': { hw: 1.0, hd: 0.06 } },
};

const PROP_SIZES = { busStop: [3.4, 1.6], car: [1.8, 4.6], bench: [1.6, 0.5], vendingMachine: [1.1, 0.9], crosswalk: [4, 6] };

const withColliders = (obj, colliders) => {
  obj.userData.colliders = colliders.map((c) => ({ x: c.x ?? 0, z: c.z ?? 0, hw: c.hw, hd: c.hd }));
  return obj;
};

// --- buildings ---------------------------------------------------------------
// Builders fill a lot of width w and depth d (facing the street, +z). The seed
// makes the same settings always give the same building.
const BUILDERS = { house, apartment, mixedUse, shop, office, shrine, school, ...Object.fromEntries(Object.entries(EXTRA_BUILDINGS).map(([k, [fn]]) => [k, fn])) };
const BUILDING_LABELS = { house: 'House', apartment: 'Apartment block', mixedUse: 'Shop with flats above', shop: 'Shop', office: 'Office building', shrine: 'Shrine', school: 'School' };
const BUILDING_SIZES = { shrine: [18, 26], school: [34, 34], ...Object.fromEntries(Object.entries(EXTRA_BUILDINGS).map(([k, [, , w, d]]) => [k, [w, d]])) };
Object.entries(EXTRA_BUILDINGS).forEach(([k, [, label]]) => { BUILDING_LABELS[k] = label; });
// buildings whose back and sides get dressed (not open structures or grounds)
const BARE_OK = new Set(Object.keys(BUILDERS).filter((k) => !['shrine', 'school', 'parkingGarage', 'gasStation'].includes(k)));
const buildingAssets = Object.entries(BUILDERS).map(([key, fn]) => ({
  id: `building.${key}`,
  label: BUILDING_LABELS[key],
  category: 'building',
  group: 'buildings',
  params: { w: BUILDING_SIZES[key]?.[0] ?? 10, d: BUILDING_SIZES[key]?.[1] ?? 12, seed: 1, ...(key === 'shop' || key === 'mixedUse' ? { shopType: null } : {}) },
  size: BUILDING_SIZES[key] ?? [10, 12],
  build(p, style) {
    const b = fn(style, mulberry32(p.seed ?? 1), p.w, p.d, p.shopType ?? undefined, p);
    const fp = b.footprint;
    // windows, AC units, back doors and fire escapes on the bare back and sides (backs.js)
    const backs = BARE_OK.has(key) ? dressBacks(b.group, style, mulberry32((p.seed ?? 1) * 7 + 3)) : [];
    if (backs.length) b.colliders = [...(b.colliders ?? [{ x: 0, z: fp.z, hw: fp.w / 2, hd: fp.d / 2 }]), ...backs];
    // builders with several solid parts list them; otherwise the footprint is solid
    return withColliders(b.group, b.colliders ?? [{ x: 0, z: fp.z, hw: fp.w / 2, hd: fp.d / 2 }]);
  },
}));

// --- areas -------------------------------------------------------------------
const areaAssets = [{
  id: 'area.park',
  label: 'Park',
  category: 'area',
  group: 'areas',
  params: { w: 34, d: 34, seed: 1 },
  size: [34, 34],
  build(p, style) {
    const r = park(style, mulberry32(p.seed ?? 1), p.w, p.d);
    return withColliders(r.group, r.colliders);
  },
}];

// --- props and vehicles ------------------------------------------------------
const PALETTE_GROUP = { 'Street furniture': 'street', 'Traffic and signs': 'traffic', Vehicles: 'vehicles', Extras: 'extras', 'Japanese street': 'extras' };
const propAssets = PROP_GROUPS.flatMap((group) => group.props.map((prop) => ({
  id: `${group.label === 'Vehicles' ? 'vehicle' : 'prop'}.${prop.id}`,
  group: PALETTE_GROUP[group.label],
  label: prop.label,
  category: group.label === 'Vehicles' ? 'vehicle' : 'prop',
  variants: prop.variants,
  colors: prop.colors,
  params: { variant: prop.variants[0], ...(prop.colors ? { color: prop.colors[0] } : {}) },
  size: PROP_SIZES[prop.id] ?? [1, 1],
  build(p, style) {
    const obj = prop.build(p, style, p); // crosswalk reads p.length
    const c = PROP_COLLIDERS[prop.id];
    const box = c && (c.hw !== undefined ? c : c[p.variant]);
    return withColliders(obj, box ? [box] : []);
  },
})));

// --- nature ------------------------------------------------------------------
const FLOWERS = { Red: [0xd8443c], Yellow: [0xf2c230], Mixed: [0xd8443c, 0xf2c230, 0xf28cb8, 0xf4f4f0, 0x8a55c9] };
const natureAssets = [{
  id: 'nature.tree',
  label: 'Tree',
  category: 'nature',
  group: 'nature',
  variants: Object.keys(tree.presets),
  params: { variant: 'Oak', seed: 0 },
  size: [4, 4],
  build(p, style) {
    const defaults = Object.fromEntries(Object.entries(tree.schema).map(([k, d]) => [k, d.value]));
    const preset = tree.presets[p.variant] ?? tree.presets.Oak;
    const t = tree.build({ ...defaults, ...preset, ...(p.seed ? { seed: p.seed } : {}) }, style);
    return withColliders(t, [{ hw: 0.3, hd: 0.3 }]);
  },
}, {
  id: 'nature.flowerBed',
  label: 'Flower bed',
  category: 'nature',
  group: 'nature',
  variants: Object.keys(FLOWERS),
  params: { variant: 'Mixed', seed: 1 },
  size: [1.8, 0.9],
  build(p, style) {
    const g = new THREE.Group();
    const rng = mulberry32((p.seed ?? 1) * 31 + 7);
    g.add(tiledBox(1.8, 0.32, 0.9, style.material('concrete', 0xa8664a), [0, 0.16, 0]));
    g.add(tiledBox(1.66, 0.04, 0.76, style.material('bark', 0x5a4030), [0, 0.32, 0]));
    const leaf = style.material('leaf');
    const colours = FLOWERS[p.variant] ?? FLOWERS.Mixed;
    for (let i = 0; i < 14; i++) {
      const x = -0.7 + (i % 7) * 0.233 + (rng() - 0.5) * 0.08, z = i < 7 ? -0.18 : 0.18;
      g.add(new THREE.Mesh(new THREE.SphereGeometry(0.1, 6, 4), leaf).translateX(x).translateY(0.38).translateZ(z));
      const f = new THREE.Mesh(new THREE.SphereGeometry(0.06, 6, 4), style.material('signage', colours[Math.floor(rng() * colours.length)]));
      f.position.set(x + (rng() - 0.5) * 0.06, 0.48, z + (rng() - 0.5) * 0.06);
      g.add(f);
    }
    return withColliders(g, [{ hw: 0.9, hd: 0.45 }]);
  },
}, {
  id: 'nature.bush',
  label: 'Bush',
  category: 'nature',
  group: 'nature',
  variants: ['Small', 'Large'],
  params: { variant: 'Small', seed: 1 },
  size: [1.2, 1.2],
  build(p, style) {
    const b = bush(style, p.variant === 'Large' ? 0.9 : 0.55, mulberry32((p.seed ?? 1) * 17 + 3));
    return withColliders(b, [{ hw: 0.5, hd: 0.5 }]);
  },
}];

// --- animals -----------------------------------------------------------------
// Animated: the built cat has joints for anim/catGait.js (poseCat).
const animalAssets = [{
  id: 'animal.cat',
  label: 'Cat',
  category: 'animal',
  group: 'animals',
  animated: 'cat',
  variants: Object.keys(cat.presets),
  colors: Object.keys(CAT_FUR),
  swatches: CAT_FUR,
  params: { variant: 'Housecat', color: 'Ginger' },
  size: [0.4, 0.9],
  build(p, style) {
    const defaults = Object.fromEntries(Object.entries(cat.schema).map(([k, d]) => [k, d.value]));
    const c = cat.build({ ...defaults, ...(cat.presets[p.variant] ?? {}), furColor: p.color ?? 'Ginger' }, style);
    const g = new THREE.Group();
    g.scale.setScalar(cat.exaggeration ?? 1);
    g.add(c);
    return withColliders(g, [{ hw: 0.2, hd: 0.35 }]);
  },
}];

// --- ground and lines --------------------------------------------------------
const groundAssets = [{
  id: 'ground.paving',
  label: 'Paving',
  category: 'ground',
  group: 'areas',
  params: { w: 4, d: 4, color: 0x9c9a92 },
  size: [4, 4],
  build(p, style) {
    const g = new THREE.Group();
    g.add(tiledBox(p.w, 0.02, p.d, style.material('concrete', p.color), [0, 0.01, 0]));
    return withColliders(g, []);
  },
}, {
  // a sagging overhead wire between two points; a = start, b = end, in the
  // object's own space (so a wire object is usually placed at 0, 0)
  id: 'line.wire',
  label: 'Overhead wire',
  category: 'line',
  params: { a: [0, 8, 0], b: [10, 8, 0], sag: 0.5 },
  size: [10, 0.1],
  build(p, style) {
    return withColliders(wire(p.a, p.b, style, p.sag ?? 0.5), []);
  },
}];

export const ASSETS = [...buildingAssets, ...areaAssets, ...natureAssets, ...animalAssets, ...propAssets, ...groundAssets];
export const CATALOG = Object.fromEntries(ASSETS.map((a) => [a.id, a]));

/** Assets of one category (or all). */
export const listAssets = (category) => ASSETS.filter((a) => !category || a.category === category);

/** Build one asset by id: params are merged over the asset's defaults. */
export function createAsset(id, params, style) {
  const asset = CATALOG[id];
  if (!asset) throw new Error(`Unknown asset "${id}"`);
  const obj = asset.build({ ...asset.params, ...params }, style);
  obj.userData.asset = id;
  return obj;
}
