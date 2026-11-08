import * as THREE from 'three';
import { capsuleBetween, ellipsoid, seg } from '../lib/shapes.js';
import { vertexColorMaterial } from '../lib/skin.js';
import { PALETTE, snapColor } from '../styles/palette.js';

// A cat, standing on all fours. Faces +z (head at +z, tail at -z).
// Joints for the walk, run and poses (anim/catGait.js): legFL, legFR, legBL,
// legBR, head, tail.
//
// Shape: a deep chest, a slimmer waist and round haunches, a short neck, a
// round head with cheeks and a small muzzle (no eyes or face), front legs
// in two tapering parts, back legs bent at the hock.
// Options: coat pattern, tail type, ear type, short or long (fluffy) coat.
// Patterns are painted per face from the palette (vertex colours), so a cat
// stays one material, and one skinned mesh in the city (lib/skin.js keeps
// the face colours).

// fur colours (palette colours); patterns like calico or tuxedo bring their own
export const CAT_FUR = { Ginger: 0xdcb08c, Gray: 0x918f8a, Black: 0x4a4d52, White: 0xf2efe8, Brown: 0x8a7462, Cream: 0xecccb0 };
export const CAT_PATTERNS = ['Solid', 'Tabby', 'Calico', 'Tuxedo', 'Bicolour', 'Points'];
export const CAT_TAILS = ['Long', 'Curled', 'Bobtail'];
export const CAT_EARS = ['Pointed', 'Tufted', 'Folded'];
export const CAT_COATS = ['Short', 'Long'];

const WHITE = PALETTE['Off white'], BLUSH = PALETTE.Blush;
const darker = (hex, k = 0.62) => snapColor(new THREE.Color(hex).multiplyScalar(k).getHex());
const lighter = (hex) => snapColor(new THREE.Color(hex).lerp(new THREE.Color(0xffffff), 0.45).getHex());
// a fixed hash for blocky patches (calico)
const hash = (x, y, z) => { const s = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453; return s - Math.floor(s); };

