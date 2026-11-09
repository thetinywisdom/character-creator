import * as THREE from 'three';
import { ellipsoid } from '../../lib/shapes.js';
import { vertexColorMaterial } from '../../lib/skin.js';
import { PALETTE, snapColor } from '../../styles/palette.js';

// A cat, standing on all fours. Faces +z (head at +z, tail at -z).
// Joints for the walk, run and poses (anim/catGait.js): legFL, legFR, legBL,
// legBR, head, tail.
//
// Built like a low-poly cat model, not from blobs: the torso and neck are
// ONE lofted shape (rings along the spine: narrow rump, haunches, a tucked
// waist, a deep chest, shoulders, neck), the head another (back of the
// skull, wide cheeks, a short muzzle; no eyes or face), tall triangle ears,
// long slim legs (the back ones bent at the hock) and a tail that hangs back
// and lifts at the tip. Flat-shaded faces, like the reference.
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

export const cat = {
  id: 'cat',
  label: 'Cat',
  isCharacter: true,
  // drawn 1.5x real size so it reads from across a street (style guide §5)
  exaggeration: 1.5,
  schema: {
    bodyLength: { value: 0.34, min: 0.22, max: 0.6,  step: 0.01, label: 'Body length (m)' },
    chubbiness: { value: 1,    min: 0.7,  max: 1.6,  step: 0.01, label: 'Chubbiness' },
    legLength:  { value: 0.13, min: 0.08, max: 0.24, step: 0.005, label: 'Leg length (m)' },
    headSize:   { value: 1.05, min: 0.7,  max: 1.5,  step: 0.01, label: 'Head size' },
    earSize:    { value: 1,    min: 0.5,  max: 1.8,  step: 0.01, label: 'Ear size' },
    tailLength: { value: 0.34, min: 0.1,  max: 0.5,  step: 0.01, label: 'Tail length (m)' },
    tailUp:     { value: 0.3,  min: 0,    max: 1,    step: 0.01, label: 'Tail raise' },
    tailCurl:   { value: 0.35, min: 0,    max: 1,    step: 0.01, label: 'Tail curl' },
    furColor:   { value: 'Ginger', options: Object.keys(CAT_FUR), label: 'Fur colour' },
    pattern:    { value: 'Solid', options: CAT_PATTERNS, label: 'Pattern' },
    tailType:   { value: 'Long', options: CAT_TAILS, label: 'Tail' },
    earType:    { value: 'Pointed', options: CAT_EARS, label: 'Ears' },
    coat:       { value: 'Short', options: CAT_COATS, label: 'Coat' },
  },
  presets: {
    Housecat: { bodyLength: 0.34, chubbiness: 1.05, legLength: 0.13, headSize: 1.05, earSize: 1,   tailLength: 0.3 },
    Kitten:   { bodyLength: 0.28, chubbiness: 0.95, legLength: 0.09, headSize: 1.3,  earSize: 1.25, tailLength: 0.2 },
    Chonk:    { bodyLength: 0.45, chubbiness: 1.55, legLength: 0.1,  headSize: 1.05, earSize: 0.8, tailLength: 0.26 },
    Lanky:    { bodyLength: 0.5,  chubbiness: 0.8,  legLength: 0.19, headSize: 0.95, earSize: 1.35, tailLength: 0.42 },
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
    const fluff = p.coat === 'Long' ? 1.15 : 1;
    const part = (mesh, name) => { mesh.userData.part = name; return mesh; };
    const M = style.material('fur', 0xffffff); // replaced by the painted coat at the end

    const L = p.bodyLength, c = p.chubbiness, legLen = p.legLength, hs = p.headSize;
    const g = 0.085 * c * fluff;                // girth: a little round
    const yc = legLen + g * 0.95;               // the torso's centre line

    // --- torso + neck: one lofted shape [z (× L), y offset, half width, half height]
    const torso = [
      [-0.5, 0.012, 0.5, 0.55],   // rump
      [-0.42, 0.02, 1.0, 1.02],   // round haunches, the back highest here
      [-0.25, 0.014, 0.96, 0.96],
      [-0.05, 0.01, 0.9, 0.88],   // a soft waist (round reads cute)
      [0.14, -0.004, 0.98, 1.02],
      [0.3, -0.014, 1.04, 1.14],  // a deep chest
      [0.42, 0.004, 0.86, 1.0],   // shoulders
      [0.49, 0.035, 0.74, 0.82],  // base of the neck
      [0.545, 0.07, 0.64, 0.66],  // a short, thick neck
    ].map(([z, y, w, h]) => [z * L, yc + y, w * g, h * g]);
    root.add(part(new THREE.Mesh(loft(torso, 10), M), 'body'));
    const neck = torso[torso.length - 1];

    // --- head: big, round and upright, a small muzzle at the front (cute) --
    const R = 0.058 * hs; // skull radius
    const head = new THREE.Group();
    head.name = 'head';
    head.position.set(0, neck[1] + R * 0.95, neck[0] + R * 0.45); // sits high on the neck
    root.add(head);
    // a round skull: rings along z on a sphere, a touch wider than tall
    const skull = [];
    for (let k = 0; k <= 6; k++) {
      const t = -0.92 + (1.84 * k) / 6, r = Math.sqrt(1 - t * t);
      skull.push([t * R * 0.95, 0, r * R * 1.08 * fluff ** 0.3, r * R]);
    }
    head.add(part(new THREE.Mesh(loft(skull, 10), M), 'head'));
    // the muzzle: a small soft block in front, low on the face
    const muzzle = [
      [0, -R * 0.36, R * 0.42, R * 0.3],
      [R * 0.22, -R * 0.4, R * 0.36, R * 0.24],
      [R * 0.32, -R * 0.44, R * 0.22, R * 0.15],
    ];
    const mz = part(new THREE.Mesh(loft(muzzle, 8, 0), M), 'muzzle');
    mz.position.z = R * 0.68;
    head.add(mz);
    if (fluff > 1) root.add(part(ellipsoid(g * 0.95, [1.15, 0.85, 0.8], M, { position: [0, neck[1] - g * 0.35, neck[0] - g * 0.2], segments: 10 }), 'ruff'));

    // --- ears: tall triangles; tufted (a dark tip) or folded forward ----------
    for (const sx of [-1, 1]) {
      const folded = p.earType === 'Folded';
      const e = p.earSize * hs;
      const eh = (folded ? 0.5 : 0.85) * R * p.earSize, er_ = 0.62 * R * p.earSize; // big, wide triangles
      const ear = new THREE.Group();
      ear.position.set(sx * R * 0.55, R * 0.72, -R * 0.05); // upright at the top corners
      ear.rotation.set(folded ? 1.1 : -0.05, 0, -sx * 0.22);
      const outer = part(new THREE.Mesh(new THREE.ConeGeometry(er_, eh, 3), M), 'ear');
      outer.position.y = eh / 2;
      outer.rotation.y = Math.PI; // a flat face toward the front
      outer.scale.z = 0.5;
      const inner = part(new THREE.Mesh(new THREE.ConeGeometry(er_ * 0.62, eh * 0.75, 3), M), 'earInner');
      inner.position.set(0, eh * 0.4, er_ * 0.16);
      inner.rotation.y = Math.PI;
      inner.scale.z = 0.3;
      ear.add(outer, inner);
      if (p.earType === 'Tufted') {
        const tuft = part(new THREE.Mesh(new THREE.ConeGeometry(er_ * 0.2, eh * 0.4, 3), M), 'tuft');
        tuft.position.y = eh * 1.15;
        ear.add(tuft);
      }
      head.add(ear);
    }

    // --- legs: long and slim; each hangs from a joint at the top -----------
    const legR = 0.015 * Math.pow(c, 0.6) * (fluff > 1 ? 1.12 : 1); // slim legs
    const topY = yc - g * 0.25;
    const legH = topY; // pivot to the ground
    const legZ = { F: 0.37 * L, B: -0.4 * L };
    for (const [which, z] of Object.entries(legZ)) {
      for (const sx of [-1, 1]) {
        const leg = new THREE.Group();
        leg.name = `leg${which}${sx < 0 ? 'R' : 'L'}`;
        leg.position.set(sx * g * 0.52, topY, z);
        const foot = [0, -legH + legR * 0.5, which === 'F' ? 0.004 : -0.012];
        // the lower leg hangs from its own joint (low**: elbow in front, hock
        // behind), so poses can fold the legs instead of swinging them stiff
        const knee = which === 'F' ? [0, -legH * 0.45, -0.006] : [0, -legH * 0.58, -0.04 * (L / 0.42)];
        if (which === 'F') leg.add(part(taper([0, g * 0.2, 0], knee, legR * 1.35, legR, 6), 'leg'));
        else leg.add(part(taper([0, g * 0.25, 0.01], knee, legR * 1.75, legR * 0.95, 6), 'leg'));
        const low = new THREE.Group();
        low.name = `low${which}${sx < 0 ? 'R' : 'L'}`;
        low.position.set(...knee);
        const rel = (q) => [q[0] - knee[0], q[1] - knee[1], q[2] - knee[2]];
        low.add(part(taper([0, 0, 0], rel(foot), legR * (which === 'F' ? 1 : 0.95), legR * 0.78, 6), 'leg'));
        const paw = part(new THREE.Mesh(new THREE.BoxGeometry(legR * 1.7, legR * 0.85, legR * 2.3), M), 'paw');
        paw.position.set(...rel([0, -legH + legR * 0.42, foot[2] + legR * 0.45]));
        low.add(paw);
        leg.add(low);
        root.add(leg);
      }
    }

    // --- tail: hangs back from the rump and lifts at the tip; curled up over
    // the back; or a short bob
    const bob = p.tailType === 'Bobtail', curled = p.tailType === 'Curled';
    const tailLen = bob ? Math.min(0.06, p.tailLength) : p.tailLength;
    const tailR = 0.016 * Math.pow(c, 0.6) * (fluff > 1 ? 1.7 : 1);
    const n = bob ? 4 : 16;
    const segLen = tailLen / n;
    const up = curled ? 1 : p.tailUp, curl = curled ? 1 : p.tailCurl;
    const a0 = -1.15 + up * 2.2; // angle above horizontal, pointing back (default: hanging down-back)
    const pts = [new THREE.Vector3(0, torso[0][1] + g * 0.35, torso[0][0] + g * 0.15)];
    for (let i = 1; i <= n; i++) {
      const t = i / n;
      const a = a0 + curl * (curled ? 4.6 : 2.4) * t * t; // bends more toward the tip
      pts.push(pts[i - 1].clone().add(new THREE.Vector3(0, Math.sin(a), -Math.cos(a)).multiplyScalar(segLen)));
    }
    const tail = new THREE.Group();
    tail.name = 'tail';
    tail.position.copy(pts[0]);
    const local = pts.map((q) => q.clone().sub(pts[0]));
    for (let i = 0; i < n; i++) {
      const r0 = tailR * (1 - 0.55 * (i / n)), r1 = tailR * (1 - 0.55 * ((i + 1) / n));
      tail.add(part(taper(local[i].toArray(), local[i + 1].toArray(), r0, r1, 6), i === n - 1 ? 'tailTip' : 'tail'));
    }
    if (bob) tail.add(part(ellipsoid(tailR * 2.2, [1, 1, 1], M, { position: local[n].toArray(), segments: 8 }), 'tail'));
    root.add(tail);

    // measurements the poses and the coat need
    root.userData.cat = { legH, topY, bodyY: yc, bodyR: g, L, hr: R };
    root.updateMatrixWorld(true);
    paintCoat(root, p, style, {
      bodyY: yc, bodyR: g, zf: 0.22 * L, legH, headY: head.position.y, hr: R,
      muzzleZ: head.position.z + R * 0.9, tailBase: pts[0],
    });
    return root;
  },
};

