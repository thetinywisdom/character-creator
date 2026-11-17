import * as THREE from 'three';
import { mulberry32 } from '../../lib/rng.js';
import { vertexColorMaterial } from '../../lib/skin.js';
import { PALETTE, snapColor } from '../../styles/palette.js';
import { CAT_COATS, CAT_EARS, CAT_FACES, CAT_FUR, CAT_PATTERNS, CAT_TAILS } from '../cat.js';

// Chunky toy cat: a soft vinyl figure, not the lofted town cat (subjects/cat.js).
// A bevelled block body, stubby legs with round paws, a big rounded-cube head
// (about 40% of the mesh volume) with small triangular ears set wide, and a
// thick short-to-medium tail with a round tip. Faceless unless Face is set.
//
// Same rig as the other cats (legFL..legBR, lowFL..lowBR, head, tail) so
// anim/catGait.js walks, runs and poses it. One material, vertex colours,
// flat faces. A seed (lib/rng.js) shifts the colour within the fur family,
// where patches and stripes fall, and a few proportions. The same seed
// rebuilds the same cat.
//
// The town and the default catalogue cat stay on subjects/cat.js. This one
// is a Cat lab version and the catalogue item animal.toyCat.

export { CAT_COATS, CAT_EARS, CAT_FACES, CAT_FUR, CAT_PATTERNS, CAT_TAILS };

const WHITE = PALETTE['Off white'];
const BLUSH = PALETTE.Blush;
const darker = (hex, k = 0.62) => snapColor(new THREE.Color(hex).multiplyScalar(k).getHex());
const lighter = (hex) => snapColor(new THREE.Color(hex).lerp(new THREE.Color(0xffffff), 0.45).getHex());

// Named fur, then the other palette swatches a seed may shift it toward.
const FAMILY = {
  Ginger: ['Apricot', 'Peach', 'Tan', 'Brick'],
  Gray: ['Gray', 'Stone', 'Slate', 'Light gray'],
  Black: ['Charcoal', 'Ink', 'Slate'],
  White: ['Off white', 'Paper', 'Light gray'],
  Brown: ['Cocoa', 'Walnut', 'Tan', 'Brick'],
  Cream: ['Peach', 'Sand', 'Butter', 'Paper'],
};
const WARMS = ['Apricot', 'Peach', 'Tan', 'Brick'];
const DARKS = ['Charcoal', 'Walnut', 'Ink', 'Cocoa'];

const pickNamed = (names, t) => PALETTE[names[Math.min(names.length - 1, Math.floor(t * names.length))]];
// The named fur is the usual colour. A seed past this line steps through the rest of that family.
const pickFamily = (fur, t) => {
  const list = FAMILY[fur] ?? FAMILY.Ginger;
  if (t < 0.42) return PALETTE[list[0]];
  const i = 1 + Math.floor(((t - 0.42) / 0.58) * (list.length - 1));
  return PALETTE[list[Math.min(list.length - 1, i)]];
};

/** Fixed draws so every seed spends the rng the same way. */
function roll(seed) {
  const rng = mulberry32(Number.isFinite(+seed) ? (+seed) >>> 0 : 1);
  const u = () => rng();
  const n = (amp) => 1 + (u() - 0.5) * 2 * amp;
  return {
    body: n(0.07), width: n(0.09), height: n(0.06),
    head: n(0.08), earSpread: n(0.1), earScale: n(0.12),
    tail: n(0.14), leg: n(0.08),
    stripe: u() * Math.PI * 2,
    freq: 0.82 + u() * 0.36,
    px: [u(), u(), u()],
    py: [u(), u()],
    pz: [u(), u(), u()],
    sock: 0.38 + u() * 0.28,
    chest: 0.05 + u() * 0.28,
    colour: u(),
    accent: u(),
  };
}

