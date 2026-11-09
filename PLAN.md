# PLAN.md: Tiny City Builder

Where the project is going, what is done, what is next, and the decisions
that shape it. Update this file with every change (see SKILLS.md).

## Goal

A **foundation for the owner's future games**: a small Japanese town and its
people in a PS1 look, as reusable three.js modules, with SKILLS.md teaching
game-building agents how to use them. Not a product for players and not a
city builder: each game builds its own gameplay, UI and editors.

The repo's app is a **viewer** for the owner and agents: 📦 Catalogue (what
exists), 👤 Characters (design, export / import character JSON, optional for
games), 🏙 City (walk a generated sample town to experiment).

## Decisions (agreed with the owner)

| Area | Decision |
|---|---|
| Look | PS1 (low-res pixels, dither, outlines) in one muted / pastel palette |
| Building colour | Walls, roofs, concrete and wood: greys, brick and wood browns only (natural colours, as in Japanese townscape rules) |
| Colour | One palette (greyscale muted and off-white, pastels, a few muted darks), no bright colours; enforced in code (every colour and painted texture is snapped to it; skin excepted) |
| Setting | A small Japanese town; cars drive on the left; Japanese signs |
| Characters | Realistic proportions, no faces, tiny in the city; body types Man, Woman, Boy, Girl, each with a default design; builds Skinny / Normal / Bulky / Fat; the cat drawn 1.5× |
| Character rules | Body types Man, Woman, Boy, Girl, Grandpa, Grandma; no facial hair on women / children; no skirts or crop tops on men / boys; ties need a shirt; sailor uniform for women / girls, gakuran for men / boys; children don't carry babies; yukata hides legwear; no school uniforms on grandparents |
| Character creator | Viewer tool for exploring characters and exporting their JSON; using the characters is optional for games |
| Output | Reusable modules + SKILLS.md. Towns are generated (or written as town JSON) by each game; characters can be exported as JSON |
| Detail | "Feel real, not be real": painted shop interiors, curtains and office facades instead of modelled items |
| App | A viewer only: Catalogue (home) / Characters / City. No city editor, no saved towns, no developer panel (removed: over-complicated) |
| Platforms | Games: web + iOS / Android via three.js wrapped with Capacitor; glTF export as a backup for other engines |
| Buildings | Shops and food places join block fills; public buildings (koban, post office, bank, clinic, fire station, parking, gas station) are placed by games |
| Atmosphere | Night, rain and snow are cheap: shared-material glow with painted light masks, particles that follow the player; no real extra lights |
| Building variety | A new seed must change the shape first (floors, roof, wings, layout), then details, then colour |
| Interactions | E is the action key (pie menu on a person, get on / off a vehicle); clicks mirror it (hold slap, double push, right talk); traits Calm / Aggressive decide reactions |
| Cameras | The city switches between third person and isometric |
| Streets | Roads are 6 m (two narrow lanes), so towns feel small enough to explore; no cars parked at the kerb |

## Done