/**
 * A lofted shape: elliptical rings [z, y, half width, half height] joined
 * along z, closed at both ends. Few sides, so it reads faceted.
 */
function loft(stations0, sides = 10, between = 2) {
  // in-between rings (smoothly interpolated) so coat patterns paint in bands
  const stations = [];
  for (let i = 0; i < stations0.length - 1; i++) {
    const p0 = stations0[Math.max(0, i - 1)], p1 = stations0[i], p2 = stations0[i + 1], p3 = stations0[Math.min(stations0.length - 1, i + 2)];
    for (let k = 0; k <= between; k++) {
      const t = k / (between + 1);
      stations.push(p1.map((_, j) => 0.5 * (2 * p1[j] + (-p0[j] + p2[j]) * t + (2 * p0[j] - 5 * p1[j] + 4 * p2[j] - p3[j]) * t * t + (-p0[j] + 3 * p1[j] - 3 * p2[j] + p3[j]) * t * t * t)));
    }
  }
  stations.push(stations0[stations0.length - 1]);
  const pos = [], idx = [];
  for (const [z, y, w, h] of stations) {
    for (let k = 0; k < sides; k++) {
      const a = (k / sides) * Math.PI * 2;
      // a slightly flatter underside, like a real belly
      const sy = Math.sin(a);
      pos.push(Math.cos(a) * w, y + sy * h * (sy < 0 ? 0.92 : 1), z);
    }
  }
  const ring = (i, k) => i * sides + (k % sides);
  for (let i = 0; i < stations.length - 1; i++) {
    for (let k = 0; k < sides; k++) {
      const a = ring(i, k), b = ring(i, k + 1), c = ring(i + 1, k), d = ring(i + 1, k + 1);
      idx.push(a, b, c, b, d, c); // wound so the faces point outward (inside-out showed the body see-through)
    }
  }
  // caps: a point just past each end
  const first = stations[0], last = stations[stations.length - 1];
  const s0 = pos.length / 3; pos.push(0, first[1], first[0] - first[3] * 0.4);
  const s1 = pos.length / 3; pos.push(0, last[1], last[0] + last[3] * 0.4);
  const lastRing = stations.length - 1;
  for (let k = 0; k < sides; k++) {
    idx.push(s0, ring(0, k + 1), ring(0, k));
    idx.push(s1, ring(lastRing, k), ring(lastRing, k + 1));
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  return geo;
}

/** A tapered limb from a to b (radius r0 to r1), with few sides. */
function taper(a, b, r0, r1, sides = 6) {
  const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b);
  const len = A.distanceTo(B) || 1e-4;
  const geo = new THREE.CylinderGeometry(r1, r0, len, sides, 1);
  const m = new THREE.Mesh(geo);
  m.position.copy(A).add(B).multiplyScalar(0.5);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), B.clone().sub(A).normalize());
  return m;
}

