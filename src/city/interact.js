import * as THREE from 'three';
import { COMEDY } from './comedy.js';
import { leanInto, pedalPose, sitPose } from './crowd.js';
import { bananaPeel } from '../props/extras.js';
import { JOINT_NAMES, NPC_RUN_SPEED, PLAYER_RUN_SPEED } from '../anim/gait.js';
import { SMALL_TALK } from './smalltalk.js';

// Character interactions and player tricks in the walkable town (City.js).
//
//  Traits     every pedestrian is 'Calm' or 'Aggressive' (human schema `trait`)
//  Actions    on a person: slap, push, talk; or E / click for a pie menu
//             slap  → aggressive: slaps back, then chases; calm: runs away scared
//             push  → shoved back; aggressive: chases and pushes back; calm: runs away
//             talk  → both say a line of small talk in chat bubbles
//  Peels      drop banana peels; whoever steps on one slips and falls
//  Riding     E / hold-click next to a vehicle gets on or off; drive with WASD
//
// The City calls: update(dt) every frame, updateNpc(n, dt) for a person who
// is busy (n.act), updatePlayer(dt, axes) instead of walking, handle(event)
// for input. UI reads: menu (pie menu target), bubbles (chat + comic bursts:
// { text, kind: 'talk' | 'burst', anchor(): Vector3, age, life }), target.
//
// Games can reuse it, change the lines, or leave it out (City works without).

export const TRAITS = ['Calm', 'Aggressive'];

// what a person shouts after being hit (censored, comic-style)
const SHOUTS = {
  Aggressive: ['You motherf**ker!', "Oh, you're DEAD!", 'Say that again!', 'What the h*ll?!', 'You wanna go?!', '#@%&!!'],
  Calm: ['Ow! Why?!', 'Eek!!', 'H-help!', 'Wh-what did I do?!', 'Mommy...', 'Not again!'],
};
// short names shown on speech bubbles (a little name tag, like a comic)
// charging a slap: the first cycle (green to yellow) is a normal slap, the
// second (yellow to red, shaking) a power slap that knocks them down
export const CHARGE = [0.7, 0.7];
const CHASE_SPEED = NPC_RUN_SPEED; // m/s: you run 1.25x faster, so you can get away
const CHASE_YELLS = ['Get back here!', "I'll get you!", "You're DEAD!", 'Come here!!', "Don't you run!", 'COWARD!', '#@%&!!'];
const BURSTS = {
  powerslap: ['SMAAACK!!', 'KA-POW!!', 'WHAM!!'], slap: ['SLAP!', 'WHAP!', 'SMACK!'], push: ['SHOVE!', 'WHUMP!', 'OOF!'], slip: ['WHOOPS!'], bonk: ['BONK!'], bump: ['BUMP!', 'OOF!', 'WHOA!', 'OOPS!'] };
const pick = (a) => a[Math.floor(Math.random() * a.length)];

// the comic hits the owner picked (comedy.js): windmill slap, launch power
// slap, sumo push; calm people fall feet over head, aggressive ones faceplant
const ANIM = {
  slap: COMEDY.slap[0], powerslap: COMEDY.slap[2], push: COMEDY.push[0],
  fallCalm: COMEDY.fall[0].victim, fallAggressive: COMEDY.fall[1].victim,
};
const HIT_AT = { slap: 0.42, powerslap: 0.4, push: 0.25 }; // s into the swing when it lands
const FART_WINDUP = 0.65; // s of squatting and straining before the blast
ANIM.fart = { attacker: { dur: 0.95, pose(body, j, t) {
  const sq = Math.min(1, t / 0.2) * (t < FART_WINDUP ? 1 : Math.max(0, 1 - (t - FART_WINDUP) / 0.25));
  const shake = t < FART_WINDUP ? Math.sin(t * 70) * 0.04 * sq : 0;
  body.position.y = -0.18 * sq + (t >= FART_WINDUP && t < FART_WINDUP + 0.15 ? 0.12 : 0); // a little hop as it blasts
  body.position.x = shake;
  for (const s of ['L', 'R']) {
    if (j[`leg${s}`]) j[`leg${s}`].rotation.x = -0.75 * sq;
    if (j[`shin${s}`]) j[`shin${s}`].rotation.x = 1.25 * sq;
    if (j[`foot${s}`]) j[`foot${s}`].rotation.x = -0.4 * sq;
    if (j[`arm${s}`]) { j[`arm${s}`].rotation.x = -0.6 * sq; j[`arm${s}`].rotation.z = (s === 'L' ? 1 : -1) * 0.5 * sq; } // fists clenched
  }
  if (j.spine) j.spine.rotation.x = 0.35 * sq;
  if (j.head) j.head.rotation.x = 0.25 * sq + shake * 2;
} } };
const fallOf = (who) => (who.trait === 'Aggressive' ? ANIM.fallAggressive : ANIM.fallCalm);

const SEATED = new Set(['wait', 'talk', 'seated']); // acts a bench sitter does without getting up

export const MENU_OPTIONS = ['slap', 'push', 'talk', 'fart']; // keys 1-4, in the menu's order
const REACH = 1.7;        // m: how close a person must be to act on them
const PICK_REACH = 60;    // m: a clicked person can be anywhere you can see; you run over to them
const RUN = PLAYER_RUN_SPEED; // you, running over to someone you clicked
const MAX_PEELS = 10;
const FART_R = 3.5;       // m: how far the stink knocks people over

/** Joint groups of a (skinned) person, cached. */
function joints(body) {
  if (!body.userData.ixJoints) {
    const j = {};
    body.traverse((o) => { if (JOINT_NAMES.includes(o.name)) j[o.name] = o; });
    body.userData.ixJoints = j;
  }
  return body.userData.ixJoints;
}

