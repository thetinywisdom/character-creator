# character-creator

Naked low-poly base body for a web character creator. Three.js, ES modules, Vite. No clothes, hair, or props.

The default figure follows a wooden artist's mannequin:

- Egg-shaped head, wider toward the crown, on a short neck
- Chest block, wider at the shoulders and tapered to the waist
- Separate pelvis block under a waist joint
- Shoulder balls on the upper sides of the chest
- Tapered upper arm and forearm, paddle hands turned slightly inward
- Tapered thigh and shin, flush knee, small rounded feet

There is no clavicle. Fourteen joints: `neck`, `waist`, and on each side `shoulder`, `elbow`, `wrist`, `hip`, `knee`, `ankle`.

```
root > pelvis > waist > neck > head
              > shoulder > elbow > wrist > hand
              > hip > knee > ankle > foot
```

`pelvis` is a rig group used for sway and planting the feet. It is not one of the fourteen joints. The head is a mesh under the neck, so rotating `neck` turns the head.

Each joint is a smooth sphere (`SphereGeometry`, 24×16) whose diameter matches the segment it joins. A straight limb hides the ball. A bend lets the ball fill the outside of the wedge. Shoulder and hip balls use the radius of the limb that hangs from them and sit against the block. The waist ball is the same diameter as the chest bottom and the pelvis top, so those faces meet it flush.

Everything else stays minimal. Limbs are open 8-sided tapers, the chest and pelvis are 8-vertex blocks, each hand is a 13-vertex paddle, each foot is an 8×6 ellipsoid. An 8-sided tube's flat faces sit about 8% of the radius inside the circle, so a straight joint shows a thin sliver of the sphere along each flat. The tubes stay faceted.

Default body: **6595 vertices, 10984 triangles** (14 spheres, 9 tubes, 2 blocks, 2 paddles, 2 feet, 1 head). The smooth spheres are nearly all of that count.

The default colour is the pale wood of the reference (`#e4c29a`). `skinColor` tints the whole figure. Blocks and limbs are flat-shaded. Joints, the head, and the feet are smooth-shaded, in the same colour, so a flush ball does not read as a different material.

## Scripts

```bash
npm install
npm run dev      # preview at http://localhost:5173
npm test
npm run build
```

`three` is a peer dependency. This repo also lists it as a dev dependency so the preview and tests install cleanly.

## API

```js
import { createBody, JOINT_NAMES } from './src/body/index.js';

const body = createBody({
  height: 1.8,
  shoulderWidth: 0.42,
  hipWidth: 0.15,
  limbThickness: 1,
  headSize: null,
  skinColor: '#e4c29a',
});

scene.add(body.root);
body.update(dt, 'idle');   // 'idle' | 'walk' | 'pose'
body.setParams({ limbThickness: 1.2 });
```

`update(dt, state)` also accepts `{ mode, time, freeze }`. Leave a length `null` (the default) and it is derived from `height`. `headSize` is the crown radius of the egg. Shoulder width and hip width are the distances between those ball centres.

`body.joints` has exactly the fourteen names in `JOINT_NAMES`. `body.pelvis` is the rig group. `body.materials` is the flat material and the smooth one.
