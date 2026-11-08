// Character rules: which options make sense together. One list, used by the
// control panel (hides or filters options), the randomizer, the crowd, the
// city and build() itself (so old saved settings are corrected too).
//
//  1. Women and girls: no beard, no moustache
//  2. Men and boys: no skirt
//  3. Men and boys: no crop tops
//  4. The "Body shape (woman)" controls only show for women
//  5. Neck tie / bow tie only with a shirt (it needs a collar)
//  6. No facial hair on children, or on child-like proportions (< 4.5 heads tall)
//  7. Children don't carry a baby
//  8. Sailor uniform for women and girls, gakuran for men and boys
//  9. A yukata reaches the ankles: no legwear choice (its colour is the obi's)
// 10. School uniforms (sailor uniform, gakuran) are not for grandparents
//
// Anything a rule no longer allows falls back to a sensible value: a beard to
// None, a skirt to trousers, a crop top to the matching T-shirt, a tie to None.

export const BODY_TYPES = ['Man', 'Woman', 'Boy', 'Girl', 'Grandpa', 'Grandma'];
/** Body build: how slim or heavy (see frame.js for what each changes). */
export const BUILDS = ['Skinny', 'Normal', 'Bulky', 'Fat'];
export const isChild = (p) => p.bodyType === 'Boy' || p.bodyType === 'Girl';
export const isFemale = (p) => p.bodyType === 'Woman' || p.bodyType === 'Girl' || p.bodyType === 'Grandma';
export const isElderly = (p) => p.bodyType === 'Grandpa' || p.bodyType === 'Grandma';
/** Adult woman's body shape (hourglass torso, chest and bottom sliders). */
export const hasWomanShape = (p) => p.bodyType === 'Woman' || p.bodyType === 'Grandma';
export const isMale = (p) => !isFemale(p);
const SHIRTS = ['Shirt', 'Shirt (long sleeve)'];
const CROP = { 'Crop top': 'T-shirt', 'Crop top (long sleeve)': 'T-shirt (long sleeve)' };
const TIES = ['Neck tie', 'Bow tie'];

/** Can this character have facial hair at all? */
export const canHaveFacialHair = (p) => !isFemale(p) && !isChild(p) && (p.headsTall ?? 7.5) >= 4.5;

/** Options allowed for `key`, given the rest of the character. */
export function allowedOptions(key, all, p) {
  switch (key) {
    case 'beard':
    case 'moustache':
      return canHaveFacialHair(p) ? all : ['None'];
    case 'legwear':
      return isMale(p) ? all.filter((o) => o !== 'Skirt') : all;
    case 'top': {
      const ok = isMale(p) ? all.filter((o) => !(o in CROP) && o !== 'Sailor uniform') : all.filter((o) => o !== 'Gakuran');
      return isElderly(p) ? ok.filter((o) => o !== 'Sailor uniform' && o !== 'Gakuran') : ok;
    }
    case 'bodyAccessory':
      return all.filter((o) => !(TIES.includes(o) && !SHIRTS.includes(p.top))
        && !(o === 'Baby carrier' && isChild(p)));
    default:
      return all;
  }
}

/** Controls (and control groups) that don't apply to this character. */
export function hiddenControls(p) {
  const keys = new Set();
  if (!canHaveFacialHair(p)) keys.add('beard').add('moustache');
  if (p.top === 'Yukata') keys.add('legwear');
  if (!p.handItem || p.handItem === 'None') keys.add('handItemColor');
  const groups = new Set();
  if (!hasWomanShape(p)) groups.add('Body shape (woman)');
  return { keys, groups };
}

const FALLBACK = { beard: 'None', moustache: 'None', legwear: 'Trousers', bodyAccessory: 'None' };

/** Fix up `p` in place so every value is allowed. Returns p. */
export function applyRules(p, schema) {
  for (const [key, def] of Object.entries(schema)) {
    if (!def.options || p[key] === undefined) continue;
    const ok = allowedOptions(key, def.options, p);
    if (ok.includes(p[key])) continue;
    p[key] = key === 'top' ? (CROP[p[key]] ?? 'T-shirt') : (FALLBACK[key] ?? ok[0]);
  }
  return p;
}

