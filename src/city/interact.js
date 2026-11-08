import * as THREE from 'three';
import { JOINT_NAMES } from '../anim/gait.js';

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

const LINES = {
  player: ['Hi there!', 'Nice weather today!', 'Seen any cats around?', 'Busy day?', 'Love this street.', 'Where is the station?', 'Nice shirt!'],
  Calm: ['Hello!', "Isn't it lovely?", 'Have a nice day!', 'Oh, hi!', 'Just heading home.', 'The bakery here is great.', 'Thank you!'],
  Aggressive: ['What do you want?', 'Hmph.', "Don't bother me.", 'Make it quick.', "I'm busy!", 'Whatever.', 'Do I know you?'],
};
const BURSTS = { slap: ['SLAP!', 'WHAP!', 'SMACK!'], push: ['SHOVE!', 'WHUMP!', 'OOF!'], slip: ['WHOOPS!'], bonk: ['BONK!'] };
const pick = (a) => a[Math.floor(Math.random() * a.length)];

const REACH = 1.7;        // m: how close a person must be to act on them
const PICK_REACH = 3.2;   // m: a clicked person can be a little further
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
  say(anchor, text, kind = 'talk', life = kind === 'burst' ? 0.9 : 3.2, delay = 0) {
    this.bubbles.push({ anchor, text, kind, age: -delay, life, id: Math.random() });
  }
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
      if (!n.pos || n.act?.kind === 'slip') continue;
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
      if (!n.pos || Math.hypot(n.pos.x - p.x, n.pos.z - p.z) > PICK_REACH) continue;
      const s = toScreen(this.midOf(n)());
      const d = Math.hypot(s.x - cx, s.y - cy);
      if (s.ok && d < 55 && d < bd) { bd = d; best = { type: 'npc', ref: n }; }
    }
    if (best) return best;
    for (const c of cars) {
      if (this.distToVehicle(c, p.x, p.z) > 2.5) continue;
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
    if (ev.type === 'close') { this.closeMenu(); return; }
    if (ev.type === 'choose') { const m = this.menu; if (m) { this.closeMenu(); this.doAction(['slap', 'push', 'talk'][ev.n], m.npc); } return; }
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
        else if (t?.type === 'vehicle') this.getOn(t.ref);
        return;
      case 'hold':
        if (t?.type === 'npc') this.doAction('slap', t.ref);
        else if (t?.type === 'vehicle') this.getOn(t.ref);
        return;
      case 'double': if (t?.type === 'npc') this.doAction('push', t.ref); return;
      case 'right': if (t?.type === 'npc') this.doAction('talk', t.ref); return;
      case 'slap': case 'push': case 'talk':
        if (t?.type === 'npc') this.doAction(ev.type, t.ref);
        return;
      default:
    }
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
    p.action = { kind, t: 0, dur: kind === 'talk' ? 0.01 : 0.4 };
    const agg = n.trait === 'Aggressive';
    if (kind === 'talk') {
      this.say(this.playerHead(), pick(LINES.player));
      this.say(this.headOf(n), pick(LINES[agg ? 'Aggressive' : 'Calm']), 'talk', 3.2, 1.0);
      n.act = { kind: 'talk', t: 4.2 };
      return;
    }
    // the hit lands a moment into the swing
    setTimeout(() => {
      this.say(this.midOf(n), pick(BURSTS[kind]), 'burst');
      const dx = n.pos.x - p.x, dz = n.pos.z - p.z, d = Math.hypot(dx, dz) || 1;
      if (kind === 'push') n.kb = { x: (dx / d) * 3.2, z: (dz / d) * 3.2, t: 0.35 };
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
      if (Math.hypot(p.x - n.pos.x, p.z - n.pos.z) > 1.5 || p.riding) return;
      this.say(this.midOfPlayer(), pick(BURSTS[move]), 'burst');
      const dx = p.x - n.pos.x, dz = p.z - n.pos.z, d = Math.hypot(dx, dz) || 1;
      const k = move === 'push' ? 3.6 : 1.8;
      p.kb = { x: (dx / d) * k, z: (dz / d) * k, t: move === 'push' ? 0.4 : 0.25 };
      p.act = { kind: 'stagger', t: move === 'push' ? 0.7 : 0.5 };
    }, 150);
  }
  midOfPlayer() { const p = this.city.player; return () => p.root.position.clone().add(new THREE.Vector3(0, (p.height ?? 1.7) * 0.75, 0)); }

  /** Someone slips (a banana peel, or hit by your vehicle). */
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
        if (a.t <= 0) { n.act = { kind: 'chase', move: a.move, t: 6, cd: 1.0 }; return this.updateNpc(n, 0); }
        break;
      case 'chase':
        face = Math.atan2(toP.x, toP.z);
        a.cd -= dt;
        if (dP > 1.0) speed = RUN;
        else if (a.cd <= 0) { this.strikePlayer(n, a.move); a.cd = 99; a.t = Math.min(a.t, 0.8); }
        if (dP > 16 || p.riding) a.t = Math.min(a.t, 0.3); // you got away
        break;
      case 'flee':
        if ((a.delay -= dt) > 0) break;
        face = Math.atan2(-toP.x, -toP.z);
        speed = RUN;
        break;
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
    if (n.act === a && a.t <= 0) city.endAct(n);
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
    p.riding = c;
    c.drive = { speed: 0, heading: c.obj.rotation.y };
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
    dv.speed = Math.max(-3, Math.min(MAX * (axes.run ? 1.25 : 1), dv.speed));
    // steer (more grip at speed, reversed when backing up)
    const steer = -axes.x * Math.min(1, Math.abs(dv.speed) / 3) * (c.bike ? 2.4 : 1.6);
    dv.heading += steer * dt * Math.sign(dv.speed || 1);
    const fx = Math.sin(dv.heading), fz = Math.cos(dv.heading);
    const pos = c.obj.position;
    let nx = pos.x + fx * dv.speed * dt, nz = pos.z + fz * dv.speed * dt;
    // collide: two circles along the vehicle against buildings, props, other vehicles
    const r = c.size.hw, off = Math.max(0, c.size.hd - r);
    let hit = false;
    for (const k of [-1, 1]) {
      const q = { x: nx + fx * off * k, z: nz + fz * off * k };
      const bx = q.x, bz = q.z;
      city.pushOut(q, r);
      for (const o of city.cars) if (o !== c) city.pushOutOfCar(q, r, o);
      const px = q.x - bx, pz = q.z - bz;
      if (Math.hypot(px, pz) > 1e-4) {
        nx += px; nz += pz;
        if ((px * fx + pz * fz) * Math.sign(dv.speed) < 0) hit = true; // pushed back against the way we go: a crash
      }
    }
    if (hit) dv.speed *= 0.4;
    // knock over people in the way
    if (Math.abs(dv.speed) > 1.5) {
      for (const n of city.npcs) {
        if (!n.pos || n.act?.kind === 'slip') continue;
        for (const k of [-1, 1]) {
          if (Math.hypot(n.pos.x - (nx + fx * off * k), n.pos.z - (nz + fz * off * k)) < r + 0.35) {
            this.slip(n, false, 'bonk');
            n.kb = { x: fx * 2.5, z: fz * 2.5, t: 0.3 };
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

  /** Sit the player on a bike: hips on the seat, knees up, hands on the bars. */
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
    this.bubbles = this.bubbles.filter((b) => b.age < b.life);
    // the menu closes if you walk away
    if (this.menu && (!this.menu.npc.pos || Math.hypot(this.menu.npc.pos.x - p.x, this.menu.npc.pos.z - p.z) > PICK_REACH + 0.5)) this.closeMenu();
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
