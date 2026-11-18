# Tiny City classroom kit

Low-poly Japanese classroom in the **Tiny City Builder** look (PS1 · Bright + clear).
The catalogue builds every piece in `src/classroom/items.js` with `style.material`, so `createAsset` stays synchronous and palettes recolour the whole kit. There are no GLBs.

```js
import { style } from './src/styles/index.js';
import { createAsset } from './src/catalog/index.js';
scene.add(createAsset('classroom.student_desk', {}, style));
scene.add(createAsset('classroom.room', { variant: 'Cutaway', seed: 0 }, style)); // or 'Full'; seed 0 is the hand layout
```

## Conventions

- Metres. +Y up, front faces +z, origin at the bottom centre.
- `blackboard` and `clock` have their back at z = 0 (put them on a wall).
- Boxes and cylinders only. Flat shading, no textures, no readable text. The board is a green field with chalk strokes.
- Every material is `role:Swatch` from `src/styles/palette.js`. The board is `paint:Moss` so it stays green.

## Room

9 m wide (x) by 7 m deep (z), 3 m tall, open at the top, centred on the origin. The teaching wall is -z, so the blackboard faces the isometric camera. `variant: 'Cutaway'` hides `room_wall_front` and `room_wall_side` (the +z and +x walls). `'Full'` shows them. The wood floor sits 2 cm above y = 0. Teacher pieces sit on a low dais (`y: 0.08` in `layout.json`).

The sliding door and the side windows are placed in code so the openings match the frames.

Seed 0 uses `layout.json`. Any other `seed` is deterministic (`src/classroom/arrange.js`). The blackboard, the clock, the cubbies, the door and the windows stay put. The seed picks 3 or 4 columns and 2 or 3 rows of desks, one shared sideways shift, and may swap the podium and the teacher's desk on the dais. Every student chair sits on the door side of its desk and faces the board. Books, a pencil cup, the broom, the bin and the plant are optional. A walk about a metre wide runs along the cubby wall from the door to the front of the class. The bag colours and the plant pot are swatches already in the palette.
