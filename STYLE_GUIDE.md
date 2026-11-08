# Style Guide: PS1 · Bright + clear

The look of the 3D world, decided in Phase 1. Everything built from here on
should follow these rules. The live reference is the **PS1 · Bright + clear** row
in the viewer (`npm run dev`), and the code that defines it is `src/styles/ps1.js`
(`ps1Clear`).

## The idea

1990s console 3D (few polygons, chunky pixels, wobbly vertices, dithered colour),
but **bright and clear** instead of murky. The world is a city, and people and
animals are seen **small**, so every rule below serves one goal: **you can always
spot the characters.**

## 1. Rendering settings

| Setting | Value | Why |
|---|---|---|
| Pixel size | **2** (screen drawn at ½ resolution) | Chunky pixels, but tiny figures keep enough detail |
| Vertex wobble | **0.4** | The PS1 shimmer is there without making small shapes unreadable |
| Colour | **15-bit with 4×4 ordered dither** | Authentic banding, no smooth gradients |
| Pixel outlines | **On**: 1 dark pixel where a shape sits in front of something farther away | Separates characters from the background |
| Fog | **Off** | Clear air; distance is shown by size, not haze |
| Lighting | Lambert (simple diffuse), one sun + sky light | Matches the era's flat, vertex-lit look |
| Real shadows | 512 px shadow map (deliberately blocky) | Grounds objects without looking modern |
| Blob shadows | **On for characters**: soft dark disc under people and animals | Reads even when the real shadow is lost |
| Geometry detail | **0.3×** the smooth segment counts | Low-poly everywhere |

## 2. Colour

Colour has a **hierarchy**: characters are vivid, the city is calm.

- **Characters** (skin, clothes, hair, fur): saturation boosted **×1.35**.
- **Environment** (buildings, ground, trees, road): saturation **×0.55** and lightened
  **15%** toward white.
- **Sky**: clear blue `#86c8ef`.

Final colours per role (as rendered by the style):

| Role | Used for | Colour |
|---|---|---|
| `skin` | faces, arms, hands | `#fac089` |
| `cloth` | shirts, tops | `#0078dd` |
| `clothAlt` | trousers | `#213157` |
| `shoe` | shoes | `#713803` |
| `hair` | hair | `#3d2119` |
| `fur` | cat body | `#ee8c00` |
| `furLight` | paws, inner ears | `#fff0db` |
| `bark` | tree trunks, branches | `#9e7e6d` |
| `leaf` | foliage | `#88ba7e` |
| `road` | asphalt | `#7c7e85` |
| `sidewalk` | pavement | `#c4c0b9` |
| `building` / `buildingAlt` | walls | `#cda692` / `#aab5c2` |
| `window` | window bands | `#717a89` |
| `ground` | open ground | `#cac8c3` |

Base colours live in `src/styles/palette.js`; the style applies the hierarchy on top.

**Character colours come from curated lists** in the same file, so crowds stay
harmonious: 6 skin tones (`SKIN_TONES`), 8 hair colours (`HAIR_COLORS`, including
pink and blue) and 15 clothing colours (`CLOTH_COLORS`). Each item picks its own
colour from these lists; the style still applies the character saturation boost.
**New characters should use saturated, contrasting clothing colours**: a character
dressed in the same tones as the street will disappear.

## 3. Modelling rules

1. **Low-poly, built from simple shapes.** Spheres, capsules, cones, boxes. Detail
   comes from silhouette, not from small parts.
2. **No facial features.** Characters have no eyes, nose, mouth or ears; they
   are seen too small for them. **Face accessories are fine** (sunglasses, masks,
   beards): they are shapes and colour blocks, not faces. Personality comes from
   **silhouette, proportions, hair, clothing and accessories**.
3. **Small items are oversized on purpose.** Collars, button strips, straps,
   glasses and similar details are built bigger than real life so they read when
   the character is tiny. A slightly comical look is accepted.