export class Interactions {
  constructor(city, style) {
    this.city = city;
    this.style = style;
    this.bubbles = [];
    this.menu = null;      // { npc } while the pie menu is open
    this.target = null;    // { type: 'npc' | 'vehicle', ref } you are facing
    this.peels = [];
    // a soft ring under whoever you are facing
    this.ring = new THREE.Mesh(new THREE.RingGeometry(0.42, 0.52, 20).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ color: 0xece0aa, transparent: true, opacity: 0.8, depthWrite: false }));
    this.ring.renderOrder = 3;
    this.ring.visible = false;
    city.scene.add(this.ring);
  }

  // --- bubbles -------------------------------------------------------------------
  /** kind: 'talk' | 'shout' (red, angry) | 'confused' (a ? box) | 'burst' (SLAP!). name: a tag on the bubble. */
  say(anchor, text, kind = 'talk', life = kind === 'burst' ? 0.9 : kind === 'confused' ? 0.9 : 3.2, delay = 0, name = null, side = null) {
    // side: 'left' / 'right' leans a talk bubble away from the other speaker's, so they don't overlap
    this.bubbles.push({ anchor, text, kind, name, side, age: -delay, life, id: (this.nextId = (this.nextId ?? 0) + 1) }); // ids grow: older bubbles keep their place (main.js stackBubbles)
  }
  /** A person's name, if they have one (optional: `name` on the person or in their look / character JSON). */
  nameOf(n) { return n?.name ?? n?.look?.name ?? null; }
  headOf(n) { const f = () => n.root.position.clone().add(new THREE.Vector3(0, (n.look?.height ?? 1.7) + 0.3, 0)); f.who = n; return f; }
  playerHead() { const p = this.city.player; const f = () => p.root.position.clone().add(new THREE.Vector3(0, (p.height ?? 1.7) + 0.3, 0)); f.who = p; return f; }
  midOf(n) { return () => n.root.position.clone().add(new THREE.Vector3(0, (n.look?.height ?? 1.7) * 0.75, 0)); }

  // --- what are we facing / what was clicked ---------------------------------------
  facing() {
    const { player: p, npcs, cars } = this.city;
    if (p.riding) return { type: 'vehicle', ref: p.riding };
    const hx = Math.sin(p.heading), hz = Math.cos(p.heading);
    let best = null, bd = Infinity;
    for (const n of npcs) {
      if (!n.pos || n.act?.kind === 'slip' || !n.root.visible) continue;
      const dx = n.pos.x - p.x, dz = n.pos.z - p.z, d = Math.hypot(dx, dz);
      if (d > REACH || (dx * hx + dz * hz) / (d || 1) < 0.35) continue; // in front of you
      if (d < bd) { bd = d; best = { type: 'npc', ref: n }; }
    }
    for (const c of cars) {
      const d = this.distToVehicle(c, p.x, p.z);
      if (d < 1.1 && d + 0.4 < bd) { bd = d + 0.4; best = { type: 'vehicle', ref: c }; }
    }
    return best;
  }

  distToVehicle(c, x, z) {
    const { x: cx, z: cz } = c.obj.position;
    const fx = c.fx ?? Math.sin(c.obj.rotation.y), fz = c.fz ?? Math.cos(c.obj.rotation.y);
    const dx = x - cx, dz = z - cz;
    const along = Math.abs(dx * fx + dz * fz) - c.size.hd, side = Math.abs(dx * fz - dz * fx) - c.size.hw;
    return Math.hypot(Math.max(0, along), Math.max(0, side));
  }

  /** The person or vehicle under a screen point (client px), within reach. */
  pickAt(cx, cy, camera, rect) {
    const { player: p, npcs, cars } = this.city;
    const toScreen = (v) => {
      const s = v.clone().project(camera);
      return { x: rect.left + (s.x + 1) / 2 * rect.width, y: rect.top + (1 - s.y) / 2 * rect.height, ok: s.z < 1 };
    };
    let best = null, bd = Infinity;
    for (const n of npcs) {
      if (!n.pos || !n.root.visible || Math.hypot(n.pos.x - p.x, n.pos.z - p.z) > PICK_REACH) continue;
      const s = toScreen(this.midOf(n)());
      const d = Math.hypot(s.x - cx, s.y - cy);
      if (s.ok && d < 55 && d < bd) { bd = d; best = { type: 'npc', ref: n }; }
    }
    if (best) return best;
    for (const c of cars) {
      if (this.distToVehicle(c, p.x, p.z) > PICK_REACH) continue;
      const s = toScreen(c.obj.position.clone().add(new THREE.Vector3(0, 0.8, 0)));
      const d = Math.hypot(s.x - cx, s.y - cy);
      if (s.ok && d < 90 && d < bd) { bd = d; best = { type: 'vehicle', ref: c }; }
    }
    return best;
  }

  // --- input ------------------------------------------------------------------------
  /** ev: { type: 'primary' | 'slap' | 'push' | 'talk' | 'banana' | 'choose' | 'close' | 'click' | 'hold' | 'double' | 'right', x?, y?, n? } */
  handle(ev, camera, rect) {
    const p = this.city.player;
    if (p.act) return; // busy slipping or staggering
    if (ev.type === 'banana') return this.dropPeel();
    if (ev.type === 'fart') return this.fart();
    if (ev.type === 'jump') { if (!p.riding && !(p.jumpY > 0)) { p.vy = 4.4; p.jumpY = 0.001; } return; }
    if (ev.type === 'chargeEnd') {
      const c = this.charge;
      this.charge = null;
      // a hard slap only once the second cycle has gone all the way round to red
      if (c) this.go(c.t >= CHARGE[0] + CHARGE[1] ? 'powerslap' : 'slap', c.ref);
      return;
    }
    if (ev.type === 'close') { this.closeMenu(); return; }
    if (ev.type === 'choose') {
      // the menu's options (also keys 1-4): slap, push, talk, fart; without the
      // menu open they act on whoever you face (fart needs nobody)
      const kind = MENU_OPTIONS[ev.n];
      const who = this.menu?.npc ?? (this.facing()?.type === 'npc' ? this.facing().ref : null);
      if (this.menu) { this.menu = null; if (kind === 'fart' && who?.act?.kind === 'wait') this.city.endAct(who); }
      if (kind === 'fart') return this.fart();
      if (who) this.go(kind, who);
      return;
    }
    if (p.riding) {
      if (['primary', 'click', 'hold'].includes(ev.type)) this.getOff();
      return;
    }
    const picked = ev.x !== undefined ? this.pickAt(ev.x, ev.y, camera, rect) : null;
    const t = picked ?? this.facing();
    switch (ev.type) {
      case 'primary':
      case 'right':
        // E / right click: the action menu for that person (again: closes it)
        if (this.menu) { const same = t?.ref === this.menu.npc; this.closeMenu(); if (same || !t) return; }
        if (t?.type === 'npc') this.openMenu(t.ref);
        else if (t?.type === 'vehicle') this.go('ride', t.ref);
        return;
      case 'click':
        // left click: talk to them (or get on a vehicle)
        if (this.menu) { const same = t?.ref === this.menu.npc; this.closeMenu(); if (!t) return; if (same) { this.go('talk', t.ref); return; } }
        if (t?.type === 'npc') this.go('talk', t.ref);
        else if (t?.type === 'vehicle') this.go('ride', t.ref);
        return;
      case 'chargeStart': {
        // hold 1 or hold-click: charge a slap on them (or on the one whose menu is open)
        const who = this.menu?.npc ?? (t?.type === 'npc' ? t.ref : null);
        if (who) { this.closeMenu(); this.charge = { t: 0, ref: who }; }
        else if (t?.type === 'vehicle') this.go('ride', t.ref);
        return;
      }
      case 'hold':
        if (t?.type === 'npc') this.go('slap', t.ref);
        else if (t?.type === 'vehicle') this.go('ride', t.ref);
        return;
      case 'double': if (t?.type === 'npc') this.go('push', t.ref); return;
      case 'slap': case 'push': case 'talk':
        if (t?.type === 'npc') this.go(ev.type, t.ref);
        return;
      default:
    }
  }

  /**
   * Do `kind` ('slap' | 'push' | 'talk' | 'ride') to `ref` (a person or a
   * vehicle): right away if close enough, else run over to them first
   * (p.goal; any movement key cancels it).
   */
  go(kind, ref) {
    const p = this.city.player;
    if (this.inReach(kind, ref)) { this.doGoal(kind, ref); return; }
    p.goal = { kind, ref, t: 25 };
  }
  inReach(kind, ref) {
    const p = this.city.player;
    if (kind === 'ride') return this.distToVehicle(ref, p.x, p.z) < 1.0;
    return Math.hypot(ref.pos.x - p.x, ref.pos.z - p.z) < (kind === 'talk' ? 1.6 : 1.1);
  }
  doGoal(kind, ref) {
    this.city.player.goal = null;
    if (kind === 'ride') this.getOn(ref);
    else this.doAction(kind, ref);
  }

  openMenu(n) {
    this.menu = { npc: n };
    if (!n.act) n.act = { kind: 'wait', t: 30 }; // stops and waits while you choose
  }
  closeMenu() {
    const n = this.menu?.npc;
    if (n?.act?.kind === 'wait') this.city.endAct(n);
    this.menu = null;
  }

  // --- actions --------------------------------------------------------------------
  doAction(kind, n) {
    const p = this.city.player;
    p.heading = Math.atan2(n.pos.x - p.x, n.pos.z - p.z); // turn to them
    p.action = { kind, t: 0, dur: kind === 'talk' ? 0.01 : ANIM[kind].attacker.dur };
    const agg = n.trait === 'Aggressive';
    if (kind === 'talk') {
      // a question and an answer that fits it (smalltalk.js), from a calm or a grumpy person
      const [q, calm, grumpy] = pick(SMALL_TALK);
      this.say(this.playerHead(), q, 'talk', 3.4, 0, 'YOU', 'left');
      this.say(this.headOf(n), agg ? grumpy : calm, 'talk', 3.2, 0.45, this.nameOf(n), 'right'); // answers straight back
      n.act = { kind: 'talk', t: 4.2 };
      return;
    }
    // the hit lands a moment into the swing
    setTimeout(() => {
      // the comic beat: a burst on the hit, then they shout
      this.say(this.midOf(n), pick(BURSTS[kind]), 'burst');
      this.shake = 0.3;
      const dx = n.pos.x - p.x, dz = n.pos.z - p.z, d = Math.hypot(dx, dz) || 1;
      if (kind === 'push' || kind === 'powerslap') {
        // a push sends them flying (sumo); a power slap launches them spinning
        // into the air and they land sitting. Then up shouting, and they react
        const anim = ANIM[kind].victim, [k] = anim.kb;
        if (kind === 'powerslap') this.shake = 0.5;
        this.knockDown(n, { x: (dx / d) * k, z: (dz / d) * k }, p, null, anim);
        this.domino(n, { x: dx / d, z: dz / d }, 3.2 * 0.8, 2);
        return;
      }
      if (n.role?.kind === 'bench' && !n.act?.kind?.match(/slip/)) {
        // sitting: a jump in the seat, arms up, and a shout; they stay put
        this.say(this.headOf(n), pick(SHOUTS[agg ? 'Aggressive' : 'Calm']), 'shout', 2.6, 0.1, this.nameOf(n));
        n.startle = 1.4;
        n.act = { kind: 'seated', t: 1.6 };
        return;
      }
      // a slap spins them round on the spot, dizzy; then they react
      this.say(this.headOf(n), pick(SHOUTS[agg ? 'Aggressive' : 'Calm']), 'shout', 2.6, 0.15, this.nameOf(n));
      n.root.rotation.y = Math.atan2(-dx, -dz); // facing you as it lands
      n.comic = { spec: ANIM.slap.victim, t: 0 };
      const then = agg ? { kind: 'retaliate', move: kind, t: 0.55, struck: false } : { kind: 'flee', t: 4, delay: 0 };
      n.act = { kind: 'wait', t: ANIM.slap.victim.dur * 0.85, then };
    }, (HIT_AT[kind] ?? 0.15) * 1000);
  }

  /** An aggressive person hits the player back. */
  strikePlayer(n, move) {
    const p = this.city.player;
    n.action = { kind: move, t: 0, dur: ANIM[move].attacker.dur };
    setTimeout(() => {
      if (Math.hypot(p.x - n.pos.x, p.z - n.pos.z) > 1.8) return;
      if (p.riding && !p.riding.bike) return; // safe inside a car
      if (p.riding) this.getOff(); // shoved off the bike or scooter
      this.say(this.midOfPlayer(), pick(BURSTS[move]), 'burst');
      this.shake = 0.35;
      const dx = p.x - n.pos.x, dz = p.z - n.pos.z, d = Math.hypot(dx, dz) || 1;
      const k = move === 'push' ? 3.2 : 1.8;
      p.kb = { x: (dx / d) * k, z: (dz / d) * k, t: move === 'push' ? 0.35 : 0.25 };
      // a push back knocks you over too; a slap makes you stagger
      p.heading = Math.atan2(-dx, -dz); // facing them, so a push sends you over backwards
      if (move === 'push') { p.kb = { x: (dx / d) * 4.5, z: (dz / d) * 4.5, t: 0.7 }; p.act = { kind: 'slip', t: 2.4, total: 2.4, anim: ANIM.push.victim }; }
      else { p.act = { kind: 'stagger', t: ANIM.slap.victim.dur * 0.7 }; p.comic = { spec: ANIM.slap.victim, t: 0 }; }
    }, (HIT_AT[move] ?? 0.15) * 1000);
  }
  /** A car you stepped in front of hits you: you fly, land flat, the driver shouts. */
  hitByCar(c) {
    const p = this.city.player, v = c.speed;
    const dx = p.x - c.obj.position.x, dz = p.z - c.obj.position.z;
    const side = Math.sign(dx * c.fz - dz * c.fx) || 1; // thrown forward and off to the side you were on
    const k = Math.min(7, 2 + v * 0.6);
    p.kb = { x: (c.fx + c.fz * side * 0.6) * k, z: (c.fz - c.fx * side * 0.6) * k, t: 0.45 };
    p.act = { kind: 'slip', t: 2.4, total: 2.4 };
    c.speed *= 0.3;
    this.say(this.midOfPlayer(), pick(['WHAM!', 'BONK!', 'KRUNCH!']), 'burst');
    this.shake = 0.5;
    this.say(() => c.obj.position.clone().add(new THREE.Vector3(0, 2, 0)), pick(['WATCH IT!', 'Are you crazy?!', 'Idiot!', 'Look where you\'re going!']), 'shout', 2.4, 0.15, 'DRIVER');
    setTimeout(() => this.city.knock.cloud(new THREE.Vector3(p.x, this.city.layout.groundHeight(p.x, p.z), p.z), { n: 22, r: 0.7, life: 0.9, size: 0.2 }), 450);
  }
  midOfPlayer() { const p = this.city.player; return () => p.root.position.clone().add(new THREE.Vector3(0, (p.height ?? 1.7) * 0.75, 0)); }

  /** Someone slips (a banana peel, or hit by your vehicle). */
  /**
   * Knock a person over (a push, or your vehicle): they fly back along `kb`,
   * fall, get up shouting, then react: aggressive ones chase you and push you
   * back, calm ones run away.
   */
  knockDown(n, kb, p = this.city.player, word = null, anim = null) {
    const agg = n.trait === 'Aggressive';
    if (word) this.say(this.midOf(n), pick(BURSTS[word]), 'burst');
    const total = anim ? anim.dur : 2.4;
    n.act = { kind: 'slip', t: total, total, anim,
      then: agg ? { kind: 'chase', move: 'push', t: 10, cd: 0.4 } : { kind: 'flee', t: 4, delay: 0 } };
    n.kb = { x: kb.x, z: kb.z, t: anim ? anim.kb[1] : 0.35 };
    // they face the way they came from, so they go over backwards (a faceplant falls forwards)
    const fwd = (anim ?? fallOf(n)) === ANIM.fallAggressive;
    n.root.rotation.y = fwd ? Math.atan2(kb.x, kb.z) : Math.atan2(-kb.x, -kb.z);
    if (n.pos) this.startleNear(n.pos.x, n.pos.z); // people on benches nearby jump
    n.comic = null;
    if (this.menu?.npc === n) this.menu = null;
    // a cloud of dust where they hit the ground
    setTimeout(() => n.pos && this.city.knock.cloud(new THREE.Vector3(n.pos.x, this.city.layout.groundHeight(n.pos.x, n.pos.z), n.pos.z), { n: 22, r: 0.7, life: 0.9, size: 0.2 }), 330);
    // the shout comes as they get back up
    this.say(this.headOf(n), pick(SHOUTS[agg ? 'Aggressive' : 'Calm']), 'shout', 2.6, 0.2, this.nameOf(n)); // yelling as they go down
  }

  /**
   * Someone knocked flying takes the people around them down too: anyone
   * close by (more so in the way they fly) falls a beat later, and can take
   * down their own neighbours (`depth` more steps), each push a little weaker.
   */
  domino(n, dir, k, depth, hit = new Set([n])) {
    if (depth <= 0 || k < 1.2) return;
    setTimeout(() => {
      let i = 0;
      for (const m of this.city.npcs) {
        if (hit.has(m) || !m.pos || m.act?.kind === 'slip' || m.role?.kind === 'bench') continue;
        const ox = m.pos.x - n.pos.x, oz = m.pos.z - n.pos.z, d = Math.hypot(ox, oz);
        const ahead = (ox * dir.x + oz * dir.z) / (d || 1); // 1 straight in the way, -1 behind
        if (d > 1.3 + Math.max(0, ahead) * 0.9 || d < 1e-3) continue;
        hit.add(m);
        // they go over away from whoever hit them, mostly along the push
        const nx = ox / d, nz = oz / d;
        let bx = dir.x * 0.6 + nx * 0.6, bz = dir.z * 0.6 + nz * 0.6;
        const bl = Math.hypot(bx, bz) || 1; bx /= bl; bz /= bl;
        // one after another, so it reads as a chain
        setTimeout(() => {
          this.knockDown(m, { x: bx * k, z: bz * k }, this.city.player, 'bump');
          this.domino(m, { x: bx, z: bz }, k * 0.8, depth - 1, hit);
        }, (i++) * 110);
      }
    }, 180);
  }

  /** People sitting nearby jump in their seats and shout (chaos close by). */
  startleNear(x, z, r = 6, lines = null) {
    for (const m of this.city.npcs) {
      if (m.role?.kind !== 'bench' || m.act || !m.pos || (m.startle ?? 0) > 0) continue;
      if (Math.hypot(m.pos.x - x, m.pos.z - z) > r) continue;
      m.startle = 1.4;
      const agg = m.trait === 'Aggressive';
      this.say(this.headOf(m), pick(lines ?? (agg ? ['HEY! WATCH IT!', 'What the h*ll?!', 'Unbelievable!'] : ['Oh my!', 'Eek!!', 'Goodness!', 'Somebody help!'])), 'shout', 2.2, Math.random() * 0.15, this.nameOf(m));
    }
  }

  slip(who, isPlayer = false, word = 'slip') {
    if (who.act?.kind === 'slip') return;
    who.act = { kind: 'slip', t: 2.4, total: 2.4 };
    who.kb = null;
    this.say(isPlayer ? this.midOfPlayer() : this.midOf(who), pick(BURSTS[word]), 'burst');
    if (!isPlayer && this.menu?.npc === who) this.menu = null;
  }

  // --- a busy person (City calls this instead of walking their route) ---------------
  updateNpc(n, dt) {
    const city = this.city, p = city.player, a = n.act;
    if (n.role?.kind === 'bench' && SEATED.has(a.kind)) return this.updateSeated(n, dt);
    a.t -= dt;
    let speed = 0, face = null;
    const toP = { x: p.x - n.pos.x, z: p.z - n.pos.z };
    const dP = Math.hypot(toP.x, toP.z) || 1;
    switch (a.kind) {
      case 'wait': case 'talk':
        face = Math.atan2(toP.x, toP.z);
        break;
      case 'retaliate':
        face = Math.atan2(toP.x, toP.z);
        if (!a.struck && a.t < 0.25) { a.struck = true; this.strikePlayer(n, a.move); }
        if (a.t <= 0) { n.act = { kind: 'chase', move: a.move, t: 10, cd: 1.0 }; return this.updateNpc(n, 0); }
        break;
      case 'chase': {
        // furious: sprints faster than you run, shouts threats, leans in;
        // gives up after 10 s or once you are 300 m away
        face = Math.atan2(toP.x, toP.z);
        a.cd -= dt;
        const inCar = p.riding && !p.riding.bike;
        const reach = p.riding?.bike ? 1.4 : 1.0;
        if (dP > reach) speed = CHASE_SPEED;
        else if (a.cd <= 0 && !inCar) {
          this.strikePlayer(n, p.riding ? 'push' : a.move); // on a bike: shoved off it
          a.cd = 1.6;
          a.hits = (a.hits ?? 0) + 1;
          if (a.hits >= 2) a.t = Math.min(a.t, 0.8); // satisfied after a couple of hits
        }
        if ((a.yell = (a.yell ?? 0.6) - dt) < 0) {
          a.yell = 2.2 + Math.random() * 1.5;
          this.say(this.headOf(n), pick(CHASE_YELLS), 'shout', 1.6, 0, this.nameOf(n));
        }
        if (dP > 300) a.t = Math.min(a.t, 0.3); // you got away
        break;
      }
      case 'flee':
        if ((a.delay -= dt) > 0) break;
        // run off along the streets until 300 m from where it started (City.startFlee)
        city.startFlee(n);
        return;
      case 'return': {
        // walk back to their place at their own pace, like anyone walking
        const dx = a.x - n.pos.x, dz = a.z - n.pos.z, d = Math.hypot(dx, dz);
        if (d < 0.25) { city.finishAct(n); return; }
        face = Math.atan2(dx, dz);
        // only walk once roughly facing the way (no sliding sideways)
        let off = face - n.root.rotation.y;
        off = Math.atan2(Math.sin(off), Math.cos(off));
        speed = Math.abs(off) < 0.8 ? Math.min(n.speed ?? 1.2, d * 2 + 0.3) : 0;
        if (a.t <= 0) { city.finishAct(n); return; }
        break;
      }
      case 'slip':
      default:
    }
    // move
    const pos = { x: n.pos.x, z: n.pos.z };
    if (n.kb) {
      pos.x += n.kb.x * dt; pos.z += n.kb.z * dt;
      if ((n.kb.t -= dt) <= 0) n.kb = null;
    }
    if (speed > 0) {
      const h = n.root.rotation.y;
      pos.x += Math.sin(h) * speed * dt;
      pos.z += Math.cos(h) * speed * dt;
    }
    if (face !== null) {
      let d = face - n.root.rotation.y;
      d = Math.atan2(Math.sin(d), Math.cos(d));
      n.root.rotation.y += d * Math.min(1, dt * 10);
    }
    city.pushOut(pos, 0.28);
    n.pos = pos;
    n.root.position.set(pos.x, city.layout.groundHeight(pos.x, pos.z) + 0.0, pos.z);
    n.gait && city.stepPerson(n, dt, a.kind === 'slip' ? 0 : speed);
    this.poseActor(n, dt);
    if (n.act === a && a.t <= 0) {
      if (a.then) { n.act = a.then; if (a.kind === 'slip') { n.body.rotation.set(0, 0, 0); n.body.position.set(0, 0, 0); } } // up again: now react
      else city.endAct(n);
    }
  }

  /** Someone on a bench being talked to or slapped: they stay in their seat. */
  updateSeated(n, dt) {
    const a = n.act, p = this.city.player, h = n.role.home;
    a.t -= dt;
    n.pos = { x: h.x, z: h.z };
    n.root.position.set(h.x, this.city.layout.groundHeight(h.x, h.z), h.z);
    n.root.rotation.y = h.heading;
    this.city.crowd.updateRole(n, dt); // the sitting pose (and a jump in the seat, n.startle)
    // turn the head to you (as far as a neck goes)
    const j = joints(n.body);
    let d = Math.atan2(p.x - h.x, p.z - h.z) - h.heading;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    if (j.head && !(n.startle > 0)) j.head.rotation.y = Math.max(-1.1, Math.min(1.1, d));
    if (a.t <= 0) n.act = null;
  }

  // --- poses on top of the walk: arm swings, flinch, falling ---------------------------
  poseActor(who, dt) {
    const body = who.body, j = joints(body);
    body.rotation.order = 'YXZ'; // spins stay round the vertical even when lying down
    if (who.action) {
      // the swing: the owner's picked comic attacks (comedy.js)
      const ac = who.action, spec = ANIM[ac.kind]?.attacker;
      ac.t += dt;
      if (spec && ac.t <= spec.dur) spec.pose(body, j, ac.t);
      if (ac.t >= ac.dur) { who.action = null; if (!who.act || who.act.kind !== 'slip') body.position.set(0, 0, 0); }
    }
    if (who.flinch > 0) {
      who.flinch -= dt;
      if (j.spine) j.spine.rotation.x -= 0.35 * Math.sin(Math.PI * Math.max(0, who.flinch) / 0.35);
    }
    if (who.comic) {
      // a reaction on top of whatever they do (a slap: spin round, dizzy)
      const c = who.comic;
      c.t += dt;
      if (c.t <= c.spec.dur) c.spec.pose(body, j, c.t);
      else { who.comic = null; body.rotation.set(0, 0, 0); body.position.set(0, 0, 0); }
    }
    const a = who.act;
    if (a?.kind === 'slip') {
      // on the ground: a push / launch plays its own fall; anything else
      // (peel, bump, stink) falls by temper; the lying part stretches to fit
      const spec = a.anim ?? fallOf(who);
      const t = a.total - a.t, up = 0.5;
      const tt = t < a.total - up ? Math.min(t, spec.dur - up - 0.01) : spec.dur - (a.total - t);
      spec.pose(body, j, Math.max(0, tt));
      if (a.stunned && j.head) j.head.rotation.y = Math.sin(t * 9) * 0.6; // dizzy, head rolling
    } else if (a?.kind === 'stagger') {
      if (j.spine && !who.comic) j.spine.rotation.x -= 0.4 * Math.max(0, a.t);
    }
  }

  // --- the player when busy, riding or not -------------------------------------------
  /** Returns true if this took over the player's movement this frame. */
  updatePlayer(dt, axes) {
    const city = this.city, p = city.player;
    if (p.riding) { this.drive(dt, axes); return true; }
    if (p.goal && !p.act) {
      const g = p.goal, ref = g.ref;
      const tp = g.kind === 'ride' ? ref.obj.position : ref.pos;
      g.t -= dt;
      // moving yourself, or the target gone or ridden off, cancels the errand
      if (Math.hypot(axes.x, axes.z) > 0.1 || !tp || g.t <= 0 || (g.kind === 'ride' && ref.ridden)) {
        p.goal = null;
        if (ref.act?.kind === 'wait') city.endAct(ref);
        return false;
      }
      if (this.inReach(g.kind, ref)) { this.doGoal(g.kind, ref); return false; }
      // run over to them
      const dx = tp.x - p.x, dz = tp.z - p.z;
      let d = Math.atan2(dx, dz) - p.heading;
      d = Math.atan2(Math.sin(d), Math.cos(d));
      p.heading += d * Math.min(1, dt * 10);
      p.speed += (RUN - p.speed) * Math.min(1, dt * 6);
      p.x += Math.sin(p.heading) * p.speed * dt;
      p.z += Math.cos(p.heading) * p.speed * dt;
      city.collide(p);
      city.stepPerson(p, dt, p.speed);
      p.root.position.set(p.x, city.layout.groundHeight(p.x, p.z), p.z);
      p.root.rotation.y = p.heading; p.root.rotation.z = leanInto(p, p.heading, p.speed, dt); // leaning into the turn
      return true;
    }
    if (p.act) {
      p.act.t -= dt;
      if (p.kb) {
        p.x += p.kb.x * dt; p.z += p.kb.z * dt;
        if ((p.kb.t -= dt) <= 0) p.kb = null;
      }
      p.speed = 0;
      city.collide(p);
      city.stepPerson(p, dt, 0);
      this.poseActor(p, dt);
      const ground = city.layout.groundHeight(p.x, p.z);
      p.root.position.set(p.x, ground, p.z);
      p.root.rotation.y = p.heading; p.root.rotation.z = 0;
      if (p.act.t <= 0) { p.act = null; p.body.rotation.set(0, 0, 0); p.body.position.set(0, 0, 0); }
      return true;
    }
    return false;
  }

  // --- fart ---------------------------------------------------------------------------
  /**
   * A green stink cloud round you: everyone within FART_R falls over and lies
   * there stunned (dizzy), then gets up, holds their nose and runs off.
   */
  fart() {
    const p = this.city.player;
    if ((this.fartCd ?? 0) > 0 || p.riding) return;
    this.fartCd = 2.5;
    // squat, strain and shake a moment... then it goes off
    p.action = { kind: 'fart', t: 0, dur: ANIM.fart.attacker.dur };
    setTimeout(() => this.fartBlast(), FART_WINDUP * 1000);
  }
  fartBlast() {
    const city = this.city, p = city.player;
    const at = new THREE.Vector3(p.x, city.layout.groundHeight(p.x, p.z) + 0.3, p.z);
    city.knock.cloud(at, { color: 0x9cbf5a, n: 46, r: 1.1, life: 2.0, size: 0.3, rise: 0.45 });
    setTimeout(() => city.knock.cloud(at, { color: 0xc2d46e, n: 34, r: 1.7, life: 1.8, size: 0.34, rise: 0.3 }), 250);
    this.say(this.midOfPlayer(), pick(['PFFRRT!', 'BRAAAP!', 'PFFT!', 'TOOT!']), 'burst');
    this.startleNear(p.x, p.z, FART_R + 1.5, ['EWWW!', 'GROSS!', '*cough* *cough*', 'WHO DID THAT?!', 'Disgusting!']);
    this.shake = 0.2;
    let i = 0;
    for (const n of city.npcs) {
      if (!n.pos || n.act?.kind === 'slip' || n.role?.kind === 'bench') continue;
      const dx = n.pos.x - p.x, dz = n.pos.z - p.z, d = Math.hypot(dx, dz);
      if (d > FART_R || d < 1e-3) continue;
      // further away, a beat later: the cloud spreads
      setTimeout(() => {
        if (n.act?.kind === 'slip') return;
        n.act = { kind: 'slip', t: 3.6, total: 3.6, stunned: true, then: { kind: 'flee', t: 4, delay: 0 } };
        n.kb = { x: (dx / d) * 1.4, z: (dz / d) * 1.4, t: 0.3 };
        if (this.menu?.npc === n) this.menu = null;
        this.say(this.headOf(n), pick(['EWWW!', 'GROSS!', '*cough* *cough*', 'MY EYES!', 'WHO DID THAT?!', 'X_X']), 'shout', 2.2, Math.random() * 0.1, this.nameOf(n));
      }, 60 + d * 40 + (i++) * 10);
    }
  }

  // --- banana peels -----------------------------------------------------------------
  dropPeel() {
    const p = this.city.player;
    if (p.riding) return;
    const g = bananaPeel.build({}, this.style); // props/extras.js (also in the catalogue)
    const x = p.x - Math.sin(p.heading) * 0.35, z = p.z - Math.cos(p.heading) * 0.35; // just behind you
    g.position.set(x, this.city.layout.groundHeight(x, z) + 0.01, z);
    this.city.scene.add(g);
    this.peels.push({ mesh: g, x, z, armed: false });
    if (this.peels.length > MAX_PEELS) this.removePeel(this.peels[0]);
  }
  removePeel(peel) {
    this.city.scene.remove(peel.mesh);
    peel.mesh.traverse((o) => o.geometry?.dispose());
    this.peels.splice(this.peels.indexOf(peel), 1);
  }

  // --- riding -------------------------------------------------------------------------
  getOn(c) {
    const p = this.city.player;
    if (c.ridden) return;
    this.closeMenu();
    // taking it from someone (traffic, a rider): they jump off and run
    if (!c.parked && (c.loop || c.rider)) { this.city.ejectDriver(c); c.loop = null; }
    c.ridden = true;
    c.parked = false;
    c.fallen = null; c.obj.rotation.z = 0; // picked up if it had fallen over
    p.riding = c;
    c.drive = { speed: 0, heading: c.obj.rotation.y, travel: c.obj.rotation.y };
    p.body.visible = !!c.bike; // inside a car you are hidden; on a bike you sit on it
    p.speed = 0;
  }
  getOff() {
    const city = this.city, p = city.player, c = p.riding;
    if (!c) return;
    c.obj.rotation.z = 0; p.root.rotation.z = 0; c.lean = 0; // parked upright
    c.ridden = false;
    c.parked = true; // stays where you left it
    p.riding = null;
    p.body.visible = true;
    p.body.position.set(0, 0, 0);
    // step out on the right (the driver's side in Japan)
    const h = c.drive.heading, side = c.size.hw + 0.55;
    p.x = c.obj.position.x + Math.cos(h) * side;
    p.z = c.obj.position.z - Math.sin(h) * side;
    p.heading = h;
    city.collide(p);
  }

  drive(dt, axes) {
    const city = this.city, p = city.player, c = p.riding, dv = c.drive;
    const MAX = c.bike === 'bicycle' ? 5 : c.bike ? 9 : c.size.hd > 4 ? 8 : 12;
    // the pedal goes down over a moment, and the pull fades as the vehicle
    // nears its top speed: a bus or a bicycle gathers speed slowly, a car quicker
    const want = -axes.z; // W forward
    dv.pedal ??= 0;
    dv.pedal += (want - dv.pedal) * Math.min(1, dt * (Math.abs(want) > Math.abs(dv.pedal) ? 2.5 : 8));
    const throttle = dv.pedal;
    const ACC = c.bike === 'bicycle' ? 2.2 : c.bike ? 3.8 : c.size.hd > 4 ? 1.6 : 3.4;
    const hb = axes.handbrake, straight = Math.abs(axes.x) < 0.15;
    if (hb && straight) {
      // handbrake going straight: wheels lock and it stops
      const dec = 9 * dt;
      dv.speed = Math.abs(dv.speed) <= dec ? 0 : dv.speed - Math.sign(dv.speed) * dec;
      if (Math.abs(dv.speed) > 2.5) this.skid(c, c.obj.position.x, c.obj.position.z, Math.sin(dv.heading), Math.cos(dv.heading));
    } else if (throttle > 0.05) {
      if (dv.speed < 0) dv.speed += 9 * throttle * dt; // braking out of reverse
      else dv.speed += ACC * throttle * Math.max(0.12, 1 - dv.speed / MAX) * dt;
    } else if (throttle < -0.05) {
      if (dv.speed > 0) dv.speed -= 9 * -throttle * dt; // brakes
      else dv.speed -= 2 * -throttle * dt;              // reverse, slowly
    } else dv.speed *= Math.max(0, 1 - dt * 0.5);       // rolling on
    if (hb && !straight) dv.speed *= Math.max(0, 1 - dt * 0.9); // drifting bleeds speed off
    dv.speed = Math.max(-3, Math.min(MAX, dv.speed));
    // steer (more grip at speed, reversed when backing up; it turns harder on the handbrake)
    // cars and the bus turn like real vehicles: the rate depends on the
    // wheelbase (a bus turns wider), and the body pivots round the rear axle
    const wb = c.size.hd * 1.3;
    const rate = c.bike ? 2.4 * Math.min(1, Math.abs(dv.speed) / 3) : Math.min(1.6, Math.abs(dv.speed) * Math.tan(0.6) / wb);
    const steer = -axes.x * rate * (hb ? 1.9 : 1);
    const turn = steer * dt * Math.sign(dv.speed || 1);
    if (!c.bike && !hb) {
      const b = c.size.hd * 0.6; // centre to rear axle
      const h0 = dv.heading;
      c.obj.position.x += (Math.sin(h0 + turn) - Math.sin(h0)) * b;
      c.obj.position.z += (Math.cos(h0 + turn) - Math.cos(h0)) * b;
    }
    dv.heading += turn;
    const fx = Math.sin(dv.heading), fz = Math.cos(dv.heading);
    // drift: the way we are actually going (dv.travel) catches up with the way we
    // point; with grip it does so at once, on the handbrake slowly, so the back slides out
    dv.travel ??= dv.heading;
    let slipA = dv.heading - dv.travel;
    slipA = Math.atan2(Math.sin(slipA), Math.cos(slipA));
    dv.travel += slipA * Math.min(1, dt * (hb ? 1.4 : 9));
    const tx = Math.sin(dv.travel), tz = Math.cos(dv.travel);
    const pos = c.obj.position;
    let nx = pos.x + tx * dv.speed * dt, nz = pos.z + tz * dv.speed * dt;
    // skid marks while sliding
    if (Math.abs(slipA) > 0.2 && Math.abs(dv.speed) > 3) this.skid(c, nx, nz, fx, fz);
    // collide: two circles along the vehicle against buildings, props, other vehicles
    const r = c.size.hw, off = Math.max(0, c.size.hd - r);
    city.knock.hitBy(nx, nz, fx, fz, dv.speed, r, off); // boards, planters, bikes, bins fly (before they could stop us)
    let hit = false, crash = null;
    for (const k of [-1, 1]) {
      const q = { x: nx + fx * off * k, z: nz + fz * off * k };
      const bx = q.x, bz = q.z;
      city.pushOut(q, r);
      for (const o of city.cars) {
        if (o === c) continue;
        const ox = q.x, oz = q.z;
        city.pushOutOfCar(q, r, o);
        if (q.x === ox && q.z === oz || o.fallen) continue;
        // a real knock (closing speed, either of us moving), not a nudge
        const ov = o.parked ? 0 : (o.speed ?? 0);
        const rel = Math.hypot(tx * dv.speed - (o.fx ?? 0) * ov, tz * dv.speed - (o.fz ?? 0) * ov);
        if (rel > 2.5) crash = { o, rel };
      }
      const px = q.x - bx, pz = q.z - bz;
      if (Math.hypot(px, pz) > 1e-4) {
        nx += px; nz += pz;
        if ((px * fx + pz * fz) * Math.sign(dv.speed) < 0) hit = true; // pushed back against the way we go: a crash
      }
    }
    if (hit) dv.speed *= 0.4;
    if (crash) {
      // anyone on a bike in a crash comes off: you (on a bicycle or scooter),
      // and a bicycle or scooter you hit (their rider too)
      const { o, rel } = crash;
      if (o.bike || o.rider) this.topple(o, Math.sign((o.obj.position.x - nx) * (o.fz ?? 1) - (o.obj.position.z - nz) * (o.fx ?? 0)) || 1);
      if (c.bike) {
        this.say(this.midOfPlayer(), pick(['CRASH!', 'WHAM!', 'KRUNCH!']), 'burst');
        this.shake = 0.45;
        const v = Math.min(5, rel * 0.6);
        pos.set(nx, pos.y, nz);
        this.getOff();
        this.topple(c, 1);
        p.kb = { x: tx * v, z: tz * v, t: 0.4 };
        p.act = { kind: 'slip', t: 2.2, total: 2.2 };
        return;
      }
    }
    // knock over people in the way
    if (Math.abs(dv.speed) > 1.5) {
      for (const n of city.npcs) {
        if (!n.pos || n.act?.kind === 'slip') continue;
        for (const k of [-1, 1]) {
          if (Math.hypot(n.pos.x - (nx + fx * off * k), n.pos.z - (nz + fz * off * k)) < r + 0.35) {
            this.knockDown(n, { x: fx * 4.5, z: fz * 4.5 }, p, 'bonk', ANIM.push.victim);
            break;
          }
        }
      }
    }
    const ground = city.layout.groundHeight(nx, nz);
    pos.set(nx, ground, nz); // the road is 12 cm below the pavement, like the traffic
    c.obj.rotation.y = dv.heading;
    c.fx = fx; c.fz = fz;
    // the player goes with it (cars brake for you, the camera follows)
    p.x = nx; p.z = nz; p.heading = dv.heading; p.speed = 0;
    p.root.position.set(nx, pos.y, nz);
    p.root.rotation.y = dv.heading;
    if (c.bike) {
      // lean into the turn (bike and rider together), pedal a bicycle
      const lean = leanInto(c, dv.heading, Math.abs(dv.speed), dt, 0.08, 0.45);
      c.obj.rotation.z = lean; p.root.rotation.z = lean;
      this.sitOnBike(p, c);
      if (c.bike === 'bicycle') pedalPose(p.body, (c.pedal = (c.pedal ?? 0) + dv.speed * 1.5 * dt));
    }
  }

  /** Dark tyre marks under the back wheels while drifting (the oldest fade away). */
  skid(c, x, z, fx, fz) {
    this.skids ??= [];
    this.skidMat ??= new THREE.MeshBasicMaterial({ color: 0x2f3236, transparent: true, opacity: 0.6, depthWrite: false });
    this.skidGeo ??= new THREE.PlaneGeometry(0.24, 0.42).rotateX(-Math.PI / 2);
    const back = c.size.hd * 0.6, w = c.bike ? 0 : c.size.hw * 0.75;
    for (const sx of c.bike ? [0] : [-1, 1]) {
      const px = x - fx * back + fz * w * sx, pz = z - fz * back - fx * w * sx;
      const last = this.skids[this.skids.length - 1];
      if (last && Math.hypot(last.position.x - px, last.position.z - pz) < 0.25) continue;
      const m = new THREE.Mesh(this.skidGeo, this.skidMat);
      m.position.set(px, this.city.layout.groundHeight(px, pz) + 0.015, pz);
      m.rotation.y = Math.atan2(fx, fz);
      m.renderOrder = 1;
      this.city.scene.add(m);
      this.skids.push(m);
      if (this.skids.length > 400) this.city.scene.remove(this.skids.shift());
    }
  }

  /** Sit the player on a bike: hips on the seat, knees up, hands on the bars. */
  /** A bicycle or scooter falls on its side (a rider on it falls with it), and gets up after a while. */
  topple(c, side) {
    if (c.fallen || !(c.bike || c.rider)) return;
    c.fallen = { t: 0, side, dur: c.rider ? 3.5 : 4.5 };
    c.speed = 0;
    if (c.riderBody) {
      // the rider is thrown clear of the bike (forward and to the far side) and lands on their back
      const rb = c.riderBody, P = c.obj.position, h = c.obj.rotation.y;
      const fx = Math.sin(h), fz = Math.cos(h), sx = Math.cos(h) * -side, sz = -Math.sin(h) * -side;
      c.obj.remove(rb);
      this.city.scene.add(rb);
      rb.rotation.order = 'YXZ';
      c.fallen.rider = { from: new THREE.Vector3(P.x, P.y + 0.3, P.z), to: new THREE.Vector3(P.x + fx * 2.0 + sx * 1.1, P.y, P.z + fz * 2.0 + sz * 1.1), h: h + (Math.random() - 0.5) * 1.2 };
      const j = joints(rb);
      for (const s of ['L', 'R']) {
        if (j[`leg${s}`]) j[`leg${s}`].rotation.x = s === 'L' ? -0.9 : -0.4;
        if (j[`shin${s}`]) j[`shin${s}`].rotation.x = 0.3;
        if (j[`arm${s}`]) j[`arm${s}`].rotation.x = -2.6;
      }
    }
    if (c.rider) {
      const at = () => c.obj.position.clone().add(new THREE.Vector3(0, 1.4, 0));
      this.say(at, pick(['CRASH!', 'WHAM!', 'KRUNCH!']), 'burst');
      this.say(at, pick(SHOUTS[Math.random() < 0.5 ? 'Aggressive' : 'Calm']), 'shout', 2.4, 0.1, null);
    }
  }
  /** Fallen bikes lie down, then stand back up (traffic riders ride on). */
  updateFallen(c, dt) {
    const f = c.fallen;
    f.t += dt;
    const down = f.t < f.dur ? Math.min(1, f.t / 0.25) : Math.max(0, 1 - (f.t - f.dur) / 0.4);
    c.obj.rotation.z = f.side * 1.4 * (down < 1 && f.t < f.dur ? down * down : down);
    if (f.rider) {
      // flying off, flat on the back, then (as the bike rights) back in the saddle
      const rb = c.riderBody, r = f.rider, u = Math.min(1, f.t / 0.4);
      rb.position.lerpVectors(r.from, r.to, u);
      rb.position.y = r.from.y + (r.to.y + 0.12 - r.from.y) * u + Math.sin(Math.PI * u) * 0.6;
      rb.rotation.set(-1.45 * Math.min(1, u * 1.3), r.h, 0);
    }
    if (f.t >= f.dur + 0.4) {
      c.fallen = null; c.obj.rotation.z = 0;
      if (f.rider && c.riderBody) {
        const rb = c.riderBody;
        this.city.scene.remove(rb);
        c.obj.add(rb);
        rb.rotation.set(0, 0, 0);
        sitPose(rb, c.riderSeat.y);
        rb.position.z = c.riderSeat.z;
        const j = joints(rb);
        for (const s of ['L', 'R']) if (j[`arm${s}`]) j[`arm${s}`].rotation.x = -0.95; // hands on the bars
      }
    }
  }

  sitOnBike(p, c) {
    const j = joints(p.body);
    const hipY = j.legL?.position.y ?? 0.85;
    p.body.position.set(0, (c.bike === 'bicycle' ? 0.86 : 0.74) - hipY + 0.05, c.bike === 'bicycle' ? -0.2 : -0.35);
    p.body.rotation.set(0, 0, 0);
    for (const s of ['L', 'R']) {
      if (j[`leg${s}`]) j[`leg${s}`].rotation.x = -1.35;
      if (j[`shin${s}`]) j[`shin${s}`].rotation.x = 1.3;
      if (j[`foot${s}`]) j[`foot${s}`].rotation.x = 0;
      if (j[`arm${s}`]) j[`arm${s}`].rotation.x = -0.95;
      if (j[`fore${s}`]) j[`fore${s}`].rotation.x = -0.3;
    }
    if (j.spine) j.spine.rotation.set(0.15, 0, 0);
  }

  // --- every frame ------------------------------------------------------------------------
  update(dt) {
    const city = this.city, p = city.player;
    if (this.fartCd > 0) this.fartCd -= dt;
    // peels: arm once the dropper has stepped away; anyone stepping on one slips
    for (const peel of [...this.peels]) {
      const dP = Math.hypot(p.x - peel.x, p.z - peel.z);
      if (!peel.armed) { if (dP > 0.9) peel.armed = true; continue; }
      if (dP < 0.35 && !p.riding && !p.act) { this.slip(p, true); this.removePeel(peel); continue; }
      for (const n of city.npcs) {
        if (n.pos && Math.hypot(n.pos.x - peel.x, n.pos.z - peel.z) < 0.35 && n.act?.kind !== 'slip') {
          this.slip(n); this.removePeel(peel); break;
        }
      }
    }
    // bubbles age and go
    for (const b of this.bubbles) {
      b.age += dt;
      // one speech bubble per person: a new line replaces what they said before
      if (!b.shown && b.age >= 0) {
        b.shown = true;
        if (b.anchor.who && b.kind !== 'burst') {
          for (const o of this.bubbles) if (o !== b && o.shown && o.anchor.who === b.anchor.who && o.kind !== 'burst') o.age = o.life;
        }
      }
    }
    if (this.charge) this.charge.t += dt;
    this.shake = Math.max(0, (this.shake ?? 0) - dt);
    this.bubbles = this.bubbles.filter((b) => b.age < b.life);
    // the menu closes if you walk away
    if (this.menu && !this.menu.npc.pos) this.closeMenu();
    // the ring under whoever you are facing
    this.target = p.riding || p.act ? null : this.facing();
    const t = this.menu ? { type: 'npc', ref: this.menu.npc } : this.target;
    this.ring.visible = !!t;
    if (t) {
      const o = t.type === 'npc' ? t.ref.root.position : t.ref.obj.position;
      const s = t.type === 'vehicle' ? Math.max(t.ref.size.hw, 0.6) * 2.2 : 1;
      this.ring.scale.setScalar(s);
      this.ring.position.set(o.x, city.layout.groundHeight(o.x, o.z) + 0.03, o.z);
    }
  }
}
