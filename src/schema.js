// Versioned character definition. v2 is nested like the part tree.
// v1 is the flat iso-city creator JSON; migrate() folds it into v2.
import { PALETTE, COMIC, COLORS } from './palette.js';
import { mulberry32 } from './geom.js';
import { hasPart, getParts } from './registry.js';
import './parts.js';

/** Skin swatches from the iso-city creator, including the off-palette NPC skin. */
export const SKINS = [PALETTE.npcSkin, COMIC.warm[4], COMIC.warm[3], COMIC.warm[2], COMIC.warm[1], COMIC.warm[0], COMIC.neutrals[3], COMIC.blues[3]];

const COLOR_OK = new Set([...COLORS, ...SKINS, ...Object.values(PALETTE)]);
const HEIGHT = [0.85, 1.15];

const LINES = {
  man: ['yo!', 'sup?', 'nice weather.'],
  woman: ['hey there!', 'nice day, huh?', 'love your vibe.'],
};

function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

function merge(base, over) {
  if (over === undefined) return base;
  if (over === null || typeof over !== 'object' || Array.isArray(over)) return over;
  if (base === null || typeof base !== 'object' || Array.isArray(base)) return over;
  const out = { ...base };
  for (const k of Object.keys(over)) {
    if (over[k] === undefined) continue;
    out[k] = merge(base[k], over[k]);
  }
  return out;
}

/**
 * Default v2 character. `base` is `man` or `woman` (the iso-city gender presets).
 * Every slot stays mixable after this.
 * @param {'man'|'woman'} [base]
 */
export function defaults(base = 'man') {
  const w = base === 'woman';
  return {
    v: 2,
    name: w ? 'NEW GAL' : 'NEW GUY',
    body: {
      base: w ? 'woman' : 'man',
      type: 'average',
      height: w ? 0.96 : 1,
      skin: PALETTE.peach,
      shoulder: 0,
      belly: 0,
      hip: 0,
      torso: 'normal',
    },
    head: {
      shape: 'normal',
      hair: { style: w ? 'longStraight' : 'curtains', color: PALETTE.black, highlight: PALETTE.npcLine },
      facialHair: 'none',
      headwear: { style: 'none', color: COMIC.blues[1] },
      eyewear: 'none',
      ears: { style: 'normal', earrings: w },
    },
    arms: {
      left: { type: 'normal', color: null, hand: 'normal', wrist: 'normal' },
      right: { type: 'normal', color: null, hand: 'normal', wrist: 'normal' },
    },
    legs: {
      left: { type: 'normal' },
      right: { type: 'normal' },
    },
    clothing: {
      top: { style: w ? 'blouse' : 'tee', color: w ? COMIC.pinks[2] : COMIC.blues[1], innerColor: PALETTE.white },
      outer: { style: 'none', color: PALETTE.slate },
      bottom: { style: w ? 'skirt' : 'pants', color: w ? PALETTE.black : COMIC.blues[0] },
      shoes: { style: w ? 'flats' : 'sneakers', color: w ? PALETTE.black : PALETTE.white },
    },
    back: { style: 'none', color: COMIC.yellows[1] },
    hands: {
      left: { item: 'none', color: COMIC.pinks[1] },
      right: { item: 'none', color: COMIC.pinks[1] },
    },
    animation: { dance: 'disco', walkStyle: 'normal' },
    extra: { lines: LINES[w ? 'woman' : 'man'].slice(), bubble: '', home: 'fountain' },
  };
}

function isV1(d) {
  if (!d || typeof d !== 'object' || Array.isArray(d)) return false;
  if (d.v === 2) return false;
  if (d.head && (d.clothing || d.body && typeof d.body === 'object')) return false;
  if (d.v === 1) return true;
  return typeof d.gender === 'string' || typeof d.top === 'string' || typeof d.hair === 'string' || typeof d.hat === 'string' || !!d.acc;
}

