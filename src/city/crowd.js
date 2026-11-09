import * as THREE from 'three';
import { FRAME, SLIDE, playWorld, updatePlayKid, updateSwings } from './playground.js';
import { JOINT_NAMES } from '../anim/gait.js';
import { mulberry32 } from '../lib/rng.js';
import { SHOP_TYPES } from './buildings.js';

const PLAY_KINDS = new Set(['swing', 'slide', 'climb']); // kids on the playground (playground.js)

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
/**
 * Short scripted conversations for groups and bench pairs (owner-approved).
 * Each line is [speaker, text] or [speaker, text, true] for a quick reaction
 * that pops up over the line before it. Speakers: 0 = A, 1 = B, 2 = C, 3 = D.
 * Lines are generic: no names (people have an optional `name`, unused for now).
 * `four`: written for a group of four (only used by groups of four).
 */
export const CONVERSATIONS = [
  { lines: [[0, 'Did you see the game last night?'], [1, 'No, I fell asleep.'], [0, 'We won in the last second!'], [2, 'No way!', true]] },
  { lines: [[0, "I'm starving."], [1, 'Ramen after this?'], [2, 'Yes please!', true], [0, 'Extra garlic for me.']] },
  { lines: [[0, 'My boss yelled at me again.'], [1, 'What did you do this time?'], [0, 'Nothing! I was just late.'], [1, '...Again?']] },
  { lines: [[0, 'Is it going to rain?'], [1, 'The TV said sunny.'], [0, 'Then why is it so dark?'], [2, 'I forgot my umbrella...']] },
  { lines: [[0, 'Look at that cat!'], [1, 'So cute!', true], [2, "It's always here."], [0, "I'm calling it Mochi."]] },
  { lines: [[0, 'Any weekend plans?'], [1, 'Karaoke, obviously.'], [2, 'Again?!', true], [1, 'I have to practise!']] },
  { lines: [[0, 'Have you tried the new cafe?'], [1, 'Not yet. Is it good?'], [0, 'The pudding is amazing.'], [1, "Okay, I'm going today."]] },
  { lines: [[0, "I'm so tired today."], [1, 'Did you sleep at all?'], [0, 'I watched videos till 3.'], [1, 'Haha, same.', true]] },
  { lines: [[0, 'Did you finish the report?'], [1, 'What report?'], [0, "It's due today!"], [1, 'Oh no.', true]] },
  { lines: [[0, 'The festival is next week!'], [1, 'Are you wearing a yukata?'], [0, 'Of course!'], [2, 'I want takoyaki!', true]] },
  { lines: [[0, 'Did you hear about our neighbour?'], [1, 'No, what happened?'], [0, 'He got a girlfriend!'], [1, 'No way!', true], [2, 'I knew it!']] },
  { lines: [[0, "I'm on a diet now."], [1, 'Since when?'], [0, 'Since this morning.'], [2, 'Haha!', true]] },
  { lines: [[0, "Where's my phone?!"], [1, 'In your hand.'], [0, '...Oh.']] },
  { lines: [[0, 'Shh, here he comes.'], [1, 'Act normal.'], [2, 'I am normal!', true]] },
  { lines: [[0, 'I need a holiday.'], [1, 'Where would you go?'], [0, 'Okinawa. Beach. Sleep.'], [1, 'Take me with you.']] },
  { lines: [[0, 'The train was packed today.'], [1, 'Mine was late again.'], [0, "Let's just walk."], [1, "It's 10 km!"]] },
  { lines: [[0, 'Konbini run?'], [1, 'Get me an onigiri.'], [2, 'Me too! Salmon!', true], [0, 'You owe me 300 yen.']] },
  { lines: [[0, "It's the boss's birthday today."], [1, 'We should get a cake!'], [2, 'Strawberry shortcake!'], [0, 'Yes!', true]] },
  { lines: [[0, "It's so hot today."], [1, "I'm melting..."], [2, 'Ice cream?'], [0, 'Ice cream!', true]] },
  { lines: [[0, "What's your karaoke song?"], [1, 'Something by the old idols.'], [0, 'Sing it now!'], [1, 'Not here!']] },
  // groups of four
  { four: true, lines: [[0, 'Who ate my pudding?'], [1, 'Not me.'], [2, 'Not me either.'], [3, '...It was really good though.'], [0, 'YOU!', true]] },
  { four: true, lines: [[0, 'Where should we eat?'], [1, 'Ramen!'], [2, 'Sushi!', true], [3, 'Curry!', true], [0, '...Konbini it is.']] },
  { four: true, lines: [[0, 'Group photo! Everyone in!'], [1, 'Wait, my hair!'], [2, "Who's taking it?"], [3, "I'll do it!", true], [0, "You're not in it then!"]] },
  { four: true, lines: [[0, 'I have big news.'], [1, "You're getting married?!"], [0, 'No. I got a cat.'], [2, 'Even better!', true], [3, 'Name?'], [0, 'Mochi.']] },
  { four: true, lines: [[0, "Who's paying today?"], [1, 'Not me, I paid last time.'], [2, 'I forgot my wallet.'], [3, 'Again?!', true], [0, 'Rock, paper, scissors!']] },
  { four: true, lines: [[0, 'Scary movie tonight?'], [1, 'Yes!'], [2, "No way, I'll cry."], [3, 'Haha, she cried last time.', true], [2, 'I did NOT!']] },
  { four: true, lines: [[0, 'Where are we going?'], [1, 'I thought you knew.'], [2, "I'm following him."], [3, "I'm following her."], [0, "...We're lost."]] },
  { four: true, lines: [[0, 'Summer trip, all four of us?'], [1, 'Beach!'], [2, 'Mountains!', true], [3, 'Onsen!', true], [0, 'Onsen it is!', true]] },
];
const LINE_GAP = 1.2;     // s between lines of a conversation
const REACT_GAP = 0.35;   // s for a quick reaction over the line before
const CONVO_PAUSE = [3, 5]; // s of quiet between conversations

