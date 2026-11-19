# Tiny City open-office kit

Low-poly open-plan studio in the **Tiny City Builder** look (PS1 · Bright + clear).
This is not the private office kit (`office.*`). The namespace is `openoffice`.
The catalogue builds every piece in `src/openoffice/items.js` with `style.material`, so `createAsset` stays synchronous and palettes recolour the whole kit. There are no GLBs.

```js
import { style } from './src/styles/index.js';
import { createAsset } from './src/catalog/index.js';
scene.add(createAsset('openoffice.bench', {}, style));
scene.add(createAsset('openoffice.room', { variant: 'Cutaway', seed: 0 }, style)); // or 'Full'; seed 0 is the hand layout
```

## Conventions

- Metres. +Y up, front faces +z, origin at the bottom centre.
- `pinboard` has its back at z = 0 (put it on a wall).
- `pendant_bar` origin is the light bar; the cords go up. It has no floor collider. Neither does `rug`.
- Boxes and cylinders only. Flat shading, no textures, no readable text. Notes on the pinboard are blank.
- Every material is `role:Swatch` from `src/styles/palette.js`. The sage wall, seafoam sofa and apricot pots use `paint` and `cloth`.

## Room

12 m wide (x) by 10 m deep (z), 3 m tall, open at the top, centred on the origin. One open floor: shared benches, a lounge corner, a printer island and a short pantry. No cubicles. The back wall (-z) is sage. `variant: 'Cutaway'` hides `room_wall_front` and `room_wall_side` (the +z and +x walls). `'Full'` shows them. Large floor tiles sit 2 cm above y = 0.

Furniture positions for seed 0 are in `layout.json`. The glass door and the side windows are placed in code.

Any other `seed` is deterministic (`src/openoffice/arrange.js`). The pantry, the fridge, the pinboard, the door and the windows stay put. The right-hand bench is always there; the left bench and a second row on the right come and go. Chairs stay on the near side of a bench, facing the monitors, with a small pull. The lounge stays in the front-left corner. The printer is either by the front wall or beside the benches. Plants are optional. The sofa, the chair cloth and the plant pots pick one swatch already in the palette. Walks about a metre wide run in from the centre door, across to the pantry, and down between the benches.