4. **Readable silhouette first.** Check every new model at street distance
   (the "Street distance (tiny)" toggle). If you can't tell what it is from its
   outline, change the shape, not the details.
5. **Real-world scale, in metres.** Human default is 1.6 m and 7.5 heads tall
   (the "Realistic" preset); the cat is modelled at about 0.42 m long and drawn
   1.5× (see §5).
6. **Colour by role, never by style.** Every part asks for a role (`skin`,
   `cloth`, `leaf`, ...) and, for character items, a colour from the curated
   lists. Never hard-code a style-specific colour in a model.
7. **Characters face +z and stand on y = 0.** Parts that will move (the human's
   head, arms and legs; the cat's head) are separate groups pivoting at their
   joints, ready for animation later.

## 3b. Body types

- **Man / Woman** (presets of the same names set matching proportions).
- **Woman:** hourglass torso (narrow waist, flared hips). The chest's profile
  slopes gently down from the collarbone to its fullest point low on the chest,
  with a rounded, heavier underside (never full right under the shoulders).
  The chest and bottom are **sculpted into the torso surface** (vertices pushed forward / back with
  soft falloffs), not separate boxes or balls, so they grow out of the body and
  still look faceted at PS1 polygon counts. Default shape: two soft lobes
  ("Smooth (two)") with size sliders; the older trapezoid chest and round
  bottom remain as options. The torso continues a little below the hip line
  so the bottom sits over the top of the thighs, giving the side view an
  S-curve. Also: rounder shoulders with a gentle slope into the neck and only a
  very slight, wide fullness across the upper back (a strong one reads as a hump); fuller upper arms tapering to the
  elbow and a slimmer, slightly bent forearm; full thighs that start a little
  higher and taper to slim knees; a calf bulge; arms held slightly away from
  the body; longer legs.
- **Man:** a gentle V-shaped torso (narrow hips and waist, a moderate chest and
  squared shoulders; fit, not bulky), very flat sculpted pecs, a thicker neck
  with a trapezius slope (no hump), firm shoulder caps and upper arms, fuller forearms, elbows slightly bent and arms
  held away from the body, straight solid legs with little taper.
- **Shoulders (both):** slope down from the neck in one smooth curve (no flat
  top). The arm's shoulder cap and any sleeve over it sit inside that curve,
  never poking above it.
- **Hands:** blocky and mitten-like (a box, flat side-to-side, narrowing toward
  the fingertips), for both body types.
- **Footwear:** slim, low shoes or ankle boots: a sole-length box that narrows
  and slopes down to a rounded toe (oversized, chunky feet read as bricks).
- Neck, arm and leg thickness are separate sliders.
- Every top stops at the hip line so the waistband shows and the hip shape
  reads as body.

- **Torso depth** shrinks toward the shoulders (about 30% shallower at the
  top): the upper torso is wide but shallow. A uniformly deep torso pushes out
  a hump on the upper back. Anything that sits on the torso (straps, ties,
  belts, hair down the back) uses the same depth-by-height.

## 3b2. Hairstyles

- Three families with variations, so crowds look varied:
  - **short:** crop, side part, buzz cut, undercut, quiff, bowl cut, messy
  - **medium:** straight to the shoulders, bob, curtains (middle part), wavy,
    shag (layered), half-up
  - **long:** straight down the back, ponytail, high ponytail, twin tails,
    braid, wavy, side-swept
  - plus bald, bun, spiky, mohawk, curly, afro
- **No base cap.** Every style grows its own hair from the head shape: its own
  hairline (front, temples, over the ear, nape) and its own thickness map
  (quiff bulging at the front, undercut thin at the sides, bob flaring at the
  bottom...), tapering to the scalp at the hairline so it blends in. Extra
  pieces (tails, buns, braids, curtains, tufts) are added on top.
- **The head is shaped like a head**, not a ball: fuller skull at the back,
  flatter face plane and forehead, a jaw narrowing to the chin, the back of the
  lower head tucking in to the neck. Beards and the flu mask grow from the same
  shape so they fit the jaw.
- **Hair never goes inside the body:** after any style is built, every hair
  point inside the torso (plus ~5 cm for clothes) is pushed out to the torso
  surface at that height. With a hoodie, hair lies over the folded hood; long,
  loose hair hides the hood entirely.
- Hair that hangs down the back keeps clear of the upper back (it must never
  sink into the shirt); ties are small dark bands.

## 3c. Head items

- **Headwear:** cap, backwards cap, beanie, fedora, headphones, helmet, in any
  clothing colour. Hats that cover the head (cap, beanie, fedora, helmet)
  squash tall hairstyles: under them an afro, bun, spiky or curly style becomes
  short, a mohawk disappears, medium and long hair still show below. Headphones
  sit over any hair and widen for big hair.
- **Hats follow the head:** the beanie (pulled down to the brow and over the
  ears, folded cuff, slight slouch, pom-pom) and the helmet (an open bicycle
  helmet: ribbed shell with dark vents, a short peak and chin straps, face
  left open) are shells grown from the head shape with a clean, smooth edge.
- **Face accessories:** glasses or sunglasses, and a flu mask in its own slot,
  so a mask and glasses can be worn together. A mask hides the beard and
  moustache under it.
- **Facial hair:** beard (stubble, short, full, long, goatee, pointed goatee,
  chin strap, mutton chops) and moustache (classic, thin, handlebar, walrus,
  horseshoe) are separate slots that combine. All grow from the head shape
  (like hair) and use the hair colour. Beards start low (below the cheekbones,
  and below the lower lip at the front) so the moustache area stays free and a
  moustache always reads on its own. Stubble is a thin shadow in a colour half
  way between skin and hair, so it looks like hair seen through the skin, not a
  full beard. The handlebar is a full moustache whose ends narrow and curl up
  the cheeks.

- **Skirts in motion:** the skirt hangs from the spine joint, so it leans and
  twists with the hips. The part of each thigh the skirt covers is drawn in
  the skirt colour (an old low-poly trick), so a leg swinging out of the rigid
  skirt reads as fabric stretched over the thigh, not a bare leg poking through.

## 3d. Outerwear and accessories

- **Outerwear** is a second, slightly bigger layer that follows the torso
  profile and sculpting (so it fits both body types), with thicker long
  sleeves. Cardigan and jacket are open at the front so the top shows; the
  hoodie is closed, with the hood folded on the upper back.
- **One back item** (backpack, angel wings, evil wings) and **one body item**
  (fanny pack, neck tie, bow tie, baby carrier). Wings are deliberately big:
  they are silhouette items, and flap slowly and gently all the time (a little
  faster when running). The baby is just a round head in the carrier.
- **Everything worn sits on the real body shape:** straps, ties, plackets and
  packs are placed on the sculpted torso surface (measured, chest and back
  included), never on a plain cylinder. A tie drapes straight down off the
  chest; a pack or carrier rests on the furthest point of the back or front.
- **Backpack:** a padded, rounded pack (domed top, thinner at the top, flat side
  against the back) with a darker front pocket and a top handle;
  straps run from the top of the pack over the shoulder, down the chest, under
  the arm and back to the bottom, joined by a chest strap.
- **Baby carrier:** a soft padded panel, wider at the seat, with a thick waist
  belt and straps over the shoulders to the back. The baby's head shows above
  the panel, hands rest on the top edge and legs dangle from the bottom corners.
- Padded, rounded shapes (`softBox`) instead of plain boxes for bags and carriers.
- Straps, belts and drawstrings use a dark trim colour.

## 3e. Street props (Japan)

- The city is **Japanese**: red post boxes, red hydrants with a 消火栓 sign,
  horizontal traffic lights, inverted-triangle 止まれ stop signs, drink vending
  machines, recycling stations, white guard rails, concrete utility poles with
  overhead wires, kei cars and taxis with a roof lamp, city bikes with baskets.
- Signs, post boxes, hydrants and lamps use the vivid `signage` / `light` roles
  so they stay readable; lamps and traffic-light lenses glow. Sign text is a
  small, hard-filtered canvas texture (90s console look).
- Everything else in the city (buildings, roads, poles, vehicles) stays in the
  calmer environment colours, so characters still stand out.
- Street layout: thin items (poles, lamps, signs) on the curb, bulky items
  (vending machines, bins, benches) against the buildings, parked cars in the
  lane next to the curb.

## 3f. Buildings and the city

- **Buildings** are boxes with a few strong details, in muted wall colours:
  houses (2 floors, gable tile roof, low block wall, small balcony), apartment
  blocks (balcony slab and railing on every floor), mixed-use buildings (shop
  on the ground floor, windows above, a vertical signboard 縦看板 on the corner),
  glass offices with concrete floor bands. Floors are 3 m.
- **Shops** carry a lit signboard with Japanese text, plus their own detail:
  konbini colour stripes, ramen / izakaya noren and red lantern, café and
  bakery striped awnings.
- **Town layout:** 40 m blocks, 9 m roads, 3 m raised sidewalks, buildings
  facing the street; utility poles and wires on one side of each block, lamps
  on the other; crosswalks on every intersection arm; traffic drives on the left.
- **Large flat surfaces are tiled** (about 6 m pieces): PS1 vertex snapping
  distorts huge polygons.

## 3g. Animation

- Characters have real joints: hip → knee → ankle, shoulder → elbow.
- **Natural walk and run** are keyed from classic animation pose sequences
  (contact → down → passing → up → contact, per step), and the lowest heel or
  toe is pinned to the ground so the standing foot stays planted.
  - Walk: contact with the front heel down, toes up and knee nearly straight;
    the weight settles **down** softly just after contact and goes **up** just
    after passing (standing leg straightens, heel lifts). Keep it relaxed: the
    swinging knee bends only ~45°, enough for the foot to clear the ground; a
    higher knee lift or a deeper down reads as marching or stomping. Arms
    swing loosely (~±15°) opposite the legs.
  - Run: 4 steps a second; contact with the leg reaching forward; a deep down
    pose; the back heel tucks high behind on the passing pose; on the up pose
    the push-off leg is fully extended behind and the front knee is high; both
    feet leave the ground for a moment; strong lean (~16° from the hips plus
    ~5° overall) and a big arm swing with bent elbows.
  - Upper body: a **spine joint at the hips** carries the torso, arms and head.
    The lean (~10° running, ~2° walking) happens there, over the legs, not
    around the feet. Pelvis and shoulders counter-rotate (left hip forward,
    right shoulder forward), the head turns back to keep facing ahead and
    tilts up against the lean. Running arms tuck in and come slightly across
    the chest on the forward swing.
- **Roller skate:** the first, sine-based cycle (smooth, gliding legs), kept as
  an option ("Preview animation" and "City movement").
- Walk blends into run with speed, and both fade to a standing pose with a
  slight breathing motion.

## 4. Readability checklist (for any new character)

- [ ] Visible at street distance on the sidewalk, in Day **and** Night lighting
- [ ] Clothing colours contrast with the sidewalk and buildings
- [ ] Gets a blob shadow (`isCharacter: true` on the subject)
- [ ] Silhouette recognisable with outlines on

## 5. Character size

- **People: real size** (1×).
- **Animals: exaggerated where needed to read at street distance.** The cat is drawn
  **1.5× real size** (set with `exaggeration: 1.5` on the subject).
- The viewer's **Extra character size** slider multiplies on top of this, for
  experiments only; the default is 1.

## 6. Keeping a style switch cheap

Ink & Cel was the runner-up and is still in the code (`src/styles/inkCel.js`).
To keep a future switch to a small change:

- All style-specific code stays in `src/styles/`. Models never know the style.
- Models stay low-poly (low-poly also looks good with ink outlines).
- Colours come from roles (see above), not from textures.
- If pixel textures are added later, they are optional extras on top of the role
  colours, so a style without textures still works.
