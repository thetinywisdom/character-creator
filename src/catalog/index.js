import * as THREE from 'three';
import { mulberry32 } from '../lib/rng.js';
import { apartment, house, mixedUse, office, shop } from '../city/buildings.js';
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
//   category  'building' | 'area' | 'prop' | 'vehicle' | 'ground' | 'line'
//   params    default settings (a city object's params override these)
//   variants  optional list of variant names (params.variant)
//   colors    optional list of colour names (params.color)
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
  car: { hw: 0.9, hd: 2.3 },
};

const PROP_SIZES = { busStop: [3.4, 1.6], car: [1.8, 4.6], bench: [1.6, 0.5], vendingMachine: [1.1, 0.9], crosswalk: [4, 6] };

const withColliders = (obj, colliders) => {
  obj.userData.colliders = colliders.map((c) => ({ x: c.x ?? 0, z: c.z ?? 0, hw: c.hw, hd: c.hd }));
  return obj;
};

// --- buildings ---------------------------------------------------------------
// Builders fill a lot of width w and depth d (facing the street, +z). The seed
// makes the same settings always give the same building.
const BUILDERS = { house, apartment, mixedUse, shop, office };
const BUILDING_LABELS = { house: 'House', apartment: 'Apartment block', mixedUse: 'Shop with flats above', shop: 'Shop', office: 'Office building' };
const buildingAssets = Object.entries(BUILDERS).map(([key, fn]) => ({
  id: `building.${key}`,
  label: BUILDING_LABELS[key],
  category: 'building',
  params: { w: 10, d: 12, seed: 1, ...(key === 'shop' || key === 'mixedUse' ? { shopType: null } : {}) },
  size: [10, 12],
  build(p, style) {
    const b = fn(style, mulberry32(p.seed ?? 1), p.w, p.d, p.shopType ?? undefined);
    const fp = b.footprint;
    return withColliders(b.group, [{ x: 0, z: fp.z, hw: fp.w / 2, hd: fp.d / 2 }]);
  },
}));

// --- areas -------------------------------------------------------------------
const areaAssets = [{
  id: 'area.park',
  label: 'Park',
  category: 'area',
  params: { w: 34, d: 34, seed: 1 },
  size: [34, 34],
  build(p, style) {
    const r = park(style, mulberry32(p.seed ?? 1), p.w, p.d);
    return withColliders(r.group, r.colliders);
  },
}];

// --- props and vehicles ------------------------------------------------------
const propAssets = PROP_GROUPS.flatMap((group) => group.props.map((prop) => ({
  id: `${group.label === 'Vehicles' ? 'vehicle' : 'prop'}.${prop.id}`,
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

// --- ground and lines --------------------------------------------------------
const groundAssets = [{
  id: 'ground.paving',
  label: 'Paving',
  category: 'ground',
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

export const ASSETS = [...buildingAssets, ...areaAssets, ...propAssets, ...groundAssets];
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
