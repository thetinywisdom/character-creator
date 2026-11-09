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

## 2. Colour: the palette (a rule)

**Everything uses one palette** (`PALETTE` in `src/styles/palette.js`, also in
the Catalogue's 🎨 Palette tab):

- **Greyscale:** muted and monotone, greys and off-whites.
- **Pastels:** soft, a little dusty.
- **A few muted darks** for contrast (roads, trousers, leaves, wood).
- **No bright or shocking colours.** No saturated reds, pure yellows, neon.

| Group | Colours |
|---|---|
| Greyscale | Off white `#f2efe8`, Paper `#e4e0d6`, Light gray `#cfccc4`, Stone `#b3b0a8`, Gray `#918f8a`, Slate `#6f747a`, Charcoal `#4a4d52`, Ink `#2f3236` |
| Pastels | Blush `#e8c8c4`, Dusty rose `#c99c98`, Peach `#ecccb0`, Apricot `#dcb08c`, Butter `#ece0aa`, Sand `#d8caa8`, Sage `#b6c6a6`, Mint `#c4dccf`, Seafoam `#9fbfb6`, Sky `#bcd2e0`, Powder blue `#9fb6cc`, Lavender `#c9c2dc`, Lilac `#a99dbf` |
| Muted darks | Moss `#8aa082`, Denim `#7d93ab`, Navy `#56647a`, Tan `#b89e80`, Cocoa `#8a7462`, Walnut `#66584c` |
| Buildings only | Brick `#9e6c60` |

**How it is enforced:** every material colour is snapped to the nearest
palette colour in the style (`snapColor`: loud colours are tamed first, so a
red sign becomes dusty rose, not grey), and every painted texture (signs,
shop interiors, curtains, office facades) is snapped pixel by pixel
(`paletteCanvas`). A model can ask for any colour and still lands on the
palette. **Skin tones are the one exception** (kept natural). Light masks for
night glow are not snapped (they are not seen as colours).

- **Buildings are stricter** (like Japanese townscape rules that keep
  colours natural): walls, roofs, concrete and wood use only the greyscale,
  **Brick** `#9e6c60` and the wood browns (Tan, Cocoa, Walnut). No yellow,
  pink, blue or green buildings. Signs, awnings, noren and shop goods keep
  the pastels. Enforced: the `building`, `buildingAlt`, `roof`, `concrete`
  and `wood` roles snap to `BUILDING_PALETTE`.
- **Sky:** the palette's Sky `#bcd2e0`.
- **Signs:** the text is always readable: if the snapped text and board are
  too close in lightness, the text becomes Ink or Off white. Sign faces glow
  only a little by day (or the text washes out) and fully at night.
- **Characters** pick from `CLOTH_COLORS` / `HAIR_COLORS`: the same names as
  before (saved characters still work), now palette colours (Red = Dusty
  rose, Blue = Powder blue, Yellow = Butter, Black = Ink, ...). Characters
  stand out by value contrast (light top, dark trousers) and their outline,
  not by loud colour.
- To add a colour, add it to `PALETTE` (and keep it muted or pastel).

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
  On top of that, a light stretch (`anim/skirt.js`, reusable for any skirt
  built the same way): each frame the hem is pushed out to clear each knee
  and lifted when a knee rises above it, fading to nothing toward the waist
  and away from the knee. Light on purpose (it never fully wraps the knee);
  nothing moves at rest, and only the skirt's few dozen vertices change.

## Character rules

Six body types: **Man, Woman, Boy, Girl, Grandpa, Grandma**. Grandparents are
a little shorter (Grandpa 1.64 m, Grandma 1.5 m), stand with a **gentle stoop**
(~11° forward at the hips, head tilted back up, kept while walking), have grey
or white hair and walk slowly in the city (0.6–0.8 m/s); Grandpa's default
design has a flat cap, cardigan, moustache and walking stick, Grandma's a bun,
cardigan, skirt and shopping bag. Grandma uses the woman's body shape. Children (about 8 years old) are
~1.27 m and 5.8 heads tall, with short legs, narrow shoulders and a straight,
soft torso (no waist, no V, no chest sculpting). Switching between an adult
and a child body type brings the matching proportions.

**Default designs.** Each body type has its own default design, applied when
it is picked (skin tone is kept) and by Reset: Man (side-part hair, white
shirt, navy trousers), Woman (long hair, pink long-sleeve top, navy skirt),
Boy (messy hair, yellow T-shirt, navy shorts, black school bag) and Girl
(twin tails, white T-shirt, red skirt, red school bag), with their
proportions. School bags follow the randoseru custom: black for boys, red for
girls.

**Builds:** Skinny, Normal, Bulky, Fat, on top of the proportion sliders.
Skinny: narrower and thinner everywhere. Bulky: broad shoulders, thick arms
and legs, stronger pecs and neck. Fat: a wide waist, a round belly, deeper
torso, thick limbs (wrists and ankles stay slimmer) and a slightly fuller
face; heavier builds hold their arms further out. Children get a softer
version of each. Clothes and accessories follow the body surface, so they fit
every build. (The old Chibi / Stylized / Realistic presets are gone; the
Heads tall slider still changes proportions.)

Options that make sense together (`src/subjects/human/rules.js`, one list used
by the control panel, the randomizer, the crowd, the city and build()):

1. Women and girls: no beard, no moustache.
2. Men and boys: no skirt.
3. Men and boys: no crop tops.
4. The "Body shape (woman)" controls only show for women.
5. Neck tie and bow tie only with a shirt (they need a collar).
6. No facial hair on children, or on child-like proportions (< 4.5 heads tall).
7. Children don't carry a baby.

The panel hides controls that don't apply and narrows dropdowns to allowed
options. Anything a change makes invalid falls back to a sensible value: beard
to None, skirt to trousers, crop top to the matching T-shirt, tie to None.
About one in six random characters is a child.

- **Shirts:** the collar is the shirt's own colour; the front has a row of
  five small round buttons in a contrast colour, laid on the shirt surface (a
  continuous dark strip read as a tie).

- **Uniforms and robes:** sailor uniform (セーラー服: navy collar flap on the
  back with a white trim line, navy V on the front, red scarf bow; women and
  girls), gakuran (学ラン: closed stand-up collar, five gold buttons; men and
  boys), yukata (浴衣: robe to the ankles, crossed front left over right with a
  contrasting edge, wide sleeves, obi sash in the legwear colour with a bow at
  the back; legs drawn in the robe colour, like the skirt trick).
- **Apron:** a bib apron on the chest, tied at the waist, hanging to mid thigh.
- **In the hand** (right hand, swings with the arm): shopping bag, briefcase,
  closed umbrella carried point-down.

## 3d. Outerwear and accessories

- **Outerwear** is a second, slightly bigger layer that follows the torso
  profile and sculpting (so it fits both body types), with thicker long
  sleeves. Cardigan and jacket are open at the front so the top shows; the
  hoodie is closed, with the hood folded on the upper back.
- **One back item** (backpack, angel wings, evil wings) and **one body item**
  (fanny pack, neck tie, bow tie, baby carrier). Wings are deliberately big:
  they are silhouette items, and flap slowly and gently all the time (a little
  faster when running). The baby is just a round head in the carrier.
- **Everything worn sits on the real body shape:** straps, ties, shirt buttons and
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

## 3e-00. Streets

- Roads are 6 m wide (two narrow lanes) between 40 m blocks with 3 m
  sidewalks: a town should feel small and walkable, not like a highway.
- Zebra crossings: each white bar runs the same way as the traffic, and the
  bars are laid side by side across the road (you walk over them).
- No cars parked at the kerb on these narrow roads (they would block the
  lane); parked cars belong in parking garages and lots.

## 3e-0. Interiors: feel real, not be real

- **Painted interiors:** a shop window shows a small painted picture of the
  inside (shelves of goods, a fridge wall, a counter and clerk, customers,
  lights), one per shop type, drawn once on a canvas and shared by every shop
  of that type (`src/city/interiors.js`). One flat panel per window, no
  modelled items: a whole town costs almost nothing.
- **Painted homes:** upper-floor windows show curtains in four looks (lit or
  dark), varied by position so neighbours differ. Offices and the school keep
  plain glass.
- **Painted facades on big buildings** (`src/city/facades.js`): office towers
  wear a painted window grid on all four sides, one shared tile per facade
  style (glass curtain wall, concrete with punched windows, horizontal bands),
  each bay a lit office with desks and people, blinds down, or dark glass,
  offset per building so neighbours differ. Facades use the normal building
  material so sunny and shaded sides read differently.
- **Big buildings have a base, a body and a top:** towers get a stone podium
  with a lit lobby and a canopy, corner columns, sometimes a set-back top, and
  roof clutter (machine room, water tank on legs, AC units, antenna, railing,
  a company sign). Apartment blocks get a balcony per flat with dividers,
  concrete or railing fronts, painted sliding doors, AC units and laundry or
  futons on some balconies, a mailbox lobby, side windows and roof clutter.
  Shop-with-flats buildings get side windows and roof clutter too.
- Open-fronted stalls (flower shop, fishmonger) get the picture on the back
  wall of the opening; the laundromat keeps its modelled machines.

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

## 3e-1. People content

- **Held items** put the arm in a pose and stay upright whatever the arm does:
  open umbrella (canopy over the head, shaft leaning back), phone at the ear,
  ice cream and take-away coffee at chest height (upper arm down, forearm up),
  a stack of cardboard boxes held in both arms in front of the belly.
  Hanging items (bag, briefcase, closed umbrella, walking stick) swing with
  the arm.
- **Uniforms and hats:** police uniform (light blue shirt, navy vest, gold
  badge) with a peaked police cap (navy top, black band and peak, gold badge);
  suit jacket (closed below the chest, a V with lapels showing shirt and tie,
  one button); straw hat (wide brim, red band); flat cap.
- **Looks** are clothes-only presets (office worker, police officer, delivery
  worker, summer stroll, rainy day, coffee run, on the phone).
- **Cars** look like real cars, not toys (with real ground clearance: the body
  sits on its wheels, nothing dark hangs to the road): built from a side silhouette with
  wheel arches, a cabin narrower than the body, painted roof and pillars,
  door lines and handles, bumpers, lights and mirrors. Kei car (tall 4-seat
  box), sedan, hatchback, 6-seat minivan (sliding door), taxi (tall and
  upright, short sloping nose, square back, fender mirrors, deep navy, roof
  lamp), sports car (small 1970s fastback coupé: long bonnet, round lamps,
  chrome bumpers and sill line, fender mirrors), city bus (window panes,
  doors on the left, lit destination sign, a rear window with the route
  number). No brand logos.
- **Wheels are octagons** on every vehicle (cars, bus, motorbikes, bicycles):
  exactly 8 sides, tyre and hub alike (`wheel()` / `WHEEL_SIDES` in
  `props/util.js`), whatever the detail level.
- **Motorbikes** (no logos), each with its own default colour:
  - *50cc / Delivery:* the three-wheeled delivery scooter: one small wheel in
    front, two close together behind under a rounded pod, a tall leg shield
    with a windscreen, a flat floor, racks front and back (Delivery: strapped
    cardboard boxes on both). White.
  - *Step-through:* the classic business moped: white leg shield sweeping
    down to the floor, a coloured body under the seat, big spoked wheels, a
    big front mudguard, a chrome rack and exhaust, a round mirror. Green.
  - *Motorcycle:* a 1980s sport tourer: half fairing with a screen, tank,
    long seat and tail, the engine and a grey belly pan showing, cast wheels
    with coloured rims, a pinstripe. Black.
  - *Mini scooter:* a tiny folding scooter: a box body up on small wheels, a
    dark side strip, a tall handlebar stem, a little seat on top. Yellow.
- **Cat shape** (after the owner's low-poly reference): natural, not blobs.
  The torso and neck are one lofted, flat-shaded shape (narrow rump, high
  haunches, a slightly dipping back, a tucked waist, a deep chest, a short
  thick neck); the head is big, round and upright on a short neck that flows up into it
  (no ball-on-a-tube seam), with a small
  muzzle low at the front (never a long snout; no eyes or face); big wide
  triangle ears upright at the top corners, pink inside; long slim legs (back legs bent at the hock); the tail hangs back
  from the rump and lifts at the tip. **Cute first:** a big head, a short
  round body, short legs (a natural cat reads stiff and sad when tiny).
  Legs have two joints (shoulder / hip and elbow / hock), so sitting,
  loafing and sleeping fold them under the body instead of swinging them
  out stiff. **Coats** are painted from the palette per square face (never per triangle:
  that gives zig-zag edges), so pattern edges run straight along the body's
  rings or round; calico (the owner's pick) is a mostly white cat with a split apricot /
  charcoal cap on the head, one charcoal patch on the back and an apricot
  tail. Patterns:
  solid, tabby (stripes, light paws), calico (mostly white, split cap, one back patch), tuxedo (charcoal with white chest, belly and paws), bicolour
  (colour on top, white below), points (pale body, dark ears, face, paws and
  tail); inner ears blush. Tails long, curled over the back, or a short bob;
  ears pointed, tufted (dark tips) or folded; short or long (fluffy, with a
  ruff) coat. Poses: sit, loaf (paws tucked), sleep (lying flat on its side, legs loosely
  bent, head resting).
- **Cat:** walks with the cat's lateral sequence (feet a quarter cycle apart),
  head nodding, tail held up and swaying; runs with a bounding gallop (front
  pair, then back pair), the body rocking and the tail lowered behind.

## 3e-2. Trees

Oak, lollipop, pine, old giant, cherry blossom, **Japanese maple** (small,
layered, autumn red), **ginkgo** (tall and narrow, gold), **zelkova** (big
vase-shaped street / shrine tree), **black pine** (leaning kinked trunk, flat
pads of needles), **weeping willow** (round crown, thin curtains to near the
ground) and **bamboo** (a clump of thin green canes with leaf tufts). Parks
mix all of them; shrine groves use old giants, zelkova and pines.

## 3e-3. Atmosphere

- **Night:** a dark blue sky and dim light; windows glow only where a room is
  lit (light masks painted with the textures: curtains, offices), shop
  interiors and sign faces glow, lamps glow brighter, soft warm pools of
  light lie under street lamps. No real extra lights (cheap on phones).
- **Rain and snow are a layer in front of the camera** covering the whole
  view (never a box you can see the edges of, never hidden by buildings),
  but with real-world sizes and density: zoomed in, a few clear drops and
  small flakes (the scene stays visible); zoomed out, many tiny ones. Closer
  in than a 24 m tall view, drops keep the size and number they have there.
- **Rain:** thin pale streaks, slightly slanted; darker, greyer light; about
  three in four people without something in their hands open an umbrella.
- **Snow:** small white flakes drifting down; ground, pavements, grass, roofs
  and leaves turn white, roads stay darker (cleared); bright, cool light.

## 3e-4. Interactions

- **The comic beat of a hit** (after the owner's example): a spiky burst
  (black ink outline, a flashy yellow `#ffd23f` star, a hot pink `#f4508c`
  core, tilted; the one deliberate exception to the palette, for drama) with white pixel
  capitals outlined in ink (SLAP!, WHAP!, SMACK!, SHOVE!, WHUMP!, OOF!,
  WHOOPS!, BONK!), popping big, settling, fading in under a second; then the victim shouts in a speech bubble with
  a small name tag and red (brick) text: censored swearing from aggressive
  people ("You motherf**ker!"), scared lines from calm ones ("Eek!!"); a
  short screen shake.
- **Knocked-over props:** the same burst on impact (CLONK!, BANG!, KRAK!,
  THWACK!); the prop tumbles, bounces once, lies on its side, blinks, and
  vanishes with a POOF! burst and a puff of off-white cubes; it pops back
  in at its place with a small overshoot.
- **Speech bubbles:** pixel font (Silkscreen), off-white with a thick ink
  border, a hard drop shadow, a tail pointing at the speaker, a small name
  tag (YOU for the player); they pop in with a bounce and fade after ~3 s.
- **Slap charge ring:** a ring round your character filling clockwise, green
  to yellow (a slap), then shaking, yellow to red (a power slap).
- **Pie menu:** three round off-white buttons (icon + word) fanned above the
  person's head, popping out one after another.
- **Target ring:** a soft butter ring on the ground under who or what you
  are facing.
- **Banana peel:** oversized butter-coloured peel with a brown tip.

## 3f. Buildings and the city

- **Every seed is a different building.** Of the same kind, but with its own
  shape: shop houses with 0–3 floors of flats above (curtained windows,
  sometimes balconies or AC units), flat roofs with a parapet and roof
  clutter (stair hut, tank, AC units, laundry pole) or pitched tile roofs,
  the door and displays on either side, awnings and signs in a few schemes,
  bikes / boards / planters out front. Colour changes alone don't count.
- **No dead walls.** Backs and sides have windows with curtains in floor rows
  (some small, a few blank), AC units, a back door with a canopy and a bin,
  a drain pipe, and on taller buildings a grey steel fire escape with a
  landing and door per floor. At night these windows light up too.
- **Iso view: see-through people.** People behind buildings show as flat
  silhouettes, blue (the player yellow), so nobody is lost behind a
  building; the same for cats, cars and buses. Each silhouette is one even
  flat tint.

- **Buildings** are boxes with a few strong details, in muted wall colours:
  houses (2 floors, gable tile roof, low block wall, small balcony), apartment
  blocks (balcony slab and railing on every floor), mixed-use buildings (shop
  on the ground floor, windows above, a vertical signboard 縦看板 on the corner),
  glass offices with concrete floor bands. Floors are 3 m.
- **Shops** carry a lit signboard with Japanese text, plus their own detail:
  konbini colour stripes, ramen / izakaya noren and red lantern, café and
  bakery striped awnings.
- **Town layout:** 40 m blocks, 6 m roads, 3 m raised sidewalks, buildings
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

Ink & Cel was the runner-up; it was removed with the other explorations and is
in the git history. To keep a future switch to a small change:

- All style-specific code stays in `src/styles/`. Models never know the style.
- Models stay low-poly (low-poly also looks good with ink outlines).
- Colours come from roles (see above), not from textures.
- If pixel textures are added later, they are optional extras on top of the role
  colours, so a style without textures still works.
