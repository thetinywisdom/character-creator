import * as THREE from 'three';
import { CLOTH_COLORS, HAIR_COLORS, SKIN_TONES } from '../../styles/palette.js';
import { coversHair, hairUnder } from './head.js';

// The iso-city human (owner: "my previous attempt on human is better: follow
// what I was doing there", github.com/thetinywisdom/iso-city,
// characters/characters.js). Ported shape for shape: a smooth lathed torso,
// an egg-shaped head with no eyes (a nose wedge with its hooked line, a "C"
// line in each ear), big flat paddle hands, simple tapered limbs, wedge shoes,
// clothes as shells grown out of the torso profile, hair as a cap over the
// head plus blobs, spikes and curls. Flat shaded (faceted), like the original.
//
// It keeps OUR rig, so the gait, sitting, riding and hits work unchanged:
// root 'human' > spine (hip height) > upper (back to body space) > torso,
// arms (armL/R > foreL/R), head; legL/R > shinL/R > footL/R with
// footL.userData.sole = [heel, toe]. Built in iso-city units (about 2 tall),
// then every position and geometry is scaled to the person's height in metres.
//
// Every setting of the character creator has an iso-city version: all tops
// (the yukata a robe to the ankles), outer layers as open or closed shells,
// shoes / boots, every hat, glasses, the flu mask, beards and moustaches,
// backpack and wings (wingL / wingR, flapped by the gait), body accessories.
// Hand items are our own (handheld.js), put in the paddle hand by human.build
// (root.userData.isoHand). Our sliders scale iso-city's body: the Man's
// defaults are iso-city's proportions (REF). Build thickness is put into the
// limb shapes, not the joints, so bent knees and elbows never shear.

// ---------- iso-city proportions (about 6.5 heads tall, long legs) ----------
const HIP_Y = 0.9, HIP_X = 0.088, THIGH = 0.42, SHIN = 0.40;
const SHOULDER_Y = 1.572, SHOULDER_X = 0.205, UPPER = 0.40, FORE = 0.31;
const NECK_Y = 1.62, HEAD_C = 0.215;
const TORSO_Z = 0.72, HEAD_Z = 1.08;
const TOTAL = NECK_Y + HEAD_C + 0.163; // top of the head
const TORSO = [[0, 0.84], [0.15, 0.845], [0.168, 0.9], [0.17, 1.0], [0.163, 1.15], [0.172, 1.35],
  [0.18, 1.48], [0.182, 1.58], [0.15, 1.645], [0.07, 1.675], [0, 1.68]];
const HEAD = [[0, -0.15], [0.06, -0.145], [0.093, -0.108], [0.106, -0.045], [0.11, 0.03],
  [0.103, 0.09], [0.08, 0.135], [0.042, 0.158], [0, 0.163]];
const ANKLE_H = HIP_Y - THIGH - SHIN; // the sole is this far below the ankle

// our hair styles -> the nearest iso-city style
export const HAIR_MAP = {
  bald: 'none', short: 'sideswept', 'short · side part': 'sideswept', 'short · buzz cut': 'buzz',
  'short · undercut': 'slicked', 'short · quiff': 'quiff', 'short · bowl cut': 'curtains', 'short · messy': 'spiky',
  medium: 'bob', 'medium · bob': 'bob', 'medium · curtains': 'curtains', 'medium · wavy': 'curlyLong',
  'medium · shag': 'pixie', 'medium · half-up': 'bob',
  long: 'longStraight', 'long · ponytail': 'ponytail', 'long · high ponytail': 'ponytail', 'long · twin tails': 'braids',
  'long · braid': 'braids', 'long · wavy': 'curlyLong', 'long · side-swept': 'long',
  bun: 'bun', spiky: 'spiky', mohawk: 'mohawk', curly: 'curly', afro: 'afro',
};

