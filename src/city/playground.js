import * as THREE from 'three';
import { box, cyl } from '../props/util.js';
import { capsuleBetween } from '../lib/shapes.js';
import { JOINT_NAMES } from '../anim/gait.js';

// The park playground (公園の遊具): swings, a slide and a climbing frame
// (ジャングルジム), and the kids who play on them.
//
// Coordinates are playground-local (the playground sits at PLAY_AT in the
// park, see park.js), +z towards the park's edge. The swing seats are built
// on their own pivot groups (userData.swing) so the City can take them out of
// the merged town and swing them (takeSwings).

export const PLAY_AT = (w, d) => [w / 4 + 1, d / 4 + 1];
export const SWING = { x: 3, z: -2, bar: 2.4, chain: 1.86, seats: [-0.7, 0.7] }; // seat top 0.54 m
export const SLIDE = { x: -3, top: 1.5, platZ: -2.4, chute0: -1.9, chute1: 1.0, end: 0.3, ladder0: -3.75, ladder1: -2.9, width: 0.56 };
export const FRAME = { x0: 1.8, z0: 1.6, cell: 0.6, n: 3 };

const smooth = (t) => t * t * (3 - 2 * t);
/** The slide's chute: height and position at u (0 top .. 1 bottom). */
export function chuteAt(u) {
  const S = SLIDE;
  return { z: S.chute0 + (S.chute1 - S.chute0) * u, y: S.end + (S.top - S.end) * (1 - smooth(u)) };
}

/** A box from a to b (points [x, y, z]), w wide across x, h thick. */
function slab(a, b, w, h, mat) {
  const dy = b[1] - a[1], dz = b[2] - a[2], len = Math.hypot(dy, dz);
  const m = box(w, h, len + 0.01, mat, [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2]);
  m.rotation.x = -Math.atan2(dy, dz);
  return m;
}

