# Tiny City Builder

A foundation for games set in a small Japanese town, in a PS1 look, made with
three.js. It is a set of reusable modules (buildings, street props, people,
cars, cats, walking, collisions, the PS1 render step) for the owner and AI
agents to build games on. **Agents: read `SKILLS.md`.**

## The viewer

`npm install && npm run dev` opens a viewer with three modes:

- **📦 Catalogue** (home): the 🎨 colour palette everything uses, and every
  item a game can place, in tabs (Buildings,
  Street, Traffic, Extras, Nature, Animals, Vehicles, Areas), including the
  bus, the bus stop shelter and the banana peel. Tap one to turn
  it around, try its types, colours and looks, and copy the `createAsset(...)`
  line that builds it. 🎲 New look gives a really different building (shape,
  height, roof, layout), not just a new colour. The cat has patterns, tail, ear and coat types, and Still / Walk / Run /
  Sit / Loaf / Sleep.
- **👤 Characters**: the character creator (Body, Hair & face, Clothes,
  Accessories; Still / Walk / Run preview). Body types Man, Woman, Boy, Girl,
  Grandpa, Grandma; ready-made Looks in the Clothes tab (office worker,
  police officer, delivery worker, ...). **⬇ JSON** saves the character as a
  file, **⬆** opens one. Games may use these characters, or not.
- **🏙 City**: walk a generated sample town as your character, with people,
  cars, buses, motorbikes and cats. 🎲 makes a different town, ☀ changes the time of
  day (at night windows, signs and lamps glow), 🌤 the weather (rain: people
  open umbrellas; snow), 🎥 (or V) switches third person / isometric (< >
  rotate); in the iso view people, cats and cars behind buildings show as
  silhouettes (you in yellow). WASD / arrows, Shift to run (it builds up speed), Space to jump, a joystick
  on touch screens.
- **Interactions in the City:** left-click anyone you can see to talk to them
  (you run over first); right-click them, or face them and press **E**, for
  the action menu: **1** Slap, **2** Push, **3** Talk, **4** Fart (the number
  keys also work straight on whoever you face). Hold **1** or hold-click to
  charge a slap: a small dial over their head fills twice. Let go before the
  second round is done for a slap; hold until it is full red and shaking for
  a power slap that launches them. Double-click to push. A push knocks people over, and anyone standing next to them goes down too. Calm people run away;
  aggressive ones get up, chase you and hit back: they run faster than you,
  shout threats and can shove you off a bike or scooter, but give up after 10
  seconds or once you are 300 m away. Calm people run 300 m away along the
  streets, then walk back. **B** (🍌) drops a banana peel. A slap spins them round, a full-charge slap launches them spinning into
  the air, a push sends them flying sumo-style; calm people fall feet over
  head, aggressive ones faceplant. People on benches stay seated when you talk to or slap them. **Q** (💨) farts (you squat and strain first): everyone near you
  falls over, stunned, then runs off. When lots of people talk at once their
  lines float over their heads without covering each other.
  **E** (or hold-click) next to a car, the bus, the scooter or the bicycle
  gets you on; drive with WASD; hold Shift or the right
  mouse button for the handbrake (it stops you going straight; steer while
  holding it to drift). Vehicles pick up speed gradually, the bus slowest; E to get off. Hit a
  sandwich board, planter, parked bike or bin and it goes flying, blinks and
  goes POOF, then pops back 5 seconds later. On a bicycle your legs pedal; you lean into turns on foot, on a bicycle and
  on a scooter. Crash on a bicycle or scooter
  and you fly off; hit someone riding one and they fall over too. You can ride
  any vehicle (cars brake, but step out right in front of one and it hits
  you): parked cars and bikes, traffic, the bus; take one from someone
  and they jump out shouting and run away.

## Docs

- `SKILLS.md`: how to build a game on this foundation and how to extend it.
- `PLAN.md`: goals, decisions, what is done, ideas for next.
- `STYLE_GUIDE.md`: how everything must look.
