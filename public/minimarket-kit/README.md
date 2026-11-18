# Tiny City minimarket kit

Low-poly Japanese convenience store in the **Tiny City Builder** look (PS1 · Bright + clear).
The catalogue builds every piece in `src/minimarket/items.js` with `style.material`, so `createAsset` stays synchronous and palettes recolour the whole kit. There are no GLBs.

```js
import { style } from './src/styles/index.js';
import { createAsset } from './src/catalog/index.js';
scene.add(createAsset('minimarket.shelf_aisle', {}, style));
scene.add(createAsset('minimarket.room', { variant: 'Cutaway' }, style)); // or 'Full'
```

## Conventions

- Metres. +Y up, front faces +z, origin at the bottom centre.
- `poster` and `clock` have their back at z = 0 (put them on a wall).
- `noren` hangs from its own rod (the cloth starts above the floor). `ceiling_light` hangs too. Neither has a floor collider, and neither does `floor_mat`.
- `drinks_fridge` and `hot_food` are shells with a glass face, so the colour blocks inside read through it. No readable lettering.
- Boxes and cylinders only (4–8 sides). Flat shading, no textures.
- Every material is `role:Swatch` from `src/styles/palette.js`. Navy, Butter and the goods colours use `paint`, `cloth` and `light` so the building-colour rule does not turn them grey.

## Room

10 m wide (x) by 8 m deep (z), 3 m tall, open at the top, centred on the origin. The street front is +z. `variant: 'Cutaway'` hides `room_wall_front` and `room_wall_side`. `'Full'` shows them. The checker floor sits 2 cm above y = 0.

Furniture positions are in `layout.json`. The coffee machine and the microwave sit on the register at y = 0.97. Walls, windows and the door are placed in code.

Triangle counts are in `manifest.json`. The whole room is under 10k triangles; each piece is under 300.