/** The playground's fixed parts, added to `play` (a group at PLAY_AT). Returns playground-local colliders. */
export function buildPlayground(play, style) {
  const red = style.material('signage', 0xd8443c);
  const blue = style.material('signage', 0x3f7fd6);
  const yellow = style.material('signage', 0xf2c230);
  const green = style.material('signage', 0x4aa564);
  const metal = style.material('metal');
  const wood = style.material('wood');

  // --- swings: an A-frame, a top bar, two seats hanging on chains ------------
  const W = SWING;
  for (const sx of [-1, 1]) {
    play.add(capsuleBetween([W.x + sx * 1.6, 0, W.z - 0.6], [W.x + sx * 1.6, W.bar, W.z], 0.06, red, 6));
    play.add(capsuleBetween([W.x + sx * 1.6, 0, W.z + 0.6], [W.x + sx * 1.6, W.bar, W.z], 0.06, red, 6));
  }
  play.add(capsuleBetween([W.x - 1.6, W.bar, W.z], [W.x + 1.6, W.bar, W.z], 0.06, red, 6));
  for (const sx of W.seats) {
    // the seat and its chains turn round the bar (rotation.x); YXZ so the park's turn comes first
    const swing = new THREE.Group();
    swing.position.set(W.x + sx, W.bar, W.z);
    swing.rotation.order = 'YXZ';
    for (const cx of [-0.21, 0.21]) swing.add(capsuleBetween([cx, 0, 0], [cx, -W.chain, 0], 0.013, metal, 4));
    swing.add(box(0.5, 0.05, 0.24, wood, [0, -W.chain - 0.01, 0]));
    swing.userData.swing = { chain: W.chain };
    play.add(swing);
  }

  // --- slide: ladder up the back, a platform with rails and a little roof,
  // a chute with raised sides that curves down and runs out flat --------------
  const S = SLIDE, hw = 0.5;
  play.add(box(1.0, 0.08, 1.0, blue, [S.x, S.top - 0.04, S.platZ]));
  for (const px of [-hw, hw]) for (const pz of [-hw, hw]) play.add(cyl(0.045, 0.045, S.top + 1.0, blue, [S.x + px, (S.top + 1.0) / 2, S.platZ + pz], { segments: 6 }));
  for (const px of [-hw, hw]) {
    for (const ry of [0.5, 0.9]) play.add(box(0.05, 0.05, 1.0, yellow, [S.x + px, S.top + ry, S.platZ])); // side rails
  }
  play.add(cyl(0, 0.85, 0.45, red, [S.x, S.top + 1.22, S.platZ], { segments: 4, rot: [0, Math.PI / 4, 0] })); // roof
  // ladder: two rails and rungs
  for (const px of [-0.26, 0.26]) play.add(slab([S.x + px, 0, S.ladder0], [S.x + px, S.top, S.ladder1], 0.05, 0.05, blue));
  for (let i = 1; i <= 5; i++) {
    const t = i / 6, y = S.top * t, z = S.ladder0 + (S.ladder1 - S.ladder0) * t;
    play.add(cyl(0.025, 0.025, 0.52, yellow, [S.x, y, z], { segments: 5, rot: [0, 0, Math.PI / 2] }));
  }
  // chute
  const N = 10;
  for (let i = 0; i < N; i++) {
    const a = chuteAt(i / N), b = chuteAt((i + 1) / N);
    play.add(slab([S.x, a.y, a.z], [S.x, b.y, b.z], S.width, 0.04, yellow));
    for (const sx of [-1, 1]) play.add(slab([S.x + sx * (S.width / 2), a.y + 0.08, a.z], [S.x + sx * (S.width / 2), b.y + 0.08, b.z], 0.04, 0.16, yellow));
  }
  // legs under the chute
  for (const u of [0.55, 0.97]) {
    const c = chuteAt(u);
    for (const sx of [-1, 1]) play.add(cyl(0.035, 0.035, c.y, blue, [S.x + sx * 0.22, c.y / 2, c.z], { segments: 5 }));
  }

  // --- climbing frame: a cube of bars, every bar meeting at a joint ----------
  const F = FRAME, top = F.cell * F.n, side = F.cell * F.n;
  const rBar = 0.024;
  for (let i = 0; i <= F.n; i++) {
    for (let k = 0; k <= F.n; k++) {
      const x = F.x0 + i * F.cell, z = F.z0 + k * F.cell;
      play.add(cyl(rBar, rBar, top, green, [x, top / 2, z], { segments: 5 })); // posts
      for (let l = 1; l <= F.n; l++) play.add(new THREE.Mesh(new THREE.SphereGeometry(0.04, 6, 4), green).translateX(x).translateY(l * F.cell).translateZ(z)); // joints
    }
  }
  for (let l = 1; l <= F.n; l++) {
    const y = l * F.cell;
    for (let i = 0; i <= F.n; i++) {
      play.add(cyl(rBar, rBar, side, green, [F.x0 + i * F.cell, y, F.z0 + side / 2], { segments: 5, rot: [Math.PI / 2, 0, 0] })); // bars along z
      play.add(cyl(rBar, rBar, side, green, [F.x0 + side / 2, y, F.z0 + i * F.cell], { segments: 5, rot: [0, 0, Math.PI / 2] })); // bars along x
    }
  }

  return [
    { x: S.x, z: (S.ladder0 + S.chute1) / 2, hw: 0.45, hd: (S.chute1 - S.ladder0) / 2 },
    { x: W.x, z: W.z, hw: 1.8, hd: 0.7 },
    { x: F.x0 + side / 2, z: F.z0 + side / 2, hw: side / 2 + 0.05, hd: side / 2 + 0.05 },
  ];
}

// ---------------------------------------------------------------------------
// The City side: the swings move, kids play.

const tmpV = new THREE.Vector3();
const tmpQ = new THREE.Quaternion();
const tmpS = new THREE.Vector3();

