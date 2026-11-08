import * as THREE from 'three';
import { capsuleBetween, ellipsoid, seg } from '../../lib/shapes.js';
import { aboveHairline, azimuth, headShell, shapeHead, smooth } from './headShape.js';

// Head items: headwear, face accessories and facial hair. Built in head-local
// space (head centre at the origin, face toward +z). Everything is chunkier
// than real life on purpose so it still reads on a tiny character.

export const HEADWEAR = ['None', 'Cap', 'Cap (backwards)', 'Beanie', 'Fedora', 'Headphones', 'Helmet', 'Straw hat', 'Flat cap', 'Police cap'];
export const FACE_ACCESSORIES = ['None', 'Glasses', 'Sunglasses'];
export const MASKS = ['None', 'Flu mask'];
export const BEARDS = ['None', 'Stubble', 'Short', 'Full', 'Long', 'Goatee', 'Pointed goatee', 'Chin strap', 'Mutton chops'];
export const MOUSTACHES = ['None', 'Classic', 'Thin', 'Handlebar', 'Walrus', 'Horseshoe'];

// Hats that cover the top of the head squash tall hairstyles underneath.
const COVERS_HAIR = new Set(['Cap', 'Cap (backwards)', 'Beanie', 'Fedora', 'Helmet', 'Straw hat', 'Flat cap', 'Police cap']);
const UNDER_HAT = { bald: 'bald', short: 'short', medium: 'medium', long: 'long', bun: 'short',
  spiky: 'short', mohawk: 'bald', curly: 'short', afro: 'short',
  'short · buzz cut': 'short · buzz cut', 'short · undercut': 'short · buzz cut',
  'medium · bob': 'medium · bob', 'medium · curtains': 'medium',
  'long · ponytail': 'long · ponytail', 'long · high ponytail': 'long · ponytail',
  'long · twin tails': 'long · twin tails', 'long · braid': 'long · braid' };
// Other variations fall back to their family's basic cut under a hat.
const FAMILY = (hair) => (hair.startsWith('short') ? 'short' : hair.startsWith('medium') ? 'medium' : hair.startsWith('long') ? 'long' : 'short');

export const coversHair = (headwear) => COVERS_HAIR.has(headwear);

/** The hairstyle actually drawn, given the headwear. */
export function hairUnder(headwear, hair) {
  return COVERS_HAIR.has(headwear) ? (UNDER_HAT[hair] ?? FAMILY(hair)) : hair;
}

/** Half disc sticking out toward +z: cap brims and visors. */
function brim(radius, thickness, material) {
  return new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, thickness, seg(14, 6), 1, false, -Math.PI / 2, Math.PI),
    material,
  );
}