export const cat = {
  id: 'toyCat',
  label: 'Toy cat',
  isCharacter: true,
  exaggeration: 1.5,
  schema: {
    bodyLength: { value: 0.3, min: 0.22, max: 0.46, step: 0.01, label: 'Body length (m)' },
    chubbiness: { value: 1.08, min: 0.75, max: 1.6, step: 0.01, label: 'Chubbiness' },
    legLength: { value: 0.086, min: 0.06, max: 0.14, step: 0.005, label: 'Leg length (m)' },
    headSize: { value: 1, min: 0.75, max: 1.35, step: 0.01, label: 'Head size' },
    earSize: { value: 1, min: 0.5, max: 1.6, step: 0.01, label: 'Ear size' },
    tailLength: { value: 0.18, min: 0.08, max: 0.28, step: 0.01, label: 'Tail length (m)' },
    tailUp: { value: 0.58, min: 0, max: 1, step: 0.01, label: 'Tail raise' },
    tailCurl: { value: 0.22, min: 0, max: 1, step: 0.01, label: 'Tail curl' },
    furColor: { value: 'Ginger', options: Object.keys(CAT_FUR), label: 'Fur colour' },
    pattern: { value: 'Solid', options: CAT_PATTERNS, label: 'Pattern' },
    tailType: { value: 'Long', options: CAT_TAILS, label: 'Tail' },
    earType: { value: 'Pointed', options: CAT_EARS, label: 'Ears' },
    coat: { value: 'Short', options: CAT_COATS, label: 'Coat' },
    face: { value: 'None', options: CAT_FACES, label: 'Face' },
    seed: { value: 1, min: 0, max: 999999999, step: 1, label: 'Seed' },
  },
  presets: {
    Housecat: { bodyLength: 0.3, chubbiness: 1.08, legLength: 0.086, headSize: 1, earSize: 1, tailLength: 0.18 },
    Kitten: { bodyLength: 0.24, chubbiness: 1.02, legLength: 0.068, headSize: 1.16, earSize: 1.2, tailLength: 0.12 },
    Chonk: { bodyLength: 0.36, chubbiness: 1.48, legLength: 0.078, headSize: 1.02, earSize: 0.82, tailLength: 0.15 },
  },

  randomize(rng = Math.random) {
    const pick = (a) => a[Math.floor(rng() * a.length)];
    return {
      ...pick([cat.presets.Housecat, cat.presets.Housecat, cat.presets.Kitten, cat.presets.Chonk]),
      furColor: pick(Object.keys(CAT_FUR)),
      pattern: pick(CAT_PATTERNS),
      tailType: pick(CAT_TAILS),
      earType: pick(CAT_EARS),
      coat: rng() < 0.25 ? 'Long' : 'Short',
      face: 'None',
      seed: 1 + Math.floor(rng() * 1e9),
    };
  },

  build(p, style) {
    const v = roll(p.seed ?? 1);
    const root = new THREE.Group();
    root.name = 'cat';
    const mat = vertexColorMaterial(style);
    const part = (mesh, name) => { mesh.userData.part = name; return mesh; };
    const fluff = p.coat === 'Long' ? 1.1 : 1;

    const L = p.bodyLength * v.body;
    const W = 0.228 * p.chubbiness * fluff * v.width;
    const H = 0.162 * Math.pow(p.chubbiness, 0.4) * fluff * v.height;
    const topY = p.legLength * v.leg;
    const bodyBottom = topY - H * 0.06;
    const bodyY = bodyBottom + H / 2;

    // Head block. Tuned so head + ears land near 40% of the mesh volume.
    const hs = 0.198 * p.headSize * v.head * (fluff > 1 ? 1.04 : 1);
    const headW = hs * 1.08;
    const headH = hs * 0.98;
    const headD = hs * 1.02;
    const headPos = new THREE.Vector3(
      (v.px[0] - 0.5) * 0.012,
      bodyY + H * 0.16 + headH * 0.12,
      L * 0.5 - headD * 0.32,
    );

    root.add(part(placed(softBlock(W, H, L, 0.4), mat, [0, bodyY, 0]), 'body'));

    const head = new THREE.Group();
    head.name = 'head';
    head.position.copy(headPos);
    root.add(head);
    head.add(part(new THREE.Mesh(softBlock(headW, headH, headD, 0.52), mat), 'head'));

    if (fluff > 1) {
      const ruff = part(new THREE.Mesh(softBlock(W * 0.92, H * 0.55, L * 0.28, 0.48), mat), 'ruff');
      ruff.position.set(0, bodyY + H * 0.28, L * 0.34);
      root.add(ruff);
      for (const sx of [-1, 1]) {
        const puff = part(new THREE.Mesh(new THREE.SphereGeometry(headW * 0.16, 5, 4), mat), 'cheekFluff');
        puff.scale.set(1.15, 0.85, 0.9);
        puff.position.set(sx * headW * 0.46, -headH * 0.12, headD * 0.12);
        head.add(puff);
      }
    }

    addEars(head, p, mat, part, v, headW, headH, headD);
    if (p.face && p.face !== 'None') addFace(head, p, mat, part, headH, headD);

    const legR = 0.029 * Math.pow(p.chubbiness, 0.35) * (fluff > 1 ? 1.08 : 1);
    const pawR = legR * 1.28;
    for (const which of ['F', 'B']) {
      for (const sx of [-1, 1]) addLeg(root, mat, part, { which, sx, W, L, H, topY, legR, pawR });
    }

    const tailBase = new THREE.Vector3(0, bodyY + H * 0.08, -L * 0.5 + 0.012);
    const curled = p.tailType === 'Curled';
    addTail(root, p, mat, part, v, tailBase, fluff);

    root.userData.cat = {
      legH: topY,
      topY,
      bodyY,
      // side-lying rest: half the width, plus the little the roll formula still lifts
      bodyR: (W * 0.5 + bodyY * 0.091) / 0.85,
      L,
      hr: headH / 2,
      swing: 1.72,
      lift: 2.05,
      tailPose: curled ? -0.85 : 0,
      // the shared sit tips a long cat onto its haunches; on this short body
      // the same angle plants the big head. A milder pitch keeps the head up.
      poseTune: {
        sit: { rx: -0.55, y: -0.55, head: 0.08, legF: 0.72, lowF: 0, legB: -0.5, lowB: 2.05, tailX: -0.3, tailY: 0.85 },
      },
    };
    root.updateMatrixWorld(true);
    paintCoat(root, p, mat, {
      v, bodyY, bodyH: H, bodyL: L, bodyW: W,
      headPos, headH, headW, headD, legH: topY, tailBase,
    });
    return root;
  },
};