export const cat = {
  id: 'cat',
  label: 'Cat',
  isCharacter: true,
  // drawn 1.5x real size so it reads from across a street (style guide §5)
  exaggeration: 1.5,
  schema: {
    bodyLength: { value: 0.42, min: 0.25, max: 0.6,  step: 0.01, label: 'Body length (m)' },
    chubbiness: { value: 1,    min: 0.7,  max: 1.6,  step: 0.01, label: 'Chubbiness' },
    legLength:  { value: 0.16, min: 0.08, max: 0.24, step: 0.005, label: 'Leg length (m)' },
    headSize:   { value: 1,    min: 0.7,  max: 1.5,  step: 0.01, label: 'Head size' },
    earSize:    { value: 1,    min: 0.5,  max: 1.8,  step: 0.01, label: 'Ear size' },
    tailLength: { value: 0.34, min: 0.1,  max: 0.5,  step: 0.01, label: 'Tail length (m)' },
    tailUp:     { value: 0.6,  min: 0,    max: 1,    step: 0.01, label: 'Tail raise' },
    tailCurl:   { value: 0.5,  min: 0,    max: 1,    step: 0.01, label: 'Tail curl' },
    furColor:   { value: 'Ginger', options: Object.keys(CAT_FUR), label: 'Fur colour' },
    pattern:    { value: 'Solid', options: CAT_PATTERNS, label: 'Pattern' },
    tailType:   { value: 'Long', options: CAT_TAILS, label: 'Tail' },
    earType:    { value: 'Pointed', options: CAT_EARS, label: 'Ears' },
    coat:       { value: 'Short', options: CAT_COATS, label: 'Coat' },
  },
  presets: {
    Housecat: { bodyLength: 0.42, chubbiness: 1,    legLength: 0.16, headSize: 1,    earSize: 1,   tailLength: 0.34 },
    Kitten:   { bodyLength: 0.28, chubbiness: 0.9,  legLength: 0.1,  headSize: 1.35, earSize: 1.3, tailLength: 0.2 },
    Chonk:    { bodyLength: 0.45, chubbiness: 1.55, legLength: 0.1,  headSize: 1.05, earSize: 0.8, tailLength: 0.26 },
    Lanky:    { bodyLength: 0.55, chubbiness: 0.75, legLength: 0.23, headSize: 0.9,  earSize: 1.45, tailLength: 0.45 },
  },

  /** A random cat (for the city): pattern, colour, tail, ears, coat. */
  randomize(rng = Math.random) {
    const pick = (a) => a[Math.floor(rng() * a.length)];
    return {
      ...pick([cat.presets.Housecat, ...Object.values(cat.presets)]), // housecats are the most common
      furColor: pick(Object.keys(CAT_FUR)),
      pattern: pick(['Solid', 'Tabby', 'Tabby', 'Calico', 'Tuxedo', 'Bicolour', 'Points']),
      tailType: pick(['Long', 'Long', 'Long', 'Curled', 'Bobtail', 'Bobtail']),
      earType: pick(['Pointed', 'Pointed', 'Pointed', 'Tufted', 'Folded']),
      coat: rng() < 0.25 ? 'Long' : 'Short',
    };
  },

  build(p, style) {
    const root = new THREE.Group();
    root.name = 'cat';
    const fluff = p.coat === 'Long' ? 1.18 : 1;
    const part = (mesh, name) => { mesh.userData.part = name; return mesh; };
    const M = style.material('fur', 0xffffff); // replaced by the painted coat at the end

    const L = p.bodyLength;
    const c = p.chubbiness;
    const bodyR = 0.075 * c * fluff;
    const legLen = p.legLength;
    const legR = 0.018 * Math.pow(c, 0.6) * (fluff > 1 ? 1.1 : 1);
    const bodyY = legLen + bodyR * 0.55 / fluff;

    // --- body: waist, a deep chest in front, round haunches behind -------
    const zb = Math.min(-L / 2 + bodyR, 0);
    const zf = Math.max(L / 2 - bodyR, 0);
    // (cut into rings along its length, so stripes and patches paint in blocks)
    const waistGeo = new THREE.CapsuleGeometry(bodyR * 0.82, Math.max(zf - zb, 0.001), seg(6, 2), seg(14, 6), 8);
    waistGeo.rotateX(Math.PI / 2);
    const waist = part(new THREE.Mesh(waistGeo, M), 'body');
    waist.position.set(0, bodyY + bodyR * 0.075, (zb + zf) / 2);
    waist.scale.x = 0.86;
    root.add(waist);
    root.add(part(ellipsoid(bodyR * 1.06, [0.84, 1.04, 1.0], M, { position: [0, bodyY + bodyR * 0.02, zf - bodyR * 0.05] }), 'chest'));
    root.add(part(ellipsoid(bodyR * 0.98, [0.92, 0.98, 1.0], M, { position: [0, bodyY + bodyR * 0.12, zb + bodyR * 0.05] }), 'body'));
    if (c > 1.2) root.add(part(ellipsoid(bodyR * 0.75, [0.95, 0.8, 1.3], M, { position: [0, bodyY - bodyR * 0.35, 0] }), 'body')); // a tummy

    // --- legs: each hangs from a joint at the top (legFL, ... legBR) -----
    const legZ = { F: L / 2 - bodyR * 0.75, B: -L / 2 + bodyR * 0.95 };
    const topY = bodyY - bodyR * 0.2;
    const legH = topY - legR * 1.1; // pivot to the bottom of the paw
    for (const [which, z] of Object.entries(legZ)) {
      for (const sx of [-1, 1]) {
        const x = sx * bodyR * 0.46;
        const leg = new THREE.Group();
        leg.name = `leg${which}${sx < 0 ? 'R' : 'L'}`;
        leg.position.set(x, topY, z);
        if (which === 'F') {
          // upper and lower leg, tapering to the paw
          leg.add(part(capsuleBetween([0, 0, 0], [0, -legH * 0.5, 0.008], legR * 1.3, M, 8), 'leg'));
          leg.add(part(capsuleBetween([0, -legH * 0.5, 0.008], [0, -legH + legR * 0.2, 0], legR * 0.9, M, 8), 'leg'));
        } else {
          // haunch, thigh back to the hock, then the lower leg down to the paw
          leg.add(part(ellipsoid(bodyR * 0.6, [0.62, 1, 1.05], M, { position: [-sx * bodyR * 0.06, -bodyR * 0.08, 0] }), 'body'));
          const hock = [0, -legH * 0.55, -legH * 0.28];
          leg.add(part(capsuleBetween([0, -bodyR * 0.2, 0], hock, legR * 1.35, M, 8), 'leg'));
          leg.add(part(capsuleBetween(hock, [0, -legH + legR * 0.2, 0.01], legR * 0.85, M, 8), 'leg'));
        }
        leg.add(part(ellipsoid(legR * 1.3, [1, 0.65, 1.3], M, { position: [0, -legH + legR * 0.6, legR * 0.4] }), 'paw'));
        root.add(leg);
      }
    }

    // --- neck and head ----------------------------------------------------
    const hr = 0.062 * p.headSize;
    const head = new THREE.Group();
    head.name = 'head';
    const headY = bodyY + bodyR * 0.75 + hr * 0.35, headZ = L / 2 + hr * 0.1;
    head.position.set(0, headY, headZ);
    root.add(head);
    root.add(part(capsuleBetween([0, bodyY + bodyR * 0.3, zf + bodyR * 0.3], [0, headY - hr * 0.3, headZ - hr * 0.3], hr * 0.6 * fluff, M, 10), 'chest'));
    if (fluff > 1) root.add(part(ellipsoid(hr * 1.05, [1.15, 0.9, 0.8], M, { position: [0, headY - hr * 0.75, headZ - hr * 0.55] }), 'ruff')); // the long coat's ruff
    const rx = hr * 1.1, ry = hr * 0.92, rz = hr * 0.95;
    head.add(part(ellipsoid(1, [rx, ry, rz], M), 'head'));
    for (const sx of [-1, 1]) head.add(part(ellipsoid(hr * 0.5, [1, 0.78, 0.9], M, { position: [sx * rx * 0.48, -ry * 0.32, rz * 0.32] }), 'cheek'));
    // a small muzzle keeps the profile readable; no eyes or nose
    head.add(part(ellipsoid(hr * 0.32, [1.3, 0.8, 0.85], M, { position: [0, -hr * 0.36, rz * 0.82] }), 'muzzle'));

    // --- ears: pointed, tufted (a dark tip) or folded forward -------------
    for (const sx of [-1, 1]) {
      const folded = p.earType === 'Folded';
      const er_ = hr * 0.42 * p.earSize, eh = hr * (folded ? 0.38 : 0.62) * p.earSize;
      const ear = new THREE.Group();
      ear.position.set(sx * rx * (folded ? 0.45 : 0.52), ry * (folded ? 0.7 : 0.62), -rz * 0.05);
      ear.rotation.z = -sx * 0.38;
      if (folded) ear.rotation.x = 1.0; // folded down toward the face
      const outer = part(new THREE.Mesh(new THREE.ConeGeometry(er_, eh, seg(16)), M), 'ear');
      outer.position.y = eh / 2;
      outer.scale.z = 0.45;
      const inner = part(new THREE.Mesh(new THREE.ConeGeometry(er_ * 0.6, eh * 0.7, seg(16)), M), 'earInner');
      inner.position.set(0, eh * 0.38, er_ * 0.12);
      inner.scale.z = 0.35;
      ear.add(outer, inner);
      if (p.earType === 'Tufted') {
        const tuft = part(new THREE.Mesh(new THREE.ConeGeometry(er_ * 0.18, eh * 0.45, 4), M), 'tuft');
        tuft.position.y = eh + eh * 0.18;
        ear.add(tuft);
      }
      head.add(ear);
    }

    // --- tail: long, curled up over the back, or a short bob --------------
    const bob = p.tailType === 'Bobtail', curled = p.tailType === 'Curled';
    const tailLen = bob ? Math.min(0.07, p.tailLength) : p.tailLength;
    const tailR = 0.019 * Math.pow(c, 0.6) * (fluff > 1 ? 1.6 : 1);
    const n = bob ? 6 : 24;
    const segLen = tailLen / n;
    const up = curled ? 0.95 : p.tailUp, curl = curled ? 1 : p.tailCurl;
    const a0 = 0.15 + up * 1.2; // angle above horizontal, pointing back
    const pts = [new THREE.Vector3(0, bodyY + bodyR * 0.35, -L / 2 + bodyR * 0.25)];
    for (let i = 1; i <= n; i++) {
      const t = i / n;
      const a = a0 + curl * (curled ? 5.2 : 3.6) * Math.pow(t, curled ? 1.6 : 2.5); // curl mostly near the tip
      pts.push(pts[i - 1].clone().add(new THREE.Vector3(0, Math.sin(a), -Math.cos(a)).multiplyScalar(segLen)));
    }
    const curve = new THREE.CatmullRomCurve3(pts);
    const tubular = seg(bob ? 8 : 48, 6), radial = seg(10, 4);
    const tube = new THREE.TubeGeometry(curve, tubular, tailR, radial, false);
    const pos = tube.attributes.position;
    const v = new THREE.Vector3();
    for (let i = 0; i <= tubular; i++) {
      const u = i / tubular;
      const centre = curve.getPointAt(u);
      const taper = 1.25 - 0.75 * u; // thick at the base, thin at the tip
      for (let j = 0; j <= radial; j++) {
        const k = i * (radial + 1) + j;
        v.fromBufferAttribute(pos, k).sub(centre).multiplyScalar(taper).add(centre);
        pos.setXYZ(k, v.x, v.y, v.z);
      }
    }
    // the tail hangs from a joint at its base so it can sway
    const tail = new THREE.Group();
    tail.name = 'tail';
    tail.position.copy(pts[0]);
    tube.translate(-pts[0].x, -pts[0].y, -pts[0].z);
    tail.add(part(new THREE.Mesh(tube, M), 'tail'));
    tail.add(part(ellipsoid(tailR * (bob ? 2.4 : 0.55), [1, 1, 1], M, { position: pts[n].clone().sub(pts[0]).toArray() }), bob ? 'tail' : 'tailTip'));
    root.add(tail);

    // measurements the poses need (anim/catGait.js)
    root.userData.cat = { legH, topY, bodyY, bodyR, L, hr };
    paintCoat(root, p, style, { bodyY, bodyR, zf, zb, legH, headY, hr, tailBase: pts[0] });
    return root;
  },
};

