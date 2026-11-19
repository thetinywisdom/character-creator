# Tiny City clinic kit

Low-poly Japanese clinic in the **Tiny City Builder** look (PS1 · Bright + clear).
The catalogue builds every piece in `src/clinic/items.js` with `style.material`, so `createAsset` stays synchronous and palettes recolour the whole kit. There are no GLBs.

```js
import { style } from './src/styles/index.js';
import { createAsset } from './src/catalog/index.js';
scene.add(createAsset('clinic.exam_bed', {}, style));
scene.add(createAsset('clinic.room', { variant: 'Cutaway', seed: 0 }, style)); // or 'Full'; seed 0 is this layout
```

## Conventions

- Metres. +Y up, front faces +z, origin at the bottom centre.
- `chart_rack`, `coat_hooks`, `clinic_cross` and `clock` have their back at z = 0 (put them on a wall).
- `ceiling_light` origin is the shade; the cord goes up. It has no floor collider. Neither does `floor_mat`.
- Boxes and cylinders only (4–8 sides). Flat shading, no textures, no readable text.
- Every material is `role:Swatch` from `src/styles/palette.js`. Seafoam, Sky and Dusty rose use `paint`, `cloth` and `light` so the building-colour rule does not turn them grey. `light` is emissive, the same as the town's lamps.

## Room

10 m wide (x) by 8 m deep (z), 3 m tall, open at the top, centred on the origin. The street front is +z. `variant: 'Cutaway'` hides `room_wall_front` and `room_wall_side` (the +z and +x walls), which are the two the isometric catalogue camera faces. `'Full'` shows them. The checker floor sits 2 cm above y = 0.

Furniture positions are in `layout.json` (y is the height above that floor). Walls, the exam-bay divider, windows and the door are placed in code.

Triangle counts are in `manifest.json`. The whole room is under 10k triangles; each piece is under 300.
