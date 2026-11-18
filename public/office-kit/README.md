# Tiny City office kit

Low-poly office furniture in the **Tiny City Builder** look (thetinywisdom/character-creator, *PS1 · Bright + clear*),
plus Briandito's office (6.5 x 14.5 m, from `office_v23.blend`) rebuilt from these pieces. Made in Blender 5.2, exported as GLB.

## Use it in three.js (3 lines)

```js
import { loadOfficeKit, placeOfficeItem, placeOfficeRoom } from './tiny-office-kit/loadOfficeKit.js';
await loadOfficeKit({ baseUrl: './tiny-office-kit/' });              // palette: 'Golden hour' (the town default)
await placeOfficeItem(scene, 'desk', { x: 0, z: 0, rotY: Math.PI / 2 }); // or: await placeOfficeRoom(scene, { cutaway: true })
```

Your page needs an import map for `three` and `three/addons/` (see `preview.html`). Open the preview with any static server:
`npx serve tiny-office-kit` or `python3 -m http.server` in the folder, then `/preview.html` (`?view=lineup`, `?view=room&cam=desks|lounge|kitchen|meeting`, `&palette=Muted`, `&mode=items`).

- `placeOfficeItem(parent, name, {x, y, z, rotY})` adds one item (metres; y = height above the floor, e.g. 0.73 for a desk top). Copies share geometry and materials.
- `createOfficeItem(name)` returns a copy without adding it. `officeItemNames()` lists the names.
- `placeOfficeRoom(parent, { mode: 'glb' | 'items', cutaway })`: `'glb'` loads `office_room.glb` (one file); `'items'` rebuilds the room from `layout.json` so every piece is its own movable object. `cutaway: true` hides the east wall.
- `loadOfficeKit({ palette })`: `'Golden hour'` (default), `'Muted'`, `'Cool city'`, `'Vibrant'`, or `null` to keep the GLB colours.

## Conventions (match the repo's STYLE_GUIDE / props)

- Metres, real-world size. +Y up, **front faces +z**, origin at the **bottom centre** (the floor point under the item), transforms applied, scale 1.
  Exceptions: `whiteboard_wall` has its back at z = 0 (put it against a wall); `wall_shelf` origin is the plank underside (brackets hang 10 cm below); `pendant_lamp` origin is the shade bottom (cord goes 1.23 m up).
