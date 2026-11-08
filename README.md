# Tiny City Builder

A city builder for small Japanese towns in a PS1 look, made with three.js, for
future web, iOS and Android games. The app opens in the **city editor**: paint
blocks, place things, and walk the town you built. The **character creator**
(the 👤 Characters button) designs the people who live there; it is meant to
become a player-facing feature of the games.

The project started as a style exploration (Ink & Cel vs PS1, a gray-box
reference, body shape studies); those explorations have been removed now that
the look is settled. The history is in git.

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
thighs tapering to slim knees), separate neck / arm / leg thickness, skin tones, 26 hairstyles (short, medium
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

## Using the app

The bar at the top has three modes:

- **🏙 Build:** the city editor (below). Every town is **saved automatically**
  in this browser (IndexedDB) and the app reopens the last one. **📁 Towns**
  lists them: rename, open, duplicate, delete, or start a new empty or sample
  town. **💾 Save** downloads the town as a file; **📂 Open** adds a town file
  to your towns. (Browser storage is per device and browser: keep file copies
  of towns you care about.)
- **👤 Characters:** the character creator: a live preview (drag to turn,
  Still / Walk / Run) and a panel with four tabs (Body, Hair & face, Clothes,
  Accessories) of chips, colour swatches and sliders. Only allowed options are
  shown (see the character rules); **🎲 Random** and **↺** reset are always there.
- **🚶 Walk:** walk the town you are building, as your character. **🎥** (or
  **V**) switches between the third-person camera and an **isometric view**
  (orthographic, the classic city-builder angle) that follows you: scroll or
  pinch to zoom from street level to whole districts, drag to turn, **Q / E**
  to rotate 90°. Movement is relative to the screen in both views.

**⚙** opens the developer settings (the old controls panel: look options,
lighting, preview views such as the street scene, crowd and props gallery,
screenshot). It is hidden unless you ask for it. On phones the panels become
bottom sheets and the toolbars show icons only.

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
| B. City editor (touch-friendly): paint blocks (roads join up), place / move / turn / delete assets, undo, grid size, save / load, walk it | ✅ |
| (next) Content in batches, driven by what's missing while building | next |
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
  styles/            ps1.js – the look: materials per role + lights,
                     palette.js – shared base colours
  viewer/Cell.js     one stage (scene, lights, ground, street backdrop, camera framing)
  viewer/params.js   defaults + saved settings
  props/             furniture.js, traffic.js, vehicles.js, extras.js, index.js
  catalog/index.js   the asset catalogue: every placeable asset behind one interface
  editor/Editor.js   the city editor (top-down view, tools, touch + mouse input, toolbar)
  editor/thumbs.js   asset pictures for the palette (drawn on demand, kept in the browser)
  creator/Creator.js the character creator panel (Characters mode)
  city/              format.js (city file format), build.js (city file -> scene), edit.js (editing operations),
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

**Content added in batch 3a:** Shrine (torii gate, stone path and lanterns,
raised wooden hall with a straw rope and offering box) and School (three
storeys with a clock, entrance canopy, sports ground with a track, fence and
gate), each also a block type; a **Nature** palette tab (trees: oak, round,
pine, old giant, cherry blossom; flower beds; bushes); Japanese street props
(stone lantern, red or white paper lantern, sandwich board, bike rack).

**Content added in batch 4a (people):** sailor uniform, gakuran and yukata
tops; an apron; things carried in the hand (shopping bag, briefcase, closed
umbrella), which swing with the walk.

**Buildings batch 1 (individual shops, `src/city/shops.js`):** coin laundromat
(open glass front, washers and dryers inside, a bench), café / kissaten
(wooden small-paned front, awning, round COFFEE sign, a table outside),
pharmacy (green cross, shelves of goods with price cards out front), sushi
(tiled eave, lattice door, すし noren, fish sign, bamboo), flower shop (open
front, tiered flower buckets) and fishmonger (blue awning, an ice table of
fish, stacked boxes, hanging bulbs). Shops and Mixed blocks now use them too.

**Buildings batches 2 and 3 (`src/city/civic.js`):** udon / soba shop, family
restaurant, takoyaki stand, koban (police box), post office, bank, clinic, fire
station, karaoke, wooden apartment (アパート with an outside staircase and
walkway), parking garage, gas station. Udon / soba and takoyaki join the Shops
blocks, wooden apartments the Houses blocks, karaoke the Downtown blocks; the
public buildings are placed by hand. **Every shop window shows a painted
interior** and upstairs windows have painted curtains (see the style guide).

### City editor

**View → City editor** opens the current town from above. Tools:

- **Blocks:** tap or drag over cells to paint them Houses, Mixed, Shops,
  Downtown, Park or Plaza, or Erase them back to open ground. Each block
  fills itself (buildings, shop fronts, poles, lamps, a parked car). Roads run
  round every block and join up by themselves, and intersections get
  crosswalks, traffic lights or signs depending on how many roads meet.
  Painting a block the same type again gives it a new layout.
- **Place:** pick from a palette of pictures in tabs (Buildings, Street,
  Traffic, Extras, Vehicles, Areas), choose its type and colour with chips and
  swatches, turn it, and tap the map. Things snap to 0.5 m.
- **Select:** tap something to select it, drag to move. A card shows its
  picture and options (type, colour, shop type, a new look), which you can
  change in place, plus **Turn** (R), **Copy** and **Delete**. Moving or turning a generated thing makes it hand-placed, so
  repainting its block leaves it alone.
- **Undo / redo** (Ctrl+Z / Ctrl+Shift+Z); a whole drag is one step.
- **☰:** grid size (up to 12 × 12), new empty town, sample town, fit view.
- **Walk it:** walk the town you built (people, cars and cats included);
  Exit city returns to the editor.

Mouse: right or middle button pans, the wheel zooms. Touch: two fingers pan
and pinch to zoom. The editing operations live in `src/city/edit.js`; each
returns a new city and shares unchanged objects with the old one.
