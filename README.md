# character-creator

Naked low-poly base body for a web character creator. Three.js, ES modules, Vite. No clothes, hair, or props.

The body is the parts from the anatomy sketch:

- Head ball, neck cylinder
- Shoulder ball, clavicle cylinder, shoulder ball, across the top of the torso box
- Upper arm cylinder, elbow ball, forearm cylinder, wrist ball, box hand
- Trapezoidal pelvis under the torso
- Hip ball, thigh cylinder, knee ball, shin cylinder, ankle ball
- Box foot, with the ankle ball sitting on the heel end of the top face

Joint balls are sized so their flat faces still contain the limb cylinders. A bend does not open a gap. Each limb is parented to its joint:

`root > hips > spine > neck > head`, with `clavicle > shoulder > elbow > wrist > hand` and `hip > knee > ankle > foot`.

Default body, detail-1 icospheres and open 8-sided cylinders: **854 vertices, 1272 triangles** (13 balls, 10 cylinders, 5 boxes, 1 trapezoid).

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
import { createBody } from './src/body/index.js';

const body = createBody({
  height: 1.8,
  shoulderWidth: 0.5,
  hipWidth: 0.27,
  limbThickness: 1,
  headSize: 0.132,
  skinColor: '#e0a37c',
});

scene.add(body.root);
body.update(dt, 'idle');   // 'idle' | 'walk' | 'pose'
body.setParams({ limbThickness: 1.2 });
```

`update(dt, state)` also accepts `{ mode, time, freeze }`. Leave a length `null` (the default) and it is derived from `height`. Shoulder width is the distance between the shoulder-ball centers and the length of the clavicle.

Spheres are detail-1 icospheres. Limbs are open 8-sided cylinders. One flat-shaded skin material.