/** Take the swing seats out of the town (before it is merged) so they can swing. */
export function takeSwings(city, group) {
  const found = [];
  group.updateMatrixWorld(true);
  group.traverse((o) => { if (o.userData.swing) found.push(o); });
  return found.map((o) => {
    o.matrixWorld.decompose(tmpV, tmpQ, tmpS);
    const yaw = new THREE.Euler().setFromQuaternion(tmpQ, 'YXZ').y;
    o.removeFromParent();
    o.position.copy(tmpV);
    o.rotation.set(0, yaw, 0, 'YXZ');
    city.scene.add(o);
    return { obj: o, x: tmpV.x, y: tmpV.y, z: tmpV.z, yaw, chain: o.userData.swing.chain, t: Math.random() * 10, amp: 0.05, rider: null };
  });
}

/** Swing frequency of a pendulum this long. */
const omega = (chain) => Math.sqrt(9.8 / chain);

/** Move every swing: a rider swings high, an empty seat sways a little and settles. */
export function updateSwings(swings, dt) {
  for (const s of swings) {
    s.t += dt;
    const want = s.rider && !s.rider.act ? s.rider.role.amp : 0.06;
    s.amp += (want - s.amp) * Math.min(1, dt * (want > s.amp ? 0.5 : 0.3)); // pumping up slowly, dying down slowly
    s.angle = s.amp * Math.sin(omega(s.chain) * s.t);
    s.vel = s.amp * Math.cos(omega(s.chain) * s.t); // > 0: swinging forward
    s.obj.rotation.x = s.angle;
  }
}

/** World point of a playground-local point for a park ({x, z, w, d, rot}). */
export function playWorld(pk, lx, lz) {
  const [px, pz] = PLAY_AT(pk.w, pk.d);
  const r = pk.rot ?? 0, c = Math.cos(r), s = Math.sin(r);
  const x = px + lx, z = pz + lz;
  return { x: pk.x + x * c + z * s, z: pk.z - x * s + z * c };
}

/** The body's joints (found once; a kid who never walked has none cached yet). */
function J(body) {
  if (!body.userData.joints) {
    const j = {};
    body.traverse((o) => { if (JOINT_NAMES.includes(o.name)) j[o.name] = o; });
    body.userData.joints = j;
  }
  return body.userData.joints;
}

/** Sit pose on a swing seat; legs out going forward, tucked going back; hands up on the chains. */
function swingPose(body, j, seatY, vel) {
  const hipY = j.legL?.position.y ?? 0.6;
  body.position.set(0, seatY - hipY + 0.05, 0);
  body.rotation.set(0, 0, 0);
  const out = Math.max(0, Math.min(1, 0.5 + vel * 1.4)); // 1 = legs straight out
  for (const s of ['L', 'R']) {
    if (j[`leg${s}`]) { j[`leg${s}`].rotation.x = -1.45 - 0.2 * out; j[`leg${s}`].rotation.z = 0; }
    if (j[`shin${s}`]) j[`shin${s}`].rotation.x = 1.5 - 1.25 * out;
    if (j[`foot${s}`]) j[`foot${s}`].rotation.x = 0.2 * out;
    if (j[`arm${s}`]) { j[`arm${s}`].rotation.x = -2.35; j[`arm${s}`].rotation.z = (s === 'L' ? 1 : -1) * 0.12; }
    if (j[`fore${s}`]) j[`fore${s}`].rotation.x = -0.35;
  }
  if (j.spine) j.spine.rotation.set(-0.35 * (out - 0.5), 0, 0); // leaning back as the legs go out
  if (j.head) j.head.rotation.set(0.15 * (out - 0.5), 0, 0);
}

/** Rotate the posed body round the swing's bar (root-local point (0, barY, 0)). */
function hangFrom(body, barY, angle) {
  const y = body.position.y - barY, z = body.position.z;
  const c = Math.cos(angle), s = Math.sin(angle);
  body.position.y = barY + y * c - z * s;
  body.position.z = y * s + z * c;
  body.rotation.x = angle;
}