function fromV1(d) {
  const gender = d.gender === 'woman' ? 'woman' : 'man';
  const base = defaults(gender);
  const acc = d.acc || {};
  let facial = 'none';
  if (acc.beard) facial = 'beard';
  else if (acc.moustache) facial = 'moustache';
  let eye = 'none';
  if (acc.sunglasses) eye = 'sunglasses';
  else if (acc.glasses) eye = 'glasses';
  const extra = { ...base.extra };
  if ('lines' in d) extra.lines = d.lines;
  if ('bubble' in d) extra.bubble = d.bubble;
  if ('home' in d) extra.home = d.home;
  if (d.id != null) extra.id = d.id;
  return {
    v: 2,
    name: d.name ?? base.name,
    body: {
      ...base.body,
      base: gender,
      type: d.body ?? base.body.type,
      height: d.height ?? base.body.height,
      skin: d.skin ?? base.body.skin,
      shoulder: 0, belly: 0, hip: 0,
    },
    head: {
      ...base.head,
      hair: { style: d.hair ?? base.head.hair.style, color: d.hairColor ?? base.head.hair.color, highlight: PALETTE.npcLine },
      facialHair: facial,
      headwear: { style: d.hat ?? 'none', color: d.hatColor ?? base.head.headwear.color },
      eyewear: eye,
      ears: { style: 'normal', earrings: !!acc.earrings },
    },
    arms: base.arms,
    legs: base.legs,
    clothing: {
      top: { style: d.top ?? base.clothing.top.style, color: d.topColor ?? base.clothing.top.color, innerColor: d.innerColor ?? base.clothing.top.innerColor },
      outer: { ...base.clothing.outer },
      bottom: { style: d.bottom ?? base.clothing.bottom.style, color: d.bottomColor ?? base.clothing.bottom.color },
      shoes: { style: d.shoes ?? base.clothing.shoes.style, color: d.shoeColor ?? base.clothing.shoes.color },
    },
    back: { style: acc.bag ? 'bag' : 'none', color: d.accColor ?? base.back.color },
    hands: {
      left: { item: d.held ?? 'none', color: d.heldColor ?? base.hands.left.color },
      right: { item: 'none', color: d.heldColor ?? base.hands.right.color },
    },
    animation: { dance: d.dance ?? base.animation.dance, walkStyle: 'normal' },
    extra,
  };
}

function partId(slot, value, fallback) {
  return hasPart(slot, value) ? value : fallback;
}

function colorOf(value, fallback) {
  return typeof value === 'string' && COLOR_OK.has(value) ? value : fallback;
}

