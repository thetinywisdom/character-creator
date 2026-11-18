# Tiny City diner kit

Low-poly 1950s American diner in the **Tiny City Builder** look (PS1 · Bright + clear).
The catalogue builds every piece in `src/diner/items.js` with `style.material`, so `createAsset` stays synchronous and palettes recolour the whole kit. There are no GLBs.

```js
import { style } from './src/styles/index.js';
import { createAsset } from './src/catalog/index.js';
scene.add(createAsset('diner.stool', {}, style));
scene.add(createAsset('diner.room', { variant: 'Cutaway' }, style)); // or 'Full'
```

## Conventions

- Metres. +Y up, front faces +z, origin at the bottom centre.
- `menu_board`, `neon_sign`, `clock` and `poster` have their back at z = 0 (put them on a wall).
- `pendant` origin is the shade bottom; the cord goes up about 1 m. It has no floor collider. Neither does `welcome_mat`.
- Boxes and cylinders only (4–10 sides). Flat shading, no textures, no readable text.
- Every material is `role:Swatch` from `src/styles/palette.js`. Reds, teals and creams use `paint`, `cloth` and `light` so the building-colour rule does not turn them grey. `light` is emissive, the same as the town's lamps.

## Room

12 m wide (x) by 8 m deep (z), 3 m tall, open at the top, centred on the origin. The street front is +z (windows and the entrance). `variant: 'Cutaway'` hides `room_wall_front` and `room_wall_side` (the +z and +x walls), which are the two the isometric catalogue camera faces. `'Full'` shows them. The checker floor sits 2 cm above y = 0.

Furniture positions are in `layout.json` (y is the height above that floor). Walls, windows and the door are placed in code so the openings match the frames.

Triangle counts are filled into `manifest.json` when the kit is measured (`scripts` are not required to rebuild it: the source of truth is `src/diner/items.js`).
