# Tiny City cafe kit

Low-poly Japanese cafe in the **Tiny City Builder** look (PS1 · Bright + clear).
The catalogue builds every piece in `src/cafe/items.js` with `style.material`, so `createAsset` stays synchronous and palettes recolour the whole kit. There are no GLBs.

```js
import { style } from './src/styles/index.js';
import { createAsset } from './src/catalog/index.js';
scene.add(createAsset('cafe.table', {}, style));
scene.add(createAsset('cafe.room', { variant: 'Cutaway', seed: 0 }, style)); // or 'Full'; seed 0 is the hand layout
```

## Conventions

- Metres. +Y up, front faces +z, origin at the bottom centre.
- `menu_board` and `shelf` have their back at z = 0 (put them on a wall).
- `pendant` origin is the shade bottom; the cord goes up. It has no floor collider. Neither do `noren` or `mat`.
- Boxes and cylinders only. Flat shading, no textures, no readable text.
- Every material is `role:Swatch` from `src/styles/palette.js`. Cream, apricot and chalk colours use `paint`, `cloth` and `light`.

## Room

8 m wide (x) by 6 m deep (z), 3 m tall, open at the top, centred on the origin. The street front is +z. `variant: 'Cutaway'` hides `room_wall_front` and `room_wall_side` (the +z and +x walls). `'Full'` shows them. The wood floor sits 2 cm above y = 0.

Furniture positions for seed 0 are in `layout.json` (y is the height above that floor). Any other `seed` is deterministic (`src/cafe/arrange.js`). The bar, the machine, the menu, the pastry case, the window counter, the noren and the mat stay put. The seed picks 2 or 3 round tables from three slots, 2 to 4 stools, whether a cake or a corner plant is out, a small pull on the chairs (they still face the table), and one accent for the pots, the shades and the noren. A walk about a metre wide stays clear from the door, past the counter, and along the front of the bar.