/**
 * Paint the coat: every face gets one palette colour from its part and where
 * it is (stripes, patches, white socks...), so patterns stay crisp and blocky.
 */
function paintCoat(root, p, style, m) {
  const base = CAT_FUR[p.furColor] ?? CAT_FUR.Ginger;
  const pat = p.pattern ?? 'Solid';
  const dark = darker(base), light = lighter(base);
  // calico patches: seeded round blobs along the back, one on the head, one on the tail
  const seedStr = `${p.furColor}${p.tailType}${p.earType}`;
  let sd = [...seedStr].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) >>> 0, 7);
  const rnd = () => ((sd = (sd * 16807) % 2147483647) / 2147483647);
  const patches = [];
  const zs = [m.tailBase.z + m.bodyR * 0.5, (m.tailBase.z + m.zf) / 2, m.zf];
  zs.forEach((z, i) => {
    const sx = rnd() < 0.5 ? -1 : 1;
    patches.push({ c: new THREE.Vector3(sx * m.bodyR * (0.3 + rnd() * 0.5), m.bodyY + m.bodyR * (0.5 + rnd() * 0.4), z + (rnd() - 0.5) * m.bodyR),
      r: m.bodyR * (1.0 + rnd() * 0.4), col: i % 2 ? PALETTE.Charcoal : PALETTE.Apricot });
  });
  patches.push({ c: new THREE.Vector3((rnd() - 0.5) * m.hr, m.headY + m.hr * 0.7, m.muzzleZ - m.hr * 1.2), r: m.hr * 0.9, col: rnd() < 0.5 ? PALETTE.Apricot : PALETTE.Charcoal });
  patches.push({ c: m.tailBase.clone().add(new THREE.Vector3(0, 0.02, -0.12)), r: 0.09, col: PALETTE.Charcoal });
  const colourOf = (partName0, P) => {
    // the torso and head are single shapes: find the chest, muzzle and cheeks by position
    let partName = partName0;
    if (partName === 'body' && P.z > m.zf) partName = 'chest';
    if (partName === 'head') partName = P.z > m.muzzleZ ? 'muzzle' : P.y < m.headY - m.hr * 0.2 ? 'cheek' : 'head';
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
        return Math.sin(P.z * 52) > 0.3 ? dark : base; // stripes follow the body's rings
      case 'Calico': {
        if (low || partName === 'paw' || partName === 'muzzle' || partName === 'chest' || partName === 'ruff') return WHITE;
        if (partName === 'leg' && P.y < m.legH * 0.7) return WHITE;
        // round patches (a few blobs on the back, head and tail), white elsewhere
        for (const q of patches) if (P.distanceTo(q.c) < q.r) return q.col;
        return WHITE;
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
    // colour whole quads (the two triangles of each square face together), so
    // pattern edges follow the rings and run straight or round, not zig-zag
    const step = n % 6 === 0 ? 6 : 3;
    for (let i = 0; i < n; i += step) {
      const P = new THREE.Vector3();
      for (let k = 0; k < step; k++) P.add(a.fromBufferAttribute(posA, i + k).applyMatrix4(o.matrixWorld));
      P.multiplyScalar(1 / step);
      col.setHex(colourOf(o.userData.part, P));
      for (let k = 0; k < step; k++) colours.set([col.r, col.g, col.b], (i + k) * 3);
    }
    g.setAttribute('color', new THREE.BufferAttribute(colours, 3));
    g.computeVertexNormals(); // non-indexed: one normal per face, flat-shaded like the reference
    o.geometry = g;
    o.material = mat;
  });
}
