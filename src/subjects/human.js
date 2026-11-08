import * as THREE from 'three';
import { ellipsoid, seg } from '../lib/shapes.js';
import { CLOTH_COLORS, HAIR_COLORS, SKIN_TONES } from '../styles/palette.js';
import { measure } from './human/frame.js';
import { HAIRSTYLES, LONG_STYLES, MEDIUM_STYLES, SHORT_STYLES, buildHair } from './human/hair.js';
import { TOPS, buildTorso } from './human/tops.js';
import { buildArm, handGrip } from './human/arms.js';
import { HAND_ITEMS, HOLD_POSES, buildHandItem } from './human/handheld.js';
import { FOOTWEAR } from './human/footwear.js';
import { headGeometry } from './human/headShape.js';
import { OUTERWEAR, buildOuterwear } from './human/outerwear.js';
import { BACK_ACCESSORIES, BODY_ACCESSORIES, buildBackAccessory, buildBodyAccessory } from './human/accessories.js';
import { BEARDS, FACE_ACCESSORIES, HEADWEAR, MASKS, MOUSTACHES, buildFaceAccessory, buildFacialHair, buildHeadwear, coversHair, hairUnder } from './human/head.js';
import { BODY_DEFAULTS, BODY_TYPES, BUILDS, OUTFITS, adjust, allowedOptions, applyRules, hiddenControls, isChild, isElderly } from './human/rules.js';
import { poseHold } from '../anim/gait.js';
import { mergeByMaterial } from '../lib/merge.js';
import { LEGWEAR, buildLeg, buildSkirt } from './human/legwear.js';

// Human character, assembled from slots: body, hair, top, legwear (more slots
// – headwear, accessories, outerwear – arrive in later batches as new files
// in ./human/). Every item takes its colour from a curated palette.
// Faces +z. Feet rest on y = 0. Units are metres. No facial features.

const names = (o) => Object.keys(o);

/** Trim colour for collars and plackets: white, unless the top is already light. */
function accentFor(topColor) {
  return ['White', 'Yellow', 'Khaki', 'Pink'].includes(topColor) ? CLOTH_COLORS.Navy : CLOTH_COLORS.White;
}

