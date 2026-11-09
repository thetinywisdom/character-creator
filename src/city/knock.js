import * as THREE from 'three';
import { mergeByMaterial } from '../lib/merge.js';

/**
 * Small street things you can knock over with a vehicle (sandwich boards,
 * planters, parked bicycles, bins). A prop opts in with
 * `obj.userData.knock = true` before the town is merged; City takes them out
 * of the merged town so they can move. A hit sends one flying (it tumbles,
 * lands on its side and slides), then it blinks, goes POOF, and 5 s after
 * the hit it pops back at its place.
 */
const BACK_AFTER = 5;   // s from the hit until it is back
const LIE = 1.6;        // s lying on the ground before blinking
const BLINK = 0.9;      // s of blinking before the poof
const G = 18;

export class Knockables {
  constructor(city, group, colliders) {
    this.city = city;
    this.list = [];
    this.puffs = [];
    group.updateMatrixWorld(true);
    const found = [];
    group.traverse((o) => { if (o.userData.knock) found.push(o); });
    for (const o of found) {
      const pos = new THREE.Vector3(), quat = new THREE.Quaternion(), scl = new THREE.Vector3();
      o.matrixWorld.decompose(pos, quat, scl);
      o.parent.remove(o);
      o.position.copy(pos); o.quaternion.copy(quat); o.scale.copy(scl);
      const obj = mergeByMaterial(o);
      city.scene.add(obj);
      // its collider (placed at the same spot), switched off while it is down
      let col = null, bd = 0.4;
      for (const c of colliders) {
        const d = Math.hypot(c.x - pos.x, c.z - pos.z);
        if (d < bd && c.hw < 1.2 && c.hd < 1.2) { bd = d; col = c; }
      }
      const box = new THREE.Box3().setFromObject(obj);
      this.list.push({ obj, home: { pos: pos.clone(), quat: quat.clone() }, col, r: Math.max(0.3, Math.min(0.9, Math.max(box.max.x - box.min.x, box.max.z - box.min.z) / 2)), h: box.max.y - box.min.y, t: -1 });
    }
    this.puffMat = new THREE.MeshBasicMaterial({ color: 0xf2f2ee, transparent: true, depthWrite: false });
    this.puffGeo = new THREE.BoxGeometry(1, 1, 1);
  }

  /** A vehicle at (x, z) facing (fx, fz), `off` from centre to each end circle of radius r. */
  hitBy(x, z, fx, fz, speed, r, off) {
    if (Math.abs(speed) < 1.2) return;
    for (const k of this.list) {
      if (k.t >= 0) continue;
      const hx = k.home.pos.x, hz = k.home.pos.z;
      if (Math.abs(hx - x) > off + r + 1.5 || Math.abs(hz - z) > off + r + 1.5) continue;
      let hit = false;
      for (const s of [-1, 0, 1]) if (Math.hypot(hx - (x + fx * off * s), hz - (z + fz * off * s)) < r + k.r) hit = true;
      if (hit) this.knock(k, fx * Math.sign(speed), fz * Math.sign(speed), Math.abs(speed), hx - x, hz - z);
    }
  }

  knock(k, fx, fz, speed, rx, rz) {
    // off the way the vehicle goes, and a bit to whichever side it was on
    const side = Math.sign(rx * fz - rz * fx) || 1;
    const sx = fz * side, sz = -fx * side;
    const v = Math.min(10, speed * 0.8 + 2);
    k.v = { x: fx * v + sx * v * 0.35, y: 3.5 + speed * 0.3, z: fz * v + sz * v * 0.35 };
    k.p = k.home.pos.clone();
    k.axis = new THREE.Vector3(k.v.z, 0, -k.v.x).normalize(); // topples the way it flies
    k.tilt = 0; k.spin = 7 + Math.random() * 6; k.yaw = 0; k.yawV = (Math.random() - 0.5) * 10;
    k.t = 0; k.state = 'fly';
    if (k.col) k.col.down = true; // pushOut skips it while it is down
    const ix = this.city.ix;
    ix.say(() => k.obj.position.clone().add(new THREE.Vector3(0, k.h + 0.4, 0)), ['CLONK!', 'BANG!', 'KRAK!', 'THWACK!'][Math.floor(Math.random() * 4)], 'burst');
    ix.shake = Math.max(ix.shake ?? 0, 0.15);
  }