- Built only from boxes, cylinders (4-12 sides, like the repo's 0.3x detail) and faceted icosahedron foliage lobes (as `lib/foliage.js`). Detail is in the silhouette, not small parts. Flat shading, no textures, no UVs.
- **Colour by role + palette swatch.** Every material is named `role:Swatch`, e.g. `wood:Tan`, `cloth:Cocoa`, `leaf:Moss`, `light:Butter`; swatches are the 28 names in `src/styles/palette.js`. The GLB stores the base (Muted) colour; the loader swaps in MeshLambert materials in the active palette variant. Roles: wood, metal, darkMetal, paint, cloth, leaf, concrete, glass, light, building (room walls only, greys per the building rule).
- `preview.html` copies the PS1 render step: half-resolution target with hard pixels, 15-bit colour + 4x4 Bayer dither, depth outlines, vertex snap (wobble 0.4), hemisphere + sun light, 512 px blocky shadows, no fog.

## Using it inside the Tiny City repo (createAsset)

This folder is the kit as Vite serves it (`public/office-kit/`). The catalogue does not load the GLBs. `createAsset` is synchronous, so the same boxes and cylinders are built in `src/office/items.js` with `style.material(role, swatch)`. That is what the Office tab shows. The sample town does not place them.

```js
import { style } from './src/styles/index.js';
import { createAsset } from './src/catalog/index.js';
scene.add(createAsset('office.desk', {}, style));
scene.add(createAsset('office.room', { variant: 'Cutaway', seed: 0 }, style)); // or 'Full'; seed 0 is this layout
```

To load the GLBs instead (shared geometry, palette via `style`):

```js
import { loadOfficeKit, placeOfficeItem, placeOfficeRoom } from './src/office/loadOfficeKit.js';
await loadOfficeKit({ style });
await placeOfficeItem(scene, 'desk', { x: 0, z: 0 });
```

`src/office/build_office_kit.py` rebuilds the GLBs (`blender -b -P src/office/build_office_kit.py`). The blend file is `src/office/office_kit.blend`.

## Files

- `models/*.glb`: 33 items + `office_room.glb` (7844 tris, 68 placed items, 310 KB, linked duplicates share meshes).
- `manifest.json`: per item label, group, file, size `[w, h, d]`, footprint `[w, d]`, tris, materials, bytes. `layout.json`: the room's placements (three.js coords, room centred; north window wall at z = -7.25).
- `loadOfficeKit.js` (this folder, for `preview.html`), `src/office/loadOfficeKit.js` (in the repo, with `style`), `preview.html`. Reference renders live in `src/office/renders/`. The blend is `src/office/office_kit.blend`; rebuild with `blender -b -P src/office/build_office_kit.py`.

| name | item | footprint w x d (height), m | tris | GLB |
|---|---|---|---|---|
| `desk` | Desk (IDÅSEN-style sit/stand, 160x80) | 1.6 x 0.8 (h 0.73) | 72 | 5.5 KB |
| `office_chair` | Office chair (MARKUS-style, high back) | 0.61 x 0.653 (h 1.314) | 224 | 15.0 KB |
| `monitor` | Monitor (27in, tilt stand) | 0.62 x 0.16 (h 0.471) | 48 | 4.8 KB |
| `laptop` | Laptop (open) | 0.31 x 0.262 (h 0.218) | 48 | 5.0 KB |
| `keyboard` | Keyboard + mouse | 0.47 x 0.12 (h 0.025) | 24 | 2.3 KB |
| `desk_lamp` | Desk lamp (angled arm) | 0.139 x 0.314 (h 0.502) | 84 | 6.0 KB |
| `mug` | Mug | 0.094 x 0.084 (h 0.095) | 32 | 2.6 KB |
| `bookcase` | Bookcase (BILLY-style 80x28x202) with books | 0.8 x 0.28 (h 2.02) | 372 | 24.6 KB |
| `copier` | Copier/printer on cabinet | 0.6 x 0.62 (h 1.064) | 72 | 7.3 KB |
| `flat_file` | Flat-file cabinet (5 drawers, 165x42x75) | 1.65 x 0.442 (h 0.75) | 132 | 9.0 KB |
| `wall_shelf` | Wall shelf plank (100x20) | 1.0 x 0.2 (h 0.14) | 36 | 3.6 KB |
| `sofa` | Sofa 3-seat (BORKUM-style, 218 cm) | 2.18 x 0.86 (h 0.829) | 180 | 12.0 KB |
| `coffee_table` | Coffee table (LISTERBY-style 140x60) | 1.4 x 0.6 (h 0.37) | 72 | 4.8 KB |
| `side_table` | Side tray table (GLADOM-style) | 0.45 x 0.45 (h 0.538) | 64 | 4.2 KB |
| `rug` | Rug (jute, 300x200) | 3.0 x 2.0 (h 0.012) | 24 | 2.7 KB |
| `rug_large` | Rug (jute, 350x240) | 3.5 x 2.4 (h 0.012) | 24 | 2.8 KB |
| `whiteboard_mobile` | Mobile whiteboard (120x90 on casters) | 1.37 x 0.56 (h 1.76) | 132 | 10.0 KB |
| `whiteboard_wall` | Wall whiteboard (180x120, back at z=0) | 1.84 x 0.07 (h 1.243) | 36 | 4.0 KB |
| `meeting_table` | Meeting table (boat shape 200x100) | 2.0 x 1.0 (h 0.75) | 80 | 4.8 KB |
| `meeting_chair` | Meeting chair (Brno-style) | 0.525 x 0.595 (h 0.813) | 120 | 8.1 KB |
| `kitchen_run` | Kitchen run (324 cm, sage cabinets, sink) | 3.246 x 0.64 (h 1.175) | 288 | 18.9 KB |
| `fridge` | Fridge (top freezer, 76x77x169) | 0.76 x 0.815 (h 1.69) | 60 | 5.4 KB |
| `trash_can` | Trash can (sensor, 58 L) | 0.47 x 0.33 (h 0.63) | 24 | 2.8 KB |
| `coffee_machine` | Espresso machine | 0.34 x 0.41 (h 0.52) | 68 | 6.7 KB |
| `microwave` | Microwave | 0.46 x 0.374 (h 0.28) | 36 | 4.0 KB |
| `bar_table` | Bar table (terrazzo top, terracotta base, 220x65x105) | 2.2 x 0.65 (h 1.038) | 240 | 16.4 KB |
| `bar_stool` | Bar stool (cane seat, 78 cm) | 0.4 x 0.4 (h 0.79) | 104 | 6.9 KB |
| `pendant_lamp` | Bar pendant (coral, hangs 1.23 m) | 0.22 x 0.22 (h 1.231) | 88 | 6.8 KB |
| `plant_fig` | Fiddle-leaf fig (1.7 m) | 0.636 x 0.633 (h 1.713) | 156 | 13.6 KB |
| `plant_monstera` | Monstera in woven basket | 0.775 x 0.812 (h 1.093) | 168 | 14.4 KB |
| `plant_snake` | Snake plant (tall blades) | 0.225 x 0.26 (h 1.063) | 116 | 8.5 KB |
| `plant_small` | Small potted plant (ZZ / pothos) | 0.248 x 0.199 (h 0.261) | 80 | 7.3 KB |
| `planter_divider` | Planter divider (240 cm trough + greenery, 1.46 m) | 2.623 x 0.558 (h 1.451) | 364 | 28.2 KB |

## Simplified on purpose
Product details (MARKUS mesh, BORKUM tufting, Brno flat bars, IDÅSEN motors, the planter's 1,400 leaves) became a few boxes and lobes each. No text, screens are flat navy, whiteboards are blank.
Pepper's and Ernest's desks were placeholders in v23 and are left out. Stairs are simple steps; the window blinds were dropped (the glass wall reads better).
