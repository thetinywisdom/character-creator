// Vendored from iso-city characters/characters.js for visual parity tests.
// Not part of the package. Import path rewritten; body unchanged.
// Low-poly, flat-shaded 3D versions of the 2D character sheet.
//   createMainCharacter()        -> the bald peach/orange hero
//   createNPC({ seed, outfit, hair, hairColor, glasses })  -> modular NPC
//   createCrowd(count, seed)     -> array of varied NPCs
// Every character: { root, update(dt, speed), parts, config, triangles }
// Units: ~2.0 tall, feet at y=0, facing +Z. Rotate `root` to steer.
import * as THREE from 'three';

import { PALETTE, COMIC } from '../../src/palette.js';
export { PALETTE, COMIC };

export const OUTFITS = ['shirt', 'tee', 'coat', 'blouse', 'apron',
  'hoodie', 'blazer', 'sweater', 'shortsTee', 'dress', 'overalls', 'suit', 'cardigan', 'tank'];
export const HAIRSTYLES = ['spiky', 'curly', 'buzz', 'tuft', 'quiff', 'curtains', 'sideswept',
  'long', 'bob', 'ponytail', 'curlyLong', 'bun',
  'afro', 'mohawk', 'longStraight', 'braids', 'pixie', 'slicked', 'receding', 'none'];
export const HATS = ['none', 'beanie', 'cap'];
export const ACCESSORIES = ['backpack', 'tote', 'scarf', 'headphones'];
// hair that fits under a hat / headphones (no tall volume on top)
const HAT_HAIR = ['buzz', 'curtains', 'sideswept', 'long', 'bob', 'ponytail', 'longStraight', 'braids', 'pixie', 'slicked', 'receding', 'none'];
// dark browns / greys from the palette; mostly black + slate like the art
export const HAIR_COLORS = [PALETTE.black, PALETTE.slate, PALETTE.black, PALETTE.slate, COMIC.warm[0], COMIC.warm[1], COMIC.neutrals[2]];
// clothing: mostly the art's neutrals, sometimes a muted Comic tint
const CLOTH_NEUTRAL = [PALETTE.white, PALETTE.black, PALETTE.slate, COMIC.neutrals[2], COMIC.neutrals[3]];
const CLOTH_TINT = [COMIC.blues[1], COMIC.blues[3], COMIC.pinks[3], COMIC.pinks[0], COMIC.teals[1], COMIC.teals[3],
  COMIC.yellows[3], COMIC.yellows[3], COMIC.warm[1], COMIC.warm[2], COMIC.blues[0]];
const DENIM = [COMIC.blues[1], COMIC.blues[0], PALETTE.slate];

// ---------- helpers ----------
const matCache = new Map();
function mat(color, double = false) {
  const key = color + (double ? 'd' : '');
  if (!matCache.has(key)) {
    matCache.set(key, new THREE.MeshLambertMaterial({
      color, flatShading: true, side: double ? THREE.DoubleSide : THREE.FrontSide,
    }));
  }
  return matCache.get(key);
}
function mesh(geo, color, parent, { double = false, pos, rot, scale } = {}) {
  const m = new THREE.Mesh(geo, mat(color, double));
  if (pos) m.position.set(...pos);
  if (rot) m.rotation.set(...rot);
  if (scale) m.scale.set(...scale);
  parent.add(m);
  return m;
}
function group(parent, x = 0, y = 0, z = 0) {
  const g = new THREE.Group(); g.position.set(x, y, z); parent.add(g); return g;
}
// profile: [[radius, y], ...] ascending y.  zs = depth scale (elliptical sections)
function lathe(profile, segs, zs = 1, phiStart = 0, phiLength = Math.PI * 2) {
  const pts = profile.map(([r, y]) => new THREE.Vector2(Math.max(r, 0.0001), y));
  const g = new THREE.LatheGeometry(pts, segs, phiStart, phiLength);
  g.scale(1, 1, zs);
  return g;
}
// clip a profile to [y0,y1] (interpolating ends) and grow it radially
function clip(profile, y0, y1, grow = 1, yGrow = 1) {
  const out = [];
  const at = (y) => {
    for (let i = 0; i < profile.length - 1; i++) {
      const [r0, a] = profile[i], [r1, b] = profile[i + 1];
      if (y >= a && y <= b) return r0 + (r1 - r0) * ((y - a) / (b - a || 1));
    }
    return y < profile[0][1] ? profile[0][0] : profile[profile.length - 1][0];
  };
  out.push([at(y0), y0]);
  for (const p of profile) if (p[1] > y0 && p[1] < y1) out.push(p);
  out.push([at(y1), y1]);
  return out.map(([r, y]) => [r * grow, y * yGrow]);
}
// cylinder hanging down from its pivot by `len`
function limb(rTop, rBot, len, segs = 6, y0 = 0) {
  const g = new THREE.CylinderGeometry(rTop, rBot, len, segs, 1);
  g.translate(0, y0 - len / 2, 0);
  return g;
}
// tapered box (for hands/feet): bottom/front verts scaled
function taperBox(w, h, d, { botX = 1, botZ = 1, frontTopY = 0 } = {}) {
  const g = new THREE.BoxGeometry(w, h, d);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    if (p.getY(i) < 0) { p.setX(i, p.getX(i) * botX); p.setZ(i, p.getZ(i) * botZ); }
    if (frontTopY && p.getZ(i) > 0 && p.getY(i) > 0) p.setY(i, p.getY(i) + frontTopY);
  }
  g.computeVertexNormals();
  return g;
}
// thin line following the front of a lathe profile (button plackets, coat edges)
function frontLine(parent, profile, y0, y1, zs, color, x = 0, w = 0.008, push = 0.004) {
  const pts = clip(profile, y0, y1);
  for (let i = 0; i < pts.length - 1; i++) {
    const [ra, ya] = pts[i], [rb, yb] = pts[i + 1];
    const za = Math.sqrt(Math.max(ra * ra - x * x, 0)) * zs + push;
    const zb = Math.sqrt(Math.max(rb * rb - x * x, 0)) * zs + push;
    const len = Math.hypot(yb - ya, zb - za);
    const m = mesh(new THREE.BoxGeometry(w, len, w), color, parent);
    m.position.set(x, (ya + yb) / 2, (za + zb) / 2);
    m.rotation.x = -Math.atan2(zb - za, yb - ya);
  }
}
export function mulberry32(seed) {
  let a = (typeof seed === 'string' ? [...seed].reduce((h, c) => (h * 31 + c.charCodeAt(0)) | 0, 7) : seed) >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------- shared proportions (from the art: ~6.5 heads tall, long legs) ----------
const HIP_Y = 0.9, HIP_X = 0.088, THIGH = 0.42, SHIN = 0.40;
const SHOULDER_Y = 1.572, SHOULDER_X = 0.205, UPPER = 0.40, FORE = 0.31;
const NECK_Y = 1.62, HEAD_C = 0.215;            // head centre above neck pivot
const TORSO_Z = 0.72, HEAD_Z = 1.08;
const TORSO = [[0, 0.84], [0.15, 0.845], [0.168, 0.9], [0.17, 1.0], [0.163, 1.15], [0.172, 1.35],
  [0.18, 1.48], [0.182, 1.58], [0.15, 1.645], [0.07, 1.675], [0, 1.68]];
const HEAD = [[0, -0.15], [0.06, -0.145], [0.093, -0.108], [0.106, -0.045], [0.11, 0.03],
  [0.103, 0.09], [0.08, 0.135], [0.042, 0.158], [0, 0.163]];

// ---------- hair ----------
function buildHair(hc, style, color, accent, rnd) {
  const D = true; // hair is double-sided (open lathes)
  const cap = (hairline = 0.05, grow = 1.09, segs = 8) =>
    mesh(lathe(clip(HEAD, hairline, 0.163, grow, 1.04), segs, HEAD_Z), color, hc, { double: D });
  const back = (low = -0.07, top = 0.07, grow = 1.08, spread = 1) =>
    mesh(lathe(clip(HEAD, low, top, grow), 6, HEAD_Z, Math.PI * (1 - spread / 2), Math.PI * spread), color, hc, { double: D });
  const blob = (r, pos, scale, rot, detail = 0, c = color) =>
    mesh(new THREE.IcosahedronGeometry(r, detail), c, hc, { pos, scale, rot });
  const sideburns = () => {
    for (const sx of [-1, 1]) mesh(new THREE.BoxGeometry(0.014, 0.07, 0.03), color, hc, { pos: [sx * 0.108, 0.035, 0.035] });
  };
  // outward-pointing spikes / curls placed on the cap surface
  const onCap = (n, fn, front = 0.6) => {
    for (let i = 0; i < n; i++) {
      const az = (-front + (2 * front) * (i / Math.max(n - 1, 1))) * Math.PI + (rnd() - 0.5) * 0.3; // around front-top
      const el = 0.35 + rnd() * 0.5;
      const dir = new THREE.Vector3(Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el));
      fn(dir, i);
    }
  };
  switch (style) {
    case 'none': break;
    case 'tuft': { // bald with a single curl on top (orange sheet, top-right)
      mesh(new THREE.TorusGeometry(0.022, 0.006, 3, 8, Math.PI * 1.6), color, hc, { pos: [0, 0.205, 0.01], rot: [0, Math.PI / 2, 0.3] });
      mesh(limb(0.006, 0.006, 0.03, 3), color, hc, { pos: [0, 0.19, 0.01] });
      break;
    }
    case 'buzz': {
      const c2 = accent;
      mesh(lathe(clip(HEAD, 0.055, 0.163, 1.04, 1.02), 8, HEAD_Z), c2, hc, { double: D });
      mesh(lathe(clip(HEAD, -0.07, 0.07, 1.035), 6, HEAD_Z, Math.PI / 2, Math.PI), c2, hc, { double: D });
      break;
    }
    case 'spiky': {
      cap(0.06); back(-0.07); sideburns();
      onCap(9, (dir) => {
        const c = mesh(new THREE.ConeGeometry(0.035, 0.09, 4), color, hc);
        c.position.copy(dir.clone().multiply(new THREE.Vector3(0.125, 0.175, 0.135)));
        c.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().add(new THREE.Vector3(0, 0.5, 0.3)).normalize());
      }, 0.85);
      break;
    }
    case 'curly': {
      cap(0.06); back(-0.07); sideburns();
      onCap(11, (dir) => {
        blob(0.038, dir.clone().multiply(new THREE.Vector3(0.125, 0.17, 0.135)).toArray(), null, [rnd(), rnd(), rnd()]);
      }, 0.9);
      break;
    }
    case 'quiff': { // tall flat-topped swept quiff (black-tee guy)
      cap(0.04, 1.1); back(-0.08); sideburns();
      blob(0.1, [0.0, 0.17, 0.035], [1.15, 0.75, 1.05], [-0.25, 0, 0.08], 1);   // tall swept-up front
      blob(0.06, [0.045, 0.13, 0.09], [1.3, 0.6, 0.6], [0, 0, -0.5]);
      break;
    }
    case 'curtains': { // middle part, two lobes
      cap(0.05); back(-0.07); sideburns();
      for (const sx of [-1, 1]) blob(0.06, [sx * 0.055, 0.105, 0.085], [1.1, 0.75, 0.6], [0, 0, sx * 0.5], 1);
      break;
    }
    case 'sideswept': { // big swept fringe from one side
      cap(0.05); back(-0.07); sideburns();
      blob(0.07, [0.02, 0.125, 0.07], [1.45, 0.65, 0.85], [0.2, 0, -0.25], 1);
      blob(0.05, [-0.06, 0.15, 0.03], [1, 0.7, 1.2], [0, 0, 0.3]);
      break;
    }
    case 'long': { // long hair to the shoulders, side part (coat woman)
      cap(0.06, 1.1);
      mesh(lathe([[0.125, -0.33], [0.14, -0.22], [0.135, -0.08], [0.128, 0.04], [0.118, 0.09]], 7, HEAD_Z * 1.05,
        Math.PI * 0.32, Math.PI * 1.36), color, hc, { double: D });
      blob(0.06, [-0.07, 0.07, 0.07], [1.0, 1.1, 0.7], [0, 0, 0.4], 1);   // side sweep over temple
      blob(0.05, [0.03, 0.13, 0.075], [1.5, 0.6, 0.8], [0, 0, -0.2], 1);
      break;
    }
    case 'bob': { // jaw-length bob with bangs
      cap(0.06, 1.1);
      mesh(lathe([[0.135, -0.13], [0.135, -0.05], [0.13, 0.03], [0.118, 0.09]], 8, HEAD_Z * 1.04,
        Math.PI * 0.27, Math.PI * 1.46), color, hc, { double: D });
      const bang = new THREE.BoxGeometry(0.19, 0.06, 0.04);
      mesh(bang, color, hc, { pos: [0, 0.085, 0.105], rot: [-0.35, 0, 0] });
      break;
    }
    case 'ponytail': {
      cap(0.06, 1.09); back(-0.05);
      blob(0.06, [-0.04, 0.12, 0.08], [1.3, 0.7, 0.7], [0, 0, 0.35], 1);
      mesh(new THREE.TorusGeometry(0.03, 0.01, 3, 6), accent, hc, { pos: [0, 0.07, -0.135], rot: [0.4, 0, 0] });
      const tail = new THREE.CapsuleGeometry(0.038, 0.2, 2, 6);
      mesh(tail, color, hc, { pos: [0, -0.07, -0.16], rot: [-0.2, 0, 0], scale: [1, 1, 0.9] });
      break;
    }
    case 'curlyLong': {
      cap(0.06, 1.1);
      for (let i = 0; i < 14; i++) {
        const az = Math.PI * (0.32 + 1.36 * (i % 7) / 6);
        const y = i < 7 ? 0.04 : -0.11;
        const r = 0.13 + rnd() * 0.02;
        blob(0.05, [Math.sin(az) * r, y + rnd() * 0.03, Math.cos(az) * r * HEAD_Z], null, [rnd(), rnd(), rnd()]);
      }
      onCap(5, (dir) => blob(0.04, dir.clone().multiply(new THREE.Vector3(0.11, 0.16, 0.12)).toArray()), 0.4);
      break;
    }
    case 'bun': { // long hair down the back + bun with a light clip/scrunchie (apron woman)
      cap(0.06, 1.09);
      mesh(lathe([[0.1, -0.36], [0.12, -0.25], [0.125, -0.08], [0.122, 0.05], [0.112, 0.1]], 6, HEAD_Z * 1.05,
        Math.PI * 0.6, Math.PI * 0.8), color, hc, { double: D });
      blob(0.06, [0, 0.15, -0.1], null, null, 1);
      blob(0.055, [0.04, 0.17, -0.06], [0.7, 1.0, 1.4], [0.4, 0, -0.5], 0, accent);   // clip
      blob(0.05, [-0.05, 0.13, -0.11], [0.8, 0.9, 1.2], [0, 0, 0.6], 0, accent);
      for (let i = 0; i < 3; i++) // a few loose fringe strands
        mesh(limb(0.006, 0.006, 0.09, 3), color, hc, { pos: [0.02 + i * 0.022, 0.15, 0.1], rot: [0.5, 0, -0.15] });
      break;
    }
    case 'afro': {
      cap(0.05, 1.08);
      blob(0.17, [0, 0.085, -0.035], [1.05, 0.92, 0.98], [0.2, 0.3, 0], 1);
      break;
    }
    case 'mohawk': {
      mesh(lathe(clip(HEAD, 0.05, 0.163, 1.035, 1.02), 8, HEAD_Z), accent, hc, { double: D });   // shaved sides
      for (let i = 0; i < 6; i++) {
        const th = -0.55 + i * 0.4;
        mesh(new THREE.BoxGeometry(0.035, 0.11 - Math.abs(i - 2) * 0.012, 0.075), color, hc,
          { pos: [0, 0.02 + 0.16 * Math.cos(th), 0.13 * Math.sin(-th)], rot: [-th - 0.15, 0, 0] });
      }
      break;
    }
    case 'longStraight': { // long hair past the shoulders, centre part
      cap(0.06, 1.1);
      mesh(lathe([[0.11, -0.44], [0.135, -0.3], [0.14, -0.1], [0.13, 0.04], [0.118, 0.09]], 7, HEAD_Z * 1.05,
        Math.PI * 0.3, Math.PI * 1.4), color, hc, { double: D });
      for (const sx of [-1, 1]) blob(0.055, [sx * 0.06, 0.1, 0.08], [1.0, 0.8, 0.55], [0, 0, sx * 0.6]);
      break;
    }
    case 'braids': { // two plaits behind the ears
      cap(0.06, 1.09); back(-0.06);
      for (const sx of [-1, 1]) {
        for (let i = 0; i < 5; i++) blob(0.03 - i * 0.002, [sx * (0.1 - i * 0.004), -0.05 - i * 0.055, -0.07 + i * 0.012], [1, 1.25, 1], [0, i, 0]);
        blob(0.016, [sx * 0.08, -0.33, -0.012], null, null, 0, accent);
      }
      break;
    }
    case 'pixie': {
      cap(0.07, 1.07); back(-0.04, 0.07, 1.06);
      blob(0.05, [0.025, 0.115, 0.085], [1.7, 0.5, 0.7], [0.3, 0, -0.3]);
      break;
    }
    case 'slicked': { // combed straight back
      cap(0.05, 1.07); back(-0.07, 0.07, 1.06); sideburns();
      blob(0.09, [0, 0.13, -0.005], [1.12, 0.6, 1.3], [0.2, 0, 0], 1);
      break;
    }
    case 'receding': { // bald top, horseshoe round the back + sides
      back(-0.07, 0.055, 1.06, 1.45);
      break;
    }
    default: break;
  }
}

function buildHat(hc, hat, color, accent) {
  if (hat === 'beanie') {
    mesh(lathe(clip(HEAD, 0.025, 0.163, 1.14, 1.1), 8, HEAD_Z), color, hc);
    mesh(lathe([[0.132, 0.015], [0.137, 0.045], [0.133, 0.075]], 8, HEAD_Z * 1.02), color, hc, { double: true });   // folded cuff
    mesh(new THREE.IcosahedronGeometry(0.035, 0), accent, hc, { pos: [0, 0.19, -0.005] });
  } else if (hat === 'cap') {
    mesh(lathe(clip(HEAD, 0.045, 0.163, 1.12, 1.06), 8, HEAD_Z), color, hc);
    mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.012, 8, 1, false, -Math.PI / 2, Math.PI), accent, hc,
      { pos: [0, 0.06, 0.1], rot: [-0.12, 0, 0], scale: [1, 1, 0.95] });
    mesh(new THREE.BoxGeometry(0.02, 0.012, 0.02), accent, hc, { pos: [0, 0.178, 0] });
  }
}

