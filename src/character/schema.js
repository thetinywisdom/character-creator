import './parts.js';
import { getRegistry } from './registry.js';

const HEX = /^#[0-9a-f]{6}$/i;
const ROOT_KEYS = ['version', 'body', 'head', 'arms', 'legs', 'clothing', 'back', 'held', 'animation'];
const PRESENTATION = ['man', 'woman'];
const BODY_TYPE = ['slim', 'average', 'broad', 'heavy'];

function isObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function arm() {
  return {
    type: 'normal',
    color: null,
    hand: 'open',
    wrist: { id: 'none', color: '#222222' },
  };
}

/** Naked mannequin. Null lengths derive from height inside createBody. */
export function defaultDocument() {
  return {
    version: 1,
    body: {
      presentation: 'man',
      type: 'average',
      height: 1.8,
      skin: '#e4c29a',
      shoulder: null,
      belly: null,
      hip: null,
      torso: 'normal',
      limbThickness: 1,
    },
    head: {
      shape: 'classic',
      size: null,
      hair: { style: 'none', color: '#2a2118', highlight: null },
      facialHair: 'none',
      headwear: { id: 'none', color: '#1d2a3a' },
      eyewear: { id: 'none', color: '#111111' },
      ears: 'normal',
      earrings: { id: 'none', color: '#d4af37' },
    },
    arms: { left: arm(), right: arm() },
    legs: {
      left: { type: 'normal', color: null },
      right: { type: 'normal', color: null },
    },
    clothing: {
      top: { id: 'none', color: '#3a5a40' },
      outer: { id: 'none', color: '#1c1c1c' },
      bottom: { id: 'none', color: '#222222' },
      shoes: { id: 'barefoot', color: '#111111', accent: '#f2f2f2' },
    },
    back: { id: 'none', color: '#4a3728' },
    held: {
      left: { id: 'none', color: null },
      right: { id: 'none', color: null },
    },
    animation: { dance: 'none', walkStyle: 'normal' },
  };
}

function fail(errors, path, message) {
  errors.push(`${path} ${message}`);
}

function expectEnum(value, allowed, path, errors) {
  if (typeof value !== 'string' || !allowed.includes(value)) {
    fail(errors, path, `must be ${allowed.join(', ')}`);
    return allowed[0];
  }
  return value;
}

function expectPart(slot, value, path, errors) {
  if (typeof value !== 'string' || !getRegistry().has(slot, value)) {
    fail(errors, path, `is not a ${slot} part`);
    return null;
  }
  return value;
}

function expectColor(value, path, errors, nullable = false) {
  if (nullable && value === null) return null;
  if (typeof value !== 'string' || !HEX.test(value)) {
    fail(errors, path, nullable ? 'must be a #rrggbb color or null' : 'must be a #rrggbb color');
    return null;
  }
  return value.toLowerCase();
}

function expectNumber(value, path, errors, nullable = false) {
  if (nullable && value === null) return null;
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    fail(errors, path, nullable ? 'must be a finite number or null' : 'must be a finite number');
    return null;
  }
  return value;
}

function rejectUnknown(input, allowed, path, errors) {
  for (const key of Object.keys(input)) {
    if (!allowed.includes(key)) fail(errors, `${path}.${key}`, 'is not allowed');
  }
}

function take(input, base, path, errors, fields) {
  if (input === undefined) return structuredClone(base);
  if (!isObject(input)) {
    fail(errors, path, 'must be an object');
    return structuredClone(base);
  }
  rejectUnknown(input, Object.keys(base), path, errors);
  const next = structuredClone(base);
  for (const [key, read] of Object.entries(fields)) {
    if (key in input) next[key] = read(input[key], `${path}.${key}`);
  }
  return next;
}

function readBody(input, errors) {
  const base = defaultDocument().body;
  return take(input, base, 'body', errors, {
    presentation: (value, path) => expectEnum(value, PRESENTATION, path, errors),
    type: (value, path) => expectEnum(value, BODY_TYPE, path, errors),
    height: (value, path) => {
      const height = expectNumber(value, path, errors);
      if (height != null && height <= 0) fail(errors, path, 'must be greater than 0');
      return height;
    },
    skin: (value, path) => expectColor(value, path, errors),
    shoulder: (value, path) => expectNumber(value, path, errors, true),
    belly: (value, path) => expectNumber(value, path, errors, true),
    hip: (value, path) => expectNumber(value, path, errors, true),
    torso: (value, path) => expectPart('body.torso', value, path, errors),
    limbThickness: (value, path) => {
      const thick = expectNumber(value, path, errors);
      if (thick != null && thick <= 0) fail(errors, path, 'must be greater than 0');
      return thick;
    },
  });
}

