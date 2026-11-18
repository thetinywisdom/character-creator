# Tiny City studio kit

Low-poly Japanese 1R apartment in the **Tiny City Builder** look (PS1 · Bright + clear).
The catalogue builds every piece in `src/studio/items.js` with `style.material`, so `createAsset` stays synchronous and palettes recolour the whole kit. There are no GLBs.

```js
import { style } from './src/styles/index.js';
import { createAsset } from './src/catalog/index.js';
scene.add(createAsset('studio.unit_bath', {}, style));
scene.add(createAsset('studio.room', { variant: 'Cutaway' }, style)); // or 'Full'
```

## Conventions

- Metres. +Y up, front faces +z, origin at the bottom centre.
- `unit_bath` is open at the top. Its door is the +z face. In the room it is turned so the door faces into the apartment.
- `ceiling_light` origin is the shade bottom; the cord goes up. It has no floor collider. Neither does `cushion`.
- Boxes and cylinders only (4–8 sides). Flat shading, no textures, no readable text. The television is coloured blocks.
- Every material is `role:Swatch` from `src/styles/palette.js`. The sofa, bedding and cushion use `cloth` so sage, navy and apricot are not flattened by the building-colour rule. `light` is the ceiling bulb and the rice-cooker lamp.

## Room

6 m wide (x) by 4 m deep (z), 2.55 m tall, open at the top, centred on the origin. Kitchen along the far wall, unit bath in the far corner, living space toward the camera. `variant: 'Cutaway'` hides `room_wall_front` and `room_wall_side` (the +z and +x walls). `'Full'` shows them, including the entrance door. The wood floor sits 2 cm above y = 0.

Furniture positions are in `layout.json` (y is the height above that floor). Walls, windows, the entrance and the bath are placed in code.

Triangle counts are in `manifest.json`. The source of truth is `src/studio/items.js`.