function buildAccessory(P, kind, color, cfg) {
  const T = P.torso, hc = P.headCenter;
  const backZ = ['coat', 'blazer', 'suit', 'hoodie', 'cardigan'].includes(cfg.outfit) ? -0.19 : -0.165;
  if (kind === 'backpack') {
    mesh(new THREE.BoxGeometry(0.25, 0.3, 0.1), color, T, { pos: [0, 1.32, backZ] });
    mesh(new THREE.BoxGeometry(0.255, 0.1, 0.106), PALETTE.slate, T, { pos: [0, 1.43, backZ - 0.002] });
    mesh(new THREE.BoxGeometry(0.17, 0.09, 0.03), color, T, { pos: [0, 1.22, backZ - 0.06] });   // front pocket
    for (const sx of [-1, 1]) {   // straps over the shoulders
      mesh(new THREE.BoxGeometry(0.03, 0.012, 0.3), PALETTE.slate, T, { pos: [sx * 0.11, 1.645, 0], rot: [0, 0, sx * -0.4] });
      mesh(new THREE.BoxGeometry(0.03, 0.26, 0.012), PALETTE.slate, T, { pos: [sx * 0.11, 1.48, 0.14], rot: [-0.15, 0, 0] });
    }
  } else if (kind === 'tote') {   // carried in the right hand, swings with the arm
    const wr = P.wristR;
    mesh(new THREE.BoxGeometry(0.035, 0.2, 0.19), color, wr, { pos: [-0.015, -0.26, 0], scale: [1, 1, 1] });
    mesh(new THREE.TorusGeometry(0.05, 0.006, 3, 6, Math.PI), PALETTE.slate, wr, { pos: [-0.015, -0.16, 0], rot: [0, Math.PI / 2, 0] });
  } else if (kind === 'scarf') {
    mesh(new THREE.TorusGeometry(0.075, 0.03, 4, 8), color, T, { pos: [0, 1.69, 0.005], rot: [Math.PI / 2 - 0.12, 0, 0], scale: [1, 0.85, 1] });
    mesh(new THREE.BoxGeometry(0.06, 0.22, 0.02), color, T, { pos: [0.05, 1.56, 0.15], rot: [-0.15, 0, 0.08] });
  } else if (kind === 'headphones') {
    mesh(new THREE.TorusGeometry(0.135, 0.009, 3, 9, Math.PI), color, hc, { pos: [0, 0.005, -0.005], scale: [1, 1.38, 1] });
    for (const sx of [-1, 1])
      mesh(new THREE.CylinderGeometry(0.042, 0.042, 0.03, 7), color, hc, { pos: [sx * 0.128, 0.0, 0], rot: [0, 0, Math.PI / 2] });
  }
}

function buildGlasses(hc, color) {
  for (const sx of [-1, 1]) {
    mesh(new THREE.TorusGeometry(0.03, 0.0055, 3, 8), color, hc, { pos: [sx * 0.045, 0.02, 0.122] });
    const t = mesh(new THREE.BoxGeometry(0.006, 0.006, 0.12), color, hc, { pos: [sx * 0.1, 0.03, 0.065] });
    t.rotation.y = sx * -0.25;
  }
  mesh(new THREE.BoxGeometry(0.032, 0.006, 0.006), color, hc, { pos: [0, 0.028, 0.125] });
}

// ---------- body ----------
function buildBody(cfg) {
  const { skin, line } = cfg;
  const root = new THREE.Group();
  root.name = cfg.name || 'character';
  const body = group(root);              // bounces while walking
  const torso = group(body);             // static torso parts (absolute coords)
  const P = { root, body, torso };

  // torso + neck (skin)
  mesh(lathe(TORSO, 8, TORSO_Z), skin, torso);
  mesh(limb(0.048, 0.052, 0.14, 6, 1.73), skin, torso);

  // head
  P.head = group(body, 0, NECK_Y, 0);
  const hc = P.headCenter = group(P.head, 0, HEAD_C, 0);
  mesh(lathe(HEAD, 8, HEAD_Z), skin, hc);
  for (const sx of [-1, 1]) {
    mesh(new THREE.SphereGeometry(0.03, 5, 4), skin, hc, { pos: [sx * 0.11, 0.0, -0.005], scale: [0.5, 1, 0.75] });
    // the little "C" ear line from the art
    mesh(new THREE.TorusGeometry(0.012, 0.0028, 3, 5, Math.PI * 1.3), line, hc,
      { pos: [sx * 0.1255, 0.0, -0.004], rot: [0, sx * Math.PI / 2, Math.PI * 0.35 * (sx > 0 ? 1 : -1) + (sx > 0 ? 0 : Math.PI)] });
  }
  // nose: small wedge + the hooked line
  const nose = new THREE.ConeGeometry(0.017, 0.045, 4); nose.rotateX(Math.PI / 2 + 0.5);
  mesh(nose, skin, hc, { pos: [0, -0.012, 0.12] });
  mesh(new THREE.BoxGeometry(0.0045, 0.04, 0.0045), line, hc, { pos: [0.012, -0.006, 0.128], rot: [0.35, 0, 0.15] });
  mesh(new THREE.BoxGeometry(0.02, 0.0045, 0.0045), line, hc, { pos: [0.006, -0.028, 0.134] });

  // arms: shoulder -> elbow -> wrist
  for (const side of ['L', 'R']) {
    const sx = side === 'L' ? 1 : -1;
    const sh = P['arm' + side] = group(body, sx * SHOULDER_X, SHOULDER_Y, 0);
    mesh(new THREE.SphereGeometry(0.05, 6, 4), skin, sh, { scale: [1, 0.85, 0.9] });
    mesh(limb(0.052, 0.045, UPPER, 6), skin, sh);
    const el = P['elbow' + side] = group(sh, 0, -UPPER, 0);
    mesh(limb(0.045, 0.036, FORE, 6), skin, el);
    const wr = P['wrist' + side] = group(el, 0, -FORE, 0);
    // big flat paddle hand (palm faces the thigh) + thumb + finger lines
    const hg = group(wr); hg.rotation.y = sx * 0.9;   // palm turned half toward the viewer, like the art
    const hand = taperBox(0.04, 0.19, 0.115, { botX: 0.8, botZ: 0.85 });
    hand.translate(0, -0.085, 0.006);
    mesh(hand, skin, hg);
    mesh(new THREE.BoxGeometry(0.03, 0.085, 0.032), skin, hg, { pos: [-sx * 0.012, -0.055, 0.062], rot: [0.55, 0, 0] });
    for (const dz of [-0.02, 0.0, 0.02])
      mesh(new THREE.BoxGeometry(0.005, 0.075, 0.005), line, hg, { pos: [sx * 0.019, -0.13, dz] });
  }

  // legs: hip -> knee -> ankle
  for (const side of ['L', 'R']) {
    const sx = side === 'L' ? 1 : -1;
    const hip = P['leg' + side] = group(body, sx * HIP_X, HIP_Y, 0);
    const knee = P['knee' + side] = group(hip, 0, -THIGH, 0);
    const ankle = P['ankle' + side] = group(knee, 0, -SHIN, 0);
    P['legParts' + side] = { hip, knee, ankle };
  }
  return P;
}

// legs: style = { thigh: color, shin: color, thighR:[top,bot], shinR:[top,bot], shoe: color|null, flats }
function dressLegs(P, cfg, o) {
  for (const side of ['L', 'R']) {
    const { hip, knee, ankle } = P['legParts' + side];
    const tr = o.thighR || [0.086, 0.082];
    const sr = o.shinR || [0.082, 0.082];
    mesh(new THREE.SphereGeometry(tr[0], 6, 3, 0, Math.PI * 2, 0, Math.PI / 2), o.thigh, hip);
    mesh(limb(tr[0], tr[1], THIGH, 6), o.thigh, hip);
    mesh(limb(sr[0], sr[1], SHIN, 6), o.shin, knee);
    if (o.shorts) mesh(limb(tr[0] + 0.022, tr[0] + 0.016, o.shorts, 7), o.shortsColor, hip);
    if (o.socks) mesh(limb(sr[1] + 0.006, sr[1] + 0.006, 0.07, 6, -SHIN + 0.075), o.socks, knee);
    if (o.cuffSkin) mesh(limb(0.042, 0.04, 0.05, 6, -SHIN + 0.04), cfg.skin, knee);   // bare ankle under skirts
    if (o.shoe) {
      const s = taperBox(0.105, 0.07, 0.25, { botX: 1, botZ: 1, frontTopY: -0.025 });
      mesh(s, o.shoe, ankle, { pos: [0, -0.045, 0.045] });
      if (o.sole) mesh(new THREE.BoxGeometry(0.108, 0.02, 0.252), o.sole, ankle, { pos: [0, -0.071, 0.045] });
    } else if (o.flats) {
      mesh(taperBox(0.08, 0.05, 0.21, { frontTopY: -0.02 }), cfg.skin, ankle, { pos: [0, -0.05, 0.045] });
      mesh(new THREE.BoxGeometry(0.09, 0.022, 0.23), o.flats, ankle, { pos: [0, -0.069, 0.045] });
      mesh(new THREE.BoxGeometry(0.092, 0.03, 0.06), o.flats, ankle, { pos: [0, -0.05, 0.11] });
    } else { // bare foot
      mesh(taperBox(0.085, 0.06, 0.23, { botZ: 1, frontTopY: -0.03 }), cfg.skin, ankle, { pos: [0, -0.05, 0.05] });
    }
  }
}

function sleeves(P, color, upperLen, foreLen = 0, r = [0.066, 0.06], puff = false) {
  for (const side of ['L', 'R']) {
    const sh = P['arm' + side];
    mesh(new THREE.SphereGeometry(r[0] + 0.003, 7, 3, 0, Math.PI * 2, 0, Math.PI / 2), color, sh, { scale: [1, 0.8, 1] });
    mesh(limb(r[0], puff ? r[1] + 0.02 : r[1], upperLen, 7, 0.0), color, sh);
    if (foreLen) mesh(limb(r[1] - 0.004, r[1] - 0.008, foreLen, 7, 0.01), color, P['elbow' + side]);
  }
}

// garment shell = torso profile grown outward, from hem y0 up to the neck
function shell(y0, grow = 1.07, hemFlare = 0.012, close = true) {
  const pr = clip(TORSO, Math.max(y0, 0.9), 1.672, grow);
  if (y0 < 0.9) pr.unshift([0.168 * grow + 0.012, y0]);
  pr[0] = [pr[0][0] + hemFlare, pr[0][1] - 0.01];
  if (close) pr.unshift([0, pr[0][1] + 0.005]);
  pr.push([0.055, 1.684]);
  return pr;
}

function buildOutfit(P, cfg) {
  const C = PALETTE, T = P.torso;
  const o = cfg.outfit;
  const K = cfg.colors || {};
  P.legSwing = 0.34;
  if (o === 'shirt') {          // white button shirt (3/4 sleeves) + slate trousers
    const prof = shell(0.87, 1.07);
    mesh(lathe(prof, 8, TORSO_Z), C.white, T);
    frontLine(T, prof, 0.87, 1.64, TORSO_Z, C.npcLine);
    for (const sx of [-1, 1])
      mesh(new THREE.BoxGeometry(0.05, 0.035, 0.01), C.white, T, { pos: [sx * 0.03, 1.69, 0.062], rot: [-0.9, 0, sx * -0.6] });
    mesh(limb(0.06, 0.06, 0.035, 6, 1.715), C.white, T);  // collar band
    sleeves(P, C.white, UPPER, 0.09);
    dressLegs(P, cfg, { thigh: C.slate, shin: C.slate, shoe: C.slate });
  } else if (o === 'tee') {     // black tee + slate trousers
    const prof = shell(0.87, 1.07);
    mesh(lathe(prof, 8, TORSO_Z), C.black, T);
    sleeves(P, C.black, 0.25, 0, [0.07, 0.066]);
    dressLegs(P, cfg, { thigh: C.slate, shin: C.slate, shoe: C.black });
  } else if (o === 'coat') {    // long open white coat over black top + flared slate trousers
    mesh(lathe(shell(0.9, 1.04), 8, TORSO_Z), C.black, T);
    const prof = shell(0.8, 1.13, 0.01, false);
    const gap = 0.3;
    mesh(lathe(prof, 10, TORSO_Z, gap, Math.PI * 2 - gap * 2), C.white, T, { double: true });
    for (const sx of [-1, 1]) // lapels
      mesh(new THREE.BoxGeometry(0.045, 0.16, 0.012), C.white, T, { pos: [sx * 0.058, 1.53, 0.142], rot: [0.12, 0, sx * 0.3] });
    sleeves(P, C.white, UPPER, FORE - 0.02, [0.07, 0.066]);
    dressLegs(P, cfg, { thigh: C.slate, shin: C.slate, shinR: [0.082, 0.1], shoe: C.black });
  } else if (o === 'blouse') {  // slate blouse with puff sleeves + long black A-line skirt
    const prof = shell(1.0, 1.07);
    mesh(lathe(prof, 8, TORSO_Z), C.slate, T);
    frontLine(T, prof, 1.45, 1.65, TORSO_Z, C.black, 0, 0.012);
    sleeves(P, C.slate, 0.36, 0, [0.07, 0.07], true);
    mesh(lathe([[0, 1.03], [0.172, 1.03], [0.178, 0.95], [0.198, 0.75], [0.228, 0.48], [0.25, 0.3], [0, 0.3]], 10, 0.86),
      C.black, T, { double: true });
    mesh(new THREE.TorusGeometry(0.043, 0.008, 3, 8), C.black, P.elbowL, { pos: [0, -FORE + 0.03, 0], rot: [Math.PI / 2, 0, 0] });
    dressLegs(P, cfg, { thigh: cfg.skin, shin: cfg.skin, thighR: [0.075, 0.065], shinR: [0.062, 0.045], flats: C.slate, cuffSkin: true });
    P.legSwing = 0.22;
  } else if (o === 'apron') {   // sleeveless white apron dress (scalloped hem) + black wide trousers
    const prof = [[0.215, 0.54], [0.208, 0.7], [0.193, 0.9], [0.178, 1.1], [0.19, 1.35], [0.195, 1.5], [0.18, 1.57], [0, 1.575]];
    const g = lathe(prof, 16, 0.9);
    const p = g.attributes.position;           // scallop: zig-zag the bottom ring
    for (let i = 0; i < p.count; i++) if (Math.abs(p.getY(i) - 0.54) < 1e-4) {
      const ang = Math.atan2(p.getX(i), p.getZ(i));
      p.setY(i, 0.54 + (Math.round(ang / (Math.PI / 8)) % 2 ? 0.015 : -0.005));
    }
    g.computeVertexNormals();
    mesh(g, C.white, T, { double: true });
    for (const sx of [-1, 1]) {   // straps over the shoulders
      mesh(new THREE.BoxGeometry(0.04, 0.012, 0.2), C.white, T, { pos: [sx * 0.12, 1.625, 0], rot: [0, 0, sx * -0.55] });
    }
    dressLegs(P, cfg, { thigh: C.black, shin: C.black, shinR: [0.082, 0.098], shoe: C.slate });
    P.legSwing = 0.22;
  } else if (o === 'hoodie') {  // hoodie with hood, drawstrings + pouch pocket; jeans, sneakers
    const prof = shell(0.84, 1.1, 0.0);
    mesh(lathe(prof, 8, TORSO_Z), K.top, T);
    mesh(lathe(clip(TORSO, 0.84, 0.92, 1.12), 8, TORSO_Z), K.top, T);   // ribbed hem
    mesh(lathe([[0.1, 1.6], [0.165, 1.66], [0.15, 1.76], [0.08, 1.8]], 8, 0.95, Math.PI * 0.55, Math.PI * 0.9), K.top, T, { double: true });   // hood
    mesh(new THREE.BoxGeometry(0.2, 0.12, 0.02), K.top, T, { pos: [0, 1.06, 0.13], rot: [0.08, 0, 0] });
    for (const sx of [-1, 1]) mesh(limb(0.006, 0.006, 0.13, 3), K.accent, T, { pos: [sx * 0.035, 1.66, 0.14], rot: [0.12, 0, 0] });
    sleeves(P, K.top, UPPER, FORE - 0.015, [0.072, 0.068]);
    dressLegs(P, cfg, { thigh: K.bottom, shin: K.bottom, shoe: PALETTE.white, sole: PALETTE.slate });
  } else if (o === 'blazer') {  // short open blazer over a tee + trousers
    mesh(lathe(shell(0.9, 1.04), 8, TORSO_Z), K.inner, T);
    const prof = shell(0.86, 1.12, 0.005, false), gap = 0.33;
    mesh(lathe(prof, 10, TORSO_Z, gap, Math.PI * 2 - gap * 2), K.top, T, { double: true });
    for (const sx of [-1, 1])
      mesh(new THREE.BoxGeometry(0.045, 0.15, 0.012), K.top, T, { pos: [sx * 0.06, 1.53, 0.142], rot: [0.12, 0, sx * 0.3] });
    sleeves(P, K.top, UPPER, FORE - 0.03, [0.07, 0.066]);
    dressLegs(P, cfg, { thigh: K.bottom, shin: K.bottom, shoe: PALETTE.black });
  } else if (o === 'sweater') { // chunky crew-neck sweater
    const prof = shell(0.86, 1.11, 0.0);
    mesh(lathe(prof, 8, TORSO_Z), K.top, T);
    mesh(lathe(clip(TORSO, 0.86, 0.93, 1.13), 8, TORSO_Z), K.top, T);
    mesh(limb(0.064, 0.064, 0.03, 7, 1.71), K.top, T);   // crew collar
    sleeves(P, K.top, UPPER, FORE - 0.01, [0.075, 0.072]);
    dressLegs(P, cfg, { thigh: K.bottom, shin: K.bottom, shoe: K.shoe });
  } else if (o === 'shortsTee') { // tee + knee shorts, bare legs, socks + sneakers
    mesh(lathe(shell(0.87, 1.07), 8, TORSO_Z), K.top, T);
    sleeves(P, K.top, 0.24, 0, [0.07, 0.066]);
    dressLegs(P, cfg, { thigh: cfg.skin, shin: cfg.skin, thighR: [0.078, 0.066], shinR: [0.064, 0.047],
      shorts: 0.3, shortsColor: K.bottom, socks: PALETTE.white, shoe: PALETTE.white, sole: PALETTE.slate });
  } else if (o === 'dress') {   // fitted top + knee-length A-line skirt, flats
    const prof = shell(0.98, 1.06);
    mesh(lathe(prof, 8, TORSO_Z), K.top, T);
    sleeves(P, K.top, 0.16, 0, [0.068, 0.066]);
    mesh(lathe([[0, 0.99], [0.174, 0.99], [0.182, 0.92], [0.206, 0.76], [0.236, 0.57], [0, 0.57]], 10, 0.86), K.top, T, { double: true });
    mesh(lathe(clip(TORSO, 0.98, 1.02, 1.08), 8, TORSO_Z), K.accent, T);   // waist band
    dressLegs(P, cfg, { thigh: cfg.skin, shin: cfg.skin, thighR: [0.075, 0.065], shinR: [0.062, 0.045], flats: K.shoe });
    P.legSwing = 0.27;
  } else if (o === 'overalls') { // tee under denim bib overalls
    mesh(lathe(shell(0.87, 1.06), 8, TORSO_Z), K.inner, T);
    sleeves(P, K.inner, 0.24, 0, [0.07, 0.066]);
    mesh(lathe(clip(TORSO, 0.84, 1.1, 1.1), 8, TORSO_Z), K.bottom, T);
    mesh(new THREE.BoxGeometry(0.2, 0.3, 0.014), K.bottom, T, { pos: [0, 1.25, 0.128], rot: [0.02, 0, 0] });
    mesh(new THREE.BoxGeometry(0.09, 0.07, 0.006), K.accent, T, { pos: [0, 1.3, 0.137] });   // bib pocket
    for (const sx of [-1, 1]) {
      mesh(new THREE.BoxGeometry(0.034, 0.012, 0.26), K.bottom, T, { pos: [sx * 0.085, 1.668, 0] });
      mesh(new THREE.BoxGeometry(0.034, 0.2, 0.012), K.bottom, T, { pos: [sx * 0.085, 1.49, 0.135], rot: [-0.15, 0, 0] });
      mesh(new THREE.BoxGeometry(0.018, 0.018, 0.01), PALETTE.white, T, { pos: [sx * 0.08, 1.4, 0.138] });
    }
    dressLegs(P, cfg, { thigh: K.bottom, shin: K.bottom, shoe: K.shoe });
  } else if (o === 'suit') {    // dark suit, white shirt, tie
    mesh(lathe(shell(0.9, 1.05), 8, TORSO_Z), PALETTE.white, T);
    mesh(new THREE.BoxGeometry(0.034, 0.26, 0.012), K.accent, T, { pos: [0, 1.5, 0.142], rot: [0.13, 0, 0] });   // tie
    mesh(new THREE.BoxGeometry(0.04, 0.035, 0.02), K.accent, T, { pos: [0, 1.645, 0.12] });                       // knot
    const prof = shell(0.84, 1.12, 0.005, false), gap = 0.27;
    mesh(lathe(prof, 10, TORSO_Z, gap, Math.PI * 2 - gap * 2), K.top, T, { double: true });
    for (const sx of [-1, 1])
      mesh(new THREE.BoxGeometry(0.045, 0.17, 0.012), K.top, T, { pos: [sx * 0.058, 1.5, 0.142], rot: [0.12, 0, sx * 0.28] });
    sleeves(P, K.top, UPPER, FORE - 0.03, [0.07, 0.066]);
    dressLegs(P, cfg, { thigh: K.top, shin: K.top, shoe: PALETTE.black });
  } else if (o === 'cardigan') { // open cardigan over a top, skirt or trousers
    mesh(lathe(shell(0.9, 1.05), 8, TORSO_Z), K.inner, T);
    const prof = shell(0.83, 1.11, 0.0, false), gap = 0.36;
    mesh(lathe(prof, 10, TORSO_Z, gap, Math.PI * 2 - gap * 2), K.top, T, { double: true });
    for (const sx of [-1, 1]) frontLine(T, prof, 0.85, 1.55, TORSO_Z, K.top, sx * 0.055, 0.016, 0.004);
    sleeves(P, K.top, UPPER, FORE - 0.01, [0.072, 0.068]);
    dressLegs(P, cfg, { thigh: K.bottom, shin: K.bottom, shoe: K.shoe });
  } else if (o === 'tank') {    // tank top, bare arms, shorts or trousers
    const prof = shell(0.87, 1.06);
    mesh(lathe(prof, 8, TORSO_Z), K.top, T);
    if (K.shorts) dressLegs(P, cfg, { thigh: cfg.skin, shin: cfg.skin, thighR: [0.078, 0.066], shinR: [0.064, 0.047],
      shorts: 0.27, shortsColor: K.bottom, shoe: PALETTE.white, sole: PALETTE.slate });
    else dressLegs(P, cfg, { thigh: K.bottom, shin: K.bottom, shoe: K.shoe });
  } else { // 'none' — plain body (main character)
    dressLegs(P, cfg, { thigh: cfg.skin, shin: cfg.skin, thighR: [0.085, 0.068], shinR: [0.066, 0.048] });
  }
}

