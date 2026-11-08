import * as THREE from 'three';
import { setDetail } from '../lib/shapes.js';
import { mergeByMaterial } from '../lib/merge.js';
import { mulberry32 } from '../lib/rng.js';
import { car } from '../props/vehicles.js';
import { generateCityData } from './layout.js';
import { buildCity } from './build.js';
import { JOINT_NAMES, createGait, poseGait, stepGait } from '../anim/gait.js';

// The walkable town: a generated city, your character (built from the
// creator's current settings), pedestrians on the sidewalks, cats in the park
// and a few cars on the ring road. Rendered by main.js like any other cell
// (it has .scene and .style), with its own camera.

const LIMBS = new Set([...JOINT_NAMES, 'head']); // kept as separate groups so they can move
const PLAYER_R = 0.3;

/** Point at distance s along a closed polyline. Returns position and heading. */
function alongLoop(loop, lengths, total, s) {
  s = ((s % total) + total) % total;
  for (let i = 0; i < loop.length; i++) {
    if (s <= lengths[i]) {
      const a = loop[i], b = loop[(i + 1) % loop.length];
      const t = s / Math.max(lengths[i], 1e-6);
      return { x: a[0] + (b[0] - a[0]) * t, z: a[1] + (b[1] - a[1]) * t, dx: b[0] - a[0], dz: b[1] - a[1] };
    }
    s -= lengths[i];
  }
  return { x: loop[0][0], z: loop[0][1], dx: 1, dz: 0 };
}

function loopLengths(loop) {
  const lengths = loop.map((a, i) => {
    const b = loop[(i + 1) % loop.length];
    return Math.hypot(b[0] - a[0], b[1] - a[1]);
  });
  return { lengths, total: lengths.reduce((s, l) => s + l, 0) };
}

export class City {
  constructor({ style, renderer, human, cat, params, npcCount = 28, seed = 3, data = null }) {
    this.style = style;
    this.scene = new THREE.Scene();
    this.baseBackground = new THREE.Color(style.background);
    this.scene.background = this.baseBackground.clone();
    this.camera = new THREE.PerspectiveCamera(55, 1, 0.1, 400);

    const lights = style.createLights({ renderer });
    this.key = lights.key;
    this.hemi = lights.hemi;
    this.base = { keyColor: this.key.color.clone(), keyIntensity: this.key.intensity, hemiIntensity: this.hemi.intensity };
    lights.objects.forEach((o) => this.scene.add(o));
    this.key.shadow.mapSize.set(1024, 1024);
    const sc = this.key.shadow.camera;
    sc.left = -30; sc.right = 30; sc.top = 30; sc.bottom = -30; sc.near = 1; sc.far = 120;
    sc.updateProjectionMatrix();
    this.key.shadow.normalBias = 0.04;
    this.lightDir = new THREE.Vector3(0.5, 1, 0.6).normalize();

    // --- the town (static, merged to a few meshes) --------------------------
    setDetail(style.detail ?? 1);
    // any city file (generated, edited or loaded); a generated town by default
    const city = buildCity(data ?? generateCityData(seed), style);
    this.layout = city;
    this.scene.add(mergeByMaterial(city.group));

    // --- characters -----------------------------------------------------------
    const rng = mulberry32(seed * 31 + 7);
    const buildPerson = (p) => {
      const raw = human.build(p, style);
      style.decorate?.(raw);
      return mergeByMaterial(raw, LIMBS);
    };
    this.player = { body: buildPerson(params.human), root: new THREE.Group(), x: 0, z: 0, heading: 0, speed: 0, gait: createGait() };
    this.player.root.add(this.player.body);
    this.scene.add(this.player.root);
    // start on the sidewalk next to the park
    const pr = city.parkRect;
    this.player.x = (pr.x0 + pr.x1) / 2;
    this.player.z = pr.z1 + 2.5; // the sidewalk ring of the park block

    this.npcs = [];
    for (let i = 0; i < npcCount; i++) {
      const loop = city.walkLoops[Math.floor(rng() * city.walkLoops.length)];
      const { lengths, total } = loopLengths(loop);
      const npc = {
        body: buildPerson({ ...params.human, ...human.randomize(rng) }),
        root: new THREE.Group(),
        loop, lengths, total,
        s: rng() * total,
        dir: rng() < 0.5 ? 1 : -1,
        speed: 1.0 + rng() * 0.5,
        gait: createGait(rng() * 10),
        lane: (rng() - 0.5) * 1.2, // spread across the sidewalk
      };
      npc.root.add(npc.body);
      this.scene.add(npc.root);
      this.npcs.push(npc);
    }

    // cats wandering in the park
    this.cats = [];
    for (let i = 0; i < 3; i++) {
      const raw = cat.build({ ...params.cat }, style);
      raw.scale.setScalar(cat.exaggeration ?? 1);
      const body = mergeByMaterial(raw);
      const root = new THREE.Group();
      root.add(body);
      this.scene.add(root);
      this.cats.push({ root, x: pr.x0 + rng() * (pr.x1 - pr.x0), z: pr.z0 + rng() * (pr.z1 - pr.z0), tx: 0, tz: 0, wait: rng() * 3 });
    }

    // a few cars driving round the ring road (on the left, Japanese style)
    this.cars = [];
    const ring = loopLengths(city.carLoop);
    const kinds = ['Kei car', 'Sedan', 'Taxi', 'Minivan', 'Kei car'];
    const colors = ['White', 'Red', undefined, 'Blue', 'Yellow'];
    for (let i = 0; i < kinds.length; i++) {
      const obj = mergeByMaterial(car.build({ variant: kinds[i], color: colors[i] }, style));
      this.scene.add(obj);
      this.cars.push({ obj, s: (i / kinds.length) * ring.total, speed: 7 + rng() * 3, ...ring, loop: city.carLoop });
    }
    setDetail(1);

    this.cam = { yaw: Math.PI, pitch: 0.32, dist: 6 };
    this.applyLighting({ keyColor: 0xffffff, key: 1, dir: [0.5, 1, 0.6], hemi: 1, tint: null, tintAmount: 0 });
  }