1. **Style exploration** (phase 1): human, cat, tree; Ink & Cel vs PS1; PS1 · Bright + clear chosen; style guide.
2. **Characters** (phase 2): modular human (hair 25+, facial hair, tops, legwear, footwear, outerwear, headwear, glasses, mask, accessories, hand items), natural walk / run, skirt stretch, wing flap, rules, body types with default designs, builds, street props.
3. **Walkable city** (phase 3): generated town, pedestrians, cars, cats, lighting presets.
4. **A. Foundation**: asset catalogue, city file format, generator / builder split, save & load.
5. **B. City editor** (later removed, see 17).
6. **UI redesign**: app bar with modes, picture palette with cached thumbnails, selected-object card, game-style character creator.
7. **Never lose work**: autosave, My towns (rename, open, duplicate, delete).
8. **Content**: shrine, school, nature tab (incl. cherry blossom), Japanese street props; sailor uniform, gakuran, yukata, apron, hand items; 18 new buildings (laundromat, kissaten, pharmacy, sushi, florist, fishmonger, udon / soba, family restaurant, takoyaki, koban, post office, bank, clinic, fire station, karaoke, wooden apartment, parking garage, gas station).
9. **Making it feel alive**: painted shop interiors for every shop type, painted curtains upstairs, painted office facades, apartment balconies with laundry, roof clutter, rooftop signs.
10. **Isometric camera** in Walk mode (switch with third person; zoom, rotate).
11. **Cheaper walking people**: each person is one skinned mesh with vertex colours sharing one material: ~2 draw calls instead of ~21; a sample town went from 925 to 298 meshes (−68%).
12. **Flicker fix**: shop windows, wooden fronts and crosswalks blinked while walking (z-fighting): 24-bit depth buffer, tighter iso camera range, surfaces kept ≥ 2 cm apart.
13. **Smooth turning**: pedestrians and cars follow routes with rounded corners (people 1.2 m, cars 3 m) instead of snapping 90° in one frame.
14. **Cars in their lane**: a leftover offset from the old ring road pushed cars half onto the pavement; cars now drive in the middle of the kerb-side lane (centre 2.1–2.25 m from the kerb, never on a pavement).
15. **Narrower roads and collisions**: roads 6 m instead of 9 m (no kerb parking on narrow roads); everything solid has a collider; the player can't pass through things, cars, people or cats; pedestrians step round things and each other; cars brake for people and cars ahead.
16. **Zebra crossings the right way**: bars run with the traffic, laid side by side across the road (fixed in the prop, so saved towns are fixed too).

17. **Simplified to a foundation + viewer**: removed the city editor, My towns / autosave, town save / open, the developer panel and lil-gui. The app is now Catalogue / Characters (⬇ JSON export, ⬆ import) / City. Shared PS1 render step moved to `src/render/ps1.js`. SKILLS.md rewritten for game-building agents.

18. **Cat animation**: walk (lateral sequence) and run (bounding gallop), head and tail; city cats wander and sometimes dash; the cat is in the catalogue (Animals) with Still / Walk / Run and fur colours.
19. **People content**: Grandpa and Grandma body types (stoop, slow walk, walking stick); suit jacket, police uniform; straw hat, flat cap, police cap; held items with arm poses (open umbrella, phone, ice cream, coffee cup, boxes in both arms); a Looks row (office worker, police officer, delivery worker, ...); motorbikes (delivery scooter, step-through moped, motorcycle) parked round town.
20. **More trees**: Japanese maple, ginkgo, zelkova, black pine, weeping willow, bamboo (parks and shrine groves use them).
21. **Atmosphere**: lit night (windows, signs, shop interiors, lamps and light pools, via light masks, no real lights), rain (streaks, darker light, people open umbrellas), snow (flakes, white ground, roofs and trees). City buttons ☀ (time of day) and 🌤 (weather).

22. **Real variety per seed**: every building's New look changes shape, height, roof, layout and details, not only colour (shared helpers in `city/variety.js`): houses (1–3 floors, roof types, wing, carport, front wall / hedge), shops (flats above, roofs, door side, awnings, things out front), civic buildings (heights, layouts, sign schemes, modern / classic koban, gas station pumps and car, shrine gates and side buildings, school wings and gym).
23. **Iso silhouettes**: people hidden behind buildings show as flat silhouettes in the iso view (the player in yellow).

24. **Rain and snow as a camera layer**: they were a box following the player (its edges showed and buildings hid it); now faked around the camera (drawn on top, covering the whole view) with real-world sizes and density, so zooming in stays clear (a screen-sized version hid everything when zoomed in); third person uses the same logic, sized for the view at the player.

25. **Real car shapes**: cars rebuilt from side profiles (wheel arches, cabin, pillars, bumpers, lights, mirrors): kei car, sedan, hatchback, minivan, taxi (modern tall Japanese taxi), sports car (1970s fastback coupé), city bus; buses join the traffic; per-vehicle sizes for collisions and braking.
26. **Silhouettes for everything that moves**: cats, cars and buses also show through buildings in the iso view; silhouettes are an even flat tint.