// ---------- animation ----------
// Procedural gait: feet follow planted/swing trajectories (driven by distance
// travelled, so they never slide) and 2-bone IK turns them into hip/knee angles.
const LEG_L = THIGH + SHIN, ANKLE_H = HIP_Y - LEG_L;     // ankle height above the sole
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (a, b, v) => { const t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const damp = (cur, goal, rate, dt) => cur + (goal - cur) * (1 - Math.exp(-rate * dt));
const WALK_TO_RUN = [3.4, 5.4];          // speed band where the walk cross-fades into the run
const WALK = { duty: 0.6, lift: 0.13, bobA: 0.032, lean: 0.07, pelvis: 0.13, shoulder: 0.16, sway: 0.028, roll: 0.05, crouch: 0.03 };
const RUN = { duty: 0.34, lift: 0.46, bobA: 0.06, lean: 0.23, pelvis: 0.16, shoulder: 0.2, sway: 0.014, roll: 0.035, crouch: 0.07 };
/** stride (two steps) in world units for a speed; tied to leg length */
export function strideLength(speed, run = 0, mul = 1) {
  const w = clamp(0.55 + 0.32 * speed, 0.8, 1.5) * (LEG_L / 0.82);
  const r = clamp(1.5 + 0.22 * speed, 2.2, 3.3) * (LEG_L / 0.82);
  return lerp(w, r, run) * mul;
}
const SLAP_HIT = 0.31, SLAP_DUR = 0.62, HIT_DUR = 0.7;   // slap timings (s)
export { SLAP_HIT };
const _m = new THREE.Matrix4(), _v = new THREE.Vector3(), _q = new THREE.Quaternion(), _e = new THREE.Euler();
const _kq = new THREE.Quaternion(), _kx = new THREE.Vector3(1, 0, 0);
const KD_FALL = 0.36, KD_UP = 0.55;   // knockdown: tumble / get-up durations (s)
const _A = new THREE.Vector3(), _B = new THREE.Vector3(), _C = new THREE.Vector3(), _D = new THREE.Vector3(), _E = new THREE.Vector3(),
  _F = new THREE.Vector3(), _G = new THREE.Vector3(), _Hv = new THREE.Vector3(), _M2 = new THREE.Matrix4();

class Character {
  constructor(P, cfg) {
    this.root = P.root; this.parts = P; this.config = cfg;
    this.phase = 0; this.walk = 0; this.run = 0; this.air = 0; this.crouch = 0; this.lean = 0; this.leanZ = 0;
    this.land = 0; this.landV = 0; this.settle = 0; this.settleV = 0; this.prevSpeed = 0; this.grounded = true;
    this.vy = 0; this.spd = 0;
    this.t = (cfg.seed ? mulberry32(cfg.seed + ':t')() : 0) * 10;
    this.strideMul = clamp(P.legSwing / 0.34, 0.6, 1);   // skirts: shorter strides, no clipping
    // body variation: height scales the whole rig (stride scales with it, so no sliding); build widens it
    this.h = cfg.height || 1; const b = this.b = cfg.build || 1;
    // cfg.shape (creator body types) overrides the single build factor: { sh, hip, tx, tz, leg, arm }
    const S = cfg.shape || { sh: 1 + (b - 1) * 0.8, hip: 1 + (b - 1) * 0.6, tx: b, tz: 1 + (b - 1) * 0.7, leg: 1 + (b - 1) * 0.8, arm: 1 + (b - 1) * 0.6 };
    this.shX = SHOULDER_X * S.sh; this.hipX = HIP_X * S.hip;
    P.torso.scale.set(S.tx, 1, S.tz);
    for (const s of ['L', 'R']) {
      P['leg' + s].position.x = (s === 'L' ? 1 : -1) * this.hipX;
      P['leg' + s].scale.set(S.leg, 1, S.leg);
      P['arm' + s].scale.set(S.arm, 1, S.arm);
    }
    P.body.rotation.order = 'YXZ';
    for (const s of ['L', 'R']) P['arm' + s].rotation.order = 'YXZ';
    this.root.userData.character = this;
    let tris = 0;
    this.root.traverse((o) => {
      if (o.isMesh) {
        o.castShadow = true;
        const g = o.geometry;
        tris += (g.index ? g.index.count : g.attributes.position.count) / 3;
      }
    });
    this.triangles = tris;
    this.update(0, 0);
  }

  /** Player-side jump hooks (physics lives with the caller). */
  anticipate(amount = 1) { this._antic = amount; }

  /** Open-hand slap with the right arm: wind-up, fast swing across, follow-through.
   *  Returns the seconds until the hand connects (SLAP_HIT). */
  slap() { this._slapT = 0; return SLAP_HIT; }
  get slapping() { return this._slapT !== undefined && this._slapT < SLAP_DUR; }
  /** Got slapped: head snaps to `side` (+1 = to its left, -1 = to its right), body recoils. */
  hit(side = 1) { this._hitT = 0; this._hitSide = side; }
  /** Tripped: ragdoll-ish tumble (dir +1 = face-down forward, -1 = onto the back), lie for `lie` s, then get up.
   *  Pivots the whole body about the feet. Returns the total duration in s. */
  knockdown(dir = 1, lie = 1.5, roll = 0) {
    if (this._dance) this.stopDance(0.08);
    this._kd = { t: 0, dir, lie, roll: roll || (Math.random() < 0.5 ? -1 : 1) * (0.15 + Math.random() * 0.2) };
    return KD_FALL + lie + KD_UP;
  }
  get down() { return !!this._kd; }
  _kdStep(D) {
    const k = this._kd, P = this.parts, H = this.h;
    const t = (k.t += D), T1 = KD_FALL, T2 = KD_FALL + k.lie, T3 = T2 + KD_UP;
    if (t >= T3) { this._kd = null; return; }
    let a, flail;
    if (t < T1) { const u = t / T1; a = u * u * 1.04; flail = u; }                                  // gravity tumble
    else if (t < T2) { const u = t - T1; a = 1 + 0.07 * Math.exp(-u * 7) * Math.sin(u * 26 + 1.6) - 0.04; flail = Math.max(0.35, 1 - u * 3); }  // thud bounce, lie
    else { const u = (t - T2) / KD_UP; a = 1 - u * u * (3 - 2 * u); flail = 0.35 * (1 - u); }       // push up
    const ang = a * (Math.PI / 2 - 0.08) * k.dir;
    _kq.setFromAxisAngle(_kx, ang);
    P.body.position.applyQuaternion(_kq); P.body.quaternion.premultiply(_kq);
    _kq.setFromAxisAngle(_v.set(0, 0, 1), k.roll * a); P.body.position.applyQuaternion(_kq); P.body.quaternion.premultiply(_kq);
    P.body.position.y += 0.15 * H * Math.min(1, Math.abs(a));
    // limbs: arms fling out on the fall, splay while lying, push the ground getting up; head lolls
    for (const [side, sx] of [['L', 1], ['R', -1]]) {
      const arm = P['arm' + side];
      arm.rotation.z += sx * 1.25 * flail;
      arm.rotation.x += (t < T2 ? -1.1 * flail * k.dir : 0.9 * flail);
      P['elbow' + side].rotation.x -= 0.5 * flail;
      P['leg' + side].rotation.x += -0.25 * flail * (sx > 0 ? 1 : 0.3);
    }
    P.head.rotation.x += 0.35 * k.dir * Math.min(1, Math.abs(a)); P.head.rotation.z += k.roll * a * 0.8;
  }

  // additive action layer, applied after the locomotion pose
  _actions(D) {
    const P = this.parts;
    if (this.hold) this.hold(this);                 // specials: idle prop grip (e.g. ring at the hip)
    if (this._dance) this._danceStep(D);
    if (this.prop) this.prop(this, this._dance ? this._dancePose : null, this._danceW || 0);
    if (this._slapT !== undefined && this._slapT < SLAP_DUR) {
      const t = (this._slapT += D);
      const a = P.armR, e = P.elbowR, wr = P.wristR;
      // keyframes: [time, yaw (across body), abduction, elbow, torso twist]
      const K = [[0, 0, 0.1, 0.2, 0], [0.2, -0.75, 1.35, 1.35, -0.35], [0.25, -0.75, 1.4, 1.25, -0.38],
        [SLAP_HIT, 1.25, 1.45, 0.15, 0.35], [0.4, 1.85, 1.3, 0.3, 0.45], [SLAP_DUR, 0, 0.1, 0.2, 0]];
      let i = 0; while (i < K.length - 2 && t > K[i + 1][0]) i++;
      const k0 = K[i], k1 = K[i + 1];
      let u = clamp((t - k0[0]) / (k1[0] - k0[0]), 0, 1);
      u = i === 2 ? u * u : u * u * (3 - 2 * u);          // the swing accelerates into the hit
      const v = (j) => lerp(k0[j], k1[j], u);
      const fade = 1 - smooth(0.42, SLAP_DUR, t);
      const tw = v(4);
      P.torso.rotation.y = lerp(P.torso.rotation.y, tw, fade);
      _v.set(-this.shX, SHOULDER_Y, 0).applyAxisAngle(THREE.Object3D.DEFAULT_UP, P.torso.rotation.y);
      a.position.copy(_v);
      a.rotation.set(lerp(a.rotation.x, -0.25, fade), lerp(a.rotation.y, v(1) + tw, fade), lerp(a.rotation.z, -v(2), fade));
      e.rotation.x = lerp(e.rotation.x, -v(3), fade);
      wr.rotation.x = lerp(wr.rotation.x, 0, fade); wr.rotation.z = lerp(wr.rotation.z, -0.5 * fade, fade);
      P.head.rotation.y += -tw * 0.5 * fade;
    }
    if (this._hitT !== undefined && this._hitT < HIT_DUR) {
      const t = (this._hitT += D), s = this._hitSide;
      // instant snap, then a springy return
      const env = t < 0.05 ? t / 0.05 : Math.exp(-(t - 0.05) * 5.5) * Math.cos((t - 0.05) * 9);
      P.head.rotation.y += s * 0.95 * env;
      P.head.rotation.z = s * 0.35 * env;
      P.body.rotation.x -= 0.22 * Math.max(0, env);
      P.body.rotation.z += s * 0.12 * env;
      for (const [side, sx] of [['L', 1], ['R', -1]]) {   // arms flail out a little
        if (side === 'R' && this.slapping) continue;
        P['arm' + side].rotation.z += sx * 0.35 * Math.max(0, env);
      }
      if (t >= HIT_DUR) P.head.rotation.z = 0;
    }
    if (this._kd) this._kdStep(D);
  }

  /**
   * update(dt, speed) or update(dt, { speed, grounded, vy, crouch, turn })
   *  speed: horizontal units/s · grounded: false while airborne · vy: vertical velocity
   *  crouch: 0..1 jump anticipation · turn: heading change rad/s (lean into turns)
   */
  update(dt, state = 0) {
    const st = typeof state === 'number' ? { speed: state } : (state || {});
    const speed = Math.max(0, st.speed || 0);
    const grounded = st.grounded !== false, vy = st.vy || 0;
    const P = this.parts, D = dt || 0;
    this.t += D; this._lastD = D;
    // landing: squash spring kicked by impact speed
    if (grounded && !this.grounded) { this.landV += clamp(-this.vy, 2, 12) * 0.55; }
    this.grounded = grounded; if (!grounded) this.vy = vy;
    // ---- blend weights (cross-fades, never snaps) ----
    const wGoal = smooth(0.05, 0.9, speed), rGoal = smooth(WALK_TO_RUN[0], WALK_TO_RUN[1], speed);
    if (D === 0) { this.walk = wGoal; this.run = rGoal; this.air = grounded ? 0 : 1; this.crouch = st.crouch || 0; }
    this.walk = damp(this.walk, wGoal, 7, D); this.run = damp(this.run, rGoal, 6, D);
    this.air = damp(this.air, grounded ? 0 : 1, grounded ? 30 : 18, D);
    this.crouch = damp(this.crouch, st.crouch || this._antic || 0, 70, D); this._antic = 0;
    // stopping settle: decel kicks a small damped dip
    const decel = Math.max(0, this.prevSpeed - speed); this.prevSpeed = speed;
    if (grounded && D > 0) this.settleV += decel * 0.9;
    for (const [x, v, kk, c] of [['settle', 'settleV', 140, 14], ['land', 'landV', 170, 15]]) {
      this[v] += (-kk * this[x] - c * this[v]) * D; this[x] += this[v] * D;
    }
    const w = this.walk * (1 - this.air), r = this.run;
    const G = {}; for (const key in WALK) G[key] = lerp(WALK[key], RUN[key], r);
    const H = this.h;
    const S = strideLength(Math.max(speed, 0.6), r, this.strideMul);   // in rig units (world = S * H)
    if (grounded) this.phase = (this.phase + speed * D / (S * H)) % 1;   // phase advances by distance
    const p = this.phase, TAU = Math.PI * 2;
    const ex = 1 + 0.25 * r;   // readability boost at pixel scale
    // ---- body: bob (lowest at "down", 2x per cycle), lean, pelvis yaw/roll, sway ----
    const bobPh = lerp(0.07, G.duty / 2, r);
    const bob = -G.bobA * Math.cos(TAU * 2 * (p - bobPh)) * w - G.crouch * w;
    const squash = clamp(this.land, -0.2, 1);
    const crouchY = Math.max(this.crouch, 0) * 0.26 + squash * 0.17 + this.settle * 0.05;
    this.lean = damp(this.lean, G.lean * w * smooth(0.2, 2.5, speed) + this.crouch * 0.3 + squash * 0.25 - this.settle * 0.15 + this.air * (vy > 0 ? 0.08 : -0.02) * this.walk, 10, D || 1);
    const turnLean = clamp(-(st.turn || 0) * speed * 0.012, -0.22, 0.22);
    this.leanZ = damp(this.leanZ, turnLean * (1 - this.air), 6, D || 1);
    const c1 = Math.cos(TAU * p);                       // +1 when the left leg is forward
    const pelvisYaw = -G.pelvis * c1 * w;
    const shoulderYaw = G.shoulder * c1 * w * ex;      // counter-rotates the pelvis
    const breathe = Math.sin(this.t * 1.7);
    const hipY = HIP_Y + bob - crouchY + breathe * 0.002 * (1 - w);
    P.body.rotation.set(this.lean, pelvisYaw, G.roll * Math.sin(TAU * p) * w + this.leanZ);
    P.body.updateMatrix();
    _q.setFromEuler(P.body.rotation); _v.set(0, HIP_Y, 0).applyQuaternion(_q);
    P.body.position.set(G.sway * Math.sin(TAU * p) * w - _v.x, hipY - _v.y, -_v.z).multiplyScalar(H);
    P.body.scale.set(1 + squash * 0.03, 1 - squash * 0.04, 1 + squash * 0.03).multiplyScalar(H);
    P.body.updateMatrix();
    // ---- legs: foot targets in root space, then IK ----
    _m.copy(P.body.matrix).invert();
    for (const [side, off, sx] of [['L', 0, 1], ['R', 0.5, -1]]) {
      const lp = (p + off) % 1;
      const ft = this._foot(lp, G.duty, S, G.lift * ex, r);
      // airborne: tuck while rising, reach down for the landing
      const tuck = vy > 0 ? 0.42 : clamp(0.42 + vy * 0.05, 0.08, 0.42);
      const air = { z: sx * 0.06 * this.walk + 0.05, y: ANKLE_H + tuck, pitch: 0.35 };
      const rest = { z: 0, y: ANKLE_H, pitch: 0 };
      let z = lerp(rest.z, ft.z, w), y = lerp(rest.y, ft.y, w), pitch = lerp(rest.pitch, ft.pitch, w);
      z = lerp(z, air.z, this.air); y = lerp(y, air.y, this.air); pitch = lerp(pitch, air.pitch, this.air);
      this._ik(side, sx, _v.set(sx * this.hipX * H, y * H, z * H).applyMatrix4(_m), pitch);
    }
    // ---- arms: opposite to the legs, elbows bend more on the back-swing; run = pumping 90° ----
    const tYaw = shoulderYaw - pelvisYaw;
    P.torso.rotation.y = tYaw;
    for (const [side, sx, off] of [['L', 1, 0.5], ['R', -1, 0]]) {
      const a = P['arm' + side];
      const sw = Math.cos(TAU * (p + off - 0.04 * (1 - r)));   // +1 = this arm forward
      const fw = Math.max(0, sw), bk = Math.max(0, -sw);
      const walkSh = -(fw * 0.55 - bk * 0.42) * ex, runSh = -(fw * 0.85 - bk * 0.75) + 0.1;
      const walkEl = 0.18 + bk * 0.32 + fw * 0.22, runEl = 1.45 + fw * 0.2 - bk * 0.15;
      let shX = lerp(walkSh, runSh, r) * w + breathe * 0.015 * (1 - w);
      let el = lerp(walkEl, runEl, r) * w + 0.08 * (1 - w);
      let abd = 0.06 + 0.06 * w + r * 0.08 * w + Math.sin(this.t * 0.9 + sx) * 0.012 * (1 - w);
      // jump: arms swing back on the crouch, up and out in the air
      shX = shX * (1 - this.crouch) + this.crouch * 0.75;
      const up = this.air * (vy > 0 ? 1 : clamp(0.6 + vy * 0.04, 0.2, 0.6));
      shX = lerp(shX, -2.1, up * 0.8); abd = lerp(abd, 0.95, this.air); el = lerp(el, 0.35, this.air);
      shX += squash * 0.5;
      _v.set(sx * this.shX, SHOULDER_Y, 0).applyAxisAngle(THREE.Object3D.DEFAULT_UP, tYaw);
      a.position.copy(_v);
      a.rotation.set(shX, tYaw, sx * abd);
      P['elbow' + side].rotation.set(-el, 0, 0);
      P['wrist' + side].rotation.set(fw * 0.35 * w * (1 - r), 0, sx * 0.1 * w);
    }
    P.torso.position.y = breathe * 0.003 * (1 - w);
    // head stays level-ish and looks where it goes; idle look-around
    const look = Math.sin(this.t * 0.37) * 0.35 + Math.sin(this.t * 0.83) * 0.12;
    const idle = (1 - this.walk) * (1 - this.air);
    P.head.rotation.y = look * idle - pelvisYaw;
    P.head.rotation.z = 0;
    P.head.rotation.x = -this.lean * 0.6 + 0.03 * Math.sin(this.t * 0.5) * idle + this.air * (vy > 0 ? -0.1 : 0.12);
    this._actions(D);
  }

  // one leg's foot target at leg-phase lp (0 = heel strike), stance first then swing
  _foot(lp, duty, S, lift, r) {
    const span = duty * S;
    const zF = span * lerp(0.5, 0.42, r), zB = zF - span;   // run lands nearer under the hips
    let z, y, pitch;
    if (lp < duty) {                       // stance: planted, moves back at exactly body speed
      const t = lp / duty;
      z = lerp(zF, zB, t);
      const heel = lerp(-0.35, -0.06, r) * (1 - smooth(0, 0.18, t));   // heel strike, toe up
      const toe = lerp(0.75, 0.95, r) * smooth(0.62, 1, t);              // heel rises, roll onto toes
      pitch = heel + toe;
    } else {                               // swing: lift, knee drives forward, reach
      const t = (lp - duty) / (1 - duty);
      const e = r > 0.5 ? smooth(0, 1, Math.pow(t, 1.25)) : smooth(0, 1, t);
      z = lerp(zB, zF, e) + Math.sin(Math.PI * t) * 0.04 * r;
      const peak = Math.pow(Math.sin(Math.PI * Math.pow(t, lerp(0.75, 0.6, r))), 1.3);
      y = ANKLE_H + lift * peak;
      pitch = lerp(lerp(0.75, 0.95, r), lerp(-0.35, -0.06, r), smooth(0.05, 0.9, t)) + 0.25 * r * peak;
      return { z, y, pitch };
    }
    // foot roll: pivot on the heel (toe up) or on the toes (heel up) raises the ankle
    y = ANKLE_H + (pitch < 0 ? Math.sin(-pitch) * 0.075 : Math.sin(pitch) * 0.15);
    return { z, y, pitch };
  }

  // two-bone IK in the leg's sagittal plane; target is in body-local space
  _ik(side, sx, tgt, footPitch) {
    const P = this.parts;
    const dy = tgt.y - HIP_Y, dz = tgt.z;
    const L = clamp(Math.hypot(dy, dz), 0.25, LEG_L * 0.9995);
    const cosK = clamp((THIGH * THIGH + SHIN * SHIN - L * L) / (2 * THIGH * SHIN), -1, 1);
    const knee = Math.PI - Math.acos(cosK);
    const cosB = clamp((THIGH * THIGH + L * L - SHIN * SHIN) / (2 * THIGH * L), -1, 1);
    const hip = Math.atan2(-dz, -dy) - Math.acos(cosB);
    P['leg' + side].rotation.set(hip, 0, 0);
    P['knee' + side].rotation.set(knee, 0, 0);
    P['ankle' + side].rotation.set(footPitch - (this.lean + hip + knee), 0, 0);
  }

  /** Freeze into a walk/run pose at a cycle phase (0..1 or radians>1 legacy). */
  setWalkPose(phase = 0.25, speed = 1.4) {
    this.phase = phase > 1.0001 ? (phase / (Math.PI * 2)) % 1 : phase;
    this.prevSpeed = speed;
    const ph = this.phase; this.update(0, { speed }); this.phase = ph;
  }
  // ---- dances (special NPCs): full-body keyframed poses blended over the locomotion pose ----
  /** Start a named dance (see DANCES). Returns its duration in seconds (0 = unknown). */
  dance(name) {
    const d = DANCES[name]; if (!d) return 0;
    this._dance = { d, name, t: 0, out: -1, outDur: 0.2, outW: 1 }; this._danceW = 0;
    return d.dur;
  }
  /** Blend out of the current dance quickly (slap, interruption). */
  stopDance(fade = 0.18) {
    const s = this._dance; if (s && s.out < 0) { s.out = 0; s.outDur = fade; s.outW = this._danceW || 0; }
  }
  get dancing() { return !!this._dance && this._dance.out < 0; }
  get danceName() { return this._dance ? this._dance.name : null; }
  _danceStep(D) {
    const s = this._dance, d = s.d;
    s.t += D; if (s.out >= 0) s.out += D;
    let w = smooth(0, d.blendIn, s.t) * (1 - smooth(d.dur - d.blendOut, d.dur, s.t));
    if (s.out >= 0) w = Math.min(w, s.outW * (1 - smooth(0, s.outDur, s.out)));
    if (s.t >= d.dur || (s.out >= 0 && s.out >= s.outDur)) { this._dance = null; this._danceW = 0; return; }
    this._danceW = w;
    const P = this.parts;
    const J = this._joints || (this._joints = ['body', 'torso', 'head', 'armL', 'armR', 'elbowL', 'elbowR', 'wristL', 'wristR',
      'legL', 'legR', 'kneeL', 'kneeR', 'ankleL', 'ankleR'].map((k) => ({ o: P[k], p: new THREE.Vector3(), q: new THREE.Quaternion() })));
    for (const j of J) { j.p.copy(j.o.position); j.q.copy(j.o.quaternion); }
    const pose = this._dancePose = d.pose(s.t, this);
    this._applyPose(pose);
    for (const j of J) {
      j.o.position.lerpVectors(j.p, j.o.position, w);
      _q.copy(j.o.quaternion); j.o.quaternion.copy(j.q).slerp(_q, w);
    }
  }
  // pose: { dip, lean, yaw, roll, hx, hz, ty, stance, fz:[L,R], head:[x,y,z], L/R:{ w:[wrist], e:[elbow pole], r, f } }
  _applyPose(p) {
    const P = this.parts, H = this.h;
    const lean = p.lean || 0, dip = p.dip || 0;
    P.body.rotation.set(lean, p.yaw || 0, p.roll || 0);
    _q.setFromEuler(P.body.rotation); _v.set(0, HIP_Y, 0).applyQuaternion(_q);
    P.body.position.set((p.hx || 0) - _v.x, HIP_Y - dip - _v.y, (p.hz || 0) - _v.z).multiplyScalar(H);
    P.body.updateMatrix();
    _m.copy(P.body.matrix).invert();
    this.lean = lean;
    const st = p.stance || 0, fz = p.fz || [0, 0];
    for (const [side, sx, i] of [['L', 1, 0], ['R', -1, 1]]) {
      this._ik(side, sx, _v.set(sx * this.hipX * H, ANKLE_H * H, fz[i] * H).applyMatrix4(_m), 0);
      const a = Math.asin(clamp(st / Math.max(0.3, HIP_Y - dip - ANKLE_H), -0.6, 0.6));
      P['leg' + side].rotation.z = sx * a; P['ankle' + side].rotation.z = -sx * a;
    }
    const ty = p.ty || 0;
    P.torso.rotation.y = ty;
    const h = p.head || [0, 0, 0];
    P.head.rotation.set(h[0], h[1] + ty * 0.5, h[2]);
    const ao = this.armOff, adj = (a, sx) => (ao ? [a[0] + sx * ao.x, a[1], a[2] + ao.z] : a);   // custom bodies: wider / deeper
    if (p.L) this._armIK('L', adj(p.L.w, 1), adj(p.L.e, 1), p.L.r || 0, p.L.f || 0, ty);
    if (p.R) this._armIK('R', adj(p.R.w, -1), adj(p.R.e, -1), p.R.r || 0, p.R.f || 0, ty);
  }
  /** Two-bone arm IK in body space: wrist target W, elbow pole E (points, torso space), wrist roll/flex. */
  _armIK(side, W, E, roll = 0, flex = 0, ty = 0) {
    const P = this.parts, sx = side === 'L' ? 1 : -1;
    const S = _A.set(sx * this.shX, SHOULDER_Y, 0).applyAxisAngle(THREE.Object3D.DEFAULT_UP, ty);
    const T = _B.fromArray(W).applyAxisAngle(THREE.Object3D.DEFAULT_UP, ty).sub(S);
    const pp = _C.fromArray(E).applyAxisAngle(THREE.Object3D.DEFAULT_UP, ty).sub(S);
    P['arm' + side].position.copy(S);
    const A = UPPER, B = FORE;
    const dist = clamp(T.length(), A - B + 0.02, A + B - 0.002);
    const dn = T.normalize();
    const cosA = clamp((A * A + dist * dist - B * B) / (2 * A * dist), -1, 1), sinA = Math.sqrt(1 - cosA * cosA);
    pp.addScaledVector(dn, -pp.dot(dn)); if (pp.lengthSq() < 1e-8) pp.set(0, 0, -1); pp.normalize();
    const u = _D.copy(dn).multiplyScalar(cosA).addScaledVector(pp, sinA);           // upper-arm direction
    const f = _E.copy(dn).multiplyScalar(dist).addScaledVector(u, -A).normalize();  // forearm direction
    const Y = _F.copy(u).negate();
    const Z = _G.copy(f).addScaledVector(u, -f.dot(u));
    if (Z.lengthSq() < 1e-8) Z.copy(pp); Z.normalize();
    const X = _Hv.crossVectors(Y, Z);
    _M2.makeBasis(X, Y, Z);
    P['arm' + side].quaternion.setFromRotationMatrix(_M2);
    P['elbow' + side].rotation.set(-Math.acos(clamp(u.dot(f), -1, 1)), 0, 0);
    P['wrist' + side].rotation.set(flex, roll, 0);
  }
  dispose() { this.root.removeFromParent(); }
}

/**
 * Tiny jump physics shared by the game and the showcase.
 * motor.jump() -> anticipation crouch, then takeoff; motor.step(dt, groundY) each frame;
 * feed motor.state into character.update(dt, { speed, ...motor.state }).
 */
export class JumpMotor {
  constructor({ height = 1.1, gravity = 34, anticipation = 0.08 } = {}) {
    Object.assign(this, { height, gravity, anticipation });
    this.v0 = Math.sqrt(2 * gravity * height);
    this.y = 0; this.vy = 0; this.grounded = true; this.antic = -1; this.justLanded = false;
  }
  get busy() { return !this.grounded || this.antic >= 0; }
  jump() { if (this.busy) return false; this.antic = 0; return true; }   // no double jump
  step(dt, groundY = 0) {
    this.justLanded = false;
    if (this.antic >= 0) {
      this.antic += dt;
      if (this.antic >= this.anticipation) { this.antic = -1; this.vy = this.v0; this.grounded = false; this.y = Math.max(this.y, groundY); }
    }
    if (!this.grounded) {
      this.vy -= this.gravity * dt; this.y += this.vy * dt;
      if (this.y <= groundY && this.vy <= 0) { this.y = groundY; this.vy = 0; this.grounded = true; this.justLanded = true; }
      else if (this.y < groundY) this.y = groundY;            // rising past a curb edge
    } else this.y = damp(this.y, groundY, 20, dt);         // step up/down sidewalks
    return this.state;
  }
  get crouch() { return this.antic >= 0 ? smooth(0, 1, this.antic / this.anticipation) : 0; }
  get state() { return { grounded: this.grounded, vy: this.vy, crouch: this.crouch }; }
}

// ---------- public API ----------
export function createMainCharacter(opts = {}) {
  const cfg = { name: 'main', skin: PALETTE.peach, line: PALETTE.orange, outfit: 'none', hair: 'none', ...opts };
  const P = buildBody(cfg);
  buildOutfit(P, cfg);
  return new Character(P, cfg);
}

/** Resolve a full NPC config from partial options + seed (deterministic). */
export function npcConfig(opts = {}) {
  const seed = opts.seed ?? Math.floor(Math.random() * 1e9);
  const r = mulberry32(seed);
  const pick = (arr) => arr[Math.floor(r() * arr.length)];
  const outfit = opts.outfit ?? pick(OUTFITS);
  const hair = opts.hair ?? pick(HAIRSTYLES.filter((h) => h !== 'none'));
  const hairColor = opts.hairColor ?? pick(HAIR_COLORS);
  const glasses = opts.glasses ?? (r() < 0.35);
  // --- v2 variety (drawn after the original picks so old seeds keep their outfit/hair) ---
  const cloth = (tint = 0.35) => (r() < tint ? pick(CLOTH_TINT) : pick(CLOTH_NEUTRAL));
  let top = cloth(), bottom = r() < 0.5 ? pick(DENIM) : pick([PALETTE.slate, PALETTE.black, COMIC.neutrals[2], COMIC.warm[0]]);
  if (outfit === 'suit') top = pick([PALETTE.black, PALETTE.slate, COMIC.blues[0], COMIC.neutrals[2]]);
  if (outfit === 'overalls') bottom = pick(DENIM.slice(0, 2).concat([COMIC.teals[0], COMIC.warm[1]]));
  if (top === bottom) top = PALETTE.white;
  const colors = {
    top, bottom, inner: cloth(0.3), shoe: pick([PALETTE.black, PALETTE.slate, PALETTE.white, COMIC.warm[0]]),
    accent: pick([COMIC.pinks[0], COMIC.blues[1], COMIC.yellows[0], COMIC.teals[1], PALETTE.white, PALETTE.slate]),
    shorts: r() < 0.5, ...(opts.colors || {}),
  };
  if (colors.inner === colors.top) colors.inner = colors.top === PALETTE.white ? PALETTE.black : PALETTE.white;
  const height = opts.height ?? +(0.93 + r() * 0.13).toFixed(3);
  const build = opts.build ?? +(0.9 + r() * 0.24).toFixed(3);
  const hatRoll = r(), hatColor = cloth(0.5), accRoll = r(), accColor = cloth(0.5);
  const hat = opts.hat ?? (HAT_HAIR.includes(hair) && hatRoll < 0.22 ? (hatRoll < 0.11 ? 'beanie' : 'cap') : 'none');
  let acc = opts.accessories;
  if (!acc) {
    acc = [];
    if (accRoll < 0.18) acc.push('backpack'); else if (accRoll < 0.3) acc.push('tote');
    if (r() < 0.14) acc.push('scarf');
    if (hat === 'none' && HAT_HAIR.includes(hair) && r() < 0.1) acc.push('headphones');
  }
  return { name: 'npc', skin: PALETTE.npcSkin, line: PALETTE.npcLine, seed, ...opts,
    outfit, hair, hairColor, glasses, colors, height, build, hat, hatColor: opts.hatColor ?? hatColor, accessories: acc, accColor: opts.accColor ?? accColor };
}

export function createNPC(opts = {}) {
  const cfg = npcConfig(opts);
  const P = buildBody(cfg);
  buildOutfit(P, cfg);
  buildHair(P.headCenter, cfg.hair, cfg.hairColor, PALETTE.npcLine, mulberry32(String(cfg.seed) + cfg.hair));
  if (cfg.glasses) buildGlasses(P.headCenter, PALETTE.slate);
  if (cfg.hat && cfg.hat !== 'none') buildHat(P.headCenter, cfg.hat, cfg.hatColor, cfg.colors.accent === cfg.hatColor ? PALETTE.slate : cfg.colors.accent);
  for (const a of cfg.accessories || []) buildAccessory(P, a, a === 'headphones' ? PALETTE.slate : cfg.accColor, cfg);
  return new Character(P, cfg);
}

export function createCrowd(count, seed = 1) {
  const r = mulberry32(seed);
  return Array.from({ length: count }, () => createNPC({ seed: Math.floor(r() * 1e9) }));
}

// The NPC looks from the character sheet, ready-made
export const PRESETS = {
  shirtSpiky: { outfit: 'shirt', hair: 'spiky', hairColor: PALETTE.black, glasses: false },
  teeQuiff: { outfit: 'tee', hair: 'quiff', hairColor: PALETTE.slate, glasses: true },
  coatLong: { outfit: 'coat', hair: 'long', hairColor: PALETTE.black, glasses: true },
  blousePonytail: { outfit: 'blouse', hair: 'ponytail', hairColor: PALETTE.black, glasses: false },
  apronBun: { outfit: 'apron', hair: 'bun', hairColor: PALETTE.slate, glasses: false },
};
for (const k in PRESETS) Object.assign(PRESETS[k], { height: 1, build: 1, hat: 'none', accessories: [] });
// v2 looks (new outfits / hair / accessories)
export const PRESETS_V2 = {
  hoodieAfro: { outfit: 'hoodie', hair: 'afro', colors: { top: COMIC.teals[1], bottom: COMIC.blues[0], accent: PALETTE.white }, accessories: ['backpack'], accColor: PALETTE.black },
  suitSlicked: { outfit: 'suit', hair: 'slicked', hairColor: PALETTE.slate, colors: { top: PALETTE.slate, accent: COMIC.pinks[0] }, build: 1.1, height: 1.04 },
  dressBraids: { outfit: 'dress', hair: 'braids', hairColor: COMIC.warm[0], colors: { top: COMIC.yellows[3], accent: COMIC.warm[1], shoe: PALETTE.slate }, accessories: ['tote'], accColor: COMIC.pinks[3] },
  overallsMohawk: { outfit: 'overalls', hair: 'mohawk', colors: { inner: COMIC.pinks[3], bottom: COMIC.blues[1], accent: PALETTE.white } },
  cardiganBob: { outfit: 'cardigan', hair: 'bob', colors: { top: COMIC.pinks[3], inner: PALETTE.white, bottom: PALETTE.slate }, glasses: true, height: 0.94 },
  sweaterBeanie: { outfit: 'sweater', hair: 'pixie', hat: 'beanie', hatColor: COMIC.yellows[1], colors: { top: COMIC.blues[3], bottom: PALETTE.black }, accessories: ['scarf'], accColor: COMIC.pinks[0] },
  shortsCap: { outfit: 'shortsTee', hair: 'buzz', hat: 'cap', hatColor: COMIC.blues[1], colors: { top: PALETTE.white, bottom: COMIC.neutrals[3], accent: PALETTE.white }, accessories: ['headphones'] },
  blazerLong: { outfit: 'blazer', hair: 'longStraight', hairColor: COMIC.warm[1], colors: { top: COMIC.warm[1], inner: PALETTE.white, bottom: PALETTE.black }, height: 1.02 },
  tankReceding: { outfit: 'tank', hair: 'receding', hairColor: COMIC.neutrals[2], colors: { top: PALETTE.white, bottom: COMIC.blues[1], shorts: true }, build: 1.14, height: 0.95, glasses: true },
};
for (const k in PRESETS_V2) PRESETS_V2[k] = { hairColor: PALETTE.black, glasses: false, hat: 'none', accessories: [], height: 1, build: 1, ...PRESETS_V2[k] };


// =====================================================================================
// Special (named) easter-egg NPCs: stylised caricatures + click-to-dance routines
// =====================================================================================
const mirror = (a) => ({ ...a, w: [-a.w[0], a.w[1], a.w[2]], e: [-a.e[0], a.e[1], a.e[2]], r: -(a.r || 0) });
function lerpPose(a, b, u) {
  if (typeof a === 'number') return a + ((typeof b === 'number' ? b : a) - a) * u;
  if (Array.isArray(a)) return a.map((v, i) => lerpPose(v, b ? b[i] : v, u));
  const o = {};
  for (const k in a) o[k] = b && k in b ? lerpPose(a[k], b[k], u) : a[k];
  return o;
}
const clonePose = (p) => JSON.parse(JSON.stringify(p));
// keys: [[time, pose, ease('in'|'lin'|undefined=smoothstep)]], all poses share the same shape
function sampleKeys(K, t) {
  if (t <= K[0][0]) return clonePose(K[0][1]);
  let i = 0; while (i < K.length - 1 && t > K[i + 1][0]) i++;
  if (i >= K.length - 1) return clonePose(K[K.length - 1][1]);
  const [t0, a] = K[i], [t1, b, ease] = K[i + 1];
  let u = clamp((t - t0) / (t1 - t0), 0, 1);
  u = ease === 'lin' ? u : ease === 'in' ? u * u : ease === 'out' ? 1 - (1 - u) * (1 - u) : u * u * (3 - 2 * u);
  return lerpPose(a, b, u);
}
const pose = (o = {}) => ({ dip: 0, lean: 0, yaw: 0, roll: 0, hx: 0, hz: 0, ty: 0, stance: 0, fz: [0, 0], head: [0, 0, 0],
  L: ARM.restL, R: mirror(ARM.restL), ...o });
const ARM = {
  restL: { w: [0.245, 0.93, 0.04], e: [0.33, 1.25, -0.15], r: 0, f: 0 },
  looseL: { w: [0.27, 0.95, 0.07], e: [0.36, 1.25, -0.1], r: 0, f: 0.1 },
  templeL: { w: [0.125, 1.85, 0.075], e: [0.6, 1.74, 0.02], r: 0.4, f: 0.25 },
  crossR: { w: [0.13, 1.37, 0.23], e: [-0.34, 1.3, 0.12], r: -0.6, f: 0 },
  crossL: { w: [-0.13, 1.33, 0.24], e: [0.34, 1.27, 0.12], r: 0.6, f: 0 },
  outR: { w: [-0.52, 1.08, 0.16], e: [-0.45, 1.35, -0.1], r: 0, f: 0 },
  highR: { w: [-0.12, 2.27, 0.1], e: [-0.45, 1.95, 0.05], r: 0, f: 0 },
  midR: { w: [-0.02, 1.48, 0.36], e: [-0.4, 1.38, 0.12], r: -0.4, f: 0 },
  // the signature: right forearm flat across the stomach, palm down, elbow tucked at the ribs
  coreR: { w: [0.03, 1.21, 0.235], e: [-0.26, 1.2, -0.02], r: -1.25, f: 0 },
  hangL: { w: [0.255, 0.9, 0.03], e: [0.32, 1.2, -0.2], r: 0, f: 0 },
  heartL: { w: [0.07, 1.44, 0.3], e: [0.36, 1.3, 0.1], r: 0.9, f: 0.2 },
  clapOL: { w: [0.17, 1.36, 0.31], e: [0.42, 1.22, 0.02], r: 0.9, f: 0 },
  clapCL: { w: [0.04, 1.39, 0.33], e: [0.42, 1.22, 0.02], r: 0.9, f: 0 },
  // Syoya
  flingL: { w: [0.86, 1.52, 0.1], e: [0.55, 1.62, -0.25], r: 0, f: 0 },
  chestR: { w: [0.02, 1.4, 0.24], e: [-0.36, 1.3, 0.05], r: -0.5, f: 0 },
  wL: { w: [0.5, 1.9, 0.06], e: [0.62, 1.32, -0.02], r: 0, f: 0.3 },
};
const MB = {
  base: pose(),
  temple: pose({ dip: 0.02, head: [0.06, 0, 0], L: ARM.templeL, R: mirror(ARM.templeL) }),
  drop: pose({ dip: 0.05, yaw: 0.3, ty: 0.12, head: [0.02, -0.25, 0], L: ARM.looseL, R: mirror(ARM.looseL) }),
  crossR: pose({ dip: 0.04, yaw: 0.18, ty: 0.18, head: [0.0, -0.1, 0], L: ARM.looseL, R: ARM.crossR }),
  crossL: pose({ dip: 0.04, yaw: -0.05, ty: -0.2, head: [0.0, 0.1, 0], L: ARM.crossL, R: ARM.outR }),
  high: pose({ dip: 0.0, lean: -0.06, yaw: 0.08, head: [-0.22, -0.1, 0], L: ARM.looseL, R: ARM.highR }),
  mid: pose({ dip: 0.05, lean: 0.08, head: [0.08, 0, 0], L: ARM.looseL, R: ARM.midR }),
  core: pose({ dip: 0.05, lean: 0.1, hz: -0.02, head: [-0.12, 0.1, 0.1], L: ARM.hangL, R: ARM.coreR }),
  heart: pose({ dip: 0.02, lean: 0.0, head: [-0.06, 0, 0.14], L: ARM.heartL, R: mirror(ARM.heartL) }),
  clapO: pose({ dip: 0.03, head: [0.0, 0, 0], L: ARM.clapOL, R: mirror(ARM.clapOL) }),
  clapC: pose({ dip: 0.06, lean: 0.06, head: [0.08, 0, 0], L: ARM.clapCL, R: mirror(ARM.clapCL) }),
};
const MB_BEAT0 = 4.25, MB_BEAT = 1.7, MB_BEATS = 3;               // core: 3 phrases of flutter -> slow chest-puff press
const MB_FL = 0.6, MB_PR = 0.85, MB_HZ = 7;                         // flutter length, slow press length, flutter rate (Hz)
const MB_CORE_END = MB_BEAT0 + MB_BEAT * MB_BEATS, MB_OUT = MB_CORE_END - 8.35;
const MB_KEYS = [
  [0, MB.base], [0.55, MB.temple], [1.1, MB.temple],              // hands to temples, elbows flared
  [1.5, MB.drop], [1.8, MB.crossR, 'out'], [2.1, MB.crossL, 'out'], [2.45, MB.crossR, 'out'], [2.65, MB.crossR],
  [3.05, MB.high], [3.25, MB.high], [3.6, MB.mid, 'in'],            // right arm high, sweeps down to centre
  [3.95, MB.core], [MB_CORE_END + 0.1, MB.core],                    // core loop (phrases added on top)
  [8.75 + MB_OUT, MB.heart], [9.3 + MB_OUT, MB.heart],              // heart hands
  [9.45 + MB_OUT, MB.clapO], [9.65 + MB_OUT, MB.clapC, 'in'], [9.9 + MB_OUT, MB.clapO], [10.15 + MB_OUT, MB.clapC, 'in'], [10.9 + MB_OUT, MB.base],
];
// one core phrase, x in seconds since phrase start -> { fl: flutter offset (-1..1, enveloped), pr: slow press 0..1, rs: reset weight }
function mbPhrase(x) {
  const flE = smooth(0, 0.08, x) * (1 - smooth(MB_FL - 0.1, MB_FL, x));
  const fl = x < MB_FL ? Math.sin(x * Math.PI * 2 * MB_HZ) * flE : 0;
  const pr = x < MB_FL ? 0 : x < MB_FL + MB_PR ? smooth(MB_FL, MB_FL + MB_PR, x) : 1 - smooth(MB_FL + MB_PR, MB_BEAT, x);
  return { fl, flE, pr };
}
const SY_DUR = 7.4, SY_W = Math.PI * 2 * 1.75;
export const DANCES = {
  mbappe: {
    dur: 10.9 + MB_OUT, blendIn: 0.35, blendOut: 0.7,
    pose(t, ch) {
      const p = sampleKeys(MB_KEYS, t);
      // temples: little nods
      if (t > 0.5 && t < 1.2) p.head[0] += 0.05 * Math.sin((t - 0.5) * 18);
      const bt = t - MB_BEAT0;
      if (bt >= 0 && t < MB_CORE_END) {
        const k = Math.floor(bt / MB_BEAT), x = bt - k * MB_BEAT;
        const { fl, flE, pr } = mbPhrase(x);
        // 1) rapid flutter: flat hand + forearm buzz up/down from the wrist, tiny body jiggle, knees soft
        p.R.w[1] += 0.03 * flE + 0.1 * fl; p.R.e[1] += 0.035 * fl; p.R.r += 0.35 * fl;
        p.dip += 0.05 * flE + 0.012 * fl; p.ty += 0.03 * fl; p.head[0] += 0.05 * flE;
        // 2) slow smooth press down while puffing the chest: arch back, shoulders up/back, chin up, rise out of the dip
        p.R.w[1] -= 0.11 * pr; p.R.w[2] += 0.03 * pr; p.R.e[1] -= 0.05 * pr; p.R.e[2] -= 0.05 * pr;
        p.lean -= 0.26 * pr; p.dip -= 0.06 * pr; p.hz += 0.03 * pr;
        p.head[0] -= 0.32 * pr; p.head[1] += 0.06 * pr;
        p.L.w[1] += 0.06 * pr; p.L.w[2] -= 0.06 * pr; p.L.e[1] += 0.06 * pr; p.L.e[2] -= 0.06 * pr;
        p.R.e[2] -= 0.04 * pr;
      }
      return p;
    },
  },
  hula: {
    dur: SY_DUR, blendIn: 0.45, blendOut: 0.6,
    pose(t) {
      const ph = SY_W * t;
      const e = smooth(0.1, 0.8, t) * (1 - smooth(SY_DUR - 0.9, SY_DUR - 0.25, t));
      const c = Math.cos(ph), s = Math.sin(ph);
      const armB = smooth(2.5, 3.0, t);
      const L = lerpPose(ARM.flingL, ARM.wL, armB), R = lerpPose(ARM.chestR, mirror(ARM.wL), armB);
      const bounce = Math.sin(ph * 2) * 0.045 * e * armB;
      L.w[1] += bounce; R.w[1] += bounce; L.e[1] += bounce * 0.6; R.e[1] += bounce * 0.6;
      L.w[1] += 0.04 * s * e * (1 - armB);
      const roll = -0.12 * c * e, lean = 0.03 + 0.06 * s * e;
      return {
        dip: 0.17 + 0.025 * Math.sin(ph * 2) * e, lean, yaw: 0.1 * s * e, roll,
        hx: 0.085 * c * e, hz: 0.065 * s * e, ty: -0.12 * s * e, stance: 0.13, fz: [0.03, 0.03],
        head: [-lean * 0.9 + 0.07 * Math.sin(ph * 2) * e, 0.08 * s * e, -roll * 1.7],
        L, R, ph, e,
      };
    },
  },
};

// ---- Mbappé: white jersey (3 shoulder stripes, block 9 on the back), white kit, dark boots ----
function blockNine(parent, x0, y0, z, h, w, t, color) {
  const seg = (x, y, sw, sh) => mesh(new THREE.BoxGeometry(sw, sh, 0.01), color, parent, { pos: [x, y, z] });
  seg(x0, y0 + h / 2, w, t); seg(x0, y0, w, t); seg(x0, y0 - h / 2, w, t);            // top / middle / bottom
  seg(x0 + w / 2 - t / 2, y0 + h / 4, t, h / 2);                                          // upper loop (viewer's left from behind)
  seg(x0 - w / 2 + t / 2, y0, t, h + t);                                                  // stem (viewer's right from behind)
}
export function createMbappe(opts = {}) {
  const C = PALETTE, BLACK = C.black, WHITE = C.white;
  const cfg = { name: 'mbappe', special: 'mbappe', skin: opts.skin || COMIC.warm[1], line: COMIC.warm[0], outfit: 'special', hair: 'buzz', height: 1.02, build: 1, ...opts };
  const P = buildBody(cfg), T = P.torso; P.legSwing = 0.34;
  mesh(lathe(shell(0.87, 1.07), 8, TORSO_Z), WHITE, T);
  mesh(new THREE.TorusGeometry(0.058, 0.009, 3, 10), BLACK, T, { pos: [0, 1.683, 0], rot: [Math.PI / 2, 0, 0], scale: [1, 0.85, 1] });   // collar trim
  blockNine(T, 0, 1.36, -0.142, 0.15, 0.085, 0.022, BLACK);
  sleeves(P, WHITE, 0.24, 0, [0.07, 0.066]);
  for (const side of ['L', 'R']) {
    const sx = side === 'L' ? 1 : -1, sh = P['arm' + side];
    for (const dz of [-0.026, 0, 0.026]) {
      // over the shoulder cap and down the outside of the sleeve
      mesh(new THREE.TorusGeometry(0.075, 0.0065, 3, 6, Math.PI * 0.62), BLACK, sh, { pos: [0, -0.004, dz], rot: [0, 0, -0.15], scale: [sx * 0.97, 0.82, 1] });
      mesh(new THREE.BoxGeometry(0.012, 0.2, 0.012), BLACK, sh, { pos: [sx * 0.0735, -0.12, dz] });
    }
    mesh(limb(0.041, 0.039, 0.05, 6, -FORE + 0.075), WHITE, P['elbow' + side]);             // wrist tape
  }
  mesh(lathe(clip(TORSO, 0.84, 0.95, 1.1), 8, TORSO_Z), WHITE, T);                           // shorts waist
  dressLegs(P, cfg, { thigh: cfg.skin, shin: cfg.skin, thighR: [0.08, 0.068], shinR: [0.066, 0.049],
    shorts: 0.27, shortsColor: WHITE, shoe: BLACK, sole: C.slate });
  for (const side of ['L', 'R'])                                                                // socks to below the knee
    mesh(limb(0.07, 0.056, 0.3, 6, -0.075), WHITE, P['knee' + side]);
  buildHair(P.headCenter, 'buzz', BLACK, BLACK);
  // sharp hairline: a thin dark band right at the front edge
  mesh(new THREE.TorusGeometry(0.104, 0.006, 3, 10, Math.PI * 0.7), BLACK, P.headCenter, { pos: [0, 0.07, 0.0], rot: [Math.PI / 2 - 0.35, 0, Math.PI * 0.15 - Math.PI / 2 + Math.PI * 0.2], scale: [1, HEAD_Z, 1] });
  const ch = new Character(P, cfg);
  return ch;
}

// ---- Syoya (shown as KIMATA): backward white cap, pink striped tee, navy shorts, barefoot, watermelon pool ring ----
function watermelonRing({ R = 0.37, r = 0.105 } = {}) {
  const g = new THREE.Group(); g.name = 'watermelonRing';
  const G1 = '#4DBA5A', G2 = '#1F6B35';                     // palette exception (prop only): bright + dark green
  const arc = (a0, a1, n) => Array.from({ length: n + 1 }, (_, i) => { const a = (a0 + (a1 - a0) * i / n) * Math.PI / 180; return [R + r * Math.cos(a), r * Math.sin(a)]; });
  // lathe profiles must run in a consistent direction; go from bottom-inner round the outside to the top
  const STR = 14;
  for (let k = 0; k < STR; k++)
    mesh(lathe(arc(-200, 40, 6), 2, 1, k * Math.PI * 2 / STR, Math.PI * 2 / STR), k % 2 ? G2 : G1, g, { double: true });
  mesh(lathe(arc(40, 58, 1), 16), PALETTE.white, g, { double: true });
  mesh(lathe(arc(58, 160, 4), 16), COMIC.pinks[1], g, { double: true });
  for (let i = 0; i < 9; i++) {                                          // seeds on the flesh
    const a = i / 9 * Math.PI * 2 + 0.3, rr = R + r * Math.cos(1.75) * (i % 2 ? 0.6 : 1.2);
    mesh(new THREE.BoxGeometry(0.022, 0.012, 0.03), PALETTE.black, g, { pos: [Math.cos(a) * (R + 0.01 * (i % 3 - 1)), r * 0.985, Math.sin(a) * (R + 0.01 * (i % 3 - 1))], rot: [0, -a, 0] });
  }
  return g;
}
export function createSyoya(opts = {}) {
  const C = PALETTE, WHITE = C.white, PINK = COMIC.pinks[1], NAVY = COMIC.blues[0];
  const cfg = { name: 'syoya', special: 'syoya', skin: COMIC.warm[3], line: COMIC.warm[1], outfit: 'special', hair: 'buzz', height: 1.0, build: 0.95, ...opts };
  const P = buildBody(cfg), T = P.torso; P.legSwing = 0.34;
  // striped crew-neck tee
  mesh(lathe(shell(0.9, 1.07), 8, TORSO_Z), WHITE, T);
  for (const y of [0.96, 1.12, 1.28, 1.44, 1.6]) mesh(lathe(clip(TORSO, y, y + 0.075, 1.085), 8, TORSO_Z), PINK, T);
  mesh(lathe(clip(TORSO, 1.655, 1.672, 1.09), 8, TORSO_Z), PINK, T, { double: true });       // collar rib
  sleeves(P, WHITE, 0.22, 0, [0.07, 0.066]);
  for (const side of ['L', 'R']) for (const y of [-0.05, -0.16]) mesh(limb(0.0725, 0.071, 0.05, 7, y), PINK, P['arm' + side]);
  // navy shorts to mid-thigh, barefoot
  mesh(lathe(clip(TORSO, 0.84, 0.96, 1.09), 8, TORSO_Z), NAVY, T);
  dressLegs(P, cfg, { thigh: cfg.skin, shin: cfg.skin, thighR: [0.076, 0.064], shinR: [0.062, 0.046], shorts: 0.2, shortsColor: NAVY, shoe: null });
  buildHair(P.headCenter, 'buzz', C.black, C.black);
  for (const sx of [-1, 1]) mesh(new THREE.BoxGeometry(0.02, 0.05, 0.05), C.black, P.headCenter, { pos: [sx * 0.104, 0.02, 0.01] });  // short sides under the cap
  const capG = group(P.headCenter); capG.rotation.y = Math.PI;                                  // cap worn backward
  buildHat(capG, 'cap', WHITE, WHITE);
  mesh(new THREE.BoxGeometry(0.06, 0.035, 0.012), C.black, capG, { pos: [0, 0.075, -0.112], rot: [0.35, 0, 0] });   // strap opening: hair showing at the forehead
  const ch = new Character(P, cfg); ch.cap = capG;
  // the ring: rests at the left hip under the hand; spins round the waist while dancing
  const ring = watermelonRing(); P.root.add(ring); ch.ring = ring;
  ring.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  const idleQ = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, -0.6, Math.PI / 2 - 0.12, 'YXZ'));
  const idleP = new THREE.Vector3(0.43, 0.62, 0.07);
  const dq = new THREE.Quaternion(), sq = new THREE.Quaternion(), dp = new THREE.Vector3(), eu = new THREE.Euler();
  ch.hold = (c) => { if (!c._dance || c._danceW < 0.999) c._armIK('L', [0.37, 1.08, 0.08], [0.48, 1.32, -0.2], 0.3, 0, c.parts.torso.rotation.y); };
  ch.prop = (c, p, w) => {
    ring.position.copy(idleP); ring.quaternion.copy(idleQ);
    if (!p || w <= 0) return;
    const ph = p.ph, e = p.e;
    const off = 0.105;   // hoop centre leads the hips by 90°
    dp.set(p.hx + off * Math.cos(ph - Math.PI / 2) * e, 1.0 - p.dip + 0.04 * Math.sin(ph * 2) * e, p.hz + off * Math.sin(ph - Math.PI / 2) * e);
    eu.set(0.28 * Math.cos(ph) * e, 0, 0.55 * Math.sin(ph) * e);    // 30°+ wobble, alternating sides
    dq.setFromEuler(eu); sq.setFromAxisAngle(THREE.Object3D.DEFAULT_UP, -ph * 0.6); dq.multiply(sq);
    ring.position.lerp(dp, w); ring.quaternion.slerp(dq, w);
  };
  ch.update(0, 0);
  ch.triangles += 0; let t2 = 0; ring.traverse((o) => { if (o.isMesh) t2 += (o.geometry.index ? o.geometry.index.count : o.geometry.attributes.position.count) / 3; }); ch.ringTriangles = t2;
  return ch;
}
// Mission giver: shady guy in a trench coat, beanie and sunglasses (blue-grey NPC base)
export function createGiver(opts = {}) {
  const C = PALETTE;
  const ch = createNPC({ seed: 4711, outfit: 'coat', hair: 'buzz', hairColor: C.black, glasses: false, hat: 'beanie', hatColor: C.black,
    colors: { top: COMIC.warm[1], inner: C.black, bottom: C.black, shoe: C.black, accent: C.slate, shorts: false },
    accessories: [], height: 1.0, build: 1.04, ...opts, name: 'giver', special: 'giver' });
  const hc = ch.parts.headCenter;
  for (const sx of [-1, 1]) mesh(new THREE.BoxGeometry(0.072, 0.042, 0.014), C.black, hc, { pos: [sx * 0.045, 0.02, 0.124] });   // shades
  mesh(new THREE.BoxGeometry(0.2, 0.012, 0.012), C.black, hc, { pos: [0, 0.035, 0.126] });
  for (const sx of [-1, 1]) mesh(new THREE.BoxGeometry(0.006, 0.008, 0.12), C.black, hc, { pos: [sx * 0.1, 0.03, 0.065], rot: [0, sx * -0.25, 0] });
  // popped collar
  for (const sx of [-1, 1]) mesh(new THREE.BoxGeometry(0.09, 0.1, 0.02), COMIC.warm[1], ch.parts.torso, { pos: [sx * 0.07, 1.72, 0.03], rot: [0.2, sx * 0.5, 0] });
  ch.update(0, 0);
  return ch;
}
// The bully: big, angry brows, hot-pink tank top
export function createBully(opts = {}) {
  const C = PALETTE;
  const ch = createNPC({ seed: 666, outfit: 'tank', hair: 'buzz', hairColor: C.black, glasses: false, hat: 'none',
    colors: { top: COMIC.pinks[1], inner: COMIC.pinks[1], bottom: C.black, shoe: C.white, accent: C.black, shorts: true },
    accessories: [], height: 1.1, build: 1.42, ...opts, name: 'bully', special: 'bully' });
  const hc = ch.parts.headCenter;
  for (const sx of [-1, 1]) mesh(new THREE.BoxGeometry(0.07, 0.022, 0.016), C.black, hc, { pos: [sx * 0.047, 0.058, 0.124], rot: [0, 0, sx * 0.5] });   // angry brows
  ch.update(0, 0);
  return ch;
}

