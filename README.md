# Character Creator

A three.js playground for finding the visual style of a 3D world before building it.

**Phase 3 – walkable city (first version):** press **Walk the city** to walk a
small Japanese town as your own character (the one set up in the controls):
a 4 × 3 grid of blocks with houses (gable roofs, block walls), apartment
blocks with balconies, mixed-use buildings with shops below and vertical
signboards, glass offices, shops (konbini, ramen with noren and a red lantern,
café, bakery, bookshop, izakaya), and a park with a playground, benches, trees,
a toilet hut and cats. Streets have sidewalks, crosswalks, traffic lights,
utility poles with wires, lamps, vending machines, parked cars and cars
driving on the left, plus pedestrians walking the sidewalks.
Characters walk and run with a jointed gait keyed from classic animation walk
and run cycles (contact, down, passing, up), cross-checked against clinical
gait data (heel strike, planted stance foot, toe push-off); the old
gliding cycle is kept as **Roller skate**. The viewer's **Preview animation**
setting shows each one up close, and **City movement** picks yours in the city.
Gait references: [Lower-limb walking pattern](https://www.wikipedia.com/wiki/Lower-limb_walking_pattern),
normative sagittal gait angles ([J NeuroEng Rehabil 8:55](https://jneuroengrehab.biomedcentral.com/articles/10.1186/1743-0003-8-55/tables/1)),
running kinematics ([PMC8993226](https://pmc.ncbi.nlm.nih.gov/articles/PMC8993226/figure/F1));
classic sources: Perry & Burnfield, *Gait Analysis*; Winter, *Biomechanics and Motor Control of Human Movement*.
Controls: WASD / arrows to walk, Shift to run, drag to look, scroll to zoom,
Esc to leave; on phones an on-screen joystick.

**Phase 2 – street props (done):** Japanese street props in four groups:
street furniture (bench, street lamp, recycling bins, bollard / guard rail,
fire hydrant with its 消火栓 sign, red post box, bus stop pole and shelter),
traffic and signs (horizontal car signal, pedestrian signal, 止まれ stop sign,
speed limit, street name, cone and barrier, zebra crosswalk), vehicles (kei
car, sedan, minivan, taxi with roof lamp, city bike with basket, 50cc scooter)
and extras (planters, drink vending machines, phone booth, utility poles with
overhead wires). See the **Props gallery**; the street scene is dressed with them.

**Phase 2 – characters:** the human is now a modular character
with slots and per-item colours. Batch 1 (done): Man / Woman body types (the
man with a V-shaped torso and strong arms, the woman with an hourglass torso, chest and bottom sculpted into the body, full
thighs tapering to slim knees; see the Body shape study view), separate neck / arm / leg thickness, skin tones, 26 hairstyles (short, medium
and long, each with 6–7 cuts, plus bald, bun, spiky, mohawk, curly, afro) with
8 hair colours, 7 tops (T-shirt, shirt, sleeveless tank top, crop top; short/long sleeves),
trousers / shorts / skirt, chunky shoes or boots, a Randomize button and a crowd view.
Batch 2 (done): headwear (cap, backwards cap, beanie, fedora, headphones,
helmet), face accessories (glasses, sunglasses, flu mask), beards (short, long,
goatee) and moustaches (classic, handlebar, thin). Hats that cover the head
squash tall hairstyles underneath.
Batch 3 (done): outerwear (open cardigan, jacket with collar, hoodie with hood,
pocket and drawstrings), back items (backpack, angel wings, evil wings) and
body items (fanny pack, neck tie, bow tie, baby carrier with a baby).

**Phase 1 – style exploration (done):** a human, a cat and a tree, each built from simple
primitives in code, used to explore style directions side by side. They are meant to
live in a city and be seen small, so they have no faces and are judged at street
distance as well as up close.

Chosen direction: **PS1 · Bright + clear**: few polygons, chunky pixels, wobbly
vertices and dithered colour, but with a clear sky, vivid characters on a calmer
city, 1-pixel outlines and blob shadows so tiny characters stay easy to spot.
The rules are in **[STYLE_GUIDE.md](STYLE_GUIDE.md)**.

The gallery shows the chosen style next to a neutral **Gray-box** reference. The
runner-up variants (PS1 · Bright, PS1 · Classic) and **Ink & Cel** stay in the
code and can be picked in the street scene's style list.

## Run it

```bash
npm install
npm run dev      # local dev server
npm run build    # static site in dist/
```

## What's in the viewer

- **Gallery** – subjects as columns, styles as rows, on slow turntables.
  Click any cell to inspect it up close (drag to orbit, scroll to zoom, Esc to go back).
- **Street scene** – a sidewalk with box buildings: the human, the cat and all four
  tree variants at real-world scale.
- **Street distance (tiny)** – shows every gallery cell small, on a street, the way
  the subjects will appear in the city.
- **Crowd** – a street of 12 random characters (plus the cat); *New random crowd* rerolls it.
- **Extra character size** – exaggerate characters further for experiments (the cat is already 1.5×).
- **Lighting** – Day, Sunset, Night. Each style also has its own options
  (PS1 pixel size, vertex wobble, dithering, pixel outlines; ink line width).
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
| 3. Style directions: Ink & Cel vs PS1 (PS1 chosen), PS1 readability variants, street scene | ✅ |
| 4. (Optional) Paper cut-out style + idle animations | skipped |
| 5. Pick a direction and write a short style guide | ✅ PS1 · Bright + clear |

**City builder roadmap** (goal: a city builder for future web, iOS and Android
games; mobile via three.js wrapped with Capacitor)

| Step | Status |
|---|---|
| A. Foundation: asset catalogue, city file format, generator / builder split, save & load | ✅ |
| B. City editor (touch-friendly): paint roads, place assets, fill blocks, undo, walk it | next |
| C. Mobile performance: instancing, chunks, simpler distant people, phone frame budget | |
| D. Game library: `loadCity(json)`, `createCharacter(params)`, walk / traffic data | |
| E. Capacitor test shell (iOS + Android) | |
| F. glTF export | |

## Code layout

```
src/
  main.js            app: grid, focus/lineup views, controls panel, render loop
  subjects/          human.js, cat.js, tree.js – build(params, style) -> THREE.Group
  subjects/human/    frame.js (measurements), sculpt.js, hair.js, head.js, tops.js, arms.js,
                     legwear.js, footwear.js, outerwear.js, accessories.js – one file per slot
  styles/            inkCel.js, ps1.js, gray.js – materials per role + lights,
                     palette.js – shared base colours
  viewer/Cell.js     one stage (scene, lights, ground, street backdrop, camera framing)
  viewer/params.js   defaults + saved settings
  props/             furniture.js, traffic.js, vehicles.js, extras.js, index.js
  catalog/index.js   the asset catalogue: every placeable asset behind one interface
  city/              format.js (city file format), build.js (city file -> scene),
                     layout.js (town generator -> city file), buildings.js, park.js,
                     City.js (walking, pedestrians, cars, camera), input.js (keys, drag, joystick)
  anim/gait.js       procedural walk / run cycle
  lib/               shape helpers, seeded random, sign textures, mesh merging, saveFile
```

Subjects never pick colours or materials themselves. They ask the style for a
material by *role* (`skin`, `cloth`, `hair`, `fur`, `bark`, `leaf`, ...). Adding a
new style direction means adding one file in `src/styles/` and listing it in
`src/styles/index.js`; it then shows up as a new row in the gallery.

## Building cities

A city is a plain JSON file, so it can be generated, edited, saved, loaded and
used by other projects. Three pieces:

1. **Asset catalogue** (`src/catalog/index.js`). Everything that can be placed:
   buildings (`building.house`, `building.apartment`, `building.mixedUse`,
   `building.shop`, `building.office`), the park (`area.park`), street props
   (`prop.bench`, `prop.streetLamp`, `prop.vendingMachine`, ...), vehicles
   (`vehicle.car`, ...), paving and overhead wires. Every asset has the same
   interface: `id`, `label`, `category`, default `params`, optional `variants`
   / `colors`, a rough `size`, and `build(params, style)`. It returns an object
   standing on y = 0, facing +z, whose `userData.colliders` lists its solid
   boxes. `createAsset(id, params, style)` builds any of them.
2. **City file** (`src/city/format.js` documents it). `format: "tiny-city"`,
   `version: 1`, a street `grid` (cols, rows, block, road, sidewalk, curb), the
   `blocks` and their types, and `objects`: each one an asset id, its params,
   a position and a rotation in degrees.
3. **Builder and generator.** `buildCity(data, style)` (`src/city/build.js`)
   turns any city file into the scene, plus the colliders, pedestrian loops,
   car loop, park area and ground height a game needs.
   `generateCityData(seed)` (`src/city/layout.js`) writes a random town as a
   city file.

In the viewer: **View → Save city file** downloads the current town,
**Load city file** walks any city file, and **Back to the sample town** returns
to the generated town. Unknown assets in a file are skipped with a warning.
