import * as THREE from 'three';
import { capsuleBetween, ellipsoid, seg } from '../../lib/shapes.js';

// Hairstyles. Everything is built in head-local space (head centre at the
// origin, face toward +z). Shapes are chunky on purpose: hair is one of the
// main ways to tell tiny characters apart.

export const HAIRSTYLES = ['bald', 'short', 'medium', 'long', 'bun', 'spiky', 'mohawk', 'curly', 'afro'];

const UP = new THREE.Vector3(0, 1, 0);

/** The basic hair cap: covers the top and back of the head, shows the forehead. */
function cap(f, material, puff = 1.08) {
  const m = new THREE.Mesh(
    new THREE.SphereGeometry(1, seg(32), seg(16), 0, Math.PI * 2, 0, Math.PI * 0.58),
    material,
  );
  m.scale.set(f.rx * puff, f.ry * puff, f.rz * (puff + 0.02));
  m.rotation.x = -0.45;
  return m;
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
  const capPuff = underHat ? 1.025 : 1.08;

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
