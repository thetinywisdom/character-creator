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
    : [[start, HIP, mats.legwear], [HIP, 1, mats.top]];
  for (const [a, b, m] of bands) torso.add(band(f, a * L, b * L, m));


  if (spec.collar) {
    // a chunky collar ring in the shirt's own colour, and a row of small
    // round buttons down the front (a dark strip read as a tie)
    const collar = new THREE.Mesh(
      new THREE.TorusGeometry(f.neckR * 1.55, f.neckR * 0.6, seg(6), seg(14)),
      mats.top,
    );
    collar.rotation.x = Math.PI / 2;
    collar.scale.y = 0.8;
    collar.position.y = f.shoulderY - L * 0.02;
    torso.add(collar);
    // buttons sit on the shirt front, each facing out along the surface
    const surf = torsoSurface(f);
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
