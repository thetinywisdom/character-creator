import * as THREE from 'three';
import { capsuleBetween, ellipsoid, seg, surfaceZ } from '../../lib/shapes.js';
import { azimuth, headShell, smooth } from './headShape.js';

// Head items: headwear, face accessories and facial hair. Built in head-local
// space (head centre at the origin, face toward +z). Everything is chunkier
// than real life on purpose so it still reads on a tiny character.

export const HEADWEAR = ['None', 'Cap', 'Cap (backwards)', 'Beanie', 'Fedora', 'Headphones', 'Helmet'];
export const FACE_ACCESSORIES = ['None', 'Glasses', 'Sunglasses', 'Flu mask'];
export const BEARDS = ['None', 'Short', 'Long', 'Goatee'];
export const MOUSTACHES = ['None', 'Classic', 'Handlebar', 'Thin'];

// Hats that cover the top of the head squash tall hairstyles underneath.
const COVERS_HAIR = new Set(['Cap', 'Cap (backwards)', 'Beanie', 'Fedora', 'Helmet']);
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
      const tilt = new THREE.Group();
      tilt.rotation.x = -0.25;
      // one clean rounded dome pulled down over the ears, with a small pom-pom
      const dome = new THREE.Mesh(new THREE.SphereGeometry(1, seg(24), seg(12, 5), 0, Math.PI * 2, 0, Math.PI * 0.6), material);
      dome.scale.set(rx * 1.15, ry * 1.1, rz * 1.17);
      const pom = ellipsoid(R * 0.17, [1, 1, 1], material, { position: [0, ry * 1.12, 0], segments: 10 });
      tilt.add(dome, pom);
      g.add(tilt);
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
      const tilt = new THREE.Group();
      tilt.rotation.x = -0.2;
      const dome = new THREE.Mesh(new THREE.SphereGeometry(1, seg(24), seg(12, 5), 0, Math.PI * 2, 0, Math.PI * 0.6), material);
      dome.scale.set(rx * 1.27, ry * 1.22, rz * 1.27);
      // a dark visor just in front of the dome's lower front edge
      const visor = brim(R * 0.5, R * 0.09, f.mats.band);
      visor.position.set(0, R * 0.02, rz * 1.12);
      visor.rotation.x = -0.1;
      tilt.add(dome, visor);
      g.add(tilt);
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
export function buildFacialHair(f, beard, moustache, material) {
  const g = new THREE.Group();
  g.name = 'facialHair';
  const { R, rx, ry, rz } = f;

  if (beard === 'Short' || beard === 'Long') {
    // jaw and chin, from ear to ear, grown from the head shape (fuller at the chin)
    g.add(new THREE.Mesh(headShell(f,
      (d) => Math.abs(azimuth(d)) < 1.75 && d.y < -0.2,
      (d) => R * 0.04 + R * 0.06 * smooth(-0.25, -0.85, d.y)), material));
  }
  if (beard === 'Long') {
    const hang = new THREE.Mesh(new THREE.ConeGeometry(R * 0.44, R * 0.9, seg(8, 5)), material);
    hang.rotation.x = Math.PI - 0.2; // tip down, slightly forward
    hang.scale.z = 0.6;
    hang.position.set(0, -ry * 1.1, rz * 0.45);
    g.add(hang);
  }
  if (beard === 'Goatee') {
    const y = -ry * 0.8;
    g.add(ellipsoid(R * 0.3, [1, 1.35, 0.85], material, { position: [0, y, surfaceZ(0, y, rx, ry, rz) + R * 0.06], segments: 10 }));
  }

  if (moustache !== 'None' && moustache) {
    const y = -R * 0.36;
    const z = surfaceZ(0, y, rx, ry, rz) + R * 0.06;
    const thin = moustache === 'Thin';
    // oversized so it reads at a distance (style guide)
    g.add(ellipsoid(R * 0.3, [1.7, thin ? 0.32 : 0.55, 0.65], material, { position: [0, y, z], segments: 10 }));
    if (moustache === 'Handlebar') {
      for (const sx of [-1, 1]) {
        const tip = new THREE.Mesh(new THREE.ConeGeometry(R * 0.09, R * 0.38, seg(6, 4)), material);
        tip.position.set(sx * R * 0.5, y + R * 0.1, z - R * 0.08);
        tip.rotation.z = -sx * 0.7; // curls up and out
        g.add(tip);
      }
    }
  }
  return g;
}
