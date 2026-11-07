# Character Creator

A three.js playground for finding the visual style of a 3D world before building it.

**Phase 1 – style exploration:** a human, a cat and a tree, each built from simple
primitives in code, shown side by side in two style directions. They are meant to
live in a city and be seen small, so they have no faces and are judged at street
distance as well as up close.

Styles:
- **Ink & Cel** – flat colour bands and black comic outlines (lines thin out with distance).
- **PS1 low-poly** – few polygons, wobbling vertices, low-res pixels, dithered 15-bit colour, fog.
- **Gray-box** – neutral reference for shapes and proportions.

## Run it

```bash
npm install
npm run dev      # local dev server
npm run build    # static site in dist/
```

## What's in the viewer

- **Gallery** – a grid with subjects as columns and styles as rows, on slow turntables.
  Click any cell to inspect it up close (drag to orbit, scroll to zoom, Esc to go back).
- **Street scene** – a sidewalk with box buildings: the human, the cat and all four
  tree variants at real-world scale.
- **Street distance (tiny)** – shows every gallery cell small, on a street, the way
  the subjects will appear in the city.
- **Lighting** – Day, Sunset, Night. Each style also has its own options
  (ink line width; PS1 pixel size, vertex wobble, dithering).
- **Controls panel** – sliders for each subject's proportions, plus presets
  (Human: Realistic (default) / Stylized / Chibi, Cat: Housecat / Kitten / Chonk / Lanky,
  Tree: Oak / Lollipop / Pine / Old giant).
- **Save PNG** – download the current view, e.g. to paint over.
- **Copy settings** – copies every slider value as JSON, so a look you like can be shared.

Settings are remembered in your browser.

## Plan

| Milestone | Status |
|---|---|
| 1. Scaffold: scene, cameras, controls panel, comparison grid | ✅ |
| 2. Gray-box human, cat and tree with adjustable proportions | ✅ |
| 3. Style directions: Ink & Cel and PS1 low-poly, lighting presets, street scene | ✅ |
| 4. (Optional) Paper cut-out style + idle animations | |
| 5. Pick a direction and write a short style guide | |

## Code layout

```
src/
  main.js            app: grid, focus/lineup views, controls panel, render loop
  subjects/          human.js, cat.js, tree.js – build(params, style) -> THREE.Group
  styles/            inkCel.js, ps1.js, gray.js – materials per role + lights,
                     palette.js – shared base colours
  viewer/Cell.js     one stage (scene, lights, ground, street backdrop, camera framing)
  viewer/params.js   defaults + saved settings
  lib/               shape helpers, seeded random
```

Subjects never pick colours or materials themselves. They ask the style for a
material by *role* (`skin`, `cloth`, `hair`, `fur`, `bark`, `leaf`, ...). Adding a
new style direction means adding one file in `src/styles/` and listing it in
`src/styles/index.js`; it then shows up as a new row in the gallery.
