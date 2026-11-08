# Tiny City Builder

A foundation for games set in a small Japanese town, in a PS1 look, made with
three.js. It is a set of reusable modules (buildings, street props, people,
cars, cats, walking, collisions, the PS1 render step) for the owner and AI
agents to build games on. **Agents: read `SKILLS.md`.**

## The viewer

`npm install && npm run dev` opens a viewer with three modes:

- **📦 Catalogue** (home): every item a game can place, in tabs (Buildings,
  Street, Traffic, Extras, Nature, Animals, Vehicles, Areas). Tap one to turn
  it around, try its types, colours and looks, and copy the `createAsset(...)`
  line that builds it. 🎲 New look gives a really different building (shape,
  height, roof, layout), not just a new colour. The cat has Still / Walk / Run.
- **👤 Characters**: the character creator (Body, Hair & face, Clothes,
  Accessories; Still / Walk / Run preview). Body types Man, Woman, Boy, Girl,
  Grandpa, Grandma; ready-made Looks in the Clothes tab (office worker,
  police officer, delivery worker, ...). **⬇ JSON** saves the character as a
  file, **⬆** opens one. Games may use these characters, or not.
- **🏙 City**: walk a generated sample town as your character, with people,
  cars, motorbikes and cats. 🎲 makes a different town, ☀ changes the time of
  day (at night windows, signs and lamps glow), 🌤 the weather (rain: people
  open umbrellas; snow), 🎥 (or V) switches third person / isometric (Q / E
  rotate); in the iso view people behind buildings show as silhouettes (you
  in yellow). WASD / arrows, Shift to run, a joystick on touch screens.

## Docs

- `SKILLS.md`: how to build a game on this foundation and how to extend it.
- `PLAN.md`: goals, decisions, what is done, ideas for next.
- `STYLE_GUIDE.md`: how everything must look.
