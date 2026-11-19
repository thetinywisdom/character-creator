import * as THREE from 'three';
import { JOINT_NAMES } from '../anim/gait.js';
import { stretchSkirt } from '../anim/skirt.js';
import { restoreDetail, setDetail } from '../lib/shapes.js';
import { skinCharacter } from '../lib/skin.js';
import { CLOTH_COLORS, HAIR_COLORS, snapColor } from '../styles/palette.js';
import { addSilhouette } from './silhouette.js';

// How people are drawn in the isometric city view only.
//
// The character creator and the third-person view keep the full person
// (7.5-head adults, the clothes the generator picked, a few thousand
// triangles). The iso view draws a second, coarser mesh on the same pose:
//   - adults about 6 heads tall, a wider head, thicker limbs, so the two
//     legs stay apart at zoom 16
//   - the whole figure 1.2×, the same idea as the cat's exaggeration
//   - townspeople recoloured so the top and the legs don't share a
//     luminance, with lighter legwear instead of navy or black, and about
//     40% given light hair or a light hat (from above, the head is mostly hair)
//   - a few hundred triangles instead of a few thousand
// Gameplay (collisions, seats, doors) still uses the unscaled rig. The iso
// mesh is only a picture: standing, it grows up from the feet; sitting, its
// hips stay on the seat the full body already found.

export const ISO_PERSON_SCALE = 1.2;
// Same ballpark as the city style's detail, with a low segment floor and no
// joint balls. Tuned so a dressed adult lands around 700–1,000 triangles.
export const ISO_DETAIL = 0.23;
export const ISO_SEG_CAP = 4;

const LIMBS = new Set([...JOINT_NAMES, 'head']);
const COPY_JOINTS = ['spine', 'head', 'legL', 'legR', 'shinL', 'shinR', 'footL', 'footR', 'armL', 'armR', 'foreL', 'foreR', 'wingL', 'wingR'];

// Blonde, white and pink sit clearly above the sidewalk. Gray is already
// light, so it is kept, but it blends into the pavement and does not count
// as the head that reads.
const LIGHT_HAIR = ['Blonde', 'White', 'Pink'];
const LIGHT_HATS = ['Cap', 'Straw hat', 'Beanie', 'Flat cap'];
const LIGHT_HAT_COLORS = ['White', 'Khaki', 'Yellow', 'Light blue', 'Pink'];
// Denim, sage, dusty rose: light enough to separate from a dark road.
const PREFERRED_LEGS = ['Denim', 'Green', 'Red'];
const LEG_FALLBACKS = ['Khaki', 'Light blue', 'Gray', 'White', 'Pink'];
const MIN_LEG_CONTRAST = 0.14;
// human.randomize lands near 30% on headReads. Promoting this share of the
// rest brings the iso crowd to about 40%. Nobody already readable is darkened.
const HEAD_PROMOTE = 0.16;