export { cat as toyCat };

function addEars(head, p, mat, part, v, headW, headH, headD) {
  const folded = p.earType === 'Folded';
  for (const sx of [-1, 1]) {
    const er = headW * 0.2 * p.earSize * v.earScale;
    const eh = headH * (folded ? 0.26 : 0.4) * p.earSize * v.earScale;
    const ear = new THREE.Group();
    ear.position.set(sx * headW * 0.4 * v.earSpread, headH * 0.4, -headD * 0.06);
    ear.rotation.z = -sx * (folded ? 0.25 : 0.48);
    ear.rotation.x = folded ? 1.05 : -0.15;
    const outer = part(new THREE.Mesh(new THREE.ConeGeometry(er, eh, 3), mat), 'ear');
    outer.position.y = eh * 0.42;
    const inner = part(new THREE.Mesh(new THREE.ConeGeometry(er * 0.55, eh * 0.62, 3), mat), 'earInner');
    inner.position.set(0, eh * 0.38, er * 0.32);
    ear.add(outer, inner);
    if (p.earType === 'Tufted') {
      const tuft = part(new THREE.Mesh(new THREE.ConeGeometry(er * 0.34, eh * 0.72, 3), mat), 'tuft');
      tuft.position.y = eh * 0.95;
      ear.add(tuft);
    }
    head.add(ear);
  }
}

