import * as THREE from 'three';
import { box, cyl } from '../props/util.js';
import { paintedWindow } from './interiors.js';

// Backs and sides of buildings: builders detail the street front; this pass
// makes the other walls feel lived in too, for every building, whatever its
// shape. It feels the building with rays (where is there plain wall, how
// high), then adds on the back and both sides:
//   - windows with painted curtains (some lit, glowing at night), in floor rows
//   - AC units under some windows, a drain pipe down a back corner
//   - a back door with a little canopy
//   - on buildings of 3+ floors, a steel emergency staircase on the back
//     with a landing and a door on every floor
// Only bare walls get dressed: walls with a painted facade or windows of
// their own are left alone, and only 'building' walls count (not wood,
// concrete car parks or glass). Deterministic: pass a seeded rng.

const FLOOR = 3;
const ray = new THREE.Raycaster();
const v = new THREE.Vector3(), dir = new THREE.Vector3();

/** Dress the back and sides of `group` (a built building, facing +z). Returns extra colliders. */
export function dressBacks(group, style, rng) {
  group.updateMatrixWorld(true);
  const bb = new THREE.Box3().setFromObject(group);
  if (bb.isEmpty()) return [];
  const meshes = [];
  group.traverse((o) => { if (o.isMesh) meshes.push(o); });
  const colliders = [];
  const added = new THREE.Group();
  added.name = 'backs';

  // the faces to dress: [outward normal, how to make a point on that face]
  const faces = [
    { n: [0, -1], along: [bb.min.x, bb.max.x], at: (a) => [a, bb.min.z - 1], rotY: Math.PI },
    { n: [-1, 0], along: [bb.min.z, bb.max.z], at: (a) => [bb.min.x - 1, a], rotY: -Math.PI / 2 },
    { n: [1, 0], along: [bb.min.z, bb.max.z], at: (a) => [bb.max.x + 1, a], rotY: Math.PI / 2 },
  ];
  const wallAt = (face, a, y) => {
    // cast inward at (a, y); a plain, outward-facing 'building' wall?
    const [ox, oz] = face.at(a);
    ray.set(v.set(ox, y, oz), dir.set(-face.n[0], 0, -face.n[1]));
    ray.far = 40;
    const hit = ray.intersectObjects(meshes, false)[0];
    if (!hit || !hit.face) return null;
    const m = hit.object.material;
    if (m.map || m.userData.role !== 'building') return null;
    const nrm = hit.face.normal.clone().transformDirection(hit.object.matrixWorld);
    if (nrm.x * face.n[0] + nrm.z * face.n[1] < 0.9) return null;
    return hit.point;
  };
  // a whole window fits: the wall is flat across its corners too
  const fits = (face, a, y, p) => {
    for (const [da, dy] of [[-0.75, -0.75], [0.75, 0.75], [0.75, -0.75], [-0.75, 0.75]]) {
      const q = wallAt(face, a + da, y + dy);
      if (!q || Math.abs((q.x - p.x) * face.n[0] + (q.z - p.z) * face.n[1]) > 0.05) return false; // same wall depth
    }
    return true;
  };
  const place = (o, p, face, out = 0.03) => {
    o.position.set(p.x + face.n[0] * out, o.position.y, p.z + face.n[1] * out);
    o.rotation.y = face.rotY;
    added.add(o);
  };
  const height = bb.max.y;
  const floors = Math.max(1, Math.floor((height - 0.5) / FLOOR));

  faces.forEach((face, fi) => {
    const [a0, a1] = face.along;
    const span = a1 - a0;
    if (span < 2.5) return;
    const spacing = 2.1 + rng() * 0.6;
    const n = Math.floor((span - 1.2) / spacing);
    const start = a0 + (span - (n - 1) * spacing) / 2;
    const back = fi === 0;
    // emergency stairs on the back of taller buildings, near one end
    let stairA = null;
    if (back && floors >= 3 && span > 6) {
      const end = rng() < 0.5 ? a0 + 1.6 : a1 - 1.6;
      const ok = [...Array(floors).keys()].every((k) => wallAt(face, end, k * FLOOR + 1.2));
      if (ok) stairA = end;
    }
    // back door on the ground floor (not where the stairs land)
    let doorA = null;
    if (back) {
      for (let t = 0; t < 4 && doorA === null; t++) {
        const a = a0 + 1 + rng() * (span - 2);
        if (stairA !== null && Math.abs(a - stairA) < 2) continue;
        const p = wallAt(face, a, 1.0);
        if (p && wallAt(face, a, 2.1)) {
          doorA = a;
          const d = box(0.9, 2.0, 0.06, style.material('darkMetal', 0x5a6068), [0, 1.0, 0]);
          place(d, p, face);
          const c = box(1.3, 0.08, 0.7, style.material('concrete', 0xb8b4aa), [0, 2.3, 0]);
          place(c, p, face, 0.35);
          if (rng() < 0.6) { // a bin or crates by the door
            const bin = box(0.6, 0.8, 0.5, style.material('metal', 0x3f7a4a), [0, 0.4, 0]);
            place(bin, wallAt(face, a + 1.0, 0.5) ?? p, face, 0.35);
          }
        }
      }
    }
    // windows (and some AC units), floor by floor
    for (let f = 0; f < floors; f++) {
      const y = f * FLOOR + 1.6;
      if (y + 0.8 > height) break;
      for (let i = 0; i < n; i++) {
        const a = start + i * spacing;
        if (stairA !== null && Math.abs(a - stairA) < 1.8) continue;
        if (f === 0 && doorA !== null && Math.abs(a - doorA) < 1.3) continue;
        if (rng() < 0.1) continue; // a few blanks: stairwells
        const p = wallAt(face, a, y);
        if (!p || !fits(face, a, y, p)) continue;
        const small = rng() < 0.15; // a small bathroom window
        const w = paintedWindow(style, Math.floor(rng() * 4), small ? 0.6 : 1.2, small ? 0.5 : 1.2, 0, y + (small ? 0.3 : 0), 0);
        place(w, p, face, 0.025);
        if (!small && rng() < 0.3) {
          const ac = box(0.75, 0.5, 0.3, style.material('metal', 0xe8e8e4), [0, y - 0.95, 0]);
          place(ac, p, face, 0.18);
        }
      }
    }
    // a drain pipe down one corner of the back
    if (back && height > 4) {
      const a = rng() < 0.5 ? a0 + 0.25 : a1 - 0.25;
      const p = wallAt(face, a, 1.0);
      if (p) {
        const pipe = cyl(0.05, 0.05, height - 0.3, style.material('metal', 0x8a8e94), [0, (height - 0.3) / 2, 0], { segments: 6 });
        place(pipe, p, face, 0.08);
      }
    }
    if (stairA !== null) colliders.push(...emergencyStairs(added, style, face, stairA, floors, wallAt));
  });
  group.add(added);
  return colliders;
}