function normalizeV2(def) {
  const hint = def?.body?.base === 'woman' || def?.gender === 'woman' ? 'woman' : 'man';
  const base = defaults(hint);
  const o = merge(base, def || {});
  o.v = 2;
  o.name = String(o.name || base.name).slice(0, 18);
  o.body.base = hint;
  o.body.type = partId('body', o.body.type, 'average');
  o.body.torso = partId('body.torso', o.body.torso, 'normal');
  o.body.height = clamp(+o.body.height || 1, HEIGHT[0], HEIGHT[1]);
  o.body.skin = SKINS.includes(o.body.skin) ? o.body.skin : base.body.skin;
  for (const k of ['shoulder', 'belly', 'hip']) {
    const n = +o.body[k];
    o.body[k] = clamp(Number.isFinite(n) ? n : 0, -1, 1);
  }

  o.head.shape = partId('head.shape', o.head.shape, 'normal');
  o.head.hair.style = partId('head.hair', o.head.hair.style, base.head.hair.style);
  o.head.hair.color = colorOf(o.head.hair.color, base.head.hair.color);
  o.head.hair.highlight = colorOf(o.head.hair.highlight, base.head.hair.highlight);
  o.head.facialHair = partId('head.facialHair', o.head.facialHair, 'none');
  o.head.headwear.style = partId('head.headwear', o.head.headwear.style, 'none');
  o.head.headwear.color = colorOf(o.head.headwear.color, base.head.headwear.color);
  o.head.eyewear = partId('head.eyewear', o.head.eyewear, 'none');
  o.head.ears.style = partId('head.ears', o.head.ears.style, 'normal');
  o.head.ears.earrings = !!o.head.ears.earrings;

  for (const side of ['left', 'right']) {
    const arm = o.arms[side];
    arm.type = partId(`arms.${side}`, arm.type, 'normal');
    arm.hand = arm.hand || 'normal';
    arm.wrist = arm.wrist || 'normal';
    arm.color = arm.color == null || arm.color === '' ? null : colorOf(arm.color, null);
    o.legs[side].type = partId(`legs.${side}`, o.legs[side].type, 'normal');
    o.hands[side].item = partId(`hands.${side}`, o.hands[side].item, 'none');
    o.hands[side].color = colorOf(o.hands[side].color, base.hands[side].color);
  }

  o.clothing.top.style = partId('clothing.top', o.clothing.top.style, base.clothing.top.style);
  o.clothing.top.color = colorOf(o.clothing.top.color, base.clothing.top.color);
  o.clothing.top.innerColor = colorOf(o.clothing.top.innerColor, base.clothing.top.innerColor);
  o.clothing.outer.style = partId('clothing.outer', o.clothing.outer.style, 'none');
  o.clothing.outer.color = colorOf(o.clothing.outer.color, base.clothing.outer.color);
  o.clothing.bottom.style = partId('clothing.bottom', o.clothing.bottom.style, base.clothing.bottom.style);
  o.clothing.bottom.color = colorOf(o.clothing.bottom.color, base.clothing.bottom.color);
  o.clothing.shoes.style = partId('clothing.shoes', o.clothing.shoes.style, base.clothing.shoes.style);
  o.clothing.shoes.color = colorOf(o.clothing.shoes.color, base.clothing.shoes.color);
  o.back.style = partId('back', o.back.style, 'none');
  o.back.color = colorOf(o.back.color, base.back.color);
  o.animation.dance = partId('animation.dance', o.animation.dance, 'disco');
  o.animation.walkStyle = partId('animation.walkStyle', o.animation.walkStyle, 'normal');

  const extra = o.extra && typeof o.extra === 'object' ? o.extra : {};
  const lines = (Array.isArray(extra.lines) ? extra.lines : []).map((s) => String(s).slice(0, 60)).filter(Boolean).slice(0, 5);
  extra.lines = lines.length ? lines : base.extra.lines.slice();
  extra.bubble = String(extra.bubble || '').slice(0, 60);
  extra.home = extra.home ? String(extra.home).slice(0, 32) : base.extra.home;
  if (extra.id != null && extra.id !== '') extra.id = String(extra.id).slice(0, 64);
  else delete extra.id;
  o.extra = extra;
  return o;
}

/**
 * Validate and clamp a definition. Unknown part ids fall back to the default
 * for that slot. A v1 def is migrated first.
 * @param {object} [def]
 */
export function normalize(def) {
  if (isV1(def)) return migrate(def);
  return normalizeV2(def || {});
}

/**
 * Convert an iso-city v1 character (flat fields, `acc`, `lines` / `bubble` / `home`)
 * into a v2 def. Already-v2 input is normalized instead.
 * @param {object} oldDef
 */
export function migrate(oldDef) {
  if (!oldDef || typeof oldDef !== 'object') return defaults('man');
  if (!isV1(oldDef)) return normalizeV2(oldDef);
  return normalizeV2(fromV1(oldDef));
}

/**
 * Random v2 def. The same seed always returns the same character.
 * With no seed, Math.random is used.
 * @param {number|string} [seed]
 */