function addFace(head, p, mat, part, headH, headD) {
  const R = headH * 0.5;
  const fz = headD * 0.46;
  const add = (w, h, d, x, y, name, zOff = 0) => {
    const m = part(new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat), name);
    m.position.set(x, y, fz + zOff);
    head.add(m);
    return m;
  };
  const ex = R * 0.42, ey = R * 0.02;
  for (const sx of [-1, 1]) {
    if (p.face === 'Sleepy') add(R * 0.34, R * 0.08, R * 0.08, sx * ex, ey - R * 0.02, 'eye');
    else if (p.face === 'Smile') add(R * 0.3, R * 0.08, R * 0.08, sx * ex, ey + R * 0.02, 'eye').rotation.z = sx * 0.4;
    else {
      const big = p.face === 'Sparkle' ? 1.3 : 1;
      add(R * 0.2 * big, R * 0.26 * big, R * 0.1, sx * ex, ey, 'eye');
      if (p.face === 'Sparkle') add(R * 0.09, R * 0.09, R * 0.04, sx * ex - R * 0.05, ey + R * 0.08, 'eyeShine', R * 0.04);
    }
    if (p.face !== 'Dots') add(R * 0.26, R * 0.12, R * 0.04, sx * R * 0.62, -R * 0.28, 'blush', -R * 0.02);
  }
  add(R * 0.16, R * 0.1, R * 0.08, 0, -R * 0.34, 'nose', R * 0.06);
}

function addLeg(root, mat, part, o) {
  const { which, sx, W, L, H, topY, legR, pawR } = o;
  const leg = new THREE.Group();
  leg.name = `leg${which}${sx < 0 ? 'R' : 'L'}`;
  const splay = 0.1;
  // the wide paw tilts with the splay and would clip the ground; lift the hip by that dip
  const plant = Math.sin(splay) * pawR * 1.22;
  leg.position.set(sx * W * (which === 'F' ? 0.4 : 0.46), topY + plant, (which === 'F' ? 0.28 : -0.3) * L);
  leg.rotation.z = sx * splay;
  const kneeY = -topY * 0.48;
  const kneeZ = which === 'F' ? 0.006 : -0.01;
  leg.add(part(limb([0, H * 0.08, 0], [0, kneeY, kneeZ], legR * 1.2, legR, 5), 'leg'));
  const low = new THREE.Group();
  low.name = `low${which}${sx < 0 ? 'R' : 'L'}`;
  low.position.set(0, kneeY, kneeZ);
  const groundY = -topY - kneeY;
  const pawCY = groundY + pawR * 0.78;
  const toe = which === 'F' ? 0.012 : -0.004;
  low.add(part(limb([0, 0, 0], [0, pawCY, toe], legR, legR * 0.86, 5), 'leg'));
  const paw = part(new THREE.Mesh(new THREE.SphereGeometry(pawR, 6, 4), mat), 'paw');
  paw.scale.set(1.22, 0.78, 1.32);
  paw.position.set(0, pawCY, toe);
  low.add(paw);
  leg.add(low);
  root.add(leg);
}

function addTail(root, p, mat, part, v, tailBase, fluff) {
  const bob = p.tailType === 'Bobtail';
  const curled = p.tailType === 'Curled';
  const tailLen = bob ? Math.min(0.055, p.tailLength) : Math.min(0.26, p.tailLength);
  const tailR = 0.034 * Math.pow(p.chubbiness, 0.35) * v.tail * (fluff > 1 ? 1.28 : 1);
  const n = bob ? 3 : curled ? 7 : 5;
  const segLen = tailLen / n;
  const up = curled ? 1 : p.tailUp;
  const curl = curled ? 1 : p.tailCurl;
  const a0 = curled ? 0.35 : -1.02 + up * 1.7;
  const pts = [tailBase.clone()];
  for (let i = 1; i <= n; i++) {
    const t = i / n;
    const a = a0 + curl * (curled ? 3.5 : 1.45) * t * t;
    pts.push(pts[i - 1].clone().add(new THREE.Vector3(0, Math.sin(a), -Math.cos(a)).multiplyScalar(segLen)));
  }
  // a low tail rests on the ground instead of sinking through it
  const dip = 0.012 - Math.min(...pts.map((q) => q.y));
  if (dip > 0) for (let i = 1; i <= n; i++) pts[i].y += dip * (i / n);
  const tail = new THREE.Group();
  tail.name = 'tail';
  tail.position.copy(pts[0]);
  const local = pts.map((q) => q.clone().sub(pts[0]));
  for (let i = 0; i < n; i++) {
    const r0 = tailR * (1 - 0.42 * (i / n));
    const r1 = tailR * (1 - 0.42 * ((i + 1) / n));
    tail.add(part(limb(local[i].toArray(), local[i + 1].toArray(), r0, r1, 5), i === n - 1 ? 'tailTip' : 'tail'));
  }
  const tip = part(new THREE.Mesh(new THREE.SphereGeometry(tailR * (bob ? 1.55 : 0.95), 6, 4), mat), 'tailTip');
  tip.position.copy(local[n]);
  tail.add(tip);
  root.add(tail);
}

