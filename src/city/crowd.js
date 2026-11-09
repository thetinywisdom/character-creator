import * as THREE from 'three';
import { JOINT_NAMES } from '../anim/gait.js';

// The crowd: who is out in the town and what they are doing (City.js).
// Every pedestrian has a role (n.role.kind):
//
//   walk    walks the pavement round a block and now and then crosses the
//           road at a corner to another block, so walkers roam the town
//   stand   stands around on the pavement, looking about
//   bench   sits on a park bench (pairs share a bench)
//
// Roles are placed from the town itself (City.layout: blocks, park objects).
// After a reaction (slap, push, talk...) a person walks back to their place
// (their route, their bench, their spot) and picks the role up again.
// People far from the camera are hidden and not animated (cheap on phones).
//
// Games can add roles: give n.role a kind, a `home` {x, z, heading} if the
// person stays in one place, and handle it in updateRole.

const CULL = 48; // m: people further than this from the player are hidden

/** Joint groups of a person, cached. */
function joints(body) {
  if (!body.userData.crowdJoints) {
    const j = {};
    body.traverse((o) => { if (JOINT_NAMES.includes(o.name)) j[o.name] = o; });
    body.userData.crowdJoints = j;
  }
  return body.userData.crowdJoints;
}

/** Sit a person down: hips on a seat at seatY, thighs forward, hands on the lap. */
export function sitPose(body, seatY) {
  const j = joints(body);
  const hipY = j.legL?.position.y ?? 0.85;
  body.position.set(0, seatY - hipY + 0.06, 0);
  body.rotation.set(0, 0, 0);
  for (const s of ['L', 'R']) {
    if (j[`leg${s}`]) j[`leg${s}`].rotation.x = -1.5;
    if (j[`shin${s}`]) j[`shin${s}`].rotation.x = 1.5;
    if (j[`foot${s}`]) j[`foot${s}`].rotation.x = 0;
    if (j[`arm${s}`]) j[`arm${s}`].rotation.x = -0.35;
    if (j[`fore${s}`]) j[`fore${s}`].rotation.x = -0.8;
  }
  if (j.spine) j.spine.rotation.set(-0.05, 0, 0);
}

export class Crowd {
  constructor(city) {
    this.city = city;
    this.t = 0;
  }

  /** Places for people who stay put, from the town layout. */
  spots(rng) {
    const { layout } = this.city;
    const benches = [];
    for (const o of layout.data.objects ?? []) {
      if (o.asset !== 'area.park') continue;
      const r = ((o.rot ?? 0) * Math.PI) / 180, c = Math.cos(r), s = Math.sin(r);
      // the park's four benches (see park.js), each seat facing the paths
      for (const [x, z, ry] of [[-6, 2, Math.PI], [6, 2, Math.PI], [-6, -2, 0], [6, -2, 0]]) {
        const bz = z + Math.sign(z) * 0.6, fwd = ry === 0 ? 1 : -1;
        for (const side of [-0.42, 0.42]) {
          const lx = x + side, lz = bz + fwd * 0.08;
          benches.push({ x: o.x + lx * c + lz * s, z: o.z - lx * s + lz * c, heading: ry - r });
        }
      }
    }
    // standing spots: along the pavements, near the building side or the kerb
    const stands = [];
    for (const loop of layout.walkLoops) {
      for (let i = 0; i < loop.length; i++) {
        const a = loop[i], b = loop[(i + 1) % loop.length];
        for (const t of [0.25, 0.6]) {
          if (rng() < 0.5) continue;
          const len = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
          const nx = -(b[1] - a[1]) / len, nz = (b[0] - a[0]) / len; // across the pavement
          const side = rng() < 0.5 ? 1 : -1;
          stands.push({ x: a[0] + (b[0] - a[0]) * t + nx * side * 0.9, z: a[1] + (b[1] - a[1]) * t + nz * side * 0.9, heading: rng() * Math.PI * 2 });
        }
      }
    }
    return { benches, stands };
  }

  /** Give a person their role (called once, when the crowd is made). */
  assign(n, role) {
    n.role = role;
    if (role.home) {
      n.pos = { x: role.home.x, z: role.home.z };
      n.root.position.set(role.home.x, this.city.layout.groundHeight(role.home.x, role.home.z), role.home.z);
      n.root.rotation.y = role.home.heading;
    }
  }

  /** Is this person far from the camera? Then hide them and skip their animation. */
  culled(n) {
    const p = this.city.player, pos = n.pos ?? n.root.position;
    const far = Math.hypot(pos.x - p.x, pos.z - p.z) > CULL + (this.city.viewMode === 'iso' ? this.city.iso.zoom : 0);
    n.root.visible = !far;
    return far;
  }

  /** A person who stays in one place (stand, bench). */
  updateRole(n, dt) {
    const r = n.role;
    if (this.culled(n)) return;
    if (r.kind === 'bench') {
      sitPose(n.body, 0.45);
      return;
    }
    // stand: weight shifts and looking about, now and then a turn
    r.look = (r.look ?? Math.random() * 10) + dt;
    this.city.stepPerson(n, dt, 0);
    const j = joints(n.body);
    if (j.head) j.head.rotation.y = 0.5 * Math.sin(r.look * 0.4) * Math.sin(r.look * 0.13);
    if ((r.turn = (r.turn ?? 6 + Math.random() * 10) - dt) < 0) {
      r.turn = 6 + Math.random() * 12;
      r.face = (r.home.heading + (Math.random() - 0.5) * 2.5);
    }
    if (r.face !== undefined) {
      let d = r.face - n.root.rotation.y;
      d = Math.atan2(Math.sin(d), Math.cos(d));
      n.root.rotation.y += d * Math.min(1, dt * 3);
    }
  }

  /**
   * A walker passing a corner may cross the road to the next block: pick the
   * nearest corner of another route straight across (along a crosswalk).
   */
  maybeCross(n, corner, rng = Math.random) {
    if (rng() > 0.4) return null;
    let best = null, bd = 13;
    this.city.layout.walkLoops.forEach((loop) => {
      if (loop === n.loop) return;
      loop.forEach((q, k) => {
        const dx = q[0] - corner[0], dz = q[1] - corner[1];
        if (Math.min(Math.abs(dx), Math.abs(dz)) > 0.6) return; // straight across only
        const d = Math.hypot(dx, dz);
        if (d > 4 && d < bd) { bd = d; best = { loop, k, x: q[0], z: q[1] }; }
      });
    });
    return best;
  }
}
