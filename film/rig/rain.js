import * as THREE from 'three';
import { mulberry32 } from '../../src/lib/rng.js';

/**
 * Deterministic rain for the film rig.
 *
 * World streaks are real geometry (depth-tested), so an umbrella occludes
 * them. A dry cylinder around the stop keeps the kitten's face clear when
 * the camera is inside it. Screen streaks are a light veil for wide shots;
 * the shot list turns them down for the reveal and off for the kitten close-up.
 * Both are a function of absolute time, so any frame seeks without stepping.
 */

function makeWorld(count, region, seed, dry) {
  const rng = mulberry32(seed);
  const drops = [];
  const [x0, x1, z0, z1] = region;
  for (let i = 0; i < count; i++) {
    let x = 0;
    let z = 0;
    for (let n = 0; n < 12; n++) {
      x = x0 + rng() * (x1 - x0);
      z = z0 + rng() * (z1 - z0);
      const dx = x - dry.x;
      const dz = z - dry.z;
      if (dx * dx + dz * dz > dry.r * dry.r) break;
    }
    drops.push({
      x, z,
      speed: 12 + rng() * 8,
      phase: rng() * 48,
      len: 0.55 + rng() * 0.9,
      drift: (rng() - 0.5) * 0.35,
    });
  }
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(count * 6);
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const mat = new THREE.LineBasicMaterial({
    color: 0xc9d7e8, transparent: true, opacity: 0.42, depthWrite: false,
  });
  const lines = new THREE.LineSegments(geo, mat);
  lines.frustumCulled = false;
  lines.renderOrder = 3;
  const H = 14;
  return {
    object: lines,
    update(t) {
      for (let i = 0; i < count; i++) {
        const d = drops[i];
        let y = (d.phase - t * d.speed) % H;
        if (y < 0) y += H;
        const x = d.x + d.drift * Math.sin(t * 0.6 + d.phase);
        const o = i * 6;
        pos[o] = x;
        pos[o + 1] = y;
        pos[o + 2] = d.z;
        pos[o + 3] = x + d.drift * 0.04;
        pos[o + 4] = y - d.len;
        pos[o + 5] = d.z + 0.02;
      }
      geo.attributes.position.needsUpdate = true;
    },
  };
}

function makeScreen(count, seed) {
  const rng = mulberry32(seed);
  const seeds = Array.from({ length: count }, () => [
    rng() * 2 - 1, rng(), 0.75 + rng() * 0.55,
  ]);
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(count * 6);
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const mat = new THREE.LineBasicMaterial({
    color: 0xd5e2f0, transparent: true, opacity: 0.4, depthTest: false, depthWrite: false,
  });
  const lines = new THREE.LineSegments(geo, mat);
  lines.frustumCulled = false;
  lines.renderOrder = 12;
  return {
    object: lines,
    update(t, camera, opacity) {
      mat.opacity = opacity;
      lines.visible = !!camera && opacity > 0.01;
      if (!lines.visible) return;
      const dist = 2.4;
      const halfH = Math.tan((camera.fov * Math.PI) / 360) * dist;
      const halfW = halfH * camera.aspect;
      const fall = 1.15; // cycles of the view per second
      for (let i = 0; i < count; i++) {
        const s = seeds[i];
        let v = (s[1] - t * fall * s[2]) % 2.2;
        if (v < 0) v += 2.2;
        v -= 1.1;
        const x = s[0] * halfW;
        const y = v * halfH;
        const len = 0.045 * halfH;
        const o = i * 6;
        pos[o] = x;
        pos[o + 1] = y;
        pos[o + 2] = -dist;
        pos[o + 3] = x + halfW * 0.004;
        pos[o + 4] = y - len;
        pos[o + 5] = -dist;
      }
      geo.attributes.position.needsUpdate = true;
      lines.position.copy(camera.position);
      lines.quaternion.copy(camera.quaternion);
      lines.updateMatrixWorld();
    },
  };
}

export function createRain({ seed = 11, dry, wide, local }) {
  const far = makeWorld(wide.count, wide.region, seed, dry);
  const near = makeWorld(local.count, local.region, seed + 17, dry);
  const screen = makeScreen(320, seed + 90);
  const group = new THREE.Group();
  group.name = 'filmRain';
  group.add(far.object, near.object, screen.object);
  return {
    object: group,
    update(t, camera, screenOpacity) {
      far.update(t);
      near.update(t);
      screen.update(t, camera, screenOpacity);
    },
  };
}