/**
 * Rounded block: a box with a bevel pulled toward an ellipsoid, so the faces
 * stay broad and the edges go soft. Two segments a side (48 triangles).
 */
function softBlock(w, h, d, round = 0.42) {
  const geo = new THREE.BoxGeometry(w, h, d, 2, 2, 2);
  const pos = geo.attributes.position;
  const hx = w / 2, hy = h / 2, hz = d / 2;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    const nx = x / hx, ny = y / hy, nz = z / hz;
    const len = Math.hypot(nx, ny, nz) || 1;
    const edge = [Math.abs(nx), Math.abs(ny), Math.abs(nz)].sort((a, b) => b - a)[1];
    const t = round * Math.min(1, edge * 1.15);
    pos.setXYZ(i,
      hx * (nx * (1 - t) + (nx / len) * t),
      hy * (ny * (1 - t) + (ny / len) * t),
      hz * (nz * (1 - t) + (nz / len) * t));
  }
  geo.computeVertexNormals();
  return geo;
}

function placed(geo, material, position) {
  const mesh = new THREE.Mesh(geo, material);
  mesh.position.set(position[0], position[1], position[2]);
  return mesh;
}

/** Tapered chunk from a to b. Closed, so the stub reads solid. */
function limb(a, b, r0, r1, sides = 5) {
  const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b);
  const len = Math.max(A.distanceTo(B), 1e-4);
  const geo = new THREE.CylinderGeometry(r1, r0, len, sides, 1);
  const mesh = new THREE.Mesh(geo);
  mesh.position.copy(A).add(B).multiplyScalar(0.5);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), B.clone().sub(A).normalize());
  return mesh;
}

