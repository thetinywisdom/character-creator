import * as THREE from 'three';
import { capsuleBetween, ellipsoid, seg, taperBetween } from '../../lib/shapes.js';
import { aboveHairline, azimuth, headShell, smooth } from './headShape.js';

// Hairstyles. Everything is built in head-local space (head centre at the
// origin, face toward +z). Shapes are chunky on purpose: hair is one of the
// main ways to tell tiny characters apart.
//
// There is no shared base cap: each style grows its own hair from the head
// shape (see headShape.js) with its own hairline and its own thickness map,
// tapering to the scalp at the hairline. Extra pieces (tails, buns, braids,
// curtains, tufts) are added on top.

export const SHORT_STYLES = ['short', 'short · side part', 'short · buzz cut', 'short · undercut', 'short · quiff', 'short · bowl cut', 'short · messy'];
export const MEDIUM_STYLES = ['medium', 'medium · bob', 'medium · curtains', 'medium · wavy', 'medium · shag', 'medium · half-up'];
export const LONG_STYLES = ['long', 'long · ponytail', 'long · high ponytail', 'long · twin tails', 'long · braid', 'long · wavy', 'long · side-swept'];
export const HAIRSTYLES = ['bald', ...SHORT_STYLES, ...MEDIUM_STYLES, ...LONG_STYLES, 'bun', 'spiky', 'mohawk', 'curly', 'afro'];

const UP = new THREE.Vector3(0, 1, 0);

const gauss = (x, w) => Math.exp(-((x / w) ** 2));

/**
 * Hair grown from the scalp. line = hairline [front, temple, side, back]
 * heights; thick(d) = hair thickness in metres at direction d; asym lowers
 * the hairline on one side. The thickness fades to (almost) nothing over
 * `edge` above the hairline, so the hair blends into the scalp.
 */
function scalp(f, material, { line, thick, asym = 0, edge = 0.16, underHat = false }) {
  const geo = headShell(f,
    (d) => aboveHairline(d, line, asym) > 0,
    (d) => {
      let t = thick(d) * smooth(0, edge, aboveHairline(d, line, asym));
      if (underHat) t = Math.min(t, f.R * 0.03);
      return Math.max(t, f.R * 0.02);
    });
  return new THREE.Mesh(geo, material);
}