function readHead(input, errors) {
  const base = defaultDocument().head;
  const head = take(input, base, 'head', errors, {
    shape: (value, path) => expectPart('head.shape', value, path, errors),
    size: (value, path) => expectNumber(value, path, errors, true),
    facialHair: (value, path) => expectPart('head.facialHair', value, path, errors),
    ears: (value, path) => expectPart('head.ears', value, path, errors),
  });
  if (input === undefined || !isObject(input)) return head;
  if ('hair' in input) head.hair = readHair(input.hair, errors);
  if ('headwear' in input) head.headwear = readIdColor(input.headwear, 'head.headwear', 'head.headwear', errors);
  if ('eyewear' in input) head.eyewear = readIdColor(input.eyewear, 'head.eyewear', 'head.eyewear', errors);
  if ('earrings' in input) head.earrings = readIdColor(input.earrings, 'head.earrings', 'head.earrings', errors);
  return head;
}

function readHair(input, errors) {
  const base = defaultDocument().head.hair;
  return take(input, base, 'head.hair', errors, {
    style: (value, path) => expectPart('head.hair', value, path, errors),
    color: (value, path) => expectColor(value, path, errors),
    highlight: (value, path) => expectColor(value, path, errors, true),
  });
}

function readIdColor(input, path, slot, errors) {
  const base = { id: 'none', color: '#000000' };
  const fallback = {
    'head.headwear': defaultDocument().head.headwear,
    'head.eyewear': defaultDocument().head.eyewear,
    'head.earrings': defaultDocument().head.earrings,
    'clothing.top': defaultDocument().clothing.top,
    'clothing.outer': defaultDocument().clothing.outer,
    'clothing.bottom': defaultDocument().clothing.bottom,
    back: defaultDocument().back,
  }[slot] || base;
  return take(input, fallback, path, errors, {
    id: (value, idPath) => expectPart(slot, value, idPath, errors),
    color: (value, colorPath) => expectColor(value, colorPath, errors),
  });
}

function readArm(input, path, slot, wristSlot, handSlot, errors) {
  const base = arm();
  const next = take(input, base, path, errors, {
    type: (value, typePath) => expectPart(slot, value, typePath, errors),
    color: (value, colorPath) => expectColor(value, colorPath, errors, true),
    hand: (value, handPath) => expectPart(handSlot, value, handPath, errors),
  });
  if (isObject(input) && 'wrist' in input) {
    next.wrist = take(input.wrist, base.wrist, `${path}.wrist`, errors, {
      id: (value, idPath) => expectPart(wristSlot, value, idPath, errors),
      color: (value, colorPath) => expectColor(value, colorPath, errors),
    });
  }
  return next;
}

function readArms(input, errors) {
  const base = defaultDocument().arms;
  if (input === undefined) return structuredClone(base);
  if (!isObject(input)) {
    fail(errors, 'arms', 'must be an object');
    return structuredClone(base);
  }
  rejectUnknown(input, ['left', 'right'], 'arms', errors);
  return {
    left: 'left' in input ? readArm(input.left, 'arms.left', 'arms.left', 'arms.left.wrist', 'arms.left.hand', errors) : structuredClone(base.left),
    right: 'right' in input ? readArm(input.right, 'arms.right', 'arms.right', 'arms.right.wrist', 'arms.right.hand', errors) : structuredClone(base.right),
  };
}

function readLeg(input, path, slot, errors) {
  const base = defaultDocument().legs.left;
  return take(input, base, path, errors, {
    type: (value, typePath) => expectPart(slot, value, typePath, errors),
    color: (value, colorPath) => expectColor(value, colorPath, errors, true),
  });
}

function readLegs(input, errors) {
  const base = defaultDocument().legs;
  if (input === undefined) return structuredClone(base);
  if (!isObject(input)) {
    fail(errors, 'legs', 'must be an object');
    return structuredClone(base);
  }
  rejectUnknown(input, ['left', 'right'], 'legs', errors);
  return {
    left: 'left' in input ? readLeg(input.left, 'legs.left', 'legs.left', errors) : structuredClone(base.left),
    right: 'right' in input ? readLeg(input.right, 'legs.right', 'legs.right', errors) : structuredClone(base.right),
  };
}

