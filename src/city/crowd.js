import * as THREE from 'three';
import { JOINT_NAMES } from '../anim/gait.js';
import { mulberry32 } from '../lib/rng.js';
import { SHOP_TYPES } from './buildings.js';

// The crowd: who is out in the town and what they are doing (City.js).
// Every pedestrian has a role (n.role.kind):
//
//   walk    walks the pavement round a block and now and then crosses the
//           road at a corner to another block, so walkers roam the town
//   stand   stands around on the pavement, looking about
//   bench   sits on a park bench (pairs share a bench)
//   queue   lines up outside a ramen / udon / sushi / takoyaki shop; now and
//           then the front one goes in and someone joins at the back
//   promote stands at a shop front, waves and calls out to passers-by
//   group   2-4 people chatting in a circle (bubbles when you are near)
//   kid     children running about the park
//   police  an officer standing outside the koban (others walk a beat)
//
// Roles are placed from the town itself (City.layout: blocks, park objects).
// After a reaction (slap, push, talk...) a person walks back to their place
// (their route, their bench, their spot) and picks the role up again.
// People far from the camera are hidden and not animated (cheap on phones).
//
// Games can add roles: give n.role a kind, a `home` {x, z, heading} if the
// person stays in one place, and handle it in updateRole.

// what a shop promoter calls out, by shop
const CALLS = {
  Ramen: ['Irasshaimase!', 'Hot ramen here!', 'Extra noodles free!'],
  Izakaya: ['Irasshaimase!', 'Happy hour now!', 'Cold beer inside!'],
  Cafe: ['Fresh coffee!', 'Try our cake set!', 'Irasshaimase!'],
  Bakery: ['Fresh bread, just baked!', 'Melon pan, hot!', 'Irasshaimase!'],
  Bookshop: ['New manga in!', 'Irasshaimase!'],
  Konbini: ['Irasshaimase!', 'Two for one onigiri!'],
  karaoke: ['Karaoke, 30% off!', 'Free drinks bar!', 'Sing your heart out!'],
  pharmacy: ['Big sale today!', 'Irasshaimase!'],
  kissaten: ['Coffee and toast set!', 'Irasshaimase!'],
  familyRestaurant: ['Kids eat free!', 'Irasshaimase!'],
};
// what groups chat about (bubbles take turns)
export const GROUP_TALK = [
  'Did you see the game last night?', 'No way!', 'Haha, same.', "Let's get ramen after.", 'I am so tired today.',
  'That new cafe is nice.', 'Really? I should go.', 'My boss is the worst.', 'Weekend plans?', 'Karaoke, obviously!',
  'Is it going to rain?', 'I forgot my umbrella...', 'Look at that cat!', 'So cute!', 'I need a holiday.',
  'Same here.', 'Did you finish the report?', 'Not yet... ', 'The festival is next week!', "Can't wait!",
  'Who wants takoyaki?', 'Me! Me!', 'Shh, here he comes.', 'Wait, really?', 'I knew it!',
];
const FOOD_QUEUES = new Set(['Ramen', 'udonSoba', 'sushi', 'takoyaki']);
const PROMOTE = new Set(['Izakaya', 'Cafe', 'Bakery', 'Bookshop', 'Konbini', 'karaoke', 'pharmacy', 'kissaten', 'familyRestaurant']);
const NAMES = ['DEB', 'BIG', 'KEN', 'YUKI', 'MOMO', 'TARO', 'HANA', 'JIRO', 'AYA', 'SORA', 'RIKU', 'NANA', 'GEN', 'MAI', 'KOTA', 'EMI'];

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
    // shop fronts: what kind of shop, and where its pavement is
    const shops = [], kobans = [], parks = [];
    for (const o of layout.data.objects ?? []) {
      const r = ((o.rot ?? 0) * Math.PI) / 180, out = [Math.sin(r), Math.cos(r)];
      const key = o.asset.split('.')[1];
      if (o.asset === 'area.park') parks.push({ x: o.x, z: o.z, w: o.params.w, d: o.params.d });
      if (o.asset === 'building.koban') kobans.push({ o, out });
      if (!o.asset.startsWith('building.')) continue;
      // shop / mixedUse pick their shop type from the seed when none is given (buildings.js)
      const type = (key === 'shop' || key === 'mixedUse')
        ? o.params.shopType ?? SHOP_TYPES[Math.floor(mulberry32(o.params.seed ?? 1)() * SHOP_TYPES.length)] : key;
      const front = (o.params.d ?? 12) / 2 + 0.9; // on the pavement just outside
      shops.push({ type, x: o.x + out[0] * front, z: o.z + out[1] * front, out, along: [out[1], -out[0]], w: o.params.w ?? 8 });
    }
    return { benches, stands, shops, kobans, parks };
  }

  /** Queues, promoters, groups, kids, police: roles with homes (built by City). */
  plan(rng, sp) {
    const roles = [];
    const shuffle = (a) => a.map((x) => [rng(), x]).sort((p, q) => p[0] - q[0]).map((x) => x[1]);
    // queues outside up to three food shops
    for (const sh of shuffle(sp.shops.filter((x) => FOOD_QUEUES.has(x.type))).slice(0, 3)) {
      const q = { slots: [], members: [], t: 6 + rng() * 6, gone: null };
      const n = 3 + Math.floor(rng() * 3);
      for (let i = 0; i < n; i++) {
        // a line along the shop front, from the door outward, facing the door
        const d = 0.7 + i * 0.62;
        q.slots.push({ x: sh.x + sh.along[0] * d, z: sh.z + sh.along[1] * d, heading: Math.atan2(-sh.along[0], -sh.along[1]) });
      }
      this.queues ??= [];
      this.queues.push(q);
      q.slots.forEach((home, i) => roles.push({ kind: 'queue', home: { ...home }, queue: q, slot: i }));
    }
    // promoters outside up to five other shops
    for (const sh of shuffle(sp.shops.filter((x) => PROMOTE.has(x.type))).slice(0, 5)) {
      const side = (rng() - 0.5) * Math.min(sh.w * 0.6, 4);
      roles.push({ kind: 'promote', calls: CALLS[sh.type] ?? ['Irasshaimase!'],
        home: { x: sh.x + sh.along[0] * side + sh.out[0] * 0.3, z: sh.z + sh.along[1] * side + sh.out[1] * 0.3, heading: Math.atan2(sh.out[0], sh.out[1]) } });
    }
    // groups: in the park and on wide pavements
    const groupSpots = [];
    for (const pk of sp.parks) for (const [gx, gz] of [[-9, 9], [9, -9], [-10, -6]]) groupSpots.push({ x: pk.x + gx, z: pk.z + gz });
    for (const st of shuffle(sp.stands).slice(0, 3)) groupSpots.push({ x: st.x, z: st.z });
    this.groups = [];
    for (const g of groupSpots) {
      const size = 2 + Math.floor(rng() * 3), grp = { members: [], t: 1 + rng() * 3, turn: 0 };
      this.groups.push(grp);
      for (let i = 0; i < size; i++) {
        const a = (i / size) * Math.PI * 2 + rng() * 0.3, rr = 0.55 + size * 0.08;
        const x = g.x + Math.sin(a) * rr, z = g.z + Math.cos(a) * rr;
        roles.push({ kind: 'group', group: grp, home: { x, z, heading: Math.atan2(g.x - x, g.z - z) } });
      }
    }
    // kids running about the park
    for (const pk of sp.parks) {
      const rect = { x0: pk.x - pk.w / 2 + 2, x1: pk.x + pk.w / 2 - 2, z0: pk.z - pk.d / 2 + 2, z1: pk.z + pk.d / 2 - 2 };
      for (let i = 0; i < 5; i++) {
        const x = rect.x0 + rng() * (rect.x1 - rect.x0), z = rect.z0 + rng() * (rect.z1 - rect.z0);
        roles.push({ kind: 'kid', rect, home: { x, z, heading: rng() * 6.28 }, kid: true });
      }
    }
    // an officer outside each koban
    for (const k of sp.kobans) {
      const f = (k.o.params.d ?? 10) / 2 + 0.7;
      roles.push({ kind: 'police', police: true, home: { x: k.o.x + k.out[0] * f + k.out[1] * 1.5, z: k.o.z + k.out[1] * f - k.out[0] * 1.5, heading: Math.atan2(k.out[0], k.out[1]) } });
    }
    return roles;
  }

  /**
   * The bus has stopped (faked: nobody is tracked inside): one or two people
   * who got on earlier step off by the door and walk away; one or two of
   * those waiting get on and vanish.
   */
  busArrived() {
    const b = this.busStop;
    if (!b) return;
    const off = b.boarded.splice(0, 1 + Math.floor(Math.random() * 2));
    off.forEach((n, i) => {
      n.root.visible = true;
      n.pos = { x: b.stop.door.x + i * 0.5, z: b.stop.door.z };
      n.root.position.set(n.pos.x, 0, n.pos.z);
      n.role = { kind: 'walk' };
      this.city.endAct(n); // walk over to the pavement route and carry on
    });
    const on = b.waiters.filter((n) => !n.act && n.role.kind === 'busWait').slice(0, 1 + Math.floor(Math.random() * 2));
    for (const n of on) {
      b.waiters.splice(b.waiters.indexOf(n), 1);
      n.role = { kind: 'busWait', slot: -1, home: n.role.home };
      n.root.visible = false;
      b.boarded.push(n);
    }
  }

  /** Queues move, groups chat: once a frame. */
  update(dt) {
    const city = this.city, p = city.player, ix = city.ix;
    // the bus stop fills up again with passing walkers
    const b = this.busStop;
    if (b && b.waiters.length < 3 && Math.random() < dt * 0.3) {
      const free = b.slots.find((sl) => !b.waiters.some((w) => w.role.home && Math.hypot(w.role.home.x - sl.x, w.role.home.z - sl.z) < 0.3));
      const n = free && city.npcs.find((q) => q.role.kind === 'walk' && !q.act && !q.cross && q.pos && Math.hypot(q.pos.x - free.x, q.pos.z - free.z) < 12);
      if (n) {
        n.role = { kind: 'busWait', home: { ...free } };
        b.waiters.push(n);
        n.act = { kind: 'return', x: free.x, z: free.z, t: 30 };
      }
    }
    for (const q of this.queues ?? []) {
      if (q.gone && (q.gone.t -= dt) <= 0) {
        // back out of the shop, now at the end of the line
        const n = q.gone.n;
        q.gone = null;
        n.role.slot = q.slots.length - 1;
        n.role.home = { ...q.slots[n.role.slot] };
        n.root.visible = true;
        this.assign(n, n.role);
      }
      if ((q.t -= dt) > 0 || q.gone) continue;
      q.t = 7 + Math.random() * 8;
      const line = q.members.filter((n) => n.role.queue === q && !n.act).sort((a, b) => a.role.slot - b.role.slot);
      if (!line.length || line[0].role.slot !== 0) continue;
      // the front one goes in; everyone shuffles up a place
      const front = line[0];
      front.root.visible = false;
      front.role.slot = -1;
      q.gone = { n: front, t: 5 + Math.random() * 5 };
      for (const n of line.slice(1)) {
        n.role.slot -= 1;
        n.role.home = { ...q.slots[n.role.slot] };
        n.act = { kind: 'return', x: n.role.home.x, z: n.role.home.z, t: 20 };
      }
    }
    for (const g of this.groups ?? []) {
      if ((g.t -= dt) > 0) continue;
      g.t = 2.6 + Math.random() * 2;
      const here = g.members.filter((n) => n.role.group === g && !n.act);
      if (here.length < 2) continue;
      const n = here[g.turn++ % here.length];
      if (Math.hypot(n.pos.x - p.x, n.pos.z - p.z) > 22) continue; // only groups near you talk
      ix?.say(ix.headOf(n), GROUP_TALK[Math.floor(Math.random() * GROUP_TALK.length)], 'talk', 2.4, 0, ix.nameOf(n), g.turn % 2 ? 'left' : 'right');
    }
  }

  /** Give a person their role (called once, when the crowd is made). */
  assign(n, role) {
    n.role = role;
    if (role.queue && !role.queue.members.includes(n)) role.queue.members.push(n);
    if (role.group && !role.group.members.includes(n)) role.group.members.push(n);
    if (role.kind === 'busWait' && role.slot !== -1 && this.busStop && !this.busStop.waiters.includes(n)) this.busStop.waiters.push(n);
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
    if (r.slot === -1) { n.root.visible = false; return; } // inside the shop for now
    if (this.culled(n)) return;
    if (r.kind === 'bench') {
      sitPose(n.body, 0.45);
      return;
    }
    if (r.kind === 'kid') { this.runAbout(n, dt); return; }
    if (r.kind === 'queue' || r.kind === 'group' || r.kind === 'police' || r.kind === 'busWait') {
      // stand facing the shop / the group; small weight shifts, glances
      r.look = (r.look ?? Math.random() * 10) + dt;
      this.city.stepPerson(n, dt, 0);
      const j = joints(n.body);
      if (j.head) j.head.rotation.y = (r.kind === 'group' ? 0.35 : 0.5) * Math.sin(r.look * 0.5) * Math.sin(r.look * 0.17);
      if (r.kind === 'group' && j.armR) j.armR.rotation.x -= 0.5 * Math.max(0, Math.sin(r.look * 1.3)) * Math.max(0, Math.sin(r.look * 0.4)); // talking with a hand
      return;
    }
    if (r.kind === 'promote') {
      // wave at passers-by, and now and then call out when you are near
      r.look = (r.look ?? Math.random() * 10) + dt;
      this.city.stepPerson(n, dt, 0);
      const j = joints(n.body), w = Math.max(0, Math.sin(r.look * 0.6));
      if (j.armR) { j.armR.rotation.x = -2.6 * w; j.armR.rotation.z += 0.4 * Math.sin(r.look * 9) * w; }
      if ((r.call = (r.call ?? 2 + Math.random() * 6) - dt) < 0) {
        r.call = 6 + Math.random() * 6;
        const p = this.city.player, ix = this.city.ix;
        if (ix && Math.hypot(n.pos.x - p.x, n.pos.z - p.z) < 16) ix.say(ix.headOf(n), r.calls[Math.floor(Math.random() * r.calls.length)], 'talk', 2.4, 0, ix.nameOf(n));
      }
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

  /** Children: run to a spot in the park, stop a moment, run somewhere else. */
  runAbout(n, dt) {
    const r = n.role, rect = r.rect;
    if (!r.to || (r.wait > 0 && (r.wait -= dt) > 0 && !r.going)) {
      if (!r.to) r.to = { x: n.pos.x, z: n.pos.z };
    }
    const dx = r.to.x - n.pos.x, dz = r.to.z - n.pos.z, d = Math.hypot(dx, dz);
    let speed = 0;
    if (d < 0.3) {
      if ((r.wait = (r.wait ?? 0) - dt) <= 0) {
        r.to = { x: rect.x0 + Math.random() * (rect.x1 - rect.x0), z: rect.z0 + Math.random() * (rect.z1 - rect.z0) };
        r.wait = 0.5 + Math.random() * 3;
        r.pace = Math.random() < 0.6 ? 3.2 : 1.4; // mostly running
      }
    } else {
      speed = Math.min(r.pace ?? 2.5, d * 3);
      n.pos = { x: n.pos.x + (dx / d) * speed * dt, z: n.pos.z + (dz / d) * speed * dt };
      this.city.pushOut(n.pos, 0.25);
      let h = Math.atan2(dx, dz) - n.root.rotation.y;
      h = Math.atan2(Math.sin(h), Math.cos(h));
      n.root.rotation.y += h * Math.min(1, dt * 8);
    }
    n.root.position.set(n.pos.x, this.city.layout.groundHeight(n.pos.x, n.pos.z), n.pos.z);
    r.home = { x: n.pos.x, z: n.pos.z, heading: n.root.rotation.y };
    this.city.stepPerson(n, dt, speed);
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