function paintCoat(root, p, mat, m) {
  const base = pickFamily(p.furColor, m.v.colour);
  const pat = p.pattern ?? 'Solid';
  const dark = darker(base);
  const light = lighter(base);
  const warm = pickNamed(WARMS, m.v.accent);
  const ink = pickNamed(DARKS, m.v.colour);
  const point = pickNamed(['Walnut', 'Cocoa', 'Charcoal'], m.v.accent);

  const zone = (part, P) => {
    if (part === 'body') {
      if (P.z > m.headPos.z - m.headD * 0.15 && P.y > m.bodyY - m.bodyH * 0.1) return 'chest';
      if (P.y < m.bodyY - m.bodyH * 0.18) return 'belly';
      return 'body';
    }
    if (part === 'head' || part === 'cheekFluff') {
      const lz = P.z - m.headPos.z, ly = P.y - m.headPos.y, lx = P.x - m.headPos.x;
      if (lz > m.headD * 0.12 && ly < m.headH * 0.02) return 'muzzle';
      if (Math.abs(lx) > m.headW * 0.22 && ly < m.headH * 0.02) return 'cheek';
      return part === 'cheekFluff' ? 'cheek' : 'head';
    }
    return part;
  };

  const colourOf = (partName, P) => {
    const part = zone(partName, P);
    const low = part === 'belly' || P.y < m.bodyY - m.bodyH * 0.22;
    const tailD = P.distanceTo(m.tailBase);
    if (part === 'earInner' || part === 'blush' || part === 'nose') return BLUSH;
    if (part === 'eye') return PALETTE.Ink;
    if (part === 'eyeShine') return WHITE;
    const phase = m.v.stripe;
    switch (pat) {
      case 'Tabby':
        if (part === 'tuft' || (part === 'ear' && P.y > m.headPos.y + m.headH * 0.28)) return dark;
        if (part === 'tail' || part === 'tailTip') return part === 'tailTip' || Math.sin(tailD * 42 + phase) > 0.05 ? dark : base;
        if (part === 'leg') return Math.sin(P.y * 55 + phase) > 0.35 ? dark : base;
        if (part === 'paw' || part === 'muzzle') return light;
        if (part === 'head') return Math.sin(P.x * 48 + phase) > 0.12 ? dark : base;
        if (low || part === 'cheek') return light;
        return Math.sin(P.z * 46 * m.v.freq + phase) > 0.22 ? dark : base;
      case 'Calico': {
        const white = low || ['paw', 'muzzle', 'ruff', 'cheek'].includes(part)
          || (part === 'chest' && P.y < m.bodyY + m.bodyH * m.v.chest)
          || (part === 'leg' && P.y < m.legH * (0.55 + m.v.sock * 0.4));
        if (white) return WHITE;
        const split = (m.v.px[1] - 0.5) * m.headW * 0.35;
        if (part === 'head' || part === 'ear' || part === 'tuft') {
          return P.y > m.headPos.y - m.headH * 0.05 ? (P.x < split ? ink : warm) : WHITE;
        }
        if (part === 'tail') return warm;
        if (part === 'tailTip') return ink;
        const patch = new THREE.Vector3(
          (m.v.px[2] - 0.5) * m.bodyW * 0.7,
          m.bodyY + m.bodyH * (0.05 + m.v.py[0] * 0.3),
          -m.bodyL * 0.05 + (m.v.pz[1] - 0.5) * m.bodyL * 0.45,
        );
        return P.distanceTo(patch) < Math.max(m.bodyW, m.bodyH) * (0.42 + m.v.pz[2] * 0.22) ? ink : WHITE;
      }
      case 'Tuxedo':
        if (part === 'paw' || part === 'muzzle' || part === 'ruff') return WHITE;
        if (part === 'chest' && P.y < m.bodyY + m.bodyH * m.v.chest) return WHITE;
        if (part === 'cheek' && P.y < m.headPos.y) return WHITE;
        if (low || (part === 'leg' && P.y < m.legH * 0.45)) return WHITE;
        return ink;
      case 'Bicolour':
        if (part === 'paw' || part === 'muzzle' || part === 'ruff') return WHITE;
        if (part === 'leg' && P.y < m.legH * m.v.sock) return WHITE;
        if ((part === 'chest' || part === 'cheek') && P.y < m.bodyY + m.bodyH * 0.15) return WHITE;
        if (P.y < m.bodyY - m.bodyH * (0.02 + m.v.py[1] * 0.18) && part !== 'tail' && part !== 'tailTip' && part !== 'ear' && part !== 'tuft') return WHITE;
        return base;
      case 'Points':
        if (['ear', 'tuft', 'muzzle', 'paw', 'tailTip'].includes(part)) return point;
        if (part === 'cheek' || (part === 'head' && P.z > m.headPos.z + m.headD * 0.02 && P.y < m.headPos.y + m.headH * 0.12)) return PALETTE.Cocoa;
        if (part === 'leg') return P.y < m.legH * m.v.sock ? point : PALETTE.Paper;
        if (part === 'tail') return tailD > 0.06 + m.v.pz[0] * 0.05 ? point : PALETTE.Paper;
        return low ? PALETTE['Off white'] : PALETTE.Paper;
      default:
        if (part === 'paw' || part === 'muzzle') return light;
        return base;
    }
  };

  root.updateMatrixWorld(true);
  const a = new THREE.Vector3(), col = new THREE.Color();
  root.traverse((o) => {
    if (!o.isMesh || !o.userData.part) return;
    const g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone();
    const posA = g.attributes.position;
    const n = posA.count;
    const colours = new Float32Array(n * 3);
    const step = n % 6 === 0 ? 6 : 3;
    for (let i = 0; i < n; i += step) {
      const P = new THREE.Vector3();
      for (let k = 0; k < step; k++) P.add(a.fromBufferAttribute(posA, i + k).applyMatrix4(o.matrixWorld));
      P.multiplyScalar(1 / step);
      col.setHex(colourOf(o.userData.part, P));
      for (let k = 0; k < step; k++) colours.set([col.r, col.g, col.b], (i + k) * 3);
    }
    g.setAttribute('color', new THREE.BufferAttribute(colours, 3));
    g.computeVertexNormals();
    o.geometry = g;
    o.material = mat;
  });
}
