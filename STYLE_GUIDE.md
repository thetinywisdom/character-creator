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
- **Woman:** hourglass torso (narrow waist, flared hips). The chest and bottom
  are **sculpted into the torso surface** (vertices pushed forward / back with
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
- **Footwear:** chunky low-poly shoes or ankle boots (a box foot with a sloped
  toe), not ovals.
- Neck, arm and leg thickness are separate sliders.
- Every top stops at the hip line so the waistband shows and the hip shape
  reads as body.

## 3c. Head items

- **Headwear:** cap, backwards cap, beanie, fedora, headphones, helmet, in any
  clothing colour. Hats that cover the head (cap, beanie, fedora, helmet)
  squash tall hairstyles: under them an afro, bun, spiky or curly style becomes
  short, a mohawk disappears, medium and long hair still show below. Headphones
  sit over any hair and widen for big hair.
- **Face accessories:** glasses, sunglasses, flu mask (oversized lenses and
  frames).
- **Facial hair:** beard (short, long, goatee) and moustache (classic,
  handlebar, thin) are separate slots that combine; both use the hair colour
  and are oversized.

## 3d. Outerwear and accessories

- **Outerwear** is a second, slightly bigger layer that follows the torso
  profile and sculpting (so it fits both body types), with thicker long
  sleeves. Cardigan and jacket are open at the front so the top shows; the
  hoodie is closed, with the hood folded on the upper back.
- **One back item** (backpack, angel wings, evil wings) and **one body item**
  (fanny pack, neck tie, bow tie, baby carrier). Wings are deliberately big:
  they are silhouette items. The baby is just a round head in the carrier.
- **Backpack:** a padded, rounded pack (domed top, thinner at the top, flat side
  against the back) with a darker front pocket, zipper line and top handle;
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
