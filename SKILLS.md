# SKILLS.md: working with Tiny City Builder

A guide for agents (and people) who need to use, extend or test this project.
Read this first, then `PLAN.md` (where the project is going) and
`STYLE_GUIDE.md` (how things must look). Keep this file current: see
"Keeping the docs up to date" at the end.

## What this is

A city builder for small Japanese towns in a PS1 look, built with three.js
and Vite. One person (the owner) uses it on desktop, tablet and phone to build
worlds that future web / iOS / Android games will load. It has three modes:

| Mode | What it does | Main code |
|---|---|---|
| 🏙 **Build** (home) | Top-down city editor: paint blocks, place assets, select / move / turn / delete, undo, grid size, My towns, save / open files | `src/editor/` |
| 👤 **Characters** | Character creator: live preview + tabs of chips, swatches and sliders | `src/creator/Creator.js`, `src/subjects/human*` |
| 🚶 **Walk** | Walk the town: third-person or isometric camera, pedestrians, cars, cats | `src/city/City.js`, `src/city/input.js` |

A hidden developer panel (⚙, lil-gui) has look options, lighting, preview
scenes (street, crowd, props gallery, character grid) and screenshots.

**Output is JSON.** Games consume what this tool makes as JSON: town files
(`src/city/format.js`) and character settings (the values of `human.schema`,
see `src/subjects/human.js` and `human/rules.js`). Games build their own
editors and creators on top; keep the JSON formats stable and documented, and
version them when they change.

## Run, build, publish

```bash
npm install
npm run dev      # dev server (Vite)
npm run build    # production build into dist/ (must pass before committing)
```

The owner reviews the app as a single-file page published with the Artifact
tool: build, inline `dist/assets/*.css` and `*.js` into one HTML file (escape
`</script` inside the JS), publish it to the same artifact URL each time. The
page declares the `downloads` capability (saving town files and screenshots
goes through `src/lib/saveFile.js`).

## Code map

```
src/main.js            app shell: views, app bar, render loop, dev panel, debug hooks
src/styles/            ps1.js (the look: materials by role, lights, low-res render), palette.js
src/subjects/          human.js (+ human/*: frame, sculpt, hair, head, tops, arms, legwear,
                       footwear, outerwear, accessories, handheld, rules), cat.js, tree.js
src/anim/              gait.js (walk / run / roller skate, wing flap), skirt.js (skirt stretch)
src/catalog/index.js   ASSET CATALOGUE: every placeable asset behind one interface
src/city/format.js     city file format (JSON), grid geometry, validation
src/city/layout.js     generator: blockObjects, streetObjects, roadNetwork, generateCityData
src/city/build.js      buildCity(data, style): city file -> scene + colliders, routes, ground
src/city/edit.js       immutable editing ops: setBlock, resizeGrid, add/update/removeObject, ...
src/city/buildings.js  house, apartment, mixedUse (shop + flats), shop, office, shrine, school
src/city/shops.js      individual shops (laundromat, kissaten, pharmacy, sushi, florist, fishmonger)
src/city/civic.js      udon/soba, family restaurant, takoyaki, koban, post office, bank, clinic,
                       fire station, karaoke, wooden apartment, parking garage, gas station
src/city/interiors.js  painted shop interiors + painted curtain windows
src/city/facades.js    painted office facades, side windows, roof clutter, roof signs
src/city/park.js       park area
src/city/City.js       Walk mode: player, NPCs, cars, cats, cameras (third person + iso);
                       routes are closed polylines followed with rounded corners
                       (alongLoop(loop, lengths, total, s, radius))
src/props/             street props (furniture, traffic, vehicles, extras, japan)
src/editor/            Editor.js, thumbs.js (palette pictures, cached), towns.js (IndexedDB),
                       TownsPanel.js (My towns)
src/creator/Creator.js character creator panel
src/lib/               shapes, merge (merge by material), skin (one skinned mesh per person),
                       rng, textures (sign canvases), saveFile
```

## Core concepts

**Style by role.** Models never pick colours or materials directly. They ask
the style: `style.material(role, color?, map?)` with roles like `skin`,
`cloth`, `hair`, `building`, `concrete`, `wood`, `glass`, `signage`, `light`,
`metal`, `darkMetal`. Roles in the "vivid" set (`signage`, `light`, character
roles) keep their colour; environment roles are softened. `light` glows
(emissive): do not use it for big textured surfaces (it washes them out).

**Assets.** Everything placeable lives in `src/catalog/index.js`:

```js
{ id: 'building.koban', label, category, group /* palette tab */, params /* defaults */,
  variants?, colors?, size: [w, d], build(params, style) -> THREE.Object3D }
```

`build` returns an object standing on y = 0, facing +z, with
`userData.colliders = [{ x, z, hw, hd }]` in its own space.
`createAsset(id, params, style)` builds one. Categories: building, area,
nature, prop, vehicle, ground, line. Palette tabs: buildings, street, traffic,
extras, nature, vehicles, areas.

**City file** (`src/city/format.js`): `{ format: 'tiny-city', version: 1,
meta, grid: { cols, rows, block, road, sidewalk, curb }, blocks: [{ col, row,
type, seed }], objects: [{ asset, params, x, z, y?, rot /* degrees */, group? }] }`.
Block types: residential, mixed, shops, downtown, park, plaza, shrine, school.
Roads run round every existing block and join up by themselves. Objects with
`group: 'block:c,r'` or `'streets'` are generated and replaced on regeneration;
objects without a group are hand-placed and kept.

