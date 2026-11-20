# Tiny City library kit

Low-poly neighbourhood library in the **Tiny City Builder** look (PS1 · Bright + clear).
The catalogue builds every piece in `src/library/items.js` with `style.material`, so `createAsset` stays synchronous and palettes recolour the whole kit. There are no GLBs.

```js
import { style } from './src/styles/index.js';
import { createAsset } from './src/catalog/index.js';
scene.add(createAsset('library.shelf_bay', {}, style));
scene.add(createAsset('library.room', { variant: 'Cutaway', seed: 0 }, style)); // or 'Full'; seed 0 is the hand layout
```

## Conventions

- Metres. +Y up, front faces +z, origin at the bottom centre.
- Books and magazines are colour blocks. There is no readable text.
- `lamp` and `book` have no floor collider.
- Boxes and cylinders only. Flat shading, no textures.
- Every material is `role:Swatch` from `src/styles/palette.js`.

## Room

10 m wide (x) by 8 m deep (z), 3.2 m tall, open at the top, centred on the origin. The street front is +z. `variant: 'Cutaway'` hides `room_wall_front` and `room_wall_side` (the +z and +x walls). `'Full'` shows them. The wood floor is one solid colour and sits 2 cm above y = 0.

Furniture positions for seed 0 are in `layout.json` (y is the height above that floor): four rows of shelf bays, reading tables at the front, the kids' corner on the right. Any other `seed` is deterministic (`src/library/arrange.js`). Three shelf rows, the front desk and its chair, the return cart and the magazine rack stay put. The seed adds or drops a fourth row, and swaps the reading tables with the kids' corner. Chairs face their table; the desk chair faces the desk. Aisles of about 0.9 m run between the rows and meet a walk from the door.