export const human = {
  id: 'human',
  label: 'Human',
  isCharacter: true,
  schema: {
    // body
    bodyType:      { group: 'Body', value: 'Man', options: BODY_TYPES, label: 'Body type' },
    trait:         { group: 'Body', value: 'Calm', options: ['Calm', 'Aggressive'], label: 'Trait (how they react)' },
    build:         { group: 'Body', value: 'Normal', options: BUILDS, label: 'Build' },
    headsTall:     { group: 'Body', value: 7.5,   min: 2.5,   max: 7.5,  step: 0.1,   label: 'Heads tall' },
    height:        { group: 'Body', value: 1.6,   min: 1.0,   max: 2.0,  step: 0.01,  label: 'Height (m)' },
    legLength:     { group: 'Body', value: 0.54,  min: 0.35,  max: 0.65, step: 0.01,  label: 'Leg length' },
    shoulderWidth: { group: 'Body', value: 0.25,  min: 0.15,  max: 0.34, step: 0.005, label: 'Shoulder width' },
    hipWidth:      { group: 'Body', value: 0.2,   min: 0.12,  max: 0.3,  step: 0.005, label: 'Hip width' },
    neckThickness: { group: 'Body', value: 0.03,  min: 0.015, max: 0.06, step: 0.001, label: 'Neck thickness' },
    armThickness:  { group: 'Body', value: 0.026, min: 0.015, max: 0.05, step: 0.001, label: 'Arm thickness' },
    legThickness:  { group: 'Body', value: 0.034, min: 0.02,  max: 0.07, step: 0.001, label: 'Leg thickness' },
    headWidth:     { group: 'Body', value: 0.8,   min: 0.7,   max: 1.1,  step: 0.01,  label: 'Head width' },
    skin:          { group: 'Body', value: 'Light', options: names(SKIN_TONES), label: 'Skin tone' },
    // women only
    chestSize:     { group: 'Body shape (woman)', value: 1, min: 0, max: 1.6, step: 0.05, label: 'Chest size' },
    bottomSize:    { group: 'Body shape (woman)', value: 1, min: 0, max: 1.6, step: 0.05, label: 'Bottom size' },
    // head
    hair:          { group: 'Hair', value: 'short', options: HAIRSTYLES, label: 'Hairstyle' },
    hairColor:     { group: 'Hair', value: 'Dark brown', options: names(HAIR_COLORS), label: 'Hair colour' },
    beard:         { group: 'Hair', value: 'None', options: BEARDS, label: 'Beard' },
    moustache:     { group: 'Hair', value: 'None', options: MOUSTACHES, label: 'Moustache' },
    // head items
    headwear:      { group: 'Head', value: 'None', options: HEADWEAR, label: 'Headwear' },
    headwearColor: { group: 'Head', value: 'Red', options: names(CLOTH_COLORS), label: 'Headwear colour' },
    faceAccessory: { group: 'Head', value: 'None', options: FACE_ACCESSORIES, label: 'Glasses' },
    accessoryColor:{ group: 'Head', value: 'Black', options: names(CLOTH_COLORS), label: 'Frame colour' },
    mask:          { group: 'Head', value: 'None', options: MASKS, label: 'Mask' },
    maskColor:     { group: 'Head', value: 'White', options: names(CLOTH_COLORS), label: 'Mask colour' },
    // accessories
    backAccessory: { group: 'Accessories', value: 'None', options: BACK_ACCESSORIES, label: 'On the back' },
    backColor:     { group: 'Accessories', value: 'Orange', options: names(CLOTH_COLORS), label: 'Backpack colour' },
    bodyAccessory: { group: 'Accessories', value: 'None', options: BODY_ACCESSORIES, label: 'On the body' },
    bodyAccessoryColor: { group: 'Accessories', value: 'Red', options: names(CLOTH_COLORS), label: 'Accessory colour' },
    handItem:      { group: 'Accessories', value: 'None', options: HAND_ITEMS, label: 'In the hand' },
    handItemColor: { group: 'Accessories', value: 'Brown', options: names(CLOTH_COLORS), label: 'Hand item colour' },
    // clothes
    top:           { group: 'Clothes', value: 'T-shirt', options: names(TOPS), label: 'Top' },
    topColor:      { group: 'Clothes', value: 'Blue', options: names(CLOTH_COLORS), label: 'Top colour' },
    legwear:       { group: 'Clothes', value: 'Trousers', options: LEGWEAR, label: 'Legwear' },
    legwearColor:  { group: 'Clothes', value: 'Navy', options: names(CLOTH_COLORS), label: 'Legwear colour' },
    outerwear:     { group: 'Clothes', value: 'None', options: OUTERWEAR, label: 'Outerwear' },
    outerwearColor:{ group: 'Clothes', value: 'Gray', options: names(CLOTH_COLORS), label: 'Outerwear colour' },
    footwear:      { group: 'Clothes', value: 'Shoes', options: FOOTWEAR, label: 'Footwear' },
    shoeColor:     { group: 'Clothes', value: 'Brown', options: names(CLOTH_COLORS), label: 'Footwear colour' },
  },
  presets: {
    // each body type's default design (proportions and a look)
    Man:   { bodyType: 'Man',   ...BODY_DEFAULTS.Man },
    Woman: { bodyType: 'Woman', ...BODY_DEFAULTS.Woman },
    Boy:   { bodyType: 'Boy',   ...BODY_DEFAULTS.Boy },
    Girl:  { bodyType: 'Girl',  ...BODY_DEFAULTS.Girl },
    Grandpa: { bodyType: 'Grandpa', ...BODY_DEFAULTS.Grandpa },
    Grandma: { bodyType: 'Grandma', ...BODY_DEFAULTS.Grandma },
  },
  /** Ready-made looks (clothes only), see rules.js OUTFITS. */
  outfits: OUTFITS,

  /** A random but believable character (realistic proportions, varied outfit). */
  randomize(rng = Math.random) {
    const pick = (arr) => arr[Math.floor(rng() * arr.length)];
    const range = (a, b, step) => Math.round((a + (b - a) * rng()) / step) * step;
    const topColor = pick(names(CLOTH_COLORS));
    let legwearColor;
    do {
      legwearColor = pick(['Denim', 'Denim', 'Navy', 'Black', 'Khaki', 'Gray', 'Brown', ...names(CLOTH_COLORS)]);
    } while (legwearColor === topColor);
    // about one in six is a child
    const child = rng() < 0.17;
    const old = !child && rng() < 0.14; // and about one in eight is a grandparent
    const woman = rng() < 0.5;
    const bodyType = child ? (woman ? 'Girl' : 'Boy') : old ? (woman ? 'Grandma' : 'Grandpa') : (woman ? 'Woman' : 'Man');
    const kid = BODY_DEFAULTS[bodyType];
    const jitter = (v, k) => Math.round(v * (1 + (rng() - 0.5) * k) * 1000) / 1000;
    const out = {
      bodyType,
      trait: rng() < 0.25 ? 'Aggressive' : 'Calm', // about one in four
      build: pick(['Normal', 'Normal', 'Normal', 'Normal', 'Skinny', 'Skinny', 'Bulky', 'Fat', 'Fat']),
      headsTall: range(7, 7.5, 0.1),
      height: woman ? range(1.5, 1.75, 0.01) : range(1.62, 1.9, 0.01),
      legLength: woman ? range(0.55, 0.6, 0.01) : range(0.5, 0.56, 0.01),
      shoulderWidth: woman ? range(0.2, 0.24, 0.005) : range(0.25, 0.29, 0.005),
      hipWidth: woman ? range(0.21, 0.25, 0.005) : range(0.16, 0.2, 0.005),
      neckThickness: woman ? range(0.021, 0.026, 0.001) : range(0.031, 0.038, 0.001),
      armThickness: woman ? range(0.021, 0.026, 0.001) : range(0.026, 0.032, 0.001),
      legThickness: woman ? range(0.03, 0.036, 0.001) : range(0.031, 0.038, 0.001),
      headWidth: range(0.76, 0.86, 0.01),
      skin: pick(names(SKIN_TONES)),
      // mostly short / medium / long cuts (with their variations), sometimes something special
      hair: pick([...SHORT_STYLES, ...MEDIUM_STYLES, ...LONG_STYLES, ...SHORT_STYLES, ...LONG_STYLES,
        'bun', 'spiky', 'mohawk', 'curly', 'afro', 'bald']),
      hairColor: pick(['Black', 'Black', 'Dark brown', 'Dark brown', 'Brown', 'Blonde', 'Red', 'Gray', 'Pink', 'Blue']),
      top: pick(names(TOPS)),
      topColor,
      legwear: pick(['Trousers', 'Trousers', 'Shorts', 'Skirt']),
      legwearColor,
      footwear: rng() < 0.3 ? 'Boots' : 'Shoes',
      headwear: rng() < 0.4 ? pick(HEADWEAR.slice(1)) : 'None',
      headwearColor: pick(names(CLOTH_COLORS)),
      faceAccessory: rng() < 0.3 ? pick(FACE_ACCESSORIES.slice(1)) : 'None',
      accessoryColor: pick(['Black', 'Black', 'Brown', 'White', 'Red', 'Blue']),
      mask: rng() < 0.12 ? 'Flu mask' : 'None',
      maskColor: pick(['White', 'White', 'White', 'Black', 'Blue']),
      outerwear: rng() < 0.3 ? pick(OUTERWEAR.slice(1)) : 'None',
      outerwearColor: pick(names(CLOTH_COLORS)),
      backAccessory: rng() < 0.25 ? pick(['Backpack', 'Backpack', 'Backpack', 'Angel wings', 'Evil wings']) : 'None',
      backColor: pick(names(CLOTH_COLORS)),
      bodyAccessory: rng() < 0.25 ? pick(BODY_ACCESSORIES.slice(1)) : 'None',
      bodyAccessoryColor: pick(names(CLOTH_COLORS)),
      handItem: rng() < 0.14 ? pick(HAND_ITEMS.slice(1)) : 'None',
      handItemColor: pick(['Brown', 'Black', 'White', 'Navy', 'Red', 'Khaki']),
      beard: !woman && rng() < 0.35 ? pick(BEARDS.slice(1)) : 'None',
      moustache: !woman && rng() < 0.3 ? pick(MOUSTACHES.slice(1)) : 'None',
      shoeColor: pick(['Black', 'Brown', 'White', 'Gray', 'Red', 'Navy']),
    };
    if (child) {
      // child proportions, a little varied; brighter, simpler outfits
      for (const k of Object.keys(kid)) if (typeof kid[k] === 'number') out[k] = jitter(kid[k], k === 'height' ? 0.2 : 0.08);
      out.headsTall = range(5.4, 6.2, 0.1);
      out.outerwear = rng() < 0.2 ? 'Hoodie' : 'None';
      out.footwear = 'Shoes';
      out.mask = 'None';
      out.backAccessory = rng() < 0.5 ? 'Backpack' : 'None'; // school bags
    }
    if (old) {
      // grandparent proportions and a quieter look, often a walking stick
      for (const k of Object.keys(kid)) if (typeof kid[k] === 'number') out[k] = jitter(kid[k], k === 'height' ? 0.08 : 0.06);
      out.hairColor = pick(['Gray', 'Gray', 'White', 'White', 'Black']);
      if (out.hair === 'mohawk' || out.hair === 'spiky' || out.hair.includes('twin')) out.hair = woman ? 'bun' : 'short';
      out.topColor = pick(['White', 'Khaki', 'Gray', 'Brown', 'Navy', 'Light blue', 'Purple']);
      out.outerwear = rng() < 0.5 ? 'Cardigan' : 'None';
      out.headwear = rng() < 0.35 ? (woman ? 'Straw hat' : pick(['Flat cap', 'Flat cap', 'Fedora'])) : 'None';
      out.backAccessory = 'None';
      out.handItem = rng() < 0.4 ? 'Walking stick' : rng() < 0.3 ? 'Shopping bag' : 'None';
      out.handItemColor = 'Brown';
    }
    // the character rules (no bearded women, no skirts on men, ...)
    return applyRules(out, human.schema);
  },

  // --- character rules (see human/rules.js), used by the control panel ----
  /** One control changed: switching adult <-> child brings child proportions. */
  adjust,
  /** Options of `key` this character can choose from. */
  allowedOptions: (key, p) => allowedOptions(key, human.schema[key].options, p),
  /** Controls and groups that don't apply to this character. */
  hiddenControls,
  /** A control's label for this character (a yukata's obi uses the legwear colour). */
  labelFor: (key, p) => (key === 'legwearColor' && p.top === 'Yukata' ? 'Obi colour' : undefined),
  /** Correct `p` in place so every value is allowed. */
  applyRules: (p) => applyRules(p, human.schema),

  build(p, style) {
    p = applyRules({ ...p }, human.schema); // older saved settings may break a rule
    const root = new THREE.Group();
    root.name = 'human';
    const f = measure(p);
    const top = TOPS[p.top] ?? TOPS['T-shirt'];
    const mats = {
      skin: style.material('skin', SKIN_TONES[p.skin]),
      hair: style.material('hair', HAIR_COLORS[p.hairColor]),
      // stubble: hair seen through the skin, so a shadow between the two colours
      stubble: style.material('skin', new THREE.Color(SKIN_TONES[p.skin]).lerp(new THREE.Color(HAIR_COLORS[p.hairColor]), 0.5).getHex()),
      top: style.material('cloth', CLOTH_COLORS[p.topColor]),
      legwear: style.material('clothAlt', CLOTH_COLORS[p.legwearColor]),
      shoe: style.material('shoe', CLOTH_COLORS[p.shoeColor]),
      accent: style.material('accent', accentFor(p.topColor)),
      headwear: style.material('cloth', CLOTH_COLORS[p.headwearColor]),
      frame: style.material('accent', CLOTH_COLORS[p.accessoryColor]),
      mask: style.material('cloth', CLOTH_COLORS[p.maskColor ?? p.accessoryColor] ?? CLOTH_COLORS[p.accessoryColor]),
      lens: style.material('accent', 0x16161c),
      band: style.material('accent', CLOTH_COLORS.Black),
      outer: style.material('cloth', CLOTH_COLORS[p.outerwearColor]),
      back: style.material('cloth', CLOTH_COLORS[p.backColor]),
      backDark: style.material('cloth', new THREE.Color(CLOTH_COLORS[p.backColor]).multiplyScalar(0.72).getHex()),
      babyCloth: style.material('cloth', 0xf3e2a0), // soft yellow baby clothes
      bodyAcc: style.material('cloth', CLOTH_COLORS[p.bodyAccessoryColor]),
      trim: style.material('accent', 0x2a2a30),           // straps, belts, strings
      wings: style.material('accent', p.backAccessory === 'Evil wings' ? 0x3a1424 : 0xf4f4f0),
      handItem: style.material('cloth', CLOTH_COLORS[p.handItemColor] ?? CLOTH_COLORS.Brown),
      // uniform and robe details
      sailorCollar: style.material('cloth', 0x2c3652),
      sailorTrim: style.material('cloth', 0xf2f2ee),
      sailorScarf: style.material('accent', 0xd8443c),
      gold: style.material('accent', 0xd9b44a),
      obi: style.material('clothAlt', CLOTH_COLORS[p.legwearColor]), // a yukata's sash uses the legwear colour
    };
    f.mats = mats;

    // --- spine joint -------------------------------------------------------
    // Everything above the hips (torso, outer layer, neck, arms, accessories,
    // head) hangs from a spine joint at hip height, so the upper body can lean
    // and twist over the legs. `upper` shifts back down so parts are built in
    // body space as before.
    const spine = new THREE.Group();
    spine.name = 'spine';
    spine.position.y = f.hipY;
    root.add(spine);
    const upper = new THREE.Group();
    upper.position.y = -f.hipY;
    spine.add(upper);
    // grandparents stand with a gentle stoop (kept while walking, anim/gait.js)
    if (isElderly(p)) root.userData.stoop = 0.2;

    // --- torso + neck ----------------------------------------------------
    upper.add(buildTorso(f, top, mats));
    const hasOuter = p.outerwear && p.outerwear !== 'None';
    // long, loose hair hangs over the folded hood and would hide it anyway
    f.hideHood = /^long(?! · (ponytail|high ponytail|braid|twin tails))/.test(p.hair ?? '');
    if (hasOuter) upper.add(buildOuterwear(f, p.outerwear, mats));
    const neckBottom = f.shoulderY - f.torsoLen * 0.05;
    const neckTop = f.headY - f.R * 0.4;
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(f.neckR, f.neckR, neckTop - neckBottom, seg(14)), mats.skin);
    neck.position.y = (neckTop + neckBottom) / 2;
    upper.add(neck);

    // --- legs (pivot at hip, for later animation) ------------------------
    const robe = top.yukata; // a yukata reaches the ankles; legwear doesn't show
    for (const sx of [-1, 1]) root.add(buildLeg(f, robe ? 'Robe' : p.legwear, mats, sx, p.footwear));
    // the skirt hangs from the spine joint, so it leans and twists with the hips
    if (robe) upper.add(buildSkirt(f, mats, { robe: true }));
    else if (p.legwear === 'Skirt') upper.add(buildSkirt(f, mats));

    // --- arms (pivot at shoulder) ----------------------------------------
    let held = null;
    for (const sx of [-1, 1]) {
      const arm = buildArm(f, sx, top, mats, (t) => t.sleeve, hasOuter ? mats.outer : null);
      // something carried in the right hand swings with the forearm
      if (sx < 0) {
        const { grip, dir } = handGrip(f, sx);
        const item = buildHandItem(f, p.handItem, mats.handItem, grip, dir, style);
        if (item && !item.userData.upright) arm.getObjectByName('foreR').add(item);
        else if (item) held = { item, grip, fore: arm.getObjectByName('foreR') };
      }
      upper.add(arm);
    }
    // a held item (open umbrella, phone, ...): pose the arms, then fix the
    // item to the forearm upright, as it sits in that pose (HOLD_POSES)
    if (held && HOLD_POSES[p.handItem]) placeHeld(root, held.fore, held.item, held.grip, HOLD_POSES[p.handItem]);

    // --- accessories -------------------------------------------------------
    upper.add(buildBackAccessory(f, p.backAccessory, mats));
    upper.add(buildBodyAccessory(f, p.bodyAccessory, mats));

    // --- head ------------------------------------------------------------
    const head = new THREE.Group();
    head.name = 'head';
    head.position.y = f.headY;
    head.add(new THREE.Mesh(headGeometry(f), mats.skin)); // shaped like a head, not a ball
    f.hood = p.outerwear === 'Hoodie'; // long hair lies over the folded hood
    const hair = hairUnder(p.headwear, p.hair);
    head.add(buildHair(f, hair, mats.hair, { underHat: coversHair(p.headwear) }));
    // older saves kept the mask in the glasses slot
    const mask = p.faceAccessory === 'Flu mask' ? 'Flu mask' : (p.mask ?? 'None');
    const eyewear = p.faceAccessory === 'Flu mask' ? 'None' : p.faceAccessory;
    // a mask covers the lower face: the beard and moustache are hidden under it
    if (mask === 'None') head.add(buildFacialHair(f, p.beard, p.moustache, mats.hair, mats.stubble));
    head.add(buildHeadwear(f, p.headwear, mats.headwear, hair));
    head.add(buildFaceAccessory(f, eyewear, mats));
    head.add(buildFaceAccessory(f, mask, mats)); // worn together with glasses
    upper.add(head);
    if (root.userData.stoop && !root.userData.hold) poseHold(root, {}); // show the stoop at rest

    return root;
  },
};