**Editing.** `src/city/edit.js` functions return a NEW city and share
unchanged objects (undo = keep old cities; the editor diffs by identity).
Never mutate a city object in place.

**Merging.** The walkable city is merged into one mesh per material
(`src/lib/merge.js`). Shared materials = few draw calls. Custom attributes are
stripped unless the material lists them in `userData.keepAttributes`.
In Walk mode each person is turned into ONE skinned mesh (`src/lib/skin.js`):
every part is bound rigidly to the joint it hangs from (`JOINT_NAMES` in
`anim/gait.js` + `head`), its material colour baked into a vertex colour, and
all people share one vertex-colour material, about 2 draw calls a person. The
joints stay, so `poseGait` animates them as before. Textured or transparent
parts and the skirt (which deforms itself) stay separate meshes. A person
must therefore not rely on per-part materials in Walk mode (no per-frame
material changes; textures on clothing would need their own mesh).

**Determinism.** Buildings, blocks, parks and textures are seeded
(`mulberry32`). The same city file always rebuilds the same town.

**Painted, not modelled.** Shop interiors, upper-floor curtains and office
facades are small canvas textures shared per kind (feel real, not be real).
Prefer a painted texture over many small meshes.

**Characters.** `human.build(params, style)` from a schema (`human.schema`).
Rules in `src/subjects/human/rules.js` (who can wear / have what, body-type
default designs) are applied in build, the panel, the creator and the
randomizer. `measure(p)` in `human/frame.js` gives every body measurement;
anything worn on the torso should use `torsoSurface(f)` (in `tops.js`) to sit
on the real sculpted body.

## Common tasks

**Add a building.** Write `myBuilding(style, rng, w, d)` (fills a lot w × d,
faces +z, returns `{ group, footprint: { w, d, z }, colliders }`) in
`shops.js` / `civic.js` (reuse `body`, `signboard`, `awning`, `noren`,
`upperFloors`, `shopWindow`), add it to that file's `SHOP_BUILDINGS` /
`CIVIC_BUILDINGS` table with label and lot size, give its window a painted
interior (add a painter to `PAINT` in `interiors.js` if needed). Optionally add
it to block fills in `layout.js` (`pickBuilding`, `NEW_SHOPS`). Palette
pictures are cached in the browser: bump `VERSION` in `editor/thumbs.js` if an
existing asset's look changes.

**Add a prop.** Add `{ id, label, variants, colors?, build(params, style) }`
to a file in `src/props/`, list it in `PROP_GROUPS` (`props/index.js`), add its
collider in `PROP_COLLIDERS` (`catalog/index.js`).

**Add a block type.** Add it to `BLOCK_TYPES` (`format.js`), give it a branch
in `blockObjects` (`layout.js`), a label and colour in `Editor.js`.

**Add a character option.** Add to `human.schema` (group decides the creator
tab; see `TAB_OF` in `Creator.js`), build it in the right `human/*.js` file,
add rules in `rules.js` if some combinations make no sense, add it to
`randomize` and the default designs in `rules.js` if relevant.

## Testing and checking

There is no unit test suite; changes are verified by building and looking.

- `npm run build` must pass.
- Drive the app with Playwright (Chromium is preinstalled): serve `dist/`,
  open the page, use the debug hooks on `window.__cc` and take screenshots.
  Useful hooks: `params`, `state`, `setView(view)`, `actions` (saveCity,
  loadCity, city, editor, ...), `enterEditor()`, `getEditor()` (editor: `data`,
  `loadTown(data)`, `setData`, `paintAt`, `placeAt`, `view`, `updateCamera`),
  `enterCity()`, `getCity()` (city: `player`, `npcs`, `cars`, `cam`, `iso`,
  `setViewMode('iso'|'third')`, `layout`), `CATALOG`, `apply(subjectId, values)`,
  `enterFocus(i)`, `orbit(az)`, `viewerGait.lock = fraction` (freeze the gait).
- To look at a building: load a small test town with `getEditor().loadTown()`
  (plaza blocks, buildings placed in a row), switch to Walk, place
  `player` / `cam` and screenshot; or use the iso view for roofs.
- Check desktop (1280 × 720) and phone (390 × 844) sizes for UI changes.
- Watch costs: count triangles and meshes (draw calls) of `getCity().scene`.

## Conventions

- Plain ES modules, three.js; no frameworks. Two-space indent, comments that
  explain why. Sizes in metres; +z faces the street; y up.
- Keep the PS1 look: few polygons, flat colours, oversized small details so
  they read when tiny (see STYLE_GUIDE.md).
- Commit messages: a short title, then what changed and why.
- UI must work with touch (44 px targets, pinch, two-finger pan) and mouse.
- **No coplanar surfaces.** Two surfaces facing the same way must be at least
  ~2 cm apart (a painted panel in front of a wall, stripes above a road), or
  they flicker on phones (z-fighting). The low-res render uses a 24-bit depth
  buffer and the iso camera keeps a tight near / far range; keep it that way.

## Keeping the docs up to date

Every change that adds, removes or renames a feature, file, asset, setting,
rule or workflow must update, in the same commit:

- `SKILLS.md` (this file): how to use and extend the tool.
- `PLAN.md`: mark what is done, add what is next, record decisions.
- `STYLE_GUIDE.md` for anything that changes how things look.
- `README.md` for user-facing behaviour.