// ---------------------------------------------------------------------------
export function buildHeadwear(f, kind, material, hair) {
  const g = new THREE.Group();
  g.name = 'headwear';
  const { R, rx, ry, rz } = f;
  switch (kind) {
    case 'Cap':
    case 'Cap (backwards)': {
      const crown = new THREE.Mesh(new THREE.SphereGeometry(1, seg(24), seg(10, 4), 0, Math.PI * 2, 0, Math.PI / 2), material);
      crown.scale.set(rx * 1.15, ry * 1.0, rz * 1.17);
      crown.position.y = R * 0.1;
      const b = brim(R * 0.72, R * 0.08, material);
      b.position.set(0, R * 0.12, rz * 0.72);
      b.scale.z = 1.15;
      b.rotation.x = 0.15; // dips slightly at the front
      g.add(crown, b);
      if (kind === 'Cap (backwards)') g.rotation.y = Math.PI;
      break;
    }
    case 'Beanie': {
      // Knit hat grown from the head shape: pulled down to the brow, over the
      // ears and to the nape, a thicker folded cuff at the edge, a little
      // slouch on top and a pom-pom.
      const line = [0.36, 0.14, -0.16, -0.55];
      const thick = (d) => {
        const a = aboveHairline(d, line);
        const lip = 0.4 + 0.6 * smooth(0, 0.03, a);     // rounded edge
        const cuff = 1 - smooth(0.2, 0.23, a);          // folded band
        const slouch = smooth(0.5, 1, d.y) * (0.6 + 0.4 * smooth(0.3, -0.6, d.z)); // a bit baggy toward the back
        return R * lip * (0.06 + 0.06 * cuff) + R * 0.04 * slouch;
      };
      const above = (d) => aboveHairline(d, line);
      g.add(new THREE.Mesh(headShell(f, (d) => above(d) > 0, thick, above), material));
      const top = shapeHead(0, 1, 0)[1] * ry + thick(new THREE.Vector3(0, 1, 0));
      g.add(ellipsoid(R * 0.24, [1, 0.85, 1], material, { position: [0, top + R * 0.2, -R * 0.04], segments: 10 }));
      break;
    }
    case 'Fedora': {
      const hat = new THREE.Group();
      hat.position.y = R * 0.4;
      hat.rotation.x = -0.08;
      const b = new THREE.Mesh(new THREE.CylinderGeometry(rx * 2.0, rx * 2.0, R * 0.06, seg(20)), material);
      const crown = new THREE.Mesh(new THREE.CylinderGeometry(rx * 0.88, rx * 1.06, R * 0.8, seg(16)), material);
      crown.position.y = R * 0.4;
      crown.scale.z = rz / rx;
      // dark band where the crown meets the brim
      const band = new THREE.Mesh(new THREE.CylinderGeometry(rx * 1.08, rx * 1.08, R * 0.16, seg(16)), f.mats.band);
      band.position.y = R * 0.1;
      band.scale.z = rz / rx;
      hat.add(b, crown, band);
      g.add(hat);
      break;
    }
    case 'Straw hat': {
      // a wide, flat brim and a low round crown with a red band (麦わら帽子)
      const hat = new THREE.Group();
      hat.position.y = R * 0.42;
      hat.rotation.x = -0.06;
      const b = new THREE.Mesh(new THREE.CylinderGeometry(rx * 2.5, rx * 2.6, R * 0.05, seg(20)), material);
      const crown = new THREE.Mesh(new THREE.SphereGeometry(1, seg(16), seg(8, 4), 0, Math.PI * 2, 0, Math.PI / 2), material);
      crown.scale.set(rx * 1.05, R * 0.62, rz * 1.05);
      const band = new THREE.Mesh(new THREE.CylinderGeometry(rx * 1.07, rx * 1.09, R * 0.16, seg(16)), f.mats.sailorScarf);
      band.position.y = R * 0.1;
      band.scale.z = rz / rx;
      hat.add(b, crown, band);
      g.add(hat);
      break;
    }
    case 'Flat cap': {
      // a soft, flat cap sloping down to a short brim (an older man's hat)
      const crown = new THREE.Mesh(new THREE.SphereGeometry(1, seg(20), seg(10, 4), 0, Math.PI * 2, 0, Math.PI / 2), material);
      crown.scale.set(rx * 1.16, ry * 0.62, rz * 1.22);
      crown.position.set(0, R * 0.2, rz * 0.06);
      crown.rotation.x = 0.12;
      const b = brim(R * 0.55, R * 0.06, material);
      b.position.set(0, R * 0.16, rz * 0.82);
      b.scale.z = 0.7;
      b.rotation.x = 0.2;
      g.add(crown, b);
      break;
    }
    case 'Police cap': {
      // a peaked cap: a stiff round top wider than the band, a black peak,
      // a dark band and a gold badge at the front
      const cap = new THREE.Group();
      cap.position.y = R * 0.32;
      const band = new THREE.Mesh(new THREE.CylinderGeometry(rx * 1.08, rx * 1.08, R * 0.32, seg(16)), f.mats.band);
      band.scale.z = rz / rx;
      const top = new THREE.Mesh(new THREE.CylinderGeometry(rx * 1.32, rx * 1.1, R * 0.26, seg(16)), material);
      top.position.y = R * 0.28;
      top.scale.z = rz / rx;
      const peak = brim(R * 0.62, R * 0.05, f.mats.band);
      peak.position.set(0, -R * 0.12, rz * 0.95);
      peak.scale.z = 0.75;
      peak.rotation.x = 0.35;
      const badge = new THREE.Mesh(new THREE.CylinderGeometry(R * 0.12, R * 0.12, R * 0.04, seg(8, 6)), f.mats.gold);
      badge.rotation.x = Math.PI / 2;
      badge.position.set(0, R * 0.2, rz * 1.18);
      cap.add(band, top, peak, badge);
      g.add(cap);
      break;
    }
    case 'Headphones': {
      // big hair (afro) pushes the band further out
      const r = Math.max(rx, ry) * (hair === 'afro' ? 1.6 : hair === 'curly' || hair === 'spiky' || hair === 'mohawk' ? 1.35 : 1.2);
      const band = new THREE.Mesh(new THREE.TorusGeometry(r, R * 0.09, seg(6, 4), seg(18, 8), Math.PI), material);
      g.add(band);
      for (const sx of [-1, 1]) {
        const cup = new THREE.Mesh(new THREE.CylinderGeometry(R * 0.36, R * 0.36, R * 0.24, seg(12, 6)), material);
        cup.rotation.z = Math.PI / 2;
        cup.position.set(sx * r, -R * 0.05, 0);
        g.add(cup);
      }
      break;
    }
    case 'Helmet': {
      // Bicycle helmet: an open shell grown from the head shape, sitting on
      // the forehead and above the ears (the face stays open), ribbed on top
      // with dark vents, a short peak and chin straps.
      const line = [0.5, 0.3, 0.02, -0.28];
      const ridge = (d) => smooth(-0.3, 0.3, Math.cos(d.x * Math.PI * 3.2)) * smooth(0.35, 0.7, d.y);
      const base = (d) => {
        const a = aboveHairline(d, line);
        // rounded lip, thicker crown, a slight tail at the back
        return R * (0.06 + smooth(0, 0.08, a) * (0.11 + 0.05 * smooth(-0.2, -0.85, d.z) * smooth(-0.3, 0.2, d.y)));
      };
      const above = (d) => aboveHairline(d, line);
      const inside = (d) => above(d) > 0;
      g.add(new THREE.Mesh(headShell(f, inside, (d) => base(d) + R * 0.06 * ridge(d), above), material));
      // vents: the floor of the grooves between the ribs, in a dark colour
      g.add(new THREE.Mesh(headShell(f,
        (d) => inside(d) && d.y > 0.5 && ridge(d) < 0.12 && Math.abs(d.x) < 0.75 && aboveHairline(d, line) > 0.12,
        (d) => base(d) + R * 0.012), f.mats.band));
      // peak over the forehead
      const y0 = line[0] + 0.03;
      const [, py, pz] = shapeHead(0, y0, Math.sqrt(1 - y0 * y0));
      const peak = brim(R * 0.45, R * 0.07, material);
      peak.position.set(0, py * ry + R * 0.03, pz * rz);
      peak.scale.z = 0.85;
      peak.rotation.x = 0.25;
      g.add(peak);
      // straps from in front of the ears, down under the chin
      const chin = [0, -ry * 0.98, rz * 0.32];
      for (const sx of [-1, 1]) {
        const dx = sx * Math.sin(1.45), dz = Math.cos(1.45);
        const [ex, ey, ez] = shapeHead(dx * 0.995, 0.1, dz * 0.995);
        g.add(capsuleBetween([ex * rx * 1.04, ey * ry, ez * rz * 1.04], chin, R * 0.025, f.mats.band, 6));
      }
      break;
    }
    default:
      break;
  }
  return g;
}

