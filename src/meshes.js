// Procedural meshes copied from iso-city. Part modules call these so the
// registered slots stay visually identical to the original creator.
import * as THREE from 'three';
import { PALETTE, COMIC } from './palette.js';
import {
  mesh, group, lathe, clip, limb, taperBox, frontLine, mulberry32,
  HEAD, HEAD_Z, TORSO, TORSO_Z, THIGH, SHIN, UPPER, FORE, LAYER_TOPS,
} from './geom.js';

function headRadius(y) {
  for (let i = 0; i < HEAD.length - 1; i++) {
    const [r0, a] = HEAD[i], [r1, b] = HEAD[i + 1];
    if (y >= a && y <= b) return r0 + (r1 - r0) * ((y - a) / (b - a || 1));
  }
  return y < HEAD[0][1] ? HEAD[0][0] : HEAD[HEAD.length - 1][0];
}

/** Slide a hair piece outward, as a whole, until its deepest point clears the skull.
 *  Per-vertex scaling flung near-axis verts across the face. */
function seatHair(hc) {
  const inv = new THREE.Matrix4();
  const back = new THREE.Matrix4();
  hc.updateWorldMatrix(true, true);
  hc.traverse((mesh) => {
    if (!mesh.isMesh) return;
    if (!mesh.geometry.boundingSphere) mesh.geometry.computeBoundingSphere();
    // Sideburns and finger-scale bits are placed by hand. Sliding them makes them float.
    if (mesh.geometry.boundingSphere.radius < 0.034) return;
    const pos = mesh.geometry.attributes.position;
    const toHc = inv.copy(hc.matrixWorld).invert().multiply(mesh.matrixWorld);
    back.copy(toHc).invert();
    const verts = [];
    const mid = new THREE.Vector3();
    let worst = 0;
    let counted = 0;
    for (let i = 0; i < pos.count; i++) {
      const p = new THREE.Vector3().fromBufferAttribute(pos, i).applyMatrix4(toHc);
      verts.push(p);
      if (p.y < -0.16 || p.y > 0.22) continue;
      const r = headRadius(p.y);
      const er = Math.hypot(p.x, p.z / HEAD_Z);
      worst = Math.max(worst, r + 0.012 - er);
      mid.add(p);
      counted++;
    }
    if (worst < 0.004 || !counted) return;
    mid.multiplyScalar(1 / counted);
    const er = Math.hypot(mid.x, mid.z / HEAD_Z);
    const shift = Math.min(worst, 0.08);
    // Bangs sit on the forehead. A radial push sends them down over the eyes.
    const out = (mid.z > 0.05 && mid.y < 0.13)
      ? new THREE.Vector3(Math.sign(mid.x || 1) * shift * 0.2, shift, shift * 0.05)
      : er < 0.04
        ? new THREE.Vector3(0, shift, 0)
        : new THREE.Vector3(mid.x / er, 0, (mid.z / HEAD_Z) / er * HEAD_Z).multiplyScalar(shift);
    for (let i = 0; i < verts.length; i++) {
      verts[i].add(out).applyMatrix4(back);
      pos.setXYZ(i, verts[i].x, verts[i].y, verts[i].z);
    }
    pos.needsUpdate = true;
    mesh.geometry.computeVertexNormals();
  });
}

