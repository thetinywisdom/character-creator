# PLAN.md: Tiny City Builder

Where the project is going, what is done, what is next, and the decisions
that shape it. Update this file with every change (see SKILLS.md).

## Goal

A **city builder for future games**. The owner builds small Japanese towns
and their people in a PS1 look; future web, iOS and Android games load those
towns and characters. The builder itself is a tool used only by the owner,
on desktop, tablet and phone, so it must be easy to use by touch and mouse.
The games (not the builder) are what must run well on phones.

**What the tool hands to games: JSON.** Towns (the city file) and characters
(their settings) as plain JSON with every attribute documented. Each game
builds its own creator / editor on top and decides how much players may
edit; that is not this tool's job.

## Decisions (agreed with the owner)

| Area | Decision |
|---|---|
| Look | PS1 · Bright + clear (low-res pixels, dither, outlines, vivid characters on a calmer city). Other styles were explored and removed |
| Setting | A small Japanese town; cars drive on the left; Japanese signs |
| Characters | Realistic proportions, no faces, tiny in the city; body types Man, Woman, Boy, Girl, each with a default design; builds Skinny / Normal / Bulky / Fat; the cat drawn 1.5× |
| Character rules | No facial hair on women / children; no skirts or crop tops on men / boys; ties need a shirt; sailor uniform for women / girls, gakuran for men / boys; children don't carry babies; yukata hides legwear |
| Character creator | The owner's tool for designing characters (game-style UI). Games get the character JSON and build their own creators, choosing what players can edit |
| Output | Everything the tool makes is exported as documented JSON (town files, character settings); games read it |
| Detail | "Feel real, not be real": painted shop interiors, curtains and office facades instead of modelled items |
| App | Named Tiny City Builder; opens in the editor; modes Build / Characters / Walk; developer panel hidden behind ⚙ |
| Platforms | Games: web + iOS / Android via three.js wrapped with Capacitor; glTF export as a backup for other engines |
| Saving | Towns autosave in the browser (IndexedDB) and export / import as JSON files |
| Buildings | Shops and food places join block fills; public buildings (koban, post office, bank, clinic, fire station, parking, gas station) are placed by hand |
| Cameras | Walk mode switches between third person and isometric |

## Done

1. **Style exploration** (phase 1): human, cat, tree; Ink & Cel vs PS1; PS1 · Bright + clear chosen; style guide.
2. **Characters** (phase 2): modular human (hair 25+, facial hair, tops, legwear, footwear, outerwear, headwear, glasses, mask, accessories, hand items), natural walk / run, skirt stretch, wing flap, rules, body types with default designs, builds, street props.
3. **Walkable city** (phase 3): generated town, pedestrians, cars, cats, lighting presets.
4. **A. Foundation**: asset catalogue, city file format, generator / builder split, save & load.
5. **B. City editor**: paint blocks (roads join up), place / select / move / turn / delete / copy, undo, grid size, walk it; touch and mouse.
6. **UI redesign**: app bar with modes, picture palette with cached thumbnails, selected-object card, game-style character creator.
7. **Never lose work**: autosave, My towns (rename, open, duplicate, delete).
8. **Content**: shrine, school, nature tab (incl. cherry blossom), Japanese street props; sailor uniform, gakuran, yukata, apron, hand items; 18 new buildings (laundromat, kissaten, pharmacy, sushi, florist, fishmonger, udon / soba, family restaurant, takoyaki, koban, post office, bank, clinic, fire station, karaoke, wooden apartment, parking garage, gas station).
9. **Making it feel alive**: painted shop interiors for every shop type, painted curtains upstairs, painted office facades, apartment balconies with laundry, roof clutter, rooftop signs.
10. **Isometric camera** in Walk mode (switch with third person; zoom, rotate).
11. **Cheaper walking people**: each person is one skinned mesh with vertex colours sharing one material: ~2 draw calls instead of ~21; a sample town went from 925 to 298 meshes (−68%).

## Next (suggested order)

1. **Builder polish** (from using it): split the Buildings tab (Shops / Food / Public / Homes), stop things overlapping when placed, copy-paste groups, multi-select, rotate in 15° steps, minimap, resize a building's plot.
2. **More people content**: elderly body type (stoop, cane, slower walk), office suit, umbrella-up and phone poses, straw hat.
3. **More town content**: shopping arcade (shōtengai), train station (needs tracks, see 7), temple, more apartment variety, more shop types.
4. **Character JSON for games**: save / open a character as a file, document every character attribute (name, allowed values, defaults, rules) in a format reference games can rely on.
5. **A cast for towns**: save named characters and place them in a town (shopkeeper, resident), stored in the town file.
6. **Atmosphere**: day / night cycle with lit windows and signs, rain with umbrellas, cherry blossom season.
7. **Freer layouts** (town file version 2): curved / narrow roads, different block sizes, rivers and bridges, train tracks.
8. **Game hand-off** (when a game starts): runtime library (`loadCity`, `createCharacter`, walk / traffic data, performance tricks), Capacitor test build for iOS / Android, glTF export, per-asset budgets. Player-facing creators and editors are built by each game.

## Known issues and small ideas

- Shop sign text looks faded in the PS1 look; could be made stronger across all shops.
- The third-person camera cannot look up at tall buildings (the iso view covers this).
- Nothing stops things being placed on top of each other in the editor.
- Browser storage is per device: keep file copies of important towns.

## Open questions for the owner

None right now.

## Answered

- *Player-facing character creator: detailed sliders or presets?* Up to each game. This tool provides the JSON attributes; games build their own creators and decide what players can edit.
- *Can players customise animals?* Same: up to each game.
