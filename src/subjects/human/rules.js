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
//
// Anything a rule no longer allows falls back to a sensible value: a beard to
// None, a skirt to trousers, a crop top to the matching T-shirt, a tie to None.

export const BODY_TYPES = ['Man', 'Woman', 'Boy', 'Girl'];
export const isChild = (p) => p.bodyType === 'Boy' || p.bodyType === 'Girl';
export const isFemale = (p) => p.bodyType === 'Woman' || p.bodyType === 'Girl';
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
    case 'top':
      return isMale(p) ? all.filter((o) => !(o in CROP)) : all;
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
  const groups = new Set();
  if (p.bodyType !== 'Woman') groups.add('Body shape (woman)');
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

/** Proportions for each body type: used when switching between adult and child. */
export const BODY_DEFAULTS = {
  Man:   { headsTall: 7.5, height: 1.78, legLength: 0.54, shoulderWidth: 0.27, hipWidth: 0.18, neckThickness: 0.034, armThickness: 0.029, legThickness: 0.037, headWidth: 0.8 },
  Woman: { headsTall: 7.5, height: 1.68, legLength: 0.58, shoulderWidth: 0.22, hipWidth: 0.23, neckThickness: 0.023, armThickness: 0.023, legThickness: 0.033, headWidth: 0.78 },
  // about 8 years old: a big head (6 heads tall), short legs, narrow shoulders
  Boy:   { headsTall: 5.8, height: 1.28, legLength: 0.5, shoulderWidth: 0.23, hipWidth: 0.2, neckThickness: 0.027, armThickness: 0.024, legThickness: 0.033, headWidth: 0.85 },
  Girl:  { headsTall: 5.8, height: 1.26, legLength: 0.51, shoulderWidth: 0.22, hipWidth: 0.2, neckThickness: 0.025, armThickness: 0.023, legThickness: 0.032, headWidth: 0.84 },
};

/**
 * Called when one control changes (before the rules are applied): switching
 * between an adult and a child body type brings the matching proportions.
 */
export function adjust(p, key, previous) {
  if (key !== 'bodyType' || previous === p.bodyType) return p;
  if (isChild(p) !== isChild({ bodyType: previous })) Object.assign(p, BODY_DEFAULTS[p.bodyType]);
  return p;
}
