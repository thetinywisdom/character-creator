import * as THREE from 'three';
import { JOINT_NAMES } from '../anim/gait.js';
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
const NAMES = ['DEB', 'BIG', 'KEN', 'YUKI', 'MOMO', 'TARO', 'HANA', 'JIRO', 'AYA', 'SORA', 'RIKU', 'NANA', 'GEN', 'MAI', 'KOTA', 'EMI'];
// charging a slap: the first cycle (green to yellow) is a normal slap, the
// second (yellow to red, shaking) a power slap that knocks them down
export const CHARGE = [0.7, 0.7];
const CHASE_SPEED = 5.4; // m/s: faster than your run (4.6): get a vehicle or hide
const CHASE_YELLS = ['Get back here!', "I'll get you!", "You're DEAD!", 'Come here!!', "Don't you run!", 'COWARD!', '#@%&!!'];
const BURSTS = {
  powerslap: ['SMAAACK!!', 'KA-POW!!', 'WHAM!!'], slap: ['SLAP!', 'WHAP!', 'SMACK!'], push: ['SHOVE!', 'WHUMP!', 'OOF!'], slip: ['WHOOPS!'], bonk: ['BONK!'] };
const pick = (a) => a[Math.floor(Math.random() * a.length)];

const REACH = 1.7;        // m: how close a person must be to act on them
const PICK_REACH = 60;    // m: a clicked person can be anywhere you can see; you run over to them
const RUN = 4.2;
const MAX_PEELS = 10;

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
    this.bubbles.push({ anchor, text, kind, name, side, age: -delay, life, id: Math.random() });
  }
  nameOf(n) { return (n.name ??= NAMES[Math.floor(Math.random() * NAMES.length)]); }
  headOf(n) { return () => n.root.position.clone().add(new THREE.Vector3(0, (n.look?.height ?? 1.7) + 0.3, 0)); }
  playerHead() { const p = this.city.player; return () => p.root.position.clone().add(new THREE.Vector3(0, (p.height ?? 1.7) + 0.3, 0)); }
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
    if (ev.type === 'jump') { if (!p.riding && !(p.jumpY > 0)) { p.vy = 4.4; p.jumpY = 0.001; } return; }
    if (ev.type === 'chargeEnd') {
      const c = this.charge;
      this.charge = null;
      if (c) this.go(c.t >= CHARGE[0] ? 'powerslap' : 'slap', c.ref);
      return;
    }
    if (ev.type === 'close') { this.closeMenu(); return; }
    if (ev.type === 'choose') { const m = this.menu; if (m) { this.menu = null; this.go(['slap', 'push', 'talk'][ev.n], m.npc); } return; }
    if (p.riding) {
      if (['primary', 'click', 'hold'].includes(ev.type)) this.getOff();
      return;
    }
    const picked = ev.x !== undefined ? this.pickAt(ev.x, ev.y, camera, rect) : null;
    const t = picked ?? this.facing();
    switch (ev.type) {
      case 'primary':
      case 'click':
        if (this.menu) { const same = t?.ref === this.menu.npc; this.closeMenu(); if (same || !t) return; }
        if (t?.type === 'npc') this.openMenu(t.ref);
        else if (t?.type === 'vehicle') this.go('ride', t.ref);
        return;
      case 'chargeStart':
        if (t?.type === 'npc') { this.closeMenu(); this.charge = { t: 0, ref: t.ref }; }
        else if (t?.type === 'vehicle') this.go('ride', t.ref);
        return;
      case 'hold':
        if (t?.type === 'npc') this.go('slap', t.ref);
        else if (t?.type === 'vehicle') this.go('ride', t.ref);
        return;
      case 'double': if (t?.type === 'npc') this.go('push', t.ref); return;
      case 'right': if (t?.type === 'npc') this.go('talk', t.ref); return;
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
    p.action = { kind: kind === 'powerslap' ? 'slap' : kind, t: 0, dur: kind === 'talk' ? 0.01 : 0.4 };
    const agg = n.trait === 'Aggressive';
    if (kind === 'talk') {
      // a question and an answer that fits it (smalltalk.js), from a calm or a grumpy person
      const [q, calm, grumpy] = pick(SMALL_TALK);
      this.say(this.playerHead(), q, 'talk', 3.4, 0, 'YOU', 'left');
      this.say(this.headOf(n), agg ? grumpy : calm, 'talk', 3.2, 1.1, this.nameOf(n), 'right');
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
        // a push knocks them over (like a car): they fall, get up shouting, then react
        const k = kind === 'powerslap' ? 4.2 : 3.2;
        if (kind === 'powerslap') this.shake = 0.5;
        this.knockDown(n, { x: (dx / d) * k, z: (dz / d) * k }, p);
        return;
      }
      this.say(this.headOf(n), pick(SHOUTS[agg ? 'Aggressive' : 'Calm']), 'shout', 2.6, 0.75, this.nameOf(n));
      n.flinch = 0.35;
      if (agg) n.act = { kind: 'retaliate', move: kind, t: 0.55, struck: false };
      else n.act = { kind: 'flee', t: 4, delay: kind === 'push' ? 0.35 : 0.2 };
    }, 150);
  }

  /** An aggressive person hits the player back. */
  strikePlayer(n, move) {
    const p = this.city.player;
    n.action = { kind: move, t: 0, dur: 0.4 };
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
      p.act = move === 'push' ? { kind: 'slip', t: 2.0, total: 2.0 } : { kind: 'stagger', t: 0.5 };
    }, 150);
  }
  midOfPlayer() { const p = this.city.player; return () => p.root.position.clone().add(new THREE.Vector3(0, (p.height ?? 1.7) * 0.75, 0)); }

  /** Someone slips (a banana peel, or hit by your vehicle). */
  /**
   * Knock a person over (a push, or your vehicle): they fly back along `kb`,
   * fall, get up shouting, then react: aggressive ones chase you and push you
   * back, calm ones run away.
   */
  knockDown(n, kb, p = this.city.player, word = null) {
    const agg = n.trait === 'Aggressive';
    if (word) this.say(this.midOf(n), pick(BURSTS[word]), 'burst');
    n.act = { kind: 'slip', t: 2.0, total: 2.0,
      then: agg ? { kind: 'chase', move: 'push', t: 10, cd: 0.4 } : { kind: 'flee', t: 4, delay: 0 } };
    n.kb = { x: kb.x, z: kb.z, t: 0.35 };
    if (this.menu?.npc === n) this.menu = null;
    // the shout comes as they get back up
    this.say(this.headOf(n), pick(SHOUTS[agg ? 'Aggressive' : 'Calm']), 'shout', 2.6, 1.7, this.nameOf(n));
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
      if (a.then) { n.act = a.then; n.body.rotation.x = 0; n.body.position.y = 0; } // up again: now react
      else city.endAct(n);
    }
  }

  // --- poses on top of the walk: arm swings, flinch, falling ---------------------------
  poseActor(who, dt) {
    const body = who.body, j = joints(body);
    if (who.action) {
      const ac = who.action;
      ac.t += dt;
      const f = Math.sin(Math.PI * Math.min(1, ac.t / ac.dur));
      if (ac.kind === 'slap') {
        if (j.armR) { j.armR.rotation.x = -1.7 * f; j.armR.rotation.z -= 0.6 * f; }
        if (j.foreR) j.foreR.rotation.x = -0.3 * f;
        if (j.spine) j.spine.rotation.y += 0.35 * f;
      } else if (ac.kind === 'push') {
        for (const s of ['L', 'R']) {
          if (j[`arm${s}`]) j[`arm${s}`].rotation.x = -1.45 * f;
          if (j[`fore${s}`]) j[`fore${s}`].rotation.x = -0.25 * f;
        }
        if (j.spine) j.spine.rotation.x += 0.3 * f;
      }
      if (ac.t >= ac.dur) who.action = null;
    }
    if (who.flinch > 0) {
      who.flinch -= dt;
      if (j.spine) j.spine.rotation.x -= 0.35 * Math.sin(Math.PI * Math.max(0, who.flinch) / 0.35);
    }
    const a = who.act;
    if (a?.kind === 'slip') {
      // feet fly up, land flat on the back, lie still, get back up
      const t = a.total - a.t;
      const down = t < 0.25 ? t / 0.25 : t < a.total - 0.6 ? 1 : Math.max(0, (a.total - t) / 0.6);
      body.rotation.x = -1.45 * down;
      body.position.y = 0.12 * down;
      if (j.legL) j.legL.rotation.x = -0.9 * down * (t < 0.4 ? 1.4 : 1);
      if (j.legR) j.legR.rotation.x = -0.6 * down;
      if (j.armL) j.armL.rotation.x = -1.2 * down;
      if (j.armR) j.armR.rotation.x = -1.0 * down;
    } else if (a?.kind === 'stagger') {
      if (j.spine) j.spine.rotation.x -= 0.4 * Math.max(0, a.t);
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
      p.root.rotation.y = p.heading;
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
      p.root.rotation.y = p.heading;
      if (p.act.t <= 0) { p.act = null; p.body.rotation.x = 0; }
      return true;
    }
    return false;
  }

  // --- banana peels -----------------------------------------------------------------
  dropPeel() {
    const p = this.city.player;
    if (p.riding) return;
    const g = new THREE.Group();
    const yellow = this.style.material('signage', 0xece0aa), tip = this.style.material('wood', 0x8a7462);
    for (let k = 0; k < 4; k++) {
      const leaf = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.02, 0.16), yellow);
      leaf.position.set(Math.sin((k * Math.PI) / 2 + 0.4) * 0.08, 0.015, Math.cos((k * Math.PI) / 2 + 0.4) * 0.08);
      leaf.rotation.y = (k * Math.PI) / 2 + 0.4;
      g.add(leaf);
    }
    g.add(new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 0.05), tip).translateY(0.03));
    g.scale.setScalar(1.6); // oversized so it reads when tiny
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
    const throttle = -axes.z; // W forward
    if (throttle > 0.1) dv.speed += (dv.speed < 0 ? 9 : 5) * throttle * dt;
    else if (throttle < -0.1) dv.speed += (dv.speed > 0 ? -9 : -3) * -throttle * dt;
    else dv.speed *= Math.max(0, 1 - dt * 0.8);
    const hb = axes.handbrake;
    if (hb) dv.speed *= Math.max(0, 1 - dt * 0.9); // the handbrake bleeds speed off
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
            this.knockDown(n, { x: fx * 2.5, z: fz * 2.5 }, p, 'bonk');
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
    if (c.bike) this.sitOnBike(p, c);
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
    if (c.rider) {
      const at = () => c.obj.position.clone().add(new THREE.Vector3(0, 1.4, 0));
      this.say(at, pick(['CRASH!', 'WHAM!', 'KRUNCH!']), 'burst');
      this.say(at, pick(SHOUTS[Math.random() < 0.5 ? 'Aggressive' : 'Calm']), 'shout', 2.4, 0.6, pick(NAMES));
    }
  }
  /** Fallen bikes lie down, then stand back up (traffic riders ride on). */
  updateFallen(c, dt) {
    const f = c.fallen;
    f.t += dt;
    const down = f.t < f.dur ? Math.min(1, f.t / 0.25) : Math.max(0, 1 - (f.t - f.dur) / 0.4);
    c.obj.rotation.z = f.side * 1.4 * (down < 1 && f.t < f.dur ? down * down : down);
    if (f.t >= f.dur + 0.4) { c.fallen = null; c.obj.rotation.z = 0; }
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
    for (const b of this.bubbles) b.age += dt;
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