/**
 * Play conversations for a group of people (a chat circle, a bench pair):
 * lines in order, each by its speaker, quick reactions overlapping; then a
 * pause and the next conversation, none repeating until all have been used.
 */
export function playConversation(g, members, dt, say) {
  if ((g.t = (g.t ?? Math.random() * 3) - dt) > 0) return;
  if (!g.conv || g.line >= g.conv.lines.length) {
    if (g.conv) { g.conv = null; g.t = CONVO_PAUSE[0] + Math.random() * (CONVO_PAUSE[1] - CONVO_PAUSE[0]); return; }
    const four = members.length >= 4;
    const pool = CONVERSATIONS.filter((c) => (four ? true : !c.four));
    g.deck = (g.deck ?? []).filter((c) => pool.includes(c));
    if (!g.deck.length) g.deck = pool.filter((c) => !four || c.four || Math.random() < 0.35).sort(() => Math.random() - 0.5);
    g.conv = g.deck.pop(); g.line = 0;
    g.cast = [...members].sort(() => Math.random() - 0.5); // who plays A, B, C, D this time
  }
  const [who, text] = g.conv.lines[g.line];
  const speaker = g.cast[who % g.cast.length]; // a pair: C plays A's part
  say(speaker, text);
  g.line++;
  const next = g.conv.lines[g.line];
  g.t = next ? (next[2] ? REACT_GAP : LINE_GAP) : LINE_GAP;
}
const FOOD_QUEUES = new Set(['Ramen', 'udonSoba', 'sushi', 'takoyaki']);
const PROMOTE = new Set(['Izakaya', 'Cafe', 'Bakery', 'Bookshop', 'Konbini', 'karaoke', 'pharmacy', 'kissaten', 'familyRestaurant']);

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

/** Feet on the pedals going round (phase in radians): thighs and knees work in turn. */
export function pedalPose(body, phase) {
  const j = joints(body);
  for (const [s, off] of [['L', 0], ['R', Math.PI]]) {
    const a = Math.sin(phase + off);
    if (j[`leg${s}`]) j[`leg${s}`].rotation.x = -1.3 - 0.38 * a;  // the raised knee
    if (j[`shin${s}`]) j[`shin${s}`].rotation.x = 1.2 + 0.5 * a;  // bends more as it comes up
    if (j[`foot${s}`]) j[`foot${s}`].rotation.x = 0.15 * Math.cos(phase + off);
  }
}

/**
 * Lean into a turn: from how fast the heading changes (rad/s) and the speed,
 * a roll towards the inside of the turn, eased. obj.lean keeps the state;
 * returns the roll for rotation.z (a turn to the left rolls left).
 */