/** A steel staircase zig-zagging up the back wall: a landing and a door on every floor. */
function emergencyStairs(g, style, face, a, floors, wallAt) {
  const steel = style.material('metal', 0x6a7078), door = style.material('darkMetal', 0x4a5058);
  const out = 0.75, half = 1.3; // the stairs stand 0.75 m out from the wall, 2.6 m wide
  const base = wallAt(face, a, 1.2);
  // local frame: u along the wall, w out from the wall
  const [nx, nz] = face.n, ux = -nz, uz = nx;
  const at = (u, w) => [base.x + ux * u + nx * w, base.z + uz * u + nz * w];
  const add = (mesh, u, y, w) => { const [x, z] = at(u, w); mesh.position.set(x, y, z); mesh.rotation.y = face.rotY; g.add(mesh); };
  for (let k = 1; k <= floors - 1; k++) {
    const y = k * FLOOR;
    add(box(2.8, 0.08, 1.3, steel), 0, y, out);                         // landing
    add(box(2.8, 0.9, 0.04, steel), 0, y + 0.5, out + 0.63);            // railing
    add(box(0.9, 2.0, 0.06, door), 0, y + 1.0, 0.03);                   // door onto the landing
  }
  // flights between landings, alternating direction, on the outer half
  for (let k = 0; k < floors - 1; k++) {
    const y0 = k * FLOOR, dirU = k % 2 ? -1 : 1;
    const [x0, z0] = at(-half * dirU, out + 0.25), [x1, z1] = at(half * dirU, out + 0.25);
    const len = Math.hypot(x1 - x0, FLOOR, z1 - z0);
    const flight = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.07, len), steel);
    flight.position.set((x0 + x1) / 2, y0 + FLOOR / 2, (z0 + z1) / 2);
    flight.lookAt(x1, y0 + FLOOR, z1); // +z of the box runs up the flight
    g.add(flight);
  }
  // posts at the outer corners
  for (const u of [-1.35, 1.35]) add(box(0.08, (floors - 1) * FLOOR + 1, 0.08, steel), u, ((floors - 1) * FLOOR + 1) / 2, out + 0.62);
  const [cx, cz] = at(0, out);
  const along = Math.abs(nz) > 0.5;
  return [{ x: cx, z: cz, hw: along ? 1.4 : 0.7, hd: along ? 0.7 : 1.4 }];
}