function readShoes(input, errors) {
  const base = defaultDocument().clothing.shoes;
  return take(input, base, 'clothing.shoes', errors, {
    id: (value, path) => expectPart('clothing.shoes', value, path, errors),
    color: (value, path) => expectColor(value, path, errors),
    accent: (value, path) => expectColor(value, path, errors),
  });
}

function readClothing(input, errors) {
  const base = defaultDocument().clothing;
  if (input === undefined) return structuredClone(base);
  if (!isObject(input)) {
    fail(errors, 'clothing', 'must be an object');
    return structuredClone(base);
  }
  rejectUnknown(input, ['top', 'outer', 'bottom', 'shoes'], 'clothing', errors);
  return {
    top: 'top' in input ? readIdColor(input.top, 'clothing.top', 'clothing.top', errors) : structuredClone(base.top),
    outer: 'outer' in input ? readIdColor(input.outer, 'clothing.outer', 'clothing.outer', errors) : structuredClone(base.outer),
    bottom: 'bottom' in input ? readIdColor(input.bottom, 'clothing.bottom', 'clothing.bottom', errors) : structuredClone(base.bottom),
    shoes: 'shoes' in input ? readShoes(input.shoes, errors) : structuredClone(base.shoes),
  };
}

function readHeldSide(input, path, slot, errors) {
  const base = { id: 'none', color: null };
  return take(input, base, path, errors, {
    id: (value, idPath) => expectPart(slot, value, idPath, errors),
    color: (value, colorPath) => expectColor(value, colorPath, errors, true),
  });
}

function readHeld(input, errors) {
  const base = defaultDocument().held;
  if (input === undefined) return structuredClone(base);
  if (!isObject(input)) {
    fail(errors, 'held', 'must be an object');
    return structuredClone(base);
  }
  rejectUnknown(input, ['left', 'right'], 'held', errors);
  return {
    left: 'left' in input ? readHeldSide(input.left, 'held.left', 'hands.left', errors) : structuredClone(base.left),
    right: 'right' in input ? readHeldSide(input.right, 'held.right', 'hands.right', errors) : structuredClone(base.right),
  };
}

function readAnimation(input, errors) {
  const base = defaultDocument().animation;
  return take(input, base, 'animation', errors, {
    dance: (value, path) => expectPart('animation.dance', value, path, errors),
    walkStyle: (value, path) => expectPart('animation.walkStyle', value, path, errors),
  });
}

function coerceGrip(document) {
  for (const side of ['left', 'right']) {
    if (document.held[side].id !== 'none' && document.arms[side].hand === 'open') {
      document.arms[side].hand = 'fist';
    }
  }
}

/**
 * @returns {{ ok: boolean, errors: string[], document: object | null }}
 * Missing sections fill from the naked default. A robot torso rejects tops and
 * outer layers. A held item turns an open hand into a fist.
 */
export function validateDocument(input) {
  const errors = [];
  if (!isObject(input)) {
    return { ok: false, errors: ['document must be an object'], document: null };
  }
  for (const key of Object.keys(input)) {
    if (!ROOT_KEYS.includes(key)) fail(errors, key, 'is not allowed');
  }
  if (input.version !== 1) fail(errors, 'version', 'must be 1');

  const document = {
    version: 1,
    body: readBody(input.body, errors),
    head: readHead(input.head, errors),
    arms: readArms(input.arms, errors),
    legs: readLegs(input.legs, errors),
    clothing: readClothing(input.clothing, errors),
    back: input.back === undefined
      ? defaultDocument().back
      : readIdColor(input.back, 'back', 'back', errors),
    held: readHeld(input.held, errors),
    animation: readAnimation(input.animation, errors),
  };

  if (document.body.torso === 'robot') {
    if (document.clothing.top.id !== 'none') {
      errors.push('a robot torso cannot wear a top');
    }
    if (document.clothing.outer.id !== 'none') {
      errors.push('a robot torso cannot wear an outer layer');
    }
  }

  if (errors.length) return { ok: false, errors, document: null };
  coerceGrip(document);
  return { ok: true, errors: [], document };
}

/** Lengths createBody understands. A null belly keeps the derived waist seam. */
export function paramsFromDocument(doc) {
  const params = {
    height: doc.body.height,
    skinColor: doc.body.skin,
    limbThickness: doc.body.limbThickness,
  };
  if (doc.body.shoulder != null) params.shoulderWidth = doc.body.shoulder;
  if (doc.body.belly != null) params.bellyWidth = doc.body.belly;
  if (doc.body.hip != null) params.hipWidth = doc.body.hip;
  if (doc.head.size != null) params.headSize = doc.head.size;
  return params;
}