// The cop: blue uniform + cap, donut belly, moustache, gold badge, a donut in hand
export function createCop(opts = {}) {
  const C = PALETTE;
  const ch = createNPC({ seed: 9110, outfit: 'sweater', hair: 'buzz', hairColor: C.black, glasses: false, hat: 'cap', hatColor: COMIC.blues[0],
    colors: { top: COMIC.blues[1], inner: COMIC.blues[1], bottom: COMIC.blues[0], shoe: C.black, accent: C.black, shorts: false },
    accessories: [], height: 1.02, build: 1.5, ...opts, name: 'cop', special: 'cop' });
  const hc = ch.parts.headCenter, T = ch.parts.torso;
  mesh(new THREE.BoxGeometry(0.11, 0.028, 0.02), C.black, hc, { pos: [0, -0.04, 0.128] });                    // moustache
  for (const sx of [-1, 1]) mesh(new THREE.BoxGeometry(0.03, 0.02, 0.018), C.black, hc, { pos: [sx * 0.06, -0.05, 0.122] });
  mesh(new THREE.BoxGeometry(0.04, 0.04, 0.012), COMIC.yellows[1], hc, { pos: [0, 0.135, 0.128], rot: [-0.3, 0, 0] });   // cap badge
  mesh(new THREE.BoxGeometry(0.05, 0.06, 0.014), COMIC.yellows[1], T, { pos: [0.075, 1.52, 0.16], rot: [0.1, 0, 0] });   // chest badge
  mesh(new THREE.TorusGeometry(0.205, 0.022, 3, 12), C.black, T, { pos: [0, 0.95, 0], rot: [Math.PI / 2, 0, 0], scale: [1, 0.86, 1] });   // belt
  mesh(new THREE.BoxGeometry(0.05, 0.04, 0.02), COMIC.yellows[1], T, { pos: [0, 0.95, 0.18] });                 // buckle
  mesh(new THREE.BoxGeometry(0.05, 0.12, 0.06), C.black, T, { pos: [0.2, 0.9, 0.02] });                         // radio on the belt
  const wr = ch.parts.wristR;   // a pink-iced donut in the right hand
  if (wr) {
    mesh(new THREE.TorusGeometry(0.045, 0.022, 4, 8), COMIC.warm[2], wr, { pos: [-0.02, -0.1, 0.03], rot: [0, Math.PI / 2, 0] });
    mesh(new THREE.TorusGeometry(0.045, 0.012, 3, 8), COMIC.pinks[2], wr, { pos: [-0.034, -0.1, 0.03], rot: [0, Math.PI / 2, 0] });
  }
  ch.update(0, 0);
  return ch;
}

