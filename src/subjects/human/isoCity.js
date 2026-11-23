import * as THREE from 'three';
import { CLOTH_COLORS, HAIR_COLORS, SKIN_TONES } from '../../styles/palette.js';

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
// Step 1 of the port: body, head, hands, feet, shirt / tee / trousers /
// shorts / skirt, hair. Hats, glasses, beards, outer layers, bags and held
// items come in step 2.

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
  const skinHex = SKIN_TONES[p.skin] ?? SKIN_TONES.Light;
  const M = {
    skin: style.material('skin', skinHex),
    line: style.material('skin', new THREE.Color(skinHex).multiplyScalar(0.62).getHex()), // nose and ear lines
    hair: style.material('hair', HAIR_COLORS[p.hairColor] ?? HAIR_COLORS.Black),
    hairAccent: style.material('hair', new THREE.Color(HAIR_COLORS[p.hairColor] ?? 0x2f3236).multiplyScalar(0.7).getHex()),
    top: style.material('cloth', CLOTH_COLORS[p.topColor] ?? CLOTH_COLORS.White),
    legwear: style.material('clothAlt', CLOTH_COLORS[p.legwearColor] ?? CLOTH_COLORS.Navy),
    shoe: style.material('shoe', CLOTH_COLORS[p.shoeColor] ?? CLOTH_COLORS.Brown),
    placket: style.material('accent', new THREE.Color(CLOTH_COLORS[p.topColor] ?? 0xf2efe8).multiplyScalar(0.7).getHex()),
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

  // --- skeleton: our joint names, iso-city positions ------------------------
  const root = new THREE.Group();
  root.name = 'human';
  const spine = group(root, 0, HIP_Y, 0, 'spine');
  const upper = group(spine, 0, -HIP_Y, 0);
  const T = group(upper);               // torso parts (body coordinates)
  if (elderly) root.userData.stoop = 0.2;

  // build (as iso-city's Character: one factor -> shoulders, hips, torso, limbs)
  const b = { Skinny: 0.9, Normal: 1, Bulky: 1.12, Fat: 1.2 }[p.build] ?? 1;
  const S = { sh: 1 + (b - 1) * 0.8, hip: 1 + (b - 1) * 0.6, tx: b, tz: 1 + (b - 1) * 0.7, leg: 1 + (b - 1) * 0.8, arm: 1 + (b - 1) * 0.6 };
  if (p.build === 'Fat') S.tz *= 1.08;
  if (woman) { S.sh *= 0.93; S.hip *= 1.08; }
  T.scale.set(S.tx, 1, S.tz);

  // torso + neck (skin), shirt shells go over them
  mesh(lathe(TORSO, 8, TORSO_Z), M.skin, T);
  mesh(limb(0.048, 0.052, 0.14, 6, 1.73), M.skin, upper);

  // head: egg shape, ears with the "C" line, the nose wedge and its hooked line; no eyes
  const head = group(upper, 0, NECK_Y, 0, 'head');
  const hc = group(head, 0, HEAD_C, 0);
  if (kid) hc.scale.setScalar(1.22); // children: bigger heads
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
  for (const [side, sx] of [['L', 1], ['R', -1]]) {
    const sh = arms[side] = group(upper, sx * SHOULDER_X * S.sh, SHOULDER_Y, 0, `arm${side}`);
    sh.scale.set(S.arm, 1, S.arm);
    sh.rotation.z = sx * 0.06; // hanging a little away from the body (the gait reads this as the rest)
    mesh(new THREE.SphereGeometry(0.05, 6, 4), M.skin, sh, { scale: [1, 0.85, 0.9] });
    mesh(limb(0.052, 0.045, UPPER, 6), M.skin, sh);
    const el = group(sh, 0, -UPPER, 0, `fore${side}`);
    mesh(limb(0.045, 0.036, FORE, 6), M.skin, el);
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
    const hip = group(root, sx * HIP_X * S.hip, HIP_Y, 0, `leg${side}`);
    hip.scale.set(S.leg, 1, S.leg);
    const knee = group(hip, 0, -THIGH, 0, `shin${side}`);
    const ankle = group(knee, 0, -SHIN, 0, `foot${side}`);
    // heel and toe of the sole, in ankle space (the gait plants these)
    ankle.userData.sole = [new THREE.Vector3(0, -ANKLE_H, 0.045 - 0.125), new THREE.Vector3(0, -ANKLE_H, 0.045 + 0.125)];
    legs[side] = { hip, knee, ankle };
  }

  // --- clothes ---------------------------------------------------------------
  // garment shell = the torso profile grown outward, from hem y0 up to the neck
  const shell = (y0, grow = 1.07, hemFlare = 0.012, close = true) => {
    const pr = clip(TORSO, Math.max(y0, 0.9), 1.672, grow);
    if (y0 < 0.9) pr.unshift([0.168 * grow + 0.012, y0]);
    pr[0] = [pr[0][0] + hemFlare, pr[0][1] - 0.01];
    if (close) pr.unshift([0, pr[0][1] + 0.005]);
    pr.push([0.055, 1.684]);
    return pr;
  };
  const sleeves = (m, upperLen, foreLen = 0, r = [0.066, 0.06], puff = false) => {
    for (const side of ['L', 'R']) {
      const sh = arms[side];
      mesh(new THREE.SphereGeometry(r[0] + 0.003, 7, 3, 0, Math.PI * 2, 0, Math.PI / 2), m, sh, { scale: [1, 0.8, 1] });
      mesh(limb(r[0], puff ? r[1] + 0.02 : r[1], upperLen, 7, 0.0), m, sh);
      if (foreLen) mesh(limb(r[1] - 0.004, r[1] - 0.008, foreLen, 7, 0.01), m, sh.getObjectByName(`fore${side}`));
    }
  };
  // a line down the front of a shell (button placket)
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

  const top = p.top ?? 'T-shirt';
  const longSleeve = /long sleeve|Sweater|Hoodie|Blazer|Suit|Uniform/i.test(top);
  if (/Shirt|Blouse|Uniform/.test(top) && !/T-shirt/.test(top)) {
    // button shirt: placket, collar points, collar band, 3/4 or long sleeves
    const prof = shell(0.87, 1.07);
    mesh(lathe(prof, 8, TORSO_Z), M.top, T);
    frontLine(prof, 0.87, 1.64, M.placket);
    for (const sx of [-1, 1])
      mesh(new THREE.BoxGeometry(0.05, 0.035, 0.01), M.top, T, { pos: [sx * 0.03, 1.69, 0.062], rot: [-0.9, 0, sx * -0.6] });
    mesh(limb(0.06, 0.06, 0.035, 6, 1.715), M.top, T);
    sleeves(M.top, UPPER, longSleeve ? FORE - 0.02 : 0.09);
  } else if (/Tank/.test(top)) {
    mesh(lathe(shell(0.87, 1.06), 8, TORSO_Z), M.top, T);
  } else {
    // tee (and for now everything else): short or long sleeves
    mesh(lathe(shell(0.87, 1.07), 8, TORSO_Z), M.top, T);
    if (longSleeve) sleeves(M.top, UPPER, FORE - 0.015, [0.07, 0.066]);
    else sleeves(M.top, 0.25, 0, [0.07, 0.066]);
  }

  // legs: trousers, shorts (bare legs below), a skirt (bare legs, flats)
  const legwear = p.legwear ?? 'Trousers';
  const shoes = (m) => {
    for (const side of ['L', 'R']) {
      const { ankle } = legs[side];
      mesh(taperBox(0.105, 0.07, 0.25, { frontTopY: -0.025 }), m, ankle, { pos: [0, -0.045, 0.045] });
    }
  };
  const dressLegs = (thigh, shin, { thighR = [0.086, 0.082], shinR = [0.082, 0.082], shorts = 0 } = {}) => {
    for (const side of ['L', 'R']) {
      const { hip, knee } = legs[side];
      mesh(new THREE.SphereGeometry(thighR[0], 6, 3, 0, Math.PI * 2, 0, Math.PI / 2), thigh, hip);
      mesh(limb(thighR[0], thighR[1], THIGH, 6), thigh, hip);
      mesh(limb(shinR[0], shinR[1], SHIN, 6), shin, knee);
      if (shorts) mesh(limb(thighR[0] + 0.022, thighR[0] + 0.016, shorts, 7), M.legwear, hip);
    }
  };
  if (legwear === 'Shorts') {
    dressLegs(M.skin, M.skin, { thighR: [0.078, 0.066], shinR: [0.064, 0.047], shorts: 0.3 });
  } else if (legwear === 'Skirt') {
    dressLegs(M.skin, M.skin, { thighR: [0.075, 0.065], shinR: [0.062, 0.045] });
    const skirt = group(upper, 0, 0, 0);
    mesh(lathe([[0, 0.99], [0.174, 0.99], [0.182, 0.92], [0.206, 0.76], [0.236, 0.57], [0, 0.57]], 10, 0.86), M.legwear, skirt, { double: true });
  } else {
    dressLegs(M.legwear, M.legwear, kid || woman ? { thighR: [0.08, 0.074], shinR: [0.074, 0.07] } : {});
  }
  shoes(M.shoe);

  // --- hair -------------------------------------------------------------------
  const hairStyle = HAIR_MAP[p.hair] ?? (p.hair === 'bald' ? 'none' : 'sideswept');
  buildHair(hc, hairStyle, M.hair, M.hairAccent, mulberry32(String(p.hair) + String(p.hairColor)), mesh);

  // --- to real size: iso-city units -> metres for this person's height --------
  // (children: shorter, with the bigger head already in place)
  const k = (p.height ?? 1.7) / (TOTAL + (kid ? 0.08 : 0));
  root.traverse((o) => {
    if (o === root) return;
    o.position.multiplyScalar(k);
    if (o.isMesh && !o.geometry.userData.scaled) { o.geometry.scale(k, k, k); o.geometry.userData.scaled = true; }
  });
  for (const side of ['L', 'R']) legs[side].ankle.userData.sole.forEach((v) => v.multiplyScalar(k));
  root.userData.isoCity = true;
  return root;
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
