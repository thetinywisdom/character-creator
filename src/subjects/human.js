import * as THREE from 'three';
import { capsuleBetween, ellipsoid, seg } from '../lib/shapes.js';
import { CLOTH_COLORS, HAIR_COLORS, SKIN_TONES } from '../styles/palette.js';
import { measure } from './human/frame.js';
import { HAIRSTYLES, buildHair } from './human/hair.js';
import { TOPS, buildSleeve, buildTorso } from './human/tops.js';
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
    // head
    hair:          { group: 'Hair', value: 'short', options: HAIRSTYLES, label: 'Hairstyle' },
    hairColor:     { group: 'Hair', value: 'Dark brown', options: names(HAIR_COLORS), label: 'Hair colour' },
    // clothes
    top:           { group: 'Clothes', value: 'T-shirt', options: names(TOPS), label: 'Top' },
    topColor:      { group: 'Clothes', value: 'Blue', options: names(CLOTH_COLORS), label: 'Top colour' },
    legwear:       { group: 'Clothes', value: 'Trousers', options: LEGWEAR, label: 'Legwear' },
    legwearColor:  { group: 'Clothes', value: 'Navy', options: names(CLOTH_COLORS), label: 'Legwear colour' },
    shoeColor:     { group: 'Clothes', value: 'Brown', options: names(CLOTH_COLORS), label: 'Shoe colour' },
  },
  presets: {
    // body types with matching proportions
    Man:       { bodyType: 'Man',   height: 1.75, legLength: 0.54, shoulderWidth: 0.26, hipWidth: 0.19, neckThickness: 0.031, armThickness: 0.027, legThickness: 0.035, headWidth: 0.8 },
    Woman:     { bodyType: 'Woman', height: 1.68, legLength: 0.58, shoulderWidth: 0.22, hipWidth: 0.23, neckThickness: 0.023, armThickness: 0.021, legThickness: 0.033, headWidth: 0.78 },
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
      shoulderWidth: woman ? range(0.2, 0.24, 0.005) : range(0.24, 0.29, 0.005),
      hipWidth: woman ? range(0.21, 0.25, 0.005) : range(0.17, 0.21, 0.005),
      neckThickness: woman ? range(0.021, 0.026, 0.001) : range(0.028, 0.035, 0.001),
      armThickness: woman ? range(0.019, 0.024, 0.001) : range(0.024, 0.031, 0.001),
      legThickness: woman ? range(0.03, 0.036, 0.001) : range(0.031, 0.038, 0.001),
      headWidth: range(0.76, 0.86, 0.01),
      skin: pick(names(SKIN_TONES)),
      hair: pick(['short', 'short', 'medium', 'long', 'long', 'bun', 'spiky', 'mohawk', 'curly', 'afro', 'bald']),
      hairColor: pick(['Black', 'Black', 'Dark brown', 'Dark brown', 'Brown', 'Blonde', 'Red', 'Gray', 'Pink', 'Blue']),
      top: pick(names(TOPS)),
      topColor,
      legwear: pick(['Trousers', 'Trousers', 'Shorts', 'Skirt']),
      legwearColor,
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
    };

    // --- torso + neck ----------------------------------------------------
    root.add(buildTorso(f, top, mats));
    const neckBottom = f.shoulderY - f.torsoLen * 0.05;
    const neckTop = f.headY - f.R * 0.4;
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(f.neckR, f.neckR, neckTop - neckBottom, seg(14)), mats.skin);
    neck.position.y = (neckTop + neckBottom) / 2;
    root.add(neck);

    // --- legs (pivot at hip, for later animation) ------------------------
    for (const sx of [-1, 1]) root.add(buildLeg(f, p.legwear, mats, sx));
    if (p.legwear === 'Skirt') root.add(buildSkirt(f, mats));
    else if (f.woman) root.add(buildBottom(f, mats));

    // --- arms (pivot at shoulder) ----------------------------------------
    for (const sx of [-1, 1]) {
      const arm = new THREE.Group();
      arm.name = sx < 0 ? 'armR' : 'armL';
      arm.position.set(sx * (f.sw * 0.5 - f.armR * 0.6), f.shoulderY - f.armR * 0.9, 0);
      arm.rotation.z = sx * f.armSpread;
      arm.add(capsuleBetween([0, 0, 0], [0, -(f.armLen - f.handR * 1.6), 0], f.armR, mats.skin));
      const sleeve = buildSleeve(f, top, mats.top);
      if (sleeve) arm.add(sleeve);
      arm.add(ellipsoid(f.handR, [0.8, 1.15, 0.9], mats.skin, { position: [0, -(f.armLen - f.handR), 0] }));
      root.add(arm);
    }

    // --- head ------------------------------------------------------------
    const head = new THREE.Group();
    head.name = 'head';
    head.position.y = f.headY;
    head.add(ellipsoid(1, [f.rx, f.ry, f.rz], mats.skin));
    head.add(buildHair(f, p.hair, mats.hair));
    root.add(head);

    return root;
  },
};