27. **Lively backs and sides**: every building's bare back and side walls get windows (lit at night), AC units, back doors, drain pipes and fire escapes, found automatically (`city/backs.js`).

28. **The palette**: one muted / pastel palette (27 colours, Catalogue 🎨 Palette tab); every material and painted texture snapped to it; clothes and hair lists remapped; readable sign text; sign faces no longer washed out by day.

29. **Natural building colours and real motorbikes**: buildings snap to greys, brick and wood browns only; motorbikes rebuilt from the owner's references (three-wheeled 50cc / delivery scooter, step-through moped, 1980s sport tourer, new mini folding scooter).

30. **Better cats**: new shape (chest, waist, haunches, neck, cheeks, jointed legs), coat patterns from the palette (solid, tabby, calico, tuxedo, bicolour, points), tail types (long, curled, bobtail), ear types (pointed, tufted, folded), long fluffy coat, resting poses (sit, loaf, sleep); city cats each look different and rest when they stop.

31. **Natural cat shape**: rebuilt after the owner's reference as continuous flat-shaded lofted shapes (torso + neck, head), big triangle ears, slim legs, a low tail; patterns paint in bands.

32. **Cute cats that fold their legs**: elbow and hock joints so sit / loaf / sleep tuck the legs under; cuter proportions (bigger head, shorter round body, shorter legs).

33. **Character interactions**: calm / aggressive traits; slap, push and talk (Sims-style pie menu on E or click, plus shortcuts F / G / T and mouse hold / double / right click) with reactions (run away, slap back and chase, push back), chat bubbles and comic bursts (SLAP!, WHUMP!, WHOOPS!); banana peels people slip on; riding cars, the bus, a scooter and a bicycle. Iso rotate moved to < and >.

34. **A busier town, step 1**: 66 people with roles (roaming walkers who cross streets, people standing about, bench sitters), distance culling; after a reaction people walk back naturally to their place. Clicks work at any distance (you run over); 50 matched small-talk questions and answers; flashy hit bursts; a push knocks people over and they react.

35. **A busier town, step 2**: queues outside food shops, shop promoters calling out, chatting groups with bubbles, kids in the park, police, suits downtown and school uniforms by schools (~108 people).

36. **A busier town, step 3**: people riding bicycles and scooters in traffic; a bus stop where the bus pulls in, people get on and off (faked).

37. **Charge-ring slap, drifting, jumping**: hold to charge a slap (green-yellow slap, shaking yellow-red power slap); handbrake (Shift / right button) and drifting with skid marks; Space to jump; running builds up speed.

38. **Blackout fix, angrier chases, scared flights**: the City no longer goes black (a crash in collisions; the loop now survives errors). Chasers sprint faster than you, yell, shove you off bikes and give up after 10 s or 300 m; calm people run 300 m along the streets and then walk back.

39. **The bus turns properly**: traffic and the cars you drive turn round the rear axle instead of spinning on their centre; the bus takes wider corners.

40. **Knock things flying**: sandwich boards, planters, parked bicycles and park bins hit by your vehicle fly off (CLONK!), land on their side, blink, go POOF and pop back at their place 5 s after the hit.

41. **Bike crashes**: a crash on a bicycle or scooter throws you off (CRASH!); a bicycle or scooter you hit falls over with its rider, who shouts and then rides on.

## Next (only when the owner asks)

Ideas, not commitments. The owner decides what to add.

1. **More town content**: shopping arcade, train station, temple, more shop types.
2. **Atmosphere extras**: puddles and wet reflections, falling cherry petals, a day / night cycle over time.
3. **Freer layouts** (town JSON version 2): curved / narrow roads, rivers, train tracks.
4. **First game hand-off**: when a game starts, note in SKILLS.md what it needed and missed.

## Known issues and small ideas

- The third-person camera cannot look up at tall buildings (the iso view covers this).

## Open questions for the owner

None right now.

## Answered

- *Player-facing character creator: detailed sliders or presets?* Up to each game. This tool provides the JSON attributes; games build their own creators and decide what players can edit.
- *Can players customise animals?* Same: up to each game.
