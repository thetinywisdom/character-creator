# Tiny City police station kit

Low-poly Japanese police post (koban colours, station size) in the **Tiny City Builder** look (PS1 · Bright + clear).
The catalogue builds every piece in `src/police/items.js` with `style.material`, so `createAsset` stays synchronous and palettes recolour the whole kit. There are no GLBs.

```js
import { style } from './src/styles/index.js';
import { createAsset } from './src/catalog/index.js';
scene.add(createAsset('police.holding_cell', {}, style));
scene.add(createAsset('police.room', { variant: 'Cutaway' }, style)); // or 'Full'
```

## Conventions

- Metres. +Y up, front faces +z, origin at the bottom centre.
- `notice_board`, `key_board` and `clock` have their back at z = 0 (put them on a wall).
- `beacon` (the koban lamp) and `ceiling_light` hang: the cord goes up. They have no floor collider. Neither does `floor_mat`.
- `holding_cell` faces +z, so the bars are the front. The bench and the toilet are inside.
- Boxes and cylinders only (4–8 sides). Flat shading, no textures, no readable text. The notice board is coloured sheets and two head-and-shoulders blocks.
- Every material is `role:Swatch` from `src/styles/palette.js`. Navy and Dusty rose use `paint`, `cloth` and `light` so the building-colour rule does not turn them grey.

## Room

12 m wide (x) by 8 m deep (z), 3 m tall, open at the top, centred on the origin. The street front is +z (the service counter faces it). `variant: 'Cutaway'` hides `room_wall_front` and `room_wall_side`. `'Full'` shows them. The checker floor sits 2 cm above y = 0.

Furniture positions are in `layout.json`. Props on an officer desk use y = 0.75. Walls, windows and the door are placed in code.

Triangle counts are in `manifest.json`. The whole room is under 10k triangles; each piece is under 300.
