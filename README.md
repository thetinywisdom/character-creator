# character-creator

Naked low-poly base body for a web character creator. Three.js, ES modules, Vite. No clothes, hair, or props.

The default figure follows a wooden artist's mannequin:

- Faceless lathe head, a smooth egg, on a short neck
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

Each joint is a low-poly ball (`SphereGeometry`, 8×6) whose diameter matches the segment it joins. The 8 longitudes are lined up with the tube vertices, so the equator is the same octagon as the limb and a straight limb hides the ball. Smooth normals keep it reading as round when a bend shows it. Shoulder and hip balls use the radius of the limb that hangs from them and sit against the block. The waist ball is the same diameter as the chest bottom and the pelvis top, so those faces meet it flush.

Everything else stays minimal. Limbs are open 8-sided tapers, each hand is a 25-vertex rounded mitt, each foot is an 8×6 ellipsoid. The chest and pelvis keep the tapered block shape, with a two-segment quarter-circle bevel on every edge and smooth normals, so the corners read as rounded wood instead of razor edges. Each block is 72 vertices. The tubes use smooth normals so they read as round at city size.

Default body: **1445 vertices, 1916 triangles** (14 balls, 9 tubes, 2 beveled blocks, 2 mitts, 2 feet, 1 head).

The default colour is the illustration's warm skin (`#f1cdc3`). `skinColor` tints the whole figure. The body is smooth-shaded Lambert, one colour, so a limb and its joint read as the same surface. The head is an 8-segment lathe, scaled so the chin ring matches the neck, and 1.08× deeper than it is wide. It has no ears, nose, or lines. See `docs/STYLE.md`.

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
import { ANIMATIONS, createBody, JOINT_NAMES } from './src/body/index.js';

const body = createBody({
  height: 1.8,
  shoulderWidth: 0.42,
  hipWidth: 0.15,
  limbThickness: 1,
  headSize: null,
  skinColor: '#e4c29a',
});

scene.add(body.root);
body.update(dt, { anim: 'walk', speed: 1.6 });
body.setParams({ limbThickness: 1.2 });
```

`update(dt, state)` takes an animation name or `{ anim, speed, time, freeze, turn, grounded, vy, crouch, side, dir }`. `mode` is still accepted as an alias of `anim`. Locomotion speed is metres per second (`idle` 0, `walk` 1.6, `run` 6.5); walk blends into run between 3.4 and 5.4. Dances and one-shots use `speed` as a playback rate. A clip change crossfades in about a fifth of a second. Passing `time` with `freeze` holds that frame, which is how the 120° `pose` check stays exact. Head pitch, yaw, and roll ride the neck joint.

Clips, in picker order: Idle, Walk, Run, Jump, Crouch, Slap, Hit, Hit (other side), Knockdown, Fall back, Pose test, Robot, Chicken, Disco, Sprinkler, Flail, Hula, Flex, and Bad. `ANIMATIONS` lists the same ids. Jump plays in place (anticipation, tuck, landing). Knockdown tumbles forward; Fall back lands on the back. Feet stay on the ground for the standing clips.

Leave a length `null` (the default) and it is derived from `height`. `headSize` is the distance from the lathe origin to the crown. Shoulder width and hip width are the distances between those ball centres.

`body.joints` has exactly the fourteen names in `JOINT_NAMES`. `body.pelvis` is the rig group. `body.materials` is the flat material and the smooth one.
