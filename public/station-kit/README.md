# Tiny City station kit

Low-poly train platform and ticket gates in the **Tiny City Builder** look (PS1 · Bright + clear).
The catalogue builds every piece in `src/station/items.js` with `style.material`, so `createAsset` stays synchronous and palettes recolour the whole kit. There are no GLBs.

```js
import { style } from './src/styles/index.js';
import { createAsset } from './src/catalog/index.js';
scene.add(createAsset('station.ticket_gate', {}, style));
scene.add(createAsset('station.room', { variant: 'Cutaway', seed: 0 }, style)); // or 'Full'; seed 0 is the hand layout
```

## Conventions

- Metres. +Y up, front faces +z (the platform edge), origin at the bottom centre.
- `departure_board` and `platform_sign` hang. They have no floor collider. Their origin is the bottom of the sign.
- The departure board and the signs are blocks of colour. There is no text.
- Boxes and a few low-segment cylinders only. Flat shading, no textures.
- Every material is `role:Swatch` from `src/styles/palette.js`.

## Room

16 m wide (x) by 6 m deep (z), centred on the origin. The open edge is +z. There is no +z wall. `variant: 'Cutaway'` hides `room_wall_side` (the +x end wall) and the roof deck on that half. Beams, pillars and the far canopy stay, so the concourse still reads. `'Full'` shows the end wall and the whole roof.

The concrete floor is one solid colour. The yellow tactile strip is one solid raised band along the edge, with a few bumps of the same colour. Furniture positions for seed 0 are in `layout.json` (y is the height above that floor). Any other `seed` is deterministic (`src/station/arrange.js`, mulberry32). The gates, the edge, the pillars, the clock, the vending machine, the board and the signs stay put. The seed only moves benches and ticket machines between four slots that sit off the edge. A walk about 0.9 m stays clear in front of the gates, along the edge, and from the end door.
