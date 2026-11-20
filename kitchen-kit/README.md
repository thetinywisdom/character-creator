# Tiny City kitchen kit

Low-poly home kitchen and dining nook in the **Tiny City Builder** look (PS1 · Bright + clear).
The catalogue builds every piece in `src/kitchen/items.js` with `style.material`, so `createAsset` stays synchronous and palettes recolour the whole kit. There are no GLBs.

```js
import { style } from './src/styles/index.js';
import { createAsset } from './src/catalog/index.js';
scene.add(createAsset('kitchen.chair', {}, style));
scene.add(createAsset('kitchen.room', { variant: 'Cutaway', seed: 0 }, style)); // or 'Full'; seed 0 is the hand layout
```

## Conventions

- Metres. +Y up, front faces +z, origin at the bottom centre.
- `pendant` origin is the shade bottom; the cord goes up. It has no floor collider. Neither do `jar` or `board`.
- Boxes and cylinders only. Flat shading, no textures, no readable text.
- Every material is `role:Swatch` from `src/styles/palette.js`.

## Room

5 m wide (x) by 4 m deep (z), 2.7 m tall, open at the top, centred on the origin. The street front is +z. `variant: 'Cutaway'` hides `room_wall_front` and `room_wall_side` (the +z and +x walls). `'Full'` shows them. The wood floor is one solid colour and sits 2 cm above y = 0.

Furniture positions for seed 0 are in `layout.json` (y is the height above that floor). Any other `seed` is deterministic (`src/kitchen/arrange.js`). The cabinet run, fridge, microwave rack, sink, gas hob and fish grill stay put. The seed moves the four-seat table between three nook spots, picks a plain or cushioned chair, and sets how much clutter is on the counter. Chairs stay on the four sides of the table, facing it. A walk about a metre wide stays clear from the door along the right wall.
