# SKILLS.md: building a game on Tiny City Builder

For agents (and people) making a game with this foundation, or extending it.
Read this first, then `STYLE_GUIDE.md` (how things must look) and `PLAN.md`
(decisions and what is next). Keep this file current (see the end).

## What this is

A **foundation library** of plain ES modules on top of three.js: a small
Japanese town in a PS1 look, with buildings, street props, people, cars,
cats, walking, collisions and the PS1 render step. It is not a product for
players. A game copies or imports the modules it needs and builds its own
gameplay, UI and editors on top.

The app in this repo (`npm run dev`) is only a **viewer** for the owner and
agents to see what exists:

| Mode | Shows | Code a game reuses |
|---|---|---|
| 📦 Catalogue (home) | every placeable item with its id, settings and a `createAsset(...)` line to copy | `src/catalog/` |
| 👤 Characters | the character creator; ⬇ JSON / ⬆ export and import a character | `src/subjects/human*` |
| 🏙 City | walk a generated sample town; 🎲 new town, time of day, weather, third person / iso | `src/city/` |

There is no city editor: a game generates its towns (`generateCityData`) or
writes the town JSON itself.

## Quick start for a game

```js
import * as THREE from 'three';
import { style, lightingPresets } from './src/styles/index.js';   // the PS1 look
import { createPs1Renderer } from './src/render/ps1.js';
import { createAsset } from './src/catalog/index.js';
import { generateCityData } from './src/city/layout.js';
import { buildCity } from './src/city/build.js';
import { City } from './src/city/City.js';

const renderer = new THREE.WebGLRenderer({ canvas });
const ps1 = createPs1Renderer(renderer);

// A) one item in your own scene
const scene = new THREE.Scene();
scene.add(createAsset('building.koban', {}, style));       // ids: see the Catalogue
// each frame: ps1.render({ scene, style }, camera, 0, 0, w, h);

// B) a whole town (scene, colliders, walking routes, ground)
const town = buildCity(generateCityData(42), style);

// C) the ready-made walkable town used by the viewer (player, people, cars, cats, cameras)
const city = new City({ style, renderer, human, cat, params, data: generateCityData(42) });
// each frame: city.update(dt, input); ps1.render(city, city.activeCamera, 0, 0, w, h);
```

`City.js` is a working example of everything together (movement, collisions,
traffic, cameras, night and weather); copy what you need rather than treating
it as a fixed engine.

## Building on top: what goes where

Games can add their own animations, characters, buildings and items. Keep
the foundation general and the game specific:

- **Add to this repo** anything any game could use: a new animation (sitting,
  waving), a new body type or clothing option, a building, a prop, a tree, a
  weather. Follow the patterns below (catalogue entry, collider, style roles,
  docs) so it shows up in the viewer and every future game gets it.
- **Keep in the game** what only that game needs: its rules, UI, menus,
  saves, story characters, game-only models.
- **New animations** are plain functions that set joint rotations each frame,
  like `anim/gait.js` (people) and `anim/catGait.js` (the cat). Joints are
  named groups (`JOINT_NAMES`, `CAT_JOINTS`); skinned people keep them, so an
  animation works in the city too. Run extra poses after `poseGait`, as
  `poseHold` does. Models made elsewhere (glTF) can be loaded with three.js
  too; give them style materials so they match.
- **New kinds of characters** follow `subjects/cat.js`: a `schema`, `presets`
  and a `build(params, style)` that names its joints.

## Run, build, publish

```bash
npm install
npm run dev      # the viewer (Vite)
npm run build    # must pass before committing
```

The owner reviews the viewer as a single-file page published with the
Artifact tool: build, inline `dist/assets/*.css` and `*.js` into one HTML file
(escape `</script` inside the JS), publish to the same artifact URL each time.
The page declares the `downloads` capability (character JSON export goes
through `src/lib/saveFile.js`).

## Code map