function lumaOf(hex) {
  const h = snapColor(hex ?? 0x888888);
  const lin = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  const r = lin(((h >> 16) & 255) / 255), g = lin(((h >> 8) & 255) / 255), b = lin((h & 255) / 255);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function clothLuma(name) {
  return lumaOf(CLOTH_COLORS[name] ?? 0x888888);
}

/** The garment you actually see on the torso (a jacket or an apron covers the shirt). */
function upperColorName(p) {
  if (p.bodyAccessory === 'Apron') return p.bodyAccessoryColor;
  if (p.outerwear && p.outerwear !== 'None') return p.outerwearColor;
  return p.topColor;
}

function hash01(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return (h >>> 0) / 4294967296;
}

/** True when the head reads from above: light hair, or a hat lighter than the sidewalk. */
export function headReads(p) {
  if (LIGHT_HAIR.includes(p.hairColor)) return true;
  if (p.hairColor && lumaOf(HAIR_COLORS[p.hairColor] ?? 0) >= 0.55) return true;
  if (p.headwear && p.headwear !== 'None' && clothLuma(p.headwearColor) >= 0.5) return true;
  return false;
}

/**
 * Iso-only proportions. Adults at the realistic 6.5–7.5 heads become about
 * 6 (7.5 → 6.0). The head width factor 0.80 becomes 0.95. Limbs are 25% thicker.
 * Children already have a big head; they only get the wider head and thicker limbs.
 */
export function isoProportions(p) {
  const q = { ...p };
  const child = q.bodyType === 'Boy' || q.bodyType === 'Girl';
  if (!child && (q.headsTall ?? 7.5) >= 6.5) q.headsTall = Math.round(q.headsTall * (6 / 7.5) * 10) / 10;
  q.headWidth = Math.min(1.1, Math.round((q.headWidth ?? 0.8) * (0.95 / 0.8) * 100) / 100);
  q.armThickness = (q.armThickness ?? 0.026) * 1.25;
  q.legThickness = (q.legThickness ?? 0.034) * 1.25;
  return q;
}

/**
 * Iso-only colours for a generated townsperson. The stored look is unchanged,
 * so third person still wears it. Legs must differ in luminance from the top,
 * and navy / black legs become denim, sage or dusty rose. Dark heads are
 * promoted until about 40% of people have light hair or a light hat.
 */
export function isoCrowdLook(p, salt = 0) {
  const q = { ...p };
  const up = upperColorName(q);
  const Lu = clothLuma(up);
  const leg = q.legwearColor;
  const darkLeg = leg === 'Navy' || leg === 'Black';
  const weak = !leg || leg === up || Math.abs(clothLuma(leg) - Lu) < MIN_LEG_CONTRAST;
  if (darkLeg || weak) {
    const first = PREFERRED_LEGS[Math.abs(salt) % PREFERRED_LEGS.length];
    const choices = [first, ...PREFERRED_LEGS.filter((n) => n !== first), ...LEG_FALLBACKS];
    for (const name of choices) {
      if (name === up) continue;
      if (Math.abs(clothLuma(name) - Lu) < MIN_LEG_CONTRAST) continue;
      q.legwearColor = name;
      break;
    }
  }
  const u = hash01(`${q.bodyType}|${q.hair}|${q.hairColor}|${q.top}|${q.topColor}|${q.legwear}|${q.legwearColor}|${salt}`);
  if (!headReads(q) && u < HEAD_PROMOTE) {
    const hat = LIGHT_HATS[Math.abs(salt) % LIGHT_HATS.length];
    const color = LIGHT_HAT_COLORS[Math.abs(salt) % LIGHT_HAT_COLORS.length];
    // gray hair and an existing hat stay; only the colour of the hat changes
    const keepHair = q.hairColor === 'Gray' || q.hairColor === 'White' || (q.headwear && q.headwear !== 'None') || q.hair === 'bald' || u < HEAD_PROMOTE * 0.45;
    if (keepHair) {
      q.headwear = q.headwear && q.headwear !== 'None' ? q.headwear : hat;
      q.headwearColor = color;
    } else q.hairColor = LIGHT_HAIR[Math.abs(salt) % LIGHT_HAIR.length];
  }
  return q;
}

/** Low-detail iso mesh + its silhouette. Restores whatever detail was active. */
export function buildIsoCharacter(human, params, style, material, silhouetteMat) {
  const prev = setDetail(ISO_DETAIL, { capMin: ISO_SEG_CAP, roundCaps: false });
  try {
    const raw = human.build(params, style);
    const body = skinCharacter(raw, LIMBS, material);
    const sil = silhouetteMat ? addSilhouette(body, silhouetteMat) : null;
    if (sil) sil.userData.occBody = body;
    return { body, sil };
  } finally {
    restoreDetail(prev);
  }
}

/** Attach the iso picture under `full` (hidden until the iso view). */
export function mountIsoPerson(full, isoBody) {
  const wrap = new THREE.Group();
  wrap.name = 'isoWrap';
  wrap.userData.isoScale = ISO_PERSON_SCALE;
  wrap.scale.setScalar(ISO_PERSON_SCALE);
  wrap.add(isoBody);
  wrap.visible = false;
  full.add(wrap);
  full.userData.isoWrap = wrap;
  full.userData.isoBody = isoBody;
  return wrap;
}

function jointsUnder(root, stopName) {
  const map = {};
  const walk = (o) => {
    if (o.name === stopName) return;
    if (COPY_JOINTS.includes(o.name) || o.name === 'skirt') map[o.name] = o;
    for (const c of o.children) walk(c);
  };
  walk(root);
  return map;
}

/**
 * Copy the pose onto the iso mesh and show only one of the two pictures.
 * `hipLock` (set by sitPose / swingPose / sitOnBike) keeps the iso hips on
 * the seat; otherwise the iso figure stands on the same feet.
 */
export function syncIsoPerson(full, isoMode) {
  const wrap = full.userData.isoWrap;
  const iso = full.userData.isoBody;
  if (!wrap || !iso) return;
  wrap.visible = !!isoMode;
  const hideFull = (o) => {
    if (o === wrap) return;
    if (o.isMesh && !o.material?.transparent) o.visible = !isoMode;
    for (const c of o.children) if (c !== wrap) hideFull(c);
  };
  hideFull(full);
  if (!isoMode) return;
  const src = jointsUnder(full, 'isoWrap');
  const dst = jointsUnder(iso, 'isoWrap');
  for (const name of COPY_JOINTS) if (src[name] && dst[name]) dst[name].rotation.copy(src[name].rotation);
  const scale = wrap.userData.isoScale || ISO_PERSON_SCALE;
  if (full.userData.hipLock) {
    const hipF = src.legL?.position.y ?? 0;
    const hipI = dst.legL?.position.y ?? 0;
    iso.position.set(0, hipF / scale - hipI, 0);
  } else iso.position.set(0, 0, 0);
  iso.rotation.set(0, 0, 0);
  iso.visible = full.visible;
  if (dst.skirt && dst.shinL && dst.shinR) {
    iso.updateWorldMatrix(true, true);
    stretchSkirt(dst.skirt, [dst.shinL, dst.shinR]);
  }
}

/** World boxes of buildings, captured before the town is merged. */
export function collectBuildingBoxes(group) {
  const boxes = [];
  for (const child of group.children) {
    if (!String(child.userData?.asset || '').startsWith('building.')) continue;
    const box = new THREE.Box3().setFromObject(child);
    if (box.isEmpty()) continue;
    // pull the sides in a little so a person standing beside a building, not
    // behind it, does not count as hidden (the box is fatter than the walls)
    box.min.x += 0.7; box.max.x -= 0.7;
    box.min.z += 0.7; box.max.z -= 0.7;
    if (box.min.x < box.max.x && box.min.z < box.max.z) boxes.push(box);
  }
  return boxes;
}

/** Nearest t > 0 where the ray hits the box, or null. */
function rayBoxT(origin, dir, box) {
  let tmin = 0;
  let tmax = Infinity;
  for (const axis of ['x', 'y', 'z']) {
    const o = origin[axis];
    const d = dir[axis];
    const min = box.min[axis];
    const max = box.max[axis];
    if (Math.abs(d) < 1e-8) {
      if (o < min || o > max) return null;
    } else {
      let t1 = (min - o) / d;
      let t2 = (max - o) / d;
      if (t1 > t2) { const s = t1; t1 = t2; t2 = s; }
      if (t1 > tmin) tmin = t1;
      if (t2 < tmax) tmax = t2;
      if (tmin > tmax) return null;
    }
  }
  if (tmax < 0) return null;
  return tmin;
}

/**
 * True when a building sits between `point` and the camera. A point already
 * inside a box (under an awning) does not count: the depth test would draw
 * nothing, and the draw call is the thing we are trying to skip.
 */
export function occludedByBuilding(point, towardCamera, boxes) {
  for (const box of boxes) {
    const t = rayBoxT(point, towardCamera, box);
    // only a building close along the view ray: someone directly behind a
    // wall, not a block further down the street. Far hits were fat boxes
    // clipping the ray and still cost a draw.
    if (t !== null && t > 0.4 && t < 10) return true;
  }
  return false;
}

const _anchor = new THREE.Vector3();

/** A point on the silhouette to test (the head when it has one). */
export function silhouetteAnchor(sil) {
  const body = sil.userData.occBody;
  if (body) {
    const head = body.getObjectByName('head');
    if (head) return head.getWorldPosition(_anchor);
    body.getWorldPosition(_anchor);
    _anchor.y += 0.8;
    return _anchor;
  }
  sil.getWorldPosition(_anchor);
  _anchor.y += 0.7;
  return _anchor;
}
