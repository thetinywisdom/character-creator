# Tiny City dojo kit

Low-poly dojo / gym in the **Tiny City Builder** look (PS1 · Bright + clear).
The catalogue builds every piece in `src/dojo/items.js` with `style.material`, so `createAsset` stays synchronous and palettes recolour the whole kit. There are no GLBs.

```js
import { style } from './src/styles/index.js';
import { createAsset } from './src/catalog/index.js';
scene.add(createAsset('dojo.tatami', {}, style));
scene.add(createAsset('dojo.room', { variant: 'Cutaway', seed: 0 }, style)); // or 'Full'; seed 0 is the hand layout
```

## Conventions

- Metres. +Y up, front faces +z, origin at the bottom centre.
- `kamidana` and `mirror` have their back at z = 0 (put them on a wall).
- The punching bag's origin is on the floor. The bag and its chain hang above that spot.
- Boxes and a few low-segment cylinders only. Flat shading, no textures, no readable text.
- Every material is `role:Swatch` from `src/styles/palette.js`.

## Room

9 m wide (x) by 9 m deep (z), about 3.2 m tall, open at the top, centred on the origin. The entrance is the sliding door on the −x wall. `variant: 'Cutaway'` hides `room_wall_front` and `room_wall_side` (the +z and +x walls). `'Full'` shows them.

The wood floor is one solid colour. The tatami is one solid sage slab (no gaps, seams or grid). Furniture positions for seed 0 are in `layout.json` (y is the height above that floor). Any other `seed` is deterministic (`src/dojo/arrange.js`, mulberry32). The door, windows, kamidana and mirror stay put. The seed picks how far the one mat reaches, and which extra bags, racks, dummies, benches, shoe shelves, stacked mats and wall scrolls are out. A walk a little over 0.9 m stays clear from the door along the front wall.