```
src/main.js            the viewer: three modes, render loop, debug hooks (not reused by games)
src/render/ps1.js      createPs1Renderer: low-res render + dither + outlines (reuse this)
src/styles/            ps1.js (materials by role, lights), palette.js, lightingPresets
src/catalog/index.js   ASSET CATALOGUE: every placeable item behind one interface
src/catalog/thumbs.js  catalogue pictures (drawn on demand, cached in the browser)
src/subjects/          human.js (+ human/*: frame, sculpt, hair, head, tops, arms, legwear,
                       footwear, outerwear, accessories, handheld, rules), cat.js, tree.js
src/anim/              gait.js (people: walk / run, wing flap, poseHold: stoop + held items),
                       catGait.js (cat walk / run), skirt.js (skirt stretch)
src/city/format.js     town JSON format, grid geometry, validation
src/city/layout.js     generator: generateCityData(seed), blockObjects, streetObjects, roadNetwork
src/city/build.js      buildCity(data, style): town JSON -> scene, colliders, routes, ground
src/city/edit.js       immutable town edits (setBlock, addObject, ...) if a game needs editing
src/city/buildings.js  house, apartment, mixedUse, shop, office, shrine, school
src/city/shops.js      laundromat, kissaten, pharmacy, sushi, florist, fishmonger
src/city/civic.js      udon/soba, family restaurant, takoyaki, koban, post office, bank,
                       clinic, fire station, karaoke, wooden apartment, parking, gas station
src/city/interiors.js  painted shop interiors and curtains
src/city/facades.js    painted office facades, roof clutter, roof signs
src/city/City.js       walkable town: player, people, cars, cats, collisions, cameras,
                       setWeather('Clear'|'Rain'|'Snow'), night via applyLighting
src/city/backs.js      dresses bare backs and sides of every building (windows, AC units,
                       back door, drain pipe, emergency stairs), found with rays
src/city/variety.js    shared building variety: flatsAbove, roofTop, frontExtras, side, pick, between
src/city/silhouette.js see-through people in the iso view (stencil + GreaterDepth copy)
src/city/atmosphere.js night glow (setNightGlow), snow cover (setSnowCover), rain / snow
                       screen layer (Precipitation), lamp light pools, weatherLight
src/city/input.js      keyboard, drag, pinch and on-screen joystick
src/props/             street props (furniture, traffic, vehicles, extras, japan)
src/creator/Creator.js the character creator panel (viewer only)
src/viewer/            Cell (a preview stage), params (saved settings)
src/lib/               shapes, merge (one mesh per material), skin (one skinned mesh per
                       person), rng, textures, saveFile
```

## The rules (keep them in any game)

**Style by role.** Models never pick materials directly; they ask
`style.material(role, color?, map?)` with roles like `skin`, `cloth`, `hair`,
`building`, `concrete`, `wood`, `glass`, `signage`, `light`, `metal`. Vivid
roles (`signage`, `light`, character roles) keep their colour; environment
roles are softened. `light` glows: never use it for big textured surfaces.

**Assets.** Everything placeable is in `src/catalog/index.js`:

```js
{ id: 'building.koban', label, category, group, params /* defaults */,
  variants?, colors?, size: [w, d], build(params, style) -> THREE.Object3D }
```

`build` returns an object standing on y = 0, facing +z, with
`userData.colliders = [{ x, z, hw, hd }]` in its own space.
`createAsset(id, params, style)` builds one; unknown params fall back to the
defaults. `params.variant` picks from `variants`, `params.color` from
`colors`, `params.seed` changes the look of seeded items, buildings take
`w` / `d` (lot size) and shops `shopType`. Groups (catalogue tabs):
buildings, street, traffic, extras, nature, animals, vehicles, areas.
`animated: 'cat'` marks items with joints (`animal.cat`: pose it with
`poseCat`, `anim/catGait.js`). Trees (`nature.tree`) come in 11 presets
(oak, lollipop, pine, old giant, cherry blossom, Japanese maple, ginkgo,
zelkova, black pine, weeping willow, bamboo); motorbikes
(`vehicle.scooter`) in 50cc, Delivery, Step-through and Motorcycle; cars
(`vehicle.car`) in Kei car, Sedan, Hatchback, Minivan, Taxi, Sports car and
Bus. Cars are built from a side profile extruded across the width (`CARS`
in `props/vehicles.js`: `body` and `glass` outlines, axle and door positions);
add a car by adding an outline there. `CAR_SIZES` gives each one's half
sizes for collisions and braking.

**Town JSON** (`src/city/format.js`): `{ format: 'tiny-city', version: 1,
meta, grid: { cols, rows, block: 40, road: 6, sidewalk: 3, curb: 0.12 },
blocks: [{ col, row, type, seed }], objects: [{ asset, params, x, z, y?, rot
/* degrees */, group? }] }`. Block types: residential, mixed, shops, downtown,
park, plaza, shrine, school. Roads run round every block and join up by
themselves. Objects with `group: 'block:c,r'` or `'streets'` are generated;
objects without a group are hand-placed. The same JSON always rebuilds the
same town (everything is seeded with `mulberry32`).