// ---------------------------------------------------------------------------
export function buildFaceAccessory(f, kind, mats) {
  const g = new THREE.Group();
  g.name = 'faceAccessory';
  const { R, rx, ry, rz } = f;
  if (kind === 'Glasses' || kind === 'Sunglasses') {
    const ex = rx * 0.38, ey = -R * 0.05;
    const zf = rz * 1.02 + R * 0.05; // all in one plane, just in front of the face
    const lensR = R * (kind === 'Sunglasses' ? 0.24 : 0.2);
    for (const sx of [-1, 1]) {
      if (kind === 'Sunglasses') {
        const lens = new THREE.Mesh(new THREE.CylinderGeometry(lensR, lensR, R * 0.06, seg(12, 8)), mats.lens);
        lens.rotation.x = Math.PI / 2;
        lens.position.set(sx * ex, ey, zf);
        g.add(lens);
      } else {
        const ring = new THREE.Mesh(new THREE.TorusGeometry(lensR, R * 0.045, seg(6, 4), seg(12, 8)), mats.frame);
        ring.position.set(sx * ex, ey, zf);
        g.add(ring);
      }
      // arm back to the ear
      g.add(capsuleBetween([sx * (ex + lensR), ey, zf], [sx * rx * 1.02, ey, -rz * 0.1], R * 0.035, mats.frame, 6));
    }
    const bridge = new THREE.Mesh(new THREE.BoxGeometry(ex * 2 - lensR * 1.6, R * 0.06, R * 0.06), mats.frame);
    bridge.position.set(0, ey + R * 0.02, zf);
    g.add(bridge);
  } else if (kind === 'Flu mask') {
    // a patch over the lower face, from below the nose to the chin, grown
    // from the head shape so it sits on the jaw
    g.add(new THREE.Mesh(headShell(f,
      (d) => Math.abs(azimuth(d)) < 1.05 && d.y < -0.02 && d.y > -0.8,
      () => R * 0.05), mats.mask));
    for (const sx of [-1, 1]) {
      // ear loops
      g.add(capsuleBetween([sx * rx * 0.85, -R * 0.1, rz * 0.5], [sx * rx * 1.02, -R * 0.05, -rz * 0.05], R * 0.03, mats.mask, 6));
    }
  }
  return g;
}

