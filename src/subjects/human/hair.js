import * as THREE from 'three';
import { capsuleBetween, ellipsoid, seg, taperBetween } from '../../lib/shapes.js';

// Hairstyles. Everything is built in head-local space (head centre at the
// origin, face toward +z). Shapes are chunky on purpose: hair is one of the
// main ways to tell tiny characters apart.

export const SHORT_STYLES = ['short', 'short · side part', 'short · buzz cut', 'short · undercut', 'short · quiff', 'short · bowl cut', 'short · messy'];
export const MEDIUM_STYLES = ['medium', 'medium · bob', 'medium · curtains', 'medium · wavy', 'medium · shag', 'medium · half-up'];
export const LONG_STYLES = ['long', 'long · ponytail', 'long · high ponytail', 'long · twin tails', 'long · braid', 'long · wavy', 'long · side-swept'];
export const HAIRSTYLES = ['bald', ...SHORT_STYLES, ...MEDIUM_STYLES, ...LONG_STYLES, 'bun', 'spiky', 'mohawk', 'curly', 'afro'];

const UP = new THREE.Vector3(0, 1, 0);

/**
 * The basic hair cap: covers the top and back of the head, shows the forehead.
 * It has more sides than the head (at least 16) so its flat faces never dip
 * inside the head's corners: that showed as skin-coloured flecks.
 * tilt: more negative raises the hairline at the front.
 */
function cap(f, material, puff = 1.08, tilt = -0.45) {
  const m = new THREE.Mesh(
    new THREE.SphereGeometry(1, seg(32, 16), seg(16, 8), 0, Math.PI * 2, 0, Math.PI * 0.58),
    material,
  );
  m.scale.set(f.rx * puff, f.ry * puff, f.rz * (puff + 0.02));
  m.rotation.x = tilt;
  return m;
}

/** Part of a sphere round the head. phi/theta as in THREE.SphereGeometry (front is phi = π/2). */
function shell(f, material, puff, { frontGap = 0, thetaLength = Math.PI * 0.6, tilt = 0 } = {}) {
  const phiStart = Math.PI / 2 + frontGap / 2;
  const m = new THREE.Mesh(
    new THREE.SphereGeometry(1, seg(28), seg(14), phiStart, Math.PI * 2 - frontGap, 0, thetaLength),
    material,
  );
  m.scale.set(f.rx * puff, f.ry * puff, f.rz * puff);
  m.rotation.x = tilt;
  return m;
}

/** A strand / tail of hair through points, tapering from r0 to r1. */
function strand(points, r0, r1, material) {
  const g = new THREE.Group();
  for (let i = 0; i < points.length - 1; i++) {
    const a = THREE.MathUtils.lerp(r0, r1, i / (points.length - 1));
    const b = THREE.MathUtils.lerp(r0, r1, (i + 1) / (points.length - 1));
    g.add(taperBetween(points[i], points[i + 1], a, b, material, 8));
  }
  return g;
}

/** How far back hair must hang to clear the upper back, at head-local height y. */
function backZ(f, y) {
  const ty = y + f.headY - f.hipY; // torso-local height
  const torsoBack = ty < f.torsoLen ? f.torsoR(Math.max(0, ty)) * f.torsoDepth : 0;
  // generous clearance: the shirt, the sculpted upper back and the spine lean all add depth
  return -Math.max(f.rz * 1.0, torsoBack + f.R * 0.45);
}

/** Hair hanging down the back, ending at `endY` (head-local). */
function backPanel(f, material, endY, width = 1.2) {
  const back = capsuleBetween([0, -f.R * 0.1, -f.rz * 0.4], [0, endY, -f.rz * 0.5], f.R * 0.78, material);
  back.scale.set(width, 1, 0.55);
  return back;
}