**Collisions.** Every asset lists solid boxes (`PROP_COLLIDERS` for props,
`colliders` from building builders). `City.js` shows the pattern: grid lookup
(`nearColliders`), push the player out of boxes, cars, people and cats;
pedestrians sidestep; cars brake for things ahead. A new item needs a collider.

**Performance.** Merge static things into one mesh per material
(`src/lib/merge.js`). Turn each walking person into one skinned mesh
(`src/lib/skin.js`, about 2 draw calls a person). Prefer painted textures over
many small meshes ("feel real, not be real").

**See-through movers.** In the iso view, everything that moves (people,
cats, cars, buses) shows as a flat silhouette when hidden by a building
(blue; the player yellow), `src/city/silhouette.js`: `addSilhouette` for
skinned people and cats, `addObjectSilhouette` for rigid things like cars.
A new moving thing in the city needs one. Every
style material writes stencil 0, a person's materials stencil 1
(`markPerson`), and a copy of each skinned person is drawn last with
`depthFunc: GreaterDepth` where the stencil is not 1. `City.setViewMode`
shows them in iso only. The PS1 render target has a depth + stencil buffer;
keep it. A silhouette pixel is drawn once (it marks the stencil), so overlapping
parts tint evenly.

**Night and weather.** Night is the `Night` lighting preset (`night: true`):
`setNightGlow(root, on)` makes lamps, signs, shop interiors and lit windows
glow by changing the shared style materials (no real lights). A painted
texture that should only partly glow carries a light mask in
`texture.userData.glowMap` (see `curtainTexture`, `officeTexture`): paint one
for any new painted window texture. `setSnowCover(root, on)` whitens roles
(ground, grass, roof, leaf, ...). Both change shared materials, so apply them
per scene and switch them off when leaving (the viewer does this for snow).
Rain and snow are faked around the camera, not a box in the world
(`Precipitation.update(dt, camera, { pixels, distance })`, called after the
camera moves): one layer drawn on top, always covering the view, no edges.
Sizes and density are real-world for the view at the player (0.5 m streaks,
8 cm flakes; iso: the orthographic view size, third person: the view size
at the camera's distance to the player), so both cameras behave the same:
zoomed out, many small drops. Zoomed in past a 24 m tall view, the screen
size and number of drops stay as at that view, so close up the weather
looks the same and never gets in the way.

**No coplanar surfaces.** Two surfaces facing the same way must be ≥ 2 cm
apart or they flicker on phones. Keep the 24-bit depth buffer in `ps1.js`.

## Characters (optional for games)

`human.build(params, style)` builds a person from settings. A game may use
these characters, or not use them at all.

**Character JSON** (exported from 👤 Characters with ⬇ JSON):

```json
{ "format": "tiny-character", "version": 1, "params": { "bodyType": "Woman", "build": "Normal", "hair": "...", ... } }
```

`params` holds the values of `human.schema` (`src/subjects/human.js`): body
(`bodyType` Man / Woman / Boy / Girl / Grandpa / Grandma, `build` Skinny / Normal / Bulky / Fat,
`height`, `headsTall`, `legLength`, widths and thicknesses, `skin`), hair and
face (`hair`, `hairColor`, `beard`, `moustache`, `headwear`, `mask`,
`faceAccessory`), clothes (`top`, `legwear`, `outerwear`, `footwear`, each with
a colour) and accessories (`backAccessory`, `bodyAccessory`, `handItem`).
Hand items: shopping bag, briefcase, umbrella, walking stick (hanging, swing
with the arm) and umbrella (open), phone, ice cream, coffee cup, boxes (held:
the arms take a pose from `HOLD_POSES` in `human/handheld.js`, kept by
`poseHold` while walking). `giveHeldItem(body, params, kind, color, style)`
hands a held item to an already built (even skinned) person and returns a
function that takes it away (the city uses it for umbrellas in the rain).
`human.outfits` holds ready-made looks (clothes only): Office worker, Police
officer, Delivery worker, Summer stroll, Rainy day, Coffee run, On the phone.
`human.schema[key]` gives each key's options or min / max and default.

To use one in a game:

```js
import { human } from './src/subjects/human.js';
const { params } = JSON.parse(text);
const p = { ...defaults, ...params };      // defaults from human.schema
human.applyRules(p);                        // fix combinations the rules forbid
const person = human.build(p, style);       // animate with poseGait (src/anim/gait.js)
```

Rules (`human/rules.js`): no facial hair on women and children; no skirts or
crop tops on men and boys; ties need a shirt; sailor uniform for women and
girls, gakuran for men and boys (not for grandparents); children don't carry
babies; yukata hides legwear. Grandparents stand with a stoop
(`userData.stoop`) and walk slowly in the city. `BODY_DEFAULTS` holds each body type's default design. Each game
decides what players may change.

## Common tasks

**Every seed must give a really different building.** `params.seed` feeds
`rng`; the catalogue's 🎲 New look and every generated town rely on it. A
builder draws from `rng` (never `Math.random`), in this order of importance:
shape (floors, width / depth used, roof, wings, setbacks), layout (door side
with `side(rng)`, where signs and displays go), details (awnings, balconies,
AC units, `frontExtras`), and only then colours. Colour alone reads as "the
same building". Use the helpers in `src/city/variety.js`: `flatsAbove`
(flats over a shop), `roofTop` (flat roof with parapet and clutter, or a
pitched roof), `frontExtras` (bikes, boards, planters, vending machines).
Check six seeds side by side before committing.

**Backs and sides are dressed automatically.** After a building is built,
`dressBacks` (`city/backs.js`, called in the catalogue) feels its walls with
rays and adds curtained windows (lit at night), AC units, a back door, a
drain pipe and, on 3+ floors, a steel emergency staircase to the back and
sides, only on bare `building`-role walls (painted facades and other roles
are left alone). A builder only needs to detail its street front. Open
structures are skipped (`BARE_OK` in `catalog/index.js`).

**Add a building.** Write `myBuilding(style, rng, w, d)` (fills a lot w × d,
faces +z, returns `{ group, footprint, colliders }`) in `shops.js` /
`civic.js` (reuse `body`, `signboard`, `awning`, `noren`, `upperFloors`,
`shopWindow`), add it to `SHOP_BUILDINGS` / `CIVIC_BUILDINGS` with label and
lot size, give it a painted interior (`PAINT` in `interiors.js`). Optionally
add it to block fills in `layout.js`. It then appears in the Catalogue. Bump
`VERSION` in `catalog/thumbs.js` if an existing item's look changes (now 6: dressed backs).

**Add a prop.** Add `{ id, label, variants, colors?, build(params, style) }` to
a file in `src/props/`, list it in `PROP_GROUPS` (`props/index.js`), add its
collider in `PROP_COLLIDERS` (`catalog/index.js`).

**Add a block type.** Add it to `BLOCK_TYPES` (`format.js`) and a branch in
`blockObjects` (`layout.js`).

**Add a character option.** Add it to `human.schema` (its group decides the
creator tab, `TAB_OF` in `Creator.js`), build it in the right `human/*.js`
file, add rules in `rules.js` if needed, and add it to `randomize` and the
default designs if relevant.

## Testing and checking

No unit tests; verify by building and looking.

- `npm run build` must pass.
- Drive the viewer with Playwright (Chromium is preinstalled; use
  `--use-gl=angle --use-angle=swiftshader`): `npx vite preview`, open the
  page, use `window.__cc` and take screenshots.
- Hooks on `window.__cc`: `params`, `state`, `setView('catalog'|'item'|'creator'|'city')`,
  `openItem(id, params)`, `CATALOG`, `human` (presets, outfits), `apply('human', values)`, `orbit(az)`,
  `gait.lock = fraction` (freeze the walk), `getCity()` (`player`, `npcs`,
  `cars`, `cats`, `cam`, `iso`, `setViewMode('iso'|'third')`, `setWeather(kind)`),
  `newTown(seed)`, `cityInput`. The app bar's ☀ / 🌤 buttons switch light and weather.
- To look at one building: `openItem('building.bank')`, or place the player
  in the city with `getCity().player.position.set(...)`.
- Check desktop (1280 × 720) and phone (390 × 844).
- Watch costs: count meshes and triangles of `getCity().scene`.

## Conventions

- Plain ES modules, three.js, no frameworks. Two-space indent, comments that
  explain why. Metres; +z faces the street; y up.
- Keep the PS1 look (STYLE_GUIDE.md): few polygons, flat colours, oversized
  small details.
- Keep it simple: build only what was asked. The owner decides what to add.
- Commit messages: a short title, then what changed and why.

## Keeping the docs up to date

Every change that adds, removes or renames a feature, file, asset, setting,
rule or workflow updates, in the same commit: `SKILLS.md` (this file),
`PLAN.md` (done / next / decisions), `STYLE_GUIDE.md` (looks) and `README.md`.
