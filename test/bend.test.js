import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { createCharacter, defaults } from '../src/index.js';
import { FORE, UPPER } from '../src/geom.js';

function armMesh(ch) {
  return ch.root.userData.bends.find((m) => m.name === 'armR');
}

function verts(mesh) {
  const pos = mesh.geometry.attributes.position;
  const out = [];
  const n = mesh.geometry.index ? mesh.geometry.drawRange.count : 0;
  const seen = new Set();
  const idx = mesh.geometry.index.array;
  for (let i = 0; i < n; i++) seen.add(idx[i]);
  for (const i of seen) out.push(new THREE.Vector3(pos.getX(i), pos.getY(i), pos.getZ(i)));
  return out;
}

describe('limb fillets', () => {
  it('keeps the wrist on the bone and rounds a right-angle elbow', () => {
    const ch = createCharacter(defaults('man'));
    const elbow = ch.parts.elbowR;
    elbow.rotation.set(-Math.PI / 2, 0, 0);
    ch.root.userData.bends.forEach((m) => m.userData.applyBend());
    const mesh = armMesh(ch);
    const wrist = new THREE.Vector3(0, -FORE, 0).applyQuaternion(elbow.quaternion).add(elbow.position);
    const pts = verts(mesh);
    let min = Infinity;
    for (const p of pts) min = Math.min(min, p.distanceTo(wrist));
    expect(min).toBeLessThan(0.002);
    // A straight pair of tubes would sit on z=0 or y=-UPPER. The fillet leaves the corner.
    const onArc = pts.some((p) => p.y < -UPPER + 0.09 && p.y > -UPPER - 0.01 && p.z > 0.01 && p.z < 0.09);
    expect(onArc).toBe(true);
    const pos = mesh.geometry.attributes.position;
    const idx = mesh.geometry.index.array;
    const a = new THREE.Vector3().fromBufferAttribute(pos, idx[0]);
    const b = new THREE.Vector3().fromBufferAttribute(pos, idx[1]);
    const c = new THREE.Vector3().fromBufferAttribute(pos, idx[2]);
    const n = new THREE.Vector3().crossVectors(b.clone().sub(a), c.clone().sub(a)).normalize();
    const mid = a.clone().add(b).add(c).multiplyScalar(1 / 3);
    expect(n.dot(mid.clone().setY(0).normalize())).toBeGreaterThan(0.5);
  });

  it('stays a straight tube when the elbow is straight', () => {
    const ch = createCharacter(defaults('man'));
    ch.parts.elbowR.rotation.set(0, 0, 0);
    ch.parts.elbowL.rotation.set(0, 0, 0);
    ch.root.userData.bends.forEach((m) => m.userData.applyBend());
    for (const p of verts(armMesh(ch))) {
      expect(Math.abs(p.z)).toBeLessThan(0.06);
      expect(Number.isFinite(p.x + p.y + p.z)).toBe(true);
    }
  });

  it('builds finite elbows and knees for every pose, body, and sleeve', () => {
    const bodies = ['skinny', 'average', 'fat', 'muscle'];
    const tops = ['tee', 'hoodie', 'sweater', 'blouse', 'tank', 'none'];
    for (const body of bodies) {
      for (const top of tops) {
        const def = defaults('woman');
        def.body.type = body;
        def.body.height = body === 'fat' ? 0.85 : 1.15;
        def.clothing.top.style = top;
        def.clothing.bottom.style = top === 'blouse' ? 'skirt' : 'shorts';
        const ch = createCharacter(def);
        ch.dance('flex');
        ch.update(0.4, { speed: 0, grounded: true });
        ch.dance('chicken');
        ch.update(5.3, { speed: 0, grounded: true });
        ch.stopDance(0);
        ch.setWalkPose(0.175, 6);
        for (const m of ch.root.userData.bends) {
          const pos = m.geometry.attributes.position;
          const n = m.geometry.drawRange.count;
          const idx = m.geometry.index.array;
          for (let i = 0; i < n; i++) {
            const v = idx[i];
            const x = pos.getX(v);
            const y = pos.getY(v);
            const z = pos.getZ(v);
            expect(Number.isFinite(x + y + z), `${body} ${top} ${m.name}`).toBe(true);
          }
        }
        ch.dispose();
      }
    }
  });
});