// hairlines: [front, temple, side (over the ear), back (nape)] as heights on the head
const CROP = [0.42, 0.12, -0.12, -0.5];
const MED = [0.42, 0.1, -0.62, -0.78];
const PULLED = [0.42, 0.14, -0.05, -0.55]; // pulled back (ponytails, braid)

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
  const crop = (extra = () => 0) => scalp(f, material, { line: CROP, underHat,
    thick: (d) => R * 0.12 + R * 0.05 * Math.max(0, d.y) + extra(d) });
  const medium = (extra = () => 0, line = MED) => scalp(f, material, { line, underHat,
    thick: (d) => R * 0.13 + R * 0.04 * smooth(0, -0.6, d.y) + extra(d) });
  const pulled = () => scalp(f, material, { line: PULLED, underHat, thick: () => R * 0.1 });

  switch (style) {
    case 'bald':
      break;
    case 'short':
      g.add(crop());
      break;
    case 'medium': // to the shoulders
      g.add(medium(), backPanel(f, material, shoulder + R * 0.2));
      break;
    case 'long': // down the back
      g.add(medium(), backPanel(f, material, shoulder - f.torsoLen * 0.45, 1.35));
      break;

    // --- short variations -------------------------------------------------
    case 'short · side part':
      // parting on one side, a thick fringe swept across the forehead
      g.add(scalp(f, material, { line: [0.36, 0.1, -0.12, -0.5], asym: 0.22, underHat,
        thick: (d) => R * 0.11 + R * 0.26 * gauss(azimuth(d) - 0.35, 0.5) * gauss(d.y - 0.55, 0.25) }));
      break;
    case 'short · buzz cut':
      g.add(scalp(f, material, { line: [0.52, 0.22, -0.1, -0.45], underHat, thick: () => R * 0.04 }));
      break;
    case 'short · undercut':
      // shaved sides, a thick block on top
      g.add(scalp(f, material, { line: CROP, underHat, thick: (d) => R * 0.035 + R * 0.32 * smooth(0.38, 0.62, d.y) }));
      break;
    case 'short · quiff':
      // swept up and forward at the front
      g.add(crop((d) => R * 0.45 * gauss(azimuth(d), 0.6) * gauss(d.y - 0.62, 0.22)));
      break;
    case 'short · bowl cut':
      // even all round, with straight bangs low on the forehead (a crisp edge)
      g.add(scalp(f, material, { line: [0.1, -0.05, -0.25, -0.45], edge: 0.05, underHat, thick: () => R * 0.16 }));
      break;
    case 'short · messy': {
      g.add(crop());
      // chunky tufts sticking out in all directions, including a ragged fringe
      const tufts = [[0.2, 0.3], [1.3, 0.55], [2.4, 0.35], [3.5, 0.6], [4.6, 0.4], [5.6, 0.62], [0.9, 0.85], [3.0, 0.9],
        [-0.35, 1.0], [0.35, 1.0], [0, 0.9], [2.0, 1.0], [-2.0, 1.0]];
      for (const [phi, tilt] of tufts) {
        const dir = new THREE.Vector3(Math.sin(tilt) * Math.sin(phi), Math.cos(tilt), Math.sin(tilt) * Math.cos(phi));
        if (dir.z > 0.75) continue;
        const t = new THREE.Mesh(new THREE.ConeGeometry(R * 0.27, R * 0.52, seg(6, 4)), material);
        t.position.set(dir.x * rx, dir.y * ry, dir.z * rz).multiplyScalar(1.08);
        t.quaternion.setFromUnitVectors(UP, dir.clone().add(new THREE.Vector3(0.25, 0, 0)).normalize());
        g.add(t);
      }
      break;
    }

    // --- medium variations --------------------------------------------------
    case 'medium · bob':
      // a fringe, chin length all round, flaring a little at the bottom (crisp edge)
      g.add(scalp(f, material, { line: [0.2, 0.0, -0.72, -0.72], edge: 0.06, underHat,
        thick: (d) => R * 0.12 + R * 0.16 * smooth(0.1, -0.7, d.y) }));
      break;
    case 'medium · curtains':
      // Curtain bangs: parted high in the middle of the forehead, the hairline
      // sweeps down at both sides toward the cheekbones, with extra fullness
      // along those sweeps so they frame the face. All grown from the head.
      g.add(scalp(f, material, { line: [0.55, -0.12, -0.62, -0.78], edge: 0.1, underHat,
        thick: (d) => {
          const a = Math.abs(azimuth(d));
          return R * 0.13 + R * 0.04 * smooth(0, -0.6, d.y)
            + R * 0.16 * gauss(a - 0.62, 0.32) * gauss(d.y - 0.18, 0.32);
        } }), backPanel(f, material, shoulder + R * 0.2));
      break;
    case 'medium · wavy': {
      g.add(medium());
      const end = shoulder + R * 0.2;
      for (let k = 0; k < 4; k++) {
        const y = THREE.MathUtils.lerp(-R * 0.1, end, k / 3);
        const out = k % 2 ? 1.14 : 1.0;
        for (const sx of [-1, 1]) g.add(ellipsoid(R * 0.36, [1, 1.1, 1], material, { position: [sx * rx * out, y, -rz * 0.15], segments: 10 }));
        g.add(ellipsoid(R * 0.5, [1.3, 1, 0.7], material, { position: [(k % 2 ? 0.1 : -0.1) * rx, y, -rz * (0.8 + 0.1 * (k % 2))], segments: 10 }));
      }
      break;
    }
    case 'medium · shag': {
      // Shag: choppy layers stepping down the head, ragged tips pointing down
      // round the sides and back (never sticking out sideways or over the
      // face), and a wispy, choppy fringe.
      g.add(scalp(f, material, { line: [0.36, 0.0, -0.6, -0.75], edge: 0.1, underHat,
        thick: (d) => R * 0.15 + R * 0.06 * (0.5 + 0.5 * Math.cos(d.y * 13)) * smooth(0.45, 0, d.y) }),
      backPanel(f, material, shoulder + R * 0.45, 1.1));
      if (!underHat) {
        // ragged tips along the lower edge, sides and back only
        for (let i = 0; i < 9; i++) {
          const az = THREE.MathUtils.lerp(1.6, Math.PI * 2 - 1.6, i / 8); // behind the ears: skips the face
          const sx = Math.sin(az), sz = Math.cos(az);
          const y = -R * (0.55 + 0.12 * (i % 2));
          const t = new THREE.Mesh(new THREE.ConeGeometry(R * 0.16, R * 0.42, seg(5, 4)), material);
          t.position.set(sx * rx * 1.08, y, sz * rz * 1.08);
          t.rotation.x = Math.PI; // point down
          t.rotation.z = -sx * 0.25; // and a little outward
          g.add(t);
        }
        // wispy fringe: short pieces hanging over the forehead
        for (let i = 0; i < 5; i++) {
          const az = THREE.MathUtils.lerp(-0.55, 0.55, i / 4);
          const t = new THREE.Mesh(new THREE.ConeGeometry(R * 0.12, R * 0.34, seg(5, 4)), material);
          t.position.set(Math.sin(az) * rx * 0.95, R * (0.42 - 0.04 * (i % 2)), Math.cos(az) * rz * 1.0);
          t.rotation.x = Math.PI - 0.35; // hanging down, tips slightly forward
          g.add(t);
        }
      }
      break;
    }
    case 'medium · half-up':
      g.add(medium(), backPanel(f, material, shoulder + R * 0.2));
      g.add(ellipsoid(R * 0.36, [1, 1, 1], material, { position: [0, R * 0.62, -rz * 1.0], segments: 10 }));
      break;

    // --- long variations ----------------------------------------------------
    case 'long · ponytail':
    case 'long · high ponytail': {
      g.add(pulled());
      const high = style === 'long · high ponytail';
      const y0 = high ? R * 0.7 : R * 0.05;
      const z0 = high ? -rz * 0.95 : -rz * 1.12;
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
      g.add(pulled());
      for (const sx of [-1, 1]) {
        const y0 = R * 0.25;
        g.add(ellipsoid(R * 0.13, [1, 1, 1], f.mats.band, { position: [sx * rx * 1.0, y0, -rz * 0.25], segments: 8 }));
        g.add(strand([
          [sx * rx * 1.04, y0, -rz * 0.3],
          [sx * rx * 1.4, -R * 0.4, -rz * 0.45],
          [sx * rx * 1.45, shoulder + R * 0.1, -rz * 0.4],
        ], R * 0.22, R * 0.08, material));
      }
      break;
    }
    case 'long · braid': {
      g.add(pulled());
      const endY = shoulder - f.torsoLen * 0.4;
      const core = [];
      for (let k = 0; k <= 4; k++) {
        const y = THREE.MathUtils.lerp(-R * 0.5, endY, k / 4);
        core.push([0, y, backZ(f, y) - R * 0.05]);
      }
      g.add(strand(core, R * 0.17, R * 0.1, material));
      const n = 11;
      for (let i = 0; i < n; i++) {
        const y = THREE.MathUtils.lerp(-R * 0.55, endY, i / (n - 1));
        const r = THREE.MathUtils.lerp(R * 0.24, R * 0.15, i / (n - 1));
        g.add(ellipsoid(r, [1, 1.3, 0.85], material, { position: [(i % 2 ? 0.4 : -0.4) * r, y, backZ(f, y) - R * 0.1], rotation: [0, 0, i % 2 ? 0.45 : -0.45], segments: 8 }));
      }
      g.add(ellipsoid(R * 0.09, [1, 1, 1], f.mats.band, { position: [0, endY - R * 0.15, backZ(f, endY) - R * 0.05], segments: 6 }));
      break;
    }
    case 'long · wavy': {
      g.add(medium(), backPanel(f, material, shoulder - f.torsoLen * 0.2, 1.3));
      const end = shoulder - f.torsoLen * 0.18;
      for (let k = 0; k < 6; k++) {
        const y = THREE.MathUtils.lerp(-R * 0.1, end, k / 5);
        const out = k % 2 ? 1.17 : 1.03;
        for (const sx of [-1, 1]) {
          g.add(ellipsoid(R * 0.34, [1, 1.15, 1], material, { position: [sx * rx * out, y, Math.min(-rz * 0.2, backZ(f, y) * 0.35)], segments: 10 }));
        }
      }
      break;
    }
    case 'long · side-swept':
      // a big fringe swept across the forehead and down one side
      g.add(scalp(f, material, { line: [0.48, 0.1, -0.62, -0.78], asym: 0.3, underHat,
        thick: (d) => R * 0.13 + R * 0.3 * gauss(azimuth(d) - 0.3, 0.6) * gauss(d.y - 0.5, 0.3) }),
      backPanel(f, material, shoulder - f.torsoLen * 0.45, 1.35));
      g.add(ellipsoid(1, [rx * 0.3, R * 0.85, rz * 0.32], material, { position: [rx * 0.86, -R * 0.2, rz * 0.3] }));
      break;

    case 'bun':
      g.add(pulled(), ellipsoid(R * 0.4, [1, 1, 1], material, { position: [0, R * 0.8, -R * 0.6] }));
      break;
    case 'spiky': {
      g.add(crop());
      const n = 11;
      for (let i = 0; i < n; i++) {
        const phi = (i / n) * Math.PI * 2;
        const tilt = 0.35 + (i % 2) * 0.4;
        const dir = new THREE.Vector3(Math.sin(tilt) * Math.sin(phi), Math.cos(tilt), Math.sin(tilt) * Math.cos(phi));
        if (dir.z > 0.45) continue;
        const spike = new THREE.Mesh(new THREE.ConeGeometry(R * 0.28, R * 0.8, seg(10)), material);
        spike.position.set(dir.x * rx, dir.y * ry, dir.z * rz).multiplyScalar(1.08);
        spike.quaternion.setFromUnitVectors(UP, dir);
        g.add(spike);
      }
      break;
    }
    case 'mohawk': {
      // a shaved head with a strip down the middle, and a tall crest of fins
      g.add(new THREE.Mesh(headShell(f, (d) => Math.abs(d.x) < 0.24 && d.y > -0.35 && aboveHairline(d, CROP) > 0,
        () => R * 0.06), material));
      const n = 7;
      for (let i = 0; i < n; i++) {
        const a = THREE.MathUtils.lerp(0.55, -1.7, i / (n - 1));
        const dir = new THREE.Vector3(0, Math.cos(a), Math.sin(a));
        const fin = new THREE.Mesh(new THREE.ConeGeometry(R * 0.34, R * 1.25, 4), material);
        fin.scale.set(0.6, 1, 1);
        fin.position.set(0, dir.y * ry, dir.z * rz);
        fin.quaternion.setFromUnitVectors(UP, dir);
        g.add(fin);
      }
      break;
    }
    case 'curly': {
      g.add(crop((d) => R * 0.04));
      const n = 24;
      for (let i = 0; i < n; i++) {
        const t = (i + 0.5) / n;
        const polar = Math.acos(1 - t * 1.25);
        const phi = i * 2.39996;
        const dir = new THREE.Vector3(Math.sin(polar) * Math.cos(phi), Math.cos(polar), Math.sin(polar) * Math.sin(phi));
        if (dir.z > 0.3 && dir.y < 0.6) continue;
        g.add(ellipsoid(R * 0.27, [1, 1, 1], material, {
          position: [dir.x * rx * 1.12, dir.y * ry * 1.12, dir.z * rz * 1.12],
          segments: 12,
        }));
      }
      break;
    }
    case 'afro':
      g.add(ellipsoid(R * 1.45, [1.05, 0.95, 1], material, { position: [0, R * 0.4, -R * 0.55] }));
      break;
    default:
      g.add(crop());
  }
  return g;
}
