# Customization system plan

The wooden mannequin on `cursor/low-poly-base-body-6ee7` (PR #2) stays the rig. Parts hang off it. Section 8 records the approved decisions. PR A is the registry and the saved document. Later PRs add the meshes.

Vertex counts below use the primitives already in the repo: an open 8-side tube is 18 vertices, an 8×6 joint ball is 63, the beveled chest or pelvis is 72, a paddle is 13, a foot ellipsoid is 63, the current head lathe is 81. A closed box is 8. An 8-plane cone (skirt) is 16.

## 1. What exists, and the gaps

Files:

- `src/body/geometry.js` builds the lathe head, 8×6 balls, open tapers, beveled blocks, paddles, feet.
- `src/body/params.js` turns `DEFAULT_PARAMS` into metres. `null` means “derive from height”.
- `src/body/createBody.js` builds the rig and returns the API below.
- `src/body/animate.js` holds `ANIMATIONS`, locomotion, actions, dances, foot planting, and a clearance pass.
- `src/body/index.js` is the package entry (`package.json` exports `"."`).
- `src/main.js`, `index.html`, `src/style.css` are one preview page.
- `test/body.test.js` locks the joint list, 1421 / 1868, planted feet, and limbs outside the head, chest, and pelvis.

`createBody(params)` returns `{ root, pelvis, joints, materials, update, setParams, getParams, getResolved, getStats }`.

Params today: `height`, `shoulderWidth`, `hipWidth`, `limbThickness`, `headSize`, `skinColor`, plus optional pinned lengths (`upperArmLength`, `forearmLength`, `thighLength`, `shinLength`, `torsoHeight`, `torsoWidth`, `torsoDepth`, `pelvisHeight`, `neckLength`, hand and foot sizes). Two materials share one color: flat for limbs, hands, and head; smooth for balls, feet, and blocks.

Rig, under `root`:

```
pelvis (group, not a joint)
  hipL/R > thigh > knee > shin > ankle > foot
  waist > chest block, shoulderL/R > elbow > wrist > paddle
       > neck > neck tube > head
```

The fourteen joints are `neck`, `waist`, `shoulderL`, `shoulderR`, `elbowL`, `elbowR`, `wristL`, `wristR`, `hipL`, `hipR`, `kneeL`, `kneeR`, `ankleL`, `ankleR`. `neck` turns the head. There is no face. Shoulder width and hip width are distances between ball centers. The height slider also scales shoulder, hip, and head size. `headSize` has no slider of its own. There is no belly control. `hipWidth` moves the hip joints. The pelvis block is wider than that span.

`update(dt, state)` takes a clip name or `{ anim, speed, time, freeze, turn, grounded, vy, crouch, side, dir }`. `ANIMATIONS` is a fixed array of 19 clips: idle, walk, run, jump, crouch, slap, hit, hit-r, knockdown, knockback, pose, and eight dances (robot, chicken, disco, sprinkler, flail, hula, flex, mbappe / Bad). Walk blends into run from 3.4 to 5.4 m/s. Clip changes slerp for about 0.2s. Dance targets are mirrored onto this rig (+X is the character’s right) and scaled to arm and leg length. Feet plant by moving the pelvis. Joint bind positions do not move during a clip.

Preview: movement `<select>`, speed or playback slider, wireframe, turntable, orbit, and sliders for height, shoulder, hip, limb thickness, and skin. The stats line shows vertex and triangle counts.

Gaps against the approved tree:

- No `registerPart`, no slot list, no saved character JSON.
- No head variants, hair, facial hair, headwear, eyewear, ears, or earrings.
- No man/woman or body-type presets, no belly slider, no robot torso.
- Arms are not per-side. No muscular, robot, or skeleton limb, no fist, claw, or hook, no wrist item, no second color.
- Legs are not per-side. No robot leg, no peg.
- No clothing, back attachment, or held item.
- No walk style. The dance list is a preview transport, not a saved default.
- One skin color for the whole figure. Covered skin is always drawn, so a garment would add a second layer on top of 1421 vertices.

## 2. Architecture

### Registry

New modules, leaving `createBody` as the naked rig:

- `src/character/registry.js`
- `src/character/schema.js`
- `src/character/createCharacter.js`
- `src/character/parts/*` one file per slot group
- `src/character/index.js` re-exported from `src/body/index.js` so the package entry stays one import.

```js
registerSlot('clothing.top', { label: 'Top' })
registerPart('clothing.top', 'tee', {
  label: 'T-shirt',
  params: { color: { type: 'color', default: '#3a5a40' } },
  covers: ['chest', 'upperArmL', 'upperArmR'],
  build(ctx) {}
})
```

`registerPart(slot, id, def)` throws on a duplicate id. `def.build` may only add meshes under sockets the rig already owns. It does not create joints or change joint positions. `def.covers` names body roles the part replaces. `def.params` is what the panel and the JSON are allowed to set.

Slots, in build order:

`body.torso`, `arms.left`, `arms.right`, `legs.left`, `legs.right`, `clothing`, `head.shape`, `head.hair`, `head.facialHair`, `head.headwear`, `back`, `hands.left`, `hands.right`, `arms.left.wrist`, `arms.right.wrist`, `animation.dance`, `animation.walkStyle`.

`clothing` is one compositor, not four blind builders. Top, outer, bottom, and shoes are ids inside that pass so a jacket and a tee cannot both emit a torso shell.

Sex, body type, height, skin, head size, shoulder, belly, and hip are character fields, not parts. They resolve to the existing params before any `build` runs.

### Attaching to joints

`createBody` gains empty socket groups, children of the joints, that parts are allowed to use:

| Socket | Parent | What hangs here |
| --- | --- | --- |
| `head` | `neck` | head mesh, hair, facial hair, headwear |
| `back` | `waist` | bag, backpack, wings |
| `gripL`, `gripR` | `wristL`, `wristR` | held items |
| `wristItemL`, `wristItemR` | `wristL`, `wristR` | band, cuff |

Limb and torso parts still replace the meshes `createBody` adds today (`chestMesh`, `upperArmLMesh`, `handLMesh`, …). Sockets keep accessories off those meshes so a rebuild of the chest does not throw the backpack away.

`createCharacter(doc)` resolves params, builds the rig, runs parts in the order above, then returns the same object as `createBody` plus `getDocument()`, `setDocument(doc)`, and `getRegistry()`. `update(dt, state)` is unchanged. `setParams` remains for live slider drags. A color-only change rewrites material colors. Any change to a length, a part id, or a cover set disposes generated meshes and rebuilds. Joint objects stay put, so the clip player keeps its bind pose.

### Clothing shells

Rules, in order:

1. Garments are worn over the body. The naked meshes stay. Overlap is acceptable.
2. Every garment is a closed block or a straight tube, double-sided where a face is open (a hood, a vest front, a neck hole). A tank, tee, shirt, or hoodie is one straight block. Its width comes from the shoulder span and its depth from the chest, with about 2 cm of ease (1.5–3 cm, scaled by height) off the widest part it covers. It hangs from the shoulders past the waist to just below the hips, with no waist taper. The hem may widen by about a centimetre. The shoulder line drops a little from the neck to the shoulder ball. Sleeves are straight tubes a bit wider than the arm, overlapping the ball, parented to the arm joint. Pant legs are straight tubes of one width from thigh to shin.
3. Shells hang off the body in a regular fit. They are not shrink-wrapped and they are not oversized. Corners are lightly beveled.
4. A hoodie or jacket is about 1 cm roomier than the tee. A vest sits just over the top. The front may be open if the edge stays closed geometry. The top stays underneath. A vest has no sleeves. A cape is a slab hanging from the shoulders, parented to `waist`. There is no dress part. A dress look is a top plus a skirt. When `body.torso` is `robot`, top and outer are `none`.
5. Shoes fit the feet with a small margin, and they have a sole. The feet stay. Heel and toe markers stay on the ankle, at the sole, so planting does not change.
6. Pants and shorts skip a peg leg. The waist block sits at the pelvis with a modest margin. Leg tubes are straight and a bit wider than the thigh, and the shin tube matches the thigh (straight-leg, not tapered). A skirt is a modest A-line from the waist, still wide enough for the walk stride (hip span plus thigh radius plus the gap).
7. Hair under a covering hat (cap, beanie, hat, helmet) or a hood is not drawn. A headband leaves the hair. Headwear wins over a hoodie hood.
8. No `polygonOffset`.
9. Robot and skeleton limbs keep their own meshes. Sleeves and pant tubes are skipped on those sides, and the garment is not rejected. Peg legs skip pant tubes and shoes. A robot leg skips the pant tube and the boot cuff, and still takes a shoe in place of the foot. A robot torso still cannot wear a top or an outer layer.

### Params flowing into parts

`resolveParams` grows one field, `bellyWidth`, in metres. It widens the lower chest and the upper pelvis. It does not move hip or shoulder joints. Shoulder and hip sliders keep their current meaning (ball-center distance). Approved: belly is mesh width only.

Body type and sex are presets that write `shoulderWidth`, `bellyWidth`, `hipWidth`, and `limbThickness`. After a preset, the sliders still edit those numbers. Proposed defaults at height 1.8, before the user drags:

| Preset | Shoulder | Belly | Hip span | Limb thickness |
| --- | --- | --- | --- | --- |
| man | 0.42 | 0.20 | 0.16 | 1 |
| woman | 0.36 | 0.22 | 0.20 | 0.92 |
| slim | ×0.96 shoulders | ×0.85 belly | ×0.95 hip | 0.8 |
| average | man or woman row | | | |
| broad | ×1.12 shoulders | ×1.05 belly | ×1.05 hip | 1.05 |
| heavy | ×1.05 shoulders | ×1.45 belly | ×1.15 hip | 1.25 |

`slim` / `broad` / `heavy` multiply the sex row. Height still scales every derived length, including belly.

Per-limb type may scale that limb’s radii only. Muscular is about ×1.3. Skeleton is about ×0.55. The joint ball radius matches the segment it joins, so the ball still fills the wedge. Arm and leg color `null` means skin.

### Color and draw calls

Pool `MeshStandardMaterial` by `${flat|smooth}:${hex}`. Skin is one flat and one smooth. A tee in `#3a5a40` shares that material with a backpack of the same hex.

Shoes are the two-color part: sole uses `accent`, upper uses `color`, still one mesh (two materials, two groups). Hair is one hex. Everywhere else is one color.

The naked body is already about 30 meshes because the tubes and balls are separate objects sharing two materials. Leave that. Do not introduce `BatchedMesh` in v1. Added parts are one mesh each, so a fully dressed figure is on the order of 40 meshes and a handful of materials (skin plus each distinct hex). That is the draw-call budget.

Dressed vertex cap: **under 2200** with every slot filled, and lower than 1421 when clothes replace the chest and limbs. Tests should assert the cap and assert that a tee’s scene contains no `chestMesh`.

## 3. Part list

Budgets are for the new or replacement mesh, not the whole figure. “Replaces” means those body meshes are omitted.

### Head

| Slot | Id | Build | Verts |
| --- | --- | --- | --- |
| `head.shape` | `classic` | Current 9-ring lathe, 8 segments, 1.08× deep. The chin ring stays the neck socket. | 81 |
| | `round` | 8×5 sphere, scaled to `headSize`. | 54 |
| | `long` | Same lathe with Y scaled about 1.25 and XZ about 0.9. | 81 |
| | `box` | Closed box, slightly wider than the neck. | 8 |
| `head.hair` | `none` | | 0 |
| | `buzz` | 4-ring cap lathe just outside the skull. | ~40 |
| | `bob` | Cap plus an 8-side flare to the jaw. | ~48 |
| | `ponytail` | Cap plus one box down the back. | ~48 |
| | `long` | Cap plus one open box to the waist. | ~56 |
| | `afro` | 8×5 sphere larger than the skull. | 54 |
| `head.facialHair` | `none` | | 0 |
| | `moustache` | One box proud of the upper lip by about 6 mm. | 8 |
| | `beard` | Jaw strap: a tapered open box around the chin, same gap. | ~16 |
| `head.headwear` | `none` | | 0 |
| | `cap` | 8-side crown plus an 8-vert brim. | ~24 |
| | `beanie` | Short lathe cap. | ~40 |
| | `hat` | Crown tube plus an 8-quad brim. | ~32 |
| | `helmet` | Box over the skull, open at the face. | ~24 |
| | `headband` | 8 quads around the brow. Hair stays. | 16 |

`head.size` is the existing `headSize` (lathe origin to crown). All head parts parent to `neck` and scale with it. No eyes, nose, mouth, or brows.

### Body

| Control | Values | Effect |
| --- | --- | --- |
| `body.presentation` | `man`, `woman` | Preset row above. |
| `body.type` | `slim`, `average`, `broad`, `heavy` | Multiplies that row. |
| sliders | height, shoulder, belly, hip, skin | Live `setParams`. |
| `body.torso` | `normal` | Current beveled chest and pelvis. 72 + 72. |
| | `robot` | Two open 4-side boxes into the waist ball, plus a small yoke so the shoulders still meet the chest. Balls stay. | ~40 |

### Arms, each side

| Slot | Id | Build | Verts |
| --- | --- | --- | --- |
| type | `normal` | Current tapers. | 18 + 18 |
| | `muscular` | Same tapers, radii ×1.3, balls matched. | 36 |
| | `robot` | Open 4-side boxes, diagonal inside the ball. | ~20 |
| | `skeleton` | 4-side tapers at ×0.55, balls matched. | ~20 |
| hand | `open` | Current paddle. | 13 |
| | `fist` | Short box inside the wrist ball. | 8 |
| | `claw` | Three thin boxes. | 24 |
| | `hook` | Two 4-side segments and a tip. | ~16 |
| wrist | `none` | | 0 |
| | `band` | 8-side ring around the wrist ball. | 16 |
| | `cuff` | Wider ring. | 16 |

`color` on the arm paints that arm’s tubes, hand, and the shoulder, elbow, and wrist balls. `null` uses skin.

### Legs, each side

| Id | Build | Verts |
| --- | --- | --- |
| `normal` | Current thigh, shin, foot, three balls. | 18+63+18+63+63 |
| `robot` | Open 4-side thigh and shin, foot kept, balls matched to the boxes. | ~20 + 63 foot |
| `peg` | One tube from hip to ankle, parented to the hip. Knee and ankle rotations locked at 0. Knee ball, shin, ankle ball, and foot omitted. Nub of 8 verts at the ankle. Heel and toe markers on the nub. | ~26 |

Leg `color` defaults to skin. `robot` defaults to `#b7b7b7` when color is omitted.

### Clothing

| Slot | Id | Build | Covers | Verts |
| --- | --- | --- | --- | --- |
| top | `none` | | | 0 |
| | `tank` | Open box from shoulder line to waist. | chest | ~24 |
| | `tee` | That box plus sleeve tubes to mid upper arm. | chest, upper arms | ~56 |
| | `shirt` | Box plus sleeves to the wrist. | chest, both arm tubes | ~72 |
| | `hoodie` | Shirt plus a hood shell. Hood suppressed if headwear is set. | chest, arms | ~100 |
| outer | `none` | | | 0 |
| | `jacket` | Larger box shell and sleeves to the wrist. Replaces the top’s torso and sleeves. | chest, arms | ~80 |
| | `vest` | Short box, no sleeves. Top sleeves remain. | chest | ~24 |
| | `cape` | Two quads from the shoulder line, behind the back. | nothing | 8 |
| bottom | `none` | | | 0 |
| | `pants` | Pelvis box plus a tube per normal leg to the ankle. Peg side skipped. | pelvis, thighs, shins | ~80 |
| | `shorts` | Pelvis box plus thigh tubes. | pelvis, thighs | ~48 |
| | `skirt` | 8-plane cone, hem past the walk envelope. | pelvis | 16 |
| shoes | `barefoot` | Current ellipsoid. | | 63 |
| | `sneakers` | Box upper plus a sole slab. Replaces the foot. | foot | ~16 |
| | `boots` | Shoe plus a shin cuff into the ankle ball. | foot, lower shin | ~28 |
| | `flats` | Thin sole slab. | foot | 8 |

Each of these has `color`. Shoes also have `accent`.

### Back and hands

| Slot | Id | Build | Verts |
| --- | --- | --- | --- |
| `back` | `none` | | 0 |
| | `bag` | Box at one hip, on `back`. | 8 |
| | `backpack` | Box behind the chest, gap of about 1 cm, on `back`. | 8 |
| | `wings` | Two quads each side. | 16 |
| `hands.left`, `hands.right` | `none` | | 0 |
| | `phone` | Box in the grip socket. | 8 |
| | `cup` | 6-side tube. | ~14 |
| | `book` | Box. | 8 |
| | `stick` | Thin box along the forearm side of the hand. | 8 |
| | `balloon` | 6×4 sphere on a 4-side string. | ~35 |

One `back` slot is approved, so wings and a bag are not worn together. Held items parent to `gripL` / `gripR` and inherit the wrist. Approved: a held item turns an `open` hand into a `fist`. `hook` and `claw` stay, and the item sits in the palm offset.

### Animation slots

| Slot | Id | Meaning |
| --- | --- | --- |
| `animation.dance` | `none` or any dance id in `ANIMATIONS` | Saved on the character. The preview selects it on load and can still play every clip. |
| `animation.walkStyle` | `normal`, `stomp`, `swagger` | Gait parameters used when the clip is idle, walk, run, or crouch. |

`stomp`: higher knee lift, shorter stride, elbows held near 0.6 rad, little wrist, stronger vertical bob. `swagger`: more pelvis yaw and roll, wider hip abduction, larger opposite arm swing. Both are tables next to the current walk and run numbers. They do not change bone lengths.

## 4. JSON

Version 1. Unknown part ids fail validation. Missing slots fill from defaults (`classic` head, `normal` torso and limbs, `open` hands, `none` clothes and props, `man` / `average`, `none` dance, `normal` walk). Colors are `#rrggbb`. Lengths are metres. `null` color means skin.

```json
{
  "version": 1,
  "body": {
    "presentation": "woman",
    "type": "average",
    "height": 1.7,
    "skin": "#e4c29a",
    "shoulder": 0.34,
    "belly": 0.21,
    "hip": 0.19,
    "torso": "normal"
  },
  "head": {
    "shape": "round",
    "size": 0.24,
    "hair": { "style": "bob", "color": "#2a2118" },
    "facialHair": "none",
    "headwear": { "id": "beanie", "color": "#1d2a3a" }
  },
  "arms": {
    "left": { "type": "normal", "color": null, "hand": "open", "wrist": { "id": "band", "color": "#222222" } },
    "right": { "type": "robot", "color": "#c5c5c5", "hand": "claw", "wrist": { "id": "none" } }
  },
  "legs": {
    "left": { "type": "normal", "color": null },
    "right": { "type": "peg", "color": "#8a5a32" }
  },
  "clothing": {
    "top": { "id": "tee", "color": "#3a5a40" },
    "outer": { "id": "vest", "color": "#1c1c1c" },
    "bottom": { "id": "skirt", "color": "#222222" },
    "shoes": { "id": "sneakers", "color": "#111111", "accent": "#f2f2f2" }
  },
  "back": { "id": "backpack", "color": "#4a3728" },
  "held": {
    "left": { "id": "none" },
    "right": { "id": "cup", "color": "#f4f1ea" }
  },
  "animation": { "dance": "robot", "walkStyle": "swagger" }
}
```

`schema.js` exports `validateDocument(doc)` and `defaultDocument()`. The preview copy button writes `JSON.stringify(character.getDocument(), null, 2)`. Paste goes through the validator before `setDocument`. A robot torso with a top or an outer layer is invalid. `dress` is not a bottom id. A held item coerces an `open` hand to `fist` during validation. Shoe `accent` is the only second color. Older head documents that still name ears, earrings, eyewear, or a hair highlight drop those fields. Retired hair styles (`spikes`, `mohawk`) and headwear (`crown`, `horns`) load as `none`.

## 5. Animation constraints

Joint positions stay on the current bind formula. Upper arm, forearm, thigh, and shin lengths stay whatever `resolveParams` produced. Part meshes are not allowed to move `joints[name].position`. Tests that lock those positions keep running.

Robot limbs and the robot torso only swap meshes and radii. Dance IK, slap, hit, and the clearance pass keep using shoulder, elbow, and wrist.

Peg leg:

- Knee and ankle rotations are forced to 0 after the gait solve.
- The solver treats that leg as one length, thigh + shin, from hip to nub.
- `plantFeet` still reads `footLHeel`, `footLToe`, `footRHeel`, `footRToe`. The peg builder places those markers on the nub sole.
- A one-peg walk uses the same phase as a two-legged walk. The peg side has no knee flex and a smaller lift. The other leg is unchanged.
- Jump tuck skips the peg knee.

Walk styles plug in where the clip already picks `WALK` and `RUN`. Style scales lift, stride, pelvis yaw, arm swing, and elbow bend. Speed still crossfades walk into run inside the style. Idle look-around and breathing stay.

Held items and wrist bands are children of the wrist, so slap, dances, and hit carry them. The clearance pass gains the prop’s corners as sample points, using the same head and block tests it already runs on the paddle. No per-item animation. A stick does not get a swing of its own.

The 120° pose test stays exact: `separateLimbs` still bails out when nothing intersects, and the pose clip does not run peg logic on a normal leg.

## 6. Creator UI

Keep one page. Replace the loose slider stack with sections generated from the registry, so a new part shows up without a new HTML block.

Sections, each a `<details>`:

1. Body. Presentation, type, torso, skin, height, shoulder, belly, hip.
2. Head. Shape, size, hair style, hair color, facial hair, headwear, and the color inputs those parts declare.
3. Arms. Left and right columns: type, color, hand, wrist.
4. Legs. Left and right: type, color.
5. Clothes. Top, outer, bottom, shoes, colors.
6. Gear. Back, left held, right held.
7. Motion. Default dance, walk style, then the existing clip `<select>` and speed slider. Wireframe and turntable stay under this section.

The stats line stays. Add Copy JSON and Paste JSON. A preset change writes the sliders, then the sliders mark the document as custom so the next drag does not snap back to the preset.

Limb thickness stays available as a debug field on the document, not a primary slider. The height slider keeps scaling shoulder, belly, hip, and head size together. Dragging one of those afterwards pins it, which is what `setParams` already does for shoulder and hip.

## 7. Build order

Five PRs, each stacked on this branch’s mannequin, each with preview controls for what it adds and `npm test` green. Vertex count of the naked default stays 1421. New ceiling tests use the dressed cap.

### PR A. Registry and document

Slots, `registerPart`, `validateDocument`, `createCharacter` wrapping today’s body as the default parts, sockets present but empty, copy and paste JSON, panel sections with only the controls that already exist plus the raw JSON.

Effort: small. New files, thin changes to `createBody` and `main.js`.

Risk: getting the JSON shape wrong. Lock it with the example above before meshes land.

### PR B. Proportions, limb variants, walk styles

Belly, presets, robot torso, per-side arm and leg types, four hands, peg planting, `stomp` and `swagger`.

Effort: large. `params.js`, `createBody.js`, `geometry.js`, `animate.js`, and the gait tests.

Risks: a square robot segment poking out of an 8×6 ball (keep the box diagonal inside the ball). A peg sole sinking (markers on the nub, same `plantFeet` path). A muscular shoulder ball swallowing the chest corner (cap the scale, match the ball to the tube). Skeleton shoulder ball looking detached (do not shrink the shoulder ball below the chest contact radius).

### PR C. Clothing compositor

Top, outer, bottom, shoes. Cover rules, one mesh per garment, seam at the balls, skirt wide enough for the walk.

Effort: medium. Mostly new geometry plus tests that covered roles are absent and that samples of the shell sit outside the old block.

Risk: a tight skirt meeting the thigh during a stride. Size the hem from the gait envelope, not from the bind pose. Jacket plus tee double-drawing the chest if the compositor is skipped. One function owns the torso.

### PR D. Head parts

Four shapes, six hair styles (`none`, `buzz`, `bob`, `ponytail`, `long`, `afro`), facial hair, and headwear (`none`, `cap`, `beanie`, `hat`, `helmet`, `headband`). A covering hat or a hood suppresses hair.

Effort: medium. All parented to `neck`.

Risk: hair coplanar with the lathe. Every hair and hat vertex stays at least 6 mm outside the skull radius at that height. Facial hair uses the same gap. `box` and `round` heads need a skull radius for that test, stored on the shape.

### PR E. Back, held items, wrist items

Bag, backpack, wings, five held ids, band and cuff. Clearance samples include prop corners. Fist-on-grip rule.

Effort: medium.

Risk: a balloon or stick in the flail clip. The existing clearance pass has to see the prop, or the prop is limited to a short palm box. Prefer extending the pass.

### Decisions

1. One `back` slot. Wings and a bag are not worn together.
2. V1 head catalogue is four shapes (`classic`, `round`, `long`, `box`) and six hair styles (`none`, `buzz`, `bob`, `ponytail`, `long`, `afro`). No ears, earrings, or eyewear.
3. A robot torso cannot wear a top or an outer layer. Those ids disable themselves, and validation rejects anything other than `none`.
4. No `dress` part. Bottom is `none`, `pants`, `shorts`, or `skirt`. A dress look is a top plus a skirt.
5. Belly changes mesh width only. Hip joint spacing stays on the hip slider.
6. The default dance is stored on the character. The preview can still play every clip.
7. Holding an item turns an `open` hand into a `fist`. `claw` and `hook` stay.
8. Shoe `accent` is the only second color. Every other part is one hex.