/** Climbing pose: arms reaching up in turn, knees up in turn. */
function climbPose(body, j, t) {
  body.position.set(0, 0, 0);
  body.rotation.set(0, 0, 0);
  const a = Math.sin(t * 5);
  for (const [s, k] of [['L', 1], ['R', -1]]) {
    if (j[`leg${s}`]) { j[`leg${s}`].rotation.x = -0.9 - 0.5 * k * a; j[`leg${s}`].rotation.z = 0; }
    if (j[`shin${s}`]) j[`shin${s}`].rotation.x = 1.2 + 0.4 * k * a;
    if (j[`foot${s}`]) j[`foot${s}`].rotation.x = -0.2;
    if (j[`arm${s}`]) { j[`arm${s}`].rotation.x = -2.6 + 0.45 * k * a; j[`arm${s}`].rotation.z = 0; }
    if (j[`fore${s}`]) j[`fore${s}`].rotation.x = -0.5 - 0.3 * k * a;
  }
  if (j.spine) j.spine.rotation.set(0.1, 0, 0);
  if (j.head) j.head.rotation.set(-0.3, 0, 0);
}

/**
 * Kids on the playground (crowd roles 'swing', 'slide', 'climb'). Returns
 * true when it handled the kid this frame.
 */
export function updatePlayKid(city, n, dt) {
  const r = n.role, j = J(n.body);
  r.t = (r.t ?? Math.random() * 10) + dt;
  const ground = (x, z) => city.layout.groundHeight(x, z);
  const place = (x, y, z, heading) => {
    n.pos = { x, z };
    n.root.position.set(x, ground(x, z) + y, z);
    if (heading !== undefined) n.root.rotation.y = heading;
  };
  const yaw = r.park.rot ?? 0; // playground +z as a heading
  const walkTo = (to, speed) => {
    const dx = to.x - n.pos.x, dz = to.z - n.pos.z, d = Math.hypot(dx, dz);
    if (d < 0.08) return true;
    const st = Math.min(d, speed * dt);
    place(n.pos.x + (dx / d) * st, 0, n.pos.z + (dz / d) * st, Math.atan2(dx, dz));
    city.stepPerson(n, dt, speed);
    return false;
  };

  if (r.kind === 'swing') {
    const s = r.swing;
    s.rider = n;
    // the kid sits under the bar, facing the way the seat swings forward (+z of the swing)
    place(s.x, 0, s.z, s.yaw);
    n.root.position.y = ground(s.x, s.z);
    swingPose(n.body, j, s.y - s.chain + 0.03 - n.root.position.y, -(s.vel ?? 0)); // a positive angle swings back
    hangFrom(n.body, s.y - n.root.position.y, s.angle ?? 0);
    return true;
  }

  if (r.kind === 'slide') {
    const P = (lx, lz) => playWorld(r.park, lx, lz);
    const S = SLIDE;
    r.st ??= 'walk';
    if (r.st === 'walk') {
      // round the side of the slide to the foot of the ladder
      r.path ??= [P(S.x - 0.9, S.chute1 + 0.4), P(S.x - 0.9, S.ladder0 - 0.35), P(S.x, S.ladder0 - 0.25)];
      if (walkTo(r.path[0], 2.4)) { r.path.shift(); if (!r.path.length) { r.path = null; r.st = 'climb'; r.k = 0; } }
      return true;
    }
    if (r.st === 'climb') {
      r.k = Math.min(1, r.k + dt / 1.8);
      const z = S.ladder0 - 0.15 + (S.ladder1 - S.ladder0 + 0.25) * r.k, y = S.top * r.k;
      const w = P(S.x, z);
      place(w.x, y, w.z, yaw);
      climbPose(n.body, j, r.t);
      if (r.k >= 1) { r.st = 'top'; r.k = 0; }
      return true;
    }
    if (r.st === 'top') {
      // sit at the top of the chute for a moment, then push off
      r.k += dt;
      const w = P(S.x, S.chute0 - 0.15);
      place(w.x, S.top, w.z, yaw);
      swingPose(n.body, j, 0.04, 0.6);
      for (const s of ['L', 'R']) if (j[`arm${s}`]) j[`arm${s}`].rotation.x = -0.4;
      if (r.k > 0.7) { r.st = 'down'; r.k = 0; r.v = 0.6; }
      return true;
    }
    if (r.st === 'down') {
      // speeding up down the steep part, slowing on the flat run-out
      const len = S.chute1 - S.chute0;
      const a = chuteAt(r.k), b = chuteAt(Math.min(1, r.k + 0.02));
      const slope = (a.y - b.y) / Math.max(1e-3, b.z - a.z);
      r.v = Math.max(0.5, r.v + (9.8 * slope / Math.hypot(1, slope) * 0.6 - 1.2) * dt);
      r.k = Math.min(1, r.k + (r.v * dt) / len);
      const w = P(S.x, a.z);
      place(w.x, a.y + 0.02, w.z, yaw);
      swingPose(n.body, j, 0.03, 1);
      n.body.rotation.x = Math.atan(slope); // sitting along the slope, leaning back
      if (j.spine) j.spine.rotation.x = -0.45;
      for (const s of ['L', 'R']) if (j[`arm${s}`]) { j[`arm${s}`].rotation.x = -2.9; j[`arm${s}`].rotation.z = (s === 'L' ? 1 : -1) * 0.5; } // wheee, hands up
      if (r.k >= 1) { r.st = 'off'; r.k = 0; }
      return true;
    }
    if (r.st === 'off') {
      r.k += dt;
      const w = P(S.x, S.chute1 + 0.35);
      if (r.k < 0.35) { place(w.x, 0, w.z, yaw); city.stepPerson(n, dt, 0); return true; }
      r.st = 'walk';
      return true;
    }
  }

  if (r.kind === 'climb') {
    const F = FRAME, side = F.cell * F.n, top = side;
    // the frame's four faces: kid outside a face, facing in
    const faces = [[0, -1], [1, 0], [0, 1], [-1, 0]];
    const cx = F.x0 + side / 2, cz = F.z0 + side / 2;
    r.face ??= 0; r.st ??= 'walk';
    const [fx, fz] = faces[r.face];
    const along = (r.along ??= (Math.random() - 0.5) * side * 0.6);
    const lx = cx + fx * (side / 2 + 0.28) + (fz !== 0 ? along : 0), lz = cz + fz * (side / 2 + 0.28) + (fx !== 0 ? along : 0);
    const out = playWorld(r.park, lx, lz);
    const faceIn = Math.atan2(-fx, -fz) + yaw;
    if (r.st === 'walk') {
      if (walkTo(out, 1.8)) { r.st = 'up'; r.k = 0; }
      return true;
    }
    if (r.st === 'up' || r.st === 'downClimb') {
      r.k = Math.min(1, r.k + dt / 2.6);
      const h = r.st === 'up' ? r.k : 1 - r.k;
      const w = playWorld(r.park, lx - fx * 0.1 * h, lz - fz * 0.1 * h);
      place(w.x, (top - F.cell) * h, w.z, faceIn);
      climbPose(n.body, j, r.t);
      if (r.k >= 1) {
        if (r.st === 'up') { r.st = 'sit'; r.k = 0; r.sit = 3 + Math.random() * 4; }
        else { r.st = 'walk'; r.face = (r.face + 1 + Math.floor(Math.random() * 3)) % 4; r.along = null; }
      }
      return true;
    }
    if (r.st === 'sit') {
      // on the top bar, legs dangling outside, looking about
      r.k += dt;
      const w = playWorld(r.park, cx + fx * (side / 2 - 0.05) + (fz !== 0 ? along : 0), cz + fz * (side / 2 - 0.05) + (fx !== 0 ? along : 0));
      place(w.x, top, w.z, faceIn + Math.PI);
      swingPose(n.body, j, 0.03, 0.2 + 0.25 * Math.sin(r.t * 3)); // kicking the legs
      for (const s of ['L', 'R']) if (j[`arm${s}`]) { j[`arm${s}`].rotation.x = 0.35; j[`arm${s}`].rotation.z = (s === 'L' ? 1 : -1) * 0.35; } // hands on the bar
      if (j.head) j.head.rotation.y = 0.6 * Math.sin(r.t * 0.7);
      if (r.k > r.sit) { r.st = 'downClimb'; r.k = 0; }
      return true;
    }
  }
  return false;
}