export function leanInto(obj, heading, speed, dt, k = 0.05, max = 0.3) {
  if (obj.leanHeading === undefined || dt <= 0) { obj.leanHeading = heading; obj.lean ??= 0; return obj.lean; }
  let d = heading - obj.leanHeading;
  d = Math.atan2(Math.sin(d), Math.cos(d));
  obj.leanHeading = heading;
  const want = -Math.max(-max, Math.min(max, (d / dt) * speed * k));
  obj.lean = (obj.lean ?? 0) + (want - (obj.lean ?? 0)) * Math.min(1, dt * 6);
  return obj.lean;
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
    if (j[`arm${s}`]) { j[`arm${s}`].rotation.x = -0.12; j[`arm${s}`].rotation.z = 0; } // hands resting on the lap
    if (j[`fore${s}`]) j[`fore${s}`].rotation.x = -0.55;
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
      if (o.asset === 'area.park') parks.push({ x: o.x, z: o.z, w: o.params.w, d: o.params.d, rot: r });
      if (o.asset === 'building.koban') kobans.push({ o, out });
      if (!o.asset.startsWith('building.')) continue;
      // shop / mixedUse pick their shop type from the seed when none is given (buildings.js)
      const type = (key === 'shop' || key === 'mixedUse')
        ? o.params.shopType ?? SHOP_TYPES[Math.floor(mulberry32(o.params.seed ?? 1)() * SHOP_TYPES.length)] : key;
      // the real storefront (some buildings stand back from the lot edge):
      // walk out from the lot centre to the far edge of the building's box,
      // then stand 1.5 m out from it
      let face = null;
      for (let t = 0; t <= (o.params.d ?? 12) / 2 + 1; t += 0.1) {
        const x = o.x + out[0] * t, z = o.z + out[1] * t;
        if (this.city.nearColliders(x, z).some((c) => (c.hw > 1.5 || c.hd > 1.5) && Math.abs(x - c.x) <= c.hw && Math.abs(z - c.z) <= c.hd)) face = t;
      }
      const front = (face ?? (o.params.d ?? 12) / 2) + 1.5;
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
      // on the playground (playground.js): a kid on each swing, one on the slide, one on the climbing frame
      for (const s of this.city.swings ?? []) {
        if (Math.abs(s.x - pk.x) > pk.w / 2 || Math.abs(s.z - pk.z) > pk.d / 2) continue;
        roles.push({ kind: 'swing', park: pk, swing: s, amp: 0.55 + rng() * 0.35, kid: true, home: { x: s.x + Math.sin(s.yaw) * 1.2, z: s.z + Math.cos(s.yaw) * 1.2, heading: s.yaw } });
      }
      const slideEnd = playWorld(pk, SLIDE.x, SLIDE.chute1 + 0.4), frameOut = playWorld(pk, FRAME.x0 + FRAME.cell * FRAME.n / 2, FRAME.z0 - 0.3);
      roles.push({ kind: 'slide', park: pk, kid: true, home: { ...slideEnd, heading: pk.rot } });
      roles.push({ kind: 'climb', park: pk, kid: true, home: { ...frameOut, heading: pk.rot } });
      for (let i = 0; i < 3; i++) {
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
    updateSwings(city.swings ?? [], dt);
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
    // chat circles and people side by side on benches hold short scripted
    // conversations (CONVERSATIONS), only when you are near
    if (ix) {
      const say = (n, text) => { if (n.role?.kind === 'bench') n.role.chat = 2.0; ix.say(ix.headOf(n), text, 'talk', 2.4, 0, ix.nameOf(n)); };
      if (!this.benchPairs) {
        // people whose bench seats are side by side share a conversation
        this.benchPairs = [];
        const sitters = city.npcs.filter((n) => n.role?.kind === 'bench');
        for (const n of sitters) {
          if (this.benchPairs.some((g) => g.members.includes(n))) continue;
          const m = sitters.find((o) => o !== n && !this.benchPairs.some((g) => g.members.includes(o)) && Math.hypot(o.role.home.x - n.role.home.x, o.role.home.z - n.role.home.z) < 1.2);
          if (m) this.benchPairs.push({ members: [n, m] });
        }
      }
      for (const g of [...(this.groups ?? []), ...this.benchPairs]) {
        const here = g.members.filter((n) => (n.role.group === g || n.role.kind === 'bench') && !n.act && n.pos);
        const near = here.some((n) => Math.hypot(n.pos.x - p.x, n.pos.z - p.z) < 22);
        if (here.length < 2 || here.length < g.members.length && g.conv || !near) { g.conv = null; continue; } // interrupted: start afresh later
        playConversation(g, here, dt, say);
      }
    }
    for (const n of city.npcs) if (n.role?.kind === 'bench' && n.role.chat > 0) n.role.chat -= dt;
  }

  /** Give a person their role (called once, when the crowd is made). */
  assign(n, role) {
    n.role = role;
    if (PLAY_KINDS.has(role.kind)) { role.st = null; role.path = null; } // start their play again from the ground
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
      const j = joints(n.body);
      r.look = (r.look ?? Math.random() * 10) + dt;
      if (j.head) j.head.rotation.y = 0.4 * Math.sin(r.look * 0.35) * Math.sin(r.look * 0.11);
      if (n.startle > 0) {
        // jumps in the seat: arms up, leaning back, a shake of the head
        n.startle -= dt;
        const f = Math.min(1, n.startle / 0.3) * Math.min(1, (1.4 - n.startle) / 0.12);
        for (const s of ['L', 'R']) { if (j[`arm${s}`]) j[`arm${s}`].rotation.x = -2.5 * f; if (j[`fore${s}`]) j[`fore${s}`].rotation.x = -0.4 * f; }
        if (j.spine) j.spine.rotation.x = -0.3 * f;
        if (j.head) j.head.rotation.y = Math.sin(n.startle * 25) * 0.4 * f;
        n.body.position.y += Math.abs(Math.sin(n.startle * 14)) * 0.08 * f;
      } else if (r.chat > 0 && j.armR) j.armR.rotation.x -= 0.5 * Math.max(0, Math.sin(r.look * 1.3)); // talking with a hand
      return;
    }
    if (r.kind === 'kid') { this.runAbout(n, dt); return; }
    if (PLAY_KINDS.has(r.kind) && updatePlayKid(this.city, n, dt)) return;
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
    if (rng() > (n.flee ? 0.6 : 0.4)) return null; // people running away cross more
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
