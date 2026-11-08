import * as THREE from 'three';
import { seg } from '../../lib/shapes.js';
import { sculptTorso } from './sculpt.js';

// Tops: the torso is built from horizontal bands (fractions of torso height),
// each in its own material. That's how a crop top shows a strip of skin.
// A tank top is a clean sleeveless body: the bare arms are what make it read.
// Small details (shirt collars and plackets) are deliberately oversized so
// they still read when the character is tiny (style guide).

export const TOPS = {
  'T-shirt':                { sleeve: 'short' },
  'T-shirt (long sleeve)':  { sleeve: 'long' },
  'Shirt':                  { sleeve: 'short', collar: true },
  'Shirt (long sleeve)':    { sleeve: 'long', collar: true },
  'Tank top':               { sleeve: 'none' },
  'Crop top':               { sleeve: 'short', crop: true },
  'Crop top (long sleeve)': { sleeve: 'long', crop: true },
  // school uniforms and a summer robe
  'Sailor uniform':         { sleeve: 'long', sailor: true },
  'Gakuran':                { sleeve: 'long', gakuran: true },
  'Yukata':                 { sleeve: 'wide', yukata: true },
};

/** One horizontal slice of the torso, from y0 to y1 (torso-local metres). */
export function band(f, y0, y1, material, { inflate = 0, gap = 0 } = {}) {
  const L = f.torsoLen;
  const shell = inflate > 0; // an outer layer (jacket, hoodie): open, slightly bigger
  const r = (y) => f.torsoR(y) + inflate;
  const pts = [];
  if (!shell && y0 <= f.torsoBottom) pts.push(new THREE.Vector2(0, y0));
  pts.push(new THREE.Vector2(r(y0), y0));
  for (const q of f.torsoSamples) if (q.y > y0 && q.y < y1) pts.push(new THREE.Vector2(q.x + inflate, q.y));
  pts.push(new THREE.Vector2(r(y1), y1));
  if (!shell && y1 >= L) pts.push(new THREE.Vector2(0, L));
  // A gap leaves the front open (centred on +z). Without one, phiStart = π/2
  // puts the lathe seam at the side, away from the sculpted zones.
  const lathe = gap > 0
    ? new THREE.LatheGeometry(pts, f.torsoRadial, gap / 2, Math.PI * 2 - gap)
    : new THREE.LatheGeometry(pts, f.torsoRadial, Math.PI / 2);
  // sculpt (in round-lathe space, assuming the base depth), then flatten each
  // height by its own depth so the torso gets shallower toward the shoulders
  const geo = sculptTorso(lathe, f);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) pos.setZ(i, pos.getZ(i) * f.depthAt(pos.getY(i)));
  geo.computeVertexNormals();
  const mesh = new THREE.Mesh(geo, material);
  mesh.position.y = f.hipY;
  return mesh;
}

/** The collar band: a thin wall round the neck, open at the front (open = 0: closed). */
function collarBand(f, material, { open = 0.9, height = Math.min(f.neckR * 0.65, 0.032), taper = 0.55 } = {}) {
  const rIn = f.neckR * 1.08, rOut = f.neckR * 1.22, h = height; // thick necks get no taller band
  const profile = [[rIn, 0], [rOut, 0], [rOut, h], [rIn, h * 0.9], [rIn, 0]].map(([x, y]) => new THREE.Vector2(x, y));
  const geo = open > 0
    ? new THREE.LatheGeometry(profile, seg(16, 10), open / 2, Math.PI * 2 - open)
    : new THREE.LatheGeometry(profile, seg(16, 10));
  // tallest at the back, lower toward the throat where it turns into the flaps
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const front = Math.max(0, Math.cos(Math.atan2(pos.getX(i), pos.getZ(i)))); // 1 at the front
    pos.setY(i, pos.getY(i) * (1 - taper * front));
  }
  geo.computeVertexNormals();
  const band = new THREE.Mesh(geo, material);
  band.position.y = f.shoulderY - f.torsoLen * 0.02;
  band.scale.z = 0.95;
  return band;
}

/**
 * One collar flap: a thin triangle laid on the chest, from the side of the
 * neck down to a point, its inner edge running to the throat.
 */