// ---------------------------------------------------------------------------
/**
 * A patch of facial hair grown from the head shape.
 *  inside(d) -> how far inside the patch d is (radians-ish, <= 0 = outside)
 *  thick(d)  -> thickness in metres; it fades to nothing over `edge` at the
 *               border so the hair blends into the skin.
 */
function facePatch(f, material, inside, thick, edge = 0.06) {
  return new THREE.Mesh(headShell(f, (d) => inside(d) > 0,
    (d) => thick(d) * smooth(0, edge, inside(d))), material);
}

// Regions on the head (d on the unit sphere, +z face, d.y -1 chin .. 1 crown).
// Each returns a "distance inside" so patches can share soft edges.
const absAz = (d) => Math.abs(azimuth(d));
const band = (v, lo, hi) => Math.min(v - lo, hi - v);
// the jaw from ear to ear: up to `top` on the cheeks, but only below the
// lower lip at the front (no mouth is drawn, so a beard over it reads as a mask)
const jaw = (top = -0.2) => (d) => {
  const t = top + (-0.56 - top) * smooth(0.75, 0.25, absAz(d));
  return Math.min(1.78 - absAz(d), t - d.y);
};
const chinPatch = (w, top) => (d) => Math.min(w - absAz(d), top - d.y, d.z + 0.2);
const lip = (w, lo, hi) => (d) => Math.min(w - absAz(d), band(d.y, lo, hi), d.z);
const chinBulge = (d, depth) => depth * smooth(-0.5, -0.95, d.y) * smooth(-0.3, 0.6, d.z);

