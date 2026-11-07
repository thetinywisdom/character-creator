# Character Creator

A three.js playground for finding the visual style of a 3D world before building it.

**Phase 1 – style exploration:** a human, a cat and a tree, each built from simple
primitives in code, shown side by side in several style directions.

## Run it

```bash
npm install
npm run dev      # local dev server
npm run build    # static site in dist/
```

## What's in the viewer

- **Gallery** – a grid with subjects as columns and styles as rows, on slow turntables.
  Click any cell to inspect it up close (drag to orbit, scroll to zoom, Esc to go back).
- **Lineup** – all three subjects side by side at real-world scale.
- **Controls panel** – sliders for each subject's proportions, plus presets
  (Human: Chibi / Stylized / Realistic, Cat: Housecat / Kitten / Chonk / Lanky,
  Tree: Oak / Lollipop / Pine / Old giant).
- **Save PNG** – download the current view, e.g. to paint over.
- **Copy settings** – copies every slider value as JSON, so a look you like can be shared.

Settings are remembered in your browser.

## Plan

| Milestone | Status |
|---|---|
| 1. Scaffold: scene, cameras, controls panel, comparison grid | ✅ |
| 2. Gray-box human, cat and tree with adjustable proportions | ✅ |
| 3. Style directions: Ink & Cel, Low-poly, Soft clay + lighting presets | next |
| 4. (Optional) Paper cut-out style + idle animations | |
| 5. Pick a direction and write a short style guide | |

## Code layout

```
src/
  main.js            app: grid, focus/lineup views, controls panel, render loop
  subjects/          human.js, cat.js, tree.js – build(params, style) -> THREE.Group
  styles/            gray.js – a style supplies materials per role + lights
  viewer/Cell.js     one stage (scene, lights, ground, camera framing)
  viewer/params.js   defaults + saved settings
  lib/               shape helpers, seeded random
```

Subjects never pick colours or materials themselves. They ask the style for a
material by *role* (`skin`, `cloth`, `hair`, `fur`, `bark`, `leaf`, ...). Adding a
new style direction means adding one file in `src/styles/` and listing it in
`src/styles/index.js`; it then shows up as a new row in the gallery.