function collarFlap(f, surf, sx, material) {
  const L = f.torsoLen;
  const pts = [
    [sx * f.neckR * 1.2, L * 0.985], // at the band, beside the neck
    [sx * (f.neckR * 1.15 + f.sw * 0.07), L * 0.82], // the point, down and out
    [sx * f.neckR * 0.25, L * 0.92], // inner corner, near the throat
  ];
  // lifted where it folds over at the neck, lying flat at the point; thick
  // enough to cast an edge, since it is the same colour as the shirt
  const lift = [f.neckR * 0.55, f.neckR * 0.2, f.neckR * 0.45];
  const lo = pts.map(([x, y], i) => [x, f.hipY + y, surf.front(x, y) + 0.003 + lift[i] * 0.4]);
  const hi = pts.map(([x, y], i) => [x, f.hipY + y, surf.front(x, y) + 0.003 + lift[i]]);
  const pos = [];
  const tri = (a, b, c) => pos.push(...a, ...b, ...c);
  const flip = sx < 0;
  if (flip) { tri(hi[0], hi[2], hi[1]); tri(lo[0], lo[1], lo[2]); } else { tri(hi[0], hi[1], hi[2]); tri(lo[0], lo[2], lo[1]); }
  for (let i = 0; i < 3; i++) {
    const j = (i + 1) % 3;
    if (flip) { tri(lo[i], hi[j], hi[i]); tri(lo[i], lo[j], hi[j]); } else { tri(lo[i], hi[i], hi[j]); tri(lo[i], hi[j], lo[j]); }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.computeVertexNormals();
  return new THREE.Mesh(geo, material);
}

export function buildTorso(f, spec, mats) {
  const L = f.torsoLen;
  const torso = new THREE.Group();
  torso.name = 'torso';
  // [from, to, material] as fractions of the torso height
  // Every top stops at the hip line, so the waistband of the trousers or
  // skirt shows below it and the hip shape reads as body, not as a flared shirt.
  const HIP = 0.12;
  const start = f.torsoBottom / L; // 0, or below the hip line for women
  const bands = spec.crop
    ? [[start, 0.16, mats.legwear], [0.16, 0.5, mats.skin], [0.5, 1, mats.top]]
    : spec.yukata
      ? [[start, 1, mats.top]] // a robe: no trousers showing at the hips
      : [[start, HIP, mats.legwear], [HIP, 1, mats.top]];
  for (const [a, b, m] of bands) torso.add(band(f, a * L, b * L, m));


  if (spec.sailor) sailorDetails(f, torso, mats);
  if (spec.gakuran) gakuranDetails(f, torso, mats);
  if (spec.yukata) yukataDetails(f, torso, mats);

  if (spec.collar) {
    // a shirt collar in the shirt's own colour: a thin band standing round
    // the back and sides of the neck, open at the throat, and two pointed
    // flaps folded down onto the chest (a plain ring read as a dog collar)
    const surf = torsoSurface(f);
    torso.add(collarBand(f, mats.top));
    for (const sx of [-1, 1]) torso.add(collarFlap(f, surf, sx, mats.top));
    // buttons sit on the shirt front, each facing out along the surface
    const r = f.sw * 0.03; // oversized so they still read when tiny
    const disc = new THREE.CylinderGeometry(r, r, r * 0.5, seg(10, 6));
    const up = new THREE.Vector3(0, 1, 0), n = new THREE.Vector3();
    const count = 5;
    for (let i = 0; i < count; i++) {
      const y = THREE.MathUtils.lerp(0.22, 0.84, i / (count - 1)) * L;
      const dy = L * 0.02;
      const slope = (surf.front(0, y + dy) - surf.front(0, y - dy)) / (2 * dy);
      n.set(0, -slope, 1).normalize();
      const b = new THREE.Mesh(disc, mats.accent);
      b.quaternion.setFromUnitVectors(up, n);
      b.position.set(0, f.hipY + y, surf.front(0, y)).addScaledVector(n, r * 0.15);
      torso.add(b);
    }
  }
  return torso;
}

// ---------------------------------------------------------------------------
// Uniform and robe details, laid on the torso surface

/** A strip on the front (dir 1) or back (dir -1) through points [x, y] (torso-local). */
function surfaceStrip(f, pts, w, t, material, dir = 1, steps = 10) {
  const surf = torsoSurface(f);
  const samples = [];
  for (let k = 0; k < pts.length - 1; k++) {
    for (let i = 0; i <= steps; i++) {
      if (k > 0 && i === 0) continue;
      const u = i / steps;
      const x = pts[k][0] + (pts[k + 1][0] - pts[k][0]) * u;
      const y = pts[k][1] + (pts[k + 1][1] - pts[k][1]) * u;
      const z = dir > 0 ? surf.front(x, y) - 0.002 : surf.back(x, y) + 0.002;
      samples.push({ x, y: f.hipY + y, z, w });
    }
  }
  return ribbon(samples, t, material, dir);
}

const NAVY = 0x2c3652;

/** Sailor uniform (セーラー服): a big navy collar on the back, navy V lapels, a red bow. */
function sailorDetails(f, torso, mats) {
  const L = f.torsoLen;
  const collar = mats.sailorCollar;
  // the square flap on the back
  torso.add(surfaceStrip(f, [[0, L * 0.985], [0, L * 0.66]], f.sw * 0.62, f.neckR * 0.12, collar, -1));
  // white trim line across its bottom edge
  torso.add(surfaceStrip(f, [[0, L * 0.69], [0, L * 0.675]], f.sw * 0.6, f.neckR * 0.16, mats.sailorTrim, -1, 2));
  // the V on the front: from each shoulder down to the bow
  for (const sx of [-1, 1]) {
    torso.add(surfaceStrip(f, [[sx * f.sw * 0.2, L * 0.97], [sx * f.sw * 0.04, L * 0.7]], f.sw * 0.11, f.neckR * 0.12, collar, 1));
  }
  // the scarf bow where the V meets
  const surf = torsoSurface(f);
  const y = L * 0.69, z = surf.front(0, y) + f.neckR * 0.2;
  for (const sx of [-1, 1]) {
    const wing = new THREE.Mesh(new THREE.ConeGeometry(f.sw * 0.07, f.sw * 0.14, 3), mats.sailorScarf);
    wing.rotation.z = sx * Math.PI / 2;
    wing.scale.z = 0.4;
    wing.position.set(sx * f.sw * 0.07, f.hipY + y, z);
    torso.add(wing);
  }
  torso.add(surfaceStrip(f, [[0, L * 0.68], [0, L * 0.52]], f.sw * 0.07, f.neckR * 0.18, mats.sailorScarf, 1, 4)); // tails
}

/** Gakuran (学ラン): a closed stand-up collar and a row of gold buttons. */
function gakuranDetails(f, torso, mats) {
  const L = f.torsoLen;
  torso.add(collarBand(f, mats.top, { open: 0.12, height: Math.min(f.neckR * 0.9, 0.04), taper: 0 }));
  const surf = torsoSurface(f);
  const r = f.sw * 0.034;
  const disc = new THREE.CylinderGeometry(r, r, r * 0.6, seg(10, 6));
  const up = new THREE.Vector3(0, 1, 0), n = new THREE.Vector3();
  for (let i = 0; i < 5; i++) {
    const y = THREE.MathUtils.lerp(0.2, 0.86, i / 4) * L;
    const dy = L * 0.02;
    n.set(0, -(surf.front(0, y + dy) - surf.front(0, y - dy)) / (2 * dy), 1).normalize();
    const b = new THREE.Mesh(disc, mats.gold);
    b.quaternion.setFromUnitVectors(up, n);
    b.position.set(0, f.hipY + y, surf.front(0, y)).addScaledVector(n, r * 0.2);
    torso.add(b);
  }
}

/**
 * Yukata (浴衣): the front crosses left over right (the edge runs from the
 * neck down to the wearer's right side) with a contrasting collar band along
 * it, and a wide obi sash round the waist.
 */
function yukataDetails(f, torso, mats) {
  const L = f.torsoLen;
  // the top panel's edge (wearer's right = -x), and the bit of the under panel at the neck
  torso.add(surfaceStrip(f, [[f.neckR * 0.9, L * 0.99], [-f.hw * 0.32, L * 0.44]], f.sw * 0.08, f.neckR * 0.1, mats.accent, 1, 14));
  torso.add(surfaceStrip(f, [[-f.neckR * 0.9, L * 0.99], [-f.neckR * 0.1, L * 0.8]], f.sw * 0.07, f.neckR * 0.06, mats.accent, 1, 6));
  // obi: a wide band round the waist, a little proud of the robe, with a bow at the back
  torso.add(band(f, L * 0.28, L * 0.47, mats.obi, { inflate: f.sw * 0.02 }));
  const surf = torsoSurface(f);
  const bow = new THREE.Mesh(new THREE.BoxGeometry(f.sw * 0.42, L * 0.14, f.sw * 0.1), mats.obi);
  bow.position.set(0, f.hipY + L * 0.4, surf.back(0, L * 0.4) - f.sw * 0.07);
  torso.add(bow);
}

// ---------------------------------------------------------------------------
/**
 * The real (sculpted) torso surface, for anything that has to sit on it:
 * plackets, ties, straps, packs. Measured by casting rays at the same torso
 * the tops are made of, so chest, back and hips are all taken into account.
 *   front(x, y) / back(x, y): z of the surface at torso-local height y
 *   frontMax(y0, y1, x): the furthest-forward point over a height range
 *     (what hangs or rests on the chest touches only there)
 *   backMin(y0, y1, x): likewise for the back
 */
export function torsoSurface(f) {
  if (f._surface) return f._surface;
  const mesh = band(f, f.torsoBottom, f.torsoLen, new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }));
  mesh.position.y = 0; // torso-local heights
  mesh.updateMatrixWorld(true);
  const rc = new THREE.Raycaster();
  const o = new THREE.Vector3(), dir = new THREE.Vector3();
  const cast = (x, y, s) => {
    const yy = Math.min(f.torsoLen * 0.995, Math.max(f.torsoBottom + 1e-3, y));
    rc.set(o.set(x, yy, s * 2), dir.set(0, 0, -s));
    const hit = rc.intersectObject(mesh)[0];
    if (hit) return hit.point.z;
    return s * f.torsoR(yy) * f.depthAt(yy) * Math.sqrt(Math.max(0, 1 - (x / f.torsoR(yy)) ** 2));
  };
  const front = (x, y) => cast(x, y, 1);
  const back = (x, y) => cast(x, y, -1);
  const range = (y0, y1, fn, pick) => {
    let v = fn(y0);
    for (let i = 1; i <= 12; i++) v = pick(v, fn(y0 + ((y1 - y0) * i) / 12));
    return v;
  };
  f._surface = {
    front, back,
    frontMax: (y0, y1, x = 0) => range(y0, y1, (y) => front(x, y), Math.max),
    backMin: (y0, y1, x = 0) => range(y0, y1, (y) => back(x, y), Math.min),
  };
  return f._surface;
}