export function buildHair(hc, style, color, accent, rnd) {
  const D = true; // hair is double-sided (open lathes)
  const cap = (hairline = 0.05, grow = 1.09, segs = 8) =>
    mesh(lathe(clip(HEAD, hairline, 0.163, grow, 1.04), segs, HEAD_Z), color, hc, { double: D });
  const back = (low = -0.07, top = 0.07, grow = 1.08, spread = 1) =>
    mesh(lathe(clip(HEAD, low, top, grow), 6, HEAD_Z, Math.PI * (1 - spread / 2), Math.PI * spread), color, hc, { double: D });
  const blob = (r, pos, scale, rot, detail = 0, c = color) =>
    mesh(new THREE.IcosahedronGeometry(r, detail), c, hc, { pos, scale, rot });
  const sideburns = () => {
    // High on the temple. The old boxes sat inside the cheek and read as cuts.
    for (const sx of [-1, 1]) mesh(new THREE.BoxGeometry(0.014, 0.045, 0.016), color, hc, { pos: [sx * 0.102, 0.072, 0.04] });
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
  seatHair(hc);
}

export function buildHat(hc, hat, color, accent) {
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

export function buildGlasses(hc, color) {
  for (const sx of [-1, 1]) {
    mesh(new THREE.TorusGeometry(0.03, 0.0055, 3, 8), color, hc, { pos: [sx * 0.045, 0.02, 0.122] });
    const t = mesh(new THREE.BoxGeometry(0.006, 0.006, 0.12), color, hc, { pos: [sx * 0.1, 0.03, 0.065] });
    t.rotation.y = sx * -0.25;
  }
  mesh(new THREE.BoxGeometry(0.032, 0.006, 0.006), color, hc, { pos: [0, 0.028, 0.125] });
}

export function sleeves(P, color, upperLen, foreLen = 0, r = [0.066, 0.06], puff = false) {
  for (const side of ['L', 'R']) {
    const sh = P['arm' + side];
    // A few millimetres proud of the skin, and drawn in front of it.
    mesh(new THREE.SphereGeometry(r[0] + 0.01, 7, 3, 0, Math.PI * 2, 0, Math.PI / 2), color, sh, { scale: [1, 0.8, 1], bias: -2 });
    mesh(limb(r[0] + 0.006, (puff ? r[1] + 0.02 : r[1]) + 0.006, upperLen, 7, 0.0), color, sh, { bias: -2 });
    if (foreLen) mesh(limb(r[1] + 0.002, r[1] - 0.002, foreLen, 7, 0.01), color, P['elbow' + side], { bias: -2 });
  }
}

export function shell(y0, grow = 1.07, hemFlare = 0.012, close = true) {
  const pr = clip(TORSO, Math.max(y0, 0.9), 1.672, grow);
  if (y0 < 0.9) pr.unshift([0.168 * grow + 0.012, y0]);
  pr[0] = [pr[0][0] + hemFlare, pr[0][1] - 0.01];
  // A short inward lip, not a disk through the torso. The old disk cut the
  // waistband and the two surfaces z-fought along the hem.
  if (close) pr.unshift([Math.min(0.15, pr[0][0] - 0.02), pr[0][1] + 0.008]);
  pr.push([0.055, 1.684]);
  return pr;
}

export function customTop(P, d, T) {
  const c = d.topColor, inner = d.innerColor, top = d.top;
  if (top === 'none') return;
  if (top === 'tee') { mesh(lathe(shell(0.87, 1.07), 8, TORSO_Z), c, T, { bias: -2 }); sleeves(P, c, 0.25, 0, [0.07, 0.066]); }
  else if (top === 'stripetee') {   // Kimata's striped crew-neck tee: body colour + stripes / collar rib / cuffs in the inner colour
    mesh(lathe(shell(0.87, 1.07), 8, TORSO_Z), c, T, { bias: -2 });
    for (const y of [0.96, 1.12, 1.28, 1.44, 1.6]) mesh(lathe(clip(TORSO, y, y + 0.075, 1.085), 8, TORSO_Z), inner, T);
    mesh(lathe(clip(TORSO, 1.655, 1.672, 1.09), 8, TORSO_Z), inner, T, { double: true });
    sleeves(P, c, 0.22, 0, [0.07, 0.066]);
    for (const side of ['L', 'R']) for (const y of [-0.05, -0.16]) mesh(limb(0.0725, 0.071, 0.05, 7, y), inner, P['arm' + side]);
  }
  else if (top === 'shirt') {
    const prof = shell(0.87, 1.07); mesh(lathe(prof, 8, TORSO_Z), c, T, { bias: -2 });
    frontLine(T, prof, 0.87, 1.64, TORSO_Z, PALETTE.npcLine);
    for (const sx of [-1, 1]) mesh(new THREE.BoxGeometry(0.05, 0.035, 0.01), c, T, { pos: [sx * 0.03, 1.69, 0.062], rot: [-0.9, 0, sx * -0.6] });
    mesh(limb(0.06, 0.06, 0.035, 6, 1.715), c, T, { bias: -2 }); sleeves(P, c, UPPER, 0.09);
  } else if (top === 'hoodie') {
    mesh(lathe(shell(0.84, 1.1, 0.0), 8, TORSO_Z), c, T, { bias: -2 });
    mesh(lathe(clip(TORSO, 0.84, 0.92, 1.12), 8, TORSO_Z), c, T, { bias: -2 });
    mesh(lathe([[0.1, 1.6], [0.165, 1.66], [0.15, 1.76], [0.08, 1.8]], 8, 0.95, Math.PI * 0.55, Math.PI * 0.9), c, T, { double: true });
    mesh(new THREE.BoxGeometry(0.2, 0.12, 0.02), c, T, { pos: [0, 1.06, 0.13], rot: [0.08, 0, 0] });
    for (const sx of [-1, 1]) mesh(limb(0.006, 0.006, 0.13, 3), inner, T, { pos: [sx * 0.035, 1.66, 0.14], rot: [0.12, 0, 0] });
    sleeves(P, c, UPPER, FORE - 0.015, [0.072, 0.068]);
  } else if (top === 'sweater') {
    mesh(lathe(shell(0.86, 1.11, 0.0), 8, TORSO_Z), c, T, { bias: -2 });
    mesh(lathe(clip(TORSO, 0.86, 0.93, 1.13), 8, TORSO_Z), c, T, { bias: -2 });
    mesh(limb(0.064, 0.064, 0.03, 7, 1.71), c, T, { bias: -2 }); sleeves(P, c, UPPER, FORE - 0.01, [0.075, 0.072]);
  } else if (top === 'tank') mesh(lathe(shell(0.87, 1.06), 8, TORSO_Z), c, T, { bias: -2 });
  else if (top === 'blazer' || top === 'coat' || top === 'cardigan') {
    if (d.bottom !== 'dress') mesh(lathe(shell(0.9, 1.04), 8, TORSO_Z), inner, T);
    const [y0, grow, gap] = top === 'coat' ? [0.62, 1.15, 0.3] : top === 'blazer' ? [0.86, 1.12, 0.33] : [0.83, 1.11, 0.36];
    const prof = shell(y0, grow, top === 'coat' ? 0.03 : 0.005, false);
    mesh(lathe(prof, 10, TORSO_Z, gap, Math.PI * 2 - gap * 2), c, T, { double: true });
    if (top === 'cardigan') for (const sx of [-1, 1]) frontLine(T, prof, 0.85, 1.55, TORSO_Z, c, sx * 0.055, 0.016, 0.004);
    else for (const sx of [-1, 1]) mesh(new THREE.BoxGeometry(0.045, 0.15, 0.012), c, T, { pos: [sx * 0.06, 1.53, 0.145], rot: [0.12, 0, sx * 0.3] });
    sleeves(P, c, UPPER, FORE - 0.02, [0.072, 0.068]);
  } else if (top === 'blouse') {
    const prof = shell(0.9, 1.07); mesh(lathe(prof, 8, TORSO_Z), c, T, { bias: -2 });
    frontLine(T, prof, 1.45, 1.65, TORSO_Z, inner, 0, 0.012);
    sleeves(P, c, 0.36, 0, [0.07, 0.07], true);
  }
}

export function customFace(P, d) {
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
}

export function watermelonRing({ R = 0.37, r = 0.105 } = {}) {
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

export function heldModel(kind, col) {
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

export function guitarModel(col) {
  const g = new THREE.Group(); g.name = 'guitar';
  const disc = (r, y, c, z = 0, h = 0.07) => mesh(new THREE.CylinderGeometry(r, r, h, 9), c, g, { pos: [0, y, z], rot: [Math.PI / 2, 0, 0] });
  disc(0.15, 0, col); disc(0.115, 0.15, col);
  disc(0.045, 0.1, PALETTE.black, 0.036, 0.004);
  mesh(new THREE.BoxGeometry(0.05, 0.44, 0.03), COMIC.warm[0], g, { pos: [0, 0.4, 0.01] });
  mesh(new THREE.BoxGeometry(0.07, 0.1, 0.03), PALETTE.black, g, { pos: [0, 0.66, 0.01] });
  mesh(new THREE.BoxGeometry(0.08, 0.02, 0.02), PALETTE.black, g, { pos: [0, -0.06, 0.04] });   // bridge
  return g;
}

export function dogModel(col) {
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

export function skinLine(skin) {
  return skin === PALETTE.npcSkin ? PALETTE.npcLine
    : [COMIC.warm[4], COMIC.warm[3]].includes(skin) ? COMIC.warm[1]
      : skin === COMIC.warm[2] ? COMIC.warm[1] : COMIC.neutrals[0];
}

/** Flat view of a v2 def, the shape the copied clothing builders read. */
export function v1View(def) {
  const facial = def.head.facialHair;
  return {
    skin: def.body.skin,
    hair: def.head.hair.style,
    hairColor: def.head.hair.color,
    highlight: def.head.hair.highlight,
    hat: def.head.headwear.style,
    hatColor: def.head.headwear.color,
    top: def.clothing.top.style,
    topColor: def.clothing.top.color,
    innerColor: def.clothing.top.innerColor,
    bottom: def.clothing.bottom.style,
    bottomColor: def.clothing.bottom.color,
    shoes: def.clothing.shoes.style,
    shoeColor: def.clothing.shoes.color,
    accColor: def.back.color,
    body: def.body.type,
    acc: {
      glasses: def.head.eyewear === 'glasses',
      sunglasses: def.head.eyewear === 'sunglasses',
      moustache: facial === 'moustache' || facial === 'beard',
      beard: facial === 'beard',
      earrings: !!def.head.ears.earrings,
      bag: def.back.style === 'bag',
    },
    held: def.hands.left.item,
    heldColor: def.hands.left.color,
  };
}

export function buildTorsoSkin(P, skin) {
  mesh(lathe(TORSO, 8, TORSO_Z), skin, P.torso);
  mesh(limb(0.048, 0.052, 0.14, 6, 1.73), skin, P.torso);
}

export function buildHeadShape(P, skin, line) {
  const hc = P.headCenter;
  mesh(lathe(HEAD, 8, HEAD_Z), skin, hc);
  const nose = new THREE.ConeGeometry(0.017, 0.045, 4); nose.rotateX(Math.PI / 2 + 0.5);
  mesh(nose, skin, hc, { pos: [0, -0.012, 0.12] });
  // Sit the nose marks on the wedge. The old positions floated in front of the face.
  mesh(new THREE.BoxGeometry(0.0045, 0.032, 0.004), line, hc, { pos: [0.01, -0.004, 0.116], rot: [0.35, 0, 0.12] });
  mesh(new THREE.BoxGeometry(0.016, 0.004, 0.004), line, hc, { pos: [0.004, -0.022, 0.12] });
}

export function buildEars(P, skin, line, earrings) {
  const hc = P.headCenter;
  for (const sx of [-1, 1]) {
    mesh(new THREE.SphereGeometry(0.03, 5, 4), skin, hc, { pos: [sx * 0.11, 0.0, -0.005], scale: [0.5, 1, 0.75] });
    mesh(new THREE.TorusGeometry(0.012, 0.0028, 3, 5, Math.PI * 1.3), line, hc,
      { pos: [sx * 0.1255, 0.0, -0.004], rot: [0, sx * Math.PI / 2, Math.PI * 0.35 * (sx > 0 ? 1 : -1) + (sx > 0 ? 0 : Math.PI)] });
  }
  if (earrings) for (const sx of [-1, 1]) {
    mesh(new THREE.SphereGeometry(0.014, 5, 4), COMIC.yellows[1], hc, { pos: [sx * 0.113, -0.045, 0.0] });
    mesh(new THREE.BoxGeometry(0.006, 0.02, 0.006), COMIC.yellows[1], hc, { pos: [sx * 0.113, -0.03, 0.0] });
  }
}

export function buildArm(P, side, skin, line) {
  const sx = side === 'L' ? 1 : -1;
  const sh = P['arm' + side];
  mesh(new THREE.SphereGeometry(0.05, 6, 4), skin, sh, { scale: [1, 0.85, 0.9] });
  mesh(limb(0.052, 0.045, UPPER, 6), skin, sh);
  mesh(limb(0.046, 0.038, FORE, 6), skin, P['elbow' + side]);
  const hg = group(P['wrist' + side]); hg.name = 'hand' + side;
  // 0.9 swung the paddle off the bone, so the hand floated beside the wrist.
  // A wider cuff covers the forearm end; the palm still turns a little toward the camera.
  hg.rotation.y = sx * 0.35;
  const hand = taperBox(0.088, 0.2, 0.056, { botX: 0.62, botZ: 0.82 });
  hand.translate(0, -0.052, 0.004);
  mesh(hand, skin, hg);
  mesh(new THREE.BoxGeometry(0.022, 0.05, 0.022), skin, hg, { pos: [-sx * 0.006, -0.028, 0.03], rot: [0.4, 0, 0] });
  for (const x of [-0.012, 0, 0.012])
    mesh(new THREE.BoxGeometry(0.0035, 0.04, 0.0035), line, hg, { pos: [x, -0.12, 0.024] });
}

export function legSpec(d) {
  const c = d.bottomColor, bare = d.bottom !== 'pants';
  const sh = d.shoes, shoeC = d.shoeColor;
  const legs = bare ? { thigh: d.skin, shin: d.skin, thighR: [0.078, 0.066], shinR: [0.064, 0.047] } : { thigh: c, shin: c };
  if (sh === 'sneakers') Object.assign(legs, { shoe: shoeC, sole: shoeC === PALETTE.white ? PALETTE.slate : PALETTE.white, socks: bare ? PALETTE.white : null });
  else if (sh === 'boots') Object.assign(legs, { shoe: shoeC, sole: PALETTE.black });
  else if (sh === 'flats') Object.assign(legs, { flats: shoeC, cuffSkin: bare });
  if (d.bottom === 'shorts') { legs.shorts = 0.27; legs.shortsColor = c; }
  return legs;
}

export function buildBottomGarment(P, d, T) {
  const c = d.bottomColor;
  P.legSwing = 0.34;
  // Waistband sits just outside the skin and under the shirt. The old 1.09 band
  // was wider than the tee, so the hem and the belt cut through each other.
  if (d.bottom === 'pants') mesh(lathe(clip(TORSO, 0.84, 0.92, 1.03), 8, TORSO_Z), c, T, { bias: -1 });
  else if (d.bottom === 'shorts') mesh(lathe(clip(TORSO, 0.84, 0.92, 1.03), 8, TORSO_Z), c, T, { bias: -1 });
  else if (d.bottom === 'skirt') {
    mesh(lathe([[0, 1.0], [0.176, 1.0], [0.182, 0.92], [0.206, 0.76], [0.236, 0.57], [0, 0.57]], 10, 0.86), c, T, { double: true });
    P.legSwing = 0.27;
  } else {
    mesh(lathe(shell(0.98, 1.06), 8, TORSO_Z), c, T, { bias: -2 });
    if (!LAYER_TOPS.includes(d.top)) sleeves(P, c, 0.16, 0, [0.068, 0.066]);
    mesh(lathe([[0, 0.99], [0.174, 0.99], [0.182, 0.92], [0.206, 0.76], [0.236, 0.57], [0, 0.57]], 10, 0.86), c, T, { double: true });
    mesh(lathe(clip(TORSO, 0.98, 1.02, 1.08), 8, TORSO_Z), d.accColor, T);
    P.legSwing = 0.27;
  }
}

export function buildLegLimbs(P, d) {
  const o = legSpec(d);
  for (const side of ['L', 'R']) {
    const { hip, knee } = P['legParts' + side];
    const tr = o.thighR || [0.086, 0.082];
    const sr = o.shinR || [0.082, 0.082];
    mesh(new THREE.SphereGeometry(tr[0], 6, 3, 0, Math.PI * 2, 0, Math.PI / 2), o.thigh, hip);
    mesh(limb(tr[0], tr[1], THIGH, 6), o.thigh, hip);
    mesh(limb(sr[0], sr[1], SHIN, 6), o.shin, knee);
    if (o.shorts) mesh(limb(tr[0] + 0.022, tr[0] + 0.016, o.shorts, 7), o.shortsColor, hip);
  }
}

export function buildFootwear(P, d) {
  const o = legSpec(d);
  for (const side of ['L', 'R']) {
    const { knee, ankle } = P['legParts' + side];
    const sr = o.shinR || [0.082, 0.082];
    if (o.socks) mesh(limb(sr[1] + 0.006, sr[1] + 0.006, 0.07, 6, -SHIN + 0.075), o.socks, knee);
    if (o.cuffSkin) mesh(limb(0.042, 0.04, 0.05, 6, -SHIN + 0.04), d.skin, knee);
    if (o.shoe) {
      const s = taperBox(0.105, 0.07, 0.25, { botX: 1, botZ: 1, frontTopY: -0.025 });
      mesh(s, o.shoe, ankle, { pos: [0, -0.045, 0.045] });
      if (o.sole) mesh(new THREE.BoxGeometry(0.108, 0.02, 0.252), o.sole, ankle, { pos: [0, -0.071, 0.045] });
    } else if (o.flats) {
      mesh(taperBox(0.08, 0.05, 0.21, { frontTopY: -0.02 }), d.skin, ankle, { pos: [0, -0.05, 0.045] });
      mesh(new THREE.BoxGeometry(0.09, 0.022, 0.23), o.flats, ankle, { pos: [0, -0.069, 0.045] });
      mesh(new THREE.BoxGeometry(0.092, 0.03, 0.06), o.flats, ankle, { pos: [0, -0.05, 0.11] });
    } else {
      mesh(taperBox(0.085, 0.06, 0.23, { botZ: 1, frontTopY: -0.03 }), d.skin, ankle, { pos: [0, -0.05, 0.05] });
    }
  }
  if (d.shoes === 'boots') {
    for (const side of ['L', 'R']) mesh(limb(o.shinR ? 0.07 : 0.088, o.shinR ? 0.06 : 0.088, 0.17, 6, -SHIN + 0.13), d.shoeColor, P['knee' + side]);
  }
}

export function fillColor(d) {
  if (d.bottom === 'dress' && !LAYER_TOPS.includes(d.top)) return d.bottomColor;
  if (d.top === 'none') return d.skin;
  if (d.top === 'coat' || d.top === 'blazer' || d.top === 'cardigan') return d.innerColor;
  return d.topColor;
}

export function buildBodyExtras(P, d) {
  const fill = fillColor(d), T = P.torso;
  if (d.body === 'fat') mesh(new THREE.SphereGeometry(0.17, 8, 6), fill, T, { pos: [0, 1.1, 0.045], scale: [1.02, 0.95, 1.05] });
  if (d.body === 'muscle') {
    for (const sx of [-1, 1]) mesh(new THREE.BoxGeometry(0.13, 0.11, 0.05), fill, T, { pos: [sx * 0.072, 1.46, 0.105], rot: [0.12, 0, sx * -0.1] });
    for (const sx of [-1, 1]) mesh(new THREE.BoxGeometry(0.08, 0.05, 0.14), d.top === 'none' || d.top === 'tank' ? d.skin : fill, T, { pos: [sx * 0.1, 1.66, -0.01], rot: [0, 0, sx * -0.45] });
  }
}

export function buildBag(P, d, shape) {
  const T = P.torso;
  const zf = 0.155 * shape.tz + (d.body === 'fat' ? 0.06 : 0);
  mesh(new THREE.BoxGeometry(0.03, 0.66, 0.014), PALETTE.slate, T, { pos: [0.01, 1.3, zf], rot: [0.05, 0, 0.62] });
  mesh(new THREE.BoxGeometry(0.03, 0.62, 0.014), PALETTE.slate, T, { pos: [0.01, 1.3, -0.15 * shape.tz], rot: [-0.05, 0, 0.62] });
  mesh(new THREE.BoxGeometry(0.07, 0.17, 0.2), d.accColor, T, { pos: [0.205, 1.0, 0.04] });
  mesh(new THREE.BoxGeometry(0.075, 0.06, 0.205), PALETTE.slate, T, { pos: [0.206, 1.06, 0.04] });
}

export function buildHeadwear(P, d) {
  let capG = null;
  if (d.hat === 'backcap') {
    capG = group(P.headCenter); capG.rotation.y = Math.PI;
    buildHat(capG, 'cap', d.hatColor, d.hatColor);
    mesh(new THREE.BoxGeometry(0.06, 0.035, 0.012), d.hairColor, capG, { pos: [0, 0.075, -0.112], rot: [0.35, 0, 0] });
  } else if (d.hat && d.hat !== 'none') {
    capG = group(P.headCenter);
    buildHat(capG, d.hat, d.hatColor, d.hatColor === PALETTE.slate ? PALETTE.black : PALETTE.slate);
  }
  return capG;
}

export function heldOffsets(shape, bodyType) {
  const zF = 0.1 * (shape.tz - 1) + (bodyType === 'fat' ? 0.07 : 0) + (bodyType === 'muscle' ? 0.04 : 0);
  const ringS = Math.max(1, 0.35 + 0.65 * shape.tx);
  const ringZ = zF * 0.6;
  const armOff = { x: 0.11 * (shape.sh - 1), z: zF };
  return { zF, ringS, ringZ, armOff };
}

export function placeLeftHeld(P, held, heldColor, shape, bodyType) {
  const { zF, ringS, ringZ, armOff } = heldOffsets(shape, bodyType);
  let item = null, guitar = null, dog = null, leash = null, ring = null;
  if (held === 'guitar') {
    const gr = group(P.body); gr.name = 'guitarRoot';
    guitar = guitarModel(heldColor); gr.add(guitar);
    guitar.position.set(-0.06, 1.12, 0.21 + zF); guitar.rotation.z = -0.9;
  } else if (held === 'dog') {
    dog = dogModel(heldColor); P.root.add(dog); dog.position.set(0.55, 0, 0.5);
    leash = mesh(new THREE.BoxGeometry(0.008, 0.008, 1), PALETTE.black, P.root);
  } else if (held === 'ring') {
    ring = watermelonRing(); P.root.add(ring); ring.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  } else if (held && held !== 'none') {
    item = heldModel(held, heldColor); P.body.add(item);
  }
  return { held: held || 'none', item, guitar, dog, leash, ring, zF, ringS, ringZ, armOff };
}

export function placeRightHeld(P, kind, color) {
  if (!kind || kind === 'none') return null;
  let model;
  if (kind === 'guitar') model = guitarModel(color);
  else if (kind === 'dog') model = dogModel(color);
  else if (kind === 'ring') model = watermelonRing();
  else model = heldModel(kind, color);
  model.position.set(0, -0.12, 0.04);
  P.wristR.add(model);
  return model;
}