  applyLighting(preset) {
    this.key.color.copy(this.base.keyColor).multiply(new THREE.Color(preset.keyColor));
    this.key.intensity = this.base.keyIntensity * preset.key;
    this.hemi.intensity = this.base.hemiIntensity * preset.hemi;
    this.scene.background.copy(this.baseBackground);
    if (preset.tint !== null) this.scene.background.lerp(new THREE.Color(preset.tint), preset.tintAmount);
    this.lightDir.set(...preset.dir).normalize();
  }

  /** Push the player out of any collider it overlaps (circle vs box). */
  collide(p) {
    for (const c of this.layout.colliders) {
      const dx = p.x - c.x, dz = p.z - c.z;
      if (Math.abs(dx) > c.hw + PLAYER_R || Math.abs(dz) > c.hd + PLAYER_R) continue;
      const cx = Math.max(-c.hw, Math.min(c.hw, dx));
      const cz = Math.max(-c.hd, Math.min(c.hd, dz));
      let ox = dx - cx, oz = dz - cz;
      const d = Math.hypot(ox, oz);
      if (d >= PLAYER_R) continue;
      if (d < 1e-5) {
        // centre inside the box: push out along the shallowest axis
        const px = c.hw - Math.abs(dx), pz = c.hd - Math.abs(dz);
        if (px < pz) p.x = c.x + Math.sign(dx || 1) * (c.hw + PLAYER_R);
        else p.z = c.z + Math.sign(dz || 1) * (c.hd + PLAYER_R);
        continue;
      }
      ox /= d; oz /= d;
      p.x += ox * (PLAYER_R - d);
      p.z += oz * (PLAYER_R - d);
    }
    const lim = { x: this.layout.size.X / 2 + 20, z: this.layout.size.Z / 2 + 20 };
    p.x = Math.max(-lim.x, Math.min(lim.x, p.x));
    p.z = Math.max(-lim.z, Math.min(lim.z, p.z));
  }