/**
 * A flat ribbon (placket, tie blade, strap) lofted through samples
 * {x, y, z, w} — centre and width — with thickness t, built out from z
 * toward +z (or -z with dir = -1). Heights are torso-local.
 */
export function ribbon(samples, t, material, dir = 1) {
  // faces are wound for samples running top to bottom
  if (samples.length > 1 && samples[0].y < samples.at(-1).y) samples = [...samples].reverse();
  const pos = [];
  const quad = (a, b, c, d) => pos.push(...a, ...b, ...c, ...a, ...c, ...d);
  const corners = samples.map(({ x = 0, y, z, w }) => [
    [x - w / 2, y, z], [x + w / 2, y, z], [x + w / 2, y, z + dir * t], [x - w / 2, y, z + dir * t]]);
  for (let i = 0; i < corners.length - 1; i++) {
    const [a, b] = [corners[i], corners[i + 1]];
    for (let k = 0; k < 4; k++) {
      const k2 = (k + 1) % 4;
      if (dir > 0) quad(a[k], a[k2], b[k2], b[k]); else quad(a[k], b[k], b[k2], a[k2]);
    }
  }
  const cap = (c, flip) => (flip ? quad(c[0], c[1], c[2], c[3]) : quad(c[0], c[3], c[2], c[1]));
  cap(corners[0], dir > 0);
  cap(corners.at(-1), dir < 0);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.computeVertexNormals();
  return new THREE.Mesh(geo, material);
}