export function randomize(seed) {
  const r = seed === undefined ? Math.random : mulberry32(seed);
  const pick = (slot, allow = () => true) => {
    const ids = getParts(slot).map((p) => p.id).filter(allow);
    return ids[Math.floor(r() * ids.length)];
  };
  const col = () => COLORS[Math.floor(r() * COLORS.length)];
  const base = r() < 0.5 ? 'woman' : 'man';
  const d = defaults(base);
  d.body.type = pick('body');
  d.body.height = +(HEIGHT[0] + r() * (HEIGHT[1] - HEIGHT[0])).toFixed(2);
  d.body.skin = SKINS[Math.floor(r() * SKINS.length)];
  d.head.hair.style = pick('head.hair');
  d.head.hair.color = col();
  d.head.hair.highlight = PALETTE.npcLine;
  const hats = getParts('head.headwear').map((p) => p.id).filter((id) => id !== 'none');
  d.head.headwear.style = r() < 0.35 ? hats[Math.floor(r() * hats.length)] : 'none';
  d.head.headwear.color = col();
  const glasses = r() < 0.25;
  const sunglasses = r() < 0.25;
  d.head.eyewear = sunglasses ? 'sunglasses' : glasses ? 'glasses' : 'none';
  const moustache = r() < 0.25;
  const beard = r() < 0.25;
  d.head.facialHair = beard ? 'beard' : moustache ? 'moustache' : 'none';
  d.head.ears.earrings = r() < 0.25;
  d.clothing.top.style = pick('clothing.top');
  d.clothing.top.color = col();
  d.clothing.top.innerColor = col();
  d.clothing.bottom.style = pick('clothing.bottom');
  d.clothing.bottom.color = col();
  d.clothing.shoes.style = pick('clothing.shoes');
  d.clothing.shoes.color = col();
  d.back.style = r() < 0.25 ? 'bag' : 'none';
  d.back.color = col();
  d.hands.left.item = pick('hands.left');
  d.hands.left.color = col();
  d.animation.dance = pick('animation.dance');
  const FIRST = ['ZED', 'MOMO', 'RIKU', 'PEPPER', 'JUNO', 'TAKO', 'NOVA', 'BIGGS', 'LULU', 'KAI', 'DOTTIE', 'SPUD', 'YUKI', 'REX', 'MAPLE'];
  d.name = FIRST[Math.floor(r() * FIRST.length)];
  const POOL = ['yo!', 'nice day, huh?', 'have we met?', 'i like your face.', 'got any snacks?', 'ugh, mondays.', 'this city is wild.', 'call me maybe.', 'living my best life.', 'what a vibe.', 'not now, busy.', 'rent is due soon...'];
  d.extra.lines = [];
  while (d.extra.lines.length < 3 + Math.floor(r() * 3)) {
    const line = POOL[Math.floor(r() * POOL.length)];
    if (!d.extra.lines.includes(line)) d.extra.lines.push(line);
  }
  d.extra.bubble = r() < 0.5 ? POOL[Math.floor(r() * POOL.length)] : '';
  d.extra.home = ['fountain', 'lawn', 'busstop', 'crossing', 'tower', 'fruit', 'stroll'][Math.floor(r() * 7)];
  if (seed !== undefined) d.extra.id = String(seed);
  return normalize(d);
}

/**
 * Return a copy of `def` with one slot's part id replaced.
 * @param {object} def
 * @param {string} slot
 * @param {string} id
 */
export function selectPart(def, slot, id) {
  const next = structuredClone(normalize(def));
  switch (slot) {
    case 'body': next.body.type = id; break;
    case 'body.torso': next.body.torso = id; break;
    case 'head.shape': next.head.shape = id; break;
    case 'head.hair': next.head.hair.style = id; break;
    case 'head.facialHair': next.head.facialHair = id; break;
    case 'head.headwear': next.head.headwear.style = id; break;
    case 'head.eyewear': next.head.eyewear = id; break;
    case 'head.ears': next.head.ears.style = id; break;
    case 'arms.left': next.arms.left.type = id; break;
    case 'arms.right': next.arms.right.type = id; break;
    case 'legs.left': next.legs.left.type = id; break;
    case 'legs.right': next.legs.right.type = id; break;
    case 'clothing.top': next.clothing.top.style = id; break;
    case 'clothing.outer': next.clothing.outer.style = id; break;
    case 'clothing.bottom': next.clothing.bottom.style = id; break;
    case 'clothing.shoes': next.clothing.shoes.style = id; break;
    case 'back': next.back.style = id; break;
    case 'hands.left': next.hands.left.item = id; break;
    case 'hands.right': next.hands.right.item = id; break;
    case 'animation.dance': next.animation.dance = id; break;
    case 'animation.walkStyle': next.animation.walkStyle = id; break;
    default: throw new Error(`unknown slot ${slot}`);
  }
  return next;
}