  update(dt, input) {
    const look = input.takeLook();
    this.cam.yaw += look.yaw;
    this.cam.pitch = Math.max(0.05, Math.min(1.2, this.cam.pitch + look.pitch));
    this.cam.dist = Math.max(2.5, Math.min(18, this.cam.dist + look.zoom * 0.8));

    // --- player: move relative to the camera ---------------------------------
    const p = this.player;
    const a = input.axes();
    const fwd = { x: -Math.sin(this.cam.yaw), z: -Math.cos(this.cam.yaw) };
    const right = { x: -fwd.z, z: fwd.x };
    const mx = right.x * a.x - fwd.x * a.z;
    const mz = right.z * a.x - fwd.z * a.z;
    const moving = Math.hypot(mx, mz) > 0.05;
    const target = moving ? (a.run ? 4.2 : 1.6) : 0;
    p.speed += (target - p.speed) * Math.min(1, dt * 8);
    if (moving) {
      const want = Math.atan2(mx, mz);
      let d = want - p.heading;
      d = Math.atan2(Math.sin(d), Math.cos(d));
      p.heading += d * Math.min(1, dt * 10);
      const len = Math.hypot(mx, mz);
      p.x += (mx / len) * p.speed * dt;
      p.z += (mz / len) * p.speed * dt;
    }
    this.collide(p);
    stepGait(p.gait, dt, p.speed);
    poseGait(p.body, p.gait, this.playerGait ?? 'natural');
    const ground = this.layout.groundHeight(p.x, p.z);
    p.root.position.set(p.x, ground, p.z);
    p.root.rotation.y = p.heading;

    // --- pedestrians ----------------------------------------------------------
    for (const n of this.npcs) {
      n.s += n.dir * n.speed * dt;
      const q = alongLoop(n.loop, n.lengths, n.total, n.s);
      const hd = Math.atan2(q.dx * n.dir, q.dz * n.dir);
      const len = Math.hypot(q.dx, q.dz) || 1;
      // sideways offset so people don't all walk on one line
      const ox = (-q.dz / len) * n.lane, oz = (q.dx / len) * n.lane;
      n.root.position.set(q.x + ox, 0, q.z + oz);
      n.root.rotation.y = hd;
      stepGait(n.gait, dt, n.speed);
      poseGait(n.body, n.gait);
    }

    // --- cats: wander between random points in the park ----------------------
    const pr = this.layout.parkRect;
    for (const c of this.cats) {
      if (c.wait > 0) { c.wait -= dt; continue; }
      if (!c.tx) { c.tx = pr.x0 + Math.random() * (pr.x1 - pr.x0); c.tz = pr.z0 + Math.random() * (pr.z1 - pr.z0); }
      const dx = c.tx - c.x, dz = c.tz - c.z;
      const d = Math.hypot(dx, dz);
      if (d < 0.3) { c.tx = 0; c.wait = 1 + Math.random() * 4; continue; }
      c.x += (dx / d) * 0.9 * dt;
      c.z += (dz / d) * 0.9 * dt;
      c.root.position.set(c.x, 0.05, c.z);
      c.root.rotation.y = Math.atan2(dx, dz);
    }

    // --- cars on the ring road -------------------------------------------------
    for (const c of this.cars) {
      c.s += c.speed * dt;
      const q = alongLoop(c.loop, c.lengths, c.total, c.s);
      const len = Math.hypot(q.dx, q.dz) || 1;
      const fx = q.dx / len, fz = q.dz / len;
      // keep left: offset toward the driver's left side
      c.obj.position.set(q.x + fz * 2.2, -0.12, q.z - fx * 2.2);
      c.obj.rotation.y = Math.atan2(fx, fz);
    }

    // --- camera: third person, behind and above ----------------------------------
    const { yaw, pitch, dist } = this.cam;
    const tx = p.x, ty = ground + 1.4, tz = p.z;
    this.camera.position.set(
      tx + Math.sin(yaw) * Math.cos(pitch) * dist,
      ty + Math.sin(pitch) * dist,
      tz + Math.cos(yaw) * Math.cos(pitch) * dist,
    );
    this.camera.lookAt(tx, ty, tz);

    // shadows follow the player
    this.key.position.set(p.x, 0, p.z).addScaledVector(this.lightDir, 50);
    this.key.target.position.set(p.x, 0, p.z);
    this.key.target.updateMatrixWorld();
  }
}