// The default design of each body type: proportions and a look of its own.
// Picking a body type applies its design (skin tone is kept); Reset goes
// back to the current type's design.
const PLAIN = {
  build: 'Normal', chestSize: 1, bottomSize: 1, beard: 'None', moustache: 'None',
  headwear: 'None', faceAccessory: 'None', mask: 'None', outerwear: 'None',
  backAccessory: 'None', bodyAccessory: 'None', footwear: 'Shoes',
};
export const BODY_DEFAULTS = {
  Man: { ...PLAIN, headsTall: 7.5, height: 1.75, legLength: 0.54, shoulderWidth: 0.27, hipWidth: 0.18, neckThickness: 0.034, armThickness: 0.029, legThickness: 0.037, headWidth: 0.8,
    hair: 'short · side part', hairColor: 'Black', top: 'Shirt', topColor: 'White', legwear: 'Trousers', legwearColor: 'Navy', shoeColor: 'Brown' },
  Woman: { ...PLAIN, headsTall: 7.5, height: 1.62, legLength: 0.58, shoulderWidth: 0.22, hipWidth: 0.23, neckThickness: 0.023, armThickness: 0.023, legThickness: 0.033, headWidth: 0.78,
    hair: 'long', hairColor: 'Dark brown', top: 'T-shirt (long sleeve)', topColor: 'Pink', legwear: 'Skirt', legwearColor: 'Navy', shoeColor: 'Black' },
  // about 8 years old: a big head (6 heads tall), short legs, narrow shoulders,
  // and a school bag (randoseru: black for boys, red for girls)
  Boy: { ...PLAIN, headsTall: 5.8, height: 1.28, legLength: 0.5, shoulderWidth: 0.23, hipWidth: 0.2, neckThickness: 0.027, armThickness: 0.024, legThickness: 0.033, headWidth: 0.85,
    hair: 'short · messy', hairColor: 'Black', top: 'T-shirt', topColor: 'Yellow', legwear: 'Shorts', legwearColor: 'Navy', shoeColor: 'White',
    backAccessory: 'Backpack', backColor: 'Black' },
  Girl: { ...PLAIN, headsTall: 5.8, height: 1.26, legLength: 0.51, shoulderWidth: 0.22, hipWidth: 0.2, neckThickness: 0.025, armThickness: 0.023, legThickness: 0.032, headWidth: 0.84,
    hair: 'long · twin tails', hairColor: 'Black', top: 'T-shirt', topColor: 'White', legwear: 'Skirt', legwearColor: 'Red', shoeColor: 'Red',
    backAccessory: 'Backpack', backColor: 'Red' },
  // grandparents: a little shorter, a gentle stoop (frame.js), grey hair,
  // a slower walk in the city, and a walking stick
  Grandpa: { ...PLAIN, headsTall: 7.2, height: 1.64, legLength: 0.52, shoulderWidth: 0.26, hipWidth: 0.19, neckThickness: 0.032, armThickness: 0.026, legThickness: 0.033, headWidth: 0.8,
    hair: 'short · side part', hairColor: 'Gray', moustache: 'Classic', top: 'Shirt (long sleeve)', topColor: 'Khaki', legwear: 'Trousers', legwearColor: 'Brown', shoeColor: 'Brown',
    outerwear: 'Cardigan', outerwearColor: 'Brown', headwear: 'Flat cap', headwearColor: 'Gray', handItem: 'Walking stick', handItemColor: 'Brown' },
  Grandma: { ...PLAIN, headsTall: 7.2, height: 1.5, legLength: 0.54, shoulderWidth: 0.22, hipWidth: 0.24, neckThickness: 0.024, armThickness: 0.024, legThickness: 0.032, headWidth: 0.8,
    hair: 'bun', hairColor: 'White', top: 'Shirt (long sleeve)', topColor: 'White', legwear: 'Skirt', legwearColor: 'Brown', shoeColor: 'Black',
    outerwear: 'Cardigan', outerwearColor: 'Purple', handItem: 'Shopping bag', handItemColor: 'Khaki' },
};

// Ready-made looks (clothes only, applied on top of any body): the creator's
// "Looks" row. The rules still apply (a grandma gets no tie, ...).
export const OUTFITS = {
  'Office worker': { top: 'Shirt (long sleeve)', topColor: 'White', bodyAccessory: 'Neck tie', bodyAccessoryColor: 'Navy',
    outerwear: 'Suit jacket', outerwearColor: 'Navy', legwear: 'Trousers', legwearColor: 'Navy', footwear: 'Shoes', shoeColor: 'Black',
    headwear: 'None', handItem: 'Briefcase', handItemColor: 'Black', backAccessory: 'None' },
  'Police officer': { top: 'Police uniform', topColor: 'Light blue', bodyAccessory: 'None', outerwear: 'None',
    legwear: 'Trousers', legwearColor: 'Navy', footwear: 'Shoes', shoeColor: 'Black', headwear: 'Police cap', headwearColor: 'Navy',
    handItem: 'None', backAccessory: 'None' },
  'Delivery worker': { top: 'Shirt', topColor: 'Blue', bodyAccessory: 'None', outerwear: 'None', legwear: 'Trousers', legwearColor: 'Navy',
    footwear: 'Shoes', shoeColor: 'White', headwear: 'Cap', headwearColor: 'Blue', handItem: 'Boxes', backAccessory: 'None' },
  'Summer stroll': { top: 'T-shirt', topColor: 'White', outerwear: 'None', legwear: 'Shorts', legwearColor: 'Khaki',
    headwear: 'Straw hat', headwearColor: 'Khaki', handItem: 'Ice cream', handItemColor: 'Pink', backAccessory: 'None' },
  'Rainy day': { outerwear: 'Jacket', outerwearColor: 'Navy', footwear: 'Boots', shoeColor: 'Black', handItem: 'Umbrella (open)', handItemColor: 'Blue' },
  'Coffee run': { handItem: 'Coffee cup', handItemColor: 'White' },
  'On the phone': { handItem: 'Phone', handItemColor: 'Black' },
};

/**
 * Called when one control changes (before the rules are applied): picking a
 * body type applies its default design.
 */
export function adjust(p, key, previous) {
  if (key !== 'bodyType' || previous === p.bodyType) return p;
  return Object.assign(p, BODY_DEFAULTS[p.bodyType]);
}