  /**
   * A cloud of cubes billowing out low from `at` (dust when someone hits the
   * ground, a green stink cloud for a fart): `color`, `n` cubes, spread
   * radius `r` m, lasting `life` s.
   */
  cloud(at, { color = 0xd8cfb8, n = 10, r = 0.6, life = 0.8, size = 0.32, rise = 0.5, opacity = 0.9 } = {}) {
    for (let i = 0; i < n; i++) {
      const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false });
      const m = new THREE.Mesh(this.puffGeo, mat);
      const a = (i / n) * Math.PI * 2 + Math.random() * 0.5;
      m.position.set(at.x + Math.cos(a) * r * 0.4, at.y + 0.15 + Math.random() * 0.25, at.z + Math.sin(a) * r * 0.4);
      m.userData.v = new THREE.Vector3(Math.cos(a) * r * 2.4, rise * (0.4 + Math.random()), Math.sin(a) * r * 2.4);
      m.userData.t = 0; m.userData.life = life; m.userData.size = size; m.userData.op = opacity;
      m.rotation.set(Math.random(), Math.random(), Math.random());
      m.scale.setScalar(size * 0.6);
      this.city.scene.add(m);
      this.puffs.push(m);
    }
  }

  puff(at, n = 7) {
    for (let i = 0; i < n; i++) {
      const m = new THREE.Mesh(this.puffGeo, this.puffMat.clone());
      const a = (i / n) * Math.PI * 2;
      m.position.set(at.x + Math.cos(a) * 0.2, at.y + 0.3 + Math.random() * 0.4, at.z + Math.sin(a) * 0.2);
      m.userData.v = new THREE.Vector3(Math.cos(a) * 1.6, 0.8 + Math.random(), Math.sin(a) * 1.6);
      m.userData.t = 0;
      m.scale.setScalar(0.25);
      this.city.scene.add(m);
      this.puffs.push(m);
    }
  }

  update(dt) {
    const ground = (x, z) => this.city.layout.groundHeight(x, z);
    for (const k of this.list) {
      if (k.t < 0) continue;
      k.t += dt;
      const o = k.obj;
      if (k.state === 'fly' || k.state === 'lie') {
        k.v.y -= G * dt;
        k.p.x += k.v.x * dt; k.p.y += k.v.y * dt; k.p.z += k.v.z * dt;
        const gy = ground(k.p.x, k.p.z);
        if (k.p.y <= gy) {
          k.p.y = gy;
          if (k.state === 'fly' && k.v.y < -2) { k.v.y *= -0.3; k.v.x *= 0.6; k.v.z *= 0.6; } // one bounce
          else { k.v.y = 0; k.state = 'lie'; k.lieT ??= k.t; }
          const f = Math.max(0, 1 - dt * 4); k.v.x *= f; k.v.z *= f; // slides to a stop
        }
        if (k.state === 'fly') { k.tilt += k.spin * dt; k.yaw += k.yawV * dt; }
        else {
          // settle on its side: the nearest quarter turn that leaves it lying
          const target = Math.PI / 2 + Math.round((k.tilt - Math.PI / 2) / Math.PI) * Math.PI;
          k.tilt += (target - k.tilt) * Math.min(1, dt * 10);
        }
        o.position.copy(k.p);
        o.quaternion.setFromAxisAngle(k.axis, k.tilt).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), k.yaw)).multiply(k.home.quat);
        // lying for a moment, then blinking, then POOF
        if (k.lieT != null) {
          const lay = k.t - k.lieT;
          if (lay > LIE) o.visible = Math.floor((lay - LIE) * 12) % 2 === 0;
          if (lay > LIE + BLINK) {
            o.visible = false; k.state = 'gone';
            this.puff(o.position.clone());
            this.city.ix.say(() => k.p.clone().add(new THREE.Vector3(0, 0.8, 0)), 'POOF!', 'burst');
          }
        }
      }
      if (k.state === 'gone' && k.t >= Math.max(BACK_AFTER, (k.lieT ?? 0) + LIE + BLINK + 0.3)) {
        // back at its place with a little pop
        k.state = 'pop'; k.popT = 0;
        o.position.copy(k.home.pos); o.quaternion.copy(k.home.quat); o.visible = true;
        this.puff(k.home.pos, 5);
      }
      if (k.state === 'pop') {
        k.popT += dt;
        const u = Math.min(1, k.popT / 0.3);
        o.scale.setScalar(u < 1 ? 0.2 + 0.8 * u + Math.sin(u * Math.PI) * 0.25 : 1);
        if (u >= 1) {
          k.t = -1; k.state = null; k.lieT = null;
          if (k.col) k.col.down = false;
        }
      }
    }
    for (const m of [...this.puffs]) {
      const u = (m.userData.t += dt) / (m.userData.life ?? 0.6);
      m.position.addScaledVector(m.userData.v, dt);
      m.userData.v.multiplyScalar(Math.max(0, 1 - dt * 3));
      const sz = m.userData.size ?? 0.25;
      m.scale.setScalar(sz + u * sz * 2);
      m.rotation.y += dt * 1.5;
      m.material.opacity = Math.max(0, 1 - u) * (m.userData.op ?? 1);
      if (u >= 1) { this.city.scene.remove(m); m.material.dispose(); this.puffs.splice(this.puffs.indexOf(m), 1); }
    }
  }
}