export const SPECIALS = {
  mbappe: { create: createMbappe, tag: 'MBAPPÉ', dance: 'mbappe', icon: 'note' },
  syoya: { create: createSyoya, tag: 'KIMATA', dance: 'hula', icon: 'heart' },
  giver: { create: createGiver, tag: '???', dance: null, role: 'giver' },
  bully: { create: createBully, tag: 'BULLY', dance: null, role: 'bully', temper: 'aggressive' },
  cop: { create: createCop, tag: 'OFFICER DOUGH', dance: null, role: 'cop', temper: 'timid' },
};
export function createSpecial(key, opts) { return SPECIALS[key].create(opts); }

// ---- generic silly dances (dance-off, mayhem) + tiny gesture clips (gag, squat, shove) ----
// Procedural poses in the same body space as the keyed dances (x = character's left, y up, z forward).
const SIL = (L, R, o = {}) => pose({ L, R, ...o });
const arm = (w, e, r = 0, f = 0) => ({ w, e, r, f });
const qstep = (t, rate, n) => Math.floor(t * rate) % n;            // robot: snap between held poses
Object.assign(DANCES, {
  flail: {   // the main character: wild windmill arm flail, bouncing, head banging
    dur: 6.6, blendIn: 0.2, blendOut: 0.35,
    pose(t) {
      const a = t * 10.5, b = t * 8.3 + 1.7;
      return SIL(
        arm([0.42 + 0.3 * Math.sin(a), 1.55 + 0.6 * Math.sin(a * 1.3), 0.12 + 0.2 * Math.cos(a)], [0.6, 1.5, -0.2], Math.sin(a) * 0.8),
        arm([-0.42 - 0.3 * Math.sin(b), 1.55 + 0.6 * Math.cos(b * 1.1), 0.12 + 0.2 * Math.sin(b)], [-0.6, 1.5, -0.2], -Math.cos(b) * 0.8),
        { dip: 0.07 + 0.06 * Math.abs(Math.sin(t * 7.5)), yaw: 0.4 * Math.sin(t * 3.7), roll: 0.12 * Math.sin(t * 5.1), lean: 0.06 * Math.sin(t * 7.5),
          stance: 0.12, fz: [0.05 * Math.sin(t * 7.5), -0.05 * Math.sin(t * 7.5)], head: [0.3 * Math.sin(t * 15), 0.25 * Math.sin(t * 3.7), 0.2 * Math.sin(t * 6)] });
    },
  },
  robot: {   // stiff 90° arms, snapping torso and head between held poses
    dur: 6.6, blendIn: 0.15, blendOut: 0.3,
    pose(t) {
      const k = qstep(t, 2.6, 4), up = arm([0.32, 1.95, 0.12], [0.45, 1.55, -0.05], 0, 0), out = arm([0.3, 1.42, 0.38], [0.42, 1.42, -0.12], 0, 0);
      const dn = arm([0.32, 1.05, 0.34], [0.42, 1.42, -0.1], 0, 0);
      const L = [up, out, dn, out][k], R = mirror([out, up, out, dn][k]);
      return SIL(L, R, { dip: 0.04 + (k % 2) * 0.04, ty: [0.45, 0, -0.45, 0][k], head: [0, [-0.5, 0, 0.5, 0][k], 0], stance: 0.1 });
    },
  },
  sprinkler: {   // hand behind the head, other arm out front ratcheting round, then a fast sweep back
    dur: 6.6, blendIn: 0.2, blendOut: 0.35,
    pose(t) {
      const c = (t * 0.9) % 1, ratchet = c < 0.8 ? Math.floor(c / 0.8 * 6) / 6 : 1 - (c - 0.8) / 0.2;
      return SIL(arm([0.13, 1.86, -0.06], [0.5, 1.82, 0.02], 0.3, 0.2), arm([-0.55, 1.48, 0.42], [-0.45, 1.6, 0.0], 0, 0),
        { dip: 0.08, yaw: -0.7 + 1.4 * ratchet, ty: 0.1, stance: 0.14, head: [0.05, 0.15, 0], fz: [0.08, -0.06] });
    },
  },
  chicken: {   // flapping elbow wings, pecking head, knees bent
    dur: 6.6, blendIn: 0.2, blendOut: 0.35,
    pose(t) {
      const fl = Math.sin(t * 15), pk = Math.max(0, Math.sin(t * 6.5));
      return SIL(arm([0.14, 1.5, 0.08], [0.55 + 0.25 * fl, 1.42 + 0.1 * fl, -0.2], 0.5, 0.4), arm([-0.14, 1.5, 0.08], [-0.55 - 0.25 * fl, 1.42 + 0.1 * fl, -0.2], -0.5, 0.4),
        { dip: 0.13 + 0.03 * Math.abs(fl), lean: 0.15 + 0.15 * pk, hz: 0.05 * pk, head: [0.45 * pk - 0.15, 0, 0], stance: 0.16, fz: [0.05 * Math.sin(t * 3.2), -0.05 * Math.sin(t * 3.2)] });
    },
  },
  disco: {   // the point: up-right, down-left, hand on hip, hips swinging
    dur: 6.6, blendIn: 0.2, blendOut: 0.35,
    pose(t) {
      const u = (Math.sin(t * 4.6) + 1) / 2, s = Math.sin(t * 4.6);
      const R = arm([-0.25 + 0.42 * (1 - u), 0.98 + 1.3 * u, 0.12 + 0.2 * (1 - u)], [-0.45, 1.55, 0.05], 0, 0);
      return SIL(arm([0.3, 1.05, -0.06], [0.5, 1.25, -0.1], 0, 0.3), R,
        { dip: 0.06 + 0.04 * Math.abs(s), hx: 0.06 * s, roll: -0.1 * s, ty: -0.25 * s, yaw: 0.15 * s, head: [-0.2 * u + 0.05, -0.3 * u, 0.1 * s], stance: 0.12 });
    },
  },
  gag: {     // stink reaction: lean back, fan the nose fast, other hand on the belly
    dur: 1.15, blendIn: 0.08, blendOut: 0.2,
    pose(t) {
      return SIL(arm([0.08, 1.24, 0.24], [0.4, 1.25, 0.05], 0.6, 0), arm([-0.06 + 0.09 * Math.sin(t * 34), 1.76, 0.25], [-0.4, 1.45, 0.08], -0.4, 0),
        { lean: -0.2, dip: 0.04, head: [-0.3, 0.25 * Math.sin(t * 9), 0.15], stance: 0.08, hz: -0.04 });
    },
  },
  squat: {   // the main character's fart: butt out, hands on knees, little quiver
    dur: 1.0, blendIn: 0.12, blendOut: 0.3,
    pose(t) {
      const q = t > 0.3 && t < 0.75 ? 0.015 * Math.sin(t * 70) : 0;
      return SIL(arm([0.2, 0.98, 0.3], [0.45, 1.25, -0.05], 0.3, 0), arm([-0.2, 0.98, 0.3], [-0.45, 1.25, -0.05], -0.3, 0),
        { dip: 0.17 + q, lean: 0.38, hz: -0.07, roll: q * 3, head: [-0.45, 0, 0], stance: 0.14 });
    },
  },
  clap: {   // spectator: clap in front of the chest, little bounce (loops until stopped)
    dur: 60, blendIn: 0.15, blendOut: 0.25,
    pose(t) {
      const o = 0.04 + 0.13 * Math.abs(Math.sin(t * 7.5)), b = 0.03 * Math.abs(Math.sin(t * 7.5));
      return SIL(arm([o, 1.42 + b, 0.33], [0.36, 1.22, 0.06], 0.9, 0), arm([-o, 1.42 + b, 0.33], [-0.36, 1.22, 0.06], -0.9, 0),
        { dip: 0.03 + b * 0.6, lean: 0.04, head: [0.05, 0.12 * Math.sin(t * 2.1), 0], stance: 0.1 });
    },
  },
  crossed: {   // bully watching: arms crossed, slow unimpressed head shake (loops until stopped)
    dur: 60, blendIn: 0.2, blendOut: 0.3,
    pose(t) {
      return SIL(arm([-0.14, 1.3, 0.21], [0.3, 1.24, 0.12], 1.3, 0), arm([0.15, 1.33, 0.19], [-0.3, 1.25, 0.12], -1.3, 0),
        { lean: -0.08, dip: 0.02, head: [-0.08, 0.18 * Math.sin(t * 1.3), 0], stance: 0.16 });
    },
  },
  flex: {   // bully taunt: double-biceps flex, chest out, little bounce
    dur: 1.7, blendIn: 0.12, blendOut: 0.3,
    pose(t) {
      const b = Math.abs(Math.sin(t * 7)) * 0.04, f = 0.9 + 0.3 * Math.sin(t * 7);
      return SIL(arm([0.36, 1.82 + b, 0.04], [0.52, 1.5, -0.02], 0.3, f), arm([-0.36, 1.82 + b, 0.04], [-0.52, 1.5, -0.02], -0.3, f),
        { lean: -0.12, dip: 0.05 - b, head: [-0.15, 0.2 * Math.sin(t * 3.5), 0], stance: 0.16 });
    },
  },
  shove: {   // two-handed shove: draw back, thrust both palms forward
    dur: 0.6, blendIn: 0.05, blendOut: 0.25,
    pose(t) {
      const u = t < 0.15 ? 0 : Math.min(1, (t - 0.15) / 0.08);
      const z = 0.05 + 0.5 * u, y = 1.45;
      return SIL(arm([0.2, y, z], [0.5, 1.3, -0.2], 0, -1.2 * u), arm([-0.2, y, z], [-0.5, 1.3, -0.2], 0, -1.2 * u),
        { lean: -0.1 + 0.35 * u, hz: 0.08 * u, dip: 0.05, stance: 0.1, fz: [0.12 * u, -0.1 * u], head: [0.1 * u, 0, 0] });
    },
  },
});
export const SILLY_DANCES = ['robot', 'chicken', 'disco', 'sprinkler'];