// ---------- helpers (as in iso-city) ----------
const flat = (g) => { const n = g.index ? g.toNonIndexed() : g; n.computeVertexNormals(); return n; };
function lathe(profile, segs, zs = 1, phiStart = 0, phiLength = Math.PI * 2) {
  const g = new THREE.LatheGeometry(profile.map(([r, y]) => new THREE.Vector2(Math.max(r, 0.0001), y)), segs, phiStart, phiLength);
  g.scale(1, 1, zs);
  return g;
}
function clip(profile, y0, y1, grow = 1, yGrow = 1) {
  const at = (y) => {
    for (let i = 0; i < profile.length - 1; i++) {
      const [r0, a] = profile[i], [r1, b] = profile[i + 1];
      if (y >= a && y <= b) return r0 + (r1 - r0) * ((y - a) / (b - a || 1));
    }
    return y < profile[0][1] ? profile[0][0] : profile[profile.length - 1][0];
  };
  const out = [[at(y0), y0]];
  for (const p of profile) if (p[1] > y0 && p[1] < y1) out.push(p);
  out.push([at(y1), y1]);
  return out.map(([r, y]) => [r * grow, y * yGrow]);
}
function limb(rTop, rBot, len, segs = 6, y0 = 0) {
  const g = new THREE.CylinderGeometry(rTop, rBot, len, segs, 1);
  g.translate(0, y0 - len / 2, 0);
  return g;
}
function taperBox(w, h, d, { botX = 1, botZ = 1, frontTopY = 0 } = {}) {
  const g = new THREE.BoxGeometry(w, h, d);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    if (p.getY(i) < 0) { p.setX(i, p.getX(i) * botX); p.setZ(i, p.getZ(i) * botZ); }
    if (frontTopY && p.getZ(i) > 0 && p.getY(i) > 0) p.setY(i, p.getY(i) + frontTopY);
  }
  return g;
}
function mulberry32(seed) {
  let a = (typeof seed === 'string' ? [...seed].reduce((h, c) => (h * 31 + c.charCodeAt(0)) | 0, 7) : seed) >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// reference proportions (the Man's defaults) = iso-city's own body
const REF = { shoulderWidth: 0.27, hipWidth: 0.18, armThickness: 0.029, legThickness: 0.037, headWidth: 0.8, legLength: 0.54, headsTall: 7.5 };
const clampN = (v, a, b) => Math.max(a, Math.min(b, v));

/** Where the right hand holds things, in forearm space (iso rig, metres), and the forearm direction. */
export function isoHandGrip(root) {
  return root.userData.isoGrip ?? { grip: new THREE.Vector3(0, -0.5, 0), dir: new THREE.Vector3(0, -1, 0) };
}

/** Build the iso-city style person for our settings `p`. */
export function buildIsoCityHuman(p, style) {
  // materials from the style (palette, PS1 snapping); double-sided copies for open shells and hair
  const doubles = new Map();
  const two = (m) => {
    if (!doubles.has(m)) {
      const d = m.clone();
      d.side = THREE.DoubleSide;
      d.onBeforeCompile = m.onBeforeCompile;
      d.customProgramCacheKey = m.customProgramCacheKey;
      doubles.set(m, d);
    }
    return doubles.get(m);
  };
  const cloth = (name, fallback) => CLOTH_COLORS[name] ?? fallback;
  const dark = (hex, k = 0.7) => new THREE.Color(hex).multiplyScalar(k).getHex();
  const skinHex = SKIN_TONES[p.skin] ?? SKIN_TONES.Light;
  const hairHex = HAIR_COLORS[p.hairColor] ?? HAIR_COLORS.Black;
  const topHex = cloth(p.topColor, CLOTH_COLORS.White);
  const M = {
    skin: style.material('skin', skinHex),
    line: style.material('skin', dark(skinHex, 0.62)), // nose and ear lines
    stubble: style.material('skin', new THREE.Color(skinHex).lerp(new THREE.Color(hairHex), 0.5).getHex()),
    hair: style.material('hair', hairHex),
    hairAccent: style.material('hair', dark(hairHex)),
    top: style.material('cloth', topHex),
    placket: style.material('accent', dark(topHex)),
    legwear: style.material('clothAlt', cloth(p.legwearColor, CLOTH_COLORS.Navy)),
    shoe: style.material('shoe', cloth(p.shoeColor, CLOTH_COLORS.Brown)),
    outer: style.material('cloth', cloth(p.outerwearColor, CLOTH_COLORS.Gray)),
    outerDark: style.material('cloth', dark(cloth(p.outerwearColor, CLOTH_COLORS.Gray), 0.75)),
    headwear: style.material('cloth', cloth(p.headwearColor, CLOTH_COLORS.Navy)),
    headwearDark: style.material('cloth', dark(cloth(p.headwearColor, CLOTH_COLORS.Navy), 0.7)),
    frame: style.material('accent', cloth(p.accessoryColor, CLOTH_COLORS.Black)),
    lens: style.material('accent', 0x16161c),
    mask: style.material('cloth', cloth(p.maskColor ?? p.accessoryColor, CLOTH_COLORS.White)),
    back: style.material('cloth', cloth(p.backColor, CLOTH_COLORS.Black)),
    backDark: style.material('cloth', dark(cloth(p.backColor, CLOTH_COLORS.Black), 0.72)),
    bodyAcc: style.material('cloth', cloth(p.bodyAccessoryColor, CLOTH_COLORS.Red)),
    trim: style.material('accent', 0x2a2a30),
    white: style.material('cloth', 0xf2f2ee),
    navy: style.material('cloth', 0x2c3652),
    red: style.material('accent', 0xd8443c),
    gold: style.material('accent', 0xd9b44a),
    babyCloth: style.material('cloth', 0xf3e2a0),
    wings: style.material('accent', p.backAccessory === 'Evil wings' ? 0x3a1424 : 0xf4f4f0),
    handItem: style.material('cloth', cloth(p.handItemColor, CLOTH_COLORS.Brown)),
  };
  const mesh = (geo, m, parent, { double = false, pos, rot, scale } = {}) => {
    const o = new THREE.Mesh(flat(geo), double ? two(m) : m);
    if (pos) o.position.set(...pos);
    if (rot) o.rotation.set(...rot);
    if (scale) o.scale.set(...scale);
    parent.add(o);
    return o;
  };
  const group = (parent, x = 0, y = 0, z = 0, name = '') => {
    const g = new THREE.Group(); g.position.set(x, y, z); if (name) g.name = name; parent.add(g); return g;
  };

  const kid = p.bodyType === 'Boy' || p.bodyType === 'Girl';
  const woman = p.bodyType === 'Woman' || p.bodyType === 'Girl' || p.bodyType === 'Grandma';
  const elderly = p.bodyType === 'Grandpa' || p.bodyType === 'Grandma';

  // --- proportions from our sliders (the Man's defaults = iso-city's body) ---
  const b = { Skinny: 0.9, Normal: 1, Bulky: 1.12, Fat: 1.2 }[p.build] ?? 1;
  const S = {
    sh: (1 + (b - 1) * 0.8) * clampN((p.shoulderWidth ?? REF.shoulderWidth) / REF.shoulderWidth, 0.85, 1.2),
    hip: (1 + (b - 1) * 0.6) * clampN((p.hipWidth ?? REF.hipWidth) / REF.hipWidth, 0.85, 1.22),
    tx: b, tz: (1 + (b - 1) * 0.7) * (p.build === 'Fat' ? 1.08 : 1),
    leg: (1 + (b - 1) * 0.8) * clampN((p.legThickness ?? REF.legThickness) / REF.legThickness, 0.8, 1.45),
    arm: (1 + (b - 1) * 0.6) * clampN((p.armThickness ?? REF.armThickness) / REF.armThickness, 0.8, 1.45),
  };
  const legK = clampN((p.legLength ?? REF.legLength) / REF.legLength, 0.8, 1.15);       // longer / shorter legs
  const headK = clampN(REF.headsTall / (p.headsTall ?? REF.headsTall), 0.9, 1.7);       // bigger heads: children, chibi
  const headW = clampN((p.headWidth ?? REF.headWidth) / REF.headWidth, 0.85, 1.2);
  const hipY = HIP_Y * legK, thigh = THIGH * legK, shin = SHIN * legK;

  // --- skeleton: our joint names, iso-city positions ------------------------
  const root = new THREE.Group();
  root.name = 'human';
  const spine = group(root, 0, hipY, 0, 'spine');
  const upper = group(spine, 0, -HIP_Y, 0);  // the upper body is built in iso-city's own coordinates
  const T = group(upper);                     // torso parts
  if (elderly) root.userData.stoop = 0.2;
  T.scale.set(S.tx, 1, S.tz);
  // the woman's torso: a softer waist, fuller hips and chest
  const TORSO_B = woman ? TORSO.map(([r, y]) => [r * (y > 0.88 && y < 1.02 ? 1.05 : y > 1.08 && y < 1.25 ? 0.9 : y > 1.3 && y < 1.5 ? 1.04 : 1), y]) : TORSO;

  // torso + neck (skin), shirt shells go over them
  mesh(lathe(TORSO_B, 8, TORSO_Z), M.skin, T);
  mesh(limb(0.048, 0.052, 0.14, 6, 1.73), M.skin, upper);

  // head: egg shape, ears with the "C" line, the nose wedge and its hooked line; no eyes
  const head = group(upper, 0, NECK_Y, 0, 'head');
  const hc = group(head, 0, HEAD_C * headK, 0);
  hc.scale.set(headK * headW, headK, headK);
  mesh(lathe(HEAD, 8, HEAD_Z), M.skin, hc);
  for (const sx of [-1, 1]) {
    mesh(new THREE.SphereGeometry(0.03, 5, 4), M.skin, hc, { pos: [sx * 0.11, 0.0, -0.005], scale: [0.5, 1, 0.75] });
    mesh(new THREE.TorusGeometry(0.012, 0.0028, 3, 5, Math.PI * 1.3), M.line, hc,
      { pos: [sx * 0.1255, 0.0, -0.004], rot: [0, sx * Math.PI / 2, Math.PI * 0.35 * (sx > 0 ? 1 : -1) + (sx > 0 ? 0 : Math.PI)] });
  }
  const nose = new THREE.ConeGeometry(0.017, 0.045, 4); nose.rotateX(Math.PI / 2 + 0.5);
  mesh(nose, M.skin, hc, { pos: [0, -0.012, 0.12] });
  mesh(new THREE.BoxGeometry(0.0045, 0.04, 0.0045), M.line, hc, { pos: [0.012, -0.006, 0.128], rot: [0.35, 0, 0.15] });
  mesh(new THREE.BoxGeometry(0.02, 0.0045, 0.0045), M.line, hc, { pos: [0.006, -0.028, 0.134] });

  // arms: shoulder -> elbow -> wrist, big flat paddle hands
  const arms = {};
  const limbParts = [];  // meshes whose thickness follows the build (scaled in their own x / z)
  for (const [side, sx] of [['L', 1], ['R', -1]]) {
    const sh = arms[side] = group(upper, sx * SHOULDER_X * S.sh, SHOULDER_Y, 0, `arm${side}`);
    sh.rotation.z = sx * (0.06 + 0.05 * (b - 1) * 4 * (b > 1 ? 1 : 0)); // heavier builds hold their arms out a little
    limbParts.push([mesh(new THREE.SphereGeometry(0.05, 6, 4), M.skin, sh, { scale: [1, 0.85, 0.9] }), S.arm]);
    limbParts.push([mesh(limb(0.052, 0.045, UPPER, 6), M.skin, sh), S.arm]);
    const el = group(sh, 0, -UPPER, 0, `fore${side}`);
    limbParts.push([mesh(limb(0.045, 0.036, FORE, 6), M.skin, el), S.arm]);
    const wr = group(el, 0, -FORE, 0);
    const hg = group(wr); hg.rotation.y = sx * 0.9;   // palm turned half toward the viewer, like the art
    const hand = taperBox(0.04, 0.19, 0.115, { botX: 0.8, botZ: 0.85 });
    hand.translate(0, -0.085, 0.006);
    mesh(hand, M.skin, hg);
    mesh(new THREE.BoxGeometry(0.03, 0.085, 0.032), M.skin, hg, { pos: [-sx * 0.012, -0.055, 0.062], rot: [0.55, 0, 0] });
    for (const dz of [-0.02, 0.0, 0.02])
      mesh(new THREE.BoxGeometry(0.005, 0.075, 0.005), M.line, hg, { pos: [sx * 0.019, -0.13, dz] });
  }

  // legs: hip -> knee -> ankle
  const legs = {};
  for (const [side, sx] of [['L', 1], ['R', -1]]) {
    const hip = group(root, sx * HIP_X * S.hip, hipY, 0, `leg${side}`);
    const knee = group(hip, 0, -thigh, 0, `shin${side}`);
    const ankle = group(knee, 0, -shin, 0, `foot${side}`);
    // heel and toe of the sole, in ankle space (the gait plants these)
    ankle.userData.sole = [new THREE.Vector3(0, -ANKLE_H, 0.045 - 0.125), new THREE.Vector3(0, -ANKLE_H, 0.045 + 0.125)];
    legs[side] = { hip, knee, ankle };
  }

  // --- clothes ---------------------------------------------------------------
  const shell = (y0, grow = 1.07, hemFlare = 0.012, close = true, y1 = 1.672) => {
    const pr = clip(TORSO_B, Math.max(y0, 0.9), y1, grow);
    if (y0 < 0.9) pr.unshift([0.168 * grow + 0.012, y0]);
    pr[0] = [pr[0][0] + hemFlare, pr[0][1] - 0.01];
    if (close) pr.unshift([0, pr[0][1] + 0.005]);
    if (y1 >= 1.672) pr.push([0.055, 1.684]);
    return pr;
  };
  const sleeves = (m, upperLen, foreLen = 0, r = [0.066, 0.06], puff = false) => {
    for (const side of ['L', 'R']) {
      const sh = arms[side];
      limbParts.push([mesh(new THREE.SphereGeometry(r[0] + 0.003, 7, 3, 0, Math.PI * 2, 0, Math.PI / 2), m, sh, { scale: [1, 0.8, 1] }), S.arm]);
      limbParts.push([mesh(limb(r[0], puff ? r[1] + 0.02 : r[1], upperLen, 7, 0.0), m, sh), S.arm]);
      if (foreLen) limbParts.push([mesh(limb(r[1] - 0.004, r[1] - 0.008, foreLen, 7, 0.01), m, sh.getObjectByName(`fore${side}`)), S.arm]);
    }
  };
  const frontLine = (profile, y0, y1, m, x = 0, w = 0.008, push = 0.004) => {
    const pts = clip(profile, y0, y1);
    for (let i = 0; i < pts.length - 1; i++) {
      const [ra, ya] = pts[i], [rb, yb] = pts[i + 1];
      const za = Math.sqrt(Math.max(ra * ra - x * x, 0)) * TORSO_Z + push;
      const zb = Math.sqrt(Math.max(rb * rb - x * x, 0)) * TORSO_Z + push;
      const len = Math.hypot(yb - ya, zb - za);
      const o = mesh(new THREE.BoxGeometry(w, len, w), m, T);
      o.position.set(x, (ya + yb) / 2, (za + zb) / 2);
      o.rotation.x = -Math.atan2(zb - za, yb - ya);
    }
  };
  const buttons = (m, ys) => { for (const y of ys) mesh(new THREE.BoxGeometry(0.018, 0.018, 0.01), m, T, { pos: [0, y, (y > 1.4 ? 0.128 : 0.123) * 1.07] }); };

  const top = p.top ?? 'T-shirt';
  const outer = p.outerwear && p.outerwear !== 'None' ? p.outerwear : null;
  const legwear = p.legwear ?? 'Trousers';
  const robe = top === 'Yukata';
  // the hem sits a little high and flares, so thighs swinging forward stay under it
  const HEM = 0.9;
  if (robe) {
    // yukata: a robe to the ankles, wide sleeves, the obi in the legwear colour
    mesh(lathe([[0, 0.1], [0.2, 0.1], [0.21, 0.4], [0.2, 0.8], [0.185, 1.05], [0.19, 1.35], [0.196, 1.5], [0.19, 1.6], [0.13, 1.67], [0.06, 1.69]], 10, 0.86), M.top, T, { double: true });
    for (const sx of [-1, 1]) mesh(new THREE.BoxGeometry(0.012, 0.36, 0.012), M.placket, T, { pos: [sx * 0.04, 1.45, 0.145], rot: [0.1, 0, sx * -0.35] });
    mesh(lathe(clip(TORSO_B, 1.02, 1.17, 1.12), 8, TORSO_Z), M.legwear, T);
    sleeves(M.top, UPPER, 0.14, [0.075, 0.07], true);
  } else if (/^Shirt|Police uniform/.test(top)) {
    // button shirt: placket, collar points, collar band
    const prof = shell(HEM, 1.07, 0.02);
    mesh(lathe(prof, 8, TORSO_Z), M.top, T);
    frontLine(prof, HEM, 1.64, M.placket);
    for (const sx of [-1, 1])
      mesh(new THREE.BoxGeometry(0.05, 0.035, 0.01), M.top, T, { pos: [sx * 0.03, 1.69, 0.062], rot: [-0.9, 0, sx * -0.6] });
    mesh(limb(0.06, 0.06, 0.035, 6, 1.715), M.top, upper);
    const long = top !== 'Shirt';
    sleeves(M.top, UPPER, long ? FORE - 0.02 : 0, long ? [0.066, 0.06] : [0.068, 0.066]);
    if (!long) for (const side of ['L', 'R']) arms[side].children.at(-1).geometry = flat(limb(0.068, 0.066, 0.22, 7, 0.0));
    if (top === 'Police uniform') {
      mesh(new THREE.BoxGeometry(0.035, 0.04, 0.01), M.gold, T, { pos: [0.075, 1.47, 0.135] });   // badge
      for (const sx of [-1, 1]) mesh(new THREE.BoxGeometry(0.06, 0.012, 0.11), M.placket, T, { pos: [sx * 0.15, 1.635, 0] }); // epaulettes
    }
  } else if (top === 'Gakuran') {
    // black school uniform: standing collar, gold buttons, long sleeves
    const prof = shell(0.86, 1.08, 0.02);
    mesh(lathe(prof, 8, TORSO_Z), M.top, T);
    mesh(limb(0.064, 0.064, 0.06, 7, 1.74), M.top, upper);
    buttons(M.gold, [1.0, 1.15, 1.3, 1.45, 1.58]);
    sleeves(M.top, UPPER, FORE - 0.01, [0.07, 0.066]);
  } else if (top === 'Sailor uniform') {
    // white blouse, navy sailor collar (square flap on the back), red scarf
    const prof = shell(HEM, 1.07, 0.02);
    mesh(lathe(prof, 8, TORSO_Z), M.white, T);
    mesh(new THREE.BoxGeometry(0.3, 0.2, 0.012), M.navy, T, { pos: [0, 1.58, -0.13], rot: [-0.25, 0, 0] });
    for (const sx of [-1, 1]) mesh(new THREE.BoxGeometry(0.05, 0.2, 0.012), M.navy, T, { pos: [sx * 0.06, 1.56, 0.13], rot: [0.15, 0, sx * 0.45] });
    mesh(new THREE.ConeGeometry(0.035, 0.09, 4), M.red, T, { pos: [0, 1.47, 0.14], rot: [Math.PI, 0, 0] });
    sleeves(M.white, UPPER, FORE - 0.02, [0.066, 0.06]);
  } else if (/^Crop top/.test(top)) {
    mesh(lathe(shell(1.12, 1.07, 0.006), 8, TORSO_Z), M.top, T);
    if (/long/.test(top)) sleeves(M.top, UPPER, FORE - 0.015, [0.07, 0.066]); else sleeves(M.top, 0.22, 0, [0.07, 0.066]);
  } else if (top === 'Tank top') {
    mesh(lathe(shell(HEM, 1.06, 0.02), 8, TORSO_Z), M.top, T);
  } else {
    // tee: short or long sleeves
    mesh(lathe(shell(HEM, 1.07, 0.02), 8, TORSO_Z), M.top, T);
    if (/long/.test(top)) sleeves(M.top, UPPER, FORE - 0.015, [0.07, 0.066]);
    else sleeves(M.top, 0.25, 0, [0.07, 0.066]);
  }

  // outer layer over the top: open shells (cardigan, jacket, suit jacket) or a closed hoodie
  if (outer && !robe) {
    if (outer === 'Hoodie') {
      mesh(lathe(shell(0.84, 1.1, 0.0), 8, TORSO_Z), M.outer, T);
      mesh(lathe(clip(TORSO_B, 0.84, 0.92, 1.12), 8, TORSO_Z), M.outer, T);
      if (!/^long(?! · (ponytail|high ponytail|braid|twin tails))/.test(p.hair ?? ''))
        mesh(lathe([[0.1, 1.6], [0.165, 1.66], [0.15, 1.76], [0.08, 1.8]], 8, 0.95, Math.PI * 0.55, Math.PI * 0.9), M.outer, T, { double: true });
      mesh(new THREE.BoxGeometry(0.2, 0.12, 0.02), M.outer, T, { pos: [0, 1.06, 0.13], rot: [0.08, 0, 0] });
      for (const sx of [-1, 1]) mesh(limb(0.006, 0.006, 0.13, 3), M.white, T, { pos: [sx * 0.035, 1.66, 0.14], rot: [0.12, 0, 0] });
      sleeves(M.outer, UPPER, FORE - 0.015, [0.074, 0.07]);
    } else {
      const long = outer === 'Cardigan' ? 0.83 : outer === 'Jacket' ? 0.86 : 0.84;
      const gap = outer === 'Cardigan' ? 0.36 : outer === 'Jacket' ? 0.33 : 0.27;
      const prof = shell(long, 1.12, 0.005, false);
      mesh(lathe(prof, 10, TORSO_Z, gap, Math.PI * 2 - gap * 2), M.outer, T, { double: true });
      if (outer === 'Cardigan') for (const sx of [-1, 1]) frontLine(prof, 0.85, 1.55, M.outerDark, sx * 0.055, 0.016, 0.004);
      else for (const sx of [-1, 1])
        mesh(new THREE.BoxGeometry(0.045, 0.16, 0.012), M.outer, T, { pos: [sx * 0.058, 1.52, 0.142], rot: [0.12, 0, sx * 0.3] }); // lapels
      sleeves(M.outer, UPPER, FORE - 0.02, [0.074, 0.07]);
    }
  }

  // legs: trousers, shorts (bare legs below), a skirt (the thighs under it in its colour), a robe
  const dressLegs = (thighM, shinM, { thighR = [0.086, 0.082], shinR = [0.082, 0.082], shorts = 0 } = {}) => {
    for (const side of ['L', 'R']) {
      const { hip, knee } = legs[side];
      limbParts.push([mesh(new THREE.SphereGeometry(thighR[0], 6, 3, 0, Math.PI * 2, 0, Math.PI / 2), thighM, hip), S.leg]);
      limbParts.push([mesh(limb(thighR[0], thighR[1], thigh, 6), thighM, hip), S.leg]);
      limbParts.push([mesh(limb(shinR[0], shinR[1], shin, 6), shinM, knee), S.leg]);
      if (shorts) limbParts.push([mesh(limb(thighR[0] + 0.022, thighR[0] + 0.016, shorts * legK, 7), M.legwear, hip), S.leg]);
    }
  };
  const slim = { thighR: [0.075, 0.065], shinR: [0.062, 0.045] };
  if (robe) dressLegs(M.top, M.top, { thighR: [0.08, 0.074], shinR: [0.074, 0.06] });
  else if (legwear === 'Shorts') dressLegs(M.skin, M.skin, { thighR: [0.078, 0.066], shinR: [0.064, 0.047], shorts: 0.3 });
  else if (legwear === 'Skirt') {
    dressLegs(M.legwear, M.skin, slim);
    mesh(lathe([[0, 0.99], [0.174, 0.99], [0.182, 0.92], [0.206, 0.76], [0.236, 0.57], [0, 0.57]].map(([r, y]) => [r * S.hip ** 0.5, y]), 10, 0.86), M.legwear, upper, { double: true });
  } else dressLegs(M.legwear, M.legwear, kid || woman ? { thighR: [0.08, 0.074], shinR: [0.074, 0.07] } : {});
  // a waistband under the hem in the legwear colour: what shows when the shirt lifts
  if (!robe && legwear !== 'Skirt') mesh(lathe(clip(TORSO_B, 0.84, 0.97, 1.075), 8, TORSO_Z), M.legwear, T);

  // shoes (boots: a shaft up the shin)
  for (const side of ['L', 'R']) {
    const { ankle, knee } = legs[side];
    limbParts.push([mesh(taperBox(0.105, 0.07, 0.25, { frontTopY: -0.025 }), M.shoe, ankle, { pos: [0, -0.045, 0.045] }), S.leg ** 0.5]);
    if (p.footwear === 'Boots') limbParts.push([mesh(limb(0.07, 0.068, 0.17, 7, -shin + 0.17), M.shoe, knee), S.leg]);
  }

  // --- head: hair, hat, face accessories, beard --------------------------------
  const covered = coversHair(p.headwear);
  let hairStyle = HAIR_MAP[hairUnder(p.headwear, p.hair)] ?? (p.hair === 'bald' ? 'none' : 'sideswept');
  if (covered && ['spiky', 'curly', 'quiff', 'afro', 'mohawk', 'curlyLong', 'bun'].includes(hairStyle)) hairStyle = 'buzz';
  buildHair(hc, hairStyle, M.hair, M.hairAccent, mulberry32(String(p.hair) + String(p.hairColor)), mesh);
  buildHat(hc, p.headwear, M, mesh);
  if (p.faceAccessory === 'Glasses' || p.faceAccessory === 'Sunglasses') {
    for (const sx of [-1, 1]) {
      mesh(new THREE.TorusGeometry(0.03, 0.0055, 3, 8), M.frame, hc, { pos: [sx * 0.045, 0.02, 0.122] });
      if (p.faceAccessory === 'Sunglasses') mesh(new THREE.CircleGeometry(0.029, 8), M.lens, hc, { pos: [sx * 0.045, 0.02, 0.124], double: true });
      mesh(new THREE.BoxGeometry(0.006, 0.006, 0.12), M.frame, hc, { pos: [sx * 0.1, 0.03, 0.065], rot: [0, sx * -0.25, 0] });
    }
    mesh(new THREE.BoxGeometry(0.032, 0.006, 0.006), M.frame, hc, { pos: [0, 0.028, 0.125] });
  }
  const masked = p.mask === 'Flu mask' || p.faceAccessory === 'Flu mask';
  if (masked) {
    mesh(lathe(clip(HEAD, -0.12, -0.0, 1.07), 8, HEAD_Z * 1.02, -Math.PI * 0.42, Math.PI * 0.84), M.mask, hc, { double: true });
    for (const sx of [-1, 1]) mesh(new THREE.BoxGeometry(0.005, 0.005, 0.1), M.mask, hc, { pos: [sx * 0.1, -0.02, 0.02], rot: [0, sx * -0.4, 0] });
  } else buildFacialHair(hc, p.beard, p.moustache, M, mesh);

  // --- back, body and hand accessories -------------------------------------------
  const backZ = outer ? -0.19 : -0.165;
  if (p.backAccessory === 'Backpack') {
    mesh(new THREE.BoxGeometry(0.25, 0.3, 0.1), M.back, T, { pos: [0, 1.32, backZ] });
    mesh(new THREE.BoxGeometry(0.255, 0.1, 0.106), M.backDark, T, { pos: [0, 1.43, backZ - 0.002] });
    mesh(new THREE.BoxGeometry(0.17, 0.09, 0.03), M.back, T, { pos: [0, 1.22, backZ - 0.06] });
    for (const sx of [-1, 1]) {
      mesh(new THREE.BoxGeometry(0.03, 0.012, 0.3), M.trim, T, { pos: [sx * 0.11, 1.645, 0], rot: [0, 0, sx * -0.4] });
      mesh(new THREE.BoxGeometry(0.03, 0.26, 0.012), M.trim, T, { pos: [sx * 0.11, 1.48, 0.14], rot: [-0.15, 0, 0] });
    }
  } else if (/wings/.test(p.backAccessory ?? '')) {
    // wings on joints (the gait flaps wingL / wingR)
    for (const [name, sx] of [['wingL', 1], ['wingR', -1]]) {
      const w = group(upper, sx * 0.06, 1.48, -0.16, name);
      w.rotation.y = sx * -0.5;
      const shape = new THREE.Shape();
      shape.moveTo(0, 0); shape.lineTo(sx * 0.42, 0.18); shape.lineTo(sx * 0.36, -0.06); shape.lineTo(sx * 0.3, -0.24); shape.lineTo(sx * 0.12, -0.2); shape.lineTo(0, -0.05);
      mesh(new THREE.ExtrudeGeometry(shape, { depth: 0.02, bevelEnabled: false }), M.wings, w, { double: true });
    }
  }
  const acc = p.bodyAccessory;
  if (acc === 'Fanny pack') {
    mesh(new THREE.BoxGeometry(0.2, 0.08, 0.07), M.bodyAcc, T, { pos: [0, 0.97, 0.15] });
    mesh(lathe(clip(TORSO_B, 0.98, 1.0, 1.09), 8, TORSO_Z), M.trim, T);
  } else if (acc === 'Neck tie') {
    mesh(new THREE.BoxGeometry(0.034, 0.26, 0.012), M.bodyAcc, T, { pos: [0, 1.5, 0.142], rot: [0.13, 0, 0] });
    mesh(new THREE.BoxGeometry(0.04, 0.035, 0.02), M.bodyAcc, T, { pos: [0, 1.645, 0.12] });
  } else if (acc === 'Bow tie') {
    for (const sx of [-1, 1]) mesh(new THREE.ConeGeometry(0.025, 0.045, 4), M.bodyAcc, T, { pos: [sx * 0.022, 1.66, 0.12], rot: [0, 0, sx * Math.PI / 2] });
  } else if (acc === 'Baby carrier') {
    mesh(new THREE.BoxGeometry(0.2, 0.22, 0.1), M.bodyAcc, T, { pos: [0, 1.32, 0.19] });
    mesh(new THREE.SphereGeometry(0.075, 7, 5), M.skin, T, { pos: [0, 1.48, 0.2] });
    mesh(new THREE.SphereGeometry(0.078, 7, 4, 0, Math.PI * 2, 0, Math.PI / 2), M.babyCloth, T, { pos: [0, 1.5, 0.195] });
    for (const sx of [-1, 1]) mesh(new THREE.BoxGeometry(0.03, 0.012, 0.3), M.bodyAcc, T, { pos: [sx * 0.11, 1.645, 0], rot: [0, 0, sx * -0.4] });
  } else if (acc === 'Apron') {
    mesh(lathe([[0.2, 0.62], [0.19, 0.9], [0.182, 1.1], [0.19, 1.35], [0.185, 1.5]], 10, 0.9, -Math.PI * 0.36, Math.PI * 0.72), M.bodyAcc, T, { double: true });
    for (const sx of [-1, 1]) mesh(new THREE.BoxGeometry(0.03, 0.012, 0.2), M.bodyAcc, T, { pos: [sx * 0.12, 1.625, 0], rot: [0, 0, sx * -0.55] });
  }

  // things carried in the right hand (our hand items, placed in the paddle hand)
  const fore = arms.R.getObjectByName('foreR');
  // (iso-city's arms hang close to the body: holding something, the arm comes out a little,
  // and the grip sits just outside and in front of the hand, so a stick clears the leg)
  const holding = p.handItem && p.handItem !== 'None';
  if (holding) arms.R.rotation.z = -0.16;
  const grip = new THREE.Vector3(holding ? -0.03 : 0, -FORE - 0.1, holding ? 0.04 : 0.01), gdir = new THREE.Vector3(0, -1, 0);

  // --- to real size: iso-city units -> metres for this person's height --------
  for (const [o, f] of limbParts) o.geometry.scale(f, 1, f);  // build thickness in the shapes (no shearing when joints bend)
  const top0 = hipY + (NECK_Y - HIP_Y) + (HEAD_C + 0.163) * headK;
  const k = (p.height ?? 1.7) / top0;
  root.traverse((o) => {
    if (o === root) return;
    o.position.multiplyScalar(k);
    if (o.isMesh && !o.geometry.userData.scaled) { o.geometry.scale(k, k, k); o.geometry.userData.scaled = true; }
  });
  for (const side of ['L', 'R']) legs[side].ankle.userData.sole.forEach((v) => v.multiplyScalar(k));
  grip.multiplyScalar(k);
  root.userData.isoCity = true;
  root.userData.isoGrip = { grip, dir: gdir };
  root.userData.isoHand = { fore, grip, dir: gdir };
  return root;
}

// ---------- hats (iso-city's cap and beanie, and the rest in the same way) ----------
function buildHat(hc, kind, M, mesh) {
  const m = M.headwear, d = M.headwearDark;
  if (!kind || kind === 'None') return;
  if (kind === 'Beanie') {
    mesh(lathe(clip(HEAD, 0.025, 0.163, 1.14, 1.1), 8, HEAD_Z), m, hc);
    mesh(lathe([[0.132, 0.015], [0.137, 0.045], [0.133, 0.075]], 8, HEAD_Z * 1.02), m, hc, { double: true });
    mesh(new THREE.IcosahedronGeometry(0.035, 0), d, hc, { pos: [0, 0.19, -0.005] });
  } else if (kind === 'Cap' || kind === 'Cap (backwards)' || kind === 'Police cap' || kind === 'Flat cap') {
    const flatCap = kind === 'Flat cap', police = kind === 'Police cap';
    mesh(lathe(clip(HEAD, 0.045, 0.163, 1.12, flatCap ? 0.92 : 1.06), 8, HEAD_Z * (flatCap ? 1.1 : 1)), m, hc);
    const back = kind === 'Cap (backwards)' ? Math.PI : 0;
    const visor = mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.012, 8, 1, false, -Math.PI / 2, Math.PI), police ? M.trim : d, hc,
      { scale: [1, 1, flatCap ? 0.5 : 0.95] });
    visor.position.set(0, 0.06, 0.1 * Math.cos(back)); visor.rotation.set(-0.12 * Math.cos(back), back, 0);
    if (police) {
      mesh(lathe([[0.13, 0.08], [0.15, 0.17], [0.155, 0.2], [0, 0.2]], 8, HEAD_Z), m, hc);
      mesh(lathe(clip(HEAD, 0.06, 0.095, 1.13), 8, HEAD_Z), M.trim, hc);
      mesh(new THREE.BoxGeometry(0.035, 0.035, 0.01), M.gold, hc, { pos: [0, 0.14, 0.15] });
    } else if (!flatCap) mesh(new THREE.BoxGeometry(0.02, 0.012, 0.02), d, hc, { pos: [0, 0.178, 0] });
  } else if (kind === 'Fedora' || kind === 'Straw hat') {
    const straw = kind === 'Straw hat';
    mesh(new THREE.CylinderGeometry(straw ? 0.26 : 0.19, straw ? 0.26 : 0.19, 0.012, 10), m, hc, { pos: [0, 0.075, 0], scale: [1, 1, HEAD_Z] });
    mesh(lathe([[0.125, 0.07], [0.12, 0.15], [0.1, 0.2], [0, 0.205]], 8, HEAD_Z), m, hc);
    mesh(lathe([[0.127, 0.08], [0.126, 0.11]], 8, HEAD_Z), straw ? M.red : d, hc, { double: true });
  } else if (kind === 'Helmet') {
    mesh(lathe([[0, 0.2], [0.07, 0.19], [0.125, 0.14], [0.142, 0.07], [0.142, -0.02]], 8, HEAD_Z), m, hc, { double: true });
    mesh(new THREE.BoxGeometry(0.2, 0.025, 0.04), d, hc, { pos: [0, 0.07, 0.14] });
  } else if (kind === 'Headphones') {
    mesh(new THREE.TorusGeometry(0.135, 0.009, 3, 9, Math.PI), m, hc, { pos: [0, 0.005, -0.005], scale: [1, 1.38, 1] });
    for (const sx of [-1, 1]) mesh(new THREE.CylinderGeometry(0.042, 0.042, 0.03, 7), m, hc, { pos: [sx * 0.128, 0.0, 0], rot: [0, 0, Math.PI / 2] });
  }
}