/**
 * Paint the coat: every face gets one palette colour from its part and where
 * it is (stripes, patches, white socks...), so patterns stay crisp and blocky.
 */
function paintCoat(root, p, style, m) {
  const base = CAT_FUR[p.furColor] ?? CAT_FUR.Ginger;
  const pat = p.pattern ?? 'Solid';
  const dark = darker(base), light = lighter(base);
  const colourOf = (partName, P) => {
    const low = P.y < m.bodyY - m.bodyR * 0.45; // belly
    const tailD = P.distanceTo(m.tailBase);
    if (partName === 'earInner') return BLUSH;
    switch (pat) {
      case 'Tabby':
        if (partName === 'tuft') return dark;
        if (partName === 'tail' || partName === 'tailTip') return partName === 'tailTip' || Math.sin(tailD * 60) > 0.1 ? dark : base;
        if (partName === 'leg') return Math.sin(P.y * 75) > 0.45 ? dark : base;
        if (partName === 'paw' || partName === 'muzzle') return light;
        if (partName === 'head') return P.y > m.headY + m.hr * 0.25 && Math.sin(P.x * 95) > 0.2 ? dark : base;
        if (low) return light;
        return Math.sin(P.z * 52 + Math.abs(P.x) * 20) > 0.3 ? dark : base;
      case 'Calico': {
        if (low || partName === 'paw' || partName === 'muzzle' || partName === 'chest' || partName === 'ruff') return WHITE;
        if (partName === 'leg' && P.y < m.legH * 0.7) return WHITE;
        const s = 0.07 * (m.bodyR / 0.075);
        const h = hash(Math.floor(P.x / s), Math.floor(P.y / s), Math.floor(P.z / s));
        return h < 0.34 ? PALETTE.Apricot : h < 0.56 ? PALETTE.Charcoal : WHITE;
      }
      case 'Tuxedo':
        if (partName === 'paw' || partName === 'muzzle' || partName === 'ruff') return WHITE;
        if (partName === 'chest' && P.y < m.bodyY + m.bodyR * 0.2) return WHITE;
        if (partName === 'cheek' && P.y < m.headY - m.hr * 0.25) return WHITE;
        if (low) return WHITE;
        return PALETTE.Charcoal;
      case 'Bicolour':
        if (partName === 'paw' || partName === 'muzzle' || partName === 'ruff') return WHITE;
        if (partName === 'leg' && P.y < m.legH * 0.55) return WHITE;
        if ((partName === 'chest' || partName === 'cheek') && P.y < m.bodyY + m.bodyR * 0.5) return WHITE;
        if (P.y < m.bodyY - m.bodyR * 0.15 && partName !== 'tail' && partName !== 'tailTip') return WHITE;
        return base;
      case 'Points': {
        const point = PALETTE.Walnut;
        if (['ear', 'tuft', 'muzzle', 'paw', 'tailTip'].includes(partName)) return point;
        if (partName === 'cheek') return PALETTE.Cocoa; // the darker mask
        if (partName === 'leg') return P.y < m.legH * 0.6 ? point : PALETTE.Paper;
        if (partName === 'tail') return tailD > 0.08 ? point : PALETTE.Paper;
        return low ? PALETTE['Off white'] : PALETTE.Paper;
      }
      default: // Solid
        if (partName === 'paw' || partName === 'muzzle') return light;
        return base;
    }
  };
  const mat = vertexColorMaterial(style);
  root.updateMatrixWorld(true);
  const a = new THREE.Vector3(), b = new THREE.Vector3(), cc = new THREE.Vector3(), col = new THREE.Color();
  root.traverse((o) => {
    if (!o.isMesh || !o.userData.part) return;
    const g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone();
    const posA = g.attributes.position, n = posA.count;
    const colours = new Float32Array(n * 3);
    for (let i = 0; i < n; i += 3) {
      // the face's centre in cat space decides its colour
      a.fromBufferAttribute(posA, i).applyMatrix4(o.matrixWorld);
      b.fromBufferAttribute(posA, i + 1).applyMatrix4(o.matrixWorld);
      cc.fromBufferAttribute(posA, i + 2).applyMatrix4(o.matrixWorld);
      const P = a.add(b).add(cc).multiplyScalar(1 / 3);
      col.setHex(colourOf(o.userData.part, P));
      for (let k = 0; k < 3; k++) colours.set([col.r, col.g, col.b], (i + k) * 3);
    }
    g.setAttribute('color', new THREE.BufferAttribute(colours, 3));
    o.geometry = g;
    o.material = mat;
  });
}