// =====================================================================================
// Custom characters (creator.html): a fully modular, mix-anything definition -> Character.
// def = { name, gender, body, height, skin, hair, hairColor, hat, hatColor, top, topColor, innerColor,
//         bottom, bottomColor, shoes, shoeColor, acc: {glasses, sunglasses, moustache, beard, earrings, bag},
//         accColor, held, heldColor, lines[], bubble, dance, home }
// =====================================================================================
export const CUSTOM = {
  genders: ['man', 'woman'],
  bodies: ['skinny', 'average', 'fat', 'muscle'],
  height: [0.85, 1.15],
  skins: [PALETTE.npcSkin, COMIC.warm[4], COMIC.warm[3], COMIC.warm[2], COMIC.warm[1], COMIC.warm[0], COMIC.neutrals[3], COMIC.blues[3]],
  hairs: HAIRSTYLES,
  hats: ['none', 'cap', 'beanie', 'backcap'],
  tops: ['tee', 'shirt', 'hoodie', 'sweater', 'tank', 'blazer', 'cardigan', 'coat', 'blouse', 'stripetee', 'none'],
  bottoms: ['pants', 'shorts', 'skirt', 'dress'],
  shoes: ['sneakers', 'boots', 'flats', 'barefoot'],
  accs: ['glasses', 'sunglasses', 'moustache', 'beard', 'earrings', 'bag'],
  helds: ['none', 'football', 'guitar', 'skateboard', 'umbrella', 'phone', 'coffee', 'icecream', 'balloon', 'briefcase', 'shopping', 'boombox', 'flowers', 'baguette', 'dog', 'ring'],
  dances: ['robot', 'chicken', 'disco', 'sprinkler', 'flail', 'hula', 'flex', 'mbappe'],   // 'mbappe' is labelled "Bad" in the creator
  colors: Object.values(COMIC).flat(),
};
const SHAPES = {
  skinny: { sh: 0.9, hip: 0.86, tx: 0.8, tz: 0.78, leg: 0.74, arm: 0.72 },
  average: { sh: 1, hip: 1, tx: 1, tz: 1, leg: 1, arm: 1 },
  fat: { sh: 1.2, hip: 1.38, tx: 1.4, tz: 1.42, leg: 1.36, arm: 1.32 },
  muscle: { sh: 1.36, hip: 1.06, tx: 1.26, tz: 1.12, leg: 1.22, arm: 1.6 },
};
const LAYER_TOPS = ['blazer', 'cardigan', 'coat', 'hoodie'];
const SKIN_LINE = (skin) => skin === PALETTE.npcSkin ? PALETTE.npcLine
  : [COMIC.warm[4], COMIC.warm[3]].includes(skin) ? COMIC.warm[1] : skin === COMIC.warm[2] ? COMIC.warm[1] : COMIC.neutrals[0];

/** Defaults for a gender; every part stays mixable afterwards. */
export function customDefaults(gender = 'man') {
  const w = gender === 'woman';
  return { v: 1, name: w ? 'NEW GAL' : 'NEW GUY', gender, body: 'average', height: w ? 0.96 : 1.0, skin: PALETTE.npcSkin,
    hair: w ? 'longStraight' : 'curtains', hairColor: PALETTE.black, hat: 'none', hatColor: COMIC.blues[1],
    top: w ? 'blouse' : 'tee', topColor: w ? COMIC.pinks[2] : COMIC.blues[1], innerColor: PALETTE.white,
    bottom: w ? 'skirt' : 'pants', bottomColor: w ? PALETTE.black : COMIC.blues[0],
    shoes: w ? 'flats' : 'sneakers', shoeColor: w ? PALETTE.black : PALETTE.white,
    acc: { glasses: false, sunglasses: false, moustache: false, beard: false, earrings: w, bag: false }, accColor: COMIC.yellows[1],
    held: 'none', heldColor: COMIC.pinks[1],
    lines: w ? ['hey there!', 'nice day, huh?', 'love your vibe.'] : ['yo!', 'sup?', 'nice weather.'], bubble: '',
    dance: 'disco', home: 'fountain' };
}
/** Kimata's look as a creator preset (keeps name / lines / home). */
export const KIMATA_STYLE = { gender: 'man', body: 'average', height: 1.0, skin: COMIC.warm[3], hair: 'buzz', hairColor: PALETTE.black,
  hat: 'backcap', hatColor: PALETTE.white, top: 'stripetee', topColor: PALETTE.white, innerColor: COMIC.pinks[1],
  bottom: 'shorts', bottomColor: COMIC.blues[0], shoes: 'barefoot', shoeColor: PALETTE.white,
  acc: { glasses: false, sunglasses: false, moustache: false, beard: false, earrings: false, bag: false },
  held: 'ring', heldColor: COMIC.pinks[1], dance: 'hula' };