// ---------- beards and moustaches, in iso-city's spirit (shells of the head, blobs) ----------
function buildFacialHair(hc, beard, moustache, M, mesh) {
  const h = M.hair;
  const jaw = (y0, y1, grow, front = 1) => mesh(lathe(clip(HEAD, y0, y1, grow), 8, HEAD_Z * 1.02, -Math.PI * 0.5 * front, Math.PI * front), h, hc, { double: true });
  switch (beard) {
    case 'Stubble': mesh(lathe(clip(HEAD, -0.15, -0.02, 1.02), 8, HEAD_Z * 1.005, -Math.PI * 0.5, Math.PI), M.stubble, hc, { double: true }); break;
    case 'Short': jaw(-0.15, -0.02, 1.06); break;
    case 'Full': jaw(-0.15, 0.0, 1.1); mesh(new THREE.IcosahedronGeometry(0.06, 1), h, hc, { pos: [0, -0.15, 0.05], scale: [1.3, 0.8, 1] }); break;
    case 'Long': jaw(-0.15, 0.0, 1.1); mesh(new THREE.IcosahedronGeometry(0.07, 1), h, hc, { pos: [0, -0.2, 0.06], scale: [1.2, 1.4, 0.9] }); break;
    case 'Goatee': mesh(new THREE.IcosahedronGeometry(0.035, 1), h, hc, { pos: [0, -0.125, 0.09], scale: [1, 1.2, 0.8] }); break;
    case 'Pointed goatee': mesh(new THREE.ConeGeometry(0.03, 0.08, 5), h, hc, { pos: [0, -0.15, 0.09], rot: [Math.PI, 0, 0] }); break;
    case 'Chin strap': jaw(-0.15, -0.09, 1.05); break;
    case 'Mutton chops': for (const sx of [-1, 1]) mesh(new THREE.BoxGeometry(0.025, 0.11, 0.06), h, hc, { pos: [sx * 0.1, -0.04, 0.04] }); break;
    default: break;
  }
  const y = -0.045, z = 0.118;
  switch (moustache) {
    case 'Classic': mesh(new THREE.BoxGeometry(0.07, 0.018, 0.02), h, hc, { pos: [0, y, z] }); break;
    case 'Thin': mesh(new THREE.BoxGeometry(0.06, 0.008, 0.012), h, hc, { pos: [0, y, z] }); break;
    case 'Walrus': mesh(new THREE.BoxGeometry(0.09, 0.035, 0.03), h, hc, { pos: [0, y - 0.008, z - 0.002] }); break;
    case 'Handlebar':
      mesh(new THREE.BoxGeometry(0.06, 0.014, 0.018), h, hc, { pos: [0, y, z] });
      for (const sx of [-1, 1]) mesh(new THREE.TorusGeometry(0.014, 0.005, 3, 6, Math.PI), h, hc, { pos: [sx * 0.04, y + 0.01, z - 0.004], rot: [0, 0, sx > 0 ? -0.5 : Math.PI + 0.5] });
      break;
    case 'Horseshoe':
      mesh(new THREE.BoxGeometry(0.07, 0.016, 0.018), h, hc, { pos: [0, y, z] });
      for (const sx of [-1, 1]) mesh(new THREE.BoxGeometry(0.014, 0.07, 0.016), h, hc, { pos: [sx * 0.035, y - 0.035, z - 0.006] });
      break;
    default: break;
  }
}

