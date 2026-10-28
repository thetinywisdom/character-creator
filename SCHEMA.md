# Character definition v2

A character is a plain JSON object with `v: 2`. `normalize(def)` clamps numbers and replaces unknown part ids with the default for that slot, so untrusted JSON is safe to load. `migrate(old)` converts an iso-city v1 def. `defaults(base)` and `randomize(seed)` return v2 objects. `createCharacter` accepts either version.

## Tree

Slots follow this tree. Each slot is a registered part (`registerPart` / `getParts`). Fields in parentheses are options on that part, not extra slots, except where a dotted name is its own slot (`body.torso`, `animation.dance`, `animation.walkStyle`).

| Slot | Id field | Other fields | Built-in ids |
|---|---|---|---|
| `body` | `type` | `base` man/woman, `height` 0.85–1.15, `skin`, `shoulder` / `belly` / `hip` sliders −1..1 | skinny, average, fat, muscle |
| `body.torso` | the string itself | | normal |
| `head.shape` | string | | normal |
| `head.hair` | `style` | `color`, `highlight` | 20 styles, including `none` |
| `head.facialHair` | string | | none, moustache, beard |
| `head.headwear` | `style` | `color` | none, cap, beanie, backcap |
| `head.eyewear` | string | | none, glasses, sunglasses |
| `head.ears` | `style` | `earrings` boolean | normal |
| `arms.left`, `arms.right` | `type` | `color` (null = skin), `hand`, `wrist` | normal |
| `legs.left`, `legs.right` | `type` | | normal |
| `clothing.top` | `style` | `color`, `innerColor` | tee, shirt, hoodie, sweater, tank, blazer, cardigan, coat, blouse, stripetee, none |
| `clothing.outer` | `style` | `color` | none |
| `clothing.bottom` | `style` | `color` | pants, shorts, skirt, dress |
| `clothing.shoes` | `style` | `color` | sneakers, boots, flats, barefoot |
| `back` | `style` | `color` (also the dress waist / v1 accessory colour) | none, bag |
| `hands.left`, `hands.right` | `item` | `color` | none + 15 props (16 ids) |
| `animation.dance` | string | | robot, chicken, disco, sprinkler, flail, hula, flex, mbappe |
| `animation.walkStyle` | string | | normal |

`shoulder`, `belly`, and `hip` are offsets on top of the body type. **0 matches iso-city.** Colours are Comic palette hex strings (`COLORS`, 30 swatches) plus the creator skin list. Hair `highlight` defaults to the npc line colour (`#5B6A7B`), which is what iso-city used for every accent.

Held items in v1 were in the left hand. `hands.right` exists so a later part can put something there; migrated characters keep it `none`.

`extra` is a bag for data the rig does not draw. v1 `lines`, `bubble`, and `home` land here, and so does `id` when the old def had one. The builder uses `extra.id` (else `name`) as the hair random seed.

## Example

```json
{
  "v": 2,
  "name": "NEW GUY",
  "body": {
    "base": "man",
    "type": "average",
    "height": 1,
    "skin": "#B6C2CA",
    "shoulder": 0,
    "belly": 0,
    "hip": 0,
    "torso": "normal"
  },
  "head": {
    "shape": "normal",
    "hair": { "style": "curtains", "color": "#292C2E", "highlight": "#5B6A7B" },
    "facialHair": "none",
    "headwear": { "style": "none", "color": "#2A5B94" },
    "eyewear": "none",
    "ears": { "style": "normal", "earrings": false }
  },
  "arms": {
    "left": { "type": "normal", "color": null, "hand": "normal", "wrist": "normal" },
    "right": { "type": "normal", "color": null, "hand": "normal", "wrist": "normal" }
  },
  "legs": { "left": { "type": "normal" }, "right": { "type": "normal" } },
  "clothing": {
    "top": { "style": "tee", "color": "#2A5B94", "innerColor": "#F0F2F4" },
    "outer": { "style": "none", "color": "#363E47" },
    "bottom": { "style": "pants", "color": "#203A57" },
    "shoes": { "style": "sneakers", "color": "#F0F2F4" }
  },
  "back": { "style": "none", "color": "#FFCC3F" },
  "hands": {
    "left": { "item": "none", "color": "#FF5491" },
    "right": { "item": "none", "color": "#FF5491" }
  },
  "animation": { "dance": "disco", "walkStyle": "normal" },
  "extra": { "lines": ["yo!", "sup?", "nice weather."], "bubble": "", "home": "fountain" }
}
```

## v1 → v2

`migrate` reads the iso-city fields:

`v`, `name`, `gender`, `body`, `height`, `skin`, `hair`, `hairColor`, `hat`, `hatColor`, `top`, `topColor`, `innerColor`, `bottom`, `bottomColor`, `shoes`, `shoeColor`, `acc` (`glasses`, `sunglasses`, `moustache`, `beard`, `earrings`, `bag`), `accColor`, `held`, `heldColor`, `dance`.

| v1 | v2 |
|---|---|
| `gender` | `body.base` |
| `body` | `body.type` |
| `height`, `skin` | `body.height`, `body.skin` |
| `hair`, `hairColor` | `head.hair.style`, `head.hair.color` |
| `hat`, `hatColor` | `head.headwear` |
| `acc.glasses` / `acc.sunglasses` | `head.eyewear` (sunglasses wins if both are set) |
| `acc.beard` / `acc.moustache` | `head.facialHair` (`beard`, else `moustache`, else `none`) |
| `acc.earrings` | `head.ears.earrings` |
| `top`, `topColor`, `innerColor` | `clothing.top` |
| `bottom`, `bottomColor` | `clothing.bottom` |
| `shoes`, `shoeColor` | `clothing.shoes` |
| `acc.bag`, `accColor` | `back.style`, `back.color` |
| `held`, `heldColor` | `hands.left` |
| `dance` | `animation.dance` |
| `lines`, `bubble`, `home`, `id` | `extra` |

Unknown ids and out-of-range numbers are repaired by the same clamps as `normalize`.

## Build order

`createCharacter` runs parts in this order: torso, head shape, ears, arms, legs, bottom, shoes, top, outer, body extras (belly / pecs), hair, headwear, eyewear, facial hair, back, left hand, right hand, walk style, dance. Clothing is allowed to depend on the joints already being there. Body extras run after clothing so the belly picks up the garment colour, matching iso-city.
