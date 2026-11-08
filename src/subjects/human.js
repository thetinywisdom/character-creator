import * as THREE from 'three';
import { ellipsoid, seg } from '../lib/shapes.js';
import { CLOTH_COLORS, HAIR_COLORS, SKIN_TONES } from '../styles/palette.js';
import { measure } from './human/frame.js';
import { HAIRSTYLES, buildHair } from './human/hair.js';
import { TOPS, buildTorso } from './human/tops.js';
import { buildArm } from './human/arms.js';
import { FOOTWEAR } from './human/footwear.js';
import { OUTERWEAR, buildOuterwear } from './human/outerwear.js';
import { BACK_ACCESSORIES, BODY_ACCESSORIES, buildBackAccessory, buildBodyAccessory } from './human/accessories.js';
import { BEARDS, FACE_ACCESSORIES, HEADWEAR, MOUSTACHES, buildFaceAccessory, buildFacialHair, buildHeadwear, coversHair, hairUnder } from './human/head.js';
import { LEGWEAR, buildBottom, buildLeg, buildSkirt } from './human/legwear.js';

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
    bodyType:      { group: 'Body', value: 'Man', options: ['Man', 'Woman'], label: 'Body type' },
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
    chestShape:    { group: 'Body shape (woman)', value: 'Smooth (two)', options: ['Smooth (two)', 'Smooth', 'Wedge'], label: 'Chest shape' },
    chestSize:     { group: 'Body shape (woman)', value: 1, min: 0, max: 1.6, step: 0.05, label: 'Chest size' },
    bottomShape:   { group: 'Body shape (woman)', value: 'Smooth (two)', options: ['Smooth (two)', 'Smooth', 'Round'], label: 'Bottom shape' },
    bottomSize:    { group: 'Body shape (woman)', value: 1, min: 0, max: 1.6, step: 0.05, label: 'Bottom size' },
    // head
    hair:          { group: 'Hair', value: 'short', options: HAIRSTYLES, label: 'Hairstyle' },
    hairColor:     { group: 'Hair', value: 'Dark brown', options: names(HAIR_COLORS), label: 'Hair colour' },
    beard:         { group: 'Hair', value: 'None', options: BEARDS, label: 'Beard' },
    moustache:     { group: 'Hair', value: 'None', options: MOUSTACHES, label: 'Moustache' },
    // head items
    headwear:      { group: 'Head', value: 'None', options: HEADWEAR, label: 'Headwear' },
    headwearColor: { group: 'Head', value: 'Red', options: names(CLOTH_COLORS), label: 'Headwear colour' },
    faceAccessory: { group: 'Head', value: 'None', options: FACE_ACCESSORIES, label: 'Face accessory' },
    accessoryColor:{ group: 'Head', value: 'Black', options: names(CLOTH_COLORS), label: 'Frame / mask colour' },
    // accessories
    backAccessory: { group: 'Accessories', value: 'None', options: BACK_ACCESSORIES, label: 'On the back' },
    backColor:     { group: 'Accessories', value: 'Orange', options: names(CLOTH_COLORS), label: 'Backpack colour' },
    bodyAccessory: { group: 'Accessories', value: 'None', options: BODY_ACCESSORIES, label: 'On the body' },
    bodyAccessoryColor: { group: 'Accessories', value: 'Red', options: names(CLOTH_COLORS), label: 'Accessory colour' },
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
    // body types with matching proportions
    Man:       { bodyType: 'Man',   height: 1.78, legLength: 0.54, shoulderWidth: 0.27, hipWidth: 0.18, neckThickness: 0.034, armThickness: 0.029, legThickness: 0.037, headWidth: 0.8 },
    Woman:     { bodyType: 'Woman', height: 1.68, legLength: 0.58, shoulderWidth: 0.22, hipWidth: 0.23, neckThickness: 0.023, armThickness: 0.023, legThickness: 0.033, headWidth: 0.78 },
    // overall proportion styles
    Chibi:     { headsTall: 2.6, legLength: 0.42, shoulderWidth: 0.2,  hipWidth: 0.18, neckThickness: 0.04,  armThickness: 0.035, legThickness: 0.045, headWidth: 0.95 },
    Stylized:  { headsTall: 5,   legLength: 0.5,  shoulderWidth: 0.24, hipWidth: 0.19, neckThickness: 0.035, armThickness: 0.03,  legThickness: 0.039, headWidth: 0.85 },
    Realistic: { headsTall: 7.5, legLength: 0.54, shoulderWidth: 0.25, hipWidth: 0.2,  neckThickness: 0.03,  armThickness: 0.026, legThickness: 0.034, headWidth: 0.8 },
  },

  /** A random but believable character (realistic proportions, varied outfit). */
  randomize(rng = Math.random) {
    const pick = (arr) => arr[Math.floor(rng() * arr.length)];
    const range = (a, b, step) => Math.round((a + (b - a) * rng()) / step) * step;
    const topColor = pick(names(CLOTH_COLORS));
    let legwearColor;
    do {
      legwearColor = pick(['Denim', 'Denim', 'Navy', 'Black', 'Khaki', 'Gray', 'Brown', ...names(CLOTH_COLORS)]);
    } while (legwearColor === topColor);
    const woman = rng() < 0.5;
    return {
      bodyType: woman ? 'Woman' : 'Man',
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
      hair: pick(['short', 'short', 'medium', 'long', 'long', 'bun', 'spiky', 'mohawk', 'curly', 'afro', 'bald']),
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
      outerwear: rng() < 0.3 ? pick(OUTERWEAR.slice(1)) : 'None',
      outerwearColor: pick(names(CLOTH_COLORS)),
      backAccessory: rng() < 0.25 ? pick(['Backpack', 'Backpack', 'Backpack', 'Angel wings', 'Evil wings']) : 'None',
      backColor: pick(names(CLOTH_COLORS)),
      bodyAccessory: rng() < 0.25 ? pick(BODY_ACCESSORIES.slice(1)) : 'None',
      bodyAccessoryColor: pick(names(CLOTH_COLORS)),
      beard: !woman && rng() < 0.35 ? pick(BEARDS.slice(1)) : 'None',
      moustache: !woman && rng() < 0.3 ? pick(MOUSTACHES.slice(1)) : 'None',
      shoeColor: pick(['Black', 'Brown', 'White', 'Gray', 'Red', 'Navy']),
    };
  },

  build(p, style) {
    const root = new THREE.Group();
    root.name = 'human';
    const f = measure(p);
    const top = TOPS[p.top] ?? TOPS['T-shirt'];
    const mats = {
      skin: style.material('skin', SKIN_TONES[p.skin]),
      hair: style.material('hair', HAIR_COLORS[p.hairColor]),
      top: style.material('cloth', CLOTH_COLORS[p.topColor]),
      legwear: style.material('clothAlt', CLOTH_COLORS[p.legwearColor]),
      shoe: style.material('shoe', CLOTH_COLORS[p.shoeColor]),
      accent: style.material('accent', accentFor(p.topColor)),
      headwear: style.material('cloth', CLOTH_COLORS[p.headwearColor]),
      frame: style.material('accent', CLOTH_COLORS[p.accessoryColor]),
      mask: style.material('cloth', CLOTH_COLORS[p.accessoryColor]),
      lens: style.material('accent', 0x16161c),
      band: style.material('accent', CLOTH_COLORS.Black),
      outer: style.material('cloth', CLOTH_COLORS[p.outerwearColor]),
      back: style.material('cloth', CLOTH_COLORS[p.backColor]),
      backDark: style.material('cloth', new THREE.Color(CLOTH_COLORS[p.backColor]).multiplyScalar(0.72).getHex()),
      babyCloth: style.material('cloth', 0xf3e2a0), // soft yellow baby clothes
      bodyAcc: style.material('cloth', CLOTH_COLORS[p.bodyAccessoryColor]),
      trim: style.material('accent', 0x2a2a30),           // straps, belts, strings
      wings: style.material('accent', p.backAccessory === 'Evil wings' ? 0x3a1424 : 0xf4f4f0),
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

    // --- torso + neck ----------------------------------------------------
    upper.add(buildTorso(f, top, mats));
    const hasOuter = p.outerwear && p.outerwear !== 'None';
    if (hasOuter) upper.add(buildOuterwear(f, p.outerwear, mats));
    const neckBottom = f.shoulderY - f.torsoLen * 0.05;
    const neckTop = f.headY - f.R * 0.4;
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(f.neckR, f.neckR, neckTop - neckBottom, seg(14)), mats.skin);
    neck.position.y = (neckTop + neckBottom) / 2;
    upper.add(neck);

    // --- legs (pivot at hip, for later animation) ------------------------
    for (const sx of [-1, 1]) root.add(buildLeg(f, p.legwear, mats, sx, p.footwear));
    if (p.legwear === 'Skirt') root.add(buildSkirt(f, mats));
    else if (f.woman && f.bottomShape === 'Round') root.add(buildBottom(f, mats));

    // --- arms (pivot at shoulder) ----------------------------------------
    for (const sx of [-1, 1]) upper.add(buildArm(f, sx, top, mats, (t) => t.sleeve, hasOuter ? mats.outer : null));

    // --- accessories -------------------------------------------------------
    upper.add(buildBackAccessory(f, p.backAccessory, mats));
    upper.add(buildBodyAccessory(f, p.bodyAccessory, mats));

    // --- head ------------------------------------------------------------
    const head = new THREE.Group();
    head.name = 'head';
    head.position.y = f.headY;
    head.add(ellipsoid(1, [f.rx, f.ry, f.rz], mats.skin));
    const hair = hairUnder(p.headwear, p.hair);
    head.add(buildHair(f, hair, mats.hair, { underHat: coversHair(p.headwear) }));
    head.add(buildFacialHair(f, p.beard, p.moustache, mats.hair));
    head.add(buildHeadwear(f, p.headwear, mats.headwear, hair));
    head.add(buildFaceAccessory(f, p.faceAccessory, mats));
    upper.add(head);

    return root;
  },
};