// ---------- hair (iso-city's buildHair, with our materials) ----------
function buildHair(hc, style, color, accent, rnd, mesh) {
  const D = true; // hair is double-sided (open lathes)
  const cap = (hairline = 0.05, grow = 1.09, segs = 8) =>
    mesh(lathe(clip(HEAD, hairline, 0.163, grow, 1.04), segs, HEAD_Z), color, hc, { double: D });
  const back = (low = -0.07, top = 0.07, grow = 1.08, spread = 1) =>
    mesh(lathe(clip(HEAD, low, top, grow), 6, HEAD_Z, Math.PI * (1 - spread / 2), Math.PI * spread), color, hc, { double: D });
  const blob = (r, pos, scale, rot, detail = 0, c = color) =>
    mesh(new THREE.IcosahedronGeometry(r, detail), c, hc, { pos, scale: scale ?? undefined, rot: rot ?? undefined });
  const sideburns = () => {
    for (const sx of [-1, 1]) mesh(new THREE.BoxGeometry(0.014, 0.07, 0.03), color, hc, { pos: [sx * 0.108, 0.035, 0.035] });
  };
  const onCap = (n, fn, front = 0.6) => {
    for (let i = 0; i < n; i++) {
      const az = (-front + (2 * front) * (i / Math.max(n - 1, 1))) * Math.PI + (rnd() - 0.5) * 0.3;
      const el = 0.35 + rnd() * 0.5;
      fn(new THREE.Vector3(Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el)), i);
    }
  };
  switch (style) {
    case 'none': break;
    case 'buzz':
      mesh(lathe(clip(HEAD, 0.055, 0.163, 1.04, 1.02), 8, HEAD_Z), color, hc, { double: D });
      mesh(lathe(clip(HEAD, -0.07, 0.07, 1.035), 6, HEAD_Z, Math.PI / 2, Math.PI), color, hc, { double: D });
      break;
    case 'spiky':
      cap(0.06); back(-0.07); sideburns();
      onCap(9, (dir) => {
        const c = mesh(new THREE.ConeGeometry(0.035, 0.09, 4), color, hc);
        c.position.copy(dir.clone().multiply(new THREE.Vector3(0.125, 0.175, 0.135)));
        c.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().add(new THREE.Vector3(0, 0.5, 0.3)).normalize());
      }, 0.85);
      break;
    case 'curly':
      cap(0.06); back(-0.07); sideburns();
      onCap(11, (dir) => blob(0.038, dir.clone().multiply(new THREE.Vector3(0.125, 0.17, 0.135)).toArray(), null, [rnd(), rnd(), rnd()]), 0.9);
      break;
    case 'quiff':
      cap(0.04, 1.1); back(-0.08); sideburns();
      blob(0.1, [0.0, 0.17, 0.035], [1.15, 0.75, 1.05], [-0.25, 0, 0.08], 1);
      blob(0.06, [0.045, 0.13, 0.09], [1.3, 0.6, 0.6], [0, 0, -0.5]);
      break;
    case 'curtains':
      cap(0.05); back(-0.07); sideburns();
      for (const sx of [-1, 1]) blob(0.06, [sx * 0.055, 0.105, 0.085], [1.1, 0.75, 0.6], [0, 0, sx * 0.5], 1);
      break;
    case 'sideswept':
      cap(0.05); back(-0.07); sideburns();
      blob(0.07, [0.02, 0.125, 0.07], [1.45, 0.65, 0.85], [0.2, 0, -0.25], 1);
      blob(0.05, [-0.06, 0.15, 0.03], [1, 0.7, 1.2], [0, 0, 0.3]);
      break;
    case 'long':
      cap(0.06, 1.1);
      mesh(lathe([[0.125, -0.33], [0.14, -0.22], [0.135, -0.08], [0.128, 0.04], [0.118, 0.09]], 7, HEAD_Z * 1.05,
        Math.PI * 0.32, Math.PI * 1.36), color, hc, { double: D });
      blob(0.06, [-0.07, 0.07, 0.07], [1.0, 1.1, 0.7], [0, 0, 0.4], 1);
      blob(0.05, [0.03, 0.13, 0.075], [1.5, 0.6, 0.8], [0, 0, -0.2], 1);
      break;
    case 'bob':
      cap(0.06, 1.1);
      mesh(lathe([[0.135, -0.13], [0.135, -0.05], [0.13, 0.03], [0.118, 0.09]], 8, HEAD_Z * 1.04,
        Math.PI * 0.27, Math.PI * 1.46), color, hc, { double: D });
      mesh(new THREE.BoxGeometry(0.19, 0.06, 0.04), color, hc, { pos: [0, 0.085, 0.105], rot: [-0.35, 0, 0] });
      break;
    case 'ponytail':
      cap(0.06, 1.09); back(-0.05);
      blob(0.06, [-0.04, 0.12, 0.08], [1.3, 0.7, 0.7], [0, 0, 0.35], 1);
      mesh(new THREE.TorusGeometry(0.03, 0.01, 3, 6), accent, hc, { pos: [0, 0.07, -0.135], rot: [0.4, 0, 0] });
      mesh(new THREE.CapsuleGeometry(0.038, 0.2, 2, 6), color, hc, { pos: [0, -0.07, -0.16], rot: [-0.2, 0, 0], scale: [1, 1, 0.9] });
      break;
    case 'curlyLong':
      cap(0.06, 1.1);
      for (let i = 0; i < 14; i++) {
        const az = Math.PI * (0.32 + 1.36 * (i % 7) / 6);
        const y = i < 7 ? 0.04 : -0.11;
        const r = 0.13 + rnd() * 0.02;
        blob(0.05, [Math.sin(az) * r, y + rnd() * 0.03, Math.cos(az) * r * HEAD_Z], null, [rnd(), rnd(), rnd()]);
      }
      onCap(5, (dir) => blob(0.04, dir.clone().multiply(new THREE.Vector3(0.11, 0.16, 0.12)).toArray()), 0.4);
      break;
    case 'bun':
      cap(0.06, 1.09);
      mesh(lathe([[0.1, -0.36], [0.12, -0.25], [0.125, -0.08], [0.122, 0.05], [0.112, 0.1]], 6, HEAD_Z * 1.05,
        Math.PI * 0.6, Math.PI * 0.8), color, hc, { double: D });
      blob(0.06, [0, 0.15, -0.1], null, null, 1);
      for (let i = 0; i < 3; i++) mesh(limb(0.006, 0.006, 0.09, 3), color, hc, { pos: [0.02 + i * 0.022, 0.15, 0.1], rot: [0.5, 0, -0.15] });
      break;
    case 'afro':
      cap(0.05, 1.08);
      blob(0.17, [0, 0.085, -0.035], [1.05, 0.92, 0.98], [0.2, 0.3, 0], 1);
      break;
    case 'mohawk':
      mesh(lathe(clip(HEAD, 0.05, 0.163, 1.035, 1.02), 8, HEAD_Z), accent, hc, { double: D });
      for (let i = 0; i < 6; i++) {
        const th = -0.55 + i * 0.4;
        mesh(new THREE.BoxGeometry(0.035, 0.11 - Math.abs(i - 2) * 0.012, 0.075), color, hc,
          { pos: [0, 0.02 + 0.16 * Math.cos(th), 0.13 * Math.sin(-th)], rot: [-th - 0.15, 0, 0] });
      }
      break;
    case 'longStraight':
      cap(0.06, 1.1);
      mesh(lathe([[0.11, -0.44], [0.135, -0.3], [0.14, -0.1], [0.13, 0.04], [0.118, 0.09]], 7, HEAD_Z * 1.05,
        Math.PI * 0.3, Math.PI * 1.4), color, hc, { double: D });
      for (const sx of [-1, 1]) blob(0.055, [sx * 0.06, 0.1, 0.08], [1.0, 0.8, 0.55], [0, 0, sx * 0.6]);
      break;
    case 'braids':
      cap(0.06, 1.09); back(-0.06);
      for (const sx of [-1, 1]) {
        for (let i = 0; i < 5; i++) blob(0.03 - i * 0.002, [sx * (0.1 - i * 0.004), -0.05 - i * 0.055, -0.07 + i * 0.012], [1, 1.25, 1], [0, i, 0]);
        blob(0.016, [sx * 0.08, -0.33, -0.012], null, null, 0, accent);
      }
      break;
    case 'pixie':
      cap(0.07, 1.07); back(-0.04, 0.07, 1.06);
      blob(0.05, [0.025, 0.115, 0.085], [1.7, 0.5, 0.7], [0.3, 0, -0.3]);
      break;
    case 'slicked':
      cap(0.05, 1.07); back(-0.07, 0.07, 1.06); sideburns();
      blob(0.09, [0, 0.13, -0.005], [1.12, 0.6, 1.3], [0.2, 0, 0], 1);
      break;
    default: break;
  }
}