/** Fill gaps / clamp a saved definition (old or hand-edited JSON). */
export function normalizeCustom(d = {}) {
  const base = customDefaults(d.gender === 'woman' ? 'woman' : 'man');
  const o = { ...base, ...d, acc: { ...base.acc, ...(d.acc || {}) } };
  const inL = (v, L, dflt) => (L.includes(v) ? v : dflt);
  const col = (v, dflt) => (CUSTOM.colors.includes(v) || CUSTOM.skins.includes(v) || Object.values(PALETTE).includes(v) ? v : dflt);
  o.body = inL(o.body, CUSTOM.bodies, 'average'); o.hair = inL(o.hair, CUSTOM.hairs, base.hair); o.hat = inL(o.hat, CUSTOM.hats, 'none');
  o.top = inL(o.top, CUSTOM.tops, base.top); o.bottom = inL(o.bottom, CUSTOM.bottoms, base.bottom); o.shoes = inL(o.shoes, CUSTOM.shoes, base.shoes);
  o.held = inL(o.held, CUSTOM.helds, 'none'); o.dance = inL(o.dance, CUSTOM.dances, 'disco');
  o.skin = inL(o.skin, CUSTOM.skins, base.skin);
  for (const k of ['hairColor', 'hatColor', 'topColor', 'innerColor', 'bottomColor', 'shoeColor', 'accColor', 'heldColor']) o[k] = col(o[k], base[k]);
  o.height = clamp(+o.height || 1, CUSTOM.height[0], CUSTOM.height[1]);
  o.name = String(o.name || base.name).slice(0, 18);
  o.lines = (Array.isArray(o.lines) ? o.lines : []).map((s) => String(s).slice(0, 60)).filter(Boolean).slice(0, 5);
  if (!o.lines.length) o.lines = base.lines.slice();
  o.bubble = String(o.bubble || '').slice(0, 60);
  for (const k of CUSTOM.accs) o.acc[k] = !!o.acc[k];
  return o;
}
/** Map a modular NPC look (createNPC opts) onto creator parts, as close as the creator's parts allow. */
const NPC_OUTFIT = { shirt: ['shirt', 'pants'], tee: ['tee', 'pants'], coat: ['coat', 'pants'], blouse: ['blouse', 'pants'], apron: ['tee', 'pants'],
  hoodie: ['hoodie', 'pants'], blazer: ['blazer', 'pants'], sweater: ['sweater', 'pants'], shortsTee: ['tee', 'shorts'], dress: ['none', 'dress'],
  overalls: ['shirt', 'pants'], suit: ['blazer', 'pants'], cardigan: ['cardigan', 'pants'], tank: ['tank', 'pants'] };
export function npcLookToCustom(opts = {}, extra = {}) {
  const cfg = npcConfig(opts), K = cfg.colors, o = cfg.outfit;
  let [top, bottom] = NPC_OUTFIT[o] || ['tee', 'pants'];
  if (o === 'tank' && K.shorts) bottom = 'shorts';
  const body = cfg.build < 0.88 ? 'skinny' : cfg.build >= 1.28 ? 'fat' : 'average';
  const acc = cfg.accessories || [];
  return normalizeCustom({ gender: extra.gender || 'man', body, height: cfg.height, skin: cfg.skin, hair: cfg.hair, hairColor: cfg.hairColor,
    hat: cfg.hat || 'none', hatColor: cfg.hatColor,
    top, topColor: o === 'apron' ? PALETTE.white : o === 'dress' ? K.top : K.top, innerColor: o === 'overalls' ? K.inner : K.inner,
    bottom, bottomColor: o === 'dress' ? K.top : o === 'suit' ? K.top : o === 'apron' ? PALETTE.black : K.bottom,
    shoes: o === 'dress' ? 'flats' : 'sneakers', shoeColor: ['hoodie', 'shortsTee'].includes(o) || (o === 'tank' && K.shorts) ? PALETTE.white : o === 'blazer' || o === 'suit' ? PALETTE.black : K.shoe,
    acc: { glasses: !!cfg.glasses, sunglasses: false, moustache: false, beard: false, earrings: false, bag: acc.includes('tote') || acc.includes('backpack') },
    accColor: cfg.accColor, held: 'none', heldColor: COMIC.pinks[1], dance: 'disco', home: 'fountain', ...extra });
}
/** A cap mesh group (used when a character has no hat of his own, e.g. an edited Kimata). */
export function capModel(color = PALETTE.white) { const g = new THREE.Group(); buildHat(g, 'cap', color, color); return g; }
/** Random definition drawing from EVERY option (seeded when a seed is given). */
export function randomCustom(seed) {
  const r = seed === undefined ? Math.random : mulberry32(seed);
  const pick = (a) => a[Math.floor(r() * a.length)];
  const gender = pick(CUSTOM.genders), d = customDefaults(gender);
  const C = CUSTOM.colors;
  Object.assign(d, {
    body: pick(CUSTOM.bodies), height: +(CUSTOM.height[0] + r() * (CUSTOM.height[1] - CUSTOM.height[0])).toFixed(2), skin: pick(CUSTOM.skins),
    hair: pick(CUSTOM.hairs), hairColor: pick(C), hat: r() < 0.35 ? pick(['cap', 'beanie', 'backcap']) : 'none', hatColor: pick(C),
    top: pick(CUSTOM.tops), topColor: pick(C), innerColor: pick(C), bottom: pick(CUSTOM.bottoms), bottomColor: pick(C),
    shoes: pick(CUSTOM.shoes), shoeColor: pick(C), accColor: pick(C), held: pick(CUSTOM.helds), heldColor: pick(C), dance: pick(CUSTOM.dances),
  });
  d.acc = {}; for (const k of CUSTOM.accs) d.acc[k] = r() < 0.25;
  if (d.acc.sunglasses && d.acc.glasses) d.acc.glasses = false;
  const FIRST = ['ZED', 'MOMO', 'RIKU', 'PEPPER', 'JUNO', 'TAKO', 'NOVA', 'BIGGS', 'LULU', 'KAI', 'DOTTIE', 'SPUD', 'YUKI', 'REX', 'MAPLE'];
  d.name = pick(FIRST);
  const POOL = ['yo!', 'nice day, huh?', 'have we met?', 'i like your face.', 'got any snacks?', 'ugh, mondays.', 'this city is wild.', 'call me maybe.', 'living my best life.', 'what a vibe.', 'not now, busy.', 'rent is due soon...'];
  d.lines = []; while (d.lines.length < 3 + Math.floor(r() * 3)) { const l = pick(POOL); if (!d.lines.includes(l)) d.lines.push(l); }
  d.bubble = r() < 0.5 ? pick(POOL) : '';
  d.home = pick(['fountain', 'lawn', 'busstop', 'crossing', 'tower', 'fruit', 'stroll']);
  return d;
}

function customTop(P, d, T) {
  const c = d.topColor, inner = d.innerColor, top = d.top;
  if (top === 'none') return;
  if (top === 'tee') { mesh(lathe(shell(0.87, 1.07), 8, TORSO_Z), c, T); sleeves(P, c, 0.25, 0, [0.07, 0.066]); }
  else if (top === 'stripetee') {   // Kimata's striped crew-neck tee: body colour + stripes / collar rib / cuffs in the inner colour
    mesh(lathe(shell(0.87, 1.07), 8, TORSO_Z), c, T);
    for (const y of [0.96, 1.12, 1.28, 1.44, 1.6]) mesh(lathe(clip(TORSO, y, y + 0.075, 1.085), 8, TORSO_Z), inner, T);
    mesh(lathe(clip(TORSO, 1.655, 1.672, 1.09), 8, TORSO_Z), inner, T, { double: true });
    sleeves(P, c, 0.22, 0, [0.07, 0.066]);
    for (const side of ['L', 'R']) for (const y of [-0.05, -0.16]) mesh(limb(0.0725, 0.071, 0.05, 7, y), inner, P['arm' + side]);
  }
  else if (top === 'shirt') {
    const prof = shell(0.87, 1.07); mesh(lathe(prof, 8, TORSO_Z), c, T);
    frontLine(T, prof, 0.87, 1.64, TORSO_Z, PALETTE.npcLine);
    for (const sx of [-1, 1]) mesh(new THREE.BoxGeometry(0.05, 0.035, 0.01), c, T, { pos: [sx * 0.03, 1.69, 0.062], rot: [-0.9, 0, sx * -0.6] });
    mesh(limb(0.06, 0.06, 0.035, 6, 1.715), c, T); sleeves(P, c, UPPER, 0.09);
  } else if (top === 'hoodie') {
    mesh(lathe(shell(0.84, 1.1, 0.0), 8, TORSO_Z), c, T);
    mesh(lathe(clip(TORSO, 0.84, 0.92, 1.12), 8, TORSO_Z), c, T);
    mesh(lathe([[0.1, 1.6], [0.165, 1.66], [0.15, 1.76], [0.08, 1.8]], 8, 0.95, Math.PI * 0.55, Math.PI * 0.9), c, T, { double: true });
    mesh(new THREE.BoxGeometry(0.2, 0.12, 0.02), c, T, { pos: [0, 1.06, 0.13], rot: [0.08, 0, 0] });
    for (const sx of [-1, 1]) mesh(limb(0.006, 0.006, 0.13, 3), inner, T, { pos: [sx * 0.035, 1.66, 0.14], rot: [0.12, 0, 0] });
    sleeves(P, c, UPPER, FORE - 0.015, [0.072, 0.068]);
  } else if (top === 'sweater') {
    mesh(lathe(shell(0.86, 1.11, 0.0), 8, TORSO_Z), c, T);
    mesh(lathe(clip(TORSO, 0.86, 0.93, 1.13), 8, TORSO_Z), c, T);
    mesh(limb(0.064, 0.064, 0.03, 7, 1.71), c, T); sleeves(P, c, UPPER, FORE - 0.01, [0.075, 0.072]);
  } else if (top === 'tank') mesh(lathe(shell(0.87, 1.06), 8, TORSO_Z), c, T);
  else if (top === 'blazer' || top === 'coat' || top === 'cardigan') {
    if (d.bottom !== 'dress') mesh(lathe(shell(0.9, 1.04), 8, TORSO_Z), inner, T);
    const [y0, grow, gap] = top === 'coat' ? [0.62, 1.15, 0.3] : top === 'blazer' ? [0.86, 1.12, 0.33] : [0.83, 1.11, 0.36];
    const prof = shell(y0, grow, top === 'coat' ? 0.03 : 0.005, false);
    mesh(lathe(prof, 10, TORSO_Z, gap, Math.PI * 2 - gap * 2), c, T, { double: true });
    if (top === 'cardigan') for (const sx of [-1, 1]) frontLine(T, prof, 0.85, 1.55, TORSO_Z, c, sx * 0.055, 0.016, 0.004);
    else for (const sx of [-1, 1]) mesh(new THREE.BoxGeometry(0.045, 0.15, 0.012), c, T, { pos: [sx * 0.06, 1.53, 0.145], rot: [0.12, 0, sx * 0.3] });
    sleeves(P, c, UPPER, FORE - 0.02, [0.072, 0.068]);
  } else if (top === 'blouse') {
    const prof = shell(0.9, 1.07); mesh(lathe(prof, 8, TORSO_Z), c, T);
    frontLine(T, prof, 1.45, 1.65, TORSO_Z, inner, 0, 0.012);
    sleeves(P, c, 0.36, 0, [0.07, 0.07], true);
  }
}
function customBottom(P, d, T) {
  const c = d.bottomColor, bare = d.bottom !== 'pants';
  const sh = d.shoes, shoeC = d.shoeColor;
  const legs = bare ? { thigh: d.skin, shin: d.skin, thighR: [0.078, 0.066], shinR: [0.064, 0.047] } : { thigh: c, shin: c };
  if (sh === 'sneakers') Object.assign(legs, { shoe: shoeC, sole: shoeC === PALETTE.white ? PALETTE.slate : PALETTE.white, socks: bare ? PALETTE.white : null });
  else if (sh === 'boots') Object.assign(legs, { shoe: shoeC, sole: PALETTE.black });
  else if (sh === 'flats') Object.assign(legs, { flats: shoeC, cuffSkin: bare });
  P.legSwing = 0.34;
  if (d.bottom === 'pants') mesh(lathe(clip(TORSO, 0.84, 0.95, 1.09), 8, TORSO_Z), c, T);
  else if (d.bottom === 'shorts') { mesh(lathe(clip(TORSO, 0.84, 0.95, 1.09), 8, TORSO_Z), c, T); Object.assign(legs, { shorts: 0.27, shortsColor: c }); }
  else if (d.bottom === 'skirt') {
    mesh(lathe([[0, 1.0], [0.176, 1.0], [0.182, 0.92], [0.206, 0.76], [0.236, 0.57], [0, 0.57]], 10, 0.86), c, T, { double: true });
    P.legSwing = 0.27;
  } else {   // dress: bodice + skirt in the dress colour (jackets / hoodies layer over)
    mesh(lathe(shell(0.98, 1.06), 8, TORSO_Z), c, T);
    if (!LAYER_TOPS.includes(d.top)) sleeves(P, c, 0.16, 0, [0.068, 0.066]);
    mesh(lathe([[0, 0.99], [0.174, 0.99], [0.182, 0.92], [0.206, 0.76], [0.236, 0.57], [0, 0.57]], 10, 0.86), c, T, { double: true });
    mesh(lathe(clip(TORSO, 0.98, 1.02, 1.08), 8, TORSO_Z), d.accColor, T);
    P.legSwing = 0.27;
  }
  dressLegs(P, { skin: d.skin }, legs);
  if (sh === 'boots') for (const side of ['L', 'R']) mesh(limb(legs.shinR ? 0.07 : 0.088, legs.shinR ? 0.06 : 0.088, 0.17, 6, -SHIN + 0.13), shoeC, P['knee' + side]);
}
function customFace(P, d) {
  const hc = P.headCenter, A = d.acc, hcol = d.hairColor;
  if (A.glasses) buildGlasses(hc, PALETTE.slate);
  if (A.sunglasses) {
    for (const sx of [-1, 1]) mesh(new THREE.BoxGeometry(0.072, 0.042, 0.014), PALETTE.black, hc, { pos: [sx * 0.045, 0.02, 0.126] });
    mesh(new THREE.BoxGeometry(0.2, 0.012, 0.012), PALETTE.black, hc, { pos: [0, 0.035, 0.128] });
    for (const sx of [-1, 1]) mesh(new THREE.BoxGeometry(0.006, 0.008, 0.12), PALETTE.black, hc, { pos: [sx * 0.1, 0.03, 0.065], rot: [0, sx * -0.25, 0] });
  }
  if (A.beard) {
    mesh(new THREE.BoxGeometry(0.15, 0.075, 0.05), hcol, hc, { pos: [0, -0.1, 0.085], rot: [-0.25, 0, 0] });
    for (const sx of [-1, 1]) mesh(new THREE.BoxGeometry(0.03, 0.11, 0.1), hcol, hc, { pos: [sx * 0.095, -0.05, 0.035] });
    mesh(new THREE.BoxGeometry(0.1, 0.05, 0.04), hcol, hc, { pos: [0, -0.135, 0.06] });
  }
  if (A.moustache || A.beard) {
    mesh(new THREE.BoxGeometry(0.1, 0.026, 0.02), hcol, hc, { pos: [0, -0.042, 0.13] });
    for (const sx of [-1, 1]) mesh(new THREE.BoxGeometry(0.028, 0.03, 0.018), hcol, hc, { pos: [sx * 0.055, -0.055, 0.124] });
  }
  if (A.earrings) for (const sx of [-1, 1]) {
    mesh(new THREE.SphereGeometry(0.014, 5, 4), COMIC.yellows[1], hc, { pos: [sx * 0.113, -0.045, 0.0] });
    mesh(new THREE.BoxGeometry(0.006, 0.02, 0.006), COMIC.yellows[1], hc, { pos: [sx * 0.113, -0.03, 0.0] });
  }
}
// held items: modelled upright in "hand space" (origin = grip point), anchored to the left hand every frame
function heldModel(kind, col) {
  const g = new THREE.Group(); g.name = 'held:' + kind;
  const W = PALETTE.white, K = PALETTE.black;
  if (kind === 'football') {
    const b = group(g, 0, 0, 0); b.name = 'ball';
    mesh(new THREE.IcosahedronGeometry(0.1, 1), W, b);
    for (const [x, y, z] of [[0, 0.09, 0.04], [0.08, -0.02, 0.05], [-0.07, -0.03, 0.06], [0.02, -0.05, -0.08], [-0.05, 0.05, -0.07]])
      mesh(new THREE.BoxGeometry(0.04, 0.04, 0.012), K, b, { pos: [x, y, z], rot: [Math.atan2(y, z), Math.atan2(x, z), 0] });
  } else if (kind === 'skateboard') {
    mesh(new THREE.BoxGeometry(0.035, 0.74, 0.19), col, g, { pos: [0.06, -0.3, 0] });
    mesh(new THREE.BoxGeometry(0.008, 0.72, 0.17), K, g, { pos: [0.08, -0.3, 0] });
    for (const y of [-0.06, -0.54]) for (const z of [-0.07, 0.07]) mesh(new THREE.BoxGeometry(0.04, 0.04, 0.03), COMIC.yellows[1], g, { pos: [0.02, y, z] });
  } else if (kind === 'umbrella') {
    mesh(limb(0.01, 0.01, 0.95, 4, 0.85), K, g);
    mesh(new THREE.ConeGeometry(0.62, 0.24, 8), col, g, { pos: [0, 0.95, 0] });
    mesh(new THREE.TorusGeometry(0.035, 0.01, 3, 6, Math.PI), K, g, { pos: [0.035, -0.1, 0], rot: [0, 0, Math.PI] });
  } else if (kind === 'phone') {
    mesh(new THREE.BoxGeometry(0.065, 0.12, 0.012), K, g, { pos: [0, 0.05, 0.03], rot: [-0.5, 0, 0] });
    mesh(new THREE.BoxGeometry(0.052, 0.1, 0.004), COMIC.teals[3], g, { pos: [0, 0.052, 0.024], rot: [-0.5, 0, 0] });
  } else if (kind === 'coffee') {
    mesh(new THREE.CylinderGeometry(0.042, 0.034, 0.12, 7), W, g, { pos: [0, 0.05, 0.04] });
    mesh(new THREE.CylinderGeometry(0.043, 0.04, 0.045, 7), COMIC.warm[1], g, { pos: [0, 0.04, 0.04] });
    mesh(new THREE.CylinderGeometry(0.046, 0.046, 0.016, 7), K, g, { pos: [0, 0.115, 0.04] });
  } else if (kind === 'icecream') {
    const cone = new THREE.ConeGeometry(0.042, 0.13, 6); cone.rotateX(Math.PI);
    mesh(cone, COMIC.warm[2], g, { pos: [0, 0.04, 0.04] });
    mesh(new THREE.SphereGeometry(0.05, 6, 5), col, g, { pos: [0, 0.12, 0.04] });
    mesh(new THREE.SphereGeometry(0.04, 6, 5), COMIC.warm[4], g, { pos: [0, 0.18, 0.04] });
  } else if (kind === 'balloon') {
    mesh(new THREE.BoxGeometry(0.006, 0.9, 0.006), K, g, { pos: [0, 0.45, 0] });
    const b = group(g, 0, 1.06, 0); b.name = 'balloon';
    mesh(new THREE.SphereGeometry(0.17, 8, 6), col, b, { scale: [1, 1.2, 1] });
    mesh(new THREE.ConeGeometry(0.03, 0.04, 4), col, b, { pos: [0, -0.21, 0], rot: [Math.PI, 0, 0] });
  } else if (kind === 'briefcase') {
    mesh(new THREE.BoxGeometry(0.09, 0.27, 0.36), col, g, { pos: [0, -0.18, 0] });
    mesh(new THREE.BoxGeometry(0.095, 0.02, 0.37), K, g, { pos: [0, -0.1, 0] });
    mesh(new THREE.TorusGeometry(0.04, 0.008, 3, 6, Math.PI), K, g, { pos: [0, -0.045, 0], rot: [0, Math.PI / 2, 0] });
  } else if (kind === 'shopping') {
    mesh(new THREE.BoxGeometry(0.12, 0.28, 0.25), col, g, { pos: [0, -0.22, 0] });
    mesh(new THREE.BoxGeometry(0.125, 0.06, 0.255), W, g, { pos: [0, -0.14, 0] });
    for (const z of [-0.05, 0.05]) mesh(new THREE.TorusGeometry(0.05, 0.006, 3, 6, Math.PI), K, g, { pos: [0, -0.08, z], rot: [0, Math.PI / 2, 0] });
    mesh(new THREE.BoxGeometry(0.04, 0.12, 0.04), COMIC.teals[2], g, { pos: [0, -0.05, -0.06] });   // a baguette-ish leek poking out
  } else if (kind === 'boombox') {
    const b = group(g, -0.02, 0.1, 0); b.name = 'box';
    mesh(new THREE.BoxGeometry(0.12, 0.2, 0.38), col, b);
    for (const z of [-0.1, 0.1]) {
      mesh(new THREE.CylinderGeometry(0.065, 0.065, 0.02, 8), K, b, { pos: [0.06, 0, z], rot: [0, 0, Math.PI / 2] });
      mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.024, 6), PALETTE.slate, b, { pos: [0.065, 0, z], rot: [0, 0, Math.PI / 2] });
    }
    mesh(new THREE.BoxGeometry(0.02, 0.02, 0.3), K, b, { pos: [0, 0.12, 0] });
  } else if (kind === 'flowers') {
    const paper = new THREE.ConeGeometry(0.07, 0.24, 6); paper.rotateX(Math.PI);
    mesh(paper, W, g, { pos: [0, 0.06, 0.04] });
    const B = [COMIC.pinks[1], COMIC.yellows[1], col, COMIC.pinks[3], COMIC.blues[2]];
    B.forEach((c, i) => { const a = i / B.length * Math.PI * 2; mesh(new THREE.IcosahedronGeometry(0.04, 0), c, g, { pos: [Math.cos(a) * 0.05, 0.22 + (i % 2) * 0.03, 0.04 + Math.sin(a) * 0.05] }); });
    mesh(new THREE.IcosahedronGeometry(0.02, 0), COMIC.teals[1], g, { pos: [0, 0.19, 0.11] });
  } else if (kind === 'baguette') {
    mesh(limb(0.035, 0.03, 0.62, 6, 0.31), COMIC.yellows[0], g, { pos: [0, -0.02, 0.03], rot: [1.25, 0, 0] });
    for (const t of [-0.15, 0, 0.15]) mesh(new THREE.BoxGeometry(0.02, 0.004, 0.06), COMIC.yellows[3], g, { pos: [0, 0.012 + t * 0.32, 0.03 + t * 0.95], rot: [1.25, 0, 0.5] });
  }
  return g;
}
function guitarModel(col) {
  const g = new THREE.Group(); g.name = 'guitar';
  const disc = (r, y, c, z = 0, h = 0.07) => mesh(new THREE.CylinderGeometry(r, r, h, 9), c, g, { pos: [0, y, z], rot: [Math.PI / 2, 0, 0] });
  disc(0.15, 0, col); disc(0.115, 0.15, col);
  disc(0.045, 0.1, PALETTE.black, 0.036, 0.004);
  mesh(new THREE.BoxGeometry(0.05, 0.44, 0.03), COMIC.warm[0], g, { pos: [0, 0.4, 0.01] });
  mesh(new THREE.BoxGeometry(0.07, 0.1, 0.03), PALETTE.black, g, { pos: [0, 0.66, 0.01] });
  mesh(new THREE.BoxGeometry(0.08, 0.02, 0.02), PALETTE.black, g, { pos: [0, -0.06, 0.04] });   // bridge
  return g;
}
function dogModel(col) {
  const g = new THREE.Group(); g.name = 'dog';
  const K = PALETTE.black, dark = col === PALETTE.black ? PALETTE.slate : COMIC.warm[0];
  const body = group(g, 0, 0.2, 0); body.name = 'dogBody';
  mesh(new THREE.BoxGeometry(0.16, 0.13, 0.32), col, body);
  const head = group(body, 0, 0.09, 0.19); head.name = 'dogHead';
  mesh(new THREE.BoxGeometry(0.14, 0.12, 0.13), col, head);
  mesh(new THREE.BoxGeometry(0.08, 0.06, 0.08), col, head, { pos: [0, -0.02, 0.09] });
  mesh(new THREE.BoxGeometry(0.03, 0.025, 0.02), K, head, { pos: [0, 0, 0.135] });
  for (const sx of [-1, 1]) {
    mesh(new THREE.BoxGeometry(0.04, 0.08, 0.03), dark, head, { pos: [sx * 0.07, 0.06, -0.02], rot: [0, 0, sx * 0.3] });
    mesh(new THREE.BoxGeometry(0.018, 0.018, 0.01), K, head, { pos: [sx * 0.035, 0.025, 0.066] });
  }
  mesh(new THREE.BoxGeometry(0.17, 0.03, 0.04), COMIC.pinks[1], body, { pos: [0, 0.05, 0.13] });   // collar
  const tail = group(body, 0, 0.05, -0.16); tail.name = 'dogTail';
  mesh(new THREE.BoxGeometry(0.03, 0.03, 0.12), dark, tail, { pos: [0, 0.03, -0.05], rot: [0.6, 0, 0] });
  g.userData.legs = [];
  for (const [x, z] of [[-0.05, 0.11], [0.05, 0.11], [-0.05, -0.11], [0.05, -0.11]]) {
    const L = group(g, x, 0.16, z); mesh(new THREE.BoxGeometry(0.04, 0.16, 0.04), col, L, { pos: [0, -0.08, 0] }); g.userData.legs.push(L);
  }
  g.userData.body = body; g.userData.tail = tail; g.userData.head = head;
  return g;
}
// left-arm poses per held item (body space; x+ = left side, z+ = forward)
const HELD_POSE = {
  umbrella: { w: [0.21, 1.4, 0.24], e: [0.44, 1.28, -0.05] },
  phone: { w: [0.09, 1.56, 0.3], e: [0.36, 1.3, 0.02], f: -0.4 },
  coffee: { w: [0.16, 1.24, 0.28], e: [0.38, 1.2, -0.05] },
  icecream: { w: [0.15, 1.3, 0.28], e: [0.38, 1.2, -0.05] },
  balloon: { w: [0.27, 1.22, 0.16], e: [0.45, 1.3, -0.1] },
  flowers: { w: [0.14, 1.22, 0.3], e: [0.38, 1.2, -0.05] },
  boombox: { w: [0.27, 1.86, 0.03], e: [0.46, 1.58, -0.1] },
  football: { w: [0.16, 1.1, 0.3], e: [0.4, 1.16, -0.1], idleOnly: true },
};
const _hp = new THREE.Vector3(), _hq = new THREE.Vector3();