export function buildFacialHair(f, beard, moustache, material, stubbleMaterial = material) {
  const g = new THREE.Group();
  g.name = 'facialHair';
  const { R } = f;
  const add = (...a) => g.add(facePatch(f, material, ...a));

  switch (beard) {
    case 'Stubble':
      // a thin shadow over the jaw and cheeks, in a colour between skin and
      // hair (like hair seen through the skin), so it reads as stubble
      g.add(facePatch(f, stubbleMaterial, jaw(-0.3), () => R * 0.012, 0.06));
      break;
    case 'Short':
      add(jaw(-0.36), (d) => R * 0.04 + chinBulge(d, R * 0.05));
      break;
    case 'Full':
      // up the cheeks, bushy, a rounded chin
      add(jaw(-0.25), (d) => R * 0.07 + R * 0.03 * smooth(-0.3, -0.6, d.y) + chinBulge(d, R * 0.12), 0.1);
      break;
    case 'Long':
      // full beard whose chin hangs well down onto the chest
      add(jaw(-0.25), (d) => R * 0.07 + R * 0.03 * smooth(-0.3, -0.6, d.y)
        + R * 0.9 * smooth(-0.55, -0.95, d.y) * smooth(-0.2, 0.5, d.z) * smooth(1.2, 0.2, absAz(d)), 0.1);
      break;
    case 'Goatee':
      add(chinPatch(0.5, -0.5), (d) => R * 0.05 + chinBulge(d, R * 0.07));
      break;
    case 'Pointed goatee':
      // narrow, coming to a point below the chin
      add(chinPatch(0.38, -0.55), (d) => R * 0.04
        + R * 0.3 * smooth(-0.7, -1, d.y) * smooth(0.35, 0, absAz(d)) * smooth(-0.2, 0.5, d.z), 0.05);
      break;
    case 'Chin strap':
      // a narrow line along the jaw from ear to ear
      add((d) => Math.min(jaw(-0.36)(d), Math.max(absAz(d) - 1.45, -0.62 - d.y)),
        () => R * 0.045, 0.04);
      break;
    case 'Mutton chops':
      // big sideburns down the cheeks, the chin left bare
      add((d) => Math.min(band(absAz(d), 0.75, 1.78), band(d.y, -0.72, 0.05)),
        (d) => R * 0.08 + R * 0.04 * smooth(-0.1, -0.5, d.y), 0.08);
      break;
    default:
      break;
  }

  // Moustaches sit on the upper lip (about d.y -0.42 .. -0.28 at the front)
  switch (moustache) {
    case 'Classic':
      add(lip(0.58, -0.47, -0.26), (d) => R * 0.08 * smooth(0.6, 0.15, absAz(d)) + R * 0.025, 0.05);
      break;
    case 'Thin':
      add(lip(0.5, -0.42, -0.29), () => R * 0.04, 0.03);
      break;
    case 'Handlebar': {
      // a full moustache over the lip, then each end narrows and curls up the
      // cheek: a chain of shrinking beads laid on the face surface
      add(lip(0.55, -0.46, -0.27), (d) => R * 0.075 * smooth(0.6, 0.2, absAz(d)) + R * 0.025, 0.04);
      const curl = [[0.48, -0.4, 0.065], [0.58, -0.4, 0.058], [0.68, -0.36, 0.05], [0.75, -0.29, 0.042], [0.77, -0.21, 0.034]];
      const onFace = (az, y, out) => {
        const h = Math.sqrt(1 - y * y);
        const [x, Y, z] = shapeHead(Math.sin(az) * h, y, Math.cos(az) * h);
        const n = new THREE.Vector3(x * f.rx, Y * f.ry, z * f.rz);
        return n.addScaledVector(n.clone().normalize(), out).toArray();
      };
      for (const sx of [-1, 1]) {
        for (let i = 0; i < curl.length - 1; i++) {
          const [a0, y0, r0] = curl[i], [a1, y1, r1] = curl[i + 1];
          g.add(capsuleBetween(onFace(sx * a0, y0, R * r0), onFace(sx * a1, y1, R * r1), R * (r0 + r1) * 0.5, material, 6));
        }
      }
      break;
    }
    case 'Walrus':
      // bushy, drooping over the mouth
      add(lip(0.62, -0.56, -0.24), (d) => R * 0.1 + R * 0.04 * smooth(-0.3, -0.5, d.y), 0.06);
      break;
    case 'Horseshoe':
      // over the lip and straight down both sides of the mouth to the jaw
      add((d) => Math.max(lip(0.55, -0.43, -0.28)(d),
        Math.min(band(absAz(d), 0.36, 0.62), band(d.y, -0.88, -0.3), d.z)), () => R * 0.065, 0.04);
      break;
    default:
      break;
  }
  return g;
}
