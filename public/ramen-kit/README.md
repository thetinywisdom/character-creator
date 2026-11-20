# Tiny City ramen kit

Low-poly ramen shop / izakaya in the **Tiny City Builder** look (PS1 · Bright + clear).
The catalogue builds every piece in `src/ramen/items.js` with `style.material`, so `createAsset` stays synchronous and palettes recolour the whole kit. There are no GLBs.

```js
import { style } from './src/styles/index.js';
import { createAsset } from './src/catalog/index.js';
scene.add(createAsset('ramen.stool', {}, style));
scene.add(createAsset('ramen.room', { variant: 'Cutaway', seed: 0 }, style)); // or 'Full'; seed 0 is the hand layout
```

## Conventions

- Metres. +Y up, front faces +z, origin at the bottom centre.
- `menu_strip` has its face toward +z (put it on the back wall). `shelf` is centred; rotate it onto a wall.
- `lantern` origin is the shade bottom; the cord goes up. It has no floor collider. Neither do `noren`, `mat`, `condiment` or `bottle`.
- Boxes and cylinders only. Flat shading, no textures, no readable text.
- Every material is `role:Swatch` from `src/styles/palette.js`. Lantern reds and the noren use `paint`.

## Room

7 m wide (x) by 5 m deep (z), 3 m tall, open at the top, centred on the origin. The street front is +z. `variant: 'Cutaway'` hides `room_wall_front` and `room_wall_side` (the +z and +x walls). `'Full'` shows them. The wood floor is one solid colour and sits 2 cm above y = 0.

Furniture positions for seed 0 are in `layout.json` (y is the height above that floor): an L-shaped counter, nine stools, the open kitchen and the ticket machine. Any other `seed` is deterministic (`src/ramen/arrange.js`). The long counter, prep counter, noodle boiler, ticket machine, sake shelf, menu strips, lanterns, noren and mat stay put. The seed chooses a straight counter or the L return, 8 to 10 stools facing the counter, lantern and noren colours, and a few small props. A walk about a metre wide stays clear from the door.
