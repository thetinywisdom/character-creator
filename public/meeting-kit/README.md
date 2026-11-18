# Tiny City meeting-room kit

Low-poly meeting room in the **Tiny City Builder** look (PS1 · Bright + clear).
The catalogue builds every piece in `src/meeting/items.js` with `style.material`, so `createAsset` stays synchronous and palettes recolour the whole kit. There are no GLBs.

```js
import { style } from './src/styles/index.js';
import { createAsset } from './src/catalog/index.js';
scene.add(createAsset('meeting.chair', {}, style));
scene.add(createAsset('meeting.room', { variant: 'Cutaway', seed: 0 }, style)); // seed 0 is this layout
```

## Conventions

- Metres. +Y up, front faces +z, origin at the bottom centre.
- `wall_tv` and `whiteboard` have their back at z = 0 (put them on a wall).
- `pendant` origin is the shade bottom; the cord goes up. It has no floor collider.
- Boxes and cylinders only (4–8 sides). Flat shading, no textures, no readable text.
- Every material is `role:Swatch` from `src/styles/palette.js`. Navy cloth, charcoal and walnut stay on `cloth`, `paint` and `wood`. Walls use `paint` so Off white is not pulled onto the building greys. `light` is the glow in the pendants.

## Room

6 m wide (x) by 4 m deep (z), 2.7 m tall, open at the top, centred on the origin. The far wall (−z) is a glass partition with a door. `variant: 'Cutaway'` hides `room_wall_front` and `room_wall_side` (the +z and +x walls), which are the two the isometric catalogue camera faces. `'Full'` shows them. The carpet sits 2 cm above y = 0.

Furniture positions for `seed: 0` are in `layout.json` (y is the height above that floor). Any other integer is a deterministic rearrangement: chair count and spacing, how far the chairs are pulled out, which side the credenza stands on, and which small props are out. The glass door, the walls and the partition stay put. Walls and the glass partition are placed in code.

Triangle counts are in `manifest.json`. The source of truth is `src/meeting/items.js`.