/** underHat: a hat covers the top, so the hair cap hugs the scalp to stay hidden under it. */
export function buildHair(f, style, material, { underHat = false } = {}) {
  const g = new THREE.Group();
  g.name = 'hair';
  const { R, rx, ry, rz } = f;
  const shoulder = f.shoulderY - f.headY; // head-local y of the shoulders
  // tight caps keep a little room: PS1 vertex snapping lets the scalp poke
  // through hair that sits right on the head
  const capPuff = underHat ? 1.04 : 1.08;
  // Variations sit on a slimmer cap close to the head, so the shapes that
  // define each cut (fringe, quiff, tufts...) stand out instead of sinking
  // into a puffy base.
  const slim = underHat ? 1.04 : 1.045;
  // cuts defined by a fringe sit on a cap with a higher hairline, so the
  // fringe itself forms the front edge of the hair
  const high = -0.72;

  switch (style) {
    case 'bald':
      break;
    case 'short':
      g.add(cap(f, material, capPuff));
      break;
    case 'medium': // to the shoulders
      g.add(cap(f, material, capPuff), backPanel(f, material, shoulder + R * 0.2));
      break;
    case 'long': // down the back
      g.add(cap(f, material, capPuff), backPanel(f, material, shoulder - f.torsoLen * 0.45, 1.35));
      break;
    // --- short variations -------------------------------------------------
    case 'short · side part': {
      const c = cap(f, material, slim, high);
      c.rotation.z = -0.14; // hairline lower on one side
      g.add(c);
      // a thick fringe swept over to one side, rising above the cap
      g.add(ellipsoid(1, [rx * 0.72, R * 0.3, rz * 0.55], material, { position: [rx * 0.28, R * 0.66, rz * 0.48], rotation: [0.2, 0, -0.38], segments: 14 }));
      break;
    }
    case 'short · buzz cut':
      g.add(cap(f, material, 1.04, -0.62)); // tight, with the hairline set back
      break;
    case 'short · undercut':
      // shaved sides, volume on top
      g.add(cap(f, material, 1.04));
      g.add(ellipsoid(1, [rx * 0.86, R * 0.42, rz * 1.0], material, { position: [0, R * 0.8, rz * 0.06], segments: 16 }));
      break;
    case 'short · quiff':
      g.add(cap(f, material, slim));
      // a tall swoop of hair lifted up and forward at the front
      g.add(ellipsoid(1, [rx * 0.76, R * 0.44, rz * 0.62], material, { position: [0, R * 0.92, rz * 0.36], rotation: [-0.6, 0, 0], segments: 16 }));
      break;
    case 'short · bowl cut':
      // an even, rounded cap with straight bangs all the way round
      // (no cap: the bowl is the whole shape, with bangs low on the forehead)
      g.add(shell(f, material, underHat ? 1.03 : 1.14, { thetaLength: Math.PI * 0.6, tilt: 0 }));
      break;
    case 'short · messy': {
      g.add(cap(f, material, slim, high));
      // chunky tufts sticking out in all directions, including a ragged fringe
      const tufts = [[0.2, 0.3], [1.3, 0.55], [2.4, 0.35], [3.5, 0.6], [4.6, 0.4], [5.6, 0.62], [0.9, 0.85], [3.0, 0.9],
        [-0.35, 1.0], [0.35, 1.0], [0, 0.9], [2.0, 1.0], [-2.0, 1.0]];
      for (const [phi, tilt] of tufts) {
        const dir = new THREE.Vector3(Math.sin(tilt) * Math.sin(phi), Math.cos(tilt), Math.sin(tilt) * Math.cos(phi));
        if (dir.z > 0.75) continue;
        const t = new THREE.Mesh(new THREE.ConeGeometry(R * 0.27, R * 0.52, seg(6, 4)), material);
        t.position.set(dir.x * rx, dir.y * ry, dir.z * rz).multiplyScalar(1.03);
        t.quaternion.setFromUnitVectors(UP, dir.clone().add(new THREE.Vector3(0.25, 0, 0)).normalize());
        g.add(t);
      }
      break;
    }

    // --- medium variations ------------------------------------------------
    case 'medium · bob':
      // rounded, chin-length all round, open at the face
      g.add(cap(f, material, slim));
      g.add(shell(f, material, underHat ? 1.06 : 1.16, { frontGap: 1.7, thetaLength: Math.PI * 0.72 }));
      break;
    case 'medium · curtains':
      // middle part, two curtains framing the face, length to the shoulders
      const c = cap(f, material, slim, high);
      g.add(c, backPanel(f, material, shoulder + R * 0.2));
      for (const sx of [-1, 1]) {
        // each curtain sweeps from the parting down past the cheek
        g.add(ellipsoid(1, [rx * 0.36, R * 0.3, rz * 0.4], material, { position: [sx * rx * 0.42, R * 0.58, rz * 0.5], rotation: [0.3, 0, sx * 0.5], segments: 12 }));
        g.add(ellipsoid(1, [rx * 0.3, R * 0.68, rz * 0.32], material, { position: [sx * rx * 0.7, -R * 0.08, rz * 0.55], rotation: [0, 0, sx * 0.15], segments: 12 }));
      }
      break;
    case 'medium · wavy': {
      g.add(cap(f, material, slim));
      // waves: blobs stepping down the sides and back, alternating outward
      const end = shoulder + R * 0.2;
      for (let k = 0; k < 4; k++) {
        const y = THREE.MathUtils.lerp(-R * 0.1, end, k / 3);
        const out = k % 2 ? 1.12 : 0.98;
        for (const sx of [-1, 1]) g.add(ellipsoid(R * 0.36, [1, 1.1, 1], material, { position: [sx * rx * out, y, -rz * 0.15], segments: 10 }));
        g.add(ellipsoid(R * 0.5, [1.3, 1, 0.7], material, { position: [(k % 2 ? 0.1 : -0.1) * rx, y, -rz * (0.75 + 0.1 * (k % 2))], segments: 10 }));
      }
      break;
    }
    case 'medium · shag': {
      g.add(cap(f, material, underHat ? 1.03 : 1.13), backPanel(f, material, shoulder + R * 0.5, 1.1));
      // layered flicks round the sides and back
      for (let i = 0; i < 9; i++) {
        const a = -2.4 + i * 0.6; // angle round the head, 0 = back
        const dir = new THREE.Vector3(Math.sin(a), -0.7, -Math.cos(a)).normalize();
        const t = new THREE.Mesh(new THREE.ConeGeometry(R * 0.2, R * 0.55, seg(6, 4)), material);
        t.position.set(Math.sin(a) * rx * 1.02, -R * 0.35, -Math.cos(a) * rz * 1.02);
        t.quaternion.setFromUnitVectors(UP, dir);
        g.add(t);
      }
      break;
    }
    case 'medium · half-up':
      g.add(cap(f, material, slim), backPanel(f, material, shoulder + R * 0.2));
      g.add(ellipsoid(R * 0.36, [1, 1, 1], material, { position: [0, R * 0.62, -rz * 0.9], segments: 10 }));
      break;

    // --- long variations ---------------------------------------------------
    case 'long · ponytail':
    case 'long · high ponytail': {
      g.add(cap(f, material, slim));
      const high = style === 'long · high ponytail';
      const y0 = high ? R * 0.7 : R * 0.05;
      const z0 = high ? -rz * 0.85 : -rz * 1.02;
      const tie = new THREE.Mesh(new THREE.TorusGeometry(R * 0.14, R * 0.05, seg(4, 3), seg(10, 6)), f.mats.band);
      tie.position.set(0, y0, z0 - R * 0.04);
      tie.rotation.x = high ? -0.9 : -0.2;
      g.add(tie);
      const endY = shoulder - f.torsoLen * 0.3;
      g.add(strand([
        [0, y0, z0 - R * 0.08],
        [0, y0 - R * (high ? 0.1 : 0.5), z0 - R * (high ? 0.45 : 0.3)],
        [0, (y0 + endY) / 2 - R * 0.3, backZ(f, (y0 + endY) / 2) - R * 0.12],
        [0, endY, backZ(f, endY) - R * 0.05],
      ], R * 0.32, R * 0.12, material));
      break;
    }
    case 'long · twin tails': {
      g.add(cap(f, material, slim));
      for (const sx of [-1, 1]) {
        const y0 = R * 0.25;
        g.add(ellipsoid(R * 0.13, [1, 1, 1], f.mats.band, { position: [sx * rx * 0.98, y0, -rz * 0.25], segments: 8 }));
        g.add(strand([
          [sx * rx * 1.02, y0, -rz * 0.3],
          [sx * rx * 1.4, -R * 0.4, -rz * 0.45],
          [sx * rx * 1.45, shoulder + R * 0.1, -rz * 0.4],
        ], R * 0.22, R * 0.08, material));
      }
      break;
    }
    case 'long · braid': {
      g.add(cap(f, material, slim), backPanel(f, material, -R * 0.75, 0.9));
      // a single braid of alternating lobes down the back
      const endY = shoulder - f.torsoLen * 0.4;
      // a continuous core with overlapping, alternating lobes on top of it
      const core = [];
      for (let k = 0; k <= 4; k++) {
        const y = THREE.MathUtils.lerp(-R * 0.7, endY, k / 4);
        core.push([0, y, backZ(f, y) - R * 0.05]);
      }
      g.add(strand(core, R * 0.17, R * 0.1, material));
      const n = 11;
      for (let i = 0; i < n; i++) {
        const y = THREE.MathUtils.lerp(-R * 0.75, endY, i / (n - 1));
        const r = THREE.MathUtils.lerp(R * 0.24, R * 0.15, i / (n - 1));
        g.add(ellipsoid(r, [1, 1.3, 0.85], material, { position: [(i % 2 ? 0.4 : -0.4) * r, y, backZ(f, y) - R * 0.1], rotation: [0, 0, i % 2 ? 0.45 : -0.45], segments: 8 }));
      }
      g.add(ellipsoid(R * 0.09, [1, 1, 1], f.mats.band, { position: [0, endY - R * 0.15, backZ(f, endY) - R * 0.05], segments: 6 }));
      break;
    }
    case 'long · wavy': {
      g.add(cap(f, material, slim), backPanel(f, material, shoulder - f.torsoLen * 0.2, 1.3));
      const end = shoulder - f.torsoLen * 0.18; // waves stop where the back panel ends
      for (let k = 0; k < 6; k++) {
        const y = THREE.MathUtils.lerp(-R * 0.1, end, k / 5);
        const out = k % 2 ? 1.15 : 1.0;
        for (const sx of [-1, 1]) {
          g.add(ellipsoid(R * 0.34, [1, 1.15, 1], material, { position: [sx * rx * out, y, Math.min(-rz * 0.2, backZ(f, y) * 0.35)], segments: 10 }));
        }
      }
      break;
    }
    case 'long · side-swept':
      g.add(cap(f, material, slim, high), backPanel(f, material, shoulder - f.torsoLen * 0.45, 1.35));
      // a big fringe swept across the forehead, falling down one side
      g.add(ellipsoid(1, [rx * 0.9, R * 0.3, rz * 0.45], material, { position: [rx * 0.2, R * 0.5, rz * 0.66], rotation: [0.2, 0, -0.45], segments: 14 }));
      g.add(ellipsoid(1, [rx * 0.3, R * 0.85, rz * 0.32], material, { position: [rx * 0.82, -R * 0.2, rz * 0.35] }));
      break;

    case 'bun':
      g.add(cap(f, material), ellipsoid(R * 0.4, [1, 1, 1], material, { position: [0, R * 0.8, -R * 0.55] }));
      break;
    case 'spiky': {
      g.add(cap(f, material));
      const n = 11;
      for (let i = 0; i < n; i++) {
        const phi = (i / n) * Math.PI * 2;
        const tilt = 0.35 + (i % 2) * 0.4;
        const dir = new THREE.Vector3(Math.sin(tilt) * Math.sin(phi), Math.cos(tilt), Math.sin(tilt) * Math.cos(phi));
        if (dir.z > 0.45) continue; // keep spikes off the face
        const spike = new THREE.Mesh(new THREE.ConeGeometry(R * 0.28, R * 0.8, seg(10)), material);
        spike.position.set(dir.x * rx, dir.y * ry, dir.z * rz).multiplyScalar(1.02);
        spike.quaternion.setFromUnitVectors(UP, dir);
        g.add(spike);
      }
      break;
    }
    case 'mohawk': {
      // a tall crest of flat fins from forehead to the back of the head
      const n = 7;
      for (let i = 0; i < n; i++) {
        const a = THREE.MathUtils.lerp(0.55, -1.7, i / (n - 1)); // angle from the top, + = front
        const dir = new THREE.Vector3(0, Math.cos(a), Math.sin(a));
        // oversized so it still reads from the front at street distance
        const fin = new THREE.Mesh(new THREE.ConeGeometry(R * 0.34, R * 1.25, 4), material);
        fin.scale.set(0.6, 1, 1);
        fin.position.set(0, dir.y * ry, dir.z * rz).multiplyScalar(1.0);
        fin.quaternion.setFromUnitVectors(UP, dir);
        g.add(fin);
      }
      break;
    }
    case 'curly': {
      // cap covered in round curls (golden-spiral spacing)
      g.add(cap(f, material, 1.1));
      const n = 24;
      for (let i = 0; i < n; i++) {
        const t = (i + 0.5) / n;
        const polar = Math.acos(1 - t * 1.25);
        const phi = i * 2.39996;
        const dir = new THREE.Vector3(Math.sin(polar) * Math.cos(phi), Math.cos(polar), Math.sin(polar) * Math.sin(phi));
        if (dir.z > 0.3 && dir.y < 0.6) continue; // keep the face clear
        g.add(ellipsoid(R * 0.27, [1, 1, 1], material, {
          position: [dir.x * rx * 1.08, dir.y * ry * 1.08, dir.z * rz * 1.08],
          segments: 12,
        }));
      }
      break;
    }
    case 'afro':
      // a big round volume that sits behind the face
      g.add(ellipsoid(R * 1.45, [1.05, 0.95, 1], material, { position: [0, R * 0.4, -R * 0.55] }));
      break;
    default:
      g.add(cap(f, material));
  }
  return g;
}