export function createCustom(input = {}) {
  const d = normalizeCustom(input);
  const shape = SHAPES[d.body];
  const cfg = { name: 'custom', custom: true, skin: d.skin, line: SKIN_LINE(d.skin), outfit: 'custom', hair: d.hair, hairColor: d.hairColor,
    height: d.height, build: { skinny: 0.82, average: 1, fat: 1.35, muscle: 1.25 }[d.body], shape, seed: d.id || d.name, def: d,
    accessories: d.acc.bag ? ['bag'] : [] };
  const P = buildBody(cfg), T = P.torso;
  customBottom(P, d, T);
  customTop(P, d, T);
  const fill = d.bottom === 'dress' && !LAYER_TOPS.includes(d.top) ? d.bottomColor : d.top === 'none' ? d.skin : d.top === 'coat' || d.top === 'blazer' || d.top === 'cardigan' ? d.innerColor : d.topColor;
  if (d.body === 'fat') mesh(new THREE.SphereGeometry(0.17, 8, 6), fill, T, { pos: [0, 1.1, 0.045], scale: [1.02, 0.95, 1.05] });   // belly
  if (d.body === 'muscle') {
    for (const sx of [-1, 1]) mesh(new THREE.BoxGeometry(0.13, 0.11, 0.05), fill, T, { pos: [sx * 0.072, 1.46, 0.105], rot: [0.12, 0, sx * -0.1] });   // pecs
    for (const sx of [-1, 1]) mesh(new THREE.BoxGeometry(0.08, 0.05, 0.14), d.top === 'none' || d.top === 'tank' ? d.skin : fill, T, { pos: [sx * 0.1, 1.66, -0.01], rot: [0, 0, sx * -0.45] });   // traps
  }
  buildHair(P.headCenter, d.hair, d.hairColor, PALETTE.npcLine, mulberry32(String(cfg.seed) + d.hair));
  let capG = null;   // every hat lives in its own group (ch.cap) so missions can take it off / copy it
  if (d.hat === 'backcap') {   // Kimata's cap, worn backward, hair showing through the strap opening
    capG = group(P.headCenter); capG.rotation.y = Math.PI;
    buildHat(capG, 'cap', d.hatColor, d.hatColor);
    mesh(new THREE.BoxGeometry(0.06, 0.035, 0.012), d.hairColor, capG, { pos: [0, 0.075, -0.112], rot: [0.35, 0, 0] });
  } else if (d.hat !== 'none') { capG = group(P.headCenter); buildHat(capG, d.hat, d.hatColor, d.hatColor === PALETTE.slate ? PALETTE.black : PALETTE.slate); }
  customFace(P, d);
  if (d.acc.bag) {   // cross-body bag at the left hip
    const zf = 0.155 * shape.tz + (d.body === 'fat' ? 0.06 : 0);
    mesh(new THREE.BoxGeometry(0.03, 0.66, 0.014), PALETTE.slate, T, { pos: [0.01, 1.3, zf], rot: [0.05, 0, 0.62] });
    mesh(new THREE.BoxGeometry(0.03, 0.62, 0.014), PALETTE.slate, T, { pos: [0.01, 1.3, -0.15 * shape.tz], rot: [-0.05, 0, 0.62] });
    mesh(new THREE.BoxGeometry(0.07, 0.17, 0.2), d.accColor, T, { pos: [0.205, 1.0, 0.04] });
    mesh(new THREE.BoxGeometry(0.075, 0.06, 0.205), PALETTE.slate, T, { pos: [0.206, 1.06, 0.04] });
  }
  // held item / guitar / dog
  const held = d.held, zF = 0.1 * (shape.tz - 1) + (d.body === 'fat' ? 0.07 : 0) + (d.body === 'muscle' ? 0.04 : 0);
  let item = null, guitar = null, dog = null, leash = null, ring = null;
  const ringS = Math.max(1, 0.35 + 0.65 * shape.tx), ringZ = zF * 0.6;   // the hoop grows with the waist
  if (held === 'guitar') {
    const gr = group(P.body); gr.name = 'guitarRoot';
    guitar = guitarModel(d.heldColor); gr.add(guitar);
    guitar.position.set(-0.06, 1.12, 0.21 + zF); guitar.rotation.z = -0.9;
  } else if (held === 'dog') {
    dog = dogModel(d.heldColor); P.root.add(dog); dog.position.set(0.55, 0, 0.5);
    leash = mesh(new THREE.BoxGeometry(0.008, 0.008, 1), PALETTE.black, P.root);
  } else if (held === 'ring') {   // Kimata's watermelon pool ring (its two greens are the ONLY off-palette colours, see pixel.js)
    ring = watermelonRing(); P.root.add(ring); ring.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  } else if (held !== 'none') { item = heldModel(held, d.heldColor); P.body.add(item); }
  const ch = new Character(P, cfg);
  ch.def = d; ch.heldItem = item; ch.guitar = guitar; ch.dog = dog; ch.ring = ring; ch.cap = capG; ch.idleHula = true;
  // dances / poses written for a standard body: keep hands clear of wider shoulders and bigger bellies
  ch.armOff = { x: 0.11 * (shape.sh - 1), z: zF };
  const pose = HELD_POSE[held];
  ch.hold = (c) => {
    if (c._kd || (c._dance && c._danceW >= 0.999)) return;
    const ty = c.parts.torso.rotation.y, idle = c.walk < 0.25 && c.air < 0.5, t = c.t;
    c._idleProp = idle;
    if (guitar) {
      guitar.parent.rotation.y = ty;
      c._armIK('L', [0.33, 1.43, 0.25 + zF], [0.5, 1.2, -0.05], 0.3, 0, ty);
      if (idle && !c.slapping) {   // strum
        const s = Math.sin(t * 13);
        c._armIK('R', [-0.04, 1.15 + 0.055 * s, 0.28 + zF], [-0.42, 1.2, -0.05], -0.3, -0.3 * s, ty);
        c.parts.head.rotation.x += 0.08 * Math.max(0, Math.sin(t * 6.5));
      }
      return;
    }
    if (dog) return;
    if (ring) {   // hand rests on the ring at the left hip; standing still a while -> hula-hoop it (Kimata's idle)
      c._ringIdle = ch.idleHula !== false && idle && !c.slapping && !c._dance ? (c._ringIdle || 0) + (c._lastD || 0.016) : 0;
      const e = smooth(1.2, 2.0, c._ringIdle || 0);
      c._ringE = e;
      if (e > 0.001) {
        const ph = c._ringPh = (c._ringPh || 0) + (c._lastD || 0.016) * SY_W;
        const H = c.h, P2 = c.parts, cs = Math.cos(ph), sn = Math.sin(ph);
        P2.body.position.x += 0.06 * cs * e * H; P2.body.position.z += 0.045 * sn * e * H;
        P2.body.rotation.z += -0.08 * cs * e; P2.torso.rotation.y += -0.08 * sn * e;
        const b = Math.sin(ph * 2) * 0.03;
        c._armIK('L', [0.42 + ch.armOff.x, 1.62 + b, 0.06], [0.55, 1.4, -0.1], 0, 0.3, 0);
        c._armIK('R', [-0.42 - ch.armOff.x, 1.62 + b, 0.06], [-0.55, 1.4, -0.1], 0, 0.3, 0);
      } else if (!c._dance || c._danceW < 0.999) c._armIK('L', [0.37 + ch.armOff.x, 1.08, 0.08 + ringZ], [0.48, 1.32, -0.2], 0.3, 0, ty);
      return;
    }
    if (!pose || (pose.idleOnly && !idle)) return;
    let w = pose.w;
    if (held === 'football') { const k = Math.abs(Math.sin(t * 3.4)); w = [w[0], w[1] - 0.06 * (1 - k), w[2]]; }
    if (held === 'coffee' && t % 6 > 4.8) w = [0.06, 1.62, 0.22];   // a sip
    if (held === 'icecream' && t % 5 > 3.9) w = [0.05, 1.6, 0.22];   // a lick
    c._armIK('L', [w[0], w[1], w[2] + zF], pose.e, 0, pose.f || 0, ty);
    if (held === 'boombox' && idle) {   // bob to the beat
      const b = Math.abs(Math.sin(t * 7));
      c.parts.head.rotation.x += 0.16 * b - 0.05; c.parts.body.position.y -= 0.025 * b * c.h;
    }
    if (held === 'phone') c.parts.head.rotation.x += 0.28;
  };
  const rIdleQ = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, -0.6, Math.PI / 2 - 0.12, 'YXZ'));
  const rq = new THREE.Quaternion(), rs = new THREE.Quaternion(), rp = new THREE.Vector3(), re = new THREE.Euler();
  ch.prop = (c, dp, dw) => {
    const P = c.parts, t = c.t;
    if (ring) {
      const H = c.h;
      ring.scale.setScalar(ringS * H);
      ring.position.set((0.43 + ch.armOff.x) * H, 0.62 * H, (0.07 + ringZ) * H); ring.quaternion.copy(rIdleQ);
      // hula: the hula dance's own params, or the idle hoop
      let p = null, w = 0;
      if (dp && dp.ph !== undefined && dw > 0) { p = dp; w = dw; }
      else if ((c._ringE || 0) > 0.001) { const ph = c._ringPh || 0; p = { ph, e: 1, hx: 0.06 * Math.cos(ph), hz: 0.045 * Math.sin(ph), dip: 0 }; w = c._ringE; }
      if (p) {
        const off = 0.105 * ringS;
        rp.set((p.hx + off * Math.cos(p.ph - Math.PI / 2) * p.e) * H, (1.0 - p.dip + 0.04 * Math.sin(p.ph * 2) * p.e) * H, (p.hz + off * Math.sin(p.ph - Math.PI / 2) * p.e) * H);
        re.set(0.28 * Math.cos(p.ph) * p.e, 0, 0.55 * Math.sin(p.ph) * p.e);
        rq.setFromEuler(re); rs.setFromAxisAngle(THREE.Object3D.DEFAULT_UP, -p.ph * 0.6); rq.multiply(rs);
        ring.position.lerp(rp, w); ring.quaternion.slerp(rq, w);
      }
    }
    if (item) {
      P.wristL.updateWorldMatrix(true, false);
      P.wristL.localToWorld(_hp.set(0, -0.1, 0.02)); P.body.worldToLocal(_hp);
      item.position.copy(_hp); item.rotation.set(0, P.torso.rotation.y, 0);
      if (held === 'football') {
        const ball = item.getObjectByName('ball');
        const up = c._idleProp && !c._dance ? 0.08 + 0.42 * Math.abs(Math.sin(t * 3.4)) : -0.02;
        ball.position.set(c._idleProp ? 0 : 0.06, up, 0); ball.rotation.x = t * (c._idleProp ? 7 : 2);
      } else if (held === 'balloon') {
        const b = item.getObjectByName('balloon'); b.position.x = 0.05 * Math.sin(t * 1.3); b.position.y = 1.06 + 0.03 * Math.sin(t * 2.1);
      } else if (held === 'baguette' || held === 'skateboard' || held === 'briefcase' || held === 'shopping') {
        item.rotation.x = 0.15 * Math.sin(t * 2) * c.walk;
      }
    }
    if (dog) {
      const sp = c.walk, ph = c.phase * Math.PI * 4;
      dog.userData.legs.forEach((L, i) => { L.rotation.x = sp > 0.05 ? 0.7 * Math.sin(ph + (i % 3 ? Math.PI : 0)) * sp : 0; });
      dog.userData.body.position.y = 0.2 + (sp > 0.05 ? 0.02 * Math.abs(Math.sin(ph)) : 0);
      dog.userData.tail.rotation.y = 0.6 * Math.sin(t * (sp > 0.05 ? 9 : 14));
      dog.userData.head.rotation.x = sp > 0.05 ? 0 : 0.12 * Math.sin(t * 1.7);
      dog.position.x = 0.55 + (sp > 0.05 ? 0 : 0.06 * Math.sin(t * 0.7)); dog.position.z = 0.5 + 0.12 * sp;
      P.wristL.updateWorldMatrix(true, false);
      P.wristL.localToWorld(_hp.set(0, -0.12, 0.02)); c.root.worldToLocal(_hp);
      _hq.set(dog.position.x, 0.29, dog.position.z + 0.14);
      leash.position.copy(_hp).add(_hq).multiplyScalar(0.5);
      leash.scale.set(1, 1, _hp.distanceTo(_hq)); leash.lookAt(c.root.localToWorld(_hq.clone()));
    }
  };
  ch.update(0, 0);
  return ch;
}
