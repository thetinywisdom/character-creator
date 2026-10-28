// Registers the iso-city catalogue into the part tree. One id per existing
// option. Limb parts only add skin over the standard joints.
import { PALETTE } from './palette.js';
import { SHAPES } from './geom.js';
import { mulberry32 } from './geom.js';
import { registerPart } from './registry.js';
import { DANCES } from './anim.js';
import {
  buildHair, buildHeadShape, buildEars, buildTorsoSkin, buildArm, customTop, customFace,
  buildBottomGarment, buildLegLimbs, buildFootwear, buildBodyExtras, buildBag, buildHeadwear,
  placeLeftHeld, placeRightHeld, v1View,
} from './meshes.js';

const HAIRS = ['spiky', 'curly', 'buzz', 'tuft', 'quiff', 'curtains', 'sideswept',
  'long', 'bob', 'ponytail', 'curlyLong', 'bun', 'afro', 'mohawk', 'longStraight',
  'braids', 'pixie', 'slicked', 'receding', 'none'];
const HATS = ['none', 'cap', 'beanie', 'backcap'];
const TOPS = ['tee', 'shirt', 'hoodie', 'sweater', 'tank', 'blazer', 'cardigan', 'coat', 'blouse', 'stripetee', 'none'];
const BOTTOMS = ['pants', 'shorts', 'skirt', 'dress'];
const SHOES = ['sneakers', 'boots', 'flats', 'barefoot'];
const HELDS = ['none', 'football', 'guitar', 'skateboard', 'umbrella', 'phone', 'coffee', 'icecream',
  'balloon', 'briefcase', 'shopping', 'boombox', 'flowers', 'baguette', 'dog', 'ring'];
const DANCE_IDS = ['robot', 'chicken', 'disco', 'sprinkler', 'flail', 'hula', 'flex', 'mbappe'];

const LABELS = {
  none: 'None', tee: 'T-shirt', tank: 'Tank top', sneakers: 'Sneakers', barefoot: 'Barefoot',
  backcap: 'Back cap', stripetee: 'Striped tee', icecream: 'Ice cream', shopping: 'Shopping bag',
  dog: 'Dog on a leash', ring: 'Watermelon ring', mbappe: 'Bad', longStraight: 'Long straight',
  curlyLong: 'Curly long',
};

function label(id) {
  return LABELS[id] || id.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/^./, (c) => c.toUpperCase());
}

let ready = false;

/** Register every built-in part. Safe to call more than once. */
export function registerBuiltinParts() {
  if (ready) return;
  ready = true;

  registerPart('head.shape', 'normal', {
    label: 'Normal',
    build(ctx) { buildHeadShape(ctx.P, ctx.cfg.skin, ctx.cfg.line); },
  });

  for (const id of HAIRS) {
    registerPart('head.hair', id, {
      label: label(id),
      build(ctx, opts) {
        buildHair(ctx.P.headCenter, id, opts.color, opts.highlight || PALETTE.npcLine,
          mulberry32(String(ctx.cfg.seed) + id));
      },
    });
  }

  registerPart('head.facialHair', 'none', { label: 'None', build() {} });
  registerPart('head.facialHair', 'moustache', {
    label: 'Moustache',
    build(ctx) { customFace(ctx.P, { acc: { moustache: true }, hairColor: ctx.def.head.hair.color }); },
  });
  registerPart('head.facialHair', 'beard', {
    label: 'Beard',
    build(ctx) { customFace(ctx.P, { acc: { beard: true, moustache: true }, hairColor: ctx.def.head.hair.color }); },
  });

  for (const id of HATS) {
    registerPart('head.headwear', id, {
      label: label(id),
      build(ctx, opts) {
        ctx.props.cap = buildHeadwear(ctx.P, { hat: id, hatColor: opts.color, hairColor: ctx.def.head.hair.color });
      },
    });
  }

  registerPart('head.eyewear', 'none', { label: 'None', build() {} });
  registerPart('head.eyewear', 'glasses', {
    label: 'Glasses',
    build(ctx) { customFace(ctx.P, { acc: { glasses: true }, hairColor: ctx.def.head.hair.color }); },
  });
  registerPart('head.eyewear', 'sunglasses', {
    label: 'Sunglasses',
    build(ctx) { customFace(ctx.P, { acc: { sunglasses: true }, hairColor: ctx.def.head.hair.color }); },
  });

  registerPart('head.ears', 'normal', {
    label: 'Normal',
    build(ctx, opts) { buildEars(ctx.P, ctx.cfg.skin, ctx.cfg.line, !!opts.earrings); },
  });

  for (const [id, shape] of Object.entries(SHAPES)) {
    registerPart('body', id, {
      label: label(id),
      shape,
      build(ctx) { buildBodyExtras(ctx.P, ctx.v1); },
    });
  }

  registerPart('body.torso', 'normal', {
    label: 'Normal',
    build(ctx) { buildTorsoSkin(ctx.P, ctx.cfg.skin); },
  });

  for (const [slot, side] of [['arms.left', 'L'], ['arms.right', 'R']]) {
    registerPart(slot, 'normal', {
      label: 'Normal',
      build(ctx) { buildArm(ctx.P, side, ctx.cfg.skin, ctx.cfg.line); },
    });
  }

  for (const slot of ['legs.left', 'legs.right']) {
    registerPart(slot, 'normal', {
      label: 'Normal',
      // Joints are created with the rig. A limb part adds geometry only.
      build() {},
    });
  }

  for (const id of TOPS) {
    registerPart('clothing.top', id, {
      label: label(id),
      build(ctx) { customTop(ctx.P, { ...ctx.v1, top: id }, ctx.P.torso); },
    });
  }

  registerPart('clothing.outer', 'none', { label: 'None', build() {} });

  for (const id of BOTTOMS) {
    registerPart('clothing.bottom', id, {
      label: label(id),
      build(ctx) {
        const d = { ...ctx.v1, bottom: id };
        buildBottomGarment(ctx.P, d, ctx.P.torso);
        buildLegLimbs(ctx.P, d);
      },
    });
  }

  for (const id of SHOES) {
    registerPart('clothing.shoes', id, {
      label: label(id),
      build(ctx) { buildFootwear(ctx.P, { ...ctx.v1, shoes: id }); },
    });
  }

  registerPart('back', 'none', { label: 'None', build() {} });
  registerPart('back', 'bag', {
    label: 'Bag',
    build(ctx) { buildBag(ctx.P, ctx.v1, ctx.shape); },
  });

  for (const slot of ['hands.left', 'hands.right']) {
    for (const id of HELDS) {
      registerPart(slot, id, {
        label: label(id),
        build(ctx, opts) {
          if (slot === 'hands.left') {
            ctx.props.left = placeLeftHeld(ctx.P, id, opts.color, ctx.shape, ctx.def.body.type);
          } else if (id !== 'none') {
            ctx.props.right = placeRightHeld(ctx.P, id, opts.color);
          }
        },
      });
    }
  }

  const danceLabel = { mbappe: 'Bad' };
  for (const id of DANCE_IDS) {
    registerPart('animation.dance', id, {
      label: danceLabel[id] || label(id),
      duration: DANCES[id].dur,
      build() {},
    });
  }
  registerPart('animation.walkStyle', 'normal', { label: 'Normal', build() {} });
}

registerBuiltinParts();

// Touch v1View so the import stays used if a bundler drops it. Parts read ctx.v1,
// which createCharacter fills with v1View(def).
export { v1View };