/** Pose the arms for `hold` and fix `item` (built upright) to the forearm `fore`, at `grip`. */
function placeHeld(root, fore, item, grip, hold) {
  root.userData.hold = hold;
  poseHold(root, hold);
  root.updateMatrixWorld(true);
  const at = root.worldToLocal(fore.localToWorld(grip.clone()));
  if (hold.centre) at.x = 0; // between both hands
  root.localToWorld(at);
  item.position.copy(fore.worldToLocal(at));
  // upright relative to the body, whatever the arm's angle
  const q = new THREE.Quaternion();
  item.quaternion.copy(fore.getWorldQuaternion(q).invert().multiply(root.getWorldQuaternion(new THREE.Quaternion())));
  fore.add(item);
}

/**
 * Give an already built character something to hold (a HOLD_POSES item, e.g.
 * 'Umbrella (open)' when it starts to rain), posing its arms. Works on skinned
 * people too (their joints stay). Returns a function that takes it away again.
 */
export function giveHeldItem(root, p, kind, color, style) {
  const hold = HOLD_POSES[kind];
  const fore = root.getObjectByName('foreR');
  if (!hold || !fore) return null;
  const f = measure(p);
  f.mats = { trim: style.material('accent', 0x2a2a30) };
  const { grip, dir } = handGrip(f, -1);
  const raw = buildHandItem(f, kind, style.material('cloth', CLOTH_COLORS[color] ?? CLOTH_COLORS.Blue), grip, dir, style);
  const item = mergeByMaterial(raw); // a few draw calls, not one per part
  const before = root.userData.hold;
  placeHeld(root, fore, item, grip, hold);
  return () => {
    fore.remove(item);
    item.traverse((o) => o.geometry?.dispose());
    if (before) root.userData.hold = before; else delete root.userData.hold;
  };
}

// the schema's defaults are the Man's default design
for (const [k, v] of Object.entries(BODY_DEFAULTS.Man)) if (human.schema[k]) human.schema[k].value = v;
