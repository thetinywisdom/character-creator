# Tiny City bedroom kit

Low-poly small bedroom in the **Tiny City Builder** look (PS1 · Bright + clear).
The catalogue builds every piece in `src/bedroom/items.js` with `style.material`, so `createAsset` stays synchronous and palettes recolour the whole kit. There are no GLBs.

```js
import { style } from './src/styles/index.js';
import { createAsset } from './src/catalog/index.js';
scene.add(createAsset('bedroom.bed', {}, style));
scene.add(createAsset('bedroom.room', { variant: 'Cutaway' }, style)); // or 'Full'
```

## Conventions

- Metres. +Y up, front faces +z, origin at the bottom centre.
- `picture` has its back at z = 0 (put it on a wall). The bed's headboard is at −z, so the foot faces +z.
- `rug` has no floor collider.
- Boxes and cylinders only (5–8 sides). Flat shading, no textures, no readable text. The picture is coloured shapes.
- Every material is `role:Swatch` from `src/styles/palette.js`. Bedding, the rug and the curtains use `cloth` and `paint` so powder blue, dusty rose and blush are not flattened by the building-colour rule. `light` is the lamp bulb.

## Room

3.5 m wide (x) by 3 m deep (z), 2.5 m tall, open at the top, centred on the origin. One single bed. The window is on the far wall (−z). `variant: 'Cutaway'` hides `room_wall_front` and `room_wall_side` (the +z and +x walls). `'Full'` shows them. The wood floor sits 2 cm above y = 0.

Furniture positions are in `layout.json` (y is the height above that floor). The window opening is placed in code so the frame covers it.

Triangle counts are in `manifest.json`. The source of truth is `src/bedroom/items.js`.
