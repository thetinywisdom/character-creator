# character-creator

A reusable low-poly 3D character kit for web games. Characters are procedural `three.js` meshes on a hand-built joint rig (no glTF, no textures). Walk, run, limb IK, reactions, eight dances, and held-item poses ship with the rig.

The look is the iso-city creator catalogue: 20 hairstyles, 4 hats, 11 tops, 4 bottoms, 4 shoes, facial hair, glasses, earrings, a bag, 16 held items, 4 body types, and 30 palette colours. Parts are registered, so later work can add a slot without rewriting the builder.

`three` is a **peer dependency**. The optional toon / palette pipeline lives at `character-creator/style` and is not required to draw a character.

## Run the preview

GitHub Actions publishes the preview to [https://thetinywisdom.github.io/character-creator/](https://thetinywisdom.github.io/character-creator/). A push to `main` or `cursor/character-creator-foundation-4dd4` builds it with Vite (`base` `/character-creator/`) and deploys it through GitHub Pages. The same workflow can be run by hand from the Actions tab. The site appears after the repository owner sets Settings → Pages → Build and deployment → Source to GitHub Actions.

```bash
npm install
npm run dev
```

Open the URL Vite prints. The page shows one character on a turntable. Idle, walk, and run share the same rig. Each dance has a button. **Toon style** swaps the comic ramp for plain `MeshLambertMaterial`. **Randomize** builds a new character from the catalogue.

```bash
npm test
npm run build
```

## Use it in a game

```js
import * as THREE from 'three';
import { createCharacter, defaults, randomize } from 'character-creator';

const character = createCharacter(defaults('woman'));
scene.add(character.root);

// inside the animation loop
character.update(dt, { speed: 1.4, grounded: true, vy: 0, crouch: 0, turn: 0 });

character.dance('disco');
character.stopDance();
character.setDef(randomize(1));
```

`speed` is horizontal units per second. The walk becomes a run between 3.4 and 5.4. `root` faces +Z; rotate it to steer. Feet stay on y = 0.

Toon shading, for games that want the comic look:

```js
import { PixelPipeline } from 'character-creator/style';

const pixel = new PixelPipeline(renderer);
pixel.toonify(scene);
// each frame, instead of renderer.render:
pixel.render(scene, camera);
```

Without that call, characters render with ordinary Lambert materials.

## Add a part

```js
import { registerPart, getParts } from 'character-creator';

registerPart('head.hair', 'mohawk', {
  label: 'Mohawk',
  build(ctx, opts) {
    // add meshes under ctx.P (root, body, torso, head, headCenter,
    // armL/R, elbowL/R, wristL/R, legL/R, kneeL/R, ankleL/R)
    // opts is the slot object from the v2 def, e.g. { style, color, highlight }
  },
});

getParts('head.hair');
```

Limb parts have to keep the standard joint positions and bone lengths (`METRICS` in `character-creator/geom`). Walk, IK, and held-item poses read those joints by name. Put new geometry on the existing groups instead of parenting a second shoulder or hip.

The definition format is documented in [SCHEMA.md](SCHEMA.md).
